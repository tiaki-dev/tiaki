---
sidebar_position: 2
---

# Docker Agent Configuration

The Docker agent runs on any machine with access to a Docker socket and monitors Docker Compose workloads.

## Environment variables

### Required

| Variable | Description |
|---|---|
| `CONTROL_URL` | URL of the Tiaki control plane (e.g. `https://tiaki.your-domain.com`). Set automatically in `docker-compose.yml` for local setups. |
| `AGENT_API_KEY` | API key created in the Tiaki UI under **Agents → New Agent**. |

### Registry credentials

| Variable | Description |
|---|---|
| `REGISTRY_USERNAME` | Username for authenticating to a private container registry |
| `REGISTRY_PASSWORD` | Password or access token for the private registry |

For multiple registries, see [Private Registries](private-registries).

### Security scanning

| Variable | Default | Description |
|---|---|---|
| `TRIVY_ENABLED` | `false` | Set to `true` to enable Trivy vulnerability scanning |
| `TRIVY_MIN_SEVERITY` | `HIGH` | Minimum severity level to report: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` |

See [Security Scanning](security-scanning) for details.

### Git integration

| Variable | Default | Description |
|---|---|---|
| `GIT_COMMIT_ENABLED` | `false` | Set to `true` to automatically commit `docker-compose.yml` changes after deployments |
| `GIT_AUTHOR_NAME` | `Tiaki` | Git commit author name |
| `GIT_AUTHOR_EMAIL` | `tiaki@localhost` | Git commit author email |

See [Git Integration](git-integration) for setup requirements.

## Docker Compose setup

The agent is included as a profile in the provided `docker-compose.yml`:

```yaml title="docker-compose.yml (agent section)"
agent:
  image: ghcr.io/tiaki-dev/tiaki-agent-docker:latest
  profiles: [agent]
  environment:
    CONTROL_URL: http://server:3001
    AGENT_API_KEY: ${AGENT_API_KEY}
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /var/lib/docker/volumes:/var/lib/docker/volumes:ro
```

:::info Docker socket access
The agent requires read access to `/var/run/docker.sock` to inspect running containers and pull new images.
:::

### Start the agent

```bash
docker compose --profile agent up -d agent
```

### Stop the agent

```bash
docker compose --profile agent down
```

## Running the agent on a remote host

If the agent runs on a **different machine** than the control plane:

1. Copy the agent's environment variables to the remote machine
2. Set `CONTROL_URL` to the externally reachable URL of your control plane
3. Ensure the remote machine can reach the control plane over HTTPS

```env title=".env (remote host)"
CONTROL_URL=https://tiaki.your-domain.com
AGENT_API_KEY=your-api-key-here
```

## Running as a systemd service

For production deployments outside Docker, you can run the agent binary directly:

```bash
# Download the binary
curl -L https://github.com/tiaki-dev/tiaki/releases/latest/download/tiaki-agent-docker-linux-amd64 \
  -o /usr/local/bin/tiaki-agent
chmod +x /usr/local/bin/tiaki-agent
```

```ini title="/etc/systemd/system/tiaki-agent.service"
[Unit]
Description=Tiaki Docker Agent
After=docker.service
Requires=docker.service

[Service]
EnvironmentFile=/etc/tiaki/agent.env
ExecStart=/usr/local/bin/tiaki-agent
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now tiaki-agent
```
