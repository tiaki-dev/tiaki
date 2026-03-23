---
sidebar_position: 2
---

# FAQ

## General

### What is Tiaki?

Tiaki is a self-hosted tool for automating container image updates. It monitors your running Docker and Kubernetes containers, detects when newer image versions are available, and lets you deploy updates with one click — with rollback built in.

### Is Tiaki free and open source?

Yes. Tiaki is released under the [MIT License](https://github.com/tiaki-dev/tiaki/blob/main/LICENSE).

### Does Tiaki support Docker Swarm?

Not currently. Tiaki supports Docker Compose (VM) and Kubernetes. Docker Swarm support may be added in a future release.

---

## Installation & setup

### How much resources does Tiaki need?

The control plane (server + PostgreSQL) uses approximately:
- **RAM**: ~256 MB at rest
- **Disk**: ~500 MB (including the PostgreSQL data volume)
- **CPU**: minimal (spikes during scans)

Each agent uses ~30 MB RAM and negligible CPU between scan cycles.

### Can I run the control plane behind a subdomain?

Yes. Configure your reverse proxy to forward traffic from your subdomain (e.g. `tiaki.your-domain.com`) to `localhost:3001`. See [Production Setup](../deployment/production).

### Can multiple agents connect to one control plane?

Yes. Each agent registers independently and gets its own API key. You can monitor containers across many hosts and clusters from a single dashboard.

### Can I run multiple control planes?

Yes, but each operates independently with its own database and agents. There is no federation or multi-control-plane view.

---

## Agents

### Where should I run the agent?

The agent must run on the same host as (or have network access to) the Docker socket or Kubernetes API. For Docker Compose setups, running the agent on the same machine is the simplest approach.

### Does the agent need internet access?

Yes, for two reasons:
1. To check container registries for newer image versions
2. To communicate with the Tiaki control plane (if hosted remotely)

If your registries are internal, the agent only needs access to those and to the control plane.

### What happens if the agent is offline?

The control plane marks the agent as offline after missing heartbeats. Scheduled scans are not executed while offline. All historical data and deployments remain visible in the dashboard. The agent resumes normal operation when it comes back online.

### Can the agent auto-deploy updates without manual approval?

Auto-deployment is on the roadmap. Currently, all deployments require a manual click in the dashboard.

---

## Updates & deployments

### How does Tiaki detect updates for `latest` tags?

Tiaki compares image digests (SHA256). If the registry reports a different digest for the `latest` tag than what is currently running, an update is flagged.

### Does Tiaki update the `docker-compose.yml` file?

Yes, when Git integration is enabled (`GIT_COMMIT_ENABLED=true`), the agent updates the image tag in `docker-compose.yml` and commits the change. Without Git integration, the deployment still happens but the compose file is not modified.

### How long does a deployment take?

It depends on image size and network speed. The agent long-polls for commands with a 30-second timeout. Once a command is received, deployment begins immediately. A typical update (pull + restart) takes 10–60 seconds.

### What happens if a deployment fails?

The agent reports the failure to the control plane with an error message and log output. The previous container continues running. You can review the error in the Audit Log and attempt a re-deploy or rollback from the dashboard.

### Can I roll back to any previous version?

You can roll back to any version that still exists in the container registry. Tiaki shows the deployment history; selecting an older entry and clicking **Rollback** pulls that specific image and restarts the container.

---

## Security

### How are agent API keys stored?

API keys are hashed using [argon2](https://en.wikipedia.org/wiki/Argon2) before being stored in PostgreSQL. The plaintext key is shown only once at creation time and never stored.

### Does Tiaki have access to my container's environment variables or secrets?

No. The agent only reads container metadata (image name, tag, digest, compose file path) via the Docker API. It does not inspect environment variables, volumes, or container contents.

### Can I restrict what the agent can deploy?

Not with fine-grained policies currently. Any container reported by an agent can be deployed from the dashboard. Role-based access control is on the roadmap.
