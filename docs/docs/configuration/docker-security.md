---
sidebar_position: 5
---

# Docker Security Best Practices

Tiaki supports multiple security enhancements to protect your Docker infrastructure when running the Docker agent.

## Docker Socket Proxy

By default, the Tiaki agent requires direct access to the Docker socket (`/var/run/docker.sock`). While mounted as read-only, this still grants significant privileges.

For enhanced security, use a **socket proxy** to limit the agent's Docker API access to only the required endpoints.

### Setup

1. Uncomment the `socket-proxy` service in `docker-compose.yml`:

```yaml
socket-proxy:
  image: tecnativa/docker-socket-proxy:latest
  restart: unless-stopped
  profiles:
    - agent
    - socket-proxy
  privileged: true
  environment:
    - CONTAINERS=1
    - IMAGES=1
    - INFO=1
    - NETWORKS=1
    - VOLUMES=1
    - POST=1  # Required for pulling images
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  networks:
    - tiaki-internal
```

2. Update the agent configuration:

```yaml
agent:
  volumes:
    # Comment out direct socket access
    # - /var/run/docker.sock:/var/run/docker.sock:ro
  environment:
    DOCKER_HOST: tcp://socket-proxy:2375
  depends_on:
    - socket-proxy
```

3. Start with both profiles:

```bash
docker compose --profile agent --profile socket-proxy up -d
```

### Benefits

- **Principle of least privilege**: Agent only gets access to required Docker API endpoints
- **Attack surface reduction**: Limits potential damage if agent is compromised
- **Audit trail**: Socket proxy can log all Docker API requests

### Limitations

The socket proxy itself runs with `privileged: true` and has full Docker socket access. Ensure it runs in a trusted environment.

## Docker Secrets for Registry Credentials

Instead of storing registry credentials in environment variables or `.env` files, use Docker secrets for enhanced security.

### ❌ Insecure Method (Environment Variables)

```yaml
agent:
  environment:
    REGISTRY_USERNAME: myuser
    REGISTRY_PASSWORD: mypassword  # Visible in docker inspect!
```

### ✅ Secure Method (Docker Secrets)

1. Create the secrets directory and auth file:

```bash
mkdir -p secrets
cp secrets/registry_auth.json.example secrets/registry_auth.json
```

2. Edit `secrets/registry_auth.json` with your credentials:

```json
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "dXNlcm5hbWU6cGFzc3dvcmQ="
    },
    "ghcr.io": {
      "username": "github-username",
      "password": "ghp_your_token"
    }
  }
}
```

:::tip Encoding credentials
For the `auth` field, use base64-encoded `username:password`:
```bash
echo -n "username:password" | base64
```
:::

3. Set file permissions:

```bash
chmod 600 secrets/registry_auth.json
```

4. Uncomment the secrets section in `docker-compose.yml`:

```yaml
secrets:
  registry_auth:
    file: ./secrets/registry_auth.json

agent:
  secrets:
    - registry_auth
  environment:
    REGISTRY_AUTH_FILE: /run/secrets/registry_auth
```

5. Restart the agent:

```bash
docker compose --profile agent up -d agent
```

### Benefits

- **Not visible in environment**: Credentials don't appear in `docker inspect` or process lists
- **File-based security**: Secrets are mounted as read-only files in `/run/secrets/`
- **Better for production**: Industry standard for credential management
- **Git-safe**: Secrets directory is excluded from version control

### Multiple Registries

You can configure multiple registries in a single `registry_auth.json`:

```json
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "base64-encoded-dockerhub-creds"
    },
    "ghcr.io": {
      "username": "github-user",
      "password": "ghp_token"
    },
    "registry.example.com": {
      "username": "user",
      "password": "pass"
    }
  }
}
```

## Combined Setup (Maximum Security)

For production deployments, combine both features:

```yaml
services:
  socket-proxy:
    image: tecnativa/docker-socket-proxy:latest
    restart: unless-stopped
    profiles: [agent, socket-proxy]
    privileged: true
    environment:
      - CONTAINERS=1
      - IMAGES=1
      - INFO=1
      - NETWORKS=1
      - VOLUMES=1
      - POST=1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - tiaki-internal

  agent:
    image: tiakidev/tiaki-agent-docker:latest
    restart: unless-stopped
    profiles: [agent]
    environment:
      CONTROL_URL: http://server:3001
      AGENT_API_KEY: ${AGENT_API_KEY}
      DOCKER_HOST: tcp://socket-proxy:2375
      REGISTRY_AUTH_FILE: /run/secrets/registry_auth
      TRIVY_ENABLED: ${TRIVY_ENABLED:-true}
    secrets:
      - registry_auth
    networks:
      - tiaki-internal
    depends_on:
      - server
      - socket-proxy

secrets:
  registry_auth:
    file: ./secrets/registry_auth.json
```

Start with:
```bash
docker compose --profile agent --profile socket-proxy up -d
```

## Additional Security Recommendations

1. **Network isolation**: Use Docker networks to isolate services (already configured)
2. **Read-only mounts**: All socket mounts use `:ro` flag
3. **Minimal permissions**: Socket proxy limits API access to required endpoints
4. **Credential rotation**: Regularly rotate registry credentials and API keys
5. **Audit logging**: Enable and monitor logs for suspicious activity
6. **Updates**: Keep Tiaki and all images up to date
7. **Secrets management**: Never commit secrets to version control

## Kubernetes Alternative

For Kubernetes deployments, use native Kubernetes secrets instead:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: registry-credentials
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-auth-json>
```

See [Kubernetes Agent Configuration](agent-kubernetes) for details.
