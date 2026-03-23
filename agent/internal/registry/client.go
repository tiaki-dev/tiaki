package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const maxRegistryResponseBytes = 4 << 20 // 4 MiB — tag lists can be large for popular images

// Client checks Docker registries for image updates.
type Client struct {
	http     *http.Client
	username string
	password string
}

// NewClient creates a registry client with optional credentials for private registries.
func NewClient(username, password string) *Client {
	return &Client{
		http:     &http.Client{Timeout: 30 * time.Second},
		username: username,
		password: password,
	}
}

// CheckForUpdate checks if a newer tag exists for the given image.
// Returns the latest tag, its remote digest, and whether an update is available.
// currentDigest is the digest of the currently running image (may be empty).
// For non-semver tags (e.g. "latest"), a digest comparison is used when currentDigest is provided.
func (c *Client) CheckForUpdate(ctx context.Context, image, currentTag, currentDigest string) (latestTag, latestDigest string, hasUpdate bool, err error) {
	// For non-semver tags, compare digests instead of tag strings
	if _, ok := isSemverTag(currentTag); !ok {
		remoteDigest, digestErr := c.GetRemoteDigest(ctx, image, currentTag)
		if digestErr != nil {
			return currentTag, "", false, fmt.Errorf("get digest for %s:%s: %w", image, currentTag, digestErr)
		}
		lt, ld, hu, e := checkForUpdateDigest(currentTag, currentDigest, remoteDigest, nil)
		return lt, ld, hu, e
	}

	tags, err := c.GetTagList(ctx, image)
	if err != nil {
		return "", "", false, fmt.Errorf("get tag list for %s: %w", image, err)
	}

	latest := FindLatestTag(currentTag, tags)
	if latest == "" || latest == currentTag {
		return currentTag, "", false, nil
	}

	remoteDigest, _ := c.GetRemoteDigest(ctx, image, latest)
	return latest, remoteDigest, HasUpdate(currentTag, latest), nil
}

// checkForUpdateDigest encapsulates the digest comparison logic for non-semver tags.
// It is a pure function with no I/O, making it easy to unit test.
// fetchErr is any error that occurred while fetching remoteDigest; if non-nil it is returned directly.
func checkForUpdateDigest(currentTag, currentDigest, remoteDigest string, fetchErr error) (latestTag, latestDigest string, hasUpdate bool, err error) {
	if fetchErr != nil {
		return currentTag, "", false, fetchErr
	}
	if currentDigest == "" || remoteDigest == "" {
		// Cannot compare without both digests — report no update
		return currentTag, remoteDigest, false, nil
	}
	return currentTag, remoteDigest, remoteDigest != currentDigest, nil
}

// GetRemoteDigest fetches the content digest of a specific image tag from the registry.
// Uses the Docker Registry HTTP API v2 manifest HEAD request to read the Docker-Content-Digest header.
func (c *Client) GetRemoteDigest(ctx context.Context, image, tag string) (string, error) {
	registryHost, repo := parseImageRef(image)
	return c.getRemoteDigestFromHost(ctx, registryHost, repo, tag)
}

// getRemoteDigestFromHost fetches the manifest digest from an explicit registry host and repo path.
// Extracted to allow unit testing with httptest servers.
func (c *Client) getRemoteDigestFromHost(ctx context.Context, registryHost, repo, tag string) (string, error) {
	token, err := c.getToken(ctx, registryHost, repo)
	if err != nil {
		return "", fmt.Errorf("auth for %s/%s: %w", registryHost, repo, err)
	}

	manifestURL := fmt.Sprintf("https://%s/v2/%s/manifests/%s", registryHost, repo, tag)
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, manifestURL, nil)
	if err != nil {
		return "", err
	}
	// Accept both v2 and OCI manifests so registries return a stable digest
	req.Header.Set("Accept", "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	} else if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("registry returned %d for manifest %s/%s:%s", resp.StatusCode, registryHost, repo, tag)
	}

	return resp.Header.Get("Docker-Content-Digest"), nil
}

// GetTagList returns all tags for an image from its registry.
func (c *Client) GetTagList(ctx context.Context, image string) ([]string, error) {
	registry, repo := parseImageRef(image)
	token, err := c.getToken(ctx, registry, repo)
	if err != nil {
		return nil, fmt.Errorf("auth for %s: %w", image, err)
	}

	apiURL := fmt.Sprintf("https://%s/v2/%s/tags/list", registry, repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	} else if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, maxRegistryResponseBytes))
		return nil, fmt.Errorf("registry returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Tags []string `json:"tags"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxRegistryResponseBytes)).Decode(&result); err != nil {
		return nil, err
	}
	return result.Tags, nil
}

// getToken exchanges credentials for a registry Bearer token (Docker Hub flow).
// For private registries without a token endpoint, returns empty string (use basic auth).
func (c *Client) getToken(ctx context.Context, registry, repo string) (string, error) {
	// Only Docker Hub uses the token exchange flow
	if !strings.Contains(registry, "registry-1.docker.io") &&
		!strings.Contains(registry, "index.docker.io") {
		return "", nil // use basic auth for private registries
	}

	tokenURL := fmt.Sprintf(
		"https://auth.docker.io/token?service=registry.docker.io&scope=repository:%s:pull",
		url.QueryEscape(repo),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, tokenURL, nil)
	if err != nil {
		return "", err
	}
	if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", nil // token endpoint unavailable — try unauthenticated
	}

	var result struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxRegistryResponseBytes)).Decode(&result); err != nil {
		return "", err
	}
	return result.Token, nil
}

// parseImageRef splits "nginx" or "registry.example.com/myapp" into (registry, repo).
// Official Docker Hub images (e.g. "nginx") are normalized to "library/nginx".
// The "docker.io" shorthand alias is normalized to the actual API endpoint "registry-1.docker.io".
func parseImageRef(image string) (registry, repo string) {
	parts := strings.SplitN(image, "/", 2)

	if len(parts) == 1 {
		// Official image: nginx → registry-1.docker.io + library/nginx
		return "registry-1.docker.io", "library/" + parts[0]
	}

	// Normalize docker.io shorthand to the actual registry API endpoint
	if parts[0] == "docker.io" {
		parts[0] = "registry-1.docker.io"
	}

	// Check if first part is a registry host (contains dot or colon)
	if strings.ContainsAny(parts[0], ".:") || parts[0] == "localhost" {
		return parts[0], parts[1]
	}

	// Docker Hub user image: user/repo
	return "registry-1.docker.io", image
}
