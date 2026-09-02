---
paths:
  - "tests/**"
  - "vitest.config.js"
---

# 測試規則

## 框架
- vitest + supertest。`globals: true`，所以 `describe`/`it`/`expect` 不需 import。
- 測試 `require('../app')` 而非 `server.js`，不會真的 listen。

## 執行順序（最重要）
- 測試與開發**共用同一顆 `database.sqlite`**，沒有 fixture 隔離、沒有清庫。
- 因此 `vitest.config.js` 設 `fileParallelism: false` 並寫死 `sequence.files` 順序（auth → products → cart → orders → adminProducts → adminOrders）。
- **不要改成平行跑、不要拿掉 `sequence.files`**——看起來只是加速，實際會讓測試隨機失敗。
- **新增測試檔必須加進 `sequence.files`**，否則執行順序不受控。

## 撰寫規則
- 一個模組一個檔案，一個 `describe('<Module> API')`。
- 測試名稱**全英文** `should ...` 句型，情境用括號補充：`(guest mode)` / `(authenticated mode)`。測試檔內不寫中文。
- **假設 DB 有前次執行的殘留資料**：不要斷言絕對筆數，用 `toBeGreaterThan(0)`。
- **不要用固定的唯一值**（email、商品名）——第二次跑會撞 409。需要使用者一律用 `registerUser()`。
- 狀態用 `describe` 內的外層 `let` 跨 `it` 傳遞；共用資料用 `beforeAll`（本專案零 `beforeEach`，因為沒有可重置的狀態）。
- **不要斷言 `message` 的中文字串內容**，只斷言欄位存在——文案改動不該弄壞測試。

## 輔助函式（`tests/setup.js`）
- `getAdminToken()` → 用種子 admin 登入取 token。
- `registerUser(overrides?)` → `{ token, user }`，預設 email 帶時間戳 + 亂數。

## 驗收
- `npm test` **連跑兩次都要綠**——第二次才會踩到第一次留下的殘留資料。
- 需要乾淨環境：`rm -f database.sqlite database.sqlite-shm database.sqlite-wal && npm test`
