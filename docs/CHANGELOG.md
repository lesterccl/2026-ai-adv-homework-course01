# CHANGELOG

本專案的變更紀錄。格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

功能完成後把計畫從 `docs/plans/` 移到 `docs/plans/archive/`，並在這裡補一列。

---

## [Unreleased]

### 待辦

尚未開始的項目見 [plans/2026-09-02-backlog.md](./plans/2026-09-02-backlog.md)：

- B-1 後台修改訂單狀態（無寫入端點）
- B-2 登入時合併訪客購物車
- B-3 付款為本地模擬，`ECPAY_*` 環境變數未被引用
- B-4 `GET /api/auth/profile` 前端未使用
- B-5 測試覆蓋缺口 10 項（`/pay` 端點、SSR 路由零測試等）

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
