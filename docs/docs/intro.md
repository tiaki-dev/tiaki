---
sidebar_position: 1
---

# Introduction

**Tiaki** is an automated container update management system for Docker and Kubernetes. It monitors your running containers, detects available updates, and automates deployments with built-in rollback capabilities.

## How it works

Tiaki uses a distributed architecture consisting of two components:

```
┌─────────────────────────────────────────────────────────┐
│                    Control Plane                        │
│  React Dashboard  ←→  tRPC API  ←→  PostgreSQL         │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (proto/api.yaml)
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│   Docker Agent   │          │  Kubernetes Agent │
│  (VM / Compose)  │          │   (K8s cluster)  │
└──────────────────┘          └──────────────────┘
```

- **Control Plane** — A web application (TypeScript/Node.js) with a React dashboard and a PostgreSQL database. You run it once, centrally.
- **Agents** — Lightweight Go binaries deployed on every host or cluster you want to manage. They scan containers, detect updates, execute deployments, and report back to the control plane.

## Key features

- **Automatic update detection** — Continuously polls container registries for new image versions using semver comparison (for tagged images) or digest comparison (for `latest` and similar tags)
- **Automated deployments** — Deploy updates with one click or enable fully automatic deployments
- **One-click rollbacks** — Instantly revert to any previous version
- **Security scanning** — Optional [Trivy](https://trivy.dev/) integration for vulnerability detection before deployment
- **Git integration** — Auto-commit `docker-compose.yml` changes to your repository
- **Audit logging** — Full history of all deployments, rollbacks, and agent activity
- **Email notifications** — Stay informed about available updates and deployment results
- **AI-powered release notes** — Optional Anthropic integration to summarize changelogs

## When to use Tiaki

Tiaki is a good fit if you:

- Run Docker Compose workloads on VMs and want automated, safe updates
- Manage Kubernetes clusters and want centralized update visibility
- Want a self-hosted alternative to commercial container management tools
- Need audit trails and rollback capabilities for production deployments

## Next steps

- **[Installation →](getting-started/installation)** — Get Tiaki running in minutes with Docker Compose
- **[Connect your first agent →](getting-started/first-agent)** — Start monitoring containers
- **[API Reference →](api)** — REST API used by agents to communicate with the control plane
