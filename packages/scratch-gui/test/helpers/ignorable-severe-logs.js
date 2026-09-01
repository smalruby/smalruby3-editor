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
 * @param {string} message ブラウザログのメッセージ。
 * @returns {boolean} 無視してよいログなら true。
 */
const isIgnorableSevereLog = (message) =>
    /Each child in a list should have a unique .{1,3}key.{1,3} prop/.test(message) ||
    // worker アセットの取得失敗 (blob worker の importScripts / リソース取得エラー)。
    // `loader.js` や `editor.main.js` の取得失敗は Monaco 自体が読めていない状態なので
    // ここには含めない（本当のリグレッションとして落としたい）。
    /static[\\/]monaco[\\/]vs[\\/]assets[\\/][\w.]+\.worker-[\w-]+\.js/.test(message) ||
    // 上記 worker エラーが Monaco のチャンクから uncaught として再送出されたもの。
    // 中身の無い `[object ErrorEvent]` に限定する（通常の例外はメッセージを持つ）。
    (/static[\\/]monaco[\\/]vs[\\/]/.test(message) && /\[object ErrorEvent\]/.test(message));

/**
 * SEVERE ログのうち、無視できないものだけを返す。
 * @param {Array<{level: {name: string}, message: string}>} logs
 *     `getLogs({includeAllLevels: true})` の戻り値。
 * @returns {Array<object>} 無視できない SEVERE ログ。
 */
const unexpectedSevereLogs = (logs) =>
    logs.filter((l) => l.level.name === 'SEVERE').filter((l) => !isIgnorableSevereLog(l.message));

export { isIgnorableSevereLog, unexpectedSevereLogs };
