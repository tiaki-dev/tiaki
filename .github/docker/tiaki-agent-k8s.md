# tiakidev/tiaki-agent-k8s

The Tiaki agent for Kubernetes — monitors running pods and reports available updates to the Tiaki control plane.

## What is Tiaki?

[Tiaki](https://github.com/tiaki-dev/tiaki) monitors your running containers, detects available updates, and automates deployments with built-in rollback capabilities.

## Quick Start

The agent requires a running [tiaki-server](https://hub.docker.com/r/tiakidev/tiaki-server) instance.

**1.** In the Tiaki UI, go to **Agents** → create a new agent → copy the API key.

**2.** Deploy the agent to your cluster:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiaki-agent
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
      containers:
        - name: tiaki-agent
          image: tiakidev/tiaki-agent-k8s:latest
          env:
            - name: CONTROL_URL
              value: "http://your-tiaki-server:3001"
            - name: AGENT_API_KEY
              valueFrom:
                secretKeyRef:
                  name: tiaki-secret
                  key: api-key
```

## Environment Variables

| Variable                                  | Required | Description                                                                          |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `CONTROL_URL`                             | ✅       | URL of the Tiaki server                                                              |
| `AGENT_API_KEY`                           | ✅       | API key created in the Tiaki UI                                                      |
| `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | —        | Credentials for private container registries                                         |
| `TRIVY_ENABLED`                           | —        | Set to `true` to enable vulnerability scanning                                       |
| `TRIVY_MIN_SEVERITY`                      | —        | Minimum severity to report: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` (default: `HIGH`) |

## Links

- [Website](https://tiaki.dev)
- [Documentation](https://docs.tiaki.dev)
- [GitHub Repository](https://github.com/tiaki-dev/tiaki)
- [Changelog](https://github.com/tiaki-dev/tiaki/blob/main/CHANGELOG.md)
- [Report an Issue](https://github.com/tiaki-dev/tiaki/issues)
