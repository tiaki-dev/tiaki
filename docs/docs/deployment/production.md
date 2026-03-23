---
sidebar_position: 1
---

# Production Setup

This guide covers hardening a Tiaki deployment for production use.

## Control plane

### Use a managed PostgreSQL instance

Replace the bundled PostgreSQL container with a managed database (AWS RDS, Supabase, Neon, etc.):

```env title=".env"
DATABASE_URL=postgresql://tiaki:strongpassword@your-db-host:5432/tiaki
```

Remove or comment out the `db` service from `docker-compose.yml` when using an external database.

### Strong secrets

Generate strong random values for all secrets:

```bash
openssl rand -hex 32   # ADMIN_TOKEN
openssl rand -hex 32   # JWT_SECRET
```

```env title=".env"
ADMIN_TOKEN=<generated>
JWT_SECRET=<generated>
```

### Reverse proxy with SSL

Run Tiaki behind a reverse proxy that handles TLS termination. Two popular options:

#### Caddy (automatic HTTPS)

```caddyfile title="Caddyfile"
tiaki.your-domain.com {
    reverse_proxy localhost:3001
}
```

```bash
caddy run --config Caddyfile
```

#### Nginx + Certbot

```nginx title="/etc/nginx/sites-available/tiaki"
server {
    listen 80;
    server_name tiaki.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name tiaki.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/tiaki.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tiaki.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
certbot --nginx -d tiaki.your-domain.com
```

### Docker Compose production example

```yaml title="docker-compose.yml (production)"
services:
  server:
    image: ghcr.io/tiaki-dev/tiaki-server:latest
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:3001:3001"   # bind to localhost only, reverse proxy handles external access
```

:::tip Bind to localhost
Use `127.0.0.1:3001:3001` instead of `3001:3001` so the port is not exposed publicly — your reverse proxy handles external traffic.
:::

## Agents

### Secure API key storage

Store agent API keys in a secrets manager or at minimum restrict file permissions:

```bash
chmod 600 /etc/tiaki/agent.env
chown root:root /etc/tiaki/agent.env
```

### Configure scan intervals

Align scan intervals with your deployment tolerance. A 6-hour interval is a safe default. For critical services, consider 1 hour.

### Enable audit trail

Enable Git integration on agents so every deployment is recorded in your infrastructure repository:

```env
GIT_COMMIT_ENABLED=true
```

## Firewall / network

| Direction | Source | Destination | Port | Purpose |
|---|---|---|---|---|
| Inbound | Internet | Control plane host | 443 | HTTPS (via reverse proxy) |
| Outbound | Agent host | Container registries | 443 | Image update checks |
| Outbound | Agent host | Control plane | 443 | Agent → control plane API |
| Outbound | Control plane | SMTP server | 587 | Email notifications |

## Backups

Back up the PostgreSQL database regularly:

```bash
pg_dump $DATABASE_URL > tiaki-backup-$(date +%Y%m%d).sql
```

For Docker-based PostgreSQL:

```bash
docker exec tiaki-db pg_dump -U tiaki tiaki > tiaki-backup-$(date +%Y%m%d).sql
```
