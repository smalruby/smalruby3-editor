# CI runner の版固定

GitHub Actions の runner（`runs-on`）は **版を固定する**。`ubuntu-latest` / `windows-latest` は使わない。

| OS | 固定する label |
|---|---|
| Linux | `ubuntu-26.04` |
| Windows | `windows-2025` |

### 例外（古い版に残しているジョブ）

| ジョブ | 版 | 理由 | 追跡 |
|---|---|---|---|
| `ci-ruby.yml` の `unit-test`、`gem-build-check.yml` の `build-linux`、`release-gem.yml` の `test` / `release` | `ubuntu-24.04` | smalruby3 gem のネイティブ拡張が使う `magnus` が 26.04 ではコンパイルできない（新しい libclang と `bindgen` 0.69 の組み合わせ） | #1391 |

## なぜ固定するか

`*-latest` は GitHub がイメージを次の版に切り替えた日に、こちらが何も変えていなくても指す先が変わる。
入っているツール（AWS CLI・Playwright が対応する OS・apt パッケージ・Ruby をビルドする toolchain など）が
変わり、関係のない PR の CI が突然落ちる。固定しておけば、版を上げるのは「確かめてから上げる」作業に
なり、落ちたときの原因も切り分けやすい。

`ubuntu-latest` が 26.04 になったとき、一部のジョブは 24.04 に、残りは `ubuntu-latest`（= 26.04）のまま
混ざっていた。どのジョブが 26.04 で動くかを誰も確かめていない状態になっていたので、全ジョブを 26.04 で
走らせて確かめたうえで固定した（Issue #1386）。

## 規約

- 新しいジョブを足すときも、上の表の label を使う。`ubuntu-latest` / `windows-latest` を書かない。
- 一部のジョブだけ古い版に残すときは、`runs-on` の行に **理由のコメント**を書き、追跡の Issue を作る
  （例: `runs-on: ubuntu-24.04  # <理由> (#<issue>)`）。理由が無いまま古い版を残さない。
- 版を上げるときは、まず全ジョブを新しい版にした PR で CI を走らせて確かめる。PR で走らない
  workflow（`paths` で絞っているもの・`workflow_dispatch` だけのもの）は、そのブランチで
  `workflow_dispatch` を起動して確かめる。リリース・デプロイ・定期実行の workflow
  （`release-gem.yml` / `deploy-infra-stg.yml` / `preview-cleanup.yml` / `security-monitor.yml`）は
  PR では走らないので、同じ setup を使うジョブ（gem ビルド = `gem-build-check.yml`、AWS CLI =
  `ci-cd.yml` の `preview-deploy`）の結果で代わりに確かめる。
- 上げたら、この表を更新する。
