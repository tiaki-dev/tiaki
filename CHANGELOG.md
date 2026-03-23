# Changelog

All notable changes to Tiaki will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Security

- Bearer token authentication for agents
- JWT-based authentication for web users
- Argon2 password hashing
- API key rotation support

## [0.1.0] - 2025-01-XX

### Added

- Initial development version
- Core agent functionality
- Basic control plane features
- Docker Compose support
- Kubernetes support

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

[Unreleased]: https://github.com/itlabs-gmbh/tiaki/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/itlabs-gmbh/tiaki/releases/tag/v0.1.0
