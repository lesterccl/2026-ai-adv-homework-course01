# workflow — 一件工作的完整流程

> 適用於所有非瑣碎的改動。「改一個錯字」「回答一個問題」不需要走完整流程。

---

## 六步

### ① 開卡

複製 [`docs/plans/TEMPLATE.md`](../plans/TEMPLATE.md) → `docs/plans/YYYY-MM-DD-<slug>.md`，填完**目標 / 改動範圍白名單 / 驗收條件 / Non-goals** 才動手。

或直接用 `/plan-new <slug>` 斜線指令。

**驗收條件必須可檢查。** 「做好做完整」不是驗收條件；「`npm test` 全綠」「`curl` 回 200」才是。寫不出可檢查的驗收條件 → 這件事屬於品味/商業判斷，見 [boundaries.md](./boundaries.md) §3。

### ② 載入脈絡

依 `CLAUDE.md` 的路由表載入需要的 `docs/`。**要寫程式碼就一定要先讀 [`docs/DEVELOPMENT.md`](../DEVELOPMENT.md)**——這個 repo 的風格有多處反直覺（API 路由用箭頭但頁面路由用 `function`、回應欄位保持 snake_case 不轉 camelCase），憑常識寫必然不符。

### ③ 實作

只動白名單內的檔案。**要動範圍外的檔案 → 停下來回報並更新計劃，不要先斬後奏。**

### ④ 機器驗收

| 改動類型 | 必跑 |
|---|---|
| 任何後端改動 | `npm test`（**連跑兩次都要綠**，第二次才會踩到 DB 殘留資料） |
| 新增/改動 API | 上面 + `npm run openapi` 可正常產出 |
| 前端/樣式改動 | `npm run css:build` + 啟動 server + 相關路由 `curl` 回 200 |
| 改 schema | 先 `rm -f database.sqlite database.sqlite-shm database.sqlite-wal` 再跑測試 |

### ⑤ 隔離驗收

**實作者不得自我驗收。** 見 [delegation.md](./delegation.md) §3。輕量豁免：單檔 ≤ 10 行的小改動，可自行 read-back + 跑一次驗證命令。

### ⑥ 回寫

依 [`docs/plans/README.md`](../plans/README.md) 的對照表，把成果同步回 `docs/`。沒有要更新的就在計劃檔寫「無」，不要留空。

計劃檔頂端狀態改成「完成（YYYY-MM-DD）」，**保留不刪**——它是開發紀錄。

---

## Definition of Done

宣告完成前逐條打勾。**任何一條沒有「可貼出的證據」= 未完成，不准說「應該可以了」。**

- [ ] 改動路徑實際執行過（不是語法檢查過，是真的跑了會經過改動代碼的那條路）
- [ ] 驗收條件逐條對應到具體輸出
- [ ] 既有功能抽查未破壞
- [ ] 無殘留：TODO / debug print / 註解掉的舊碼 / `git status` 的意外檔案
- [ ] 回報如實：失敗的明說失敗，跳過的明說跳過

反例：「我已經修改了 orderRoutes，邏輯上應該正確，建議你跑一下確認」——這是把驗證推回給 user，等於沒完成。

---

## 誠實標籤

查不到、未實測的事一律標註，**不要編造，也不要在最終回報時默默刪掉標籤**：

- `[ASSUMPTION]` — 未經驗證的假設
- `[UNVERIFIED]` — 查不到或未實測的敘述

交付前 grep 這兩個標籤，殘留的必須原樣出現在最終回報裡。
