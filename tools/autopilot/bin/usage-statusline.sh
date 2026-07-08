#!/bin/bash
# usage-statusline.sh — worker（claude セッション）の status line として実行され、
# Claude Code から渡る stdin JSON の rate_limits（five_hour=セッション5時間 /
# seven_day=週間）を $1 のファイルへ書き出す。daemon がそのファイルを読んで
# モニタに使用率を表示する（Issue #879）。
#
# なぜ status line 経由か: rate_limits は **status line の stdin JSON にのみ**含まれ、
# transcript JSONL や CLI・キャッシュファイルには出力されない（実測確定）。worker は
# 対話 TUI（runner.js が tmux で claude を起動）なので status line が確実に描画される。
#
# 使い方（settings.js が worker の --settings に仕込む）:
#   {"statusLine":{"type":"command","command":"bash <abs>/usage-statusline.sh <abs-usage-file>"}}
#
# 注意: 引数 $1（出力先の絶対パス）を間違えると daemon が値を読めない。settings.js は
# worker の cwd と os.tmpdir() から絶対パスを組み立てて渡すこと。

out="${1:-}"
input=$(cat)

# rate_limits が無い応答（非サブスク / 初回 API 応答前）は書き込まない（最後の良値を保持）。
if [ -n "$out" ] && command -v jq >/dev/null 2>&1; then
    rl=$(printf '%s' "$input" | jq -c 'if .rate_limits then {rate_limits: .rate_limits} else empty end' 2>/dev/null)
    if [ -n "$rl" ]; then
        # 原子的に置き換え（読み手が中途半端な内容を読まないよう temp→mv）
        tmp="${out}.tmp.$$"
        printf '%s\n' "$rl" > "$tmp" 2>/dev/null && mv -f "$tmp" "$out" 2>/dev/null
    fi
fi

# worker の pane 用に短い状況表示（/log 閲覧時の視認性）。値が取れないうちは空。
if [ -n "$input" ] && command -v jq >/dev/null 2>&1; then
    s=$(printf '%s' "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty' 2>/dev/null)
    w=$(printf '%s' "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty' 2>/dev/null)
    [ -n "$s" ] && printf 'claude session:%s%% weekly:%s%%' "$s" "$w"
fi
