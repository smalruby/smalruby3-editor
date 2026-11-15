const Cast = require('../../util/cast');

/**
 * 値つきメッセージ（「(メッセージ1 ▼) といっしょに ( ) を送る」）の値の決まり。
 *
 * - 値は文字列にして送る。数は "42" のような文字列になるが、Scratch の値の扱い
 *   （Cast）で数として読めるので、受け取った側の「+」や比較はそのまま動く。
 * - 長さはサーバー側の上限（infra #1846）と同じ 1,000 文字までに切り詰める。
 *   JavaScript の length（UTF-16 の単位）で数える。サーバーのリゾルバも同じ数え方。
 */
const MAX_MESSAGE_VALUE_LENGTH = 1000;

/**
 * 値つきメッセージで動き出したスレッドに、そのときの値を持たせるプロパティ名。
 * 「メッセージの値」はスクリプトごと（スレッドごと）に値を読む（EPIC #1842 Q5）。
 */
const THREAD_MESSAGE_VALUE_KEY = 'meshV2MessageValue';

/**
 * 送る値を文字列にして、上限の長さに切り詰める。
 * @param {*} value - ブロックの引数の値。
 * @returns {string} 送る値。
 */
const toMessageValue = (value) => {
    if (value === null || typeof value === 'undefined') return '';
    let text = Cast.toString(value);
    if (text.length > MAX_MESSAGE_VALUE_LENGTH) {
        text = text.slice(0, MAX_MESSAGE_VALUE_LENGTH);
        // サロゲートペアの片方だけが残ると文字化けするので落とす。
        const last = text.charCodeAt(text.length - 1);
        if (last >= 0xd800 && last <= 0xdbff) {
            text = text.slice(0, -1);
        }
    }
    return text;
};

module.exports = {
    MAX_MESSAGE_VALUE_LENGTH,
    THREAD_MESSAGE_VALUE_KEY,
    toMessageValue,
};
