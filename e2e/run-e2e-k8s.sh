#!/usr/bin/env bash
set -euo pipefail

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$E2E_DIR/.." && pwd)"
COMPOSE="docker compose -f $E2E_DIR/docker-compose.test.yml"
CONTROL_URL="http://localhost:13001"
CLUSTER_NAME="tiaki-k8s-e2e"
KUBECONFIG_FILE="/tmp/tiaki-k8s-e2e-kubeconfig.yaml"

log() { echo "[e2e-k8s] $*"; }
fail() { echo "[e2e-k8s] FAIL: $*" >&2; exit 1; }

cleanup() {
  log "cleaning up..."
  $COMPOSE down -v 2>/dev/null || true
  k3d cluster delete "$CLUSTER_NAME" 2>/dev/null || true
  rm -f "$KUBECONFIG_FILE"
}
trap cleanup EXIT

# ─── 1. Create k3d cluster ───────────────────────────────────────────────────
log "creating k3d cluster '$CLUSTER_NAME'..."
k3d cluster create "$CLUSTER_NAME" --no-lb --wait
k3d kubeconfig get "$CLUSTER_NAME" > "$KUBECONFIG_FILE"
log "cluster ready"

# ─── 2. Deploy test workload ─────────────────────────────────────────────────
log "deploying test-nginx (nginx:1.24-alpine)..."
kubectl --kubeconfig "$KUBECONFIG_FILE" create deployment test-nginx \
  --image=nginx:1.24-alpine --replicas=1
kubectl --kubeconfig "$KUBECONFIG_FILE" wait deployment/test-nginx \
  --for=condition=Available --timeout=60s
log "test-nginx running"

# ─── 3. Start control plane stack ────────────────────────────────────────────
log "starting control plane stack..."
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

# ─── 4. Run migrations ───────────────────────────────────────────────────────
log "running DB migrations..."
docker compose -f "$E2E_DIR/docker-compose.test.yml" exec -T server npm run db:migrate

# ─── 5. Register K8s agent ───────────────────────────────────────────────────
log "registering K8s agent..."
REGISTER_RESP=$(curl -sf -X POST "$CONTROL_URL/trpc/agents.register" \
  -H "Content-Type: application/json" \
  -d '{"name":"k8s-e2e-agent","type":"k8s"}')
AGENT_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['agentId'])")
API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['apiKey'])")
log "agent registered: $AGENT_ID"

# ─── 6. Run K8s agent (kubeconfig mode, single scan) ─────────────────────────
log "running K8s agent scan..."
( cd "$REPO_ROOT/agent" && \
  CONTROL_URL="$CONTROL_URL" \
  AGENT_API_KEY="$API_KEY" \
  AGENT_NAME="k8s-e2e-agent" \
  AGENT_TYPE="k8s" \
  KUBECONFIG="$KUBECONFIG_FILE" \
  go run ./cmd/k8s ) &
K8S_AGENT_PID=$!

# Wait for agent to submit report (up to 60s)
for i in $(seq 1 30); do
  CONTAINER_COUNT=$(curl -sf "$CONTROL_URL/trpc/containers.list" \
    -H "Authorization: Bearer $API_KEY" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['result']['data']))" 2>/dev/null || echo "0")

  if [ "$CONTAINER_COUNT" -gt "0" ]; then
    log "containers received: $CONTAINER_COUNT"
    kill "$K8S_AGENT_PID" 2>/dev/null || true
    break
  fi
  if [ $i -eq 30 ]; then
    kill "$K8S_AGENT_PID" 2>/dev/null || true
    fail "K8s agent did not submit containers in time"
  fi
  sleep 2
done

# ─── 7. Verify nginx update detected ─────────────────────────────────────────
log "checking for updates..."
UPDATES=$(curl -sf "$CONTROL_URL/trpc/updates.list" \
  -H "Authorization: Bearer $API_KEY" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['result']['data']))")

NGINX_UPDATE=$(echo "$UPDATES" | python3 -c "
import sys, json
updates = json.load(sys.stdin)
for u in updates:
    if u.get('currentTag','') == '1.24-alpine':
        print(u['latestTag'])
        break
" 2>/dev/null || echo "")

if [ -n "$NGINX_UPDATE" ]; then
  log "nginx update detected: 1.24-alpine → $NGINX_UPDATE"
else
  fail "nginx update not detected"
fi

# ─── 8. Verify agent heartbeat ───────────────────────────────────────────────
log "verifying agent heartbeat..."
AGENT_STATUS=$(curl -sf "$CONTROL_URL/trpc/agents.list" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
for a in d['result']['data']:
    if a['type'] == 'k8s':
        print(a['status'])
        break
")
log "K8s agent status: $AGENT_STATUS"
if [ "$AGENT_STATUS" != "online" ]; then
  fail "K8s agent status is not 'online', got: $AGENT_STATUS"
fi

log "✅ K8s E2E tests PASSED"
