# Tiaki Agent Helm Chart

This Helm chart deploys the Tiaki Kubernetes agent for automated container update management.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- A running Tiaki control plane instance

## Installation

### Add the Tiaki Helm repository

```bash
helm repo add tiaki https://charts.tiaki.dev
helm repo update
```

### Install the chart

```bash
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=http://your-tiaki-server:3001 \
  --set config.apiKey=your-api-key-here
```

## Configuration

The following table lists the configurable parameters of the Tiaki Agent chart and their default values.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of agent replicas | `1` |
| `image.repository` | Agent image repository | `tiakidev/tiaki-agent-k8s` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `image.tag` | Image tag (defaults to chart appVersion) | `""` |
| `config.controlUrl` | URL of the Tiaki control plane | `http://tiaki-server:3001` |
| `config.apiKey` | API key for authentication | `""` |
| `config.agentName` | Custom agent name | `""` |
| `config.excludeNamespaces` | List of namespaces to exclude from scanning | `[]` |
| `config.tlsSkipVerify` | Skip TLS certificate verification | `false` |
| `config.caCertPath` | Path to custom CA certificate | `""` |
| `registry.username` | Registry username for private registries | `""` |
| `registry.password` | Registry password for private registries | `""` |
| `trivy.enabled` | Enable Trivy vulnerability scanning | `false` |
| `trivy.minSeverity` | Minimum severity for Trivy reports | `HIGH` |
| `serviceAccount.create` | Create a service account | `true` |
| `serviceAccount.name` | Service account name | `""` |
| `resources.limits.cpu` | CPU limit | `500m` |
| `resources.limits.memory` | Memory limit | `512Mi` |
| `resources.requests.cpu` | CPU request | `100m` |
| `resources.requests.memory` | Memory request | `128Mi` |
| `existingSecret` | Use an existing secret for credentials | `""` |

## Examples

### Basic installation with API key

```bash
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=https://tiaki.example.com \
  --set config.apiKey=your-api-key
```

### Installation with private registry credentials

```bash
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=https://tiaki.example.com \
  --set config.apiKey=your-api-key \
  --set registry.username=myuser \
  --set registry.password=mypassword
```

### Installation with Trivy scanning enabled

```bash
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=https://tiaki.example.com \
  --set config.apiKey=your-api-key \
  --set trivy.enabled=true \
  --set trivy.minSeverity=CRITICAL
```

### Installation with namespace exclusions

```bash
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=https://tiaki.example.com \
  --set config.apiKey=your-api-key \
  --set config.excludeNamespaces="{kube-system,kube-public}"
```

### Using an existing secret

Create a secret with your credentials:

```bash
kubectl create secret generic tiaki-credentials \
  --from-literal=api-key=your-api-key \
  --from-literal=registry-username=myuser \
  --from-literal=registry-password=mypassword
```

Install the chart:

```bash
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=https://tiaki.example.com \
  --set existingSecret=tiaki-credentials
```

## RBAC Permissions

The chart creates a ClusterRole with the following permissions:

- **Read access**: pods, namespaces
- **Read/Write access**: deployments, statefulsets, daemonsets (for automated updates)

## Uninstallation

```bash
helm uninstall tiaki-agent
```

## Links

- [Tiaki Website](https://tiaki.dev)
- [Documentation](https://docs.tiaki.dev)
- [GitHub Repository](https://github.com/tiaki-dev/tiaki)
