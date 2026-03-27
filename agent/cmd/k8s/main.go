package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/itlabs-gmbh/tiaki/agent/internal/config"
	"github.com/itlabs-gmbh/tiaki/agent/internal/k8s"
	"github.com/itlabs-gmbh/tiaki/agent/internal/registry"
	"github.com/itlabs-gmbh/tiaki/agent/internal/reporter"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[agent] invalid config: %v", err)
	}

	log.Printf("[agent] starting K8s agent, control plane: %s", cfg.ControlURL)

	reporterClient := reporter.NewClient(cfg.ControlURL, cfg.APIKey, reporter.TLSConfig{
		SkipVerify: cfg.TLSSkipVerify,
		CACertPath: cfg.CACertPath,
	})
	registryClient := registry.NewClient(cfg.RegistryUsername, cfg.RegistryPassword)

	// Try in-cluster first, fall back to kubeconfig
	scanner, err := k8s.NewInClusterScanner()
	if err != nil {
		log.Printf("[agent] in-cluster config failed (%v), trying kubeconfig...", err)
		scanner, err = k8s.NewKubeconfigScanner(os.Getenv("KUBECONFIG"))
		if err != nil {
			log.Fatalf("[agent] failed to connect to Kubernetes API: %v", err)
		}
	}
	if len(cfg.ExcludeNamespaces) > 0 {
		scanner.SetExcludeNamespaces(cfg.ExcludeNamespaces)
		log.Printf("[agent] excluding namespaces: %v", cfg.ExcludeNamespaces)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		log.Println("[agent] shutting down...")
		cancel()
	}()

	// Run once on startup, then every 6 hours
	runScan(ctx, scanner, registryClient, reporterClient)

	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runScan(ctx, scanner, registryClient, reporterClient)
		}
	}
}

func runScan(
	ctx context.Context,
	scanner *k8s.Scanner,
	reg *registry.Client,
	rep *reporter.Client,
) {
	log.Println("[agent] scanning K8s pods...")

	containers, err := scanner.Scan(ctx)
	if err != nil {
		log.Printf("[agent] scan failed: %v", err)
		return
	}
	log.Printf("[agent] found %d running containers", len(containers))

	if err := rep.Heartbeat(ctx); err != nil {
		log.Printf("[agent] heartbeat failed: %v", err)
	}

	containerPayloads := make([]reporter.ContainerPayload, 0)
	updatePayloads := make([]reporter.UpdatePayload, 0)

	for _, c := range containers {
		ns := c.Namespace
		cp := reporter.ContainerPayload{
			ContainerID: c.ContainerID,
			Name:        c.Name,
			Image:       c.Image,
			Tag:         c.Tag,
			Namespace:   &ns,
		}
		containerPayloads = append(containerPayloads, cp)

		latestTag, latestDigest, hasUpdate, err := reg.CheckForUpdate(ctx, c.Image, c.Tag, c.Digest)
		if err != nil {
			log.Printf("[agent] registry check failed for %s:%s: %v", c.Image, c.Tag, err)
			continue
		}
		if hasUpdate {
			log.Printf("[agent] update available: %s %s → %s", c.Image, c.Tag, latestTag)
			updatePayloads = append(updatePayloads, reporter.UpdatePayload{
				ContainerID:  c.ContainerID,
				CurrentTag:   c.Tag,
				LatestTag:    latestTag,
				LatestDigest: latestDigest,
			})
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
