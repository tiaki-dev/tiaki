---
sidebar_position: 7
---

# Git Integration

The Docker agent can automatically commit changes to your `docker-compose.yml` file after each successful deployment, giving you a full Git history of every image update.

## How it works

After a successful deployment, the agent:
1. Updates the image tag in your `docker-compose.yml`
2. Stages the changed file with `git add`
3. Creates a commit with the new image reference
4. Pushes to the configured remote (optional)

## Prerequisites

- The agent must run on a machine where the `docker-compose.yml` file is tracked in a Git repository
- The agent process must have write access to the Git repository
- `git` must be installed and configured on the host

## Enabling Git integration

```env title=".env"
GIT_COMMIT_ENABLED=true
GIT_AUTHOR_NAME=Tiaki
GIT_AUTHOR_EMAIL=tiaki@your-domain.com
```

## Configuration reference

| Variable | Default | Description |
|---|---|---|
| `GIT_COMMIT_ENABLED` | `false` | Enable automatic Git commits after deployments |
| `GIT_AUTHOR_NAME` | `Tiaki` | Name used for the Git commit author |
| `GIT_AUTHOR_EMAIL` | `tiaki@localhost` | Email used for the Git commit author |

## Example commit message

After deploying `nginx` from `1.25` to `1.27`, the agent creates a commit like:

```
chore: update nginx from 1.25 to 1.27
```

## Docker volume setup

When running the agent as a Docker container, mount the directory containing your `docker-compose.yml` and the Git repository:

```yaml title="docker-compose.yml"
agent:
  image: ghcr.io/tiaki-dev/tiaki-agent-docker:latest
  environment:
    GIT_COMMIT_ENABLED: "true"
    GIT_AUTHOR_NAME: Tiaki
    GIT_AUTHOR_EMAIL: tiaki@your-domain.com
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /home/deploy/myapp:/workspace   # mount your project directory
```

:::info Git credentials
If you want the agent to push commits to a remote, you must configure Git credentials (SSH key or credential helper) accessible to the agent process or container user.
:::

## Viewing the commit history

```bash
git log --oneline -- docker-compose.yml
```

Example output:

```
a3f1c2d chore: update myapp from v2.3.1 to v2.4.0
b8e9a14 chore: update nginx from 1.25 to 1.27
c1d0f3e chore: update postgres from 15.3 to 15.6
```
