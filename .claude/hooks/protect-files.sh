#!/usr/bin/env bash
# PreToolUse(Edit|Write) — 敏感檔案保護 (skill Phase 3 #1)
#
# 阻止編輯機密檔、鎖檔、資料庫檔與 build 產物。
# 輸入: hook JSON on stdin。exit 0 = 放行, exit 2 = 阻擋 (stderr 顯示給模型)。
# Fail-open: 任何內部錯誤一律放行 — 守衛絕不能反過來弄壞 harness。
#
# 與 .claude/settings.json 的 deny 規則重疊是刻意的（雙重保險）：
# deny 規則可被 settings.local.json 覆寫，hook 不會。
#
# 測試:
#   echo '{"tool_name":"Edit","tool_input":{"file_path":".env"}}' | bash .claude/hooks/protect-files.sh; echo $?
set -uo pipefail

input=$(cat 2>/dev/null) || exit 0
path=$(printf '%s' "$input" | python3 -c \
  'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("file_path","") or "")
except Exception:
    print("")' 2>/dev/null) || exit 0

[ -z "$path" ] && exit 0
base=$(basename "$path")

block() {
  printf '[BLOCKED by protect-files] %s\n' "$1" >&2
  exit 2
}

case "$base" in
  .env|.env.local|.env.production|.env.*.local)
    block "$path 含機密，禁止編輯。
需要知道有哪些變數 → 讀 .env.example (未被擋)。
要新增變數 → 改 .env.example 並在 docs/DEVELOPMENT.md §18 補一列，實際值請 user 自行填入 .env。" ;;
  *.lock|package-lock.json|yarn.lock|pnpm-lock.yaml)
    block "$path 是鎖檔，禁止手改。
要變更依賴 → 改 package.json 後跑 npm install，讓工具重新產生鎖檔。" ;;
  *.sqlite|*.sqlite-shm|*.sqlite-wal|*.db)
    block "$path 是資料庫檔，禁止用編輯器改。
要改 schema → 改 src/database.js 的 initializeDatabase()，然後刪檔重建:
  rm -f database.sqlite database.sqlite-shm database.sqlite-wal
要查資料 → 用 sqlite3 下 query。" ;;
esac

case "$path" in
  *public/css/output.css)
    block "public/css/output.css 是 Tailwind build 產物 (已 gitignore)。
手寫進去會被下一次 npm run css:build 覆蓋。
正確做法: 改 public/css/input.css 的 @theme 或 utility，然後 npm run css:build" ;;
esac

exit 0
