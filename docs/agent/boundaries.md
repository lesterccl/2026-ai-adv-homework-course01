# boundaries — 紅線、STOP 信號、熔斷

> 用法：卡住時、想再試一次前、想宣告完成前，逐條肉眼比對。

---

## 1. 硬性紅線（已做成 deny 或 hook，不靠自律）

這些不需要你判斷——`settings.json` 的 `deny` 與 `hooks/pretooluse_guard.py` 會直接擋下。列在這裡是讓你知道**為什麼**被擋，不要繞路。

| 紅線 | 擋在哪 | 繞過的正確做法 |
|---|---|---|
| 讀寫 `.env` | deny | 需要知道有哪些變數 → 讀 `.env.example`（未被擋） |
| `git push --force` / `-f` | deny | 沒有正確做法，這永遠是 user 的決定 |
| `git push upstream`（推到 hexschool 原始庫） | deny + git remote 層停用 | 只推 `origin`（個人私庫） |
| `git commit --no-verify` | deny | 讓檢查通過，不是關掉檢查 |
| `git add -A` / `git add .` | deny + hook | `git status --porcelain -uall` 看清楚 → 逐路徑 `git add` |
| `sudo` | deny | 需要提權的事一律交 user |
| Read `package-lock.json` | deny + hook | `jq` 取單一欄位；版本範圍看 `package.json` |
| 改 `public/css/output.css` | deny + hook | 改 `input.css` → `npm run css:build` |
| Read `database.sqlite` | deny | 用 `sqlite3` 下 query，或直接看 `src/database.js` 的 schema |

**`ask` 層**（會跳確認）涵蓋：所有 git 寫入操作、`npm install`、`rm`/`mv`/`cp`、改 `package.json`/`app.js`/`server.js`/`.gitignore`、改 `.claude/**`。

最後一項是刻意的：**護欄不能由被護的人自行放寬。** 要改權限或 hook，必須經過 user。

---

## 2. STOP 信號：方向錯了，立刻換路徑

任一條命中 → 停止當前做法，退回上一個決策點。**「原地再試一次」不是選項。**

### 2.1 同一錯誤訊息第 3 次出現，且前兩次用了不同修法
質疑上游假設，不要再換一個拼法 submit。
- 本專案的典型上游問題：DB schema 沒重建（`CREATE TABLE IF NOT EXISTS` 對既有檔無效）、測試踩到前次執行的殘留資料。

### 2.2 交替失敗：修 A 壞 B，修 B 又壞 A
這是設計層衝突，不是 bug。停止修補，寫出兩邊的真實約束再重新設計。

### 2.3 開始改動與任務無關的檔案，好讓錯誤消失
發現自己想改測試的斷言值、想 skip 掉失敗的測試 → **停，你的改動才是錯的那個。**

### 2.4 特例補丁出現第 3 個
同一個函式已為了 work 加了 2 個 `if 特殊情況`，第 3 個出現 = 抽象選錯了。

### 2.5 workaround 需要關掉防護才能過
需要 `--no-verify`、刪 hook、`dangerouslyDisableSandbox`、註解掉失敗測試 —— **無條件 STOP**，這永遠是錯的路。

### 2.6 量化總則
同一個子問題已花 **> 10 次工具呼叫** 而驗收條件的完成度沒有前進 → 視同 STOP，執行升級或熔斷。

---

## 3. 熔斷：停止自主作業，向 user 提問

任一命中 → 停下手上所有產出，整理「現況 + 已試方案與確切錯誤 + 選項與建議」一次問清楚。

1. **兩輪升降級後仍失敗**（見 [delegation.md](./delegation.md) §4）
2. **不可逆或高成本操作** — 刪除非自己建立的檔案、`git push -f`、任何涉及 `.env` 的變更
3. **指令文件互相矛盾** — 兩份規則對同一件事給相反指示 → 不要自行擇一，指出矛盾問 user
4. **品味 / 商業判斷** — 驗收條件寫不成檢核表的（UI 美感、文案語氣、要不要引入某套件、架構取捨）
5. **範圍漂移** — 做到一半發現「要做好這件事得先重構另一塊」→ 停，這是 scope 決策，屬於 user

### 品味類的標準動作（三步，不准跳過）

1. 做出 2–3 個候選
2. 列出各自的**客觀** trade-off（行數 / 依賴數 / 與現有慣例的距離）
3. 交 user 選

**禁止自行拍板後直接落地。** 評審報告禁止用「比較好看」，只准引用可比較的維度。

---

## 4. 熔斷提問的樣子

**正例**：
> 建單庫存扣減卡住。已試 A（錯誤 X）、B（錯誤 Y），懷疑是交易邊界包錯。選項：(1) 把庫存檢查移進 transaction (2) 改用 SQL 的 `WHERE stock >= ?` 條件式更新。建議 (2)，因為它同時解決併發問題。你選哪個？

**反例**：
- 默默選了重構整個路由層，兩小時後交出 40 檔 diff
- 反過來——每做 10 分鐘就問一次「我可以繼續嗎？」

**熔斷是例外事件，不是進度回報。** 不命中上述任一條就繼續做，不要問。

---

## 5. 環境失敗 ≠ 代碼失敗

`npm install` 失敗（better-sqlite3 需要編譯 native binding）、`.env` 不存在導致 `server.js` exit(1)、port 3001 被占用 —— 這些**記 BLOCKED，不准當 bug 去改代碼**。

連續 2 次 BLOCKED → 停下來問 user。
