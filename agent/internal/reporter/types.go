package reporter

// ContainerPayload is sent in the report submission.
type ContainerPayload struct {
	ContainerID    string  `json:"containerId"`
	Name           string  `json:"name"`
	Image          string  `json:"image"`
	Tag            string  `json:"tag"`
	Digest         string  `json:"digest,omitempty"`
	ComposeFile    *string `json:"composeFile,omitempty"`
	ComposeService *string `json:"composeService,omitempty"`
	Namespace      *string `json:"namespace,omitempty"`
}

// Vulnerability is a CVE finding from a Trivy scan.
type Vulnerability struct {
	ID       string `json:"id"`
	Severity string `json:"severity"` // CRITICAL | HIGH | MEDIUM | LOW | UNKNOWN
	PkgName  string `json:"pkgName"`
	Title    string `json:"title"`
}

// UpdatePayload represents a detected update in the report.
type UpdatePayload struct {
	ContainerID     string          `json:"containerId"`
	CurrentTag      string          `json:"currentTag"`
	LatestTag       string          `json:"latestTag"`
	LatestDigest    string          `json:"latestDigest,omitempty"`
	Vulnerabilities []Vulnerability `json:"vulnerabilities,omitempty"`
}

// RegisterRequest is sent when registering the agent.
type RegisterRequest struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
}

// RegisterResponse is received after successful registration.
type RegisterResponse struct {
	AgentID string `json:"agentId"`
	APIKey  string `json:"apiKey"`
}

// SubmitReportRequest is the full payload sent to /reports/submit.
type SubmitReportRequest struct {
	Containers []ContainerPayload `json:"containers"`
	Updates    []UpdatePayload    `json:"updates"`
}

// CommandsResponse contains pending deploy and rollback commands.
type CommandsResponse struct {
	Commands  []DeployCommand   `json:"commands"`
	Rollbacks []RollbackCommand `json:"rollbacks"`
}

// DeployCommand is a pending deploy instruction from the control plane.
type DeployCommand struct {
	UpdateResultID    string `json:"updateResultId"`
	DockerContainerID string `json:"dockerContainerId"`
	Image             string `json:"image"`
	LatestTag         string `json:"latestTag"`
	ComposeFile       string `json:"composeFile"`
	ComposeService    string `json:"composeService"`
}

// RollbackCommand is a pending rollback instruction from the control plane.
type RollbackCommand struct {
	UpdateResultID    string `json:"updateResultId"`
	DockerContainerID string `json:"dockerContainerId"`
	Image             string `json:"image"`
	PreviousTag       string `json:"previousTag"`
	ComposeFile       string `json:"composeFile"`
	ComposeService    string `json:"composeService"`
}
