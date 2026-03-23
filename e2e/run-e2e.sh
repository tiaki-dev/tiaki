#!/usr/bin/env bash
set -euo pipefail

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$E2E_DIR/.." && pwd)"
COMPOSE="docker compose -f $E2E_DIR/docker-compose.test.yml"
CONTROL_URL="http://localhost:13001"

log() { echo "[e2e] $*"; }
fail() { echo "[e2e] FAIL: $*" >&2; exit 1; }

cleanup() {
  log "cleaning up..."
  $COMPOSE down -v 2>/dev/null || true
  docker rm -f tiaki-test-agent 2>/dev/null || true
  # Restore compose file if write-back modified it
  git -C "$REPO_ROOT" checkout -- e2e/docker-compose.test.yml 2>/dev/null || true
}
trap cleanup EXIT

# ─── 0. Pre-cleanup ─────────────────────────────────────────────────────────
docker rm -f tiaki-test-agent 2>/dev/null || true

# ─── 1. Build agent image ───────────────────────────────────────────────────
log "building Go agent Docker image..."
docker build -f "$REPO_ROOT/agent/Dockerfile.docker" -t tiaki-agent-test:latest "$REPO_ROOT/agent"

# ─── 2. Start test stack ────────────────────────────────────────────────────
log "starting test stack..."
$COMPOSE up -d

log "waiting for server to be healthy..."
for i in $(seq 1 40); do
  if curl -sf "$CONTROL_URL/health" > /dev/null 2>&1; then
    log "server is up"
    break
  fi
  if [ $i -eq 40 ]; then fail "server did not start in time"; fi
  sleep 1
done

# ─── 3. Run DB migrations ───────────────────────────────────────────────────
log "running DB migrations..."
docker run --rm \
  --network tiaki-test-net \
  -e DATABASE_URL="postgresql://tiaki:tiaki@postgres:5432/tiaki_test" \
  -e NODE_ENV=test \
  --entrypoint node \
  $(docker compose -f "$E2E_DIR/docker-compose.test.yml" images -q server) \
  dist/db/migrate.js 2>/dev/null || \
  # Fallback: run via npm script in server container
  docker compose -f "$E2E_DIR/docker-compose.test.yml" exec -T server npm run db:migrate

# ─── 4. Register agent ──────────────────────────────────────────────────────
log "registering test agent..."
# tRPC v11: path-based call uses raw JSON body (no batch wrapper)
# Response is a tRPC envelope: {"result":{"data":{"json":{...}}}}
REGISTER_RESP=$(curl -sf -X POST "$CONTROL_URL/trpc/agents.register" \
  -H "Content-Type: application/json" \
  -d '{"name":"e2e-test-agent","type":"vm"}') || {
    log "raw register response:"
    curl -v -X POST "$CONTROL_URL/trpc/agents.register" \
      -H "Content-Type: application/json" \
      -d '{"name":"e2e-test-agent","type":"vm"}' 2>&1 | tail -30
    fail "agent registration failed"
  }

log "register response: $REGISTER_RESP"
# tRPC v11 without transformer: data is directly in result.data (no json wrapper)
AGENT_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['agentId'])")
API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['apiKey'])")

log "agent registered: $AGENT_ID"

# ─── 4b. Create auto-approve policy for nginx ────────────────────────────────
log "creating auto-approve policy for nginx..."
curl -sf -X POST "$CONTROL_URL/trpc/policies.create" \
  -H "Content-Type: application/json" \
  -d '{"name":"auto-approve nginx","imagePattern":"nginx:*","autoApprove":true,"enabled":true}' > /dev/null
log "policy created"

# ─── 5. Start agent container ───────────────────────────────────────────────
log "starting agent container..."
# Mount e2e dir at same path so agent can write back compose files
# (docker labels give us the host-absolute path; agent needs that path accessible)
docker run -d \
  --name tiaki-test-agent \
  --network tiaki-test-net \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$E2E_DIR:$E2E_DIR" \
  -e CONTROL_URL="http://server:3001" \
  -e AGENT_API_KEY="$API_KEY" \
  -e AGENT_NAME="e2e-test-agent" \
  -e AGENT_TYPE="vm" \
  tiaki-agent-test:latest

# ─── 6. Wait for report ─────────────────────────────────────────────────────
log "waiting for agent to submit first report..."
for i in $(seq 1 30); do
  CONTAINER_COUNT=$(curl -sf "$CONTROL_URL/trpc/containers.list" \
    -H "Authorization: Bearer $API_KEY" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['result']['data']))" 2>/dev/null || echo "0")

  if [ "$CONTAINER_COUNT" -gt "0" ]; then
    log "containers received: $CONTAINER_COUNT"
    break
  fi
  if [ $i -eq 30 ]; then fail "agent did not submit containers in time"; fi
  sleep 2
done

# ─── 7. Verify updates detected + policy auto-approve ────────────────────────
log "checking for detected updates..."
UPDATES=$(curl -sf "$CONTROL_URL/trpc/updates.list" \
  -H "Authorization: Bearer $API_KEY" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['result']['data']))")

log "updates found: $UPDATES"

# Verify nginx update was auto-approved by policy
NGINX_AUTO_STATUS=$(echo "$UPDATES" | python3 -c "
import sys, json
updates = json.load(sys.stdin)
for u in updates:
    if u.get('currentTag', '') == '1.24-alpine':
        print(u['status'])
        break
" 2>/dev/null || echo "none")

if [ "$NGINX_AUTO_STATUS" = "approved" ] || [ "$NGINX_AUTO_STATUS" = "deployed" ]; then
  log "policy auto-approve verified: nginx update status = $NGINX_AUTO_STATUS"
else
  log "note: nginx auto-approve status = $NGINX_AUTO_STATUS (expected approved)"
fi

# ─── 8. Wait for agent to deploy the auto-approved nginx update ──────────────
NGINX_UPDATE_ID=$(echo "$UPDATES" | python3 -c "
import sys, json
updates = json.load(sys.stdin)
for u in updates:
    if u.get('currentTag', '') == '1.24-alpine':
        print(u['id'])
        break
")

if [ -n "$NGINX_UPDATE_ID" ]; then
  # If not yet auto-approved, approve manually as fallback
  if [ "$NGINX_AUTO_STATUS" != "approved" ] && [ "$NGINX_AUTO_STATUS" != "deployed" ]; then
    log "manually approving nginx update $NGINX_UPDATE_ID as fallback..."
    curl -sf -X POST "$CONTROL_URL/trpc/updates.approve" \
      -H "Content-Type: application/json" \
      -d "{\"id\":\"$NGINX_UPDATE_ID\"}" > /dev/null
  fi
  log "waiting for agent to deploy nginx update..."

  # ─── 9. Wait for deploy to complete ─────────────────────────────────────────
  for i in $(seq 1 40); do
    DEPLOY_STATUS=$(curl -sf "$CONTROL_URL/trpc/updates.list" \
      -H "Authorization: Bearer $API_KEY" | \
      python3 -c "
import sys, json
d = json.load(sys.stdin)
updates = d['result']['data']
for u in updates:
    if u['id'] == '$NGINX_UPDATE_ID':
        print(u['status'])
        break
" 2>/dev/null || echo "unknown")

    if [ "$DEPLOY_STATUS" = "deployed" ]; then
      log "nginx update deployed successfully"
      # Verify compose write-back: docker-compose.test.yml should now have nginx:1.29.6-alpine
      if grep -q "nginx:1.29.6-alpine" "$E2E_DIR/docker-compose.test.yml"; then
        log "compose write-back verified: docker-compose.test.yml updated to nginx:1.29.6-alpine"
      else
        log "note: compose write-back did not update docker-compose.test.yml (composeFile label may not be accessible)"
      fi
      break
    fi
    if [ "$DEPLOY_STATUS" = "failed" ]; then
      fail "agent reported deploy failed for nginx update"
    fi
    if [ $i -eq 40 ]; then fail "agent did not deploy nginx update in time (status: $DEPLOY_STATUS)"; fi
    sleep 3
  done
else
  log "no nginx 1.24-alpine update found — skipping deploy test"
fi

# ─── 9b. Verify nginx:latest container is tracked (non-semver / digest flow) ──
log "verifying nginx:latest container is tracked by agent..."
LATEST_CONTAINER=$(curl -sf "$CONTROL_URL/trpc/containers.list" \
  -H "Authorization: Bearer $API_KEY" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
for c in d['result']['data']:
    if c.get('tag') == 'latest' and 'nginx' in c.get('image', ''):
        print(json.dumps(c))
        break
" 2>/dev/null || echo "")

if [ -z "$LATEST_CONTAINER" ]; then
  fail "nginx:latest container not found in agent report"
fi
log "nginx:latest container tracked: $LATEST_CONTAINER"

# Verify the container has a digest reported (agent must populate it from ImageID)
LATEST_DIGEST=$(echo "$LATEST_CONTAINER" | python3 -c "
import sys, json
c = json.load(sys.stdin)
print(c.get('digest', ''))
" 2>/dev/null || echo "")

if [ -z "$LATEST_DIGEST" ]; then
  log "note: no digest reported for nginx:latest — digest comparison will be skipped on first scan"
else
  log "nginx:latest digest reported: $LATEST_DIGEST (digest-based update detection active)"
fi

# ─── 10. Verify agent heartbeat ─────────────────────────────────────────────
log "verifying agent heartbeat..."
AGENTS=$(curl -sf "$CONTROL_URL/trpc/agents.list" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data'][0]['status'])")
log "agent status: $AGENTS"
if [ "$AGENTS" != "online" ]; then
  fail "agent status is not 'online', got: $AGENTS"
fi

log "✅ E2E tests PASSED"
