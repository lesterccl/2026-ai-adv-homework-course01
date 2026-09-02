# 花漾生活 Flower Life

花卉電商 demo（hexschool 2026 AI 進階班作業）。Express 4 伺服器端渲染 + REST API，前端用 CDN 版 Vue 3 掛在 EJS 頁面上。

含完整的商品瀏覽、訪客/會員雙軌購物車、訂單建立與模擬付款、以及管理員後台。

---

## 技術棧

| 層 | 選用 | 版本 |
|---|---|---|
| 後端框架 | Express | `~4.16.1` |
| 樣板引擎 | EJS | `^5.0.1` |
| 資料庫 | better-sqlite3（同步 API、無 ORM） | `^12.8.0` |
| 認證 | jsonwebtoken（HS256）+ bcrypt | `^9.0.2` / `^6.0.0` |
| 前端 | Vue 3（CDN `vue.global.prod.js`，無打包器） | 3.x |
| 樣式 | Tailwind CSS v4（`@tailwindcss/cli`） | `^4.2.2` |
| 測試 | Vitest + supertest | `^2.1.9` / `^7.2.2` |
| API 文件 | swagger-jsdoc（只產 `openapi.json`，無 UI） | `^6.2.8` |

沒有 TypeScript、沒有 ESLint/Prettier、沒有前端打包器。唯一的 build step 是 Tailwind CLI。

---

## 快速開始

```bash
# 1. 安裝依賴（better-sqlite3 需要編譯 native binding，第一次會久一點）
npm install

# 2. 建立環境變數檔（缺 JWT_SECRET 時 server.js 會直接 exit(1)）
cp .env.example .env

# 3. 啟動（會先 build CSS 再起 server）
npm start

# 4. 開瀏覽器
open http://localhost:3001
```

首次啟動會自動建立 `database.sqlite`、寫入管理員帳號與 8 筆種子商品。

**預設管理員帳號**（來自 `.env.example`）：

```
admin@hexschool.com / 12345678
```

登入後 header 會出現「後台管理」連結，或直接開 <http://localhost:3001/admin/products>。

---

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm start` | build CSS 後啟動（port 3001，可用 `PORT` 覆蓋） |
| `npm run dev:server` | 只啟動 server（CSS 已 build 過時用這個） |
| `npm run dev:css` | Tailwind watch，改樣式時另開一個終端跑 |
| `npm run css:build` | 單次 build CSS |
| `npm test` | 跑全部測試（`vitest run`） |
| `npx vitest run tests/cart.test.js` | 跑單一測試檔 |
| `npx vitest run tests/cart.test.js -t "guest mode"` | 用名稱過濾單一測試 |
| `npm run openapi` | 掃 `src/routes/*.js` 的 `@openapi` JSDoc → 產出 `openapi.json` |

需要乾淨資料庫時：

```bash
rm -f database.sqlite database.sqlite-shm database.sqlite-wal
```

---

## 文件索引

| 文件 | 什麼時候讀 |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 判斷程式碼該放哪、模組怎麼互動、資料表關係、API 路由總覽 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | **寫任何程式碼前必讀**——風格、命名、錯誤處理、中文用語、計畫歸檔流程 |
| [FEATURES.md](./FEATURES.md) | 新增功能前確認現有狀態、查已知缺口 |
| [TESTING.md](./TESTING.md) | 寫或改測試 |
| [CHANGELOG.md](./CHANGELOG.md) | 查這個專案改過什麼 |
| [plans/README.md](./plans/README.md) | 開一件新工作、完成後回寫文件 |
| [agent/README.md](./agent/README.md) | AI agent 的作業制度：派工、驗收、熔斷條件 |

機器可讀的規則在 [`.claude/rules/`](../.claude/rules/)，會依檔案路徑自動套用。

---

## 專案結構速覽

```
app.js / server.js     Express 組裝 / 程序進入點
src/routes/            API 路由 6 檔 + 頁面路由 1 檔
src/middleware/        認證、session、admin 授權、錯誤處理
src/database.js        連線 + 建表 + 種子資料（side-effect import）
views/                 EJS 樣板（layouts / pages / partials）
public/                靜態檔：CDN Vue 的 page scripts、Tailwind CSS
tests/                 Vitest 測試（只打 /api/*）
docs/                  本資料夾
.claude/               AI agent 設定：權限、hooks、rules、agents、commands
```

完整說明見 [ARCHITECTURE.md §2](./ARCHITECTURE.md)。
