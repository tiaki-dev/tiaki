// Package k8s provides a Kubernetes pod scanner for tiaki.
package k8s

import (
	"context"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

const annotationEnable = "tiaki.io/enable"

// ContainerInfo represents a running container in a K8s pod.
type ContainerInfo struct {
	// Unique identifier: <namespace>/<pod>/<container>
	ContainerID string
	Name        string
	Image       string
	Tag         string
	Digest      string // image digest from ContainerStatus.ImageID (sha256:...), may be empty
	Namespace   string
	PodName     string
}

// Scanner connects to a Kubernetes API server and lists running containers.
type Scanner struct {
	client            kubernetes.Interface
	excludeNamespaces map[string]struct{}
}

// NewInClusterScanner creates a scanner using in-cluster service account credentials.
func NewInClusterScanner() (*Scanner, error) {
	cfg, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}
	return newScannerFromConfig(cfg)
}

// NewKubeconfigScanner creates a scanner from a kubeconfig file path.
// Pass "" to use the default kubeconfig ($KUBECONFIG or ~/.kube/config).
func NewKubeconfigScanner(kubeconfigPath string) (*Scanner, error) {
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	if kubeconfigPath != "" {
		loadingRules.ExplicitPath = kubeconfigPath
	}
	cfg, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		loadingRules,
		&clientcmd.ConfigOverrides{},
	).ClientConfig()
	if err != nil {
		return nil, err
	}
	return newScannerFromConfig(cfg)
}

func newScannerFromConfig(cfg *rest.Config) (*Scanner, error) {
	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}
	return &Scanner{
		client:            client,
		excludeNamespaces: map[string]struct{}{},
	}, nil
}

// SetExcludeNamespaces configures the set of namespaces whose pods will be skipped.
func (s *Scanner) SetExcludeNamespaces(namespaces []string) {
	excl := make(map[string]struct{}, len(namespaces))
	for _, ns := range namespaces {
		excl[ns] = struct{}{}
	}
	s.excludeNamespaces = excl
}

// Scan lists all running pod containers across all namespaces.
// Returns one ContainerInfo per container (not per pod).
// Pods with annotation tiaki.io/enable=false are skipped.
// Pods in excluded namespaces (configured via SetExcludeNamespaces) are skipped.
func (s *Scanner) Scan(ctx context.Context) ([]ContainerInfo, error) {
	pods, err := s.client.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "status.phase=Running",
	})
	if err != nil {
		return nil, err
	}

	var result []ContainerInfo
	for _, pod := range pods.Items {
		// Skip pods in excluded namespaces
		if _, excluded := s.excludeNamespaces[pod.Namespace]; excluded {
			continue
		}

		// Skip pods opted out via annotation
		if pod.Annotations[annotationEnable] == "false" {
			continue
		}

		// Only report containers that are actually running (not init or waiting)
		running := runningContainerNames(pod)
		digests := containerDigests(pod)
		for _, c := range pod.Spec.Containers {
			if _, ok := running[c.Name]; !ok {
				continue
			}
			image, tag := splitImageTag(c.Image)
			result = append(result, ContainerInfo{
				ContainerID: pod.Namespace + "/" + pod.Name + "/" + c.Name,
				Name:        pod.Name + "/" + c.Name,
				Image:       image,
				Tag:         tag,
				Digest:      digests[c.Name],
				Namespace:   pod.Namespace,
				PodName:     pod.Name,
			})
		}
	}
	return result, nil
}

// runningContainerNames returns a set of container names that are in Running state.
func runningContainerNames(pod corev1.Pod) map[string]struct{} {
	names := make(map[string]struct{})
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Running != nil {
			names[cs.Name] = struct{}{}
		}
	}
	return names
}

// containerDigests returns a map of container name → image digest from ContainerStatus.ImageID.
func containerDigests(pod corev1.Pod) map[string]string {
	digests := make(map[string]string, len(pod.Status.ContainerStatuses))
	for _, cs := range pod.Status.ContainerStatuses {
		digests[cs.Name] = cs.ImageID
	}
	return digests
}

// splitImageTag splits "nginx:1.25" into ("nginx", "1.25").
func splitImageTag(imageRef string) (image, tag string) {
	// Remove digest suffix
	if idx := strings.Index(imageRef, "@"); idx != -1 {
		imageRef = imageRef[:idx]
	}
	lastColon := strings.LastIndex(imageRef, ":")
	if lastColon == -1 {
		return imageRef, "latest"
	}
	possibleTag := imageRef[lastColon+1:]
	if strings.Contains(possibleTag, "/") {
		return imageRef, "latest"
	}
	return imageRef[:lastColon], possibleTag
}
