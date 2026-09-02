# TESTING — 測試規範

> 寫測試前必讀。本專案的測試有一個**非典型的架構約束**（§2），不了解就會寫出隨機失敗的測試。

技術棧：vitest `^2.1.9` + supertest `^7.2.2`。設定檔 `vitest.config.js`（`globals: true`，所以 `describe`/`it`/`expect` 不需 import）。

---

## 1. 執行

```bash
npm test                                          # 全部（vitest run，非 watch）
npx vitest run tests/cart.test.js                 # 單一檔案
npx vitest run tests/cart.test.js -t "guest mode" # 用測試名稱過濾
npx vitest                                        # watch 模式（設定檔沒設，但 CLI 可用）
```

前置條件：`.env` 存在且有 `JWT_SECRET`。測試 `require('../app')` 而非 `server.js`，所以不會真的 listen，但 `app.js` 的 `dotenv` 載入仍需要 `.env`。

---

## 2. 關鍵約束：測試共用開發資料庫（最重要的一節）

**測試跑在跟開發同一顆 `database.sqlite` 上，沒有 fixture 隔離，也沒有任何清庫機制。**

`src/database.js` 是 side-effect import，`require('../app')` 就會連上專案根目錄那顆 DB。測試寫進去的資料**會留下來**，下次跑測試時還在。

這造成三個必然的後果，`vitest.config.js` 全部針對它們做了設定：

| 後果 | 設定 |
|---|---|
| 多檔平行跑會互相污染 | `fileParallelism: false` — 一次只跑一個檔案 |
| 檔案執行順序會影響結果 | `sequence.files` 寫死六個檔案的順序 |
| 首次跑要建表 + 種子，較慢 | `hookTimeout: 10000` |

寫死的順序是：

```
auth → products → cart → orders → adminProducts → adminOrders
```

### 因此你必須

- ❌ **不要**把 `fileParallelism` 改回 `true`，也不要拿掉 `sequence.files`。看起來只是「讓測試快一點」，實際上會讓測試隨機失敗。
- ❌ **不要**用固定的 email / 商品名稱等唯一值——第二次跑就會撞 409。
- ✅ 新增測試檔時，**必須把檔名加進 `vitest.config.js` 的 `sequence.files`**，否則它的執行順序不受控。
- ✅ 假設 DB 裡已經有前次執行留下的資料。斷言「列表長度剛好是 N」這種寫法必壞，改用 `toBeGreaterThan(0)`。
- ✅ 需要乾淨環境時，手動刪檔重建：
  ```bash
  rm -f database.sqlite database.sqlite-shm database.sqlite-wal && npm test
  ```

---

## 3. 現況

6 個檔案、32 個 `it`：

| 檔案 | describe | 案例數 |
|---|---|---|
| `tests/auth.test.js` | `Auth API` | 6 |
| `tests/products.test.js` | `Products API` | 4 |
| `tests/cart.test.js` | `Cart API` | 6 |
| `tests/orders.test.js` | `Orders API` | 6 |
| `tests/adminProducts.test.js` | `Admin Products API` | 6 |
| `tests/adminOrders.test.js` | `Admin Orders API` | 4 |

失敗路徑已有覆蓋：401（`auth.test.js:75`、`orders.test.js:64`）、403（`adminProducts.test.js:74`、`adminOrders.test.js:74`）、404（`products.test.js:42`、`cart.test.js:88`、`orders.test.js:105`）、409（重複 email）、400（空購物車 `orders.test.js:48`）。

---

## 4. 命名與結構慣例

- 一個模組一個檔案，一個 `describe`，標題格式 `'<Module> API'`。
- 測試名稱**全英文**，一律 `should ...` 句型：
  - `should register a new user successfully`（`auth.test.js:7`）
  - `should fail login with wrong password`（`auth.test.js:49`）
  - `should add product to cart (guest mode)`（`cart.test.js:15`）
  - `should deny access to regular user`（`adminProducts.test.js:74`）
  - `should return 404 for non-existent product`（`products.test.js:42`）
- 括號補充情境：`(guest mode)` / `(authenticated mode)`。
- **測試檔內不寫中文**（與 API message 的中文相反）。

### 狀態傳遞

用 `describe` 內的外層 `let` 變數跨 `it` 傳遞，**測試之間有順序依賴**：

```js
describe('Products API', () => {
  let productId;

  it('should get product list', async () => {
    const res = await request(app).get('/api/products');
    productId = res.body.data.products[0].id;   // 給下一個 it 用
  });

  it('should get product detail by id', async () => {
    const res = await request(app).get(`/api/products/${productId}`);
  });
});
```

`beforeAll` 用來準備跨測試共用的憑證與資料，共 4 處（`cart.test.js:9`、`orders.test.js:8`、`adminProducts.test.js:7`、`adminOrders.test.js:7`）。

**全專案零 `beforeEach`**——因為沒有可以重置的狀態。

---

## 5. helper

`tests/setup.js` 匯出四樣東西：`app`、`request`、`getAdminToken`、`registerUser`。

```js
const { app, request, getAdminToken, registerUser } = require('./setup');
```

| helper | 回傳 | 用途 |
|---|---|---|
| `getAdminToken()` | `token` 字串 | 用種子 admin 帳號登入。用於 `adminProducts.test.js:8`、`adminOrders.test.js:8` |
| `registerUser(overrides?)` | `{ token, user }` | 註冊新使用者。**預設 email 帶時間戳 + 亂數**，天然避開重複。用於 `cart` / `orders` / `adminProducts` / `adminOrders` |

`auth.test.js`、`products.test.js` 不用 helper，直接打 API——因為它們測的就是這些 API 本身。

**新測試需要使用者時一律用 `registerUser()`，不要自己寫 email 字面值。**

---

## 6. 斷言範本

### 成功回應

```js
const res = await request(app).get('/api/products');

expect(res.status).toBe(200);
expect(res.body).toHaveProperty('data');
expect(res.body).toHaveProperty('error', null);
expect(res.body).toHaveProperty('message');
expect(res.body.data).toHaveProperty('products');
expect(Array.isArray(res.body.data.products)).toBe(true);
expect(res.body.data.products.length).toBeGreaterThan(0);
```

### 失敗回應

```js
const res = await request(app).get('/api/products/non-existent-id');

expect(res.status).toBe(404);
expect(res.body).toHaveProperty('data', null);
expect(res.body).toHaveProperty('error');
expect(res.body.error).not.toBeNull();
```

**不要斷言 `message` 的中文字串內容**——既有測試只斷言欄位存在，文案改動不該弄壞測試。

### 分頁回應

```js
const res = await request(app).get('/api/products?page=1&limit=2');

expect(res.status).toBe(200);
expect(res.body.data.pagination.page).toBe(1);
expect(res.body.data.pagination.limit).toBe(2);
expect(res.body.data.products.length).toBeLessThanOrEqual(2);
```

### 帶身分的請求

```js
// JWT
await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);

// 訪客 session
await request(app).post('/api/cart').set('X-Session-Id', sessionId).send({ productId, quantity: 1 });
```

### 常用 matcher

`toBe`、`toHaveProperty`、`toBeGreaterThan`、`toBeLessThanOrEqual`、`not.toBeNull`。沒有用到 snapshot、mock、spy——**專案沒有任何 mock，全部打真實的 app 與真實的 DB**。

---

## 7. 新增測試的檢查清單

- [ ] 檔名 `tests/<module>.test.js`，`describe('<Module> API')`
- [ ] 測試名稱英文 `should ...`
- [ ] 需要使用者 → 用 `registerUser()`；需要 admin → 用 `getAdminToken()`
- [ ] 沒有寫死的唯一值（email、商品名…）
- [ ] 沒有假設 DB 是空的（不斷言絕對筆數）
- [ ] **新檔案已加進 `vitest.config.js` 的 `sequence.files`**
- [ ] 三欄回應格式照 §6 斷言，不斷言中文文案
- [ ] `npm test` 連跑兩次都綠（第二次會踩到殘留資料，這是真正的驗收）

---

## 8. 測試缺口

以下行為已實作但**完全沒有測試**。要補測試的話從這裡挑，補完回來把該列劃掉。

| # | 缺口 | 位置 |
|---|---|---|
| 1 | `PATCH /api/orders/:id/pay` **整支端點零測試**（`success` / `fail` 兩種 action、非 pending 的 400 `INVALID_STATUS`、他人訂單的 404 全都沒測） | `orderRoutes.js:379-415` |
| 2 | 建立訂單時的庫存不足分支 | `orderRoutes.js:119-127` |
| 3 | 加入購物車時的庫存不足（`STOCK_INSUFFICIENT`） | `cartRoutes.js` |
| 4 | 購物車 PATCH / DELETE 對不存在的 item 回 404 | `cartRoutes.js:291,356` |
| 5 | 後台商品的欄位驗證 400 分支（`price` 非正整數、`stock` 負數等） | `adminProductRoutes.js:176-183` |
| 6 | 後台商品刪除的 409 `CONFLICT`（商品有未完成訂單） | `adminProductRoutes.js:350-360` |
| 7 | 分頁邊界：`limit > 100` 的 clamp、`page` < 1 的 clamp | `productRoutes.js:73-74` |
| 8 | `pageRoutes.js` 的 **9 條 SSR 路由完全沒測**——EJS 樣板錯誤不會被任何測試抓到 | `pageRoutes.js:21-73` |
| 9 | `dualAuth` 的兩個 401 分支：token 有效但使用者已被刪除、token 格式錯誤 | `cartRoutes.js:17-34` |
| 10 | `authMiddleware` / `adminMiddleware` 對非 `Bearer ` 前綴的 malformed header | `authMiddleware.js:6-12` |

第 8 項最值得優先補——SSR 頁面目前完全沒有安全網，改動 layout 或 partial 只能靠手動開瀏覽器才會發現壞掉。
