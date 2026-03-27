# Changelog

All notable changes to Tiaki will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-03-27

### Fixed

- **Registry check failures for `docker.n8n.io` and other OCI index registries**: The agent's manifest HEAD request was missing the `application/vnd.oci.image.index.v1+json` Accept media type. Registries that serve OCI image index manifests (multi-arch) exclusively — such as `docker.n8n.io` — returned 404 instead of the expected digest. The Accept header now includes this media type, making digest lookups work correctly for all OCI-compliant registries.
- **Report submission rejected with `updates: invalid_type, expected array, received null`**: When all registry checks failed (e.g. due to 404s), the `updates` field in the submitted report was JSON `null` instead of an empty array `[]`. The agent now always sends an empty array when no updates are found, satisfying the control plane's schema validation.
- **HEAD-to-GET fallback for registries that do not support HEAD on manifests**: Added a defensive fallback: if a registry returns 404 or 405 for a `HEAD /manifests/` request, the agent retries with `GET`. This improves compatibility with non-standard registry implementations.

## [0.5.0] - 2026-03-27

### Fixed

- **False-positive updates for `latest`-tagged containers**: The agent was comparing the local Docker image ID (`c.ImageID`) against the registry manifest digest (`Docker-Content-Digest`), which are fundamentally different values and always unequal. Non-semver tags (e.g. `latest`) now use an in-memory digest cache that tracks the last-known registry manifest digest across scan cycles. On the first scan the digest is learned and cached; subsequent scans compare the cached registry digest against the current remote digest, so updates are only reported when the registry actually publishes a new image.
- **Registry authentication for non-Docker Hub registries**: The previous implementation hard-coded a Docker Hub-specific token exchange URL (`auth.docker.io`), causing authentication failures for any other registry (e.g. `docker.n8n.io`, `ghcr.io`, `quay.io`). The agent now implements the standard OCI Distribution Spec [WWW-Authenticate challenge flow](https://distribution.github.io/distribution/spec/auth/token/): it probes the registry unauthenticated, parses the `WWW-Authenticate: Bearer realm=...,service=...,scope=...` header from the 401 response, and fetches a token from the realm indicated by the registry. This makes the agent compatible with any OCI-compliant registry.
- **Terminal update results not re-surfaced after new `latest` push**: After a `latest → latest` deployment was marked `deployed` (or `failed`/`ignored`/`rolled_back`), a subsequent push of a new image under the same tag would not create a new pending update. The `upsertUpdateResult` conflict handler now resets terminal-status rows back to `pending` and updates `foundAt` when the `latestDigest` changes, correctly re-surfacing newly pushed images.

### Changed

- `upsertUpdateResult` now also updates `currentTag` on conflict, keeping it in sync with the running container's tag across scans.

## [0.4.0] - 2026-03-27

### Changed

- Upgraded PostgreSQL from version 17 to 18
- API key prefix updated from `dw_` to `tiaki_`

### Fixed

- Express `trust proxy` enabled to correctly handle `X-Forwarded-For` headers when running behind a reverse proxy (e.g. Caddy)

## [0.3.0] - 2026-03-23

### Added

- Docker socket proxy support via `tecnativa/docker-socket-proxy` to limit agent's Docker API access to required endpoints only
- Docker secrets support for registry credentials (`REGISTRY_AUTH_FILE`) as a secure alternative to environment variables
- `NewClientFromAuthFile` in the registry client to parse Docker auth JSON files (supports both base64 `auth` field and plain `username`/`password` fields)
- `secrets/` directory with `registry_auth.json.example` and setup documentation
- `DOCKER_SECURITY.md` quick-reference guide for enabling socket proxy and Docker secrets
- Documentation page for Docker security best practices (`docs/docs/configuration/docker-security.md`)
- Network isolation: all services now run in a dedicated `tiaki-internal` Docker bridge network

### Security

- Registry credentials can now be stored as Docker secrets instead of environment variables (not visible in `docker inspect` or process listings)
- `REGISTRY_AUTH_FILE` environment variable takes precedence over `REGISTRY_USERNAME`/`REGISTRY_PASSWORD` when set
- Secrets files (`secrets/*.json`, `*.key`, `*.pem`) excluded from version control via `.gitignore`

## [0.2.0] - 2026-03-23

### Added

- Helm charts for tiaki-agent and tiaki-control
- Documentation site (Docusaurus) with guides for configuration, deployment, and development
- Docker Hub descriptions for all published images
- Helm chart release automation in CI/CD pipeline

### Changed

- Upgraded PostgreSQL from version 16 to 17
- Upgraded dependencies to latest versions

### Security

- Security hardening for Dockerfiles: non-root user and apk upgrade

## [0.1.0] - 2025-01-22

### Added

- Initial development version
- Core agent functionality
- Basic control plane features
- Docker Compose support
- Kubernetes support
- Initial public release
- Docker agent for VM/Docker Compose environments
- Kubernetes agent for K8s clusters
- TypeScript control plane with React frontend
- Automatic container update detection
- One-click deployments and rollbacks
- Trivy integration for vulnerability scanning
- Git integration for docker-compose.yml changes
- Email notifications for updates and deployments
- Audit logging for all operations
- tRPC API with type-safe client/server communication
- PostgreSQL database with Drizzle ORM
- E2E test suite with Playwright

---

## Release Notes Template

When preparing a release, use this template:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- New features

### Changed

- Changes to existing functionality

### Deprecated

- Soon-to-be removed features

### Removed

- Removed features

### Fixed

- Bug fixes

### Security

- Security improvements
```

---

[Unreleased]: https://github.com/itlabs-gmbh/tiaki/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/itlabs-gmbh/tiaki/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/itlabs-gmbh/tiaki/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/itlabs-gmbh/tiaki/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/itlabs-gmbh/tiaki/releases/tag/v0.1.0
