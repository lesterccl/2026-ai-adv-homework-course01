#!/usr/bin/env python3
"""PreToolUse guard. Blocks three known session-killing mistakes in this repo.

Input: hook JSON on stdin. Exit 0 = allow, exit 2 = block (stderr is shown to the model).
Fail-open: any internal error allows the call — the guard must never break the harness.
Registered in .claude/settings.json. Rationale: .claude/rules/boundaries.md.
Python 3.8 compatible (runs on the system python3).

What it blocks and why (each has a real incident behind it):
  1. `git add -A` / `git add .`  — sweeps editor swap files, build artifacts and stray
     scratch files into commits. Happened three times across this user's projects.
  2. Read on package-lock.json / any >500KB file without `limit` — burns the context window.
  3. Edit/Write on public/css/output.css — it is a Tailwind build artifact and is
     gitignored; edits are silently discarded by the next `npm run css:build`.

Known boundaries (regex-level guard, by design): does not catch `cd x && git add -A`
written across separate calls, or deliberately obfuscated commands. It blocks accidents,
not adversaries.

Test procedure:
  echo '{"tool_name":"Bash","tool_input":{"command":"git add -A"}}' | python3 .claude/hooks/pretooluse_guard.py; echo "exit=$?"
  # expect exit=2 with a message; exit=0 for `git add src/app.js`
"""
import json
import os
import re
import sys

READ_SIZE_LIMIT = 500 * 1024

# `git add -A`, `git add --all`, `git add .` (also with flags before the path)
GIT_ADD_ALL = re.compile(r'(?<![\w./-])git\s+(?:-\S+\s+)*add\s+(?:-\S+\s+)*(?:-A\b|--all\b|\.(?:\s|$))')

# writing to the gitignored Tailwind build artifact from the shell
WRITE_OUTPUT_CSS = re.compile(r'(?:>|>>|\btee\b|\bcp\b\s+\S+)\s*\S*public/css/output\.css')

BLOCKED_READ_BASENAMES = ('package-lock.json',)


def block(msg):
    sys.stderr.write(msg + '\n')
    sys.exit(2)


def check_bash(data):
    cmd = data.get('tool_input', {}).get('command', '') or ''

    if GIT_ADD_ALL.search(cmd):
        block('[BLOCKED by pretooluse_guard] 禁止 `git add -A` / `git add .`。\n'
              '本機有三次事故紀錄：掃入 vim swap 檔 (.swp)、.claude 鎖檔、.nuxt/ 建置產物。\n'
              '正確做法：\n'
              '  1. git status --porcelain -uall   # 先逐檔看清楚要進版控的是什麼\n'
              '  2. git add <path1> <path2> ...    # 逐路徑加，不用萬用參數')

    if WRITE_OUTPUT_CSS.search(cmd):
        block('[BLOCKED by pretooluse_guard] public/css/output.css 是 Tailwind build 產物 (已 gitignore)。\n'
              '手寫進去會被下一次 `npm run css:build` 直接覆蓋。\n'
              '正確做法：改 public/css/input.css 的 @theme 或 utility，然後 npm run css:build')


def check_read(data):
    ti = data.get('tool_input', {})
    path = ti.get('file_path', '') or ''
    base = os.path.basename(path)

    if base in BLOCKED_READ_BASENAMES:
        block('[BLOCKED by pretooluse_guard] %s 有 152KB / 4000+ 行，Read 會灌爆 context。\n'
              '要查套件版本改用：\n'
              '  jq -r \'.packages["node_modules/<pkg>"].version\' package-lock.json\n'
              '  grep -n \'"<pkg>"\' package.json          # 宣告的版本範圍看這裡就夠' % base)

    if path and os.path.isfile(path) and os.path.getsize(path) > READ_SIZE_LIMIT \
            and not ti.get('limit'):
        block('[BLOCKED by pretooluse_guard] %s 超過 500KB。\n'
              'Read 必須帶 limit 參數 (例如 limit=100)，或改用 Grep / jq 只取需要的部分。' % path)


def check_write(data):
    path = (data.get('tool_input', {}).get('file_path', '') or '').replace('\\', '/')

    if path.endswith('public/css/output.css'):
        block('[BLOCKED by pretooluse_guard] public/css/output.css 是 Tailwind build 產物 (已 gitignore)。\n'
              '手寫進去會被下一次 `npm run css:build` 直接覆蓋。\n'
              '正確做法：改 public/css/input.css 的 @theme 或 utility，然後 npm run css:build')


def main():
    data = json.load(sys.stdin)
    tool = data.get('tool_name', '')
    if tool == 'Bash':
        check_bash(data)
    elif tool == 'Read':
        check_read(data)
    elif tool in ('Edit', 'Write', 'NotebookEdit'):
        check_write(data)
    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
