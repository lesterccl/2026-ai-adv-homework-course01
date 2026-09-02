# docs/agent — Agent 作業制度

這裡放**「agent 該怎麼工作」**的規則：流程、派工、驗收、什麼時候要停下來問。

專案本身的事實（架構、慣例、功能、測試）在 [`docs/`](../) 的其他文件；
**程式碼領域規則**（會依檔案路徑自動套用的）在 [`.claude/rules/`](../../.claude/rules/)。三者零重疊。

分界判準：

| 問題 | 去哪 |
|---|---|
| 「這個專案的程式碼長什麼樣？」 | `docs/` |
| 「我該怎麼做這件事？什麼時候要停下來問？」 | 這裡 |

---

## 路由表

| 情境 | 讀 |
|---|---|
| 開始一件工作、不確定流程 | [workflow.md](./workflow.md) |
| 要不要派 subagent、怎麼寫派工單、驗收怎麼做 | [delegation.md](./delegation.md) |
| 想動危險的東西、卡住了、想宣告完成 | [boundaries.md](./boundaries.md) |
| 想了解這套制度的來源與完整版 | [harness-digest.md](./harness-digest.md) |

---

## 與其他設定的關係

```
.claude/settings.json     權限三層（allow / ask / deny）+ sandbox + hook 註冊
.claude/hooks/            物理阻斷：擋掉散文攔不住的已知坑
.claude/rules/            程式碼領域規則（6 類，依 paths 自動套用）
.claude/agents/           專案 subagent（審查、測試、資安、commit）
.claude/commands/         斜線指令（/plan-new、/verify）
CLAUDE.md                 常駐路由中心
docs/                     專案事實
docs/agent/               本資料夾 — 行為制度（靠模型自律）
```

設計原則：**凡是「踩一次就毀掉 session 或造成不可逆損失」的錯誤，一律做成 hook 或 deny 規則，不寫成散文。** 散文只留給「踩了可恢復」的事情——這裡就是散文的部分。

本機的實證：純文字禁令對 `git add -A`、長路徑連字號、擅自重啟服務這幾類失誤是**無效**的，同一條粗體警告會被反覆違反。所以那幾項全部下沉到 `hooks/` 與 `settings.json` 的 `deny`。
