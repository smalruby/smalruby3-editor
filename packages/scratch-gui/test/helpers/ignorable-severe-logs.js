// === Smalruby: This file is Smalruby-specific (統合テストで無視できる SEVERE ログの判定) ===

/**
 * 機能に影響しない既知の SEVERE ブラウザログか判定する。
 *
 * 1. upstream の `ConfirmationPrompt` React key 警告
 *    (StageHeaderComponent → ConfirmationPrompt)。Chrome は SEVERE で出すが既知の upstream 問題。
 * 2. 自前ホストした Monaco (#1171) の editor worker が `file://` から読めない件。
 *    Monaco は worker を「blob + `importScripts(<worker の URL>)`」で生成する。blob worker は
 *    opaque origin (`blob:null`) なので、新しめの Chrome は `file:` スクリプトの importScripts を
 *    拒否し、worker の読み込みだけが失敗する。統合テストはビルド成果物を `file://` で開くため
 *    この経路に当たる (CDN 配信時代は worker の URL が https だったので起きなかった)。
 *    **本番配信は http(s) の同一オリジンなので worker は通常どおり読める**。worker が無くても
 *    エディタ本体は動作するため、ルビータブの他の統合テストは通っている。
 * 3. Google Drive API の初期化失敗。`GOOGLE_CLIENT_ID` / `GOOGLE_API_KEY` の無いビルド
 *    (コンテナ・CI) では読み込みの数秒後に `console.error` で出る。Drive 連携を使わない
 *    テストには関係が無い。
 * 4. Google のスクリプト・画像 (`apis.google.com/js/api.js`・`www.google.com/images/cleardot.gif`)
 *    `csi.gstatic.com/csi`（gapi の計測ビーコン）の取得失敗と、それを受けた「Failed to load Google scripts」。devpod の egress firewall が
 *    Google を通さないため `ERR_CONNECTION_REFUSED` などになる（環境由来で、アプリの不具合ではない。
 *    Drive 連携を使わないテストには関係が無い）。
 * 5. 翻訳の無い文言の `MISSING_TRANSLATION`（react-intl が default message へ fallback した通知）。
 *    Smalruby 独自の文言は en / ja / ja-Hira にしか無いので、ほかの言語へ切り替える
 *    localization のテストで大量に出る。表示は英語の既定文言で崩れない。
 * 6. connection-modal のテストがわざと繋がらない `wss://fake.fake/` を使うときの WebSocket 失敗。
 * 7. upstream 由来の既存の警告（getLogs() が SEVERE を返していなかった間に隠れていたもの。
 *    動作には影響しないが本来は直すべきもので、follow-up で扱う）:
 *    - `Prompt` / `RecordModal` が `Modal` に必須の `id` を渡していない prop type 警告
 *      （変数・リストの作成ダイアログ / 音の録音ダイアログ）
 *    - `ListMonitor` の `value` の prop type 警告（リストモニターに配列が渡る）と、
 *      リストモニターの入力欄に `autoComplete={false}` を渡している DOM 属性の警告
 *    - scratch-blocks の `Attempted to focus unregistered node`（ツールボックスのブロックのクリック後など）
 *
 * ここが「既知の無害なログ」の唯一の一覧。各テストに同じ判定をコピーしないこと。
 * @param {string} message ブラウザログのメッセージ。
 * @returns {boolean} 無視してよいログなら true。
 */
const isIgnorableSevereLog = (message) =>
    /Each child in a list should have a unique .{1,3}key.{1,3} prop/.test(message) ||
    // worker アセットの取得失敗 (blob worker の importScripts / リソース取得エラー)。
    // `loader.js` や `editor.main.js` の取得失敗は Monaco 自体が読めていない状態なので
    // ここには含めない（本当のリグレッションとして落としたい）。
    // 配信パスは `static/monaco/<版>/vs/` (#1318)。
    /static[\\/]monaco[\\/][\w.+-]+[\\/]vs[\\/]assets[\\/][\w.]+\.worker-[\w-]+\.js/.test(message) ||
    // 上記 worker エラーが Monaco のチャンクから uncaught として再送出されたもの。
    // 中身の無い `[object ErrorEvent]` に限定する（通常の例外はメッセージを持つ）。
    (/static[\\/]monaco[\\/][\w.+-]+[\\/]vs[\\/]/.test(message) && /\[object ErrorEvent\]/.test(message)) ||
    /Failed to initialize Google Drive API/.test(message) ||
    /\/\/(?:www\.google\.com\/images\/cleardot\.gif|apis\.google\.com\/js\/api\.js|csi\.gstatic\.com\/csi\?\S*) .*net::ERR_/.test(
        message,
    ) ||
    /"Failed to load Google scripts:"/.test(message) ||
    /\[@formatjs\/intl Error MISSING_TRANSLATION\]/.test(message) ||
    /WebSocket connection to 'wss:\/\/fake\.fake\/' failed/.test(message) ||
    (/The prop `id` is marked as required in `Modal`/.test(message) && /at (?:PromptComponent|RecordModal) /.test(message)) ||
    /Invalid prop `value` supplied to `ListMonitor`/.test(message) ||
    (/for a non-boolean attribute/.test(message) && /"autoComplete"/.test(message) && /at ListMonitorScroller /.test(message)) ||
    /Uncaught Error: Attempted to focus unregistered node/.test(message);

/**
 * ログのレベルを名前 (`'SEVERE'` など) にそろえる。
 * selenium-webdriver の `logging.Entry#level` は `logging.Level` のオブジェクト (`{name, value}`)
 * なので、文字列と直接比べると常に不一致になる (#1481 の原因)。文字列が来ても扱えるようにする。
 * @param {string|{name: string}|undefined} level ログのレベル。
 * @returns {string} レベル名。取れなければ空文字。
 */
const levelName = (level) => {
    if (typeof level === 'string') return level;
    return (level && level.name) || '';
};

/**
 * upstream の既定の whitelist（含まれていれば除外する部分文字列）。
 */
const DEFAULT_LOG_WHITELIST = ['The play() request was interrupted by a call to pause()'];

/**
 * ブラウザログを `getLogs()` の規則で絞り込む（`SeleniumHelper#getLogs` の本体）。
 * - 既定では SEVERE だけを返し、既知の無害なログ (`isIgnorableSevereLog`) を除く。
 * - `whitelist` に含まれる部分文字列を持つログは除く（指定が無ければ upstream の既定）。
 * - `includeAllLevels` が true なら全レベルをそのまま返す（デバッグ用。無害ログも残す）。
 * @param {Array<{level: (string|{name: string}), message: string}>} entries ブラウザログ。
 * @param {{whitelist?: Array<string>, includeAllLevels?: boolean}} [options] 絞り込みの指定。
 * @returns {Array<object>} 残ったログ。
 */
const filterBrowserLogs = (entries, options = {}) => {
    const whitelist = options.whitelist || DEFAULT_LOG_WHITELIST;
    const includeAllLevels = options.includeAllLevels === true;
    return entries.filter((entry) => {
        const message = String(entry.message);
        if (whitelist.some((allowed) => message.indexOf(allowed) !== -1)) return false;
        if (includeAllLevels) return true;
        return levelName(entry.level) === 'SEVERE' && !isIgnorableSevereLog(message);
    });
};

/**
 * SEVERE ログのうち、無視できないものだけを返す。
 * @param {Array<{level: {name: string}, message: string}>} logs
 *     `getLogs({includeAllLevels: true})` の戻り値。
 * @returns {Array<object>} 無視できない SEVERE ログ。
 */
const unexpectedSevereLogs = (logs) =>
    logs.filter((l) => levelName(l.level) === 'SEVERE').filter((l) => !isIgnorableSevereLog(l.message));

export { DEFAULT_LOG_WHITELIST, filterBrowserLogs, isIgnorableSevereLog, levelName, unexpectedSevereLogs };
