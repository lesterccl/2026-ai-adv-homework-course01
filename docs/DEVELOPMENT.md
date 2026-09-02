# DEVELOPMENT — 開發規範

> **產出任何程式碼前必讀。** 本檔的規則全部是從現有程式碼實地盤點歸納出來的事實，不是通用最佳實踐。
> 違反這些規則會產出「能跑但不像這個專案」的程式碼，也可能直接打破既有測試。
> 架構與檔案該放哪，見 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 1. 語言與模組系統

- 後端與前端**一律 CommonJS / 非模組腳本**：`require()`、`module.exports`。
- **唯一的 ESM 檔案是 `vitest.config.js`**（用 `import`/`export default`）。不要因為它就在其他地方寫 ESM。
- `public/js/` 完全沒有 `import`/`export`，靠 `<script src>` 依序載入 + 隱式全域變數（§10）。

---

## 2. 變數宣告

實測：`const` 256 處、`let` 4 處、`var` 6 處。

| 規則 | 說明 |
|---|---|
| 一律用 `const` | 這是絕對主流（約 97%） |
| 只有需要重新賦值才用 `let` | 後端僅 2 處，都是動態拼 SQL（`src/routes/adminOrderRoutes.js:89-90`） |
| **禁用 `var`** | `src/` 內零 `var`。現存 6 處全在 `public/js/pages/*.js` 的舊式回呼（`index.js:47,49`、`cart.js:35`、`product-detail.js:29,31`、`admin-orders.js:24`），屬技術債（§15），不要模仿 |

---

## 3. 函式風格（分場合，最容易寫錯的一項）

**沒有「統一用箭頭函式」或「統一用 function」這回事**，要看是哪一種函式：

| 場合 | 寫法 | 實例 |
|---|---|---|
| **API 路由 handler** | 箭頭函式 | `router.get('/', (req, res) => {...})` — `src/routes/productRoutes.js:72`，6 個 API 路由檔一致 |
| **頁面路由 handler** | 具名 `function` | `router.get('/', function (req, res) {...})` — `src/routes/pageRoutes.js:21-67`，7 處全部 |
| **middleware** | 具名 `function` 宣告 | `src/middleware/` 四個檔全部 |
| **輔助函式** | 具名 `function` 宣告 | `src/routes/cartRoutes.js:9,48`、`orderRoutes.js:10`、`src/database.js:13,76,90` |
| **陣列方法內的回呼** | 箭頭函式 | `cartItems.filter(item => ...)` — `orderRoutes.js:119` |

寫 API 路由就用箭頭；寫其他任何東西就用具名 `function`。

---

## 4. 命名規則

### 4.1 JS 識別字

一律 camelCase，無例外。

### 4.2 資料庫欄位

一律 snake_case：`password_hash`、`image_url`、`total_amount`、`order_no`、`created_at`（`src/database.js:14-66`）。

### 4.3 API JSON 欄位 —— 最重要的一條

**回應直接沿用資料庫的 snake_case，沒有任何轉換層。**

```js
// productRoutes.js:78 — SELECT * 的結果原封不動放進 data
const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
```

即使是手動組裝的物件也刻意保留 snake_case（`cartRoutes.js:116-125` 的 `product_id`、`image_url`）。

唯一的 camelCase 是**框架層的固定鍵**：`data` / `error` / `message` / `pagination.totalPages`。

> **不要自作主張把回應轉成 camelCase。** 既有測試斷言的是 snake_case，轉了會全紅。

**請求 body 的命名目前不一致**（技術債，§15）——照抄該端點既有的欄位名，不要自行統一：

| 端點 | body 欄位 |
|---|---|
| `POST /api/orders` | `recipientName`、`recipientEmail`、`recipientAddress`（camelCase） |
| `POST /api/cart` | `productId`、`quantity`（camelCase） |
| `POST/PUT /api/admin/products` | `name`、`description`、`price`、`stock`、**`image_url`**（snake_case） |

### 4.4 檔案與變數命名

| 對象 | 規則 | 例外 |
|---|---|---|
| 路由檔 | `xxxRoutes.js` | 無（7/7） |
| middleware 檔 | `xxxMiddleware.js` | `errorHandler.js`（3/4） |
| 前端頁面腳本 | kebab-case：`admin-orders.js`、`order-detail.js` | 無 |
| EJS 頁面 | kebab-case：`product-detail.ejs` | 無 |
| 路由檔 export 的變數 | **一律叫 `router`** | 無（7/7） |

---

## 5. API 回應合約

所有 API 回應都是同一個三欄物件，**成功與失敗都一樣**：

```js
{ data: <payload|null>, error: <null|'ERROR_CODE'>, message: '中文訊息' }
```

- 成功：`data` 有值、`error` 必為 `null`
- 失敗：`data` 必為 `null`、`error` 為錯誤碼字串

列表要再包一層命名 key，不要直接把陣列丟進 `data`：

```js
res.json({ data: { products: [...], pagination: {...} }, error: null, message: '成功' });
```

### 分頁

有分頁的端點：`GET /api/products`、`GET /api/admin/products`、`GET /api/admin/orders`。

```js
const page = Math.max(1, parseInt(req.query.page) || 1);
const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
const offset = (page - 1) * limit;
// …
pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
```

新增列表端點時照抄這三行 clamp 邏輯。

> `GET /api/orders`（使用者自己的訂單）目前**沒有**分頁，回傳全部。

---

## 6. 錯誤處理模式

### 6.1 路由內：早期回傳，不 throw

實測 44 處失敗回應**清一色**是這個形狀，**零 `throw`、零 `next(err)`**：

```js
if (!product) {
  return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '商品不存在' });
}
```

- `next()` 只出現 5 處，全部是無參數放行（middleware 用）。
- `try/catch` 只有 2 處，且都只包 `jwt.verify`（`src/middleware/authMiddleware.js:15-39`、`src/routes/cartRoutes.js:13-34`）。

**不要在路由裡 throw 自訂錯誤、不要包 `try/catch` 兜全部**——better-sqlite3 是同步的，沒有 promise rejection 要接。

### 6.2 errorHandler 是兜底

`src/middleware/errorHandler.js` 只接住未預期的同步例外。它對 500 一律回固定的「伺服器內部錯誤」，只有 `err.isOperational === true` 才把 `err.message` 透出去。實務上路由從不主動觸發它。

### 6.3 ERROR_CODE 與 HTTP status 對照

實測完全一致、無錯亂案例。新增錯誤時沿用既有代碼，不要發明同義新碼。

| HTTP | ERROR_CODE | 現有處數 | 用在 |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | 16 | 欄位缺漏／格式錯誤 |
| 400 | `STOCK_INSUFFICIENT` | 4 | 庫存不足 |
| 400 | `CART_EMPTY` | 1 | 購物車為空時建單 |
| 400 | `INVALID_STATUS` | 1 | 訂單狀態不允許此操作 |
| 401 | `UNAUTHORIZED` | 8 | 未登入／token 無效／使用者不存在 |
| 403 | `FORBIDDEN` | 1 | 已登入但非 admin |
| 404 | `NOT_FOUND` | 11 | 資源不存在（含 API 路徑不存在） |
| 409 | `CONFLICT` | 2 | Email 重複、商品有未完成訂單不可刪 |
| 500 | `INTERNAL_ERROR` | 1 | 僅 `errorHandler.js:21-25` |

---

## 7. 驗證（validation）

**沒有安裝任何驗證套件**（無 joi / zod / express-validator）。一律手寫 `if` + 早期回傳，寫在 handler 最上方。

代表性寫法（`src/routes/authRoutes.js:69-90`）：

```js
if (!email || !password || !name) {
  return res.status(400).json({ data: null, error: 'VALIDATION_ERROR',
    message: 'email、password、name 為必填欄位' });
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) { /* 400 VALIDATION_ERROR */ }
if (password.length < 6) { /* 400 VALIDATION_ERROR */ }
```

數值檢查用 `Number.isInteger()` + 範圍（`adminProductRoutes.js:176-183`）：

```js
if (price === undefined || price === null || !Number.isInteger(price) || price <= 0) { /* 400 */ }
```

**不要為了「比較乾淨」而引入驗證套件**，那是架構決策，要先跟 user 確認。

---

## 8. 資料庫存取

- better-sqlite3 是**同步**的：`db.prepare(sql).get()` / `.all()` / `.run()`。不要加 `await`。
- 參數一律用 `?` 佔位符，**絕不字串拼接使用者輸入**。動態條件的寫法見 `adminOrderRoutes.js:89-95`（拼的是固定字串片段，值仍走 `?`）。
- 多筆寫入包 `db.transaction(() => {...})`，範例：`orderRoutes.js:136-156`。
- 取單筆用 `.get()`、多筆用 `.all()`、寫入用 `.run()`。

---

## 9. OpenAPI JSDoc 義務

路由檔 1893 行中有 1043 行（55%）是 `@openapi` 註解。18 個 API 路由對應 18 個區塊，**1:1，一個都不缺**，且一律緊貼在 `router.METHOD` 正上方、中間無空行。

```js
/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: 商品列表
 *     tags: [Products]
 *     ...
 */
router.get('/', (req, res) => {
```

**規則：改動 API 的路徑、參數、回應形狀或狀態碼時，必須同步更新正上方的 JSDoc。** 沒有 Swagger UI、也沒有任何測試會抓到不一致，漂移了不會有人發現。

`pageRoutes.js` 是頁面路由，不需要 JSDoc。

---

## 10. 前端慣例（`public/js/`）

### 10.1 Vue

一律 Composition API，9/9 頁面腳本同一個形狀：

```js
const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const items = ref([]);
    const loading = ref(true);
    // …
    return { items, loading };
  }
}).mount('#app');
```

不要用 Options API、不要用 SFC（沒有打包器）。

### 10.2 全域變數

`auth.js`、`api.js`、`notification.js` 在頂層宣告 `const Auth = {...}`、`function apiFetch`、`const Notification = {...}`，靠非 module script 的隱式全域暴露。**不要寫 `window.Auth = ...`**，也不要加 `export`。

載入順序固定（`views/layouts/front.ejs:12-18`）：Vue → `auth.js` → `api.js` → `notification.js` → `header-init.js` → `pages/<pageScript>.js`。

### 10.3 apiFetch

一律用 `apiFetch(url, options)` 打 API，不要直接 `fetch`——它負責帶 `Authorization` 與 `X-Session-Id`、遇 401 自動清 token 導向 `/login`、非 2xx `throw { status, data }`。

呼叫端的固定形狀：

```js
async function loadCart() {
  loading.value = true;
  try {
    const res = await apiFetch('/api/cart');
    items.value = res.data.items;
  } catch (e) {
    Notification.show('載入失敗', 'error');
  } finally {
    loading.value = false;
  }
}
```

---

## 11. 中文用語規範

實測歸納，全部有例外零容忍的一致性：

| 規則 | 說明 |
|---|---|
| **API `message` 一律不加句號** | 0 筆以「。」結尾 |
| 成功句型 | 「N成功」或單純「成功」：`登入成功`、`註冊成功`、`訂單建立成功`、`商品新增成功`；列表類固定用 `成功` |
| 錯誤句型 | 直述句：`商品不存在`、`庫存不足`、`Email 或密碼錯誤`、`email、password、name 為必填欄位`、`price 必須為正整數` |
| 欄位名在訊息中保留原文 | 寫 `price 必須為正整數`，不寫「價格必須為正整數」 |
| **API `message` 不用「您/你」** | 完全沒有人稱 |
| 前端顯示文案**才可以**用「您」 | 僅出現在 `public/js/pages/order-detail.js:22`、`views/pages/404.ejs:5`、`views/pages/index.ejs:10,71,86` |

這條人稱分界要守住：**伺服器回的訊息中性直述，畫面上給人看的文案才客氣。**

---

## 12. 格式

- 縮排 2 空格
- **單引號**（`src/` 內找不到用於一般程式碼的雙引號）
- 一律加分號
- `function` 關鍵字後留一個空格：`function () {}`（13/14 處；唯一例外 `views/layouts/admin.ejs:20`）
- EJS 內嵌的 `<script>` 維持同樣的縮排與引號慣例

---

## 13. 註解

- **不寫說明性註解。** 程式邏輯幾乎沒有行內註解，僅 `errorHandler.js:16`、`cartRoutes.js:7,25` 等少數處，用來標示「為什麼這樣做」而非「這行在做什麼」。
- 不寫函式的 JSDoc 型別註解。唯一的例外是 `tests/setup.js` 的兩個 helper（有簡短說明用 JSDoc）。
- `@openapi` 區塊不算註解，是必要產物（§9）。

---

## 14. Tailwind

- 只用 utility class，不寫自訂 CSS 類別（`public/stylesheets/style.css` 幾乎未使用）。
- 顏色一律用 `public/css/input.css` 的 `@theme` token：`rose-primary`、`rose-dark`、`rose-light`、`apricot`、`sage`、`cream`、`blush`、`rose-bg`、`text-primary`、`text-secondary`、`text-muted`。**不要寫死 hex**。
- 需要新色票就加進 `@theme`，然後 `npm run css:build`。

---

## 15. 已知技術債

以下是盤點時發現的問題。**列在這裡是為了讓你知道「這是缺陷不是典範」，不要複製它們；但也不要順手重構——那是 user 的決策。**

| 項目 | 現況 | 風險 |
|---|---|---|
| DB 欄位無轉換層 | snake_case 直接進 API JSON，與框架層的 camelCase 並存 | 命名不一致；欄位改名會直接洩漏到 API |
| 請求 body 命名不一致 | 訂單/購物車用 camelCase，後台商品用 `image_url` | 呼叫端容易寫錯；見 §4.3 |
| 無驗證層 | 每個 handler 手寫 if，規則重複 | email regex 在多處各寫一份，改動易漏 |
| 前端殘留 `var` | `public/js/pages/*.js` 6 處 | 與 §2 規範不符 |
| 前端回呼風格混用 | 具名 `function` 與箭頭並存且無準則（`cart.js:35` vs `cart.js:16`） | 新碼無所適從——請一律用箭頭 |
| `admin.ejs:20` 的 `function() {` | 唯一一處 `function` 後無空格 | 純格式瑕疵 |
| SQL 寫在路由 handler 內 | 無 service/repository 層 | 邏輯無法跨路由重用；目前規模尚可接受 |

要動其中任何一項，先開一份 [plans/](./plans/) 計劃並取得 user 同意。

---

## 16. 提交前自檢

- [ ] 改動的路徑實際跑過（`npm test` 或啟動服務打過該端點）
- [ ] 新增/修改 API → 正上方的 `@openapi` 區塊已同步
- [ ] 回應形狀符合 §5，錯誤碼取自 §6.3 既有清單
- [ ] `message` 符合 §11（無句號、無「您」）
- [ ] 沒有殘留 `console.log`、TODO、註解掉的舊碼
- [ ] `git status` 沒有意外檔案（特別是 `database.sqlite*`、`public/css/output.css` 應該被 ignore）
- [ ] 對照 [FEATURES.md](./FEATURES.md) 更新功能狀態；有新測試則更新 [TESTING.md](./TESTING.md)

---

## 17. 新增東西的步驟

| 要做的事 | 步驟 |
|---|---|
| **新增 API 端點** | ① 在對應的 `src/routes/xxxRoutes.js` 加 handler（箭頭函式）② 正上方緊貼補 `@openapi` 區塊 ③ `tests/xxx.test.js` 補測試 ④ `npm run openapi` 確認產得出來 |
| **新增整組 API 資源** | ① 新建 `src/routes/xxxRoutes.js`，`const router = express.Router()` ② 在 `app.js` 的 API 區塊 `app.use('/api/xxx', require('./src/routes/xxxRoutes'))`（**務必在 404 handler 之前**）③ 新建 `tests/xxx.test.js` ④ **把新測試檔加進 `vitest.config.js` 的 `sequence.files`** |
| **新增 middleware** | ① 新建 `src/middleware/xxxMiddleware.js`，用具名 `function` 宣告、`module.exports = xxxMiddleware` ② 全域的掛在 `app.js`；單一路由群組的用 `router.use()` ③ 需要 `req.user` 的必須掛在 `authMiddleware` 之後 |
| **新增資料表 / 欄位** | ① 改 `src/database.js` 的 `initializeDatabase()`（`CREATE TABLE IF NOT EXISTS`、加 CHECK 約束）② **刪 DB 重建**：`rm -f database.sqlite database.sqlite-shm database.sqlite-wal` ③ 沒有 migration 機制，既有 DB 不會自動更新 |
| **新增前台頁面** | 三檔同步：`pageRoutes.js` 加 route（用 `renderFront()`、帶 `pageScript`）＋ `views/pages/<name>.ejs` ＋ `public/js/pages/<name>.js` |
| **新增後台頁面** | 同上但用 `renderAdmin()`、樣板放 `views/pages/admin/`，並在 `views/partials/admin-sidebar.ejs` 補選單 |
| **新增色票 / 樣式 token** | 改 `public/css/input.css` 的 `@theme`，然後 `npm run css:build`。**不要改 `output.css`** |
| **跨路由共用的商業邏輯** | **目前沒有 `services/` 層**。單一路由檔內用區域 `function`（如 `cartRoutes.js` 的 `dualAuth`）；真要跨檔共用再新建 `src/services/` —— 屬架構決策，先跟 user 確認 |

---

## 18. 環境變數

`.env`（由 `.env.example` 複製）在 `app.js:1` 經 `dotenv` 載入。

| 變數 | 用途 | 必要性 | 預設值 |
|---|---|---|---|
| `JWT_SECRET` | 簽發／驗證 JWT | **必要** | 無 —— 缺少時 `server.js:7` 直接 `process.exit(1)` |
| `PORT` | 監聽埠 | 選填 | `3001` |
| `FRONTEND_URL` | CORS 允許來源 | 選填 | `http://localhost:3001` |
| `ADMIN_EMAIL` | 種子管理員帳號 | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 種子管理員密碼 | 選填 | `12345678` |
| `NODE_ENV` | 設為 `test` 時 bcrypt saltRounds 降為 1 加速測試 | 選填 | 未設（saltRounds = 10） |
| `BASE_URL` | 宣告於 `.env.example`，**程式碼未引用** | 無作用 | — |
| `ECPAY_MERCHANT_ID` / `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` / `ECPAY_ENV` | 宣告於 `.env.example`，**程式碼完全未引用**（付款是本地模擬） | 無作用 | — |

`.env` 已 gitignore 並列入 `.claude/settings.json` 的 deny 規則，**agent 讀不到也寫不了**。需要知道有哪些變數請讀 `.env.example`。

---

## 19. 計畫歸檔流程

功能開發一律先在 `docs/plans/` 開一份計畫，完成後歸檔。

1. **命名格式**：`YYYY-MM-DD-<feature-name>.md`（kebab-case），例如 `2026-09-10-admin-order-status.md`。可用 `/plan-new <slug>` 指令自動產生。
2. **文件結構**：**User Story → Spec → Tasks**，範本見 [`docs/plans/TEMPLATE.md`](./plans/TEMPLATE.md)。
3. **功能完成後**：把計畫檔移至 `docs/plans/archive/`
   ```bash
   git mv docs/plans/2026-09-10-admin-order-status.md docs/plans/archive/
   ```
4. **更新** [`docs/FEATURES.md`](./FEATURES.md)（功能狀態總表與缺口清單）**和** [`docs/CHANGELOG.md`](./CHANGELOG.md)（在 `[Unreleased]` 或當日日期下補一列）。

架構有變動就同步更新 `ARCHITECTURE.md`；建立了新慣例就更新本檔；新增測試就更新 `TESTING.md`。完整對照表見 [`docs/plans/README.md`](./plans/README.md)。
