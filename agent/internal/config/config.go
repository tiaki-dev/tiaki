package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

// Config holds all agent configuration loaded from environment variables.
type Config struct {
	ControlURL        string
	APIKey            string
	AgentName         string
	AgentType         string // "vm" or "k8s"
	ScanInterval      string // cron expression
	RegistryUsername  string
	RegistryPassword  string
	RegistryAuthFile  string   // REGISTRY_AUTH_FILE — path to Docker auth JSON (Docker secrets)
	ComposePaths      []string // colon-separated list of compose file directories
	ExcludeNamespaces []string // EXCLUDE_NAMESPACES — comma-separated namespaces to skip in K8s scanner
	// TLS options for the control plane connection
	TLSSkipVerify bool   // TLS_SKIP_VERIFY=true — disables cert verification (use only with self-signed certs in trusted networks)
	CACertPath    string // CA_CERT_PATH — path to a PEM-encoded CA certificate file for custom/internal CAs
	// Trivy scanning (optional)
	TrivyEnabled     bool   // TRIVY_ENABLED=true
	TrivyMinSeverity string // TRIVY_MIN_SEVERITY (default HIGH)
	// Git integration (optional)
	GitEnabled     bool   // GIT_COMMIT_ENABLED=true
	GitAuthorName  string // GIT_AUTHOR_NAME, defaults to "Tiaki"
	GitAuthorEmail string // GIT_AUTHOR_EMAIL, defaults to "tiaki@localhost"
	GitCommitMsg   string // GIT_COMMIT_MSG template, defaults to "chore: update %s to %s"
}

// Load reads configuration from environment variables.
// Returns an error if required variables are missing.
func Load() (*Config, error) {
	cfg := &Config{
		ControlURL:       getEnv("CONTROL_URL", ""),
		APIKey:           getEnv("AGENT_API_KEY", ""),
		AgentName:        getEnv("AGENT_NAME", ""),
		AgentType:        getEnv("AGENT_TYPE", "vm"),
		ScanInterval:     getEnv("SCAN_INTERVAL", "0 */6 * * *"),
		RegistryUsername: getEnv("REGISTRY_USERNAME", ""),
		RegistryPassword: getEnv("REGISTRY_PASSWORD", ""),
		RegistryAuthFile: getEnv("REGISTRY_AUTH_FILE", ""),
	}

	if paths := getEnv("COMPOSE_PATHS", ""); paths != "" {
		cfg.ComposePaths = strings.Split(paths, ":")
	}

	if ns := getEnv("EXCLUDE_NAMESPACES", ""); ns != "" {
		cfg.ExcludeNamespaces = strings.Split(ns, ",")
	}

	cfg.TLSSkipVerify = getEnv("TLS_SKIP_VERIFY", "") == "true"
	cfg.CACertPath = getEnv("CA_CERT_PATH", "")

	cfg.TrivyEnabled = getEnv("TRIVY_ENABLED", "") == "true"
	cfg.TrivyMinSeverity = getEnv("TRIVY_MIN_SEVERITY", "HIGH")

	cfg.GitEnabled = getEnv("GIT_COMMIT_ENABLED", "") == "true"
	cfg.GitAuthorName = getEnv("GIT_AUTHOR_NAME", "Tiaki")
	cfg.GitAuthorEmail = getEnv("GIT_AUTHOR_EMAIL", "tiaki@localhost")
	cfg.GitCommitMsg = getEnv("GIT_COMMIT_MSG", "chore: update %s to %s")

	return cfg, cfg.validate()
}

func (c *Config) validate() error {
	var errs []string
	if c.ControlURL == "" {
		errs = append(errs, "CONTROL_URL is required")
	}
	if c.APIKey == "" {
		errs = append(errs, "AGENT_API_KEY is required")
	}
	if c.AgentType != "vm" && c.AgentType != "k8s" {
		errs = append(errs, fmt.Sprintf("AGENT_TYPE must be 'vm' or 'k8s', got %q", c.AgentType))
	}
	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
