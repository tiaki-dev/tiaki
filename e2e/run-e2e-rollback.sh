#!/usr/bin/env bash
# Phase 3C: Rollback E2E
# Simulates: submit report → approve → markDeployed → rollback → verify rollback_requested
# Then simulates agent: poll rollback commands → markRolledBack → verify rolled_back
set -euo pipefail

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTROL_URL="http://localhost:13001"
COMPOSE="docker compose -f $E2E_DIR/docker-compose.test.yml"

log() { echo "[e2e-rollback] $*"; }
fail() { echo "[e2e-rollback] FAIL: $*" >&2; exit 1; }

cleanup() { log "cleaning up..."; $COMPOSE down -v 2>/dev/null || true; }
trap cleanup EXIT
$COMPOSE down -v 2>/dev/null || true

# ─── 1. Start stack ──────────────────────────────────────────────────────────
log "starting control stack..."
$COMPOSE up -d
for i in $(seq 1 40); do
  if curl -sf "$CONTROL_URL/health" > /dev/null 2>&1; then log "server is up"; break; fi
  [ $i -eq 40 ] && fail "server did not start"; sleep 1
done

log "running DB migrations..."
$COMPOSE exec -T server npm run db:migrate

# ─── 2. Register agent ───────────────────────────────────────────────────────
log "registering agent..."
REGISTER_RESP=$(curl -sf -X POST "$CONTROL_URL/trpc/agents.register" \
  -H "Content-Type: application/json" -d '{"name":"rollback-e2e-agent","type":"vm"}')
AGENT_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['agentId'])")
API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['apiKey'])")
log "agent: $AGENT_ID"

# ─── 3. Submit report with nginx:1.24-alpine ─────────────────────────────────
log "submitting report (nginx:1.24-alpine → 1.29.6-alpine)..."
curl -sf -X POST "$CONTROL_URL/trpc/reports.submit" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" \
  -d '{
    "containers": [{"containerId":"rollback-ctr","name":"rollback-nginx","image":"nginx","tag":"1.24-alpine"}],
    "updates": [{"containerId":"rollback-ctr","currentTag":"1.24-alpine","latestTag":"1.29.6-alpine"}]
  }' > /dev/null

UPDATE_ID=$(curl -sf "$CONTROL_URL/trpc/updates.list" -H "Authorization: Bearer $API_KEY" | \
  python3 -c "
import sys, json
for u in json.load(sys.stdin)['result']['data']:
    if u.get('currentTag') == '1.24-alpine': print(u['id']); break
")
log "update id: $UPDATE_ID"
[ -n "$UPDATE_ID" ] || fail "update not found"

# ─── 4. Approve ──────────────────────────────────────────────────────────────
log "approving update..."
curl -sf -X POST "$CONTROL_URL/trpc/updates.approve" \
  -H "Content-Type: application/json" -d "{\"id\":\"$UPDATE_ID\"}" > /dev/null

# ─── 5. Mark deployed (simulating agent) ─────────────────────────────────────
log "marking as deployed (simulating agent)..."
curl -sf -X POST "$CONTROL_URL/trpc/updates.markDeployed" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" \
  -d "{\"id\":\"$UPDATE_ID\",\"log\":\"deployed nginx:1.29.6-alpine\"}" > /dev/null

# Verify previousTag is set
UPDATE_STATE=$(curl -sf "$CONTROL_URL/trpc/updates.list" -H "Authorization: Bearer $API_KEY" | \
  python3 -c "
import sys, json
for u in json.load(sys.stdin)['result']['data']:
    if u['id'] == '$UPDATE_ID': print(json.dumps(u)); break
")
PREV_TAG=$(echo "$UPDATE_STATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('previousTag',''))")
STATUS=$(echo "$UPDATE_STATE" | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])")
log "status: $STATUS, previousTag: $PREV_TAG"
[ "$STATUS" = "deployed" ] || fail "expected status=deployed, got $STATUS"
[ "$PREV_TAG" = "1.24-alpine" ] || fail "expected previousTag=1.24-alpine, got $PREV_TAG"

# ─── 6. Request rollback ─────────────────────────────────────────────────────
log "requesting rollback..."
curl -sf -X POST "$CONTROL_URL/trpc/updates.rollback" \
  -H "Content-Type: application/json" -d "{\"id\":\"$UPDATE_ID\"}" > /dev/null

STATUS2=$(curl -sf "$CONTROL_URL/trpc/updates.list" -H "Authorization: Bearer $API_KEY" | \
  python3 -c "
import sys, json
for u in json.load(sys.stdin)['result']['data']:
    if u['id'] == '$UPDATE_ID': print(u['status']); break
")
log "status after rollback request: $STATUS2"
[ "$STATUS2" = "rollback_requested" ] || fail "expected rollback_requested, got $STATUS2"

# ─── 7. Simulate agent polling rollback commands ──────────────────────────────
log "simulating agent poll for rollback commands..."
CMDS=$(curl -sf "$CONTROL_URL/trpc/reports.getCommands" -H "Authorization: Bearer $API_KEY")
ROLLBACK_COUNT=$(echo "$CMDS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rollbacks = d['result']['data'].get('rollbacks', [])
print(len(rollbacks))
")
log "rollback commands returned: $ROLLBACK_COUNT"
[ "$ROLLBACK_COUNT" -gt 0 ] || fail "no rollback commands returned"

ROLLBACK_CMD=$(echo "$CMDS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rb = d['result']['data']['rollbacks'][0]
print(rb['previousTag'], rb['image'])
")
log "rollback command: image=$(echo $ROLLBACK_CMD | cut -d' ' -f2) previousTag=$(echo $ROLLBACK_CMD | cut -d' ' -f1)"

# ─── 8. Simulate agent marking rollback complete ──────────────────────────────
log "marking rollback complete (simulating agent)..."
curl -sf -X POST "$CONTROL_URL/trpc/updates.markRolledBack" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" \
  -d "{\"id\":\"$UPDATE_ID\",\"log\":\"rolled back to nginx:1.24-alpine\"}" > /dev/null

STATUS3=$(curl -sf "$CONTROL_URL/trpc/updates.list" -H "Authorization: Bearer $API_KEY" | \
  python3 -c "
import sys, json
for u in json.load(sys.stdin)['result']['data']:
    if u['id'] == '$UPDATE_ID': print(u['status']); break
")
log "status after rollback complete: $STATUS3"
[ "$STATUS3" = "rolled_back" ] || fail "expected rolled_back, got $STATUS3"

# ─── 9. Verify audit log has all entries ─────────────────────────────────────
log "verifying audit log..."
AUDIT=$(curl -sf "$CONTROL_URL/trpc/updates.getAuditLog?input=%7B%22id%22%3A%22$UPDATE_ID%22%7D" | \
  python3 -c "import sys,json; print(json.dumps([e['action'] for e in json.load(sys.stdin)['result']['data']]))")
log "audit actions: $AUDIT"

for action in approved deployed rollback_requested rollback_completed; do
  FOUND=$(echo "$AUDIT" | python3 -c "import json,sys; print('yes' if '$action' in json.load(sys.stdin) else 'no')")
  [ "$FOUND" = "yes" ] || fail "missing audit action: $action"
done
log "all expected audit actions present"

log "✅ Rollback E2E PASSED"
