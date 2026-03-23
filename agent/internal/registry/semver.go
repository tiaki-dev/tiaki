package registry

import (
	"regexp"
	"strconv"
	"strings"
)

// semver represents a parsed semantic version.
type semver struct {
	Major  int
	Minor  int
	Patch  int
	Pre    string // full pre-release suffix (e.g. "-alpine", "-k3s1")
	PreFam string // alphabetic family portion (e.g. "-alpine", "-k3s")
	PreNum int    // trailing numeric portion (e.g. 0 for "-alpine", 1 for "-k3s1")
	Raw    string
}

var semverRe = regexp.MustCompile(`^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)$`)

// isSemverTag reports whether tag looks like a semantic version.
func isSemverTag(tag string) (semver, bool) {
	return parseSemver(tag)
}

func parseSemver(tag string) (semver, bool) {
	m := semverRe.FindStringSubmatch(tag)
	if m == nil {
		return semver{}, false
	}
	major, _ := strconv.Atoi(m[1])
	minor, _ := strconv.Atoi(m[2])
	patch, _ := strconv.Atoi(m[3])
	pre := m[4]
	fam, num := splitPreRelease(pre)
	return semver{
		Major: major, Minor: minor, Patch: patch,
		Pre: pre, PreFam: fam, PreNum: num,
		Raw: tag,
	}, true
}

// splitPreRelease splits a pre-release suffix into its alphabetic family and
// trailing numeric part. Examples:
//
//	"-k3s1"  → ("-k3s",  1)
//	"-k3s2"  → ("-k3s",  2)
//	"-alpine" → ("-alpine", 0)
//	"-rc2"   → ("-rc",   2)
//	""       → ("",      0)
func splitPreRelease(pre string) (family string, num int) {
	i := len(pre)
	for i > 0 && pre[i-1] >= '0' && pre[i-1] <= '9' {
		i--
	}
	num, _ = strconv.Atoi(pre[i:])
	return pre[:i], num
}

// isNewer returns true if candidate is a newer version than current.
// When major.minor.patch are equal, compares the pre-release numeric suffix.
// A stable release (no pre-release) is considered newer than a pre-release
// of the same version, UNLESS the pre-release family differs (e.g. "-k3s" vs "").
func isNewer(current, candidate semver) bool {
	if candidate.Major != current.Major {
		return candidate.Major > current.Major
	}
	if candidate.Minor != current.Minor {
		return candidate.Minor > current.Minor
	}
	if candidate.Patch != current.Patch {
		return candidate.Patch > current.Patch
	}
	// Same major.minor.patch: compare pre-release numeric suffix within the same family
	// (e.g. -k3s1 → -k3s2 is an upgrade; stable over pre-release is an upgrade)
	if current.Pre != "" && candidate.Pre == "" {
		return true // stable > pre-release
	}
	if current.Pre == "" && candidate.Pre != "" {
		return false // pre-release < stable
	}
	return candidate.PreNum > current.PreNum
}

// FindLatestTag returns the newest tag from the list that is compatible with current.
// Compatible means: same pre-release family (e.g. both "-alpine", both "-k3s*", or both stable).
// This correctly handles k3s-style versioning where -k3s1 and -k3s2 are the same family.
func FindLatestTag(currentTag string, allTags []string) string {
	current, ok := parseSemver(currentTag)
	if !ok {
		// Not semver — can only check for "latest"
		for _, t := range allTags {
			if t == "latest" {
				return t
			}
		}
		return ""
	}

	best := current
	bestTag := ""

	for _, tag := range allTags {
		candidate, ok := parseSemver(tag)
		if !ok {
			continue
		}
		// Must have same pre-release family to be compatible
		if candidate.PreFam != current.PreFam {
			continue
		}
		if isNewer(best, candidate) {
			best = candidate
			bestTag = tag
		}
	}

	return bestTag
}

// HasUpdate returns true if latestTag is newer than currentTag.
func HasUpdate(currentTag, latestTag string) bool {
	if currentTag == latestTag || latestTag == "" {
		return false
	}
	current, okC := parseSemver(currentTag)
	latest, okL := parseSemver(latestTag)
	if !okC || !okL {
		// Non-semver: different tags = potential update
		return currentTag != latestTag
	}
	return isNewer(current, latest)
}

// StripSuffix removes common OS suffixes for comparison (e.g. "-alpine", "-slim").
func StripSuffix(tag string) string {
	for _, s := range []string{"-alpine", "-slim", "-bullseye", "-bookworm", "-jammy"} {
		tag = strings.TrimSuffix(tag, s)
	}
	return tag
}
