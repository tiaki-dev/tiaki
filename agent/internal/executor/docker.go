package executor

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	dockerclient "github.com/docker/docker/client"
)

// DockerExecutor deploys updates by pulling a new image and recreating the container.
type DockerExecutor struct {
	client *dockerclient.Client
}

// NewDockerExecutor creates an executor using the Docker socket.
func NewDockerExecutor() (*DockerExecutor, error) {
	cli, err := dockerclient.NewClientWithOpts(
		dockerclient.FromEnv,
		dockerclient.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, err
	}
	return &DockerExecutor{client: cli}, nil
}

// Close releases the Docker client.
func (e *DockerExecutor) Close() error {
	return e.client.Close()
}

// Deploy pulls newImage and recreates the container identified by dockerContainerID.
// Returns a human-readable deploy log and an error if the deploy failed.
func (e *DockerExecutor) Deploy(ctx context.Context, dockerContainerID, newImage string) (string, error) {
	var log strings.Builder

	// ── 1. Pull new image ────────────────────────────────────────────────────
	fmt.Fprintf(&log, "Pulling %s...\n", newImage)
	reader, err := e.client.ImagePull(ctx, newImage, image.PullOptions{})
	if err != nil {
		return log.String(), fmt.Errorf("image pull: %w", err)
	}
	io.Copy(&log, reader) //nolint:errcheck // drain to wait for completion
	reader.Close()
	fmt.Fprintf(&log, "Pull complete.\n")

	// ── 2. Inspect current container ─────────────────────────────────────────
	info, err := e.client.ContainerInspect(ctx, dockerContainerID)
	if err != nil {
		return log.String(), fmt.Errorf("container inspect: %w", err)
	}
	name := strings.TrimPrefix(info.Name, "/")
	fmt.Fprintf(&log, "Inspected container %s.\n", name)

	// ── 3. Update image in config ─────────────────────────────────────────────
	cfg := info.Config
	cfg.Image = newImage

	// ── 4. Stop old container ─────────────────────────────────────────────────
	fmt.Fprintf(&log, "Stopping container %s...\n", name)
	stopTimeout := 30
	if err := e.client.ContainerStop(ctx, dockerContainerID, container.StopOptions{Timeout: &stopTimeout}); err != nil {
		return log.String(), fmt.Errorf("stop: %w", err)
	}

	// ── 5. Remove old container ───────────────────────────────────────────────
	fmt.Fprintf(&log, "Removing old container...\n")
	if err := e.client.ContainerRemove(ctx, dockerContainerID, container.RemoveOptions{}); err != nil {
		return log.String(), fmt.Errorf("remove: %w", err)
	}

	// ── 6. Recreate container ─────────────────────────────────────────────────
	fmt.Fprintf(&log, "Creating new container...\n")
	resp, err := e.client.ContainerCreate(
		ctx,
		cfg,
		info.HostConfig,
		&network.NetworkingConfig{EndpointsConfig: info.NetworkSettings.Networks},
		nil,
		name,
	)
	if err != nil {
		return log.String(), fmt.Errorf("create: %w", err)
	}

	// ── 7. Start new container ────────────────────────────────────────────────
	fmt.Fprintf(&log, "Starting new container %s...\n", resp.ID[:12])
	if err := e.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return log.String(), fmt.Errorf("start: %w", err)
	}

	// Brief wait to confirm container didn't immediately exit
	time.Sleep(2 * time.Second)
	inspect, err := e.client.ContainerInspect(ctx, resp.ID)
	if err == nil && !inspect.State.Running {
		return log.String(), fmt.Errorf("container exited immediately (exit code %d)", inspect.State.ExitCode)
	}

	fmt.Fprintf(&log, "Deploy complete: %s → %s\n", name, newImage)
	return log.String(), nil
}
