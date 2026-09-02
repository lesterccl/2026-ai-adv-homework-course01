# 安全性規則

## 輸入驗證
- 每個接受輸入的 handler 最上方手寫 `if` 檢查後早期回傳（本專案不用驗證套件）。
- 必查：必填欄位存在、email 用 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`、數值用 `Number.isInteger()` + 範圍、密碼長度 ≥ 6。
- 數量、價格等數值**不要信任前端**，後端一律重新驗證與重新計算（訂單總額由後端從 DB 價格算，不取請求 body 的金額）。

## SQL Injection
- 一律用 better-sqlite3 的 `?` 佔位符，**絕不字串拼接使用者輸入**。
- 動態 SQL 只拼固定片段（如 `' WHERE status = ?'`），值永遠走參數。
- 使用者可控的字串**絕不**進入 `db.exec()`。

## XSS
- EJS 輸出使用者資料一律 `<%= %>`；`<%- %>` 只准用於 include 與 layout body 注入。
- 前端組 HTML 時，使用者可控的值用 `textContent` 而非 `innerHTML`。

## 密碼與憑證
- 密碼一律 `bcrypt` hash 後存 `password_hash`，**絕不存明文、絕不回傳給前端**。
- 登入失敗訊息不區分「帳號不存在」與「密碼錯誤」，統一回「Email 或密碼錯誤」（避免帳號枚舉）。
- `JWT_SECRET` 只從環境變數讀，**絕不寫死在程式碼裡**；`server.js` 在缺少時直接 `exit(1)`。
- JWT 驗簽必須指定 `{ algorithms: ['HS256'] }`，防止 alg 混淆攻擊。
- 驗簽通過後**還要查 DB 確認使用者仍存在**（既有 `authMiddleware` 已如此）。

## 授權
- 前端的 `Auth.requireAdmin()` 只是 UX，**真正的授權一律在伺服器端**的 `adminMiddleware`。
- `adminMiddleware` 必須掛在 `authMiddleware` 之後。
- 查詢使用者自己的資源時，SQL 條件要同時帶 `user_id`（例如 `WHERE id = ? AND user_id = ?`），避免 IDOR 越權讀取他人訂單。

## 錯誤訊息
- 500 一律回固定的「伺服器內部錯誤」，**不要把例外訊息或堆疊透給前端**（`errorHandler.js` 已如此）。
- 只有 `err.isOperational === true` 才透出 `err.message`。

## CORS
- `cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3001' })`，**不要改成 `origin: '*'`**。
- 要新增允許來源改環境變數，不要放寬程式碼。

## 機密資料
- `.env` 不進版控（已 gitignore、已設 deny 規則）。
- `.env.example` 只放佔位值與非機密預設，**不要把真實金鑰寫進去**。
