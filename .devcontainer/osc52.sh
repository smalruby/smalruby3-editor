#!/bin/bash
# Send stdin to the host OS clipboard via OSC 52.
#
# tmux のコピーモードから copy-pipe で呼ばれる。
# DCS パススルー (\033Ptmux;...\033\\) で OSC 52 を tmux の外側の端末
# (SSH 越しの macOS ターミナル) に転送する。
#
# 前提: ホスト側端末が OSC 52 を受け付けること
#   iTerm2: Preferences > General > Selection >
#           "Applications in terminal may access clipboard" を ON

buf=$(cat | base64 | tr -d '\n')
printf '\033Ptmux;\033\033]52;c;%s\007\033\\' "$buf" > /dev/tty
