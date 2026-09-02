# Git Commit 規則

## Message 格式

```
<type>: <簡短描述>

<空一行，選填的詳細說明>
```

- 描述用繁體中文或英文皆可，但**同一個 repo 內保持一致**（本專案用繁中）。
- 標題不加句號，控制在 50 字元內。

## type 類型

| type | 用於 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 只改文件 |
| `test` | 只改測試 |
| `refactor` | 重構，對外行為不變 |
| `style` | 格式調整（縮排、引號），不影響邏輯 |
| `chore` | 建置、設定、依賴 |

## 禁止 commit 的檔案

以下已在 `.gitignore`，若出現在 `git status` 代表 gitignore 規則失效，**停下來檢查而不是硬加**：

- `node_modules/`
- `.env`、`.env.local`、`.env.production`（`.env.example` 例外，要進版控）
- `database.sqlite`、`*.sqlite-shm`、`*.sqlite-wal`
- `public/css/output.css`（build 產物）
- `*.swp`、`.DS_Store`
- `.claude/*.local.json`

## 加檔規則

- **禁止 `git add -A` / `git add .`**（已由 hook 與 deny 規則阻擋）。本機有三次事故：掃入 vim swap 檔、鎖檔、建置產物。
- 正確流程：
  1. `git status --porcelain -uall` — 逐檔看清楚
  2. 對 >2MB 的未追蹤檔跑 `du -h` 確認
  3. `git add <path1> <path2> ...` — 逐路徑加

## push

- `git push` 需使用者手動確認（已設為 deny）。
- `origin` = 個人私庫；`upstream` = hexschool 原始庫，**push URL 已停用，不可推**。
- 永遠不 `--force`、不 `--no-verify`。
