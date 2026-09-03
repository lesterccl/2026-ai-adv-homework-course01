# FEATURES — 專案功能清單

> 用途：新增功能前先查這裡，確認要做的東西是否已經存在、存在到什麼程度。
> 開發完成後**必須回來更新這份表格**（狀態欄與測試覆蓋欄）。

盤點基準：`004e507`（2026-09-02）

---

## 1. 功能狀態總表

狀態定義見 §8。

| # | 功能 | API 端點 | 前端頁面 | 測試 | 狀態 |
|---|---|---|---|---|---|
| 1 | 註冊 | `POST /api/auth/register` | `/login` · `login.ejs` · `login.js` | `auth.test.js` | ✅ 完整 |
| 2 | 登入 | `POST /api/auth/login` | 同上 | `auth.test.js` | ✅ 完整 |
| 3 | 取得個人資料 | `GET /api/auth/profile` | **無** | `auth.test.js` | ⚠️ 部分（前端未使用） |
| 4 | 商品列表 | `GET /api/products` | `/` · `index.ejs` · `index.js` | `products.test.js` | ✅ 完整 |
| 5 | 商品詳情 | `GET /api/products/:id` | `/products/:id` · `product-detail.ejs` · `product-detail.js` | `products.test.js` | ✅ 完整 |
| 6 | 購物車（訪客） | `GET/POST/PATCH/DELETE /api/cart` | `/cart` · `cart.ejs` · `cart.js` | `cart.test.js` | ✅ 完整 |
| 7 | 購物車（登入） | 同上（`dualAuth` 走 JWT） | 同上 | `cart.test.js` | ✅ 完整 |
| 8 | 建立訂單 | `POST /api/orders` | `/checkout` · `checkout.ejs` · `checkout.js` | `orders.test.js` | ✅ 完整 |
| 9 | 訂單列表 | `GET /api/orders` | `/orders` · `orders.ejs` · `orders.js` | `orders.test.js` | ✅ 完整 |
| 10 | 訂單詳情 | `GET /api/orders/:id` | `/orders/:id` · `order-detail.ejs` · `order-detail.js` | `orders.test.js` | ✅ 完整 |
| 11 | 綠界付款（建立） | `POST /api/orders/:id/payment` | 結帳頁自動跳轉 · 訂單詳情頁「前往付款」 | `payment.test.js` | ✅ 完整 |
| 11a | 綠界 ReturnURL 回調 | `POST /api/payments/ecpay/callback` | 無（綠界伺服器呼叫） | `payment.test.js` | ✅ 完整 |
| 11b | 綠界 OrderResultURL 導回 | `POST /api/payments/ecpay/result` | 302 導向訂單詳情頁 | `payment.test.js` | ✅ 完整 |
| 12 | 後台商品 CRUD | `GET/POST/PUT/DELETE /api/admin/products` | `/admin/products` · `admin/products.ejs` · `admin-products.js` | `adminProducts.test.js` | ✅ 完整 |
| 13 | 後台訂單列表 | `GET /api/admin/orders` | `/admin/orders` · `admin/orders.ejs` · `admin-orders.js` | `adminOrders.test.js` | ✅ 完整 |
| 14 | 後台訂單詳情 | `GET /api/admin/orders/:id` | 同上頁 | `adminOrders.test.js` | ✅ 完整 |
| 15 | 後台修改訂單狀態 | **無** | **無** | 無 | ❌ 未實作 |
| 16 | 真實金流串接 | 見 #11 / #11a / #11b | 綠界 AIO 信用卡一次付清 | `ecpay.test.js` · `payment.test.js` | ✅ 完整 |
| 17 | 登入時合併訪客購物車 | **無** | — | 無 | ❌ 未實作（§7） |

---

## 2. 認證

| 端點 | 權限 | 行為 |
|---|---|---|
| `POST /api/auth/register` | 公開 | 驗必填 → email 格式 → 密碼 ≥ 6 碼 → email 重複回 409 `CONFLICT` → bcrypt hash → 建 user → **直接簽發 token 回傳**（註冊即登入） |
| `POST /api/auth/login` | 公開 | 比對 bcrypt → 回 `{ token, user }`。帳號或密碼錯誤都回同一句 `Email 或密碼錯誤` |
| `GET /api/auth/profile` | JWT | 回目前使用者資料 |

- 角色只有 `user` / `admin` 兩種（`users.role` CHECK 約束）。註冊一律是 `user`，**沒有任何端點可以把人升級成 admin**，admin 只能靠種子資料產生。
- 測試環境的 bcrypt saltRounds 降為 1（`src/database.js:82`），加快測試。

---

## 3. 商品（前台）

| 端點 | 權限 | 行為 |
|---|---|---|
| `GET /api/products` | 公開 | 分頁列表，`created_at DESC`。`page` ≥ 1、`limit` 1–100 預設 10 |
| `GET /api/products/:id` | 公開 | 單筆，不存在回 404 |

種子資料為 8 筆花卉商品（`src/database.js` 的 `seedProducts()`），只在 products 表為空時寫入。

---

## 4. 購物車

四支端點都用 `dualAuth`（見 [ARCHITECTURE.md](./ARCHITECTURE.md) §6），**同時支援訪客與登入使用者**。

| 端點 | 行為 |
|---|---|
| `GET /api/cart` | 依 `user_id` 或 `session_id` 取購物車，JOIN 商品資料 |
| `POST /api/cart` | body `{ productId, quantity }`。商品不存在 404；庫存不足 400 `STOCK_INSUFFICIENT`；已在車內則累加數量 |
| `PATCH /api/cart/:itemId` | 改數量 |
| `DELETE /api/cart/:itemId` | 移除單項 |

歸屬判定：有 JWT → 綁 `user_id`；只有 `X-Session-Id` → 綁 `session_id`。前端的 session id 由 `crypto.randomUUID()` 產生並存 localStorage。

> ⚠️ **登入不會合併訪客購物車**——訪客加購後登入，會看到空的購物車。詳見 §7。

---

## 5. 訂單

| 端點 | 權限 | 行為 |
|---|---|---|
| `POST /api/orders` | JWT | 驗收件人三欄 + email 格式 → 取購物車（空則 400 `CART_EMPTY`）→ 檢查每項庫存（不足則 400 `STOCK_INSUFFICIENT` 並列出品名）→ **交易內**建訂單、建 order_items、扣庫存、清空購物車 |
| `GET /api/orders` | JWT | 自己的訂單列表，**無分頁** |
| `GET /api/orders/:id` | JWT | 訂單詳情，含品項；他人訂單回 404 |
| `POST /api/orders/:id/payment` | JWT | 產生綠界 AIO 表單參數（含 CheckMacValue）並回 `{ action, params }`，前端以 form POST 跳轉綠界。非 `pending` 回 400 `INVALID_STATUS`，他人訂單回 404。同一訂單重試會沿用既有的 `merchant_trade_no` |

- 訂單編號格式 `ORD-YYYYMMDD-XXXXX`（`orderRoutes.js:10-15`）。
- `order_items` 保存下單當下的 `product_name` / `product_price` 快照，商品事後改名改價不影響歷史訂單。
- 訂單狀態只有三種：`pending` / `paid` / `failed`（DB CHECK 約束）。**沒有出貨、完成、取消等狀態。**
- 狀態只由綠界回調改變（`POST /api/payments/ecpay/callback`），**沒有任何端點可由使用者直接指定付款結果**。
- 金流欄位：`merchant_trade_no`（送綠界的交易編號，英數 ≤20 碼）、`ecpay_trade_no`、`payment_type`、`paid_at`。

---

## 6. 後台

兩個路由檔都以 `router.use(authMiddleware, adminMiddleware)` 全域上鎖。

### 商品管理（`/api/admin/products`）

| 端點 | 行為 |
|---|---|
| `GET /` | 分頁列表 |
| `POST /` | 建立。驗 `name` 必填、`price` 正整數、`stock` 非負整數 |
| `PUT /:id` | 更新 |
| `DELETE /:id` | 刪除。**若該商品出現在任何未完成訂單的 order_items，回 409 `CONFLICT`「此商品存在未完成的訂單，無法刪除」** |

body 欄位為 `name` / `description` / `price` / `stock` / `image_url`（注意 `image_url` 是 snake_case）。

### 訂單管理（`/api/admin/orders`）

| 端點 | 行為 |
|---|---|
| `GET /` | 全站訂單分頁列表，支援 `?status=pending\|paid\|failed` 篩選 |
| `GET /:id` | 訂單詳情 |

> ⚠️ **只有兩支 GET，沒有任何寫入端點。** 管理員無法修改訂單狀態、無法取消訂單。

---

## 7. 已確認的缺口

這些是實地查證過的缺口，不是猜測。要動手前先到 [plans/](./plans/) 開一份計劃。

### 7.1 後台無法修改訂單狀態

`src/routes/adminOrderRoutes.js` 只有 `router.get('/')` 與 `router.get('/:id')`，沒有 PATCH/PUT。前端 `admin-orders.js` 也只有篩選與檢視 UI。訂單狀態一旦由使用者付款流程決定就無法由管理員調整。

### 7.2 登入不合併訪客購物車

`src/routes/authRoutes.js` 全檔沒有任何 `session_id` / `cart_items` 的引用；`sessionMiddleware` 也只是把 header 塞進 `req.sessionId`，沒有合併邏輯的呼叫點。使用者體驗上這是明顯的斷點。

### 7.3 綠界金流（已完成，含真實交易實測）

`ECPAY_*` 與 `BASE_URL` 環境變數現已實際使用，串接的是**綠界 AIO 信用卡一次付清**。

#### 已實測驗證（2026-09-03，綠界測試環境）

| 環節 | 驗證方式 | 結果 |
|---|---|---|
| CheckMacValue 產生 | 綠界官方 7 個測試向量（`tests/fixtures/`）+ 真實閘道接受表單並開出付款頁 | ✅ |
| 參數合法性 | 綠界收單，無退件 | ✅ |
| **真實信用卡交易** | 測試卡付款成功，`TradeNo 2609031003504464`、`TradeStatus 1`、NT$1,680 | ✅ |
| CheckMacValue 驗證 | 對綠界**實際簽出**的 QueryTradeInfo 回應驗簽，3 次皆通過 | ✅ |
| 回調處理 | 以綠界回傳的真實交易資料組回調打本機端點 → 回 `1\|OK`，`status`/`ecpay_trade_no`/`payment_type`/`paid_at` 正確落地 | ✅ |
| 冪等性 | 同一筆重送，第二次 no-op 且仍回 `1\|OK` | ✅ |
| **回調的網路送達** | localtunnel TLS 握手 14.5–17.3 秒，超過綠界 `ReturnURL` 的 10 秒上限 | ❌ **未驗證** |

#### 唯一未驗證的環節

**綠界伺服器主動連線到本站的那一段網路傳輸**，從未實際發生過。

證據：綠界含重送共 4 次嘗試期間，server log 完全沒有任何進站請求（只有啟動那一行）。連線在 TLS 握手階段就被綠界放棄，**本站的回調程式碼從未被執行**。

這是隧道工具的延遲問題，不是程式碼問題——回調處理邏輯本身已由上表最後三列與 17 個整合測試涵蓋。要補完這一格，需要低延遲的公開網址（ngrok 或正式部署），見 `docs/TESTING.md`。

#### 未實作

退款（DoAction）、定期定額、分期、ATM／超商代碼／條碼（需另外實作 `PaymentInfoURL`）、電子發票、物流。

#### 已知的營運缺口

綠界回調若因網路問題未送達，訂單會停在 `pending` 而錢已收（本次實測就發生了）。綠界官方指南建議用 `QueryTradeInfo` 查詢 API 對帳補正，**本專案尚未把它做成正式功能**。

### 7.4 `GET /api/auth/profile` 前端未使用

端點存在且有測試，但 `grep -rn "auth/profile" public/ views/` 零匹配。header 顯示的使用者名稱來自 localStorage（`Auth.getUser()`），不是這支 API。等於有一支沒人呼叫的端點。

### 7.5 頁面路由零測試

`pageRoutes.js` 的 9 條 SSR 路由完全沒有測試覆蓋，測試只打 `/api/*`。EJS 樣板出錯不會被任何測試抓到。

---

## 8. 狀態標記約定

更新這份文件時照這個標準判定：

| 標記 | 判定條件 |
|---|---|
| ✅ 完整 | 後端端點 + 前端可操作 + 有測試，三者齊備 |
| ⚠️ 部分 | 缺其中之一。**必須在該列或 §7 明確寫出缺什麼** |
| ❌ 未實作 | 沒有實作。可能有殘留痕跡（如未使用的環境變數），要註明 |

「有測試」指該功能的**主要成功路徑**有測試，不要求分支全覆蓋；覆蓋缺口記在 [TESTING.md](./TESTING.md)。
