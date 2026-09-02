> 狀態：未開始

# <一句話標題>

## User Story

> 身為 **<角色>**，我想要 **<做到什麼>**，以便 **<獲得什麼價值>**。

例：身為**管理員**，我想要**修改訂單的狀態**，以便**在客戶改用匯款或申請退款時，把訂單調回正確狀態**。

### 背景

為什麼現在要做這件事。已知線索：相關檔案路徑、已確認的事實、之前試過什麼。

寫給一個沒讀過這段對話的人看——AI agent 每次都是全新 context，**你沒寫的它不知道**。

---

## Spec

### 行為規格

| 項目 | 內容 |
|---|---|
| API 端點 | `<METHOD> /api/...` |
| 認證 | 公開 / JWT / JWT + admin / dualAuth |
| 請求 body | 欄位、必填或選填、型別 |
| 成功回應 | status + `{ data, error: null, message }` 的實際形狀 |
| 錯誤情境 | 條件 → status + ERROR_CODE + message |
| 前端 | 頁面路由 + `.ejs` + page script，或「無前端」 |

### 改動範圍（白名單）

預期只動這些檔案：

- `src/routes/xxxRoutes.js`
- `tests/xxx.test.js`

**要動範圍外的檔案 → 停下來更新這份計畫並說明原因，不要先斬後奏。**

### 不做的事（Non-goals）

- 不重構未提及的模組
- 不改既有測試的斷言讓自己過
- 不引入新的 npm 依賴
- 不 commit / push（除非本卡明示）
- 例：不處理 XXX，那是另一張卡

---

## Tasks

- [ ] T1 — <可獨立驗證的最小步驟>
- [ ] T2 — 補 `@openapi` JSDoc 區塊
- [ ] T3 — 補測試，並加進 `vitest.config.js` 的 `sequence.files`（若是新檔）
- [ ] T4 — 回寫文件（見下方「回寫」）

### 驗收條件

每條都要能用命令或肉眼逐條檢查，**禁止「做好做完整」這種寫不成檢核表的字眼**。

- [ ] `npm test` **連跑兩次都綠**
- [ ] `npm run openapi` 正常產出
- [ ] `curl -s -o /dev/null -w "%{http_code}" localhost:3001/api/xxx` 回 200
- [ ] 既有功能抽查未破壞：<具體指定一項>

---

## 驗證結果

> 開發完成後填。每條驗收條件對應實際跑過的命令與輸出摘要。
> 沒有可貼出的證據 = 未完成，不要寫「應該可以了」。

| 驗收條件 | 結果 | 證據 |
|---|---|---|
| | | |

## 回寫

> 完成後依 [README.md](./README.md) 的對照表勾選，沒有要更新的寫「無」。

- [ ] `docs/FEATURES.md` — 功能狀態
- [ ] `docs/CHANGELOG.md` — 變更紀錄
- [ ] `docs/ARCHITECTURE.md` — 結構變動
- [ ] `docs/DEVELOPMENT.md` — 新慣例
- [ ] `docs/TESTING.md` — 新測試
- [ ] 本檔移至 `docs/plans/archive/`

## 未盡事項 / 風險

沒有就寫「無」。
