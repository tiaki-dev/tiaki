package compose_test

import (
	"os"
	"strings"
	"testing"

	"github.com/itlabs-gmbh/tiaki/agent/internal/compose"
)

const sampleCompose = `services:
  nginx:
    image: nginx:1.24-alpine
    ports:
      - "80:80"
  redis:
    image: redis:7.0-alpine
`

func TestUpdateServiceImage(t *testing.T) {
	f, err := os.CreateTemp("", "compose-*.yml")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(f.Name())

	if _, err := f.WriteString(sampleCompose); err != nil {
		t.Fatal(err)
	}
	f.Close()

	if err := compose.UpdateServiceImage(f.Name(), "nginx", "nginx:1.29.6-alpine"); err != nil {
		t.Fatalf("UpdateServiceImage failed: %v", err)
	}

	updated, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatal(err)
	}

	content := string(updated)
	if !strings.Contains(content, "nginx:1.29.6-alpine") {
		t.Errorf("expected nginx:1.29.6-alpine in updated file, got:\n%s", content)
	}
	// redis should be unchanged
	if !strings.Contains(content, "redis:7.0-alpine") {
		t.Errorf("expected redis:7.0-alpine to remain unchanged, got:\n%s", content)
	}
}

func TestUpdateServiceImage_ServiceNotFound(t *testing.T) {
	f, err := os.CreateTemp("", "compose-*.yml")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(f.Name())

	f.WriteString(sampleCompose) //nolint:errcheck
	f.Close()

	err = compose.UpdateServiceImage(f.Name(), "nonexistent", "nginx:1.29.6-alpine")
	if err == nil {
		t.Fatal("expected error for unknown service, got nil")
	}
}

func TestUpdateServiceImage_NoImageField(t *testing.T) {
	buildOnlyCompose := `services:
  app:
    build: .
    ports:
      - "8080:8080"
`
	f, err := os.CreateTemp("", "compose-*.yml")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(f.Name())

	f.WriteString(buildOnlyCompose) //nolint:errcheck
	f.Close()

	err = compose.UpdateServiceImage(f.Name(), "app", "myapp:v2")
	if err == nil {
		t.Fatal("expected error for build-only service, got nil")
	}
}
