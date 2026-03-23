---
sidebar_position: 3
---

# Dashboard Tour

A quick walkthrough of the Tiaki dashboard and its main sections.

## Overview

After logging in, the dashboard gives you a high-level summary:

- **Agents** — Number of connected agents and their online/offline status
- **Containers** — Total containers being monitored across all agents
- **Pending Updates** — Containers with newer image versions available
- **Recent Activity** — Latest deployments and agent events

## Agents

The **Agents** page lists all registered agents with:

| Column | Description |
|---|---|
| Name | Friendly name you assigned |
| Type | `Docker` or `Kubernetes` |
| Status | Online (last heartbeat < 5 min ago) or Offline |
| Last Seen | Timestamp of last heartbeat |
| Containers | Number of containers this agent monitors |

Click on an agent to drill into its containers and deployment history.

## Containers

The **Containers** page shows all containers across all agents. Each row shows:

- Container name and image
- Current running tag/digest
- Agent that manages it
- **Update available** badge if a newer version exists

### Deploying an update

1. Find the container with an update available
2. Click **Deploy** next to the container
3. Review the pending update details (current tag → new tag, changelog link if available)
4. Click **Confirm Deploy**

The agent receives the deployment command via long-polling and executes the update. You can watch the status update in real time.

### Manual rollback

1. Open a container's detail view
2. Go to the **History** tab
3. Find the previous version
4. Click **Rollback**

The agent pulls the previous image and restarts the container.

## Audit Log

The **Audit Log** page provides a complete, immutable history of:

- All deployments (who triggered them, what image, success/failure)
- Rollback operations
- Agent registrations and disconnections
- Configuration changes

Use the filters to narrow by agent, container, or date range.

## Settings

### Email Notifications

Configure SMTP settings under **Settings → Notifications** to receive email alerts for:

- New updates available
- Successful and failed deployments

### Scan Schedule

The default scan interval is every 6 hours. Change it under **Settings → Scan Interval** using a cron expression.

### API Keys

Manage agent API keys under **Settings → Agents**. You can revoke and regenerate keys here.
