package docker

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
)

// mockDockerClient implements the minimal interface needed by Scanner for testing.
type mockDockerClient struct {
	containers []types.Container
	err        error
}

func (m *mockDockerClient) ContainerList(_ context.Context, _ container.ListOptions) ([]types.Container, error) {
	return m.containers, m.err
}

func (m *mockDockerClient) Close() error { return nil }

// newScannerWithClient creates a Scanner backed by the given mock client.
// This constructor is only used in tests.
func newScannerWithClient(c dockerAPIClient) *Scanner {
	return &Scanner{client: c}
}

// ---------------------------------------------------------------------------
// splitImageTag (pure function — no client needed)
// ---------------------------------------------------------------------------

func TestSplitImageTag_WithTag(t *testing.T) {
	image, tag := splitImageTag("nginx:1.25")
	if image != "nginx" {
		t.Errorf("expected image %q, got %q", "nginx", image)
	}
	if tag != "1.25" {
		t.Errorf("expected tag %q, got %q", "1.25", tag)
	}
}

func TestSplitImageTag_NoTag(t *testing.T) {
	image, tag := splitImageTag("nginx")
	if image != "nginx" {
		t.Errorf("expected image %q, got %q", "nginx", image)
	}
	if tag != "latest" {
		t.Errorf("expected tag %q, got %q", "latest", tag)
	}
}

func TestSplitImageTag_WithRegistry(t *testing.T) {
	image, tag := splitImageTag("registry.example.com/myapp:v2")
	if image != "registry.example.com/myapp" {
		t.Errorf("expected image %q, got %q", "registry.example.com/myapp", image)
	}
	if tag != "v2" {
		t.Errorf("expected tag %q, got %q", "v2", tag)
	}
}

func TestSplitImageTag_RegistryWithPort(t *testing.T) {
	image, tag := splitImageTag("registry.example.com:5000/myapp")
	if image != "registry.example.com:5000/myapp" {
		t.Errorf("expected image %q, got %q", "registry.example.com:5000/myapp", image)
	}
	if tag != "latest" {
		t.Errorf("expected tag %q, got %q", "latest", tag)
	}
}

func TestSplitImageTag_WithDigest(t *testing.T) {
	image, tag := splitImageTag("nginx:1.25@sha256:abc123")
	if image != "nginx" {
		t.Errorf("expected image %q, got %q", "nginx", image)
	}
	if tag != "1.25" {
		t.Errorf("expected tag %q, got %q", "1.25", tag)
	}
}

// ---------------------------------------------------------------------------
// containerName (pure function)
// ---------------------------------------------------------------------------

func TestContainerName_Normal(t *testing.T) {
	got := containerName([]string{"/mycontainer"})
	if got != "mycontainer" {
		t.Errorf("expected %q, got %q", "mycontainer", got)
	}
}

func TestContainerName_Empty(t *testing.T) {
	got := containerName([]string{})
	if got != "unknown" {
		t.Errorf("expected %q, got %q", "unknown", got)
	}
}

// ---------------------------------------------------------------------------
// Scan — exclusion by tiaki.enable=false label
// ---------------------------------------------------------------------------

func TestScan_ExcludesLabeledContainers(t *testing.T) {
	mock := &mockDockerClient{
		containers: []types.Container{
			{
				ID:     "aaa111",
				Names:  []string{"/included"},
				Image:  "nginx:1.25",
				Labels: map[string]string{
					// no tiaki.enable label → should be included
				},
			},
			{
				ID:    "bbb222",
				Names: []string{"/excluded"},
				Image: "redis:7",
				Labels: map[string]string{
					"tiaki.enable": "false",
				},
			},
		},
	}

	s := newScannerWithClient(mock)
	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() returned unexpected error: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d: %+v", len(results), results)
	}
	if results[0].Name != "included" {
		t.Errorf("expected container %q, got %q", "included", results[0].Name)
	}
}

func TestScan_IncludesContainerWithoutLabel(t *testing.T) {
	mock := &mockDockerClient{
		containers: []types.Container{
			{
				ID:     "ccc333",
				Names:  []string{"/noLabel"},
				Image:  "alpine:3.18",
				Labels: map[string]string{},
			},
		},
	}

	s := newScannerWithClient(mock)
	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() returned unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func TestScan_IncludesContainerWithEnableTrue(t *testing.T) {
	mock := &mockDockerClient{
		containers: []types.Container{
			{
				ID:    "ddd444",
				Names: []string{"/explicit-enable"},
				Image: "postgres:15",
				Labels: map[string]string{
					"tiaki.enable": "true",
				},
			},
		},
	}

	s := newScannerWithClient(mock)
	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() returned unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func TestScan_AllExcluded(t *testing.T) {
	mock := &mockDockerClient{
		containers: []types.Container{
			{
				ID:     "eee555",
				Names:  []string{"/disabled1"},
				Image:  "nginx:1.25",
				Labels: map[string]string{"tiaki.enable": "false"},
			},
			{
				ID:     "fff666",
				Names:  []string{"/disabled2"},
				Image:  "redis:7",
				Labels: map[string]string{"tiaki.enable": "false"},
			},
		},
	}

	s := newScannerWithClient(mock)
	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan() returned unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d: %+v", len(results), results)
	}
}

func TestScan_EmptyList(t *testing.T) {
	mock := &mockDockerClient{containers: []types.Container{}}
	s := newScannerWithClient(mock)
	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestScan_SkipsSelf(t *testing.T) {
	mock := &mockDockerClient{
		containers: []types.Container{
			{ID: "selfid-longstring", Names: []string{"/self"}, Image: "agent:latest", Labels: map[string]string{}},
			{ID: "other111", Names: []string{"/other"}, Image: "nginx:1.25", Labels: map[string]string{}},
		},
	}
	s := newScannerWithClient(mock)
	s.SetSelfID("selfid")

	results, err := s.Scan(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result (self excluded), got %d", len(results))
	}
	if results[0].Name != "other" {
		t.Errorf("expected %q, got %q", "other", results[0].Name)
	}
}

func TestScan_ClientError(t *testing.T) {
	mock := &mockDockerClient{err: context.DeadlineExceeded}
	s := newScannerWithClient(mock)
	_, err := s.Scan(context.Background())
	if err == nil {
		t.Error("expected error from client, got nil")
	}
}
