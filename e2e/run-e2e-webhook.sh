#!/usr/bin/env bash
set -euo pipefail

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTROL_URL="http://localhost:13001"
RECEIVER_NAME="tiaki-webhook-receiver"
RECEIVER_PORT=18080
OVERRIDE_FILE="/tmp/tiaki-compose-webhook-override.yml"

log() { echo "[e2e-webhook] $*"; }
fail() { echo "[e2e-webhook] FAIL: $*" >&2; exit 1; }

# Pre-cleanup any leftovers from prior runs
docker rm -f "$RECEIVER_NAME" 2>/dev/null || true
docker compose -f "$E2E_DIR/docker-compose.test.yml" down -v 2>/dev/null || true

cleanup() {
  log "cleaning up..."
  docker compose -f "$E2E_DIR/docker-compose.test.yml" -f "$OVERRIDE_FILE" down -v 2>/dev/null || true
  docker rm -f "$RECEIVER_NAME" 2>/dev/null || true
  rm -f "$OVERRIDE_FILE"
}
trap cleanup EXIT

# ─── 1. Start webhook receiver container ─────────────────────────────────────
log "starting webhook receiver container..."
docker rm -f "$RECEIVER_NAME" 2>/dev/null || true

# Python-based webhook receiver that records all POSTs to /tmp/webhooks.json
docker run -d --name "$RECEIVER_NAME" \
  -p "${RECEIVER_PORT}:8080" \
  python:3-alpine \
  python3 -c "
import http.server, json, sys

received = []

class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length))
        received.append(body)
        with open('/tmp/webhooks.json', 'w') as f:
            json.dump(received, f)
        self.send_response(200)
        self.end_headers()
    def log_message(self, *a): pass

http.server.HTTPServer(('', 8080), H).serve_forever()
" > /dev/null

# Wait for receiver to be responsive on host port
for i in $(seq 1 10); do
  if curl -sf -X POST "http://localhost:${RECEIVER_PORT}" \
       -H "Content-Type: application/json" -d '{"ping":true}' > /dev/null 2>&1; then
    log "receiver is up"
    break
  fi
  [ $i -eq 10 ] && fail "webhook receiver did not start"
  sleep 1
done

# ─── 2. Write compose override ───────────────────────────────────────────────
cat > "$OVERRIDE_FILE" <<YAML
services:
  server:
    environment:
      WEBHOOK_URLS: "http://${RECEIVER_NAME}:8080"
YAML

# ─── 3. Start control stack (creates tiaki-test-net with correct labels) ─
log "starting control stack with WEBHOOK_URLS=http://${RECEIVER_NAME}:8080..."
docker compose -f "$E2E_DIR/docker-compose.test.yml" -f "$OVERRIDE_FILE" up -d

# Connect receiver to the compose-managed network AFTER compose creates it
docker network connect tiaki-test-net "$RECEIVER_NAME" 2>/dev/null || true
# Clear the ping from receiver log
docker exec "$RECEIVER_NAME" sh -c 'echo "[]" > /tmp/webhooks.json'

for i in $(seq 1 40); do
  if curl -sf "$CONTROL_URL/health" > /dev/null 2>&1; then log "server is up"; break; fi
  [ $i -eq 40 ] && fail "server did not start in time"
  sleep 1
done

# ─── 4. Run migrations ───────────────────────────────────────────────────────
log "running DB migrations..."
docker compose -f "$E2E_DIR/docker-compose.test.yml" exec -T server npm run db:migrate

# ─── 5. Register agent ───────────────────────────────────────────────────────
log "registering test agent..."
REGISTER_RESP=$(curl -sf -X POST "$CONTROL_URL/trpc/agents.register" \
  -H "Content-Type: application/json" \
  -d '{"name":"webhook-e2e-agent","type":"vm"}')
AGENT_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['agentId'])")
API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['data']['apiKey'])")
log "agent registered: $AGENT_ID"

# ─── 6. Submit report → creates pending update ───────────────────────────────
log "submitting container report (nginx:1.24-alpine)..."
curl -sf -X POST "$CONTROL_URL/trpc/reports.submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "containers": [{
      "containerId": "webhook-test-ctr",
      "name": "webhook-nginx",
      "image": "nginx",
      "tag": "1.24-alpine"
    }],
    "updates": [{
      "containerId": "webhook-test-ctr",
      "currentTag": "1.24-alpine",
      "latestTag": "1.29.6-alpine"
    }]
  }' > /dev/null

# ─── 7. Verify pending update exists ─────────────────────────────────────────
PENDING=$(curl -sf "$CONTROL_URL/trpc/updates.list" -H "Authorization: Bearer $API_KEY" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
updates = d['result']['data']
print(sum(1 for u in updates if u.get('status') == 'pending'))
")
log "pending updates: $PENDING"
[ "$PENDING" -gt 0 ] || fail "no pending updates found"

# ─── 8. Trigger webhook check ────────────────────────────────────────────────
log "triggering webhook check..."
TRIGGER_RESP=$(curl -sf -X POST "$CONTROL_URL/trpc/notifications.triggerWebhookCheck" \
  -H "Content-Type: application/json" -d '{}')
log "trigger response: $TRIGGER_RESP"

# ─── 9. Wait for webhook to arrive ───────────────────────────────────────────
log "waiting for webhook event to be received..."
for i in $(seq 1 20); do
  CNT=$(docker exec "$RECEIVER_NAME" python3 -c \
    "import json; d=json.load(open('/tmp/webhooks.json')); print(sum(1 for x in d if 'event' in x))" 2>/dev/null || echo 0)
  [ "$CNT" -gt 0 ] && { log "webhook event received ($CNT payload(s))"; break; }
  [ $i -eq 20 ] && fail "webhook was not received in time"
  sleep 1
done

# ─── 10. Verify payload ──────────────────────────────────────────────────────
log "verifying webhook payload..."
docker exec "$RECEIVER_NAME" python3 -c "
import json, sys

payloads = json.load(open('/tmp/webhooks.json'))

# Find first payload with 'event' field (skip health-check pings)
p = next((x for x in payloads if 'event' in x), None)
assert p is not None, f'no webhook event payload found among {len(payloads)} received payloads'

assert p.get('event') == 'updates.found', f\"expected event='updates.found', got {p.get('event')!r}\"
updates = p.get('updates', [])
assert len(updates) > 0, 'payload has no updates'
assert 'ts' in p, \"payload missing 'ts'\"

u = updates[0]
for field in ('id', 'currentTag', 'latestTag', 'status', 'agentId'):
    assert field in u, f\"update missing field '{field}'\"

print(f'  event:   {p[\"event\"]}')
print(f'  updates: {len(updates)}')
print(f'  sample:  currentTag={u[\"currentTag\"]!r} latestTag={u[\"latestTag\"]!r}')
"

# ─── 11. Verify notification log entry ───────────────────────────────────────
log "checking notification history in DB..."
SENT=$(curl -sf "$CONTROL_URL/trpc/notifications.getHistory" | \
  python3 -c "
import sys, json
notifs = json.load(sys.stdin)['result']['data']
print(sum(1 for n in notifs if n.get('status') == 'sent'))
")
log "sent notification log entries: $SENT"
[ "$SENT" -gt 0 ] || fail "no 'sent' notification entries in DB"

log "✅ Webhook E2E PASSED"
