# Docker Secrets for Registry Authentication

This directory contains Docker secrets for secure registry authentication.

## Setup

1. Copy the example file:
   ```bash
   cp registry_auth.json.example registry_auth.json
   ```

2. Edit `registry_auth.json` with your credentials:
   - For `auth` field: use base64-encoded `username:password`
     ```bash
     echo -n "username:password" | base64
     ```
   - Or use plain `username` and `password` fields

3. Uncomment the secrets section in `docker-compose.yml`:
   ```yaml
   secrets:
     registry_auth:
       file: ./secrets/registry_auth.json
   ```

4. Uncomment the agent's secrets configuration:
   ```yaml
   agent:
     secrets:
       - registry_auth
     environment:
       REGISTRY_AUTH_FILE: /run/secrets/registry_auth
   ```

## Security Notes

- **Never commit** `registry_auth.json` to version control
- The `.gitignore` file excludes `secrets/*.json` by default
- Use read-only file permissions: `chmod 600 registry_auth.json`
- Rotate credentials regularly

## Format Examples

### Docker Hub
```json
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "dXNlcm5hbWU6cGFzc3dvcmQ="
    }
  }
}
```

### GitHub Container Registry
```json
{
  "auths": {
    "ghcr.io": {
      "username": "github-username",
      "password": "ghp_your_personal_access_token"
    }
  }
}
```

### Multiple Registries
```json
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "base64-encoded-creds"
    },
    "ghcr.io": {
      "username": "user",
      "password": "token"
    },
    "registry.example.com": {
      "username": "user",
      "password": "pass"
    }
  }
}
```
