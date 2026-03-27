package registry

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// registryStub creates a TLS test server that returns the given digest for any
// manifest HEAD request, and an empty tag list for any tag list GET.
func registryStub(t *testing.T, digest string, tags []string) *httptest.Server {
	t.Helper()
	return httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/tags/list"):
			w.Header().Set("Content-Type", "application/json")
			tagJSON := `"` + strings.Join(tags, `","`) + `"`
			_, _ = w.Write([]byte(`{"tags":[` + tagJSON + `]}`))
		case strings.Contains(r.URL.Path, "/manifests/"):
			if digest != "" {
				w.Header().Set("Docker-Content-Digest", digest)
			}
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

// clientForStub builds a registry Client that routes all requests to the stub
// server by overriding parseImageRef to return the stub host.
// Since we cannot override parseImageRef, we test GetRemoteDigest directly and
// unit-test CheckForUpdate logic via isSemverTag + HasUpdate separately.

func TestGetRemoteDigest_returnsDigest(t *testing.T) {
	const want = "sha256:cafebabe"
	srv := registryStub(t, want, nil)
	defer srv.Close()

	c := &Client{http: srv.Client()}
	host := strings.TrimPrefix(srv.URL, "https://")

	got, err := c.getRemoteDigestFromHost(context.Background(), host, "library/nginx", "latest")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != want {
		t.Errorf("digest = %q, want %q", got, want)
	}
}

func TestCheckForUpdateDigest_changed(t *testing.T) {
	const (
		currentDigest = "sha256:aaaa"
		remoteDigest  = "sha256:bbbb"
	)
	latestTag, latestDig, hasUpdate, err := checkForUpdateDigest("latest", currentDigest, remoteDigest, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !hasUpdate {
		t.Error("expected hasUpdate=true when digests differ")
	}
	if latestTag != "latest" {
		t.Errorf("latestTag = %q, want latest", latestTag)
	}
	if latestDig != remoteDigest {
		t.Errorf("latestDigest = %q, want %q", latestDig, remoteDigest)
	}
}

func TestCheckForUpdateDigest_unchanged(t *testing.T) {
	const digest = "sha256:aaaa"
	_, _, hasUpdate, err := checkForUpdateDigest("latest", digest, digest, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hasUpdate {
		t.Error("expected hasUpdate=false when digests are equal")
	}
}

func TestCheckForUpdateDigest_noCurrentDigest(t *testing.T) {
	_, _, hasUpdate, err := checkForUpdateDigest("latest", "", "sha256:bbbb", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hasUpdate {
		t.Error("expected hasUpdate=false when currentDigest is empty")
	}
}

func TestNewClientFromAuthFile_base64Auth(t *testing.T) {
	import64 := "dXNlcm5hbWU6cGFzc3dvcmQ=" // base64("username:password")
	content := `{"auths":{"https://index.docker.io/v1/":{"auth":"` + import64 + `"}}}`
	f := writeTempFile(t, content)

	c, err := NewClientFromAuthFile(f)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.username != "username" {
		t.Errorf("username = %q, want %q", c.username, "username")
	}
	if c.password != "password" {
		t.Errorf("password = %q, want %q", c.password, "password")
	}
}

func TestNewClientFromAuthFile_plainCredentials(t *testing.T) {
	content := `{"auths":{"ghcr.io":{"username":"ghuser","password":"ghtoken"}}}`
	f := writeTempFile(t, content)

	c, err := NewClientFromAuthFile(f)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.username != "ghuser" {
		t.Errorf("username = %q, want %q", c.username, "ghuser")
	}
	if c.password != "ghtoken" {
		t.Errorf("password = %q, want %q", c.password, "ghtoken")
	}
}

func TestNewClientFromAuthFile_emptyAuths(t *testing.T) {
	content := `{"auths":{}}`
	f := writeTempFile(t, content)

	c, err := NewClientFromAuthFile(f)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.username != "" || c.password != "" {
		t.Errorf("expected empty credentials for empty auths, got user=%q pass=%q", c.username, c.password)
	}
}

func TestNewClientFromAuthFile_missingFile(t *testing.T) {
	_, err := NewClientFromAuthFile("/nonexistent/path/registry_auth.json")
	if err == nil {
		t.Error("expected error for missing file, got nil")
	}
}

func TestNewClientFromAuthFile_malformedJSON(t *testing.T) {
	f := writeTempFile(t, `not valid json`)
	_, err := NewClientFromAuthFile(f)
	if err == nil {
		t.Error("expected error for malformed JSON, got nil")
	}
}

func TestNewClientFromAuthFile_invalidBase64Auth(t *testing.T) {
	content := `{"auths":{"registry.example.com":{"auth":"not-valid-base64!!!"}}}`
	f := writeTempFile(t, content)
	_, err := NewClientFromAuthFile(f)
	if err == nil {
		t.Error("expected error for invalid base64 auth field, got nil")
	}
}

func TestNewClientFromAuthFile_base64AuthMissingColon(t *testing.T) {
	import64 := "dXNlcm5hbWVvbmx5" // base64("usernameonly") — no colon
	content := `{"auths":{"registry.example.com":{"auth":"` + import64 + `"}}}`
	f := writeTempFile(t, content)
	_, err := NewClientFromAuthFile(f)
	if err == nil {
		t.Error("expected error for base64 auth without colon separator, got nil")
	}
}

func TestParseBearerChallenge(t *testing.T) {
	tests := []struct {
		header      string
		wantRealm   string
		wantService string
		wantScope   string
	}{
		{
			header:      `Bearer realm="https://auth.docker.n8n.io/token",service="registry.n8n.io",scope="repository:n8nio/n8n:pull"`,
			wantRealm:   "https://auth.docker.n8n.io/token",
			wantService: "registry.n8n.io",
			wantScope:   "repository:n8nio/n8n:pull",
		},
		{
			header:      `Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/nginx:pull"`,
			wantRealm:   "https://auth.docker.io/token",
			wantService: "registry.docker.io",
			wantScope:   "repository:library/nginx:pull",
		},
		{
			header:    "Basic realm=\"Registry\"",
			wantRealm: "",
		},
		{
			header:    "",
			wantRealm: "",
		},
	}
	for _, tt := range tests {
		realm, service, scope := parseBearerChallenge(tt.header)
		if realm != tt.wantRealm {
			t.Errorf("realm = %q, want %q (header: %q)", realm, tt.wantRealm, tt.header)
		}
		if tt.wantRealm != "" {
			if service != tt.wantService {
				t.Errorf("service = %q, want %q", service, tt.wantService)
			}
			if scope != tt.wantScope {
				t.Errorf("scope = %q, want %q", scope, tt.wantScope)
			}
		}
	}
}

// registryStubWithAuth creates a TLS test server that requires Bearer auth.
// On first request it returns 401 with a WWW-Authenticate challenge pointing to
// the stub's own /token endpoint. The token endpoint returns a fixed token.
// Subsequent requests with the correct Bearer token are served normally.
func registryStubWithAuth(t *testing.T, digest string) *httptest.Server {
	t.Helper()
	const fakeToken = "test-token-xyz"
	var srv *httptest.Server
	srv = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"token":"` + fakeToken + `"}`))
		case strings.Contains(r.URL.Path, "/manifests/"):
			if r.Header.Get("Authorization") != "Bearer "+fakeToken {
				w.Header().Set("Www-Authenticate", `Bearer realm="`+srv.URL+`/token",service="registry.example.com",scope="repository:n8nio/n8n:pull"`)
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Docker-Content-Digest", digest)
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	return srv
}

func TestGetRemoteDigest_challengeFlow(t *testing.T) {
	const want = "sha256:deadbeef"
	srv := registryStubWithAuth(t, want)
	defer srv.Close()

	c := &Client{http: srv.Client()}
	host := strings.TrimPrefix(srv.URL, "https://")

	got, err := c.getRemoteDigestFromHost(context.Background(), host, "n8nio/n8n", "latest")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != want {
		t.Errorf("digest = %q, want %q", got, want)
	}
}

// writeTempFile writes content to a temp file and returns its path.
func writeTempFile(t *testing.T, content string) string {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "auth*.json")
	if err != nil {
		t.Fatalf("create temp file: %v", err)
	}
	if _, err := f.WriteString(content); err != nil {
		t.Fatalf("write temp file: %v", err)
	}
	f.Close()
	return f.Name()
}
