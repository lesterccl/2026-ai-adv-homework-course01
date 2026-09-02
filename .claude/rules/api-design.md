---
paths:
  - "src/routes/**"
  - "app.js"
---

# API 設計規則

## 回應格式
- 所有 API 回應一律三欄：`{ data, error, message }`。成功時 `error: null`；失敗時 `data: null`。
- 列表回應把資料包一層命名 key（`{ products: [...] }`、`{ orders: [...] }`），不要直接把陣列丟進 `data`。
- 有分頁的端點加 `pagination: { total, page, limit, totalPages }`。
- `message` 一律繁體中文、**不加句號**、不用「您/你」。成功用「N成功」或「成功」；失敗用直述句（「商品不存在」「庫存不足」）。
- 訊息中的欄位名保留原文：寫「price 必須為正整數」，不寫「價格必須為正整數」。

## 欄位命名
- 回應欄位**直接沿用 DB 的 snake_case，不做轉換**（`image_url`、`created_at`、`order_no`）。既有測試斷言的是 snake_case，轉成 camelCase 會讓測試全紅。
- 唯一的 camelCase 是框架層固定鍵：`data` / `error` / `message` / `pagination.totalPages`。
- 請求 body 照抄該端點既有的欄位名，不要自行統一（訂單用 `recipientName`，後台商品用 `image_url`）。

## 路由與掛載
- 新路由必須掛在 `app.js` 的 404 handler **之前**，否則永遠不會被觸發。
- 路由檔命名 `xxxRoutes.js`，export 的變數一律叫 `router`。
- API 路由 handler 用**箭頭函式**；頁面路由（`pageRoutes.js`）用具名 `function (req, res)`；middleware 與輔助函式用具名 `function` 宣告。

## 錯誤處理
- 失敗一律 `return res.status(N).json({ data: null, error: 'CODE', message: '...' })` 早期回傳。**不 throw、不 next(err)**。
- 錯誤碼沿用既有清單，不要發明同義新碼：`VALIDATION_ERROR`(400) / `STOCK_INSUFFICIENT`(400) / `CART_EMPTY`(400) / `INVALID_STATUS`(400) / `UNAUTHORIZED`(401) / `FORBIDDEN`(403) / `NOT_FOUND`(404) / `CONFLICT`(409) / `INTERNAL_ERROR`(500)。

## 分頁
- 照抄既有的 clamp：`page = Math.max(1, parseInt(req.query.page) || 1)`、`limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10))`。

## API 文件註解
- 每個 API 路由上方必須有 `@openapi` JSDoc 區塊，**緊貼 `router.METHOD` 無空行**。
- 改動路徑、參數、回應形狀或狀態碼時**必須同步更新 JSDoc**——沒有 Swagger UI，也沒有測試會抓到漂移。
- `pageRoutes.js` 是頁面路由，不需要 JSDoc。
