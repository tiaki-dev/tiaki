# Tiaki Helm Charts

Official Helm charts for deploying Tiaki on Kubernetes.

## Available Charts

### tiaki-agent

The Kubernetes agent monitors running pods and reports available updates to the Tiaki control plane.

**Features:**

- Automatic pod scanning
- Registry update detection
- Optional Trivy vulnerability scanning
- Namespace exclusion support
- RBAC configuration included

[View Chart Documentation](./tiaki-agent/README.md)

### tiaki-control

The control plane provides the web UI, API server, and database for managing container updates across your infrastructure.

**Features:**

- React-based web dashboard
- PostgreSQL database (embedded or external)
- Email notifications (SMTP)
- AI-powered release notes (optional)
- Ingress support
- Health checks and probes

[View Chart Documentation](./tiaki-control/README.md)

## Quick Start

### Install Control Plane

```bash
helm repo add tiaki https://charts.tiaki.dev
helm repo update

# Generate secure credentials
ADMIN_TOKEN=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)

# Install control plane
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$ADMIN_TOKEN \
  --set postgresql.auth.password=$DB_PASSWORD \
  --namespace tiaki \
  --create-namespace
```

### Install Agent

```bash
# Get the control plane service URL
CONTROL_URL=$(kubectl get svc tiaki-control -n tiaki -o jsonpath='{.spec.clusterIP}')

# Create an agent in the Tiaki UI and copy the API key
# Then install the agent:
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=http://$CONTROL_URL:3001 \
  --set config.apiKey=YOUR_API_KEY_HERE \
  --namespace tiaki
```

## Repository Structure

```
charts/
├── tiaki-agent/          # Kubernetes agent chart
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── templates/
│   └── README.md
├── tiaki-control/        # Control plane chart
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── templates/
│   └── README.md
└── README.md            # This file
```

## Development

### Testing Charts Locally

```bash
# Lint the charts
helm lint charts/tiaki-agent
helm lint charts/tiaki-control

# Test template rendering
helm template tiaki-agent charts/tiaki-agent --debug
helm template tiaki-control charts/tiaki-control --debug

# Install from local directory
helm install tiaki-agent ./charts/tiaki-agent \
  --set config.controlUrl=http://tiaki-control:3001 \
  --set config.apiKey=test-key \
  --dry-run --debug
```

### Packaging Charts

```bash
# Package the charts
helm package charts/tiaki-agent
helm package charts/tiaki-control

# Generate index
helm repo index .
```

## Publishing

Charts are automatically published to the Helm repository when a new release is created.

To publish manually:

```bash
# Update chart versions in Chart.yaml
# Package and push to repository
helm package charts/tiaki-agent -d packages/
helm package charts/tiaki-control -d packages/
helm repo index packages/ --url https://charts.tiaki.dev
```

## Support

- **Documentation**: [docs.tiaki.dev](https://docs.tiaki.dev)
- **Issues**: [GitHub Issues](https://github.com/tiaki-dev/tiaki/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tiaki-dev/tiaki/discussions)

## License

MIT License - see [LICENSE](../LICENSE) for details.
