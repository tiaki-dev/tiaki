---
sidebar_position: 2
---

# Connect Your First Agent

Agents are lightweight Go binaries that run on your infrastructure, scan containers for updates, and execute deployments. This guide walks you through connecting your first Docker agent.

## Prerequisites

- Tiaki control plane running (see [Installation](installation))
- A machine with Docker containers you want to monitor

## Step 1 — Create an agent in the UI

1. Open the Tiaki dashboard at **http://localhost:3001**
2. Navigate to **Agents** in the sidebar
3. Click **New Agent**
4. Give it a descriptive name (e.g. `production-server` or `homelab`)
5. Select type **Docker (VM)**
6. Click **Create**

:::caution Copy your API key
The API key is shown **only once**. Copy it immediately and store it securely.
:::

## Step 2 — Configure the agent

Add the API key to your `.env` file on the machine where the agent will run:

```env title=".env"
AGENT_API_KEY=your-api-key-here
```

If the agent runs on a **different machine** than the control plane, also set the control plane URL:

```env title=".env"
CONTROL_URL=https://tiaki.your-domain.com
AGENT_API_KEY=your-api-key-here
```

## Step 3 — Start the agent

```bash
docker compose --profile agent up -d agent
```

The agent will:
1. Register with the control plane using the API key
2. Scan all running Docker containers
3. Check each container's image registry for newer versions
4. Report results back to the dashboard

## Verify the connection

Back in the Tiaki dashboard, go to **Agents**. Your agent should appear with a green status indicator and show the last seen timestamp.

Click on the agent to see:
- All discovered containers
- Available updates
- Deployment history

## Kubernetes agent

To connect a Kubernetes cluster, select type **Kubernetes (K8s)** when creating the agent. See [Kubernetes Agent Configuration](../configuration/agent-kubernetes) for the full setup guide.

## Next steps

- [Dashboard tour →](dashboard-tour)
- [Configure private registries →](../configuration/private-registries)
- [Enable security scanning →](../configuration/security-scanning)
