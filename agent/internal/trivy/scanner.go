// Package trivy wraps the trivy CLI to scan images for CVEs.
package trivy

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"regexp"
)

// imageRefPattern matches valid Docker image references:
// [registry/][namespace/]name[:tag][@digest]
// Rejects shell metacharacters and other unexpected input.
var imageRefPattern = regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9._\-/:@]*[a-zA-Z0-9])?$`)

// Vulnerability is a single CVE finding reported by trivy.
type Vulnerability struct {
	ID       string `json:"id"`
	Severity string `json:"severity"` // CRITICAL | HIGH | MEDIUM | LOW | UNKNOWN
	PkgName  string `json:"pkgName"`
	Title    string `json:"title"`
}

// trivyJSON mirrors the relevant parts of trivy's JSON output schema.
type trivyJSON struct {
	Results []struct {
		Vulnerabilities []struct {
			VulnerabilityID string `json:"VulnerabilityID"`
			PkgName         string `json:"PkgName"`
			Severity        string `json:"Severity"`
			Title           string `json:"Title"`
		} `json:"Vulnerabilities"`
	} `json:"Results"`
}

// severityRank maps severity labels to comparable integers.
var severityRank = map[string]int{
	"UNKNOWN":  0,
	"LOW":      1,
	"MEDIUM":   2,
	"HIGH":     3,
	"CRITICAL": 4,
}

// ScanImage runs trivy against the given image reference and returns all
// vulnerabilities at or above minSeverity (e.g. "HIGH").
// Returns nil, nil if trivy is not installed — scanning is optional.
func ScanImage(ctx context.Context, image, minSeverity string) ([]Vulnerability, error) {
	if !imageRefPattern.MatchString(image) {
		return nil, fmt.Errorf("invalid image reference: %q", image)
	}

	trivyPath, err := exec.LookPath("trivy")
	if err != nil {
		// trivy not installed — skip silently
		return nil, nil
	}

	minRank := severityRank[minSeverity]

	out, err := exec.CommandContext(
		ctx, trivyPath,
		"image", "--quiet", "--format", "json", "--no-progress",
		image,
	).Output()
	if err != nil {
		return nil, fmt.Errorf("trivy scan: %w", err)
	}

	var result trivyJSON
	if err := json.Unmarshal(out, &result); err != nil {
		return nil, fmt.Errorf("trivy parse: %w", err)
	}

	var vulns []Vulnerability
	for _, r := range result.Results {
		for _, v := range r.Vulnerabilities {
			if severityRank[v.Severity] >= minRank {
				vulns = append(vulns, Vulnerability{
					ID:       v.VulnerabilityID,
					Severity: v.Severity,
					PkgName:  v.PkgName,
					Title:    v.Title,
				})
			}
		}
	}
	return vulns, nil
}
