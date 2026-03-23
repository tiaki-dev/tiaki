# Tiaki Control Plane Helm Chart

This Helm chart deploys the Tiaki control plane for automated container update management, including the web UI, API server, and PostgreSQL database.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (for PostgreSQL persistence)

## Installation

### Add the Tiaki Helm repository

```bash
helm repo add tiaki https://charts.tiaki.dev
helm repo update
```

### Install the chart

```bash
# Generate a secure admin token
ADMIN_TOKEN=$(openssl rand -hex 32)

# Install with embedded PostgreSQL
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$ADMIN_TOKEN \
  --set postgresql.auth.password=$(openssl rand -hex 16)
```

After installation, the Tiaki UI will be available at the service endpoint. Get the service URL:

```bash
kubectl get svc tiaki-control
```

## Configuration

The following table lists the configurable parameters of the Tiaki Control chart and their default values.

### Application Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of control plane replicas | `1` |
| `image.repository` | Control plane image repository | `tiakidev/tiaki-server` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `image.tag` | Image tag (defaults to chart appVersion) | `""` |
| `config.adminToken` | Admin authentication token (required) | `""` |
| `config.nodeEnv` | Node environment | `production` |
| `config.port` | Server port | `3001` |
| `config.scanInterval` | Cron expression for scan frequency | `0 */6 * * *` |

### SMTP Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `config.smtp.host` | SMTP server host | `""` |
| `config.smtp.port` | SMTP server port | `587` |
| `config.smtp.secure` | Use TLS | `false` |
| `config.smtp.user` | SMTP username | `""` |
| `config.smtp.password` | SMTP password | `""` |
| `config.smtp.from` | From email address | `tiaki@example.com` |

### External Services

| Parameter | Description | Default |
|-----------|-------------|---------|
| `config.anthropic.apiKey` | Anthropic API key for AI features | `""` |
| `config.github.token` | GitHub token for release notes | `""` |

### PostgreSQL Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Deploy PostgreSQL as part of the chart | `true` |
| `postgresql.auth.username` | PostgreSQL username | `tiaki` |
| `postgresql.auth.password` | PostgreSQL password | `""` |
| `postgresql.auth.database` | PostgreSQL database name | `tiaki` |
| `postgresql.primary.persistence.enabled` | Enable persistence | `true` |
| `postgresql.primary.persistence.size` | Persistent volume size | `10Gi` |

### External Database Configuration

Use these parameters when `postgresql.enabled=false`:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `externalDatabase.host` | External PostgreSQL host | `""` |
| `externalDatabase.port` | External PostgreSQL port | `5432` |
| `externalDatabase.username` | External PostgreSQL username | `tiaki` |
| `externalDatabase.password` | External PostgreSQL password | `""` |
| `externalDatabase.database` | External PostgreSQL database | `tiaki` |
| `externalDatabase.sslMode` | PostgreSQL SSL mode | `prefer` |

### Service Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | Service port | `3001` |
| `service.annotations` | Service annotations | `{}` |

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.annotations` | Ingress annotations | `{}` |
| `ingress.hosts` | Ingress hosts configuration | See values.yaml |
| `ingress.tls` | Ingress TLS configuration | `[]` |

### Resource Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `resources.limits.cpu` | CPU limit | `1000m` |
| `resources.limits.memory` | Memory limit | `1Gi` |
| `resources.requests.cpu` | CPU request | `250m` |
| `resources.requests.memory` | Memory request | `512Mi` |

## Examples

### Basic installation with embedded PostgreSQL

```bash
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -hex 16)
```

### Installation with external PostgreSQL

```bash
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.enabled=false \
  --set externalDatabase.host=postgres.example.com \
  --set externalDatabase.password=your-db-password
```

### Installation with Ingress

```bash
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -hex 16) \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=tiaki.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

### Installation with SMTP notifications

```bash
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -hex 16) \
  --set config.smtp.host=smtp.gmail.com \
  --set config.smtp.port=587 \
  --set config.smtp.user=your-email@gmail.com \
  --set config.smtp.password=your-app-password \
  --set config.smtp.from=tiaki@example.com
```

### Installation with AI features

```bash
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -hex 16) \
  --set config.anthropic.apiKey=your-anthropic-key \
  --set config.github.token=your-github-token
```

### Using an existing secret

Create a secret with your credentials:

```bash
kubectl create secret generic tiaki-credentials \
  --from-literal=admin-token=$(openssl rand -hex 32) \
  --from-literal=database-url=postgresql://user:pass@host:5432/tiaki
```

Install the chart:

```bash
helm install tiaki-control tiaki/tiaki-control \
  --set existingSecret=tiaki-credentials \
  --set postgresql.enabled=false
```

## Accessing the UI

After installation, access the Tiaki UI:

```bash
# Port-forward to access locally
kubectl port-forward svc/tiaki-control 3001:3001

# Then open http://localhost:3001 in your browser
```

Login with the `ADMIN_TOKEN` you set during installation.

## Database Migrations

Database migrations run automatically on startup. The control plane will apply any pending migrations before starting the server.

## Upgrading

```bash
helm upgrade tiaki-control tiaki/tiaki-control \
  --reuse-values \
  --set image.tag=new-version
```

## Uninstallation

```bash
# Uninstall the release
helm uninstall tiaki-control

# Optionally, delete the PVC to remove all data
kubectl delete pvc data-tiaki-control-postgresql-0
```

## Troubleshooting

### Check pod status

```bash
kubectl get pods -l app.kubernetes.io/name=tiaki-control
```

### View logs

```bash
kubectl logs -l app.kubernetes.io/name=tiaki-control -f
```

### Check database connectivity

```bash
kubectl exec -it deployment/tiaki-control -- env | grep DATABASE_URL
```

## Links

- [Tiaki Website](https://tiaki.dev)
- [Documentation](https://docs.tiaki.dev)
- [GitHub Repository](https://github.com/tiaki-dev/tiaki)
