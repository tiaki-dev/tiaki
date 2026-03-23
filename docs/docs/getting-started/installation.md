---
sidebar_position: 1
---

# Installation

Get the Tiaki control plane running in minutes using Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- A machine with at least 512 MB RAM and 1 GB disk space

## Step 1 — Get the configuration files

**Option A: Clone the repository**

```bash
git clone https://github.com/tiaki-dev/tiaki.git
cd tiaki
```

**Option B: Download just the required files**

```bash
mkdir tiaki && cd tiaki
curl -O https://raw.githubusercontent.com/tiaki-dev/tiaki/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/tiaki-dev/tiaki/main/.env.example
```

## Step 2 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and set a secret admin token. Generate a secure random value:

```bash
openssl rand -hex 32
```

Paste the output as the value of `ADMIN_TOKEN`:

```env title=".env"
ADMIN_TOKEN=paste-your-generated-secret-here
```

:::warning Keep this secret
`ADMIN_TOKEN` is the password to your Tiaki dashboard. Never commit it to version control.
:::

## Step 3 — Start Tiaki

```bash
docker compose up -d
```

This starts two containers:

| Container | Description |
|---|---|
| `tiaki-db` | PostgreSQL database |
| `tiaki-server` | Web UI and API server |

After a few seconds, open **http://localhost:3001** in your browser. Log in using the `ADMIN_TOKEN` value from your `.env` file.

## Step 4 — Connect an agent

With the control plane running, you need to connect at least one agent to start monitoring containers. See the [Connect your first agent](first-agent) guide.

## Stopping Tiaki

```bash
# Stop all services (data is preserved)
docker compose --profile agent down

# Stop and delete all data including the database
docker compose --profile agent down -v
```

## Next steps

- [Connect your first agent →](first-agent)
- [Configure email notifications →](../configuration/notifications)
- [Production deployment →](../deployment/production)
