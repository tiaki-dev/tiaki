# tiakidev/tiaki-agent-docker

The Tiaki agent for Docker Compose / VM environments — monitors running containers and reports available updates to the Tiaki control plane.

## What is Tiaki?

[Tiaki](https://github.com/tiaki-dev/tiaki) monitors your running containers, detects available updates, and automates deployments with built-in rollback capabilities.

## Quick Start

The agent requires a running [tiaki-server](https://hub.docker.com/r/tiakidev/tiaki-server) instance.

**1.** In the Tiaki UI, go to **Agents** → create a new agent → copy the API key.

**2.** Add to your `.env`:

```env
AGENT_API_KEY=paste-your-api-key-here
```

**3.** Start the agent via Docker Compose:

```bash
docker compose --profile agent up -d agent
```

Or run it directly:

```bash
docker run -d \
  -e CONTROL_URL=http://your-tiaki-server:3001 \
  -e AGENT_API_KEY=your-api-key \
  -v /var/run/docker.sock:/var/run/docker.sock \
  tiakidev/tiaki-agent-docker:latest
```

## Environment Variables

| Variable                                  | Required | Description                                                                          |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `CONTROL_URL`                             | ✅       | URL of the Tiaki server                                                              |
| `AGENT_API_KEY`                           | ✅       | API key created in the Tiaki UI                                                      |
| `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | —        | Credentials for private container registries                                         |
| `TRIVY_ENABLED`                           | —        | Set to `true` to enable vulnerability scanning                                       |
| `TRIVY_MIN_SEVERITY`                      | —        | Minimum severity to report: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` (default: `HIGH`) |
| `GIT_COMMIT_ENABLED`                      | —        | Set to `true` to automatically commit `docker-compose.yml` changes to git            |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL`    | —        | Git commit author (defaults: `Tiaki` / `tiaki@localhost`)                            |

## Links

- [Website](https://tiaki.dev)
- [Documentation](https://docs.tiaki.dev)
- [GitHub Repository](https://github.com/tiaki-dev/tiaki)
- [Changelog](https://github.com/tiaki-dev/tiaki/blob/main/CHANGELOG.md)
- [Report an Issue](https://github.com/tiaki-dev/tiaki/issues)
