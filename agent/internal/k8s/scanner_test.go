package k8s

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// newScannerWithFakeClient creates a Scanner backed by a fake k8s client for testing.
func newScannerWithFakeClient(pods []corev1.Pod) *Scanner {
	fakeClient := fake.NewSimpleClientset()
	for i := range pods {
		fakeClient.CoreV1().Pods(pods[i].Namespace).Create( //nolint:errcheck
			context.Background(),
			&pods[i],
			metav1.CreateOptions{},
		)
	}
	return &Scanner{
		client:            fakeClient,
		excludeNamespaces: map[string]struct{}{},
	}
}

// newScannerWithExclusions creates a Scanner with excluded namespaces.
func newScannerWithExclusions(pods []corev1.Pod, excluded []string) *Scanner {
	s := newScannerWithFakeClient(pods)
	excl := make(map[string]struct{}, len(excluded))
	for _, ns := range excluded {
		excl[ns] = struct{}{}
	}
	s.excludeNamespaces = excl
	return s
}

// runningPod builds a minimal Pod object in Running phase with all containers Running.
func runningPod(name, namespace, image string, annotations map[string]string) corev1.Pod {
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   namespace,
			Annotations: annotations,
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{Name: "app", Image: image},
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{
				{
					Name:  "app",
					State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}},
				},
			},
		},
	}
}

// ---------------------------------------------------------------------------
// splitImageTag (pure function)
// ---------------------------------------------------------------------------

func TestK8sSplitImageTag_WithTag(t *testing.T) {
	image, tag := splitImageTag("nginx:1.25")
	if image != "nginx" || tag != "1.25" {
		t.Errorf("got (%q, %q)", image, tag)
	}
}

func TestK8sSplitImageTag_NoTag(t *testing.T) {
	image, tag := splitImageTag("nginx")
	if image != "nginx" || tag != "latest" {
		t.Errorf("got (%q, %q)", image, tag)
	}
}

func TestK8sSplitImageTag_WithDigest(t *testing.T) {
	image, tag := splitImageTag("nginx:1.25@sha256:abc")
	if image != "nginx" || tag != "1.25" {
		t.Errorf("got (%q, %q)", image, tag)
	}
}

// ---------------------------------------------------------------------------
// Scan — annotation-based exclusion
// ---------------------------------------------------------------------------

func TestK8sScan_ExcludesByAnnotation(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-included", "default", "nginx:1.25", nil),
		runningPod("pod-excluded", "default", "redis:7", map[string]string{
			"tiaki.io/enable": "false",
		}),
	}
	s := newScannerWithFakeClient(pods)

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() unexpected error: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d: %+v", len(results), results)
	}
	if results[0].PodName != "pod-included" {
		t.Errorf("expected pod-included, got %q", results[0].PodName)
	}
}

func TestK8sScan_IncludesPodWithoutAnnotation(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-no-annotation", "default", "alpine:3.18", nil),
	}
	s := newScannerWithFakeClient(pods)

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func TestK8sScan_IncludesPodWithEnableTrue(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-explicit-enable", "default", "postgres:15", map[string]string{
			"tiaki.io/enable": "true",
		}),
	}
	s := newScannerWithFakeClient(pods)

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func TestK8sScan_AllAnnotationExcluded(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-a", "default", "nginx:1.25", map[string]string{"tiaki.io/enable": "false"}),
		runningPod("pod-b", "default", "redis:7", map[string]string{"tiaki.io/enable": "false"}),
	}
	s := newScannerWithFakeClient(pods)

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d: %+v", len(results), results)
	}
}

// ---------------------------------------------------------------------------
// Scan — namespace exclusion
// ---------------------------------------------------------------------------

func TestK8sScan_ExcludesNamespace(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-system", "kube-system", "coredns:1.11", nil),
		runningPod("pod-app", "default", "nginx:1.25", nil),
	}
	s := newScannerWithExclusions(pods, []string{"kube-system"})

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() unexpected error: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d: %+v", len(results), results)
	}
	if results[0].Namespace != "default" {
		t.Errorf("expected namespace %q, got %q", "default", results[0].Namespace)
	}
}

func TestK8sScan_ExcludesMultipleNamespaces(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-system", "kube-system", "coredns:1.11", nil),
		runningPod("pod-monitor", "monitoring", "prometheus:latest", nil),
		runningPod("pod-app", "default", "nginx:1.25", nil),
	}
	s := newScannerWithExclusions(pods, []string{"kube-system", "monitoring"})

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() unexpected error: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d: %+v", len(results), results)
	}
	if results[0].Namespace != "default" {
		t.Errorf("expected namespace %q, got %q", "default", results[0].Namespace)
	}
}

func TestK8sScan_NoExclusionsIncludesAll(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-a", "kube-system", "coredns:1.11", nil),
		runningPod("pod-b", "default", "nginx:1.25", nil),
	}
	s := newScannerWithExclusions(pods, nil)

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() unexpected error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
}

func TestK8sScan_AnnotationExclusionAndNamespaceExclusionCombined(t *testing.T) {
	pods := []corev1.Pod{
		// excluded by namespace
		runningPod("pod-system", "kube-system", "coredns:1.11", nil),
		// excluded by annotation
		runningPod("pod-disabled", "default", "redis:7", map[string]string{"tiaki.io/enable": "false"}),
		// should be included
		runningPod("pod-included", "default", "nginx:1.25", nil),
	}
	s := newScannerWithExclusions(pods, []string{"kube-system"})

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d: %+v", len(results), results)
	}
	if results[0].PodName != "pod-included" {
		t.Errorf("expected pod-included, got %q", results[0].PodName)
	}
}

func TestK8sScan_EmptyCluster(t *testing.T) {
	s := newScannerWithFakeClient(nil)
	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

// ---------------------------------------------------------------------------
// SetExcludeNamespaces
// ---------------------------------------------------------------------------

func TestSetExcludeNamespaces_AppliesExclusions(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-system", "kube-system", "coredns:1.11", nil),
		runningPod("pod-app", "default", "nginx:1.25", nil),
	}
	s := newScannerWithFakeClient(pods)
	s.SetExcludeNamespaces([]string{"kube-system"})

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result after SetExcludeNamespaces, got %d", len(results))
	}
	if results[0].Namespace != "default" {
		t.Errorf("expected default namespace, got %q", results[0].Namespace)
	}
}

func TestSetExcludeNamespaces_EmptySlice(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-a", "kube-system", "coredns:1.11", nil),
	}
	s := newScannerWithFakeClient(pods)
	s.SetExcludeNamespaces([]string{})

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result (no exclusions), got %d", len(results))
	}
}

func TestSetExcludeNamespaces_NilSlice(t *testing.T) {
	pods := []corev1.Pod{
		runningPod("pod-a", "kube-system", "coredns:1.11", nil),
	}
	s := newScannerWithFakeClient(pods)
	s.SetExcludeNamespaces(nil)

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result (nil exclusions), got %d", len(results))
	}
}
