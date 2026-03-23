// Package git provides git operations for the Tiaki agent.
// It uses the local git CLI (exec.Command) rather than a Go library
// to keep dependencies minimal and leverage the host's git config.
package git

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// CommitOptions configures a git commit after a compose write-back.
type CommitOptions struct {
	// AuthorName and AuthorEmail appear in the git commit author field.
	AuthorName  string
	AuthorEmail string
	// Message is the full commit message.
	Message string
}

// CommitFileChange stages the given file and creates a git commit in the
// repository that contains it. The working directory for git commands is
// set to the directory containing the file.
//
// Returns an error if git is not available, the file is not inside a repo,
// or any git operation fails.
func CommitFileChange(filePath string, opts CommitOptions) error {
	dir := filepath.Dir(filePath)
	absFile, err := filepath.Abs(filePath)
	if err != nil {
		return fmt.Errorf("resolving absolute path: %w", err)
	}

	// Ensure we're inside a git repo
	if _, err := runGit(dir, "rev-parse", "--git-dir"); err != nil {
		return fmt.Errorf("not a git repository (or git not installed): %w", err)
	}

	// Stage the file
	if _, err := runGit(dir, "add", absFile); err != nil {
		return fmt.Errorf("git add: %w", err)
	}

	// Check if there's anything staged
	out, err := runGit(dir, "diff", "--cached", "--name-only")
	if err != nil {
		return fmt.Errorf("git diff --cached: %w", err)
	}
	if strings.TrimSpace(out) == "" {
		// Nothing to commit (file unchanged after write-back)
		return nil
	}

	// Commit with author override
	authorStr := fmt.Sprintf("%s <%s>", opts.AuthorName, opts.AuthorEmail)
	if _, err := runGit(dir, "commit",
		"--author", authorStr,
		"-m", opts.Message,
	); err != nil {
		return fmt.Errorf("git commit: %w", err)
	}

	return nil
}

func runGit(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s: %w", strings.TrimSpace(string(out)), err)
	}
	return string(out), nil
}
