---
sidebar_position: 4
---

# Private Registries

By default, Tiaki agents can pull and check updates from public Docker Hub images. To monitor containers using images from private registries, you need to provide authentication credentials.

## Single registry credentials

Set these environment variables on the agent:

```env title=".env"
REGISTRY_USERNAME=your-username
REGISTRY_PASSWORD=your-password-or-token
```

This applies to all registry checks performed by the agent.

## Common registry examples

### Docker Hub (private repositories)

```env
REGISTRY_USERNAME=your-dockerhub-username
REGISTRY_PASSWORD=your-dockerhub-access-token
```

Generate an access token at [hub.docker.com → Account Settings → Security](https://hub.docker.com/settings/security). Use an access token instead of your password.

### GitHub Container Registry (ghcr.io)

```env
REGISTRY_USERNAME=your-github-username
REGISTRY_PASSWORD=ghp_your_github_personal_access_token
```

The GitHub token needs the `read:packages` scope.

### AWS Elastic Container Registry (ECR)

ECR uses short-lived tokens. Generate a token and pass it as the password:

```bash
aws ecr get-login-password --region us-east-1
```

```env
REGISTRY_USERNAME=AWS
REGISTRY_PASSWORD=<output-from-aws-ecr-get-login-password>
```

:::note ECR token expiry
ECR tokens expire after 12 hours. For long-running agents, use a credentials helper or rotate the token via a cron job.
:::

### Google Artifact Registry / GCR

```env
REGISTRY_USERNAME=_json_key
REGISTRY_PASSWORD=<contents-of-your-service-account-json>
```

Or use the access token approach:

```bash
gcloud auth print-access-token
```

```env
REGISTRY_USERNAME=oauth2accesstoken
REGISTRY_PASSWORD=<output-of-gcloud-auth-print-access-token>
```

### Self-hosted registry

```env
REGISTRY_USERNAME=your-username
REGISTRY_PASSWORD=your-password
```

The agent automatically detects the registry hostname from the image name (e.g. `registry.example.com/myapp:latest`).

## Security best practices

- **Use access tokens** instead of passwords wherever possible
- **Limit token scopes** — agents only need `read` access to registries
- **Store credentials in secrets** — use Docker secrets, Kubernetes secrets, or a secrets manager instead of plain `.env` files in production
- **Never commit credentials** to version control

:::tip Enhanced Security
For production deployments, use **Docker secrets** instead of environment variables. See [Docker Security Best Practices](docker-security) for a complete guide on using Docker secrets and socket proxy.
:::
