---
sidebar_position: 3
---

# Kubernetes Agent Configuration

The Kubernetes agent monitors workloads in a K8s cluster and reports available updates to the control plane.

## Prerequisites

- A running Kubernetes cluster
- `kubectl` configured with access to the cluster
- Tiaki control plane reachable from within the cluster

## Environment variables

### Required

| Variable | Description |
|---|---|
| `CONTROL_URL` | URL of the Tiaki control plane (must be reachable from within the cluster) |
| `AGENT_API_KEY` | API key created in the Tiaki UI under **Agents → New Agent** (select type **Kubernetes**) |

### Registry credentials

| Variable | Description |
|---|---|
| `REGISTRY_USERNAME` | Username for private container registry |
| `REGISTRY_PASSWORD` | Password or access token for private registry |

### Security scanning

| Variable | Default | Description |
|---|---|---|
| `TRIVY_ENABLED` | `false` | Enable Trivy vulnerability scanning |
| `TRIVY_MIN_SEVERITY` | `HIGH` | Minimum severity: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` |

## Deployment

### Step 1 — Create a namespace and secret

```bash
kubectl create namespace tiaki

kubectl create secret generic tiaki-agent-secret \
  --namespace tiaki \
  --from-literal=AGENT_API_KEY=your-api-key-here \
  --from-literal=CONTROL_URL=https://tiaki.your-domain.com
```

### Step 2 — Apply RBAC permissions

The agent needs read access to Pods and Deployments:

```yaml title="tiaki-rbac.yaml"
apiVersion: v1
kind: ServiceAccount
metadata:
  name: tiaki-agent
  namespace: tiaki
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: tiaki-agent
rules:
  - apiGroups: [""]
    resources: ["pods", "namespaces"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "daemonsets", "statefulsets"]
    verbs: ["get", "list", "watch", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: tiaki-agent
subjects:
  - kind: ServiceAccount
    name: tiaki-agent
    namespace: tiaki
roleRef:
  kind: ClusterRole
  name: tiaki-agent
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f tiaki-rbac.yaml
```

### Step 3 — Deploy the agent

```yaml title="tiaki-agent.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiaki-agent
  namespace: tiaki
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tiaki-agent
  template:
    metadata:
      labels:
        app: tiaki-agent
    spec:
      serviceAccountName: tiaki-agent
      containers:
        - name: tiaki-agent
          image: ghcr.io/tiaki-dev/tiaki-agent-k8s:latest
          envFrom:
            - secretRef:
                name: tiaki-agent-secret
```

```bash
kubectl apply -f tiaki-agent.yaml
```

### Verify the agent is running

```bash
kubectl get pods -n tiaki
kubectl logs -n tiaki deployment/tiaki-agent
```

Back in the Tiaki dashboard, go to **Agents** — the Kubernetes agent should appear online.

## Namespaces

By default, the agent monitors all namespaces it has access to. To restrict monitoring to specific namespaces, adjust the `ClusterRoleBinding` to a namespace-scoped `RoleBinding`.
