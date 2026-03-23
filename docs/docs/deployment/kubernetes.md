---
sidebar_position: 2
---

# Kubernetes Deployment

This page covers deploying the Tiaki **control plane** itself to Kubernetes.

:::note
For deploying the **Kubernetes agent** that monitors workloads in a cluster, see [Kubernetes Agent Configuration](../configuration/agent-kubernetes).
:::

## Prerequisites

- A Kubernetes cluster with `kubectl` access
- A PostgreSQL instance reachable from within the cluster
- An ingress controller (nginx-ingress, Traefik, etc.)
- cert-manager for TLS (recommended)

## Namespace and secrets

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

```bash
kubectl scale deployment tiaki-server --replicas=2 -n tiaki
```

:::info Helm charts
Helm charts are on the roadmap. Until then, use the manifests above and adapt them to your cluster's conventions.
:::
