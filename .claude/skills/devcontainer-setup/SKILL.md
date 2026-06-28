---
name: devcontainer-setup
description: smalruby3-editor の devcontainer 設定 (.devcontainer/devcontainer.json) を対話的に作成する。テンプレート (.example) を基に、利用者の環境に合わせて mounts セクションを ON/OFF する。devpod / VS Code Dev Containers で開発したい人が初回に使う。
---

# /devcontainer-setup - Interactive devcontainer.json builder

`.devcontainer/devcontainer.json` は `.gitignore` 対象で、各自で `.example` から
コピーして自分の環境に合わせて mounts を編集する設計。本スキルは AskUserQuestion
を使ってこの作業を対話的に行う。

## 前提

- 本 repo の repo root から起動する
- `.devcontainer/devcontainer.json.example` が存在する
- `~/.gitconfig` `~/.config/gh` は普通にある前提 (devcontainer 起動の必須要件)

## 実行フロー

### Step 1: 既存 devcontainer.json の確認

```bash
if [[ -f .devcontainer/devcontainer.json ]]; then
    既存ファイルがある旨を伝えて、続行するか確認する
    AskUserQuestion で「上書き」「中止」「diff を見る」を提示
fi
```

中止が選ばれたら exit。

### Step 2: 利用シーンの確認

`AskUserQuestion` で:

- 質問: 「どの IDE / ツールから devcontainer を起動しますか？」
- header: "起動方法"
- options:
  - "devpod (CLI)" — devpod up . で起動
  - "VS Code Dev Containers" — Reopen in Container で起動
  - "両方" — どちらでも動く設定にする

この回答は後段で差を付ける必要は基本ないが、トラブルシュート時の案内に使う
(devpod の場合は GH_TOKEN export の警告を強めるなど)。

### Step 3: 個人マウントの選択 (multiSelect)

`AskUserQuestion` で multiSelect:

- 質問: 「以下の個人マウントのうち、有効にするものを選んでください」
- header: "Mounts"
- multiSelect: true
- options:
  - "ghq (~/ghq → /ghq)" — 関連 OSS の参照
  - "Claude Code 設定・skills (~/.claude/settings.json, skills, plugins, statusline-command.sh, projects/-app)" — host で開発した skills + このプロジェクトの memory を container に持ち込む。container 内 Claude の初回起動時にログインが必要 (auth は意図的に共有しない)

**重要**: `~/.claude.json` の bind は **オプションから外している**。container と
host の auth/version 分離のため、container は別途ログインする設計。auto-update
抑止のため containerEnv.DISABLE_AUTOUPDATER=1 は常に有効。詳細は
.devcontainer/README.md の「Claude Code 認証は マウントしない」セクション参照。

### Step 4: ホスト側の状態確認

選ばれた mount のソースが host に存在するか確認:

```bash
[[ -d "$HOME/ghq" ]] || 警告: ~/ghq が無いので作成するか確認
[[ -d "$HOME/.claude/skills" ]] || 警告: Claude Code を起動したことが無い可能性
[[ -f "$HOME/.claude/settings.json" ]] || 警告: 同上
```

存在しないソースが選ばれた場合は AskUserQuestion で:

- "作成する (mkdir -p / touch)" — bind mount のソースを作る
- "選択を取り消す" — mount を有効化しない
- "気にせず進める" — devcontainer 起動時に bind 失敗の覚悟あり

### Step 5: devcontainer.json の生成

`.devcontainer/devcontainer.json.example` を読み、選択された mount 行の
`// ` プレフィックスを除去する。生成方法:

```bash
# 1. テンプレートをコピー
cp .devcontainer/devcontainer.json.example .devcontainer/devcontainer.json

# 2. Edit ツールを使って、選択された各 mount 行のコメントを外す
#    例: ghq が選ばれた場合
#    `// ,"source=${localEnv:HOME}/ghq,target=/ghq,type=bind"` を
#    `,"source=${localEnv:HOME}/ghq,target=/ghq,type=bind"` に置換
```

実装上は AskUserQuestion で得た選択結果を順に Edit ツールで反映する。

### Step 6: GH_TOKEN 案内

macOS かどうかを確認し、macOS なら必ず案内:

```text
devcontainer を起動する前に、以下をホスト側のシェルで実行してください:

    export GH_TOKEN=$(gh auth token)

VS Code 利用の場合は、その export を実行した同じシェルから:

    code .

devpod 利用の場合は:

    devpod up . --ide none

(セッションを跨ぐと export が消えるので、毎日 1 回は必要)
```

### Step 7: 動作確認の促し

最後に「テンプレートから生成した devcontainer.json はこちらです」と
パス (`.devcontainer/devcontainer.json`) を提示し、確認を促す。

`gh auth token` が取れているかと、選択した mount のソースが全部存在することを
最終チェックして報告する。

## エラーハンドリング

- `.devcontainer/devcontainer.json.example` が無い → 「PR #687 がまだマージされていない可能性があります」と案内して exit
- repo root 以外で実行された → cd でない場合は exit
- 既存 `.devcontainer/devcontainer.json` がある → diff を見せて上書き確認
- `gh` が host に無い → 「`brew install gh` してから再実行してください」

## 完了後の TODO 案内

- README に「次のステップ」として以下を提示:
  - VS Code: `Cmd+Shift+P` → `Dev Containers: Reopen in Container`
  - devpod: `devpod up . --ide none`
  - **egress allowlist firewall (既定で有効)**: `.example` には `runArgs`
    (`--cap-add=NET_ADMIN/NET_RAW`) と `postStartCommand` (`init-firewall.sh`) が
    含まれる。コンテナの外向き通信は default-DROP で GitHub / npm / Anthropic / AWS のみ
    許可される。`npm install` / `cdk` が固まったら弾かれた宛先を allowlist に追加する
    (詳細は `.devcontainer/README.md`「egress allowlist firewall」)
  - 詳細は `.devcontainer/README.md`

## 設計上の注意

- 本スキルは **生成だけ** を行う。devcontainer の起動・テストは行わない (副作用が大きいため)
- AskUserQuestion で multiSelect を使うことで、上述の Claude 3 マウントをまとめて選択させる
- 既存 devcontainer.json がある場合は安全側に倒す (上書きには明示的な確認)
- 編集には Edit ツールを使い、行ごとの正確な置換を行う (sed では空白や引用符でハマりやすい)
