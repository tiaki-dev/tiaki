---
sidebar_position: 1
---

# Control Plane Configuration

All control plane settings are configured via environment variables in your `.env` file.

## Required

| Variable | Description |
|---|---|
| `ADMIN_TOKEN` | Secret token for the admin UI. Generate with `openssl rand -hex 32`. |

## Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | *(set in docker-compose)* | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/tiaki` |

## Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the API server listens on |
| `JWT_SECRET` | — | JWT signing secret (32+ characters). Generate with `openssl rand -hex 32` |

## Scan Schedule

| Variable | Default | Description |
|---|---|---|
| `SCAN_INTERVAL` | `0 */6 * * *` | Cron expression controlling how often agents scan for updates. Default is every 6 hours. |

### Cron expression examples

| Expression | Frequency |
|---|---|
| `0 */6 * * *` | Every 6 hours (default) |
| `0 */1 * * *` | Every hour |
| `0 2 * * *` | Daily at 2:00 AM |
| `*/30 * * * *` | Every 30 minutes |

## Email Notifications

All SMTP variables are optional. If not set, email notifications are disabled.

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname (e.g. `smtp.sendgrid.net`) |
| `SMTP_PORT` | SMTP port (typically `587` for TLS, `465` for SSL) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address (e.g. `tiaki@your-domain.com`) |

See [Email Notifications](notifications) for full setup instructions.

## AI Features (optional)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Enables AI-powered release note summarization using Claude |
| `GITHUB_TOKEN` | Personal access token for higher GitHub API rate limits when fetching release notes |

## Example `.env` file

```env title=".env"
# Required
ADMIN_TOKEN=your-very-secret-token-here

# Database (set automatically in docker-compose)
DATABASE_URL=postgresql://tiaki:tiaki@db:5432/tiaki

# Server
PORT=3001
JWT_SECRET=another-secret-32-char-string

# Scan schedule (every 6 hours)
SCAN_INTERVAL=0 */6 * * *

# Email notifications (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=tiaki@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=tiaki@example.com

# AI features (optional)
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
```
