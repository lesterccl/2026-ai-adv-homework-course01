---
description: 跑完整機器驗收（測試 + OpenAPI + 待提交檔案檢查）
allowed-tools: Bash(npm test), Bash(npm run:*), Bash(git status:*), Bash(git diff:*), Bash(ls:*), Bash(du:*), Bash(grep:*), Read
---

對目前的工作樹跑一輪完整機器驗收。**逐步執行，每步貼出實際輸出**，不要憑印象作答。

1. **測試（連跑兩次）**：`npm test`，然後**再跑一次**。
   第二次才會踩到第一次留下的 DB 殘留資料 — 兩次都綠才算過（理由見 `docs/TESTING.md` §2）。

2. **OpenAPI**：`npm run openapi`，確認產出成功。
   若這次改過 API，比對改動的路由上方是否有對應的 `@openapi` 區塊（`docs/DEVELOPMENT.md` §9 的義務）。

3. **待提交檔案**：`git status --porcelain -uall`。
   逐檔判斷是否該進版控；對 >2MB 的未追蹤檔用 `du -h` 標出來（`.claude/rules/harness-digest.md` §5 的踩坑）。

4. **殘留掃描**：在改動的檔案裡 grep `TODO`、`FIXME`、`console.log`、`[ASSUMPTION]`、`[UNVERIFIED]`。
   找到的標籤必須原樣列進回報，不准默默刪掉。

5. **CSS 產物**：若改過 `public/css/input.css`，確認跑過 `npm run css:build`。

最後輸出一張表：`檢查項 | PASS/FAIL | 證據（命令 + 輸出關鍵行）`。
任何一項 FAIL 或無法驗證就明說，**不要寫「應該沒問題」**。
