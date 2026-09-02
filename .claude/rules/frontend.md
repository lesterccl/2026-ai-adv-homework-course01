---
paths:
  - "views/**"
  - "public/js/**"
  - "public/css/**"
---

# 前端 / 模板規則

## 模板引擎（EJS）
- **沒有裝 layout 套件**。頁面用 `pageRoutes.js` 的 `renderFront()` / `renderAdmin()` 兩段式 render（先渲頁面成 `body` 字串，再塞進 layout）。新頁面照抄 helper，不要自己呼叫 `res.render`。
- 新頁面要三檔同步：`pageRoutes.js` 加 route（帶 `pageScript`）+ `views/pages/<name>.ejs` + `public/js/pages/<name>.js`。
- 後台頁另外要在 `views/partials/admin-sidebar.ejs` 補選單。

## XSS 防護
- **輸出使用者資料一律用 `<%= %>`（會跳脫）**。
- `<%- %>` 不跳脫，只准用在兩種地方：`include()` partial、以及 layout 注入已渲染的 `body`。**絕不用 `<%- %>` 輸出任何來自 DB 或請求的值。**
- 前端 JS 用 `innerHTML` 組字串時要格外小心（`header-init.js` 目前有此模式），使用者可控的值改用 `textContent`。

## Vue 3
- CDN 版、無打包器。一律 Composition API：`createApp({ setup() {...} }).mount('#app')`。不要用 Options API、不要用 SFC。
- **沒有模組系統**：不寫 `import`/`export`，也不寫 `window.X = ...`。頂層 `const Auth = {...}` 靠隱式全域暴露。
- script 載入順序固定：Vue → `auth.js` → `api.js` → `notification.js` → `header-init.js` → `pages/<pageScript>.js`。

## API 呼叫
- 一律用 `apiFetch(url, options)`，**不要直接 `fetch`**——它負責帶 `Authorization` 與 `X-Session-Id`、遇 401 自動清 token 導向 `/login`、非 2xx `throw { status, data }`。
- 呼叫端固定形狀：`try { await apiFetch(...) } catch (e) { Notification.show('...失敗', 'error') } finally { loading.value = false }`。

## Tailwind CSS v4
- 只用 utility class，不寫自訂 CSS 類別。
- 顏色一律用 `public/css/input.css` 的 `@theme` token（`rose-primary`、`rose-dark`、`cream`、`text-muted`…），**不要寫死 hex**。
- 新色票加進 `@theme` 後跑 `npm run css:build`。
- **`public/css/output.css` 是 build 產物且已 gitignore，絕不手改**——會被下次 build 覆蓋。

## 變數宣告
- 一律 `const`，需重新賦值才用 `let`，**禁用 `var`**（現存 6 處 `var` 在 `public/js/pages/*.js` 是技術債，不要模仿）。
- 回呼一律用箭頭函式（既有的具名 `function` 回呼是舊風格殘留）。
