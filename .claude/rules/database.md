---
paths:
  - "src/database.js"
---

# 資料庫規則

## 存取方式
- better-sqlite3 是**同步**的：`db.prepare(sql).get()` / `.all()` / `.run()`。**不要加 `await`**。
- 取單筆用 `.get()`、多筆用 `.all()`、寫入用 `.run()`。
- 多筆寫入包 `db.transaction(() => {...})`（範例：`orderRoutes.js` 的建單流程——建訂單、建品項、扣庫存、清購物車在同一交易內）。

## 安全
- 參數一律用 `?` 佔位符，**絕不字串拼接使用者輸入**。
- 動態條件只拼固定的字串片段，值仍走 `?`（見 `adminOrderRoutes.js` 的 status 篩選）。

## 欄位命名與型別
- 欄位一律 snake_case：`password_hash`、`image_url`、`total_amount`、`order_no`、`created_at`。
- 主鍵一律 `TEXT` 存 `uuidv4()` 字串，**不用自增整數**。
- 金額一律 `INTEGER`（無小數）。
- 時間戳一律 `TEXT NOT NULL DEFAULT (datetime('now'))`。

## 約束
- 用 CHECK 約束把業務規則寫進 schema：`price > 0`、`stock >= 0`、`quantity > 0`、`role IN ('user','admin')`、`status IN ('pending','paid','failed')`。
- 外鍵要宣告，且 `foreign_keys = ON` 已在 `src/database.js` 開啟。

## 建表與種子
- 建表一律 `CREATE TABLE IF NOT EXISTS`，全部寫在 `initializeDatabase()` 內。
- 種子只在表為空時執行（檢查 `COUNT(*)` 或該筆是否存在），保持冪等。
- **沒有 migration 機制**。改 schema 或種子內容對既有 DB 檔無效，必須刪檔重建：
  `rm -f database.sqlite database.sqlite-shm database.sqlite-wal`
- 歷史快照欄位刻意冗餘（`order_items.product_name` / `product_price`），商品事後改名改價不影響歷史訂單——不要「正規化」掉它們。
