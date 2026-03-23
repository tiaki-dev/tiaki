---
sidebar_position: 3
---

# Upgrading Tiaki

## Check the current version

```bash
docker inspect ghcr.io/tiaki-dev/tiaki-server:latest --format '{{index .Config.Labels "org.opencontainers.image.version"}}'
```

Or check the running container:

```bash
docker compose ps
```

## Upgrade the control plane

```bash
# Pull the latest images
docker compose pull

# Restart with the new images
docker compose up -d

# Run any pending database migrations
docker compose exec server pnpm db:migrate
```

Check the [CHANGELOG](https://github.com/tiaki-dev/tiaki/blob/main/CHANGELOG.md) before upgrading to review any breaking changes or required migration steps.

## Upgrade the agents

### Docker Compose

```bash
docker compose --profile agent pull
docker compose --profile agent up -d agent
```

### Systemd binary

```bash
# Download the new binary
curl -L https://github.com/tiaki-dev/tiaki/releases/latest/download/tiaki-agent-docker-linux-amd64 \
  -o /tmp/tiaki-agent-new

chmod +x /tmp/tiaki-agent-new

# Replace the binary and restart
systemctl stop tiaki-agent
mv /tmp/tiaki-agent-new /usr/local/bin/tiaki-agent
systemctl start tiaki-agent
```

### Kubernetes agent

```bash
kubectl rollout restart deployment/tiaki-agent -n tiaki
```

This triggers a pull of the `latest` tag. To pin to a specific version, update the image tag in your manifest first.

## Rollback

If an upgrade causes issues, roll back to the previous image:

```bash
# Control plane
docker compose pull ghcr.io/tiaki-dev/tiaki-server:<previous-version>
docker compose up -d

# Agent
docker compose pull ghcr.io/tiaki-dev/tiaki-agent-docker:<previous-version>
docker compose --profile agent up -d agent
```

Check available versions at the [GitHub Releases page](https://github.com/tiaki-dev/tiaki/releases).

## Database migrations

Tiaki uses [Drizzle ORM](https://orm.drizzle.team/) for database migrations. Migrations run automatically on server startup. If a migration fails, the server will log the error and exit — check the logs:

```bash
docker compose logs server
```
