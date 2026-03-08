# Reference: Known Test Fix Patterns

upstream merge 後に頻出するテスト修正パターン。

---

## Integration Tests (scratch-gui)

### 1. カテゴリクリックの失敗 (element click intercepted)

**症状**: テストが `clickText('カテゴリ名')` で失敗、"element click intercepted" エラー

**原因**: scratch-blocks v2 の DOM 構造変更により、カテゴリラベルのクリックが
親コンテナに遮られる。

**修正**:
```javascript
// Before
await clickText('Looks');
await clickText('調べる');

// After
await clickBlocksCategory('Looks');
await clickBlocksCategory('調べる');
```

`clickBlocksCategory` は `test/helpers/selenium-helper.js` で定義。
import が必要:
```javascript
const {clickBlocksCategory, ...} = require('../helpers/selenium-helper');
```

### 2. CSS セレクタの不一致

**症状**: `document.querySelector('.blocklyToolboxDiv')` が `null` を返す

**原因**: scratch-blocks v2 でクラス名が変更された。

**修正**:
```javascript
// Before
document.querySelector('.blocklyToolboxDiv')

// After
document.querySelector('.blocklyToolbox')
```

### 3. 新しいヘルパー関数の import 不足

**症状**: `ReferenceError: scopeForFlyoutBlock is not defined` 等

**原因**: upstream が `selenium-helper.js` に新しい関数を追加し、テストファイルで使用。

**修正**: テストファイルの import 文を更新して新しい関数を含める。

```javascript
// 例: scopeForFlyoutBlock が追加された場合
const {
    clickText,
    clickBlocksCategory,
    scopeForFlyoutBlock,  // 追加
    ...
} = require('../helpers/selenium-helper');
```

---

## Unit Tests (scratch-vm)

### 1. タイミング依存テストの flakiness

**症状**: CI で断続的に失敗。ローカルでは通る。
`not ok - should be equal` のような曖昧なエラー。

**原因**: `setTimeout` や `Date.now()` に依存するテストが CI 環境の遅延で不安定。

**修正**: `Date.now` と `Date` コンストラクタの両方をモックして決定的にする。

**重要**: `new Date().toISOString()` を使うコードでは `Date.now` だけでなく
`Date` コンストラクタ自体もモックが必要。

```javascript
// Mock both Date.now and Date constructor
const realDateNow = Date.now;
const RealDate = Date;
const startTime = realDateNow();
let currentTime = startTime;
Date.now = () => currentTime;
// eslint-disable-next-line no-global-assign
Date = class extends RealDate {
    constructor (...args) {
        if (args.length === 0) {
            super(currentTime);
        } else {
            super(...args);
        }
    }
    static now () {
        return currentTime;
    }
};

try {
    // テストコード: currentTime を操作して時間を制御
    service.fireEvent('e1');
    currentTime = startTime + 100;
    service.fireEvent('e2');
    currentTime = startTime + 200;
    service.fireEvent('e3');

    await service.processBatchEvents();

    // アサーション...
} finally {
    // eslint-disable-next-line no-global-assign
    Date = RealDate;
    Date.now = realDateNow;
}
```

---

## CI-Specific Issues

### 1. "Lint commit messages" workflow failure

**症状**: "Lint commit messages" CI ジョブが失敗

**原因**: upstream の commit message が commitlint の 100 文字制限を超えている。

**対応**: ブロッカーではない。無視してよい。

### 2. カバレッジ閾値エラー

**症状**: テスト自体は通るが、CI がカバレッジ不足で失敗

**原因**: `tap` の `allow-incomplete-coverage` 設定、またはカバレッジ閾値の設定

**対応**: `package.json` の `tap` セクションを確認:
```json
{
  "tap": {
    "allow-incomplete-coverage": true
  }
}
```

---

## テスト実行のベストプラクティス

### バッチ実行

統合テストはタイムアウト回避のため 5-6 ファイルずつ実行:

```bash
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest --no-coverage \
  test/integration/blocks.test.js \
  test/integration/blocks-standalone.test.js \
  test/integration/localization.test.js"
```

### scratch-vm のテスト

```bash
# 単体テスト全体
docker compose run --rm app bash -c "cd packages/scratch-vm && npm exec tap test/unit/*.js"

# 特定のファイル
docker compose run --rm app bash -c "cd packages/scratch-vm && npm exec tap test/unit/specific-file.js"
```

### テスト失敗時の調査

1. まずエラーメッセージを確認
2. 上記の既知パターンに当てはまるか確認
3. 当てはまらない場合は、upstream の diff を確認して原因を特定
4. API 変更が原因の場合は `reference-api-migration.md` を参照
