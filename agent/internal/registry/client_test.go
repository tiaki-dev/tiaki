package registry

import (
	"context"
	"net/http"
	"net/http/httptest"
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
