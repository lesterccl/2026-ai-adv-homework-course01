---
description: 依 TEMPLATE 開一張新的工作計劃卡
argument-hint: <slug> 例如 admin-order-status
allowed-tools: Bash(date:*), Bash(ls:*), Read, Write
---

依 `docs/plans/TEMPLATE.md` 開一張新的工作卡。

主題（slug）：$1

步驟：

1. 用 `date +%Y-%m-%d` 取今天日期（不要用你記憶中的日期）。
2. 讀 `docs/plans/TEMPLATE.md`。
3. 讀 `docs/plans/README.md` 的命名規則與工作流。
4. 建立 `docs/plans/<YYYY-MM-DD>-$1.md`：
   - 若 `docs/plans/2026-09-02-backlog.md` 裡有對應的 B-N 項目，把該項的現況、影響、建議做法搬進背景，不要重寫一遍。
   - 依 `docs/FEATURES.md` 與 `docs/ARCHITECTURE.md` §8 判斷「改動範圍白名單」該列哪些檔案。
   - 驗收條件必須可檢查（`npm test` 全綠、`curl` 回 200 之類），禁止「做好做完整」。
   - Non-goals 至少繼承 `.claude/rules/delegation.md` §2 的預設五項。
5. 檔案已存在就停下來回報，不要覆蓋。

完成後只回報：建立的檔案路徑 + 白名單 + 驗收條件清單。不要開始實作。
