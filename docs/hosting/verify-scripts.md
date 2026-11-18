# 照合スクリプト（DNS と配信内容）

> **🆕 Smalruby 独自** — 本番 smalruby.app を GitHub Pages から S3 + CloudFront へ移すときに使う、読むだけの確かめ用スクリプト

本番の配信を移す作業（設計は `docs/hosting/README.md`）の各段で、「写したものが同じか」を機械で確かめるためのスクリプト。どちらも**問い合わせるだけで、DNS や配信を変えない**。Node.js の標準モジュールだけで動く（npm のパッケージは要らない）。

| スクリプト | 使う段 | 確かめること |
|---|---|---|
| `scripts/hosting/dns-compare.mjs` | 段 3（ネームサーバーを変える前） | お名前.com と Route 53 のレコードが同じか |
| `scripts/hosting/site-compare.mjs` | 段 8（apex を CloudFront に向ける前） | GitHub Pages と CloudFront が同じものを、設計どおりのヘッダで返すか |

**どこで走らせるか**: コンテナ（devcontainer）の firewall は、任意の DNS サーバーへの問い合わせと、許可していない宛先への通信を止めている。`dns-compare.mjs` の `ns:` はコンテナでは `connection refused` で止まる（終了コード 2）ので、**ホストか GitHub Actions で走らせる**。`site-compare.mjs` は、いまの `https://smalruby.app/`（GitHub Pages）にはコンテナからも届く。CloudFront に届かないときはホストで走らせる。

## DNS の照合（`dns-compare.mjs`）

2 つの「ソース」のレコードを、名前と型ごとに並べて比べる。

| ソース | 書き方 | 中身 |
|---|---|---|
| ゾーンファイル | `zone:<ファイル>` | BIND 形式（`名前 TTL IN 型 値`）。お名前.com のエクスポートはこの形で渡す（下の「入力の形」）。`dig +noall +answer` の出力もこの形なので、そのまま読める |
| Route 53 | `route53:<ファイル>` | `aws route53 list-resource-record-sets --hosted-zone-id <ID>` の JSON |
| ネームサーバー | `ns:<host>[,<host>...]` | 指定したネームサーバーに `dig +norec` で直接聞く。全部のサーバーに聞き、サーバーどうしで答えが違えば `INCONSISTENT` として出す |

```bash
# お名前.com のエクスポートと、Route 53 のネームサーバー 4 本を比べる（ホストで）
node scripts/hosting/dns-compare.mjs --origin smalruby.app \
  --a zone:onamae-zone.txt \
  --b ns:<Route 53 のネームサーバー 1>,<2>,<3>,<4>

# お名前.com と Route 53 のネームサーバーに直接聞いて比べる（ゾーンファイルなし）
node scripts/hosting/dns-compare.mjs --origin smalruby.app \
  --a ns:01.dnsv.jp,02.dnsv.jp,03.dnsv.jp,04.dnsv.jp \
  --b ns:<Route 53 のネームサーバー 1>,<2>,<3>,<4> \
  --names @,www,api,preview,_github-pages-challenge-smalruby

# 動きを見るだけなら、架空の値のサンプルどうしを比べる（ネットワークに出ない）
node scripts/hosting/dns-compare.mjs --origin example.com \
  --a zone:scripts/hosting/samples/onamae-zone.example.txt \
  --b route53:scripts/hosting/samples/route53.example.json
```

- 比べる型は既定で A / AAAA / CNAME / TXT / CAA / NS / MX（`--types` で変える）。SOA は比べない。
- **頂点（`@`）の NS は既定で比べない**。お名前.com と Route 53 では、それぞれ自分のネームサーバーを返すのが正しいため。比べたいときは `--include-apex-ns`。`api` / `preview` の委任の NS は比べる。
- `ns:` のときに聞く名前は、`--names`（既定: `@,www,api,preview,_github-pages-challenge-smalruby`）と、もう片方のファイルに出てくる名前のすべて。ネームサーバーはゾーン転送を許さないので、名前は列挙して聞く。
- 出力は 1 行に 1 組。`OK`（一致）/ `DIFF`（値が違う）/ `ONLY-A` / `ONLY-B`（片方にだけある）。`--json` で JSON にする。
- **TTL の違いは警告だけ**（`warn: TTL A=3600 B=300`）。apex の A は Route 53 だけ 300 にしてある（戻しやすくするため）。
- 終了コード: 0 = 全部一致、1 = 一致しないものがある、2 = 引数の間違い・問い合わせの失敗。

### 入力の形（お名前.com のエクスポート）

1 行に 1 レコードの BIND 形式にする。お名前.com の画面やエクスポートが別の形なら、この形に書き写す。サンプルは `scripts/hosting/samples/onamae-zone.example.txt`（架空の値）。

```text
$ORIGIN smalruby.app.
$TTL 3600
@                                3600 IN A     <IP>
@                                3600 IN TXT   "google-site-verification=..."
@                                3600 IN CAA   0 issue "amazon.com"
_github-pages-challenge-smalruby 3600 IN TXT   "..."
api                              3600 IN NS    <委任先のネームサーバー>.
```

- 名前の `@` は頂点。`.` で終わらない名前・値には `$ORIGIN` が付く。
- 名前を省いて行頭を空白にすると、前の行と同じ名前になる。
- TXT は `"..."` で囲む。`;` から行末まではコメント。

**本物のエクスポートはリポジトリにコミットしない**（`tmp/` に置く）。

## 配信内容の照合（`site-compare.mjs`）

2 つのホスト（A = いまの GitHub Pages、B = 新しい CloudFront）に同じパスを GET し、比べる。

```bash
# 段 8: GitHub Pages と CloudFront のドメインを比べる
node scripts/hosting/site-compare.mjs \
  --a https://smalruby.app \
  --b https://<SiteDistributionDomainName>

# 切り替えの直前: CloudFront に https://smalruby.app/ として聞く（curl --resolve と同じ）
node scripts/hosting/site-compare.mjs \
  --a https://smalruby.app \
  --b https://smalruby.app --resolve-b <CloudFront の IP>

# 調べるパスの一覧だけ出す（A に 2 回だけ聞く）
node scripts/hosting/site-compare.mjs --a https://smalruby.app --b https://smalruby.app --list
```

調べるパス:

- いつも: `/`、`/index.html`、`/admin/`、`/.well-known/microsoft-identity-association.json`、`/auth-redirect.html`、`/version.json`、`/service-worker.js`
- A の `/service-worker.js` の precache の一覧（Workbox の実行用のファイルも含む）と、A の `/index.html` が読むファイル（`--no-precache` で外す）
- `--dist <ディレクトリ>`: ビルドの出力（例: `packages/scratch-gui/dist`）の全ファイル。`index.html` のあるディレクトリは `<dir>/` と、末尾の `/` 無しの `<dir>` も調べる
- `--paths-file <ファイル>`: 1 行に 1 パス（`#` はコメント）

パスごとに見ること:

| 何を | どちらに | 期待 |
|---|---|---|
| 状態コード | A と B | 同じ |
| 中身の SHA-256 | A と B（どちらも 200 のとき） | 同じ（`Accept-Encoding: identity` で、圧縮しない中身を比べる） |
| `Content-Type` | A と B | 型が同じ（`charset` などの違いは警告だけ） |
| `Content-Type` | B | `.wasm` = `application/wasm`、`.mjs` / `.js` = `text/javascript` か `application/javascript`、`.hex` = `application/octet-stream` などダウンロードされる型、`.json` = `application/json`、`.html` = `text/html` ほか |
| `Cache-Control` | B | ハッシュ付き（`/\.[0-9a-f]{8,}\./`）= `max-age=31536000` と `immutable`。それ以外 = `max-age=0`（か `no-cache`） |
| 存在しないパス | B | **403**（S3 + OAC は一覧を見せないため。GitHub Pages は 404。A の値は警告として並べて出す） |
| 末尾の `/` が無いディレクトリ（`/admin` など） | B | **301** で `<path>/` へ |

- B の設計どおりかの確かめ（下 4 行）は `--no-b-checks` で外せる（例: GitHub Pages どうしを比べるとき）。
- 一度に聞く数は `--concurrency`（既定 4）。`--limit N` で先頭の N 個だけにする。全部を比べると両方から precache の全部（60〜100 MB）を読む。
- 出力は `OK` / `NG` とその理由。`--json` で JSON にする。
- 終了コード: 0 = 問題なし、1 = 問題がある、2 = 引数の間違い・ホストに届かない。

## テスト

比べる関数だけを、ネットワークに出ずに確かめる（`npm run lint` の中でも走る）。

```bash
npm run test:hosting-scripts
```
