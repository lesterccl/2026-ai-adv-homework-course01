#!/usr/bin/env bash
# PostToolUse(Edit|Write) — 自動跑對應測試 (skill Phase 3 #5)
#
# 只在編輯 src/routes/*.js 時，跑該模組對應的單一測試檔。
#
# 為什麼不跑全套: 本專案測試共用同一顆 database.sqlite 且必須序列執行
# (vitest.config.js 的 fileParallelism:false + sequence.files)，跑全套約需數十秒，
# 每次編輯都跑會嚴重拖慢開發。詳見 docs/TESTING.md §2。
#
# exit 0 一律放行 — PostToolUse 只回報，不阻擋。
set -uo pipefail

input=$(cat 2>/dev/null) || exit 0
path=$(printf '%s' "$input" | python3 -c \
  'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("file_path","") or "")
except Exception:
    print("")' 2>/dev/null) || exit 0

case "$path" in
  *src/routes/*Routes.js) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -d node_modules ] || exit 0

base=$(basename "$path" Routes.js)          # authRoutes.js -> auth
case "$base" in
  adminProduct) test_file="tests/adminProducts.test.js" ;;
  adminOrder)   test_file="tests/adminOrders.test.js" ;;
  product)      test_file="tests/products.test.js" ;;
  order)        test_file="tests/orders.test.js" ;;
  page)         exit 0 ;;                    # 頁面路由目前無測試
  *)            test_file="tests/${base}.test.js" ;;
esac

[ -f "$test_file" ] || exit 0

echo "[auto-test] 偵測到 $path 變更，執行 $test_file"
npx vitest run "$test_file" 2>&1 | tail -20
exit 0
