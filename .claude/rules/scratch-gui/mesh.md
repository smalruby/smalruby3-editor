# Mesh v2 Extension

Smalruby の mesh 拡張は、複数の Smalruby インスタンス間で **broadcast event** と **global variable** をリアルタイム共有する機能。AWS AppSync (GraphQL) をバックエンドに使う。

mesh は **最重要機能** のため、関連コードを変更したときは必ず本ドキュメントの「デグレ確認手順」に従って Playwright で検証する。

## 機能概要

| 共有対象 | 仕組み | 関連クライアント API |
|---------|--------|---------------------|
| Broadcast event | host/member が `broadcast` ブロックを発火 → AppSync mutation → 全ノードに配信 | `fireEvent(name, payload)` |
| Global variable (scalar) | ステージのグローバル変数を 1 秒ごとに rate-limit してデルタ送信 | `sendData([{key, value}])` |
| Sensor value (read) | 他ノードから受信した変数を最新タイムスタンプ優先で読む | `mesh.sensor_value(name)` (Ruby) / `meshV2_getSensorValue` (block) |

### 通信モード (host / member の両方が同じモードで動く)

| モード | リアルタイム配信 | 1 秒未満の遅延 | 環境制約 |
|--------|----------------|--------------|----------|
| **WebSocket** | AppSync subscription (`onMessageInGroup`) | ✅ | プロキシ/フィルタが WebSocket をブロックしない環境 |
| **Polling** | クライアントが 2 秒ごとに `pollGroupData` を query (issue #554) | ⚠️ 最大 2 秒 | フォールバック。403/503 で WebSocket が張れない環境 |

WebSocket / Polling の判定は `testWebSocket()` で行い、`useWebSocket: false` をサーバーに送ると polling グループとして作成される。URL パラメータ `?force_polling=1` でクライアント側から強制的に polling にできる。

### グループライフサイクル

- グループの最大接続時間は **35 分** (サーバー側 `MESH_MAX_CONNECTION_TIME_SECONDS` で制御)
- ただし **stg / 開発時の試験的な再接続では heartbeat TTL が 5 分** になる構成があり、デグレ確認では **5 分以内に検証を完了** すること
- host が `dissolveGroup` を呼ぶか接続上限に達すると全 member が自動切断される

## ファイル構成

### scratch-vm (本体)

`packages/scratch-vm/src/extensions/scratch3_mesh_v2/`

| ファイル | 行数目安 | 責務 |
|---------|---------|------|
| `index.js` | ~620 | scratch 拡張ブロック定義、UI 連携、`new MeshV2Service` |
| `mesh-service.js` | ~320 | ファサード。constructor / cleanup / listGroups / Object.assign で mixin 集約 |
| `mesh-client.js` | ~40 | Apollo Client, GraphQL endpoint URL |
| `gql-operations.js` | ~290 | GraphQL queries / mutations / subscription の定義 |
| `network-filter.js` | ~170 | エラー分類, 503 検出, testWebSocket |
| `periodic-sync.js` | ~70 | WebSocket モード時の 15 秒 fallback (`fetchAllNodesData`) |
| `polling-client.js` | ~110 | Polling モードの 2 秒周期 (`pollEvents` / `POLL_GROUP_DATA`) |
| `subscription-manager.js` | ~100 | WebSocket subscription 受信 (`onMessageInGroup`) と dispatch |
| `heartbeat-manager.js` | ~140 | host/member heartbeat と接続タイマー |
| `data-sender.js` | ~180 | グローバル変数送信 (REPORT_DATA), `getRemoteVariable` |
| `broadcast-receiver.js` | ~175 | 受信した event を順序保証して Scratch broadcast に流す |
| `event-sender.js` | ~220 | `fireEvent` キューイング + バッチ送信 (FIRE_EVENTS / RECORD_EVENTS) + orderKey 生成 |
| `group-lifecycle.js` | ~230 | createDomain / createGroup / joinGroup / leaveGroup |
| `rate-limiter.js` | ~220 | `sendData` の rate limit + マージ |
| `utils.js` | ~70 | URL パラメータパース, ドメイン localStorage |
| `name-search-utils.js` | ~55 | グループ名検索のひらがな→hex 変換 |

mesh-service.js は **mixin パターン** で各 manager を `Object.assign(MeshV2Service.prototype, XxxMixin)` として集約している (issue #566)。`this.X` 参照はすべて MeshV2Service インスタンスを指すため、外部 API は単一のクラスに見える。

### scratch-gui (UI / 接続ダイアログ)

| ファイル | 責務 |
|---------|------|
| `src/components/connection-modal/mesh-v2-*.jsx` | 接続ステップの UI |
| `src/reducers/mesh-v2.js` | 接続状態の Redux state |
| `src/lib/ruby-generator/mesh_v2.js` | Ruby コード → mesh ブロックへの変換 |
| `src/lib/ruby-to-blocks-converter/mesh_v2.js` | mesh ブロック → Ruby コード |

### infra/smalruby-mesh-v2

サーバー側 (CDK + AppSync + DynamoDB)。詳細は `.claude/rules/infra/smalruby-mesh-v2.md`。

### 関連ドキュメント

- `infra/smalruby-mesh-v2/docs/architecture.md` — システム全体図
- `infra/smalruby-mesh-v2/docs/api-reference.md` — GraphQL スキーマ
- `infra/smalruby-mesh-v2/docs/operations.md` — CloudWatch ログ運用
- `docs/mesh/cost.md` — コスト試算

## 開発の流れ

### 1. クライアント側の変更

1. **TDD で書く** — `test/unit/mesh_service_v2_*.js` (tap) で RED → GREEN → REFACTOR
2. `bin/dx bash -c "cd packages/scratch-vm && npm run lint"`
3. 関連 unit test を実行: `bin/dx bash -c "cd packages/scratch-vm && npm exec tap -- test/unit/mesh_service_v2_*.js test/unit/extension_mesh_v2*.js"`
4. push (CI が integration を含む全テストを実行)
5. **マージ前に必ず本書「デグレ確認手順」を実行**

### 2. mixin に変更を入れる場合

各 mixin は **MeshV2Service.prototype** に `Object.assign` で集約される。新しい mixin を追加する場合:

```javascript
// new-mixin.js
const NewMixin = {
    myMethod() { /* uses this.* */ },
};
module.exports = { NewMixin };

// mesh-service.js
const { NewMixin } = require('./new-mixin');
// ...
Object.assign(MeshV2Service.prototype, NewMixin);
```

### 3. サーバー側の変更

`.claude/rules/infra/smalruby-mesh-v2.md` を参照。CDK deploy の前後で:
1. `infra/smalruby-mesh-v2/spec/requests/` の RSpec を更新
2. `bundle exec rspec spec/requests/<対象>` で stg 確認
3. stg → prod の順でデプロイ
4. クライアント側のデグレ確認 (本書) を実行

## デグレ確認手順 (Playwright)

mesh 関連の変更時は必ず実行する。 **5 分以内** に完了すること (heartbeat TTL 制約)。

### 事前準備

1. dev server を **対象の worktree** からマウントする:
   ```bash
   docker compose stop app && docker compose rm -f app
   docker compose up -d app   # CWD の worktree から /app にマウント
   docker inspect smalruby3-editor-app-1 --format '{{ range .Mounts }}{{ if eq .Destination "/app" }}{{ .Source }}{{ end }}{{ end }}'
   ```
2. `until curl -sf -o /dev/null http://localhost:8601; do sleep 5; done`

### Step 1: 単体テスト + 整形チェック (group 時間消費なし)

```bash
bin/dx bash -c "cd packages/scratch-vm && npm run lint"
bin/dx bash -c "cd packages/scratch-vm && npm exec tap -- test/unit/mesh_service_v2*.js test/unit/extension_mesh_v2*.js test/integration/extensions/mesh-v2-*.test.js"
```

すべて pass しないと先に進まない。

### Step 2: Playwright 事前チェック (group 時間消費なし)

接続前に検証可能なものをすべてここでやる。**5 分タイマーは消費しない**。

```javascript
// http://localhost:8601/?no_beforeunload=1&tab=ruby&ruby_version=2 を開いてから:
const vm = window.smalruby.vm;
await vm.extensionManager.loadExtensionURL('meshV2');
await new Promise(r => setTimeout(r, 500));

let req;
await new Promise(resolve => {
    window.webpackChunkGUI.push([['__probe__'], {}, r => { req = r; resolve(); }]);
});
const MeshV2Service = req.c['../scratch-vm/src/extensions/scratch3_mesh_v2/mesh-service.js'].exports;
window.__MeshV2Service = MeshV2Service;

// チェック:
// 1. 全 mixin メソッドが MeshV2Service.prototype に存在するか
// 2. constructor が落ちずに必須プロパティを初期化するか
// 3. testWebSocket() が解決するか (boolean)
// 4. createDomain() が成功するか (string が返る)
// 5. listGroups() が空配列を返すか
// 6. _generateOrderKey が `\d{14}-\d{7}` 形式 + 連番が単調増加するか
// 7. shouldDisconnectOnError / isNetworkFilterError のマトリクス
// 8. getRemoteVariable('any') が remoteData={} で null を返すか
```

### Step 3: WebSocket モード (group 時間 ~2 分消費)

```javascript
// 同じタブ内に host と node の 2 つの MeshV2Service を作る (2 タブを開く必要なし)
const ts = Date.now();
const domain = `ws-test-${ts}`;
const blocks = {
    runtime: window.smalruby.vm.runtime,
    opcodeFunctions: { event_broadcast: () => {} },
};

const host = new MeshV2Service(blocks, `host-${ts}`, domain);
host.testWebSocket = () => Promise.resolve(true);
await host.createGroup(`ws-grp-${ts}`);

const node = new MeshV2Service(blocks, `node-${ts}`, domain);
node.testWebSocket = () => Promise.resolve(true);
await node.joinGroup(host.groupId, host.domain, `ws-grp-${ts}`);

// 検証 (assertions):
// - host.useWebSocket === true && node.useWebSocket === true
// - host.subscriptions.length > 0 && node.subscriptions.length > 0
// - node.dataSyncTimer (15s periodic-sync 起動)
// - node.pollingTimer === null

// データ同期: host が REPORT_DATA mutate → node.remoteData[hostId] に反映 (subscription 経由)
// 期待: 4 秒以内に node.remoteData[hostId].score?.value === '42'

// イベント配信: node.broadcastEvent をフックしてから host.fireEvent('a', '1') ×3
// 期待: broadcastCalls の長さ 3、name/payload/orderKey が送信順と一致

host.cleanup(); node.cleanup();
```

### Step 4: Polling モード (group 時間 ~2 分消費)

```javascript
// 同様の流れだが forcePolling = true
const host = new MeshV2Service(blocks, `pl-host-${ts2}`, domain2);
host.forcePolling = true;
host.useWebSocket = false;
await host.createGroup(`pl-grp-${ts2}`);

const node = new MeshV2Service(blocks, `pl-node-${ts2}`, domain2);
node.forcePolling = true;
node.useWebSocket = false;
await node.joinGroup(host.groupId, host.domain, `pl-grp-${ts2}`);

// 検証:
// - host.useWebSocket === false && node.useWebSocket === false
// - host.subscriptions.length === 0 (polling は subscription 張らない)
// - host.pollingTimer (2s pollEvents 起動)
// - host.dataSyncTimer === null (issue #554: polling では periodic-sync 起動しない)

// データ同期: host が REPORT_DATA mutate → node が pollGroupData で取得 (最大 2s 遅延)
// 期待: 6 秒以内に node.remoteData[hostId].kp1?.value === '999'

// イベント配信: node.broadcastEvent をフックしてから host.fireEvent('alpha', '11') ×3
// fireEventsBatch は polling 時は RECORD_EVENTS を使う、node は pollGroupData の events で受け取る
// 期待: broadcastCalls の長さ 3、順序が送信順と一致

host.cleanup(); node.cleanup();
```

### 完了基準

- Step 1: lint OK + 全 unit/integration test pass
- Step 2: 全 prototype メソッド + プロパティ + helper メソッドが正常動作
- Step 3: WebSocket でデータ + イベントが配信される、タイマー構成が正しい
- Step 4: Polling でデータ + イベントが配信される、タイマー構成が正しい

### よくある落とし穴

- **dev server のマウント**: `docker compose run` する CWD が worktree の root と一致するか必ず確認 (`docker inspect ... --format '{{ range .Mounts }}{{ if eq .Destination "/app" }}{{ .Source }}{{ end }}{{ end }}'`)
- **`bin/setup-worktree`**: 新しい worktree では `npm install` + `npm run build:dev` が必要 (詳細: `.claude/rules/git-workflow.md`)
- **テスト失敗の本物 / 偽陽性**: `dist/` や per-package `node_modules` が無いと jest や tap が解決失敗する。本物のリグレッションと区別するため、まず setup の完了を確認する
- **5 分タイマー**: createGroup から 5 分経過すると heartbeat 失効 → mutation が `GroupNotFound` で失敗する。新しい group を作り直す
- **同一タブ host + node**: 同じ JS context で host と node を作ると subscription が 1 つの WebSocket 接続を共有するが、AppSync 側では別個の subscription として扱われる。テスト目的では問題ない

## 参照

- issue #554 (pollGroupData 統合) — PR #564
- issue #555 (プロトコルロギング) — PR #557
- issue #556 (orderKey によるイベント順序保証) — PR #563
- issue #566 (mesh-service.js 責務分割) — PR #569
