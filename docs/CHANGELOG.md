# CHANGELOG

本專案的變更紀錄。格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

功能完成後把計畫從 `docs/plans/` 移到 `docs/plans/archive/`，並在這裡補一列。

---

## [Unreleased]

### 待辦

尚未開始的項目見 [plans/2026-09-02-backlog.md](./plans/2026-09-02-backlog.md)：

- B-1 後台修改訂單狀態（無寫入端點）
- B-2 登入時合併訪客購物車
- ~~B-3 付款為本地模擬~~ — **已完成**，見下方 2026-09-02 綠界串接
- B-4 `GET /api/auth/profile` 前端未使用
- B-5 測試覆蓋缺口（付款端點已補齊，SSR 路由仍零測試）

---

## 2026-09-02 — 綠界（ECPay）金流串接

### Added

- `src/services/ecpay.js`：本專案第一個 service。CheckMacValue 產生/驗證（SHA256 + 綠界特有的 .NET URL encode）、AIO 表單參數組裝、MerchantTradeNo 產生、參數消毒。**零新增依賴**，只用 node 內建 `crypto`
- `src/routes/paymentRoutes.js`：綠界回調端點兩支，掛在 `/api/payments`，**不經 `authMiddleware`**
  - `POST /ecpay/callback`（ReturnURL，server-to-server）→ 驗簽 → 更新訂單 → 回純文字 `1|OK`
  - `POST /ecpay/result`（OrderResultURL，瀏覽器）→ 驗簽 → 302 導向 `/orders/:id?payment=...`
- `POST /api/orders/:id/payment`：產生綠界表單參數
- `public/js/ecpay.js`：`startEcpayPayment()`，動態組 hidden form 跳轉綠界（不可用 iframe）
- `tests/ecpay.test.js`（24 案例）+ `tests/payment.test.js`（17 案例）
- `tests/fixtures/ecpay-checkmacvalue.json`：綠界官方測試向量副本
- `orders` 新增四個金流欄位：`merchant_trade_no`(UNIQUE) / `ecpay_trade_no` / `payment_type` / `paid_at`

### Changed

- 結帳流程：建單成功後**直接跳轉綠界**，不再導回訂單頁
- 訂單詳情頁：`pending` 訂單顯示「前往付款」

### Removed

- **`PATCH /api/orders/:id/pay`**（模擬付款端點）與前端的「付款成功 / 付款失敗」按鈕。
  訂單狀態現在只能由綠界回調改變

### Security

依 security-auditor 獨立審查（高 1 / 中 1 / 低 4）修正：

- **[高] 移除正式環境的金鑰 fallback** — `getConfig()` 原本在缺 `ECPAY_HASH_KEY` 時回退到綠界公開測試金鑰，任何人都能據此偽造合法回調把訂單改成 `paid`。現在正式環境缺金鑰直接 throw
- **[中] 修正付款重試死鎖** — 每次發起付款都產生新的 `MerchantTradeNo`（沿用同一組會被綠界以 10100050 拒絕，付款頁逾時後必然發生）；`failed` 訂單可重新付款；舊交易編號的遲到回調靠 `CustomField1` 對回訂單
- **[低] 回調加驗 `MerchantID`**；驗簽失敗不再把未驗證輸入反射進導向網址；參數排序改用 ordinal 比較（`localeCompare` 依 locale 而定，換環境可能誤判合法回調）
- CheckMacValue 比對使用 `crypto.timingSafeEqual`
- 回調驗簽失敗、金額與訂單不符 → 一律拒絕且不更新狀態
- 回調冪等：重送不會重複入帳，仍回 `1|OK`
- `ItemName` / `TradeDesc` 過濾 HTML 標籤、控制字元與綠界 WAF 會攔截的系統指令字詞

---

## 2026-09-02

### Added — AI 輔助開發設定集

- `.claude/settings.json`：三層權限（allow / ask / deny）+ sandbox 網路白名單 + hooks 註冊
- `.claude/hooks/pretooluse_guard.py`：物理阻斷三類已知坑（`git add -A`、Read `package-lock.json`、改 `output.css`）
- `.claude/rules/`：6 類程式碼領域規則，依檔案路徑自動套用（API 設計、資料庫、測試、前端模板、Git commit、安全性）
- `.claude/agents/`：4 個專案 agent（程式碼審查、測試執行、安全審計、Git commit）
- `.claude/commands/`：`/plan-new`、`/verify` 兩個斜線指令
- `docs/agent/`：AI agent 作業制度（流程、派工、邊界、制度來源）

### Added — 專案文件

- `docs/README.md`：項目介紹、快速開始、常用指令、文件索引
- `docs/ARCHITECTURE.md`：技術棧、目錄結構、請求生命週期、API 路由總覽、資料庫 schema、雙軌認證架構
- `docs/DEVELOPMENT.md`：開發規範（風格、命名、回應合約、錯誤處理、中文用語）、環境變數表、計畫歸檔流程
- `docs/FEATURES.md`：17 項功能狀態總表與 5 項已查證缺口
- `docs/TESTING.md`：測試規範、斷言範本、10 項覆蓋缺口
- `docs/CHANGELOG.md`：本檔
- `docs/plans/`：工作卡工作流、範本、首次盤點的待辦清單
- `CLAUDE.md`：常駐路由中心

### Changed

- git remote 重新配置：`origin` 指向個人私庫（push 用），`upstream` 指向 hexschool 原始庫並停用其 push URL

### Verified

2026-09-03 於綠界測試環境完成真實信用卡交易（`TradeNo 2609031003504464`、NT$1,680）。
CheckMacValue 的產生與驗證皆對真實閘道生效。**唯一未驗證的是綠界主動回調的網路送達**——
本機隧道延遲超過綠界 10 秒上限，回調程式碼從未被觸發。詳見 `docs/FEATURES.md` §7.3。

### Notes

本日的變更**全部是文件與設定，未改動任何 `src/`、`tests/`、`views/`、`public/` 的程式碼**。

---

## 2026-09-02（初始）

### Added

自 `hexschool/2026-ai-adv-homework-course01` 取得的初始專案（commit `004e507`），已含：

- 認證：註冊、登入（註冊即登入）、取得個人資料
- 商品：分頁列表、詳情
- 購物車：訪客（`X-Session-Id`）與會員（JWT）雙軌
- 訂單：建立（交易內扣庫存並清空購物車）、列表、詳情、模擬付款
- 後台：商品 CRUD、訂單列表與詳情
- 前台頁面 7 條 + 後台頁面 2 條（EJS SSR + Vue 3）
- 測試：6 檔 32 個案例
