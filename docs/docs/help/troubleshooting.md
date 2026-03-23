---
sidebar_position: 1
---

# Troubleshooting

## Agent issues

### Agent shows as offline in the dashboard

**Symptoms**: Agent status is "Offline" or last-seen timestamp is stale.

**Check agent logs**:
```bash
docker compose --profile agent logs agent --tail=50
```

**Common causes**:
- `CONTROL_URL` is wrong or unreachable from the agent host
- `AGENT_API_KEY` is invalid or has been revoked
- Network firewall blocking outbound HTTPS to the control plane

**Verify connectivity from the agent host**:
```bash
curl -v https://your-tiaki-domain.com/health
```

---

### Agent fails to start: "failed to register with control plane"

The agent could not reach the control plane during initial registration.

1. Verify `CONTROL_URL` is set correctly and reachable
2. Check that the control plane is running: `docker compose ps`
3. Check control plane logs: `docker compose logs server --tail=50`
4. Ensure there is no firewall blocking the connection

---

### Agent shows containers but no updates are detected

**Possible causes**:

1. **Images are up to date** — no newer version exists in the registry
2. **Registry rate limiting** — Docker Hub has pull rate limits for unauthenticated requests. Set `REGISTRY_USERNAME` and `REGISTRY_PASSWORD`
3. **Private registry not authenticated** — see [Private Registries](../configuration/private-registries)
4. **Tag comparison** — if using `latest`, Tiaki compares digests. If the registry serves the same digest, no update is detected

**Force a rescan**:
In the dashboard, go to the agent and click **Trigger Scan**.

---

### Deployment fails: "failed to pull image"

Check agent logs for the specific pull error:

```bash
docker compose --profile agent logs agent | grep -i "pull\|error"
```

Common causes:
- Image tag no longer exists in the registry
- Registry authentication expired (especially ECR tokens, which expire after 12 hours)
- Disk space exhausted on the agent host: `df -h`

---

### Deployment fails: "compose file not found"

The agent cannot locate the `docker-compose.yml` file for the target service.

- Verify the compose file path is correctly mounted into the agent container
- Check that `composeFile` in the container report matches the actual file path on the host

---

## Control plane issues

### Dashboard shows "Internal Server Error"

Check server logs:
```bash
docker compose logs server --tail=100
```

Common causes:
- Database connection failure — check `DATABASE_URL` and that PostgreSQL is running
- Missing or invalid `JWT_SECRET` / `ADMIN_TOKEN`
- Database migrations haven't run: `docker compose exec server pnpm db:migrate`

---

### Can't log in: "Invalid token"

- Verify `ADMIN_TOKEN` in your `.env` matches exactly what you're typing
- There are no leading/trailing spaces
- Restart the server after changing `ADMIN_TOKEN`: `docker compose restart server`

---

### Emails not being sent

1. Verify all `SMTP_*` variables are set correctly
2. Check server logs for SMTP errors: `docker compose logs server | grep -i smtp`
3. Test SMTP connectivity from the server host:
   ```bash
   openssl s_client -connect smtp.example.com:587 -starttls smtp
   ```
4. For Gmail, ensure you're using an [App Password](https://support.google.com/accounts/answer/185833), not your regular password

---

## Database issues

### "relation does not exist" errors

Migrations haven't been applied. Run:
```bash
docker compose exec server pnpm db:migrate
```

Or for Docker Compose without exec:
```bash
docker compose run --rm server pnpm db:migrate
```

---

### Database connection refused

- Ensure PostgreSQL container is running: `docker compose ps`
- Check `DATABASE_URL` in your `.env`
- Wait a few seconds after `docker compose up` — the server may start before PostgreSQL is ready

---

## Getting more help

- Check [GitHub Issues](https://github.com/tiaki-dev/tiaki/issues) for known problems
- Open a [GitHub Discussion](https://github.com/tiaki-dev/tiaki/discussions) for questions
- Include relevant logs when reporting issues
