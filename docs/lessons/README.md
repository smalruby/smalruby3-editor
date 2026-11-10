# レッスン（コース › レッスン › チャレンジ）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

## 概要

いまのチュートリアル（`docs/tutorial/`）を、**コース › レッスン › チャレンジ** の形に作り直す機能。
探すための一覧ではなく、「何をやって、何ができるようになったか」が見えるレッスンにして、先生の
説明がなくてもスモウルビーでのプログラミングのやり方が身につくようにする。

このドキュメントは仕組みの全体像（データの形・記録の形・状態・レッスン表・レッスンモード・主要ファイル）をまとめる。
ヒントの吹き出しと判定は、それぞれの実装に合わせて追記する。

## ユーザーストーリー

- **はじめてスモウルビーを使う子**として、先生がいなくても、順番にやれば基本の操作が身につくようにしたい
- **学習者**として、どのチャレンジができたか・何ができるようになったかを見たい
- **先生**として、授業の前に生徒がやっていた分も、あとでクラスの課題に引き継ぎたい

## 階層

| 階層 | 説明 | 例 |
|------|------|----|
| 言語 | ブロック／Ruby／日本語（DNCL）。言語の中にコースが並ぶ | `blocks` |
| コース | レッスンの並び。全部のレッスンをクリアするとクリアの印がもらえる | 「きょうからプログラマー」（印: 「プログラマー デビュー！」） |
| レッスン | チャレンジの並びとクリア条件（n 個と必須） | レッスン 1「ブロックのなかま」（11 個のうち、必須の 3・6・8・9・11 をふくめて 7 個） |
| チャレンジ | いまの deck 1 本に当たる。毎回、新しい作品から始める | 「押したら話そう」 |
| できること | チャレンジで身につくもの。できたチャレンジから一覧にする | — |

## データの形

データは `packages/scratch-gui/src/lib/lessons/courses.js`。文言は message descriptor（`{id, defaultMessage}`）
で持ち、文字列は `lessons.locale.js`（en / ja / ja-Hira）に置く。id は
`gui.lessons.<course|lesson|challenge>.<id>.<field>`。

### コース

| 項目 | 型 | 説明 |
|------|----|------|
| `id` | string | 例: `kyou-kara-programmer` |
| `language` | `blocks` \| `ruby` \| `dncl` | `LANGUAGES` |
| `name` | message | コースの名前 |
| `badge` | message | クリアの印の名前 |
| `lessons` | レッスン[] | 並び順 |

### レッスン

| 項目 | 型 | 説明 |
|------|----|------|
| `id` | string | 例: `blocks-l1` |
| `name` | message | レッスンの名前 |
| `challenges` | チャレンジ[] | 並び順 |
| `clear` | `{count, required}` | クリア条件。`count` = できた数、`required` = 必須のチャレンジ id |

`clear.required` はチャレンジの `required: true` から作る（必須は 1 か所にだけ書く）。

### チャレンジ

いまの deck の項目（`allowedBlocks`・`setup`・`steps`・`code`）をそのまま持ち、レッスン用の項目を足す。
定義で省いた項目は `defineChallenge` が既定値で埋めるので、読む側は有無を確かめなくてよい。

| 項目 | 型 | 既定 | 説明 |
|------|----|------|------|
| `id` | string | — | **記録のキー**。並びを変えても変わらないよう番号を入れない（例: `blocks-l1-click-say`） |
| `number` | number | 並びから | レッスンの中で何個めか（表示用）。`defineLesson` が並びから付ける |
| `name` | message | id から | チャレンジの名前 |
| `task` | message \| null | null | 課題の 1 行 |
| `category` | string \| null | null | なかま（パレットの色）。`CATEGORIES` の値（`motion` / `looks` / `sound` / `events` / `control` / `sensing` / `operators` / `variables` / `lists` / `extensions`）。レッスン表が色の丸で見せる |
| `skills` | `{id, name}`[] | [] | できること。id で重ねる（別のチャレンジで同じものが身についても 1 つ） |
| `goal` | 条件[] \| null | null | できた の判定。条件の配列で、全部を満たしたら「できた」（下の「できた の判定」）。null なら判定しない |
| `required` | boolean | false | レッスンの必須か |
| `allowedBlocks` | object \| null | null | パレットに出すブロック（deck と同じ形） |
| `setup` | object \| null | null | 始めるときの準備（deck と同じ形。`lib/deck-setup.js`） |
| `steps` | ヒント[] | [] | ヒント（下の表） |
| `code` | string \| null | null | ヒントの最後の手段「プログラムを入れる」（Ruby。deck の `code` と同じ） |
| `debug` | message[] | [] | うまく動かないときは |

ヒント（`steps` の要素）。deck の step と同じ `title` を文言にし、吹き出しのための項目を足す。
省いた項目は `defineChallenge` が既定値で埋める。

| 項目 | 型 | 既定 | 説明 |
|------|----|------|------|
| `title` | message \| null | null | 吹き出しの文言 |
| `target` | string \| null | null | 指す場所。パレット・コードエリア・ステージ・スプライトリスト・音タブ・コスチュームタブ・背景を選ぶ・拡張機能のボタン・旗・キーボード（場所の無いもの）。値の名前は吹き出しの実装で決める |
| `blocks` | string \| null | null | 吹き出しに描くブロック（Ruby。`code` と同じ変換でブロックにする） |
| `spotlight` | boolean | false | はじめて開いたチャレンジだけ、周りを暗くして `target` を照らす |

記録（下の「記録の形」）は **できたチャレンジだけ**を持つ。「はじめて開いたか」（`spotlight` の判定）は
記録には入れず、吹き出しの実装で別のキーに残す。

文言の message id の付け方: `gui.lessons.course.<id>.{name,badge}`・`gui.lessons.lesson.<id>.name`・
`gui.lessons.challenge.<id>.name`。`task` / `steps[].title` / `debug[]` / できること（`skills[].name`）も
同じ `gui.lessons.` の下に置き、3 locale（en / ja / ja-Hira）にそろえる（テストが解決できることを確かめる）。

`defineCourse` / `defineLesson` / `defineChallenge` は export してあるので、コースやレッスンが増えて
ファイルを分けるときも同じ形で定義できる。

レッスン 1 の 11 のチャレンジは、いまは `id`・名前・なかま（`category`）だけが入っている（中身は後から入れる）。

## 記録の形（端末）

`packages/scratch-gui/src/lib/lessons/lesson-progress.js`。localStorage の **`smalruby:lessonProgress`** に、
クラスに関係ない形で残す。

```json
{
  "version": 1,
  "challenges": {
    "blocks-l1-click-say": {
      "completedAt": "2026-11-10T01:02:03.000Z",
      "courseId": "kyou-kara-programmer",
      "lessonId": "blocks-l1"
    }
  }
}
```

- 同じチャレンジをもう一度できても、**最初にできた日時を残す**（クラスの課題に引き継ぐとき、
  課題の前からできていたものを分けるため）。
- localStorage が使えない・例外になる・中身が壊れているときは空の記録として扱い、落ちない。
- `exportProgress` が送るための形（`{challengeId, courseId, lessonId, completedAt}` の並び、できた順）を返す。

| 関数 | 説明 |
|------|------|
| `loadProgress(storage?)` / `saveProgress(progress, storage?)` | 読み書き（例外を出さない） |
| `markChallengeCompleted(progress, challengeId, completedAt)` | 「できた」にした新しい記録を返す |
| `mergeProgress(progress, other)` | 2 つの記録を合わせる（同じチャレンジは早い日時を残す） |
| `isChallengeCompleted(progress, challengeId)` | できたか |
| `lessonClearStatus(lesson, progress)` | `{cleared, completedCount, count, missingRequired}` |
| `completedSkills(progress)` | できることの一覧 |
| `exportProgress(progress)` | 送るための形 |

## できた の判定（`goal`）

レッスンモードのあいだ、エディタは VM の実行を見張り、チャレンジの `goal` を満たしたら記録に「できた」と
書いて「できた！」（身についた「できること」の一覧つき）を出す。**プログラムの形は見ない**（ブロックの
並び・個数は条件にしない。いろいろな作り方を認めるため）。ヒントの最後の手段「プログラムを入れる」で入れた
プログラムでも、動けば「できた」になる。

判定は `packages/scratch-gui/src/lib/lessons/goal.js`（純粋関数）、VM との接続は `goal-monitor.js`。

### `goal` の形

`goal` は **条件の配列**。全部を満たしたら「できた」。条件は `type` で分かれる。

| `type` | 見るもの | 項目 |
|--------|---------|------|
| `uses` | 決めたきっかけ（`trigger`）から始まったスクリプトで、決めたブロックが動いた | `trigger`（省略可）, `blocks`（必須）, `order` |
| `said` | 言った（考えた）文字 | `text`, `equalsAnswer`, `equalsVariable`, `answer`, `target` |
| `variable` | 変数の値（ステージの変数を先に探す） | `name`, `value` |
| `list` | リストの中身 | `name`, `length`, `itemsFromAnswers` |
| `sprites` | スプライトの数（クローンを除く） | `min` |
| `costumes` | コスチューム（`target: 'stage'` なら背景）の数が、チャレンジを開いたときより増えた。後から足したスプライトは数えない | `added`（既定 1）, `target` |
| `extension` | 拡張機能を読み込んだ | `id`（例: `text2speech`） |

**`uses` の項目**

- `trigger`: `{hat, key, message, target, sentBy}`。`hat` はハットの opcode（`event_whenkeypressed` /
  `event_whenflagclicked` / `event_whenthisspriteclicked` / `event_whenbroadcastreceived` など）。
  `key` はキー（`space` / `up arrow` / `1` ...。「どれかのキー」のスクリプトも合格）、`message` はメッセージ名、
  `target` は `'stage'` / `'sprite'`、`sentBy: 'other'` は「メッセージを別のスプライト（ステージ）が送った」。
  省くとどのハットから始まったスクリプトでもよい。コードエリアでスクリプトをクリックして動かしたものは
  数えない（きっかけが違う）。
- `blocks`: 動いたブロックの一覧。要素は opcode の文字列か `{opcode, count, args, distinct}`。
  - `count`: **1 回のスクリプトの実行（スレッド 1 本）の中で** その回数以上動いた（例: 背景を 6 回かえた）。
    「待つ」「繰り返す」のように待ちながら何度も呼ばれるブロックは、呼ばれた回数になる
  - `args`: 引数の条件（引数名 → 値の条件。例: `{DY: {gt: 0}}`）。条件に合う実行を数える
  - `distinct`: その引数の **ちがう値** が `count` 種類以上あった（例: `{opcode: 'looks_say', distinct: 'MESSAGE', count: 2}` =
    2 種類のセリフを言った）
  - 要素ごとに「きっかけに合うどれかのスクリプトの実行で満たした」を見るので、同じキーのスクリプトが 2 本に
    分かれていてもよい
- `order`: opcode の並び。1 回のスクリプトの実行の中で、それぞれの **最初の実行** がこの順だった
  （例: `['sensing_resettimer', 'sensing_askandwait']`）

**値の条件（matcher）**: 値そのもの（等しい）・RegExp（`test`）・`{eq, ne, gt, gte, lt, lte, includes, matches}`。
比べ方は Scratch と同じで、両方が数なら数として、そうでなければ文字（大文字小文字を区別しない）として比べる
（全角の「７」と 7 は等しくない）。

**`said` の項目**: `text`（matcher）、`equalsAnswer: true`（最後に「聞いて待つ」で入力した答えと同じ文字を言った）、
`equalsVariable: '<変数名>'`（言った時点のその変数の値と同じ）、`answer`（言った時点の最後の答えの条件。
例: `{eq: 7}` / `{ne: 7}`。まだ答えていなければ合わない）、`target`（`'stage'` / `'sprite'`）。
吹き出しを消す（空の文字）は記録しない。

**`list` の項目**: `length`（matcher。例: `{gte: 3}`）、`itemsFromAnswers: true`（中身が全部「聞いて待つ」に
入力した答え）。

`validateGoal(goal)` が形を確かめる（courses.js に入れる前のテスト用）。

### レッスン 1 の 11 のチャレンジの `goal`（例）

1-g で courses.js に入れるときの形。「できた の条件」（各 Issue の仕様）をこの形で書いたもの。

```js
// 1 キーで音を鳴らそう: スペースキーで、2 つの音が順に鳴った
[{ type: 'uses', trigger: { hat: 'event_whenkeypressed', key: 'space' }, blocks: ['sound_playuntildone', 'sound_play'], order: ['sound_playuntildone', 'sound_play'] }]

// 2 矢印キーで動かそう: 上と下の矢印キーで、ネコが上と下の両方に動いた
[
    { type: 'uses', trigger: { hat: 'event_whenkeypressed', key: 'up arrow' }, blocks: [{ opcode: 'motion_changeyby', args: { DY: { gt: 0 } } }] },
    { type: 'uses', trigger: { hat: 'event_whenkeypressed', key: 'down arrow' }, blocks: [{ opcode: 'motion_changeyby', args: { DY: { lt: 0 } } }] },
]

// 3 押したら話そう: コスチュームを 1 つ以上足し、ネコを押して、セリフが出て、コスチュームがかわった
[
    { type: 'costumes', added: 1 },
    { type: 'uses', trigger: { hat: 'event_whenthisspriteclicked' }, blocks: ['looks_sayforsecs', 'looks_nextcostume'] },
]

// 4 くり返そう: ステージの 1 のキーで、背景が 6 回かわった
[{ type: 'uses', trigger: { hat: 'event_whenkeypressed', key: '1', target: 'stage' }, blocks: ['control_repeat', { opcode: 'looks_switchbackdropto', count: 6 }] }]

// 5 もし〜なら: さわったときのセリフと、さわっていないときのセリフの両方が出た
[{ type: 'uses', trigger: { hat: 'event_whenflagclicked' }, blocks: ['sensing_touchingobject', { opcode: 'looks_say', distinct: 'MESSAGE', count: 2 }] }]

// 6 聞いて答えよう: リセット → 聞く の順で、入力した答えと、かかった秒数を言った
[
    {
        type: 'uses',
        trigger: { hat: 'event_whenthisspriteclicked' },
        blocks: ['sensing_resettimer', 'sensing_askandwait', 'sensing_answer', 'sensing_timer', { opcode: 'looks_sayforsecs', count: 2 }],
        order: ['sensing_resettimer', 'sensing_askandwait'],
    },
    { type: 'said', equalsAnswer: true },
]

// 7 クイズを作ろう: 7 を入れたら「正解です」、ほかの数で「ちがいます」と言った
[
    { type: 'said', text: '正解です', answer: { eq: 7 } },
    { type: 'said', text: 'ちがいます', answer: { ne: 7 } },
]

// 8 数えよう: 変数「回数」が 3 以上になり、その数を言った
[
    { type: 'variable', name: '回数', value: { gte: 3 } },
    { type: 'said', equalsVariable: '回数' },
]

// 9 なかまに合図しよう: スプライト 2 つ以上。ネコを押して送ったメッセージで、別のスプライトがセリフを言った
[
    { type: 'sprites', min: 2 },
    { type: 'uses', trigger: { hat: 'event_whenthisspriteclicked' }, blocks: ['event_broadcast'] },
    { type: 'uses', trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' }, blocks: ['looks_sayforsecs'] },
]

// 10 しゃべらせよう: 音声合成を足して、しゃべるブロックが動いた
[
    { type: 'extension', id: 'text2speech' },
    { type: 'uses', trigger: { hat: 'event_whenthisspriteclicked' }, blocks: ['text2speech_speakAndWait'] },
]

// 11 メッセージをためよう: リスト「トーク」に、入力したメッセージが 3 つ以上たまった
[{ type: 'list', name: 'トーク', length: { gte: 3 }, itemsFromAnswers: true }]
```

これらが形として書けて、意図したプログラムで満たされることは `test/unit/lib/lessons/goal.test.js` で確かめている。

### VM の見張り方（scratch-vm は変えない）

scratch-vm には「ブロックが動いた」を知らせるイベントが無い（`BLOCK_GLOW_ON` はクリックしたスクリプトだけ、
`SCRIPT_GLOW_ON` は編集中のスプライトだけ、Profiler は opcode ごとの回数だけでスレッドが分からない）。
そこで `vm-execution-hook.js` が **runtime インスタンスの `getOpcodeFunction` を包む**。execute.js がブロックの
関数（primitive）を取りに来たときに、呼び出しを記録してから元の関数へ渡すラッパーを返す。ラッパーは
`(args, util)` をそのまま受けるので、`util.thread` から **どのスレッド（＝どのハットから始まったスクリプト）か**
（`thread.topBlock` のブロック・`thread.target`・クリックで動かしたか `thread.stackClick`）と、引数の値が分かる。

| 事実 | 取り方 |
|------|--------|
| ブロックの実行（opcode・引数・スレッド） | 上のフック。スレッドの最初の実行で run（1 回のスクリプトの実行）を作る。モニター用のスレッド（`thread.updateMonitor`）は除く |
| きっかけ（ハット） | `thread.topBlock` のブロックの opcode とフィールド（`KEY_OPTION` / `BROADCAST_OPTION`） |
| 誰がメッセージを送ったか | `event_broadcast` / `event_broadcastandwait` の実行を記録（メッセージ名 → ターゲット id）。受け取ったスクリプトの run に送り主を持つ |
| 言った文字 | runtime の `SAY` イベント（`say` / `think` も。空の文字は吹き出しを消すだけなので記録しない）。言った時点の変数の値も一緒に持つ |
| 答え | runtime の `ANSWER` イベント |
| 変数・リスト・スプライト数・コスチューム数・拡張機能 | 判定のたびに VM を読む（`takeSnapshot`）。コスチューム数は見張りを始めたときの数と比べる |

注意:

- execute.js は取った関数を **ブロックごとの cache**（`BlockCached`）に持つので、見張りを始めるとき全ターゲットの
  `blocks.resetCache()` を呼んで、包む前に取られた関数を作り直させる。一度包んだら runtime の間は包んだまま
  （listener が無いときは元の関数を呼ぶだけ）。
- primitive の中から別の primitive を呼ぶもの（mesh v2 の broadcast など）は外側だけ記録する。
- 判定は、何か記録があったあとの次の step（runtime の `BEFORE_STEP`）で 1 回だけ行う（1 step に何度も判定しない）。
  スプライト・コスチューム・拡張機能の変化は `PROJECT_CHANGED` / `targetWasCreated` / `EXTENSION_ADDED` で判定を
  予約する。
- 記録は上限つき（run 200 本・言った文字 500・答え 500・1 ブロックの引数の組み合わせ 50 種）。ずっと動く
  プログラムでも増え続けない。
- 満たしたら見張りをやめる（1 チャレンジにつき「できた」は 1 回。同じチャレンジを開き直せばまた見張る）。

### 「できた！」の表示

`containers/lesson-goal-watcher.jsx`（gui.jsx に常時マウント）が、レッスンモードのあいだだけ見張りをつなぎ、
満たしたら `markChallengeCompleted` を dispatch して `components/lesson-completed-toast/` を出す。
記録にすでにある（前にできた）チャレンジでも「できた！」は出す（記録の日時は最初のまま）。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `lesson-completed-toast` | div | 「できた！」の toast |
| `lesson-completed-toast-title` | span | 「できた！」 |
| `lesson-completed-toast-challenge` | span | チャレンジの名前 |
| `lesson-completed-toast-skills` | div | できることの一覧（`skills` が無いチャレンジでは出ない） |
| `lesson-completed-toast-close` | button | 閉じる |

![できた！（1300×600）](screenshots/0101-completed-toast-1300x600.png)

デバッグ・テスト用に `window.smalruby.lessonGoal` を出している（integration テスト
`test/integration/lesson-goal.test.js` と pw-check が使う。レッスン表・レッスンモードの UI ができるまでの入口）:

| 関数 | 説明 |
|------|------|
| `attach(goal, onSatisfied)` | チャレンジを開かずに、いまの VM に goal をつないで試す。見張りをやめる関数を返す |
| `evaluateGoal` / `validateGoal` | goal.js の関数そのもの |
| `openChallenge(id)` / `closeLesson()` | チャレンジを開く / レッスンモードを抜ける（Redux の action） |
| `markCompleted(id)` | 「できた」にする（記録 + 「できた！」） |

## 状態（Redux）

`packages/scratch-gui/src/reducers/lesson-mode.js`（`state.scratchGui.lessonMode`）。

| 項目 | 説明 |
|------|------|
| `courseId` / `lessonId` / `challengeId` | いま開いているチャレンジ。`challengeId` が null ならレッスンモードではない |
| `pendingChallengeId` | 開こうとしているチャレンジ（新しい作品ができるまでの間だけ入る。下の「レッスンモード」） |
| `hintVisible` / `hintIndex` | ヒントの吹き出しを出しているか・何番めのヒントか（チャレンジを開く・閉じるたびに最初にもどる） |
| `progress` | 記録の写し（起動時に localStorage から読む） |
| `justCompletedId` | 「できた！」を出しているチャレンジ id（null なら出していない） |

| action / selector | 説明 |
|------|------|
| `startChallenge(challengeId)` | **チャレンジを開く入口**（レッスン表が呼ぶ）。新しい作品 → setup → `openChallenge` の順にコンテナが進める（知らない id は無視） |
| `cancelStartChallenge()` | 開こうとしていたチャレンジを取り消す（「保存しますか」で取りやめたとき） |
| `openChallenge(challengeId)` | レッスンモードに入る（作品の準備は済んでいる前提。知らない id は無視）。「できた！」は消す |
| `closeLesson()` | レッスンモードを抜ける（記録は残す） |
| `showHint()` / `hideHint()` / `nextHint()` / `prevHint()` | ヒントの吹き出しの出し入れと「進める・もどる」（ヒントが無いチャレンジでは出ない。両端で止まる） |
| `markChallengeCompleted(challengeId, completedAt?)` | 「できた」にして localStorage にも書く。書く前に localStorage の最新と合わせる（別のタブが書いた分を消さない）。`justCompletedId` をそのチャレンジにする（すでにできていても） |
| `dismissCompleted()` | 「できた！」を閉じる |
| `reloadProgress()` | localStorage の最新を写しに取り込む（別のタブが書いた分を、レッスン表を開くときなどに反映する。書かない） |
| `isLessonMode(state)` / `getCurrentChallenge(state)` | レッスンモードか / `{course, lesson, challenge}` |
| `getLessonAllowedBlocks(state)` | パレットに出すブロック（チャレンジの `allowedBlocks`。無ければ null）。Blocks コンテナがチュートリアルの `tutorialAllowedBlocks` より優先して使う |
| `getCurrentHint(state)` | `{visible, index, count, step}`（レッスンモードでなければ null）。吹き出しの実装はこれを読む |

## レッスン表

メニューバーの「レッスン」ボタン（upstream の「チュートリアル」ボタンがあった場所）を押すと開くモーダル
（`components/lessons-library/`。フルスクリーン、本文は不透明な白）。SP / iPad の `MobileGui` ではドロワーの
「レッスン」から開く。

![レッスン表（1300×600）](screenshots/0302-lessons-library-1300x600.png)

- **言語のタブ**: ブロック／Ruby／日本語。コースが無い言語は「準備中」と出す（いまはブロックだけ中身がある）。
- **コース › レッスン › チャレンジ**: コース名の次に、レッスンごとに「レッスン n」と名前、
  進み具合「**m / 全部で何個 できた（必須 x / y）**」、クリアしていれば「クリア！」。
  コースの全レッスンをクリアすると、コース名の横にクリアの印（「プログラマー デビュー！」）が付く。
- **チャレンジ**: 番号・なかまの色の丸（`category`。名前は `title` / `aria-label`）・名前・「必須」の印・
  「できた」の印（できたものは緑の背景）。押すと `startChallenge(id)` を呼んでレッスン表を閉じ、
  レッスンモードに入る。
- **できること**: コースの全チャレンジの `skills` を並び順に（同じ id は 1 つ）。できたチャレンジのものは
  色つき、まだのものは点線。どのチャレンジにも `skills` が無いあいだは出さない。
- **記録の取り込み**: 開くたびに `reloadProgress()` を呼び、別のタブで書いた記録も反映する。
- **やめる → もどる**: レッスンモードの「やめる」は `closeLesson()` のあとレッスン表を開く（次のチャレンジを
  すぐ選べる）。
- **はじめての人向けの吹き出し**: 「レッスン」ボタンの下に「レッスンをはじめよう！」（`menu-bar/lessons-tooltip.jsx`）。
  `tutorial-onboarding` reducer の `shouldShowTooltip` を流用し、レッスン表を一度開く（`markTutorialSeen`）と出ない
  （Ruby タブを使った人にも出ない）。

状態は `modals.lessonsLibrary`（`openLessonsLibrary` / `closeLessonsLibrary`）。コンテナは
`containers/lessons-library.jsx`（`gui.jsx` に常時マウントし、`modals.lessonsLibrary` が true の間だけ描く）。

1300×600（授業のパソコン）ではチャレンジ 11 個が 4 列・3 段に収まりスクロールしない。375 幅（SP 縦）では
1 列になり本文がスクロールする。

### data-testid（レッスン表）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `menu-bar-lessons` | div | メニューバーの「レッスン」ボタン |
| `lessons-tooltip` | div | 「レッスン」ボタンの下の、はじめての人向けの吹き出し（押すとレッスン表が開く） |
| `mobile-drawer-lessons` | button | SP のドロワーの「レッスン」 |
| `lessons-library` | div | レッスン表の本文（開いているときだけある） |
| `lessons-library-tab-<blocks\|ruby\|dncl>` | button | 言語のタブ（`aria-selected`） |
| `lessons-library-coming-soon` | p | コースが無い言語の「準備中」 |
| `lessons-library-course-<courseId>` | section | コース |
| `lessons-library-badge` | span | コースのクリアの印（全レッスンをクリアしたときだけ） |
| `lessons-library-lesson-<lessonId>` | section | レッスン |
| `lessons-library-progress` | span | 「m / n できた（必須 x / y）」 |
| `lessons-library-lesson-cleared` | span | レッスンの「クリア！」（クリアしたときだけ） |
| `lessons-library-challenge-<challengeId>` | button | チャレンジ（`data-completed="true\|false"`） |
| `lessons-library-challenge-required` | span | 「必須」の印 |
| `lessons-library-challenge-done` | span | 「できた」の印 |
| `lessons-library-skills` | div | できること（skills があるときだけ） |
| `lessons-library-skill-<skillId>` | li | できることの 1 つ（`data-done="true\|false"`） |

## レッスンモード

チャレンジを開いたときの画面。ふだんのエディタはそのまま使い、次を足す。

- **新しい作品から始める**: `startChallenge(id)` → いまの作品に変更があればメニューの「新規」と同じ
  「保存しますか」の確認（取りやめると `cancelStartChallenge`）→ 新しい作品（Google Drive のファイルとの
  結び付きも切る）→ 作品ができたらチャレンジの setup を適用 → `openChallenge(id)`。
  この流れは `containers/lesson-mode.jsx` が進める（作成中 → 表示中の遷移で「できた」を検出する）。
- **setup**: `lib/lessons/challenge-setup.js` の `setupForChallenge(course, challenge)` が
  `lib/deck-setup.js` に渡す形を作る。コースの言語から既定（ブロック = コードタブ、Ruby = Ruby タブ・Ruby
  モード、DNCL = Ruby タブ・DNCL モード）を決め、チャレンジの `setup` で上書きする。
- **課題バー**（`components/lesson-task-bar/`）: エディタ列（タブの上）に 1 行・40px で出す。
  「何個め / 全部で何個」・課題の 1 行（`task`。無ければチャレンジの名前）・ヒント・やめる。
  stage の列には掛からないので、1300×600 の授業のパソコンでもコードエリアは 40px 縮むだけ。
  SP（MobileGui）でも同じ場所に出る。
- **パレットを絞る**: チャレンジの `allowedBlocks`（deck と同じ形）。Blocks コンテナの `tutorialAllowedBlocks`
  にレッスンの分を優先して渡すので、仕組みはチュートリアルと同じ（`allowedBlocks` が null なら絞らない）。
- **ヒント**: 「ヒント」ボタンで `showHint` / `hideHint`。吹き出しの見た目と「進める・もどる」の操作は
  吹き出しの実装が `getCurrentHint` と `nextHint` / `prevHint` を使って作る（置き場所は
  `containers/lesson-mode.jsx` の `<LessonTaskBar>` の次）。ヒントが無いチャレンジではボタンが無効。
- **やめる**: `closeLesson()` のあとレッスン表を開く。課題バーが消え、パレットが元にもどる（作品はそのまま）。
- **いまのチュートリアル（カード）との関係**: 両方が同時に開くと、カードの `allowedBlocks` / setup と
  レッスンのものが食い違うので、どちらか一方だけにする。チャレンジを開くときは開いていたカードを閉じ
  （`closeCards`）、レッスンモード中に「?」メニューなどからチュートリアルを開く（`activateDeck`）と
  レッスンモードを抜ける（開こうとしていたチャレンジも取り消す）。

レッスン表のほかに、コンテナがマウント中は `window.smalruby.startChallenge(id)` で
`startChallenge` を呼べる（Playwright / Selenium から使う）。URL パラメータは作らない。

### data-testid

| data-testid | 要素 | 説明 |
|------------|------|------|
| `lesson-task-bar` | div | 課題バー全体（レッスンモードのときだけある） |
| `lesson-task-bar-position` | span | 「何個め / 全部で何個」 |
| `lesson-task-bar-task` | span | 課題の 1 行（長いときは省略記号。全文は `title`） |
| `lesson-task-bar-hint` | button | ヒントの吹き出しの出し入れ（ヒントが無ければ disabled） |
| `lesson-task-bar-quit` | button | やめる |

### スクリーンショット

| ファイル | 説明 |
|---------|------|
| `screenshots/0201-lesson-mode-1300x600.png` | 授業のパソコン（1300×600）でチャレンジ 3「押したら話そう」を開いたところ |
| `screenshots/0202-lesson-mode-667x375.png` | SP 横（MobileGui）で同じチャレンジを開いたところ |
| `screenshots/0301-lessons-button-1300x600.png` | メニューバーの「レッスン」ボタンと、はじめての人向けの吹き出し（1300×600） |
| `screenshots/0302-lessons-library-1300x600.png` | レッスン表（1300×600）。2 つできた状態 |
| `screenshots/0303-lessons-library-375x667.png` | レッスン表（SP 縦 375×667。1 列） |
| `screenshots/0304-lessons-library-cleared-1300x600.png` | レッスン 1 をクリアした状態（「クリア！」と「プログラマー デビュー！」） |

## いまのチュートリアルの入口

レッスン機能がチュートリアルの役目を引き継ぐため、従来の **「チュートリアル」「デバッグ」のボタンはメニューバーから外し、右上の「?」メニューの項目**にした（ふだんは目に入らないようにする。そろったら消す）。

- 「?」メニュー › チュートリアル → チュートリアル一覧（`tips-library`）
- 「?」メニュー › デバッグ → デバッグ画面（`debug-modal`）
- `?tutorial=<urlId>` で直接開く経路はそのまま動く（教科書や授業資料のリンク用）
- はじめての人向けの吹き出し（旧 `tutorial-tooltip`）は出さない。代わりに「レッスン」ボタンの下に吹き出しを出す（上の「レッスン表」）

詳細は [`docs/menu-bar/`](../menu-bar/) の「「?」メニュー（ヘルプ）」と [`docs/tutorial/`](../tutorial/) を参照。

## 主要ファイル

| ファイル | 説明 |
|---------|------|
| `packages/scratch-gui/src/lib/lessons/courses.js` | コース・レッスン・チャレンジのデータと検索 |
| `packages/scratch-gui/src/lib/lessons/lessons.locale.js` | 文言（en / ja / ja-Hira。`src/locales/*.js` に spread） |
| `packages/scratch-gui/src/lib/lessons/lesson-progress.js` | 端末への記録・クリア判定・できること |
| `packages/scratch-gui/src/lib/lessons/challenge-setup.js` | チャレンジを開くときの setup（言語の既定 + チャレンジの `setup`） |
| `packages/scratch-gui/src/lib/lessons/goal.js` | できた の判定（`goal` の形・事実の記録・判定の純粋関数・`validateGoal`） |
| `packages/scratch-gui/src/lib/lessons/vm-execution-hook.js` | ブロックの実行をスレッドつきで取るフック（runtime の `getOpcodeFunction` を包む） |
| `packages/scratch-gui/src/lib/lessons/goal-monitor.js` | VM を見張って goal を判定する（`attachGoalMonitor` / `takeSnapshot`） |
| `packages/scratch-gui/src/containers/lesson-goal-watcher.jsx` | レッスンモードのあいだ見張りをつなぎ、できたら記録して「できた！」を出す（gui.jsx に常時マウント） |
| `packages/scratch-gui/src/components/lesson-completed-toast/` | 「できた！」の表示 |
| `packages/scratch-gui/src/reducers/lesson-mode.js` | いま開いているチャレンジ・開こうとしているチャレンジ・ヒント・「できた！」・記録の写し |
| `packages/scratch-gui/src/containers/lesson-mode.jsx` | チャレンジを開く流れ（新しい作品 → setup → レッスンモード）と課題バーのマウント。`gui.jsx` のエディタ列の先頭に常時マウント |
| `packages/scratch-gui/src/components/lesson-task-bar/` | 課題バー（1 行・40px） |
| `packages/scratch-gui/src/components/lessons-library/` | レッスン表（モーダル） |
| `packages/scratch-gui/src/containers/lessons-library.jsx` | レッスン表のコンテナ（開くたびに記録を取り込む・チャレンジを押したら `startChallenge` + 閉じる）。`gui.jsx` に常時マウント（Smalruby マーカー `lessons library`） |
| `packages/scratch-gui/src/components/menu-bar/lessons-tooltip.jsx` | 「レッスン」ボタンの下の、はじめての人向けの吹き出し |
| `packages/scratch-gui/src/reducers/modals.js` | `lessonsLibrary` モーダルの開閉（Smalruby マーカー `lessons library`） |
| `packages/scratch-gui/src/components/mobile-drawer/mobile-drawer.jsx` | SP のドロワーの「レッスン」 |
| `packages/scratch-gui/src/containers/blocks.jsx` | `getLessonAllowedBlocks` でパレットを絞る（Smalruby マーカー `lesson mode`） |
| `packages/scratch-gui/test/unit/lib/lessons/` | データの形・記録・クリア判定・setup・できた の判定・見張りの unit テスト |
| `packages/scratch-gui/test/unit/reducers/lesson-mode-reducer.test.js` | reducer の unit テスト |
| `packages/scratch-gui/test/unit/components/lesson-completed-toast.test.jsx` / `test/unit/containers/lesson-goal-watcher.test.jsx` | 「できた！」と見張りのコンテナの unit テスト |
| `packages/scratch-gui/test/integration/lesson-goal.test.js` | 本物の VM に Ruby のプログラムを入れて動かし、判定が true になる integration テスト |
| `packages/scratch-gui/src/components/menu-bar/menu-bar.jsx` | 「レッスン」ボタンと吹き出し（`lessons button` マーカー）、「?」メニューのチュートリアル / デバッグ項目（`help menu` マーカー） |
| `packages/scratch-gui/src/containers/menu-bar-hoc.jsx` | `onOpenLessonsLibrary` / `showLessonsTooltip`（`lessons button` マーカー）と `onOpenTipsLibrary`（`help menu` マーカー）の供給 |
| `packages/scratch-gui/test/unit/components/lesson-task-bar.test.jsx` / `test/unit/containers/lesson-mode.test.jsx` | 課題バーとチャレンジを開く流れの unit テスト |
| `packages/scratch-gui/test/integration/smalruby-lessons.test.js` | チャレンジを開く → 課題バー・絞ったパレット → やめる → 元にもどる（Selenium） |
| `packages/scratch-gui/test/unit/components/lessons-library.test.jsx` / `test/unit/containers/lessons-library.test.jsx` / `test/unit/components/menu-bar-lessons.test.jsx` | レッスン表（できた印・進み具合・クリア表示・できること）、コンテナ、「レッスン」ボタンと吹き出しの unit テスト |
| `packages/scratch-gui/test/integration/smalruby-lessons-library.test.js` | メニューから開く → チャレンジを押す → レッスンモード → やめる → レッスン表にもどる・記録に合わせた「できた」と進み具合（Selenium） |

## 設定・データ永続化

| 種類 | キー | 説明 |
|------|------|------|
| localStorage | `smalruby:lessonProgress` | チャレンジ ID → できた日時（とコース・レッスン） |
| localStorage | `smalruby:tutorialSeen` | `true` なら「レッスン」ボタンの下の吹き出しを出さない（`tutorial-onboarding` reducer。レッスン表を一度開くと書く） |
