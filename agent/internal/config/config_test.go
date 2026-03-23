package config

import (
	"os"
	"testing"
)

// setenv sets env vars for the duration of a test and restores them on cleanup.
func setenv(t *testing.T, pairs map[string]string) {
	t.Helper()
	originals := make(map[string]string, len(pairs))
	for k, v := range pairs {
		originals[k], _ = os.LookupEnv(k)
		os.Setenv(k, v) //nolint:errcheck
	}
	t.Cleanup(func() {
		for k, orig := range originals {
			if orig == "" {
				os.Unsetenv(k) //nolint:errcheck
			} else {
				os.Setenv(k, orig) //nolint:errcheck
			}
		}
	})
}

// requiredEnv provides the minimum required env vars for Load() to succeed.
func requiredEnv() map[string]string {
	return map[string]string{
		"CONTROL_URL":    "http://localhost:8080",
		"AGENT_API_KEY":  "test-key",
		"AGENT_TYPE":     "vm",
	}
}

func TestLoad_ExcludeNamespaces_Empty(t *testing.T) {
	env := requiredEnv()
	// EXCLUDE_NAMESPACES not set — field should be nil/empty
	setenv(t, env)
	os.Unsetenv("EXCLUDE_NAMESPACES")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error: %v", err)
	}
	if len(cfg.ExcludeNamespaces) != 0 {
		t.Errorf("expected empty ExcludeNamespaces, got %v", cfg.ExcludeNamespaces)
	}
}

func TestLoad_ExcludeNamespaces_Single(t *testing.T) {
	env := requiredEnv()
	env["EXCLUDE_NAMESPACES"] = "kube-system"
	setenv(t, env)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error: %v", err)
	}
	if len(cfg.ExcludeNamespaces) != 1 || cfg.ExcludeNamespaces[0] != "kube-system" {
		t.Errorf("expected [kube-system], got %v", cfg.ExcludeNamespaces)
	}
}

func TestLoad_ExcludeNamespaces_Multiple(t *testing.T) {
	env := requiredEnv()
	env["EXCLUDE_NAMESPACES"] = "kube-system,monitoring,ingress-nginx"
	setenv(t, env)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error: %v", err)
	}
	want := []string{"kube-system", "monitoring", "ingress-nginx"}
	if len(cfg.ExcludeNamespaces) != len(want) {
		t.Fatalf("expected %d namespaces, got %d: %v", len(want), len(cfg.ExcludeNamespaces), cfg.ExcludeNamespaces)
	}
	for i, ns := range want {
		if cfg.ExcludeNamespaces[i] != ns {
			t.Errorf("ExcludeNamespaces[%d]: expected %q, got %q", i, ns, cfg.ExcludeNamespaces[i])
		}
	}
}

func TestLoad_ExcludeNamespaces_DoesNotMutateConfig(t *testing.T) {
	env := requiredEnv()
	env["EXCLUDE_NAMESPACES"] = "ns1,ns2"
	setenv(t, env)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error: %v", err)
	}

	original := make([]string, len(cfg.ExcludeNamespaces))
	copy(original, cfg.ExcludeNamespaces)

	// Mutate the returned slice — original config should be unaffected
	cfg.ExcludeNamespaces[0] = "mutated"

	cfg2, err := Load()
	if err != nil {
		t.Fatalf("Load() second call returned unexpected error: %v", err)
	}
	if cfg2.ExcludeNamespaces[0] != "ns1" {
		t.Errorf("second Load() config was unexpectedly affected by mutation of first config's slice")
	}
}

func TestLoad_MissingRequired(t *testing.T) {
	// Ensure required vars are absent
	for _, key := range []string{"CONTROL_URL", "AGENT_API_KEY", "AGENT_TYPE"} {
		os.Unsetenv(key)
	}
	t.Cleanup(func() {
		// nothing to restore — they were unset
	})

	_, err := Load()
	if err == nil {
		t.Error("expected error when required env vars are missing, got nil")
	}
}
