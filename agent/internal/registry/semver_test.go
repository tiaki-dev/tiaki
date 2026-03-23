package registry

import (
	"testing"
)

func TestSplitPreRelease(t *testing.T) {
	tests := []struct {
		pre    string
		family string
		num    int
	}{
		{"", "", 0},
		{"-alpine", "-alpine", 0},
		{"-k3s1", "-k3s", 1},
		{"-k3s2", "-k3s", 2},
		{"-k3s10", "-k3s", 10},
		{"-rc2", "-rc", 2},
		{"-slim", "-slim", 0},
	}
	for _, tc := range tests {
		fam, num := splitPreRelease(tc.pre)
		if fam != tc.family || num != tc.num {
			t.Errorf("splitPreRelease(%q) = (%q, %d), want (%q, %d)",
				tc.pre, fam, num, tc.family, tc.num)
		}
	}
}

func TestFindLatestTag_k3s(t *testing.T) {
	tags := []string{
		"v1.33.4-k3s1",
		"v1.33.4-k3s2", // newer k3s patch for same k8s version
		"v1.33.5-k3s1", // newer k8s patch
		"v1.34.0-k3s1", // newer k8s minor
		"v1.33.4",       // stable (different family — should be excluded)
		"latest",
	}

	got := FindLatestTag("v1.33.4-k3s1", tags)
	if got != "v1.34.0-k3s1" {
		t.Errorf("FindLatestTag(v1.33.4-k3s1) = %q, want v1.34.0-k3s1", got)
	}
}

func TestFindLatestTag_k3s_intra_patch(t *testing.T) {
	// -k3s2 is newer than -k3s1 for same k8s version
	tags := []string{"v1.33.4-k3s1", "v1.33.4-k3s2", "v1.33.4-k3s3"}
	got := FindLatestTag("v1.33.4-k3s1", tags)
	if got != "v1.33.4-k3s3" {
		t.Errorf("FindLatestTag(v1.33.4-k3s1) = %q, want v1.33.4-k3s3", got)
	}
}

func TestFindLatestTag_alpine(t *testing.T) {
	// -alpine tags should stay within alpine family
	tags := []string{"7-alpine", "8-alpine", "8.6.1-alpine", "8", "latest"}
	got := FindLatestTag("7-alpine", tags)
	if got != "8.6.1-alpine" {
		t.Errorf("FindLatestTag(7-alpine) = %q, want 8.6.1-alpine", got)
	}
}

func TestFindLatestTag_stable(t *testing.T) {
	// stable tags don't cross into pre-release families
	tags := []string{"1.0.0", "1.1.0", "1.2.0-rc1", "2.0.0"}
	got := FindLatestTag("1.0.0", tags)
	if got != "2.0.0" {
		t.Errorf("FindLatestTag(1.0.0) = %q, want 2.0.0", got)
	}
}

func TestParseImageRef_dockerIO(t *testing.T) {
	registry, repo := parseImageRef("docker.io/rancher/k3s")
	if registry != "registry-1.docker.io" {
		t.Errorf("registry = %q, want registry-1.docker.io", registry)
	}
	if repo != "rancher/k3s" {
		t.Errorf("repo = %q, want rancher/k3s", repo)
	}
}

func TestParseImageRef_official(t *testing.T) {
	registry, repo := parseImageRef("nginx")
	if registry != "registry-1.docker.io" || repo != "library/nginx" {
		t.Errorf("got (%q, %q), want (registry-1.docker.io, library/nginx)", registry, repo)
	}
}

func TestParseImageRef_private(t *testing.T) {
	registry, repo := parseImageRef("ghcr.io/myorg/myapp")
	if registry != "ghcr.io" || repo != "myorg/myapp" {
		t.Errorf("got (%q, %q), want (ghcr.io, myorg/myapp)", registry, repo)
	}
}
