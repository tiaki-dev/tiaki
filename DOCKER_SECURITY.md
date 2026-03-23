# Docker Security Configuration Guide

Quick reference for enabling enhanced Docker security features in Tiaki.

## 🔒 Socket Proxy (Recommended for Production)

Limits Docker API access to only required endpoints.

> **⚠️ Note:** The socket proxy itself runs with `privileged: true` and retains full Docker socket access. It reduces the agent's attack surface but does not eliminate host-level trust requirements. Ensure it runs in a trusted environment.

### Enable Socket Proxy

1. Edit `docker-compose.yml` - the socket-proxy service is already configured
2. Update agent configuration:

```yaml
agent:
  volumes:
    # Comment out:
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

## 🔐 Docker Secrets (Recommended for Production)

Secure registry credential storage using Docker secrets.

### Setup

1. Create secrets file:

```bash
cp secrets/registry_auth.json.example secrets/registry_auth.json
chmod 600 secrets/registry_auth.json
```

2. Edit `secrets/registry_auth.json`:

```json
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "base64-encoded-username:password"
    }
  }
}
```

Generate base64 auth:

```bash
echo -n "username:password" | base64
```

3. Uncomment in `docker-compose.yml`:

```yaml
secrets:
  registry_auth:
    file: ./secrets/registry_auth.json

agent:
  secrets:
    - registry_auth
  environment:
    REGISTRY_AUTH_FILE: /run/secrets/registry_auth
    # Remove or comment out:
    # REGISTRY_USERNAME: ${REGISTRY_USERNAME:-}
    # REGISTRY_PASSWORD: ${REGISTRY_PASSWORD:-}
```

4. Restart:

```bash
docker compose --profile agent up -d agent
```

## 🛡️ Maximum Security Setup

Combine both features for production:

```bash
# 1. Setup secrets
cp secrets/registry_auth.json.example secrets/registry_auth.json
# Edit secrets/registry_auth.json with your credentials
chmod 600 secrets/registry_auth.json

# 2. Edit docker-compose.yml
# - Uncomment socket-proxy dependency in agent
# - Uncomment secrets section at bottom
# - Uncomment agent secrets configuration
# - Set DOCKER_HOST=tcp://socket-proxy:2375
# - Set REGISTRY_AUTH_FILE=/run/secrets/registry_auth
# - Remove direct socket mount from agent

# 3. Start with both profiles
docker compose --profile agent --profile socket-proxy up -d
```

## 📋 Security Checklist

- [ ] Socket proxy enabled to limit Docker API access
- [ ] Docker secrets used for registry credentials
- [ ] Secrets files have restricted permissions (600)
- [ ] No credentials in `.env` or environment variables
- [ ] Network isolation enabled (default)
- [ ] All mounts are read-only where possible
- [ ] `.gitignore` excludes `secrets/*.json`
- [ ] Regular credential rotation scheduled

## 📚 Documentation

- Full guide: `docs/docs/configuration/docker-security.md`
- Secrets setup: `secrets/README.md`
- Security policy: `SECURITY.md`
- Private registries: `docs/docs/configuration/private-registries.md`

## 🔄 Migration from Environment Variables

**Before (insecure):**

```yaml
agent:
  environment:
    REGISTRY_USERNAME: myuser
    REGISTRY_PASSWORD: mypassword # Visible in docker inspect!
```

**After (secure):**

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

## ⚠️ Important Notes

- Socket proxy itself runs privileged - ensure trusted environment
- Secrets are mounted read-only in `/run/secrets/`
- Never commit `secrets/*.json` to version control
- Rotate credentials regularly
- Monitor logs for suspicious activity
