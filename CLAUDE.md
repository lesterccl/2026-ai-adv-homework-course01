# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

花漾生活 — 花卉電商 demo（hexschool 2026 AI 進階班作業）。Express 4 + EJS SSR + better-sqlite3，前端用 CDN 版 Vue 3 掛在 EJS 頁面上（無前端 build step，只有 Tailwind CLI 產 CSS）。UI 文案與 API message 一律繁體中文。

本 repo 是 `hexschool/2026-ai-adv-homework-course01` 的私人鏡像：`origin` = 個人私庫（push 用），`upstream` = hexschool 原始庫（fetch only，push URL 已停用）。

## Commands

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
```

## 文件路由

主要記憶文件（本檔）只放常駐必要的東西，延伸內容全在 `docs/`。**動手前依情境載入對應文件**：

| 情境 | 讀 |
|---|---|
| 要寫任何程式碼（風格、命名、錯誤處理、中文用語） | [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) |
| 判斷程式碼該放哪、模組怎麼互動、資料表關係 | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| 新增功能前確認現有功能狀態、查已知缺口 | [docs/FEATURES.md](./docs/FEATURES.md) |
| 寫或改測試 | [docs/TESTING.md](./docs/TESTING.md) |
| 開始一件工作 / 完成後回寫文件 | [docs/plans/README.md](./docs/plans/README.md) |

## 鐵律

- 新路由必須掛在 `app.js` 的 404 handler **之前**，否則永遠不會被觸發。
- API 回應一律 `{ data, error, message }` 三欄；**DB 的 snake_case 欄位直接透傳，不要轉 camelCase**（既有測試斷言的是 snake_case）。
- 改動 API 行為時，同步更新該路由正上方的 `@openapi` JSDoc——沒有 Swagger UI，也沒有測試會抓到漂移。
- 測試與開發共用同一顆 `database.sqlite`、無清庫機制。**不要把 `vitest.config.js` 改成平行跑**；新測試檔要加進 `sequence.files`。
- 完成一件工作後，依 `docs/plans/README.md` 的對照表把成果回寫到對應的 docs。

## Gotchas

- `public/css/output.css` 是 build 產物且 gitignored — clone 後沒跑 `css:build` 頁面會完全沒樣式。
- schema 只有 `CREATE TABLE IF NOT EXISTS`、seed 只在表為空時跑，**沒有 migration**。改 schema 或 seed 要刪檔重建：`rm -f database.sqlite database.sqlite-shm database.sqlite-wal`。
- `.env.example` 的 `ECPAY_*` 變數**程式碼完全沒用到**；付款是 `PATCH /api/orders/:id/pay` 帶 `{ action: 'success' | 'fail' }` 的模擬流程。
- `.env.example` 的 admin 帳密（`admin@hexschool.com` / `12345678`）就是 seed 的實際值，`tests/setup.js` 寫死依賴它。
