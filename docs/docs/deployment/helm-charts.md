---
sidebar_position: 3
---

# Helm Charts Reference

Complete reference for Tiaki Helm charts configuration.

## Repository

```bash
helm repo add tiaki https://charts.tiaki.dev
helm repo update
```

## tiaki-control

The control plane chart deploys the Tiaki web UI, API server, and optionally an embedded PostgreSQL database.

### Installation

```bash
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -hex 16) \
  --namespace tiaki \
  --create-namespace
```

### Values

| Parameter                             | Description                              | Default                 |
| ------------------------------------- | ---------------------------------------- | ----------------------- |
| `replicaCount`                        | Number of control plane replicas         | `1`                     |
| `image.repository`                    | Control plane image repository           | `tiakidev/tiaki-server` |
| `image.tag`                           | Image tag (defaults to chart appVersion) | `""`                    |
| `image.pullPolicy`                    | Image pull policy                        | `IfNotPresent`          |
| `config.adminToken`                   | **Required** Admin authentication token  | `""`                    |
| `config.nodeEnv`                      | Node environment                         | `production`            |
| `config.port`                         | Server port                              | `3001`                  |
| `config.scanInterval`                 | Cron expression for scan frequency       | `"0 */6 * * *"`         |
| `config.smtp.host`                    | SMTP server hostname                     | `""`                    |
| `config.smtp.port`                    | SMTP server port                         | `587`                   |
| `config.smtp.secure`                  | Use TLS for SMTP                         | `false`                 |
| `config.smtp.user`                    | SMTP username                            | `""`                    |
| `config.smtp.password`                | SMTP password                            | `""`                    |
| `config.smtp.from`                    | Email sender address                     | `"tiaki@example.com"`   |
| `config.anthropic.apiKey`             | Anthropic API key for AI features        | `""`                    |
| `config.github.token`                 | GitHub token for API rate limits         | `""`                    |
| `service.type`                        | Kubernetes service type                  | `ClusterIP`             |
| `service.port`                        | Service port                             | `3001`                  |
| `ingress.enabled`                     | Enable ingress                           | `false`                 |
| `ingress.className`                   | Ingress class name                       | `""`                    |
| `ingress.hosts[0].host`               | Hostname                                 | `tiaki.local`           |
| `ingress.tls`                         | TLS configuration                        | `[]`                    |
| `postgresql.enabled`                  | Deploy embedded PostgreSQL               | `true`                  |
| `postgresql.auth.username`            | PostgreSQL username                      | `tiaki`                 |
| `postgresql.auth.password`            | PostgreSQL password                      | `""`                    |
| `postgresql.auth.database`            | PostgreSQL database name                 | `tiaki`                 |
| `postgresql.primary.persistence.size` | PostgreSQL PVC size                      | `10Gi`                  |
| `externalDatabase.host`               | External PostgreSQL host                 | `""`                    |
| `externalDatabase.port`               | External PostgreSQL port                 | `5432`                  |
| `externalDatabase.username`           | External PostgreSQL username             | `tiaki`                 |
| `externalDatabase.password`           | External PostgreSQL password             | `""`                    |
| `externalDatabase.database`           | External PostgreSQL database             | `tiaki`                 |
| `externalDatabase.sslMode`            | PostgreSQL SSL mode                      | `prefer`                |
| `existingSecret`                      | Use existing secret for credentials      | `""`                    |
| `resources.limits.cpu`                | CPU limit                                | `1000m`                 |
| `resources.limits.memory`             | Memory limit                             | `1Gi`                   |
| `resources.requests.cpu`              | CPU request                              | `250m`                  |
| `resources.requests.memory`           | Memory request                           | `512Mi`                 |

### Examples

#### Production with External Database

```yaml
# production-values.yaml
replicaCount: 2

config:
  adminToken: "your-secure-token"
  scanInterval: "0 */4 * * *" # Every 4 hours

  smtp:
    host: "smtp.sendgrid.net"
    port: 587
    secure: false
    user: "apikey"
    password: "your-sendgrid-api-key"
    from: "tiaki@your-company.com"

  anthropic:
    apiKey: "sk-ant-..."

  github:
    token: "ghp_..."

postgresql:
  enabled: false

externalDatabase:
  host: "postgres.production.svc.cluster.local"
  port: 5432
  username: "tiaki"
  password: "secure-password"
  database: "tiaki_production"
  sslMode: "require"

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
  hosts:
    - host: tiaki.your-company.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: tiaki-tls
      hosts:
        - tiaki.your-company.com

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi
```

Install:

```bash
helm install tiaki-control tiaki/tiaki-control \
  -f production-values.yaml \
  --namespace tiaki-production \
  --create-namespace
```

#### Development with Embedded Database

```yaml
# dev-values.yaml
config:
  adminToken: "dev-token-123"
  nodeEnv: "development"

postgresql:
  enabled: true
  auth:
    password: "dev-password"
  primary:
    persistence:
      size: 5Gi
    resources:
      limits:
        cpu: 500m
        memory: 512Mi

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi
```

## tiaki-agent

The agent chart deploys the Kubernetes agent that monitors pods and reports updates.

### Installation

```bash
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=http://tiaki-control:3001 \
  --set config.apiKey=YOUR_API_KEY \
  --namespace tiaki
```

### Values

| Parameter                   | Description                              | Default                      |
| --------------------------- | ---------------------------------------- | ---------------------------- |
| `replicaCount`              | Number of agent replicas                 | `1`                          |
| `image.repository`          | Agent image repository                   | `tiakidev/tiaki-agent-k8s`   |
| `image.tag`                 | Image tag (defaults to chart appVersion) | `""`                         |
| `image.pullPolicy`          | Image pull policy                        | `IfNotPresent`               |
| `config.controlUrl`         | **Required** Control plane URL           | `"http://tiaki-server:3001"` |
| `config.apiKey`             | **Required** Agent API key from UI       | `""`                         |
| `config.agentName`          | Custom agent name                        | `""`                         |
| `config.excludeNamespaces`  | Namespaces to exclude from scanning      | `[]`                         |
| `config.tlsSkipVerify`      | Skip TLS verification (dev only)         | `false`                      |
| `config.caCertPath`         | Path to custom CA certificate            | `""`                         |
| `registry.username`         | Private registry username                | `""`                         |
| `registry.password`         | Private registry password                | `""`                         |
| `trivy.enabled`             | Enable Trivy vulnerability scanning      | `false`                      |
| `trivy.minSeverity`         | Minimum severity to report               | `"HIGH"`                     |
| `existingSecret`            | Use existing secret for credentials      | `""`                         |
| `resources.limits.cpu`      | CPU limit                                | `500m`                       |
| `resources.limits.memory`   | Memory limit                             | `512Mi`                      |
| `resources.requests.cpu`    | CPU request                              | `100m`                       |
| `resources.requests.memory` | Memory request                           | `128Mi`                      |

### Examples

#### Production Agent with Trivy

```yaml
# agent-production.yaml
config:
  controlUrl: "https://tiaki.your-company.com"
  apiKey: "your-api-key-from-ui"
  agentName: "production-cluster"

  excludeNamespaces:
    - kube-system
    - kube-public
    - kube-node-lease
    - cert-manager

registry:
  username: "your-registry-user"
  password: "your-registry-password"

trivy:
  enabled: true
  minSeverity: "MEDIUM"

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 200m
    memory: 256Mi

nodeSelector:
  node-role.kubernetes.io/worker: "true"

tolerations:
  - key: "workload"
    operator: "Equal"
    value: "monitoring"
    effect: "NoSchedule"
```

#### Multiple Agents (Different Namespaces)

Deploy separate agents for different teams/namespaces:

```bash
# Team A agent - only scans team-a namespace
helm install tiaki-agent-team-a tiaki/tiaki-agent \
  --set config.controlUrl=http://tiaki-control:3001 \
  --set config.apiKey=TEAM_A_API_KEY \
  --set config.agentName=team-a-agent \
  --set 'config.excludeNamespaces={kube-system,kube-public,team-b,team-c}' \
  --namespace tiaki

# Team B agent - only scans team-b namespace
helm install tiaki-agent-team-b tiaki/tiaki-agent \
  --set config.controlUrl=http://tiaki-control:3001 \
  --set config.apiKey=TEAM_B_API_KEY \
  --set config.agentName=team-b-agent \
  --set 'config.excludeNamespaces={kube-system,kube-public,team-a,team-c}' \
  --namespace tiaki
```

## Using Existing Secrets

For better security, create secrets manually and reference them:

```bash
# Create control plane secret
kubectl create secret generic tiaki-control-secret \
  --from-literal=adminToken=$(openssl rand -hex 32) \
  --from-literal=databaseUrl=postgresql://user:pass@host:5432/tiaki \
  --from-literal=smtpPassword=your-smtp-password \
  --from-literal=anthropicApiKey=sk-ant-... \
  --from-literal=githubToken=ghp_... \
  --namespace tiaki

# Create agent secret
kubectl create secret generic tiaki-agent-secret \
  --from-literal=apiKey=your-api-key \
  --from-literal=registryUsername=your-user \
  --from-literal=registryPassword=your-pass \
  --namespace tiaki

# Install with existing secrets
helm install tiaki-control tiaki/tiaki-control \
  --set existingSecret=tiaki-control-secret \
  --namespace tiaki

helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=http://tiaki-control:3001 \
  --set existingSecret=tiaki-agent-secret \
  --namespace tiaki
```

## Upgrading Charts

```bash
# Update repository
helm repo update

# Check available versions
helm search repo tiaki --versions

# Upgrade to latest version
helm upgrade tiaki-control tiaki/tiaki-control \
  -f values.yaml \
  --namespace tiaki

# Upgrade to specific version
helm upgrade tiaki-agent tiaki/tiaki-agent \
  --version 1.2.3 \
  --namespace tiaki
```

## Uninstalling

```bash
# Uninstall releases
helm uninstall tiaki-agent -n tiaki
helm uninstall tiaki-control -n tiaki

# Clean up PVCs (WARNING: deletes all data)
kubectl delete pvc -l app.kubernetes.io/instance=tiaki-control -n tiaki

# Delete namespace
kubectl delete namespace tiaki
```

## Chart Development

To test charts locally:

```bash
# Lint charts
helm lint charts/tiaki-agent
helm lint charts/tiaki-control

# Test template rendering
helm template tiaki-agent charts/tiaki-agent \
  --set config.controlUrl=http://test:3001 \
  --set config.apiKey=test-key \
  --debug

# Dry-run installation
helm install tiaki-control charts/tiaki-control \
  --set config.adminToken=test \
  --set postgresql.auth.password=test \
  --dry-run --debug
```

## Support

- **Documentation**: [docs.tiaki.dev](https://docs.tiaki.dev)
- **Chart Source**: [github.com/tiaki-dev/tiaki/tree/main/charts](https://github.com/tiaki-dev/tiaki/tree/main/charts)
- **Issues**: [github.com/tiaki-dev/tiaki/issues](https://github.com/tiaki-dev/tiaki/issues)
