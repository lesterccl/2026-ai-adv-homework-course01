# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

花漾生活 — 花卉電商 demo（hexschool 2026 AI 進階班作業）。Express 4 + EJS 伺服器端渲染 + better-sqlite3，前端用 CDN 版 Vue 3 掛在 EJS 頁面上（無前端 build step，唯一的 build 是 Tailwind CLI）。UI 文案與 API message 一律繁體中文。

本 repo 是 `hexschool/2026-ai-adv-homework-course01` 的私人鏡像：`origin` = 個人私庫（push 用），`upstream` = hexschool 原始庫（fetch only，push URL 已停用）。

## 常用指令

```bash
npm install                  # better-sqlite3 需編譯 native binding
cp .env.example .env         # 必要：沒有 JWT_SECRET，server.js 會 exit(1)

npm start                    # build CSS 後啟動（port 3001，可用 PORT 覆蓋）
npm run dev:server           # 只啟動 server（CSS 已 build 過時用這個）
npm run dev:css              # Tailwind watch，開發改樣式時另開一個終端跑

npm test                     # vitest run（全部）
npx vitest run tests/cart.test.js                  # 單一檔案
npx vitest run tests/cart.test.js -t "guest mode"  # 單一測試（名稱過濾）

npm run openapi              # 掃 src/routes/*.js 的 @openapi JSDoc → 產出 openapi.json

rm -f database.sqlite database.sqlite-shm database.sqlite-wal   # 需要乾淨 DB 時
```

## 關鍵規則

- **API 回應一律 `{ data, error, message }` 三欄**；成功 `error: null`、失敗 `data: null`。
- **DB 的 snake_case 欄位直接透傳，絕不轉 camelCase** —— 既有測試斷言的是 snake_case，轉了會全紅。
- **新路由必須掛在 `app.js` 的 404 handler 之前**，否則永遠不會被觸發。
- **改動 API 行為時同步更新正上方的 `@openapi` JSDoc** —— 沒有 Swagger UI，也沒有測試會抓到漂移。
- **測試與開發共用同一顆 `database.sqlite`、無清庫機制**。不要把 `vitest.config.js` 改成平行跑；新測試檔要加進 `sequence.files`；`npm test` 要連跑兩次都綠。
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`，並更新 `docs/FEATURES.md` 與 `docs/CHANGELOG.md`。

## 詳細文件

- `./docs/README.md` — 項目介紹與快速開始
- `./docs/ARCHITECTURE.md` — 架構、目錄結構、資料流、API 路由總覽、資料庫 schema
- `./docs/DEVELOPMENT.md` — 開發規範、命名規則、環境變數、計畫歸檔流程
- `./docs/FEATURES.md` — 功能列表與完成狀態
- `./docs/TESTING.md` — 測試規範與指南
- `./docs/CHANGELOG.md` — 更新日誌
- `./docs/agent/README.md` — AI agent 作業制度：派工、驗收、熔斷條件

`.claude/rules/` 內的 6 類規則（API 設計、資料庫、測試、前端模板、Git commit、安全性）會依檔案路徑自動套用。

## 必要遵守項目

- **寫任何程式碼前先讀 `docs/DEVELOPMENT.md`** —— 本專案風格有多處反直覺（API 路由用箭頭函式但頁面路由用具名 `function`、回應欄位不轉 camelCase、錯誤一律早期回傳不 throw），憑常識寫必然不符。
- **被 hook 或權限規則擋下時，照 stderr 的指示改做法，不要繞過**。`git add -A`、Read `package-lock.json`、改 `output.css` 都有實際事故紀錄。
- **schema 只有 `CREATE TABLE IF NOT EXISTS`、種子只在表為空時跑，沒有 migration**。改了要刪 DB 重建才生效。
- **`.env.example` 的 `ECPAY_*` 變數程式碼完全沒用到**；付款是 `PATCH /api/orders/:id/pay` 帶 `{ action: 'success' | 'fail' }` 的模擬流程。
- **宣告「完成」必附證據**（實跑命令 + 輸出摘要），否則說「未驗證」；查不到的事標 `[UNVERIFIED]`，不編造。
- **改 `.claude/**` 會跳確認** —— 護欄不由被護的人自行放寬。

## 斜線指令

- `/plan-new <slug>` — 依範本開一張工作計畫卡
- `/verify` — 跑完整機器驗收（測試連跑兩次 + OpenAPI + 待提交檔案 + 殘留掃描）
