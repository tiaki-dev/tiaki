package registry

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const maxRegistryResponseBytes = 4 << 20 // 4 MiB — tag lists can be large for popular images

const dockerHubRegistry = "registry-1.docker.io"

const bearerPrefix = "Bearer "

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

// dockerAuthFile is the JSON structure of a Docker auth config file (e.g. ~/.docker/config.json).
type dockerAuthFile struct {
	Auths map[string]struct {
		Auth     string `json:"auth"`
		Username string `json:"username"`
		Password string `json:"password"`
	} `json:"auths"`
}

// NewClientFromAuthFile reads a Docker auth JSON file (as used by Docker secrets via
// REGISTRY_AUTH_FILE) and returns a Client configured with the first valid credential
// found. Returns an error if the file cannot be read or parsed.
// The file format is compatible with ~/.docker/config.json and Docker Hub auth files.
func NewClientFromAuthFile(path string) (*Client, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read auth file %s: %w", path, err)
	}

	var authFile dockerAuthFile
	if err := json.Unmarshal(data, &authFile); err != nil {
		return nil, fmt.Errorf("parse auth file %s: %w", path, err)
	}

	// Use the first registry entry found.
	for _, entry := range authFile.Auths {
		// Prefer pre-encoded auth field.
		if entry.Auth != "" {
			decoded, err := base64.StdEncoding.DecodeString(entry.Auth)
			if err != nil {
				return nil, fmt.Errorf("decode auth field in %s: %w", path, err)
			}
			parts := strings.SplitN(string(decoded), ":", 2)
			if len(parts) != 2 {
				return nil, fmt.Errorf("auth field in %s is not in username:password format", path)
			}
			return NewClient(parts[0], parts[1]), nil
		}
		// Fall back to plain username/password fields.
		if entry.Username != "" {
			return NewClient(entry.Username, entry.Password), nil
		}
	}

	// No credentials found — return an unauthenticated client.
	return NewClient("", ""), nil
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
// Uses the standard OCI WWW-Authenticate challenge flow: probe unauthenticated first, then
// parse the 401 challenge to obtain a Bearer token and retry.
func (c *Client) getRemoteDigestFromHost(ctx context.Context, registryHost, repo, tag string) (string, error) {
	manifestURL := fmt.Sprintf("https://%s/v2/%s/manifests/%s", registryHost, repo, tag)
	const acceptHeader = "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json"

	newReq := func(token string) (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodHead, manifestURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Accept", acceptHeader)
		c.setAuth(req, token)
		return req, nil
	}

	resp, err := c.doWithChallengeRetry(ctx, newReq, registryHost+"/"+repo)
	if err != nil {
		return "", err
	}
	if resp.StatusCode == http.StatusOK {
		return resp.Header.Get("Docker-Content-Digest"), nil
	}
	// Some registries (e.g. docker.n8n.io) do not support HEAD for manifests.
	// Fall back to GET which is universally supported.
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusMethodNotAllowed {
		newGetReq := func(token string) (*http.Request, error) {
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
			if err != nil {
				return nil, err
			}
			req.Header.Set("Accept", acceptHeader)
			c.setAuth(req, token)
			return req, nil
		}
		resp2, err := c.doWithChallengeRetry(ctx, newGetReq, registryHost+"/"+repo)
		if err != nil {
			return "", err
		}
		if resp2.StatusCode != http.StatusOK {
			return "", fmt.Errorf("registry returned %d for manifest %s/%s:%s", resp2.StatusCode, registryHost, repo, tag)
		}
		return resp2.Header.Get("Docker-Content-Digest"), nil
	}
	return "", fmt.Errorf("registry returned %d for manifest %s/%s:%s", resp.StatusCode, registryHost, repo, tag)
}

// doWithChallengeRetry performs a request, and if the registry responds with 401,
// fetches a Bearer token via the WWW-Authenticate challenge and retries once.
// The caller-supplied newReq factory builds a request for a given token (empty = no token).
func (c *Client) doWithChallengeRetry(ctx context.Context, newReq func(token string) (*http.Request, error), resource string) (*http.Response, error) {
	req, err := newReq("")
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusUnauthorized {
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		return resp, nil
	}

	// 401 — attempt Bearer token challenge.
	wwwAuth := resp.Header.Get("Www-Authenticate")
	_, _ = io.Copy(io.Discard, resp.Body)
	resp.Body.Close()

	token, err := c.fetchChallengeToken(ctx, wwwAuth)
	if err != nil {
		return nil, fmt.Errorf("auth challenge for %s: %w", resource, err)
	}
	req2, err := newReq(token)
	if err != nil {
		return nil, err
	}
	resp2, err := c.http.Do(req2)
	if err != nil {
		return nil, err
	}
	_, _ = io.Copy(io.Discard, resp2.Body)
	resp2.Body.Close()
	return resp2, nil
}

// setAuth applies authorization to a request: Bearer token if provided, otherwise basic auth if credentials are set.
func (c *Client) setAuth(req *http.Request, token string) {
	switch {
	case token != "":
		req.Header.Set("Authorization", bearerPrefix+token)
	case c.username != "":
		req.SetBasicAuth(c.username, c.password)
	}
}

// GetTagList returns all tags for an image from its registry.
func (c *Client) GetTagList(ctx context.Context, image string) ([]string, error) {
	registry, repo := parseImageRef(image)

	apiURL := fmt.Sprintf("https://%s/v2/%s/tags/list", registry, repo)

	newReq := func(token string) (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
		if err != nil {
			return nil, err
		}
		c.setAuth(req, token)
		return req, nil
	}

	resp, err := c.doWithChallengeRetry(ctx, newReq, image)
	if err != nil {
		return nil, err
	}

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

// fetchChallengeToken parses a WWW-Authenticate Bearer challenge header and fetches
// a pull token from the realm endpoint indicated by the registry.
// This implements the standard OCI distribution spec token challenge flow and works
// for any compliant registry (Docker Hub, ghcr.io, docker.n8n.io, quay.io, etc.).
func (c *Client) fetchChallengeToken(ctx context.Context, wwwAuth string) (string, error) {
	realm, service, scope := parseBearerChallenge(wwwAuth)
	if realm == "" {
		return "", fmt.Errorf("no Bearer realm in WWW-Authenticate: %q", wwwAuth)
	}

	tokenURL := realm + "?service=" + url.QueryEscape(service) + "&scope=" + url.QueryEscape(scope)
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
		return "", fmt.Errorf("token endpoint returned %d", resp.StatusCode)
	}

	var result struct {
		Token       string `json:"token"`
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxRegistryResponseBytes)).Decode(&result); err != nil {
		return "", err
	}
	if result.Token != "" {
		return result.Token, nil
	}
	return result.AccessToken, nil
}

// parseBearerChallenge extracts realm, service, and scope from a
// WWW-Authenticate header value of the form:
//
//	Bearer realm="https://auth.example.com/token",service="registry.example.com",scope="repository:foo/bar:pull"
func parseBearerChallenge(header string) (realm, service, scope string) {
	if !strings.HasPrefix(header, bearerPrefix) {
		return "", "", ""
	}
	attrs := header[len(bearerPrefix):]
	for _, part := range strings.Split(attrs, ",") {
		part = strings.TrimSpace(part)
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.TrimSpace(kv[0])
		val := strings.Trim(strings.TrimSpace(kv[1]), `"`)
		switch key {
		case "realm":
			realm = val
		case "service":
			service = val
		case "scope":
			scope = val
		}
	}
	return realm, service, scope
}

// parseImageRef splits "nginx" or "registry.example.com/myapp" into (registry, repo).
// Official Docker Hub images (e.g. "nginx") are normalized to "library/nginx".
// The "docker.io" shorthand alias is normalized to the actual API endpoint "registry-1.docker.io".
func parseImageRef(image string) (registry, repo string) {
	parts := strings.SplitN(image, "/", 2)

	if len(parts) == 1 {
		// Official image: nginx → registry-1.docker.io + library/nginx
		return dockerHubRegistry, "library/" + parts[0]
	}

	// Normalize docker.io shorthand to the actual registry API endpoint
	if parts[0] == "docker.io" {
		parts[0] = dockerHubRegistry
	}

	// Check if first part is a registry host (contains dot or colon)
	if strings.ContainsAny(parts[0], ".:") || parts[0] == "localhost" {
		return parts[0], parts[1]
	}

	// Docker Hub user image: user/repo
	return dockerHubRegistry, image
}
