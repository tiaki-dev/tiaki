package docker

import (
	"context"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	dockerclient "github.com/docker/docker/client"
)

const labelEnable = "tiaki.enable"

// dockerAPIClient is the minimal Docker API surface used by Scanner.
// Defined as an interface to enable testing with mocks.
type dockerAPIClient interface {
	ContainerList(ctx context.Context, options container.ListOptions) ([]types.Container, error)
	Close() error
}

// Scanner connects to the Docker socket and lists running containers.
type Scanner struct {
	client dockerAPIClient
	selfID string // our own container ID — excluded from results
}

// NewScanner creates a Scanner using the default Docker socket path.
func NewScanner() (*Scanner, error) {
	cli, err := dockerclient.NewClientWithOpts(
		dockerclient.FromEnv,
		dockerclient.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, err
	}
	return &Scanner{client: cli}, nil
}

// SetSelfID tells the scanner to exclude the agent's own container from results.
func (s *Scanner) SetSelfID(id string) {
	s.selfID = id
}

// Scan lists all running containers and returns their info.
// Containers with the label tiaki.enable=false are skipped.
func (s *Scanner) Scan(ctx context.Context) ([]ContainerInfo, error) {
	containers, err := s.client.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return nil, err
	}

	result := make([]ContainerInfo, 0, len(containers))
	for _, c := range containers {
		// Skip self
		if s.selfID != "" && strings.HasPrefix(c.ID, s.selfID) {
			continue
		}

		// Skip containers explicitly opted out via label
		if c.Labels[labelEnable] == "false" {
			continue
		}

		image, tag := splitImageTag(c.Image)
		name := containerName(c.Names)

		info := ContainerInfo{
			ContainerID:    c.ID,
			Name:           name,
			Image:          image,
			Tag:            tag,
			Digest:         c.ImageID, // ImageID is the digest in newer Docker versions
			ComposeFile:    c.Labels["com.docker.compose.project.config_files"],
			ComposeService: c.Labels["com.docker.compose.service"],
		}
		result = append(result, info)
	}
	return result, nil
}

// Close releases the Docker client connection.
func (s *Scanner) Close() error {
	return s.client.Close()
}

// splitImageTag splits "nginx:1.25" into ("nginx", "1.25").
// Handles images with registry prefix: "registry.example.com/myapp:latest".
// Falls back to tag "latest" if none specified.
func splitImageTag(imageRef string) (image, tag string) {
	// Remove digest suffix (sha256:...) if present
	if idx := strings.Index(imageRef, "@"); idx != -1 {
		imageRef = imageRef[:idx]
	}

	// Find the last colon that's a tag separator (not part of registry host:port)
	lastColon := strings.LastIndex(imageRef, ":")
	if lastColon == -1 {
		return imageRef, "latest"
	}

	possibleTag := imageRef[lastColon+1:]
	// If the part after last colon contains a slash, it's a port, not a tag
	if strings.Contains(possibleTag, "/") {
		return imageRef, "latest"
	}

	return imageRef[:lastColon], possibleTag
}

func containerName(names []string) string {
	if len(names) == 0 {
		return "unknown"
	}
	// Docker prefixes names with "/"
	return strings.TrimPrefix(names[0], "/")
}
