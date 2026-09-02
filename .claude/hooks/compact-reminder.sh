#!/usr/bin/env bash
# SessionStart(compact) — context 壓縮後重新注入關鍵規則 (skill Phase 3 #4)
#
# 壓縮會稀釋掉 CLAUDE.md 的內容，這些是「忘記就會產出錯誤程式碼」的幾條。
# stdout 會被注入回 context。exit 0 一律成功。
cat <<'REMINDER'
[compact 後重新注入 · 花漾生活關鍵規則]

1. API 回應一律 { data, error, message } 三欄；成功 error:null，失敗 data:null。
2. 回應欄位保持 DB 的 snake_case，絕不轉 camelCase — 既有測試斷言 snake_case，轉了會全紅。
3. 新路由必須掛在 app.js 的 404 handler 之前，否則永遠不會被觸發。
4. API 路由 handler 用箭頭函式；頁面路由 (pageRoutes.js) 與 middleware 用具名 function。
5. 錯誤一律 return res.status(N).json(...) 早期回傳，不 throw、不 next(err)。
6. 改 API 必須同步更新正上方的 @openapi JSDoc — 沒有測試會抓到漂移。
7. 測試共用開發用的 database.sqlite，必須序列執行；不要改 vitest.config.js 的
   fileParallelism/sequence.files；新測試檔要加進 sequence.files；npm test 要連跑兩次都綠。
8. schema 只有 CREATE TABLE IF NOT EXISTS，改了要刪 DB 重建才生效。
9. message 用繁中、不加句號、不用「您」。

詳細規範: docs/DEVELOPMENT.md · 架構: docs/ARCHITECTURE.md · 制度: docs/agent/README.md
REMINDER
exit 0
