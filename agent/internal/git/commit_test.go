package git_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/itlabs-gmbh/tiaki/agent/internal/git"
)

// initRepo creates a temporary git repo with an initial commit and returns its path.
func initRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = dir
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("setup command %v failed: %v\n%s", args, err, out)
		}
	}

	run("git", "init")
	run("git", "config", "user.email", "test@test.com")
	run("git", "config", "user.name", "Test")

	// Create initial commit so HEAD exists
	readmePath := filepath.Join(dir, "README.md")
	if err := os.WriteFile(readmePath, []byte("init\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("git", "add", "README.md")
	run("git", "commit", "-m", "init")

	return dir
}

func lastCommitMsg(t *testing.T, dir string) string {
	t.Helper()
	cmd := exec.Command("git", "log", "-1", "--pretty=%s")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git log failed: %v", err)
	}
	return strings.TrimSpace(string(out))
}

func lastCommitAuthor(t *testing.T, dir string) string {
	t.Helper()
	cmd := exec.Command("git", "log", "-1", "--pretty=%an <%ae>")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git log failed: %v", err)
	}
	return strings.TrimSpace(string(out))
}

func TestCommitFileChange_HappyPath(t *testing.T) {
	dir := initRepo(t)

	composeFile := filepath.Join(dir, "docker-compose.yml")
	if err := os.WriteFile(composeFile, []byte("version: '3'\nservices:\n  nginx:\n    image: nginx:1.29.6-alpine\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	err := git.CommitFileChange(composeFile, git.CommitOptions{
		AuthorName:  "Tiaki",
		AuthorEmail: "tiaki@localhost",
		Message:     "chore: update nginx to 1.29.6-alpine",
	})
	if err != nil {
		t.Fatalf("CommitFileChange failed: %v", err)
	}

	msg := lastCommitMsg(t, dir)
	if msg != "chore: update nginx to 1.29.6-alpine" {
		t.Errorf("unexpected commit message: %q", msg)
	}

	author := lastCommitAuthor(t, dir)
	if author != "Tiaki <tiaki@localhost>" {
		t.Errorf("unexpected commit author: %q", author)
	}
}

func TestCommitFileChange_NothingToCommit(t *testing.T) {
	dir := initRepo(t)

	// Write a file and stage+commit it manually so it's clean
	composeFile := filepath.Join(dir, "docker-compose.yml")
	content := []byte("version: '3'\nservices:\n  nginx:\n    image: nginx:1.24-alpine\n")
	if err := os.WriteFile(composeFile, content, 0o644); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("git", "add", composeFile)
	cmd.Dir = dir
	cmd.Run()
	cmd = exec.Command("git", "commit", "-m", "add compose")
	cmd.Dir = dir
	cmd.Run()

	// Call CommitFileChange with the SAME content — nothing staged
	if err := os.WriteFile(composeFile, content, 0o644); err != nil {
		t.Fatal(err)
	}

	err := git.CommitFileChange(composeFile, git.CommitOptions{
		AuthorName:  "Tiaki",
		AuthorEmail: "tiaki@localhost",
		Message:     "chore: should not appear",
	})
	if err != nil {
		t.Fatalf("expected no error for nothing-to-commit, got: %v", err)
	}

	// Last commit should still be "add compose"
	msg := lastCommitMsg(t, dir)
	if msg != "add compose" {
		t.Errorf("unexpected commit: %q (should have been no-op)", msg)
	}
}

func TestCommitFileChange_NotAGitRepo(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "docker-compose.yml")
	if err := os.WriteFile(filePath, []byte("test"), 0o644); err != nil {
		t.Fatal(err)
	}

	err := git.CommitFileChange(filePath, git.CommitOptions{
		AuthorName:  "Tiaki",
		AuthorEmail: "tiaki@localhost",
		Message:     "should fail",
	})
	if err == nil {
		t.Fatal("expected error for non-git directory, got nil")
	}
}
