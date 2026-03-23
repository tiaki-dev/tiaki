#!/usr/bin/env bash
set -euo pipefail

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTROL_URL="http://localhost:13001"
COMPOSE="docker compose -f $E2E_DIR/docker-compose.test.yml"

log() { echo "[e2e-audit] $*"; }
fail() { echo "[e2e-audit] FAIL: $*" >&2; exit 1; }

cleanup() {
  log "cleaning up..."
  $COMPOSE down -v 2>/dev/null || true
}
trap cleanup EXIT
$COMPOSE down -v 2>/dev/null || true

# ─── 1. Start stack ──────────────────────────────────────────────────────────
log "starting control stack..."
$COMPOSE up -d

for i in $(seq 1 40); do
  if curl -sf "$CONTROL_URL/health" > /dev/null 2>&1; then log "server is up"; break; fi
  [ $i -eq 40 ] && fail "server did not start"
  sleep 1
done

# ─── 2. Run migrations ───────────────────────────────────────────────────────
log "running DB migrations..."
$COMPOSE exec -T server npm run db:migrate

# ─── 3. Register agent + submit report ───────────────────────────────────────
log "registering agent..."
REGISTER_RESP=$(curl -sf -X POST "$CONTROL_URL/trpc/agents.register" \
  -H "Content-Type: application/json" -d '{"name":"audit-e2e-agent","type":"vm"}')
AGENT_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['agentId'])")
API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['apiKey'])")
log "agent: $AGENT_ID"

log "submitting report with nginx:1.24-alpine..."
curl -sf -X POST "$CONTROL_URL/trpc/reports.submit" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" \
  -d '{
    "containers": [{"containerId":"audit-ctr","name":"audit-nginx","image":"nginx","tag":"1.24-alpine"}],
    "updates": [{"containerId":"audit-ctr","currentTag":"1.24-alpine","latestTag":"1.29.6-alpine"}]
  }' > /dev/null

# ─── 4. Get the update ID ────────────────────────────────────────────────────
UPDATE_ID=$(curl -sf "$CONTROL_URL/trpc/updates.list" -H "Authorization: Bearer $API_KEY" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
updates = d['result']['data']
for u in updates:
    if u.get('currentTag') == '1.24-alpine':
        print(u['id']); break
")
log "update id: $UPDATE_ID"
[ -n "$UPDATE_ID" ] || fail "update not found"

# ─── 5. Approve → audit entry 'approved' ─────────────────────────────────────
log "approving update..."
curl -sf -X POST "$CONTROL_URL/trpc/updates.approve" \
  -H "Content-Type: application/json" -d "{\"id\":\"$UPDATE_ID\"}" > /dev/null

AUDIT=$(curl -sf "$CONTROL_URL/trpc/updates.getAuditLog?input=%7B%22id%22%3A%22$UPDATE_ID%22%7D" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['result']['data']))")
log "audit log after approve: $AUDIT"

APPROVED_ENTRY=$(echo "$AUDIT" | python3 -c "
import sys, json
entries = json.load(sys.stdin)
for e in entries:
    if e.get('action') == 'approved':
        print(e['actor']); break
" 2>/dev/null || echo "")
[ -n "$APPROVED_ENTRY" ] || fail "'approved' audit entry not found"
log "approved by actor: $APPROVED_ENTRY"

# ─── 6. MarkDeployed → audit entry 'deployed' ────────────────────────────────
log "marking deployed..."
curl -sf -X POST "$CONTROL_URL/trpc/updates.markDeployed" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" \
  -d "{\"id\":\"$UPDATE_ID\",\"log\":\"deployed nginx:1.29.6-alpine successfully\"}" > /dev/null

AUDIT2=$(curl -sf "$CONTROL_URL/trpc/updates.getAuditLog?input=%7B%22id%22%3A%22$UPDATE_ID%22%7D" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['result']['data']))")
log "audit log after deploy: $AUDIT2"

DEPLOYED_ENTRY=$(echo "$AUDIT2" | python3 -c "
import sys, json
entries = json.load(sys.stdin)
for e in entries:
    if e.get('action') == 'deployed':
        print(e['detail'] or ''); break
" 2>/dev/null || echo "")
[ -n "$DEPLOYED_ENTRY" ] || fail "'deployed' audit entry not found"
log "deployed detail: $DEPLOYED_ENTRY"

# ─── 7. MarkFailed → audit entry 'failed' ────────────────────────────────────
# Submit a second update to test failure path
log "submitting second update for failure test..."
curl -sf -X POST "$CONTROL_URL/trpc/reports.submit" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" \
  -d '{
    "containers": [{"containerId":"audit-ctr2","name":"audit-postgres","image":"postgres","tag":"16.0"}],
    "updates": [{"containerId":"audit-ctr2","currentTag":"16.0","latestTag":"16.4"}]
  }' > /dev/null

UPDATE2_ID=$(curl -sf "$CONTROL_URL/trpc/updates.list" -H "Authorization: Bearer $API_KEY" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
for u in d['result']['data']:
    if u.get('currentTag') == '7.0':
        print(u['id']); break
")
[ -n "$UPDATE2_ID" ] || fail "second update not found"

# Approve it first (markFailed requires no status check, but agent call needs auth)
curl -sf -X POST "$CONTROL_URL/trpc/updates.approve" \
  -H "Content-Type: application/json" -d "{\"id\":\"$UPDATE2_ID\"}" > /dev/null

curl -sf -X POST "$CONTROL_URL/trpc/updates.markFailed" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" \
  -d "{\"id\":\"$UPDATE2_ID\",\"log\":\"pull failed: image not found\"}" > /dev/null

FAILED_ENTRY=$(curl -sf "$CONTROL_URL/trpc/updates.getAuditLog?input=%7B%22id%22%3A%22$UPDATE2_ID%22%7D" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
for e in d['result']['data']:
    if e.get('action') == 'failed':
        print(e['detail'] or ''); break
" 2>/dev/null || echo "")
[ -n "$FAILED_ENTRY" ] || fail "'failed' audit entry not found"
log "failed detail: $FAILED_ENTRY"

log "✅ Audit Log E2E PASSED"
