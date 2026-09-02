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

沒有 service 層、沒有 repository 層。**SQL 直接寫在路由 handler 裡**，這是刻意的現況，不是遺漏。

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

| 表 | 主鍵 | 重點約束 |
|---|---|---|
| `users` | uuid | `email` UNIQUE；`role` CHECK IN ('user','admin') |
| `products` | uuid | `price` CHECK > 0；`stock` CHECK >= 0 |
| `cart_items` | uuid | `session_id` 與 `user_id` **都可為 NULL**，靠應用層二擇一 |
| `orders` | uuid | `order_no` UNIQUE，格式 `ORD-YYYYMMDD-XXXXX` |
| `order_items` | uuid | **冗餘保存** `product_name`/`product_price`（下單當下的快照） |

`order_items` 刻意複製商品名稱與價格，之後商品改名或改價不影響歷史訂單。

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

## 8. 新增東西時放哪裡

| 要做的事 | 動哪些檔案 |
|---|---|
| 新增 API 端點 | ① 對應的 `src/routes/xxxRoutes.js` 加 handler ② 正上方補 `@openapi` 區塊 ③ `tests/xxx.test.js` 補測試 |
| 新增整組 API 資源 | 新建 `src/routes/xxxRoutes.js` → 在 `app.js` 的 API 區塊 `app.use()`（**務必在 404 之前**）→ 新建測試檔並加進 `vitest.config.js` 的 `sequence.files` |
| 新增前台頁面 | 三檔同步：`pageRoutes.js` 加 route（帶 `pageScript`）＋ `views/pages/<name>.ejs` ＋ `public/js/pages/<name>.js` |
| 新增後台頁面 | 同上，但用 `renderAdmin()`、樣板放 `views/pages/admin/`，並在 `views/partials/admin-sidebar.ejs` 補選單 |
| 新增可重用的請求處理邏輯 | `src/middleware/` |
| 修改資料表 | `src/database.js` 的 `initializeDatabase()`，改完刪 `database.sqlite` 重建（見 §5.3） |
| 新增色票／樣式 token | `public/css/input.css` 的 `@theme`，然後 `npm run css:build` |
| 跨路由共用的商業邏輯 | **目前沒有 `services/` 層**。單一路由檔內用區域 `function`（如 `cartRoutes.js` 的 `dualAuth`）；真的需要跨檔共用時再新建 `src/services/`，屬架構決策，先跟 user 確認 |

---

## 9. 環境變數

`.env`（由 `.env.example` 複製）在 `app.js:1` 經 `dotenv` 載入。

| 變數 | 用途 | 缺少時 |
|---|---|---|
| `JWT_SECRET` | 簽發／驗證 token | **`server.js:7` 直接 `process.exit(1)`** |
| `PORT` | 監聽埠 | 預設 3001 |
| `FRONTEND_URL` | CORS 允許來源 | 預設 `http://localhost:3001` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 種子管理員帳密 | 預設 `admin@hexschool.com` / `12345678` |
| `BASE_URL` | 宣告於 `.env.example`，**程式碼未引用** | — |
| `ECPAY_*` | 宣告於 `.env.example`，**程式碼完全未引用** | — |
