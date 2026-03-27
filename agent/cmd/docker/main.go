package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"fmt"

	"github.com/itlabs-gmbh/tiaki/agent/internal/compose"
	"github.com/itlabs-gmbh/tiaki/agent/internal/config"
	"github.com/itlabs-gmbh/tiaki/agent/internal/docker"
	"github.com/itlabs-gmbh/tiaki/agent/internal/executor"
	agentgit "github.com/itlabs-gmbh/tiaki/agent/internal/git"
	"github.com/itlabs-gmbh/tiaki/agent/internal/registry"
	"github.com/itlabs-gmbh/tiaki/agent/internal/reporter"
	"github.com/itlabs-gmbh/tiaki/agent/internal/trivy"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[agent] invalid config: %v", err)
	}

	log.Printf("[agent] starting VM agent, control plane: %s", cfg.ControlURL)

	reporterClient := reporter.NewClient(cfg.ControlURL, cfg.APIKey, reporter.TLSConfig{
		SkipVerify: cfg.TLSSkipVerify,
		CACertPath: cfg.CACertPath,
	})
	var registryClient *registry.Client
	if cfg.RegistryAuthFile != "" {
		registryClient, err = registry.NewClientFromAuthFile(cfg.RegistryAuthFile)
		if err != nil {
			log.Fatalf("[agent] failed to load registry auth file: %v", err)
		}
	} else {
		registryClient = registry.NewClient(cfg.RegistryUsername, cfg.RegistryPassword)
	}

	scanner, err := docker.NewScanner()
	if err != nil {
		log.Fatalf("[agent] failed to connect to Docker socket: %v", err)
	}
	defer scanner.Close()

	exec, err := executor.NewDockerExecutor()
	if err != nil {
		log.Fatalf("[agent] failed to create executor: %v", err)
	}
	defer exec.Close()

	// Graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		log.Println("[agent] shutting down...")
		cancel()
	}()

	// Run scan + command check immediately on startup
	runScan(ctx, cfg, scanner, registryClient, reporterClient)
	if runCommands(ctx, cfg, exec, reporterClient) {
		runScan(ctx, cfg, scanner, registryClient, reporterClient)
	}

	scanTicker := time.NewTicker(6 * time.Hour)
	cmdTicker := time.NewTicker(30 * time.Second)
	defer scanTicker.Stop()
	defer cmdTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-scanTicker.C:
			runScan(ctx, cfg, scanner, registryClient, reporterClient)
		case <-cmdTicker.C:
			if runCommands(ctx, cfg, exec, reporterClient) {
				runScan(ctx, cfg, scanner, registryClient, reporterClient)
			}
		}
	}
}

// digestCache maps "image:tag" → last known registry manifest digest.
// Used to detect real updates for non-semver tags (e.g. "latest") by comparing
// the previously-fetched registry digest against the current remote digest.
// The local Docker image ID (c.ImageID) is NOT a registry manifest digest and
// must not be used for this comparison.
var digestCache = map[string]string{}

func runScan(
	ctx context.Context,
	cfg *config.Config,
	scanner *docker.Scanner,
	reg *registry.Client,
	rep *reporter.Client,
) {
	log.Println("[agent] starting scan...")

	containers, err := scanner.Scan(ctx)
	if err != nil {
		log.Printf("[agent] scan failed: %v", err)
		return
	}
	log.Printf("[agent] found %d containers", len(containers))

	// Send heartbeat
	if err := rep.Heartbeat(ctx); err != nil {
		log.Printf("[agent] heartbeat failed: %v", err)
	}

	containerPayloads := make([]reporter.ContainerPayload, 0)
	updatePayloads := make([]reporter.UpdatePayload, 0)

	for _, c := range containers {
		cacheKey := c.Image + ":" + c.Tag
		// For non-semver tags (e.g. "latest"), use the last-known registry manifest
		// digest from our cache instead of the local Docker image ID, which is a
		// different value and would always differ from the registry manifest digest.
		knownDigest := digestCache[cacheKey]

		cp := reporter.ContainerPayload{
			ContainerID: c.ContainerID,
			Name:        c.Name,
			Image:       c.Image,
			Tag:         c.Tag,
			Digest:      knownDigest,
		}
		if c.ComposeFile != "" {
			cp.ComposeFile = &c.ComposeFile
		}
		if c.ComposeService != "" {
			cp.ComposeService = &c.ComposeService
		}
		containerPayloads = append(containerPayloads, cp)

		latestTag, latestDigest, hasUpdate, err := reg.CheckForUpdate(ctx, c.Image, c.Tag, knownDigest)
		if err != nil {
			log.Printf("[agent] registry check failed for %s:%s: %v", c.Image, c.Tag, err)
			continue
		}
		// Update the cache with the latest registry digest regardless of whether
		// an update is available. This ensures the next scan has a valid baseline.
		if latestDigest != "" {
			digestCache[cacheKey] = latestDigest
		}
		if hasUpdate {
			log.Printf("[agent] update available: %s %s → %s", c.Image, c.Tag, latestTag)
			up := reporter.UpdatePayload{
				ContainerID:  c.ContainerID,
				CurrentTag:   c.Tag,
				LatestTag:    latestTag,
				LatestDigest: latestDigest,
			}
			if cfg.TrivyEnabled {
				imageRef := c.Image + ":" + latestTag
				vulns, trivyErr := trivy.ScanImage(ctx, imageRef, cfg.TrivyMinSeverity)
				if trivyErr != nil {
					log.Printf("[agent] trivy scan failed for %s: %v (skipping)", imageRef, trivyErr)
				} else if len(vulns) > 0 {
					log.Printf("[agent] trivy: %d vuln(s) >= %s in %s", len(vulns), cfg.TrivyMinSeverity, imageRef)
					for _, v := range vulns {
						up.Vulnerabilities = append(up.Vulnerabilities, reporter.Vulnerability{
							ID:       v.ID,
							Severity: v.Severity,
							PkgName:  v.PkgName,
							Title:    v.Title,
						})
					}
				}
			}
			updatePayloads = append(updatePayloads, up)
		}
	}

	if err := rep.SubmitReport(ctx, reporter.SubmitReportRequest{
		Containers: containerPayloads,
		Updates:    updatePayloads,
	}); err != nil {
		log.Printf("[agent] submit report failed: %v", err)
		return
	}

	log.Printf("[agent] report submitted: %d containers, %d updates", len(containerPayloads), len(updatePayloads))
}

// runCommands polls for pending deploy/rollback commands and executes them.
// Returns true if at least one command completed (success or failure), triggering a re-scan.
func runCommands(ctx context.Context, cfg *config.Config, exec *executor.DockerExecutor, rep *reporter.Client) bool {
	resp, err := rep.PollCommands(ctx)
	if err != nil {
		log.Printf("[agent] poll commands failed: %v", err)
		return false
	}
	if len(resp.Commands) == 0 && len(resp.Rollbacks) == 0 {
		return false
	}

	acted := false

	log.Printf("[agent] %d deploy command(s), %d rollback(s) pending", len(resp.Commands), len(resp.Rollbacks))

	for _, cmd := range resp.Commands {
		newImage := cmd.Image + ":" + cmd.LatestTag
		log.Printf("[agent] deploying %s (update %s)...", newImage, cmd.UpdateResultID)

		var deployLog string

		if cmd.ComposeFile != "" && cmd.ComposeService != "" {
			if err := compose.ValidatePath(cmd.ComposeFile, cfg.ComposePaths); err != nil {
				log.Printf("[agent] compose path rejected: %v (skipping write-back)", err)
				deployLog += "compose write-back skipped: " + err.Error() + "\n"
			} else if err := compose.UpdateServiceImage(cmd.ComposeFile, cmd.ComposeService, newImage); err != nil {
				log.Printf("[agent] compose write-back failed for %s: %v (proceeding)", newImage, err)
				deployLog += "compose write-back skipped: " + err.Error() + "\n"
			} else {
				log.Printf("[agent] compose write-back: %s updated to %s", cmd.ComposeFile, newImage)
				deployLog += "compose write-back: updated " + cmd.ComposeFile + "\n"
				if cfg.GitEnabled {
					msg := fmt.Sprintf(cfg.GitCommitMsg, cmd.Image+":"+cmd.LatestTag, newImage)
					if gitErr := agentgit.CommitFileChange(cmd.ComposeFile, agentgit.CommitOptions{
						AuthorName:  cfg.GitAuthorName,
						AuthorEmail: cfg.GitAuthorEmail,
						Message:     msg,
					}); gitErr != nil {
						log.Printf("[agent] git commit failed: %v (non-fatal)", gitErr)
						deployLog += "git commit skipped: " + gitErr.Error() + "\n"
					} else {
						log.Printf("[agent] git commit: %s", msg)
						deployLog += "git commit: " + msg + "\n"
					}
				}
			}
		}

		dlog, deployErr := exec.Deploy(ctx, cmd.DockerContainerID, newImage)
		deployLog += dlog
		if deployErr != nil {
			log.Printf("[agent] deploy failed for %s: %v", newImage, deployErr)
			if markErr := rep.MarkFailed(ctx, cmd.UpdateResultID, deployLog+"\nError: "+deployErr.Error()); markErr != nil {
				log.Printf("[agent] markFailed failed: %v", markErr)
			}
			continue
		}

		log.Printf("[agent] deploy succeeded: %s", newImage)
		if markErr := rep.MarkDeployed(ctx, cmd.UpdateResultID, deployLog); markErr != nil {
			log.Printf("[agent] markDeployed failed: %v", markErr)
		}
		acted = true
	}

	for _, rb := range resp.Rollbacks {
		prevImage := rb.Image + ":" + rb.PreviousTag
		log.Printf("[agent] rolling back to %s (update %s)...", prevImage, rb.UpdateResultID)

		var rollbackLog string

		if rb.ComposeFile != "" && rb.ComposeService != "" {
			if err := compose.ValidatePath(rb.ComposeFile, cfg.ComposePaths); err != nil {
				log.Printf("[agent] rollback compose path rejected: %v (skipping write-back)", err)
				rollbackLog += "compose write-back skipped: " + err.Error() + "\n"
			} else if err := compose.UpdateServiceImage(rb.ComposeFile, rb.ComposeService, prevImage); err != nil {
				log.Printf("[agent] rollback compose write-back failed: %v (proceeding)", err)
				rollbackLog += "compose write-back skipped: " + err.Error() + "\n"
			} else {
				log.Printf("[agent] rollback compose write-back: %s reverted to %s", rb.ComposeFile, prevImage)
				rollbackLog += "compose write-back: reverted " + rb.ComposeFile + "\n"
				if cfg.GitEnabled {
					msg := fmt.Sprintf("chore: rollback %s to %s", rb.Image, prevImage)
					if gitErr := agentgit.CommitFileChange(rb.ComposeFile, agentgit.CommitOptions{
						AuthorName:  cfg.GitAuthorName,
						AuthorEmail: cfg.GitAuthorEmail,
						Message:     msg,
					}); gitErr != nil {
						log.Printf("[agent] git rollback commit failed: %v (non-fatal)", gitErr)
						rollbackLog += "git commit skipped: " + gitErr.Error() + "\n"
					} else {
						log.Printf("[agent] git rollback commit: %s", msg)
						rollbackLog += "git commit: " + msg + "\n"
					}
				}
			}
		}

		dlog, rollbackErr := exec.Deploy(ctx, rb.DockerContainerID, prevImage)
		rollbackLog += dlog
		if rollbackErr != nil {
			log.Printf("[agent] rollback failed for %s: %v", prevImage, rollbackErr)
			if markErr := rep.MarkRollbackFailed(ctx, rb.UpdateResultID, rollbackLog+"\nError: "+rollbackErr.Error()); markErr != nil {
				log.Printf("[agent] markRollbackFailed failed: %v", markErr)
			}
			continue
		}

		log.Printf("[agent] rollback succeeded: %s", prevImage)
		if markErr := rep.MarkRolledBack(ctx, rb.UpdateResultID, rollbackLog); markErr != nil {
			log.Printf("[agent] markRolledBack failed: %v", markErr)
		}
		acted = true
	}

	return acted
}
