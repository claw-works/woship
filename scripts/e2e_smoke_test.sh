#!/bin/bash
# =============================================================
# Woship E2E Smoke Test
# 测试完整工单流程: 注册 → 创建 Provider → 创建工单 → 提交 → 审批 → 等待状态变 done
# 前置条件: 后端在 localhost:8080 运行，数据库已初始化
# =============================================================

set -e

BASE="http://localhost:8080/api"
TIMESTAMP=$(date +%s)
ADMIN_EMAIL="admin_e2e_${TIMESTAMP}@test.com"
ADMIN_PASSWORD="Test1234!"
ADMIN_NAME="E2E Admin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${YELLOW}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# Helper: POST JSON and return body
post_json() {
  local url="$1"
  local body="$2"
  local token="${3:-}"
  local auth_header=""
  if [[ -n "$token" ]]; then
    auth_header="-H 'Authorization: Bearer $token'"
  fi
  eval curl -sf -X POST "$url" \
    -H "'Content-Type: application/json'" \
    ${auth_header} \
    -d "'$body'"
}

# ---------------------------------------------------------------
# Step 1: Register admin user (role defaults to user; seed sets admin)
# ---------------------------------------------------------------
log_info "Step 1: 注册 admin 用户 ($ADMIN_EMAIL)"
REG_RESP=$(curl -sf -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"name\":\"$ADMIN_NAME\"}" || true)
if [[ -z "$REG_RESP" ]]; then
  log_info "注册失败（可能已存在），继续..."
else
  log_ok "注册成功: $(echo "$REG_RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("id","?"))' 2>/dev/null || echo '?')"
fi

# ---------------------------------------------------------------
# Step 2: Login
# ---------------------------------------------------------------
log_info "Step 2: 登录"
LOGIN_RESP=$(curl -sf -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
if [[ -z "$LOGIN_RESP" ]]; then
  log_fail "登录失败，请检查后端是否启动"
fi
TOKEN=$(echo "$LOGIN_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])' 2>/dev/null)
if [[ -z "$TOKEN" ]]; then
  log_fail "无法从登录响应中获取 token: $LOGIN_RESP"
fi
log_ok "Token 获取成功 (${TOKEN:0:20}...)"

# ---------------------------------------------------------------
# Step 3: Create mock provider
# ---------------------------------------------------------------
log_info "Step 3: 创建 mock provider"
PROVIDER_RESP=$(curl -sf -X POST "$BASE/providers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"e2e-mock-${TIMESTAMP}\",\"type\":\"mock\",\"config\":{}}" || true)
if [[ -z "$PROVIDER_RESP" ]]; then
  log_info "创建 provider 失败（可能权限不足，尝试使用已有 provider）"
  # Try listing providers to find an existing one
  PROVIDERS_RESP=$(curl -sf "$BASE/providers" \
    -H "Authorization: Bearer $TOKEN" || echo "[]")
  PROVIDER_ID=$(echo "$PROVIDERS_RESP" | python3 -c 'import sys,json; ps=json.load(sys.stdin); print(ps[0]["id"] if ps else "")' 2>/dev/null || echo "")
  if [[ -z "$PROVIDER_ID" ]]; then
    log_fail "没有可用的 Provider，且无法创建（请使用 admin 账号运行此脚本）"
  fi
  log_ok "使用已有 Provider: $PROVIDER_ID"
else
  PROVIDER_ID=$(echo "$PROVIDER_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])' 2>/dev/null)
  log_ok "Provider 创建成功: $PROVIDER_ID"
fi

# ---------------------------------------------------------------
# Step 4: Create docker_deploy ticket
# ---------------------------------------------------------------
log_info "Step 4: 创建工单"
TICKET_PAYLOAD=$(python3 -c "
import json
payload = {
  'type': 'docker_deploy',
  'title': 'E2E Smoke Test ${TIMESTAMP}',
  'payload': {
    'image': 'nginx:latest',
    'port': 8080,
    'domain': 'e2e-${TIMESTAMP}.example.com',
    'replicas': 1,
    'resources': {'cpu': '100m', 'memory': '128Mi'},
    'provider_id': '${PROVIDER_ID}'
  }
}
print(json.dumps(payload))
")
CREATE_RESP=$(curl -sf -X POST "$BASE/tickets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$TICKET_PAYLOAD")
if [[ -z "$CREATE_RESP" ]]; then
  log_fail "创建工单失败"
fi
TICKET_ID=$(echo "$CREATE_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])' 2>/dev/null)
log_ok "工单创建成功: $TICKET_ID"

# ---------------------------------------------------------------
# Step 5: Submit ticket for approval
# ---------------------------------------------------------------
log_info "Step 5: 提交审批"
SUBMIT_RESP=$(curl -sf -X PUT "$BASE/tickets/$TICKET_ID/submit" \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$SUBMIT_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])' 2>/dev/null)
if [[ "$STATUS" != "pending" ]]; then
  log_fail "提交审批后状态应为 pending，实际: $STATUS"
fi
log_ok "工单已提交审批，状态: $STATUS"

# ---------------------------------------------------------------
# Step 6: Approve ticket
# ---------------------------------------------------------------
log_info "Step 6: 审批通过"
APPROVE_RESP=$(curl -sf -X PUT "$BASE/tickets/$TICKET_ID/approve" \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$APPROVE_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])' 2>/dev/null)
log_ok "工单已审批，状态: $STATUS"

# ---------------------------------------------------------------
# Step 7: Poll for done/failed (max 60s)
# ---------------------------------------------------------------
log_info "Step 7: 等待部署完成..."
MAX_WAIT=60
POLL_INTERVAL=3
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  TICKET_RESP=$(curl -sf "$BASE/tickets/$TICKET_ID" \
    -H "Authorization: Bearer $TOKEN")
  CURRENT_STATUS=$(echo "$TICKET_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])' 2>/dev/null)

  if [[ "$CURRENT_STATUS" == "done" ]]; then
    log_ok "部署完成，状态: $CURRENT_STATUS"
    break
  elif [[ "$CURRENT_STATUS" == "failed" ]]; then
    log_fail "部署失败，状态: $CURRENT_STATUS"
  fi

  log_info "  当前状态: $CURRENT_STATUS，已等待 ${ELAPSED}s..."
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

# ---------------------------------------------------------------
# Step 8: Final check
# ---------------------------------------------------------------
FINAL_RESP=$(curl -sf "$BASE/tickets/$TICKET_ID" -H "Authorization: Bearer $TOKEN")
FINAL_STATUS=$(echo "$FINAL_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])' 2>/dev/null)

echo ""
echo "=============================================="
if [[ "$FINAL_STATUS" == "done" ]]; then
  echo -e "${GREEN}✅ E2E PASS — 工单最终状态: $FINAL_STATUS${NC}"
  exit 0
else
  echo -e "${RED}❌ E2E WARN — 工单最终状态: $FINAL_STATUS (预期: done)${NC}"
  echo "  Ticket ID: $TICKET_ID"
  exit 1
fi
