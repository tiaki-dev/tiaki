---
sidebar_position: 2
---

# Kubernetes Deployment

This page covers deploying the Tiaki **control plane** itself to Kubernetes.

:::note
For deploying the **Kubernetes agent** that monitors workloads in a cluster, see [Kubernetes Agent Configuration](../configuration/agent-kubernetes).
:::

## Helm Charts (Recommended)

The easiest way to deploy Tiaki on Kubernetes is using the official Helm charts.

### Prerequisites

- A Kubernetes cluster with `kubectl` access
- Helm 3.x installed
- An ingress controller (optional, for external access)

### Quick Start

```bash
# Add the Tiaki Helm repository
helm repo add tiaki https://charts.tiaki.dev
helm repo update

# Install the control plane with embedded PostgreSQL
helm install tiaki-control tiaki/tiaki-control \
  --set config.adminToken=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -hex 16) \
  --namespace tiaki \
  --create-namespace

# Wait for the control plane to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=tiaki-control -n tiaki --timeout=300s

# Get the service URL
kubectl get svc tiaki-control -n tiaki

# Create an agent in the UI, then install the agent
helm install tiaki-agent tiaki/tiaki-agent \
  --set config.controlUrl=http://tiaki-control:3001 \
  --set config.apiKey=YOUR_API_KEY_HERE \
  --namespace tiaki
```

### Configuration Options

See the [Helm Charts Reference](./helm-charts.md) for complete configuration documentation.

### Upgrading

```bash
# Update Helm repository
helm repo update

# Upgrade control plane
helm upgrade tiaki-control tiaki/tiaki-control \
  --namespace tiaki

# Upgrade agent
helm upgrade tiaki-agent tiaki/tiaki-agent \
  --namespace tiaki
```

### Uninstalling

```bash
# Uninstall agent
helm uninstall tiaki-agent -n tiaki

# Uninstall control plane (keeps PVCs)
helm uninstall tiaki-control -n tiaki

# Delete PVCs and namespace (WARNING: deletes all data)
kubectl delete pvc -l app.kubernetes.io/instance=tiaki-control -n tiaki
kubectl delete namespace tiaki
```

## Manual Deployment (Alternative)

If you prefer not to use Helm, you can deploy using raw Kubernetes manifests.

### Prerequisites

- A Kubernetes cluster with `kubectl` access
- A PostgreSQL instance reachable from within the cluster
- An ingress controller (nginx-ingress, Traefik, etc.)
- cert-manager for TLS (recommended)

### Namespace and secrets

```bash
kubectl create namespace tiaki
```

```bash
kubectl create secret generic tiaki-server-secret \
  --namespace tiaki \
  --from-literal=ADMIN_TOKEN=your-admin-token \
  --from-literal=JWT_SECRET=your-jwt-secret \
  --from-literal=DATABASE_URL=postgresql://user:pass@your-db-host:5432/tiaki
```

## Deployment manifest

```yaml title="tiaki-server.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiaki-server
  namespace: tiaki
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tiaki-server
  template:
    metadata:
      labels:
        app: tiaki-server
    spec:
      containers:
        - name: tiaki-server
          image: ghcr.io/tiaki-dev/tiaki-server:latest
          ports:
            - containerPort: 3001
          envFrom:
            - secretRef:
                name: tiaki-server-secret
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: tiaki-server
  namespace: tiaki
spec:
  selector:
    app: tiaki-server
  ports:
    - port: 80
      targetPort: 3001
```

## Ingress with TLS

```yaml title="tiaki-ingress.yaml"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiaki-server
  namespace: tiaki
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - tiaki.your-domain.com
      secretName: tiaki-tls
  rules:
    - host: tiaki.your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: tiaki-server
                port:
                  number: 80
```

## Deploy

```bash
kubectl apply -f tiaki-server.yaml
kubectl apply -f tiaki-ingress.yaml

# Watch rollout
kubectl rollout status deployment/tiaki-server -n tiaki
```

## Scaling

The control plane is stateless (state lives in PostgreSQL) and can be scaled horizontally:

**With Helm:**

```bash
helm upgrade tiaki-control tiaki/tiaki-control \
  --set replicaCount=2 \
  --namespace tiaki
```

**With kubectl:**

```bash
kubectl scale deployment tiaki-server --replicas=2 -n tiaki
```

## Troubleshooting

### Control Plane Not Starting

Check pod logs:

```bash
kubectl logs -l app.kubernetes.io/name=tiaki-control -n tiaki
```

Common issues:

- Database connection failed: Verify PostgreSQL is running and credentials are correct
- Port already in use: Check for conflicting services on port 3001

### Agent Not Connecting

Check agent logs:

```bash
kubectl logs -l app.kubernetes.io/name=tiaki-agent -n tiaki
```

Common issues:

- Invalid API key: Create a new agent in the UI and update the Helm values
- Network connectivity: Ensure the agent can reach the control plane service
- RBAC permissions: Verify the ClusterRole and ClusterRoleBinding are created

### Database Migrations

Database migrations run automatically on startup. To run them manually:

```bash
kubectl exec -it deployment/tiaki-control -n tiaki -- node server/dist/migrate.js
```

## Additional Resources

- [Control Plane Configuration](../configuration/control-plane.md)
- [Kubernetes Agent Configuration](../configuration/agent-kubernetes.md)
- [Helm Charts Documentation](https://github.com/tiaki-dev/tiaki/tree/main/charts)
