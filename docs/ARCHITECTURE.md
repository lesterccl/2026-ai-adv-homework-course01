# ARCHITECTURE — 專案架構

> 用途：理解專案全貌。判斷「新程式碼該放哪裡」「模組之間怎麼互動」時讀這份。
> 慣例與風格規則不在這裡，見 [DEVELOPMENT.md](./DEVELOPMENT.md)。

---

## 1. 技術棧

| 層 | 選用 | 備註 |
|---|---|---|
| 後端框架 | Express `~4.16.1` | CommonJS，非 Express 5 |
| 樣板 | EJS `^5.0.1` | 伺服器端渲染，**未安裝任何 layout 套件**（見 §4） |
| 資料庫 | better-sqlite3 `^12.8.0` | **同步 API**，無 ORM、無 query builder |
| 認證 | jsonwebtoken `^9.0.2` + bcrypt `^6.0.0` | HS256 |
| 前端 | Vue 3（CDN `vue.global.prod.js`） | **無打包、無模組系統**，全域變數串接 |
| 樣式 | Tailwind CSS v4（`@tailwindcss/cli`） | 唯一的 build step |
| 測試 | vitest `^2.1.9` + supertest `^7.2.2` | 見 [TESTING.md](./TESTING.md) |
| API 文件 | swagger-jsdoc `^6.2.8` | 只產出 `openapi.json`，**沒有 Swagger UI 路由** |

沒有 TypeScript、沒有 ESLint/Prettier 設定檔、沒有前端打包器。

---

## 2. 目錄結構

```
.
├── server.js              程序進入點：檢查 JWT_SECRET、listen
├── app.js                 Express app 組裝：中介層 → 路由 → 404 → 錯誤處理
├── swagger-config.js      OpenAPI 定義（掃描 ./src/routes/*.js）
├── generate-openapi.js    npm run openapi 的執行本體 → 產出 openapi.json
├── vitest.config.js       測試設定（唯一的 ESM 檔）
├── database.sqlite        執行時自動產生，已 gitignore
│
├── src/
│   ├── database.js        連線 + 建表 + 種子資料，export 已初始化的 db
│   ├── middleware/        跨路由共用的請求處理器
│   └── routes/            所有路由（API 6 檔 + 頁面 1 檔）
│
├── views/                 EJS 樣板
│   ├── layouts/           外框：front.ejs（前台）、admin.ejs（後台）
│   ├── pages/             各頁面內容（admin/ 為後台頁）
│   └── partials/          可重用片段：head、header、footer、notification…
│
├── public/                靜態檔（express.static 直接對外）
│   ├── css/input.css      Tailwind 來源與 @theme 色票
│   ├── css/output.css     build 產物，已 gitignore
│   └── js/
│       ├── auth.js        全域 Auth 物件（token / user / sessionId）
│       ├── api.js         全域 apiFetch
│       ├── notification.js 全域 Notification
│       ├── header-init.js  共用 header 的初始化
│       └── pages/         每頁一支 Vue app
│
├── tests/                 vitest 測試（只打 /api/*）
└── docs/                  本資料夾
```

---

## 3. 請求生命週期

```
瀏覽器
  │
  ▼
server.js          只做兩件事：確認 JWT_SECRET 存在（缺少即 process.exit(1)）、listen
  │                測試不經過這裡，直接 require('./app')
  ▼
app.js             中介層鏈（順序固定，不可調換）：
  │                  cors → express.json → express.urlencoded → sessionMiddleware
  ▼
路由分派           /api/auth  /api/admin/products  /api/admin/orders
  │                /api/products  /api/cart  /api/orders   ← API
  │                /                                        ← 頁面（pageRoutes）
  ▼
404 handler        路徑以 /api 開頭 → 回 JSON；否則 render pages/404
  ▼
errorHandler       只兜底未預期的例外（見 DEVELOPMENT.md §6）
```

**鐵律：新路由必須掛在 `app.js` 的 404 handler 之前。** 掛在之後永遠不會被觸發。

### 3.1 API 路由總覽

下表即 `app.js` 的掛載順序。這些前綴互不重疊，順序不影響分派；**唯一有順序要求的是「全部必須在 404 handler 之前」**。

| 前綴 | 檔案 | 認證 | 說明 |
|---|---|---|---|
| `/api/auth` | `src/routes/authRoutes.js` | 公開（`/profile` 需 JWT） | 註冊、登入、取得個人資料 |
| `/api/admin/products` | `src/routes/adminProductRoutes.js` | JWT + admin（`router.use` 全域上鎖） | 後台商品 CRUD |
| `/api/admin/orders` | `src/routes/adminOrderRoutes.js` | JWT + admin（`router.use` 全域上鎖） | 後台訂單列表、詳情（唯讀） |
| `/api/products` | `src/routes/productRoutes.js` | 公開 | 商品分頁列表、詳情 |
| `/api/cart` | `src/routes/cartRoutes.js` | `dualAuth`（JWT 或 `X-Session-Id`） | 購物車 CRUD |
| `/api/orders` | `src/routes/orderRoutes.js` | JWT（`router.use(authMiddleware)`） | 建單、列表、詳情、建立綠界付款 |
| `/api/payments` | `src/routes/paymentRoutes.js` | **無**（綠界呼叫，靠 CheckMacValue 驗簽） | 綠界 ReturnURL 回調、OrderResultURL 導回 |
| `/` | `src/routes/pageRoutes.js` | 無（頁面本身公開，資料靠前端 API 取） | 9 條 EJS SSR 頁面路由 |

端點層級的行為（參數、body、錯誤情境）見 [FEATURES.md](./FEATURES.md)。

---

## 4. 兩條資料流

### 4.1 API 流

```
request
  → sessionMiddleware         讀 X-Session-Id header → req.sessionId（永遠放行）
  → authMiddleware / dualAuth 依路由而定（見 §6）→ req.user
  → route handler             手寫 if 驗證 → 同步 SQL → 直接 res.status().json()
  → { data, error, message }
```

沒有 repository 層，**SQL 直接寫在路由 handler 裡**，這是刻意的現況。
`src/services/` 目前只放第三方整合的純函式（`ecpay.js`：簽章、參數組裝），**不放資料存取**。

### 4.2 頁面流（兩段式 render）

專案沒有裝 `express-ejs-layouts` 之類的套件，`pageRoutes.js` 用兩個 helper 手動組合：

```
pageRoutes.js
  → res.render('pages/xxx', locals, callback)     ① 先把「頁面內容」渲成 HTML 字串 body
  → res.render('layouts/front', { body, ...})     ② 再把 body 塞進外框
  → 瀏覽器收到完整 HTML
  → 依序載入 auth.js → api.js → notification.js → header-init.js → pages/<pageScript>.js
  → page script 建立 Vue app，用 apiFetch 回頭打自家 /api/*
```

`renderFront()` 與 `renderAdmin()`（`src/routes/pageRoutes.js:6-18`）是唯一入口，新頁面照抄，不要自己呼叫 `res.render`。

Layout 靠 `pageScript` local 決定載入哪支前端腳本：`pageScript: 'cart'` → `<script src="/js/pages/cart.js">`（`views/layouts/front.ejs:17-18`）。

**頁面是空殼，資料全靠前端 `apiFetch` 取得**——伺服器不把商品/訂單資料塞進樣板。

---

## 5. 資料庫層

### 5.1 side-effect import

`app.js:12` 的 `require('./src/database')` 這一行同時完成：開啟連線 → 設定 pragma → 建表 → 種子 admin → 種子 8 筆商品，然後才 export 已就緒的 `db`。任何檔案 `require('../database')` 拿到的都是同一個連線。

- 檔案位置：專案根目錄的 `database.sqlite`（已 gitignore）
- `journal_mode = WAL`、`foreign_keys = ON`（`src/database.js:10-11`）
- 種子只在「表為空」時執行：`seedAdminUser()` 檢查 email 是否存在、`seedProducts()` 檢查 `COUNT(*)`

### 5.2 資料表

```
users ────────┬──< orders ──< order_items >── (product_id, 無外鍵約束)
              │      id, order_no(UNIQUE), user_id, recipient_*,
              │      total_amount, status(pending|paid|failed)
              │
              └──< cart_items >── products
                     session_id / user_id 二擇一（見 §6）
```

全部定義在 `src/database.js` 的 `initializeDatabase()`。所有主鍵都是 `TEXT` 存 `uuidv4()` 字串，所有金額都是 `INTEGER`。

#### `users`

| 欄位 | 型別 | 約束 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `email` | TEXT | UNIQUE NOT NULL |
| `password_hash` | TEXT | NOT NULL（bcrypt） |
| `name` | TEXT | NOT NULL |
| `role` | TEXT | NOT NULL DEFAULT `'user'`，CHECK IN (`'user'`, `'admin'`) |
| `created_at` | TEXT | NOT NULL DEFAULT `datetime('now')` |

#### `products`

| 欄位 | 型別 | 約束 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | — |
| `price` | INTEGER | NOT NULL, **CHECK > 0** |
| `stock` | INTEGER | NOT NULL DEFAULT 0, **CHECK >= 0** |
| `image_url` | TEXT | — |
| `created_at` | TEXT | NOT NULL DEFAULT `datetime('now')` |
| `updated_at` | TEXT | NOT NULL DEFAULT `datetime('now')`（**無自動更新觸發器，要手動 SET**） |

#### `cart_items`

| 欄位 | 型別 | 約束 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `session_id` | TEXT | 可為 NULL — 訪客購物車用 |
| `user_id` | TEXT | 可為 NULL — 會員購物車用，FK → `users(id)` |
| `product_id` | TEXT | NOT NULL, FK → `products(id)` |
| `quantity` | INTEGER | NOT NULL DEFAULT 1, **CHECK > 0** |

`session_id` 與 `user_id` **都可為 NULL，schema 不強制二擇一**，由應用層的 `getOwnerCondition()` 保證（見 §6）。

#### `orders`

| 欄位 | 型別 | 約束 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `order_no` | TEXT | UNIQUE NOT NULL，格式 `ORD-YYYYMMDD-XXXXX` |
| `user_id` | TEXT | NOT NULL, FK → `users(id)` |
| `recipient_name` | TEXT | NOT NULL |
| `recipient_email` | TEXT | NOT NULL |
| `recipient_address` | TEXT | NOT NULL |
| `total_amount` | INTEGER | NOT NULL（後端從 DB 價格重算，不取請求 body） |
| `status` | TEXT | NOT NULL DEFAULT `'pending'`，**CHECK IN (`'pending'`, `'paid'`, `'failed'`)** |
| `merchant_trade_no` | TEXT | UNIQUE — 送綠界的交易編號（英數 ≤20 碼，永久唯一）。建立付款時才寫入 |
| `ecpay_trade_no` | TEXT | 綠界回傳的交易序號 |
| `payment_type` | TEXT | 綠界回傳的付款方式（如 `Credit_CreditCard`） |
| `paid_at` | TEXT | 付款完成時間（綠界的 `PaymentDate`） |
| `created_at` | TEXT | NOT NULL DEFAULT `datetime('now')` |

狀態只有三種，**沒有出貨、完成、取消**。要新增狀態必須改 CHECK 約束並刪 DB 重建（見 §5.3）。

#### `order_items`

| 欄位 | 型別 | 約束 |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `order_id` | TEXT | NOT NULL, FK → `orders(id)` |
| `product_id` | TEXT | NOT NULL，**無 FK 約束**（商品可被刪除，訂單仍要留存） |
| `product_name` | TEXT | NOT NULL — 下單當下的快照 |
| `product_price` | INTEGER | NOT NULL — 下單當下的快照 |
| `quantity` | INTEGER | NOT NULL |

`product_name` / `product_price` 刻意冗餘複製，商品事後改名或改價不影響歷史訂單。**不要把它們「正規化」掉。**

### 5.3 沒有 migration 機制

建表全是 `CREATE TABLE IF NOT EXISTS`。**改 schema 對既有的 `database.sqlite` 完全無效**，必須刪檔重建：

```bash
rm -f database.sqlite database.sqlite-shm database.sqlite-wal
```

改種子資料內容同理。

### 5.4 交易

多筆寫入包 `db.transaction()`。目前唯一的例子是建立訂單（`src/routes/orderRoutes.js:136-156`），在同一個交易內完成四件事：建 `orders` → 逐筆建 `order_items` → `UPDATE products SET stock = stock - ?` → `DELETE FROM cart_items WHERE user_id = ?`。

庫存檢查在交易**之外**先做（`orderRoutes.js:119-127`）。

---

## 6. 身分驗證架構（雙軌）

兩套身分並存。除了購物車以外，其他路由只吃其中一套。

| 元件 | 檔案 | 職責 | 掛載位置 |
|---|---|---|---|
| `sessionMiddleware` | `src/middleware/sessionMiddleware.js` | 讀 `X-Session-Id` → `req.sessionId`。**永遠 `next()`，不擋任何請求** | `app.js` 全域 |
| `authMiddleware` | `src/middleware/authMiddleware.js` | 驗 `Authorization: Bearer`，**驗簽後再查 DB 確認使用者仍存在** → `req.user` | `orderRoutes.js:8`、兩個 admin 路由檔 |
| `dualAuth` | `src/routes/cartRoutes.js:9-46`（區域函式） | 有 Authorization header 就走 JWT（無效直接 401，**不 fallback**）；否則吃 `req.sessionId`；兩者皆無 → 401 | `cartRoutes.js` 逐條路由 |
| `adminMiddleware` | `src/middleware/adminMiddleware.js` | 只檢查 `req.user.role === 'admin'` | 必須接在 `authMiddleware` 之後 |

### 6.1 JWT 參數

| 項目 | 值 | 位置 |
|---|---|---|
| 演算法 | HS256（**驗證時明確指定 `{ algorithms: ['HS256'] }`**，防 alg 混淆） | `authMiddleware.js:16`、`cartRoutes.js:14` |
| 密鑰 | `process.env.JWT_SECRET`，缺少時 `server.js:7` 直接 `exit(1)` | `.env` |
| **有效期** | **`7d`** | `authRoutes.js:115`（註冊）、`authRoutes.js:213`（登入） |
| payload | `{ userId, email, role }` | 同上 |
| 傳遞方式 | `Authorization: Bearer <token>` | `public/js/auth.js` 的 `getAuthHeaders()` |
| 前端儲存 | localStorage key `flower_token`（使用者資料在 `flower_user`） | `public/js/auth.js:2-3` |

驗簽通過後**還會查一次 DB 確認使用者仍存在**，使用者被刪除時即使 token 未過期也回 401。

沒有 refresh token、沒有黑名單機制——登出只是前端清掉 localStorage，token 在 7 天內仍然有效。

### 6.2 middleware 分工

Admin 路由的標準寫法（`src/routes/adminProductRoutes.js:10`）：

```js
router.use(authMiddleware, adminMiddleware);
```

`adminMiddleware` 自己不解 token，單獨掛會直接 403。

**購物車歸屬**由 `getOwnerCondition()`（`cartRoutes.js:48-53`）決定：有 `req.user` 就查 `cart_items.user_id`，否則查 `cart_items.session_id`。

前端的 session id 由 `crypto.randomUUID()` 產生後存在 localStorage（`public/js/auth.js:36-42`），每次請求都透過 `getAuthHeaders()` 帶上。

> 已知缺口：登入時**不會**把訪客的 `session_id` 購物車併入 `user_id`。詳見 [FEATURES.md](./FEATURES.md)。

前端的 `Auth.requireAdmin()`（`views/layouts/admin.ejs:19-25`）只是 UX 導向，**真正的授權一律在伺服器端的 `adminMiddleware`**。

---

## 7. API 文件生成

`swagger-config.js` 指定掃描 `./src/routes/*.js`，收集檔案裡的 `@openapi` JSDoc 區塊。`npm run openapi` 執行 `generate-openapi.js`，把結果寫成專案根目錄的 `openapi.json`。

沒有掛載 Swagger UI，所以**改了 JSDoc 不會有任何畫面立即反映**，也不會有任何測試抓到 JSDoc 與實作不一致。這使 JSDoc 特別容易漂移，維護義務寫在 [DEVELOPMENT.md](./DEVELOPMENT.md) §9。

---

## 8. 新增東西時放哪裡 · 環境變數

這兩節已移到 [DEVELOPMENT.md](./DEVELOPMENT.md)，以維持「一條規則只住一個檔案」：

- **新增 API / middleware / 頁面 / 資料表的步驟** → `DEVELOPMENT.md` §17
- **環境變數表** → `DEVELOPMENT.md` §18
