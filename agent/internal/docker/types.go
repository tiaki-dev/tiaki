package docker

// ContainerInfo holds information about a running container discovered via Docker socket.
type ContainerInfo struct {
	ContainerID  string
	Name         string
	Image        string // image name without tag
	Tag          string // current tag
	Digest       string // image digest (sha256:...), may be empty
	ComposeFile  string // from com.docker.compose.project.config_files label
	ComposeService string // from com.docker.compose.service label
}
