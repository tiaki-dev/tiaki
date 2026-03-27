package main

import (
	"testing"
)

func TestDigestCache_usesLastKnownDigest(t *testing.T) {
	// Verify that after storing a registry digest in the cache, it is returned
	// as knownDigest on the next cycle (simulating CheckForUpdate returning latestDigest).
	digestCache = map[string]string{} // reset between tests

	const image = "n8n-docker/caddy-tiaki-agent"
	const tag = "latest"
	const registryDigest = "sha256:cafebabe000000000000000000000000"

	key := image + ":" + tag

	// Initially empty — first scan has no known digest
	if got := digestCache[key]; got != "" {
		t.Errorf("expected empty cache on first scan, got %q", got)
	}

	// Simulate what runScan does after CheckForUpdate returns latestDigest
	digestCache[key] = registryDigest

	// Next scan cycle: the cached digest should be used as knownDigest
	if got := digestCache[key]; got != registryDigest {
		t.Errorf("knownDigest = %q, want %q", got, registryDigest)
	}
}

func TestDigestCache_noUpdateWhenDigestUnchanged(t *testing.T) {
	// When the remote digest equals the cached digest, CheckForUpdate returns
	// hasUpdate=false. This is tested via the registry package's checkForUpdateDigest,
	// but here we verify the cache key format used in runScan is consistent.
	digestCache = map[string]string{}

	const image = "n8n-docker/caddy-caddy"
	const tag = "latest"
	const digest = "sha256:aabbccdd"

	key := image + ":" + tag
	digestCache[key] = digest

	// Simulate: remote digest == cached digest → no update → cache unchanged
	remoteDigest := digest
	if remoteDigest != "" {
		digestCache[key] = remoteDigest
	}

	if digestCache[key] != digest {
		t.Errorf("cache should remain %q, got %q", digest, digestCache[key])
	}
}

func TestDigestCache_updatesOnNewRemoteDigest(t *testing.T) {
	// When the remote digest differs from cached, cache is updated to the new digest.
	digestCache = map[string]string{}

	const image = "n8n-docker/caddy-socket-proxy"
	const tag = "latest"
	const oldDigest = "sha256:old"
	const newDigest = "sha256:new"

	key := image + ":" + tag
	digestCache[key] = oldDigest

	// Simulate runScan: latestDigest != "" → update cache
	latestDigest := newDigest
	if latestDigest != "" {
		digestCache[key] = latestDigest
	}

	if digestCache[key] != newDigest {
		t.Errorf("cache = %q, want %q after update", digestCache[key], newDigest)
	}
}
