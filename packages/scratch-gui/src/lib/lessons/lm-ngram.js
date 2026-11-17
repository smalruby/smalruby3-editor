// === Smalruby: This file is Smalruby-specific (character n-gram for the course 「ことばを予想する AI をつくろう」) ===
// 「ことばを予想する AI をつくろう」の文字単位の n-gram を、ブロックの AI と同じ決まりで計算する純粋関数。
// 判定（goal.js の `ngram` と said の `learned`）と、教科書の文のテストが使う。決まりは
// docs/lessons/design.md の「ことばを予想する AI をつくろう」の「しくみ（モデル）」:
//   - 文脈 = その文字の前の、最後の `length` 文字（文の頭では短く、いちばん頭では空）
//   - 学習 = 文の 1 文字ごとに（文脈 → その文字）を 1 組。数えない（出てきた回数だけ組がある）
//   - こうほ = 「まえ」が文脈と同じ行の「つぎ」（同じ文字が何回も入る）
// 文字の比べ方は Scratch の `=` と同じく大文字小文字を区別しない（ブロックの AI の「まえ = 文脈」と同じ結果に
// するため）。

/**
 * Scratch の `=` で文字どうしを比べるときのキー（大文字小文字を区別しない）。
 * @param {*} value - 値。
 * @returns {string} 比べるためのキー。
 */
export const ngramKey = (value) => String(value).toLowerCase();

/**
 * 文の `pos` 文字めの前の文脈（最後の `length` 文字）。
 * @param {string} text - 文。
 * @param {number} pos - 何文字めの前か（0 から）。
 * @param {number} length - 見る長さ（1 以上）。
 * @returns {string} 文脈（文の頭では短い・空）。
 */
export const contextBefore = (text, pos, length) => String(text).slice(Math.max(0, pos - length), pos);

/**
 * 文の並びから、学習でできる（文脈 → 次の文字）の組の並び。
 * @param {Array<string>} sentences - 教科書の文。
 * @param {number} length - 見る長さ。
 * @returns {Array<Array<string>>} `[まえ, つぎ]` の並び（教科書の順）。
 */
export const pairsOf = (sentences, length) => {
    const pairs = [];
    sentences.forEach((sentence) => {
        const text = String(sentence);
        for (let pos = 0; pos < text.length; pos += 1) {
            pairs.push([contextBefore(text, pos, length), text[pos]]);
        }
    });
    return pairs;
};

/**
 * 「まえ」「つぎ」の 2 つのリストを組の並びにする（短いほうに合わせる）。
 * @param {Array<*>} before - リスト「まえ」の中身。
 * @param {Array<*>} after - リスト「つぎ」の中身。
 * @returns {Array<Array<string>>} `[まえ, つぎ]` の並び。
 */
export const pairsFromLists = (before, after) => {
    const count = Math.min(before.length, after.length);
    const pairs = [];
    for (let i = 0; i < count; i += 1) pairs.push([String(before[i]), String(after[i])]);
    return pairs;
};

const pairKey = ([before, after]) => `${ngramKey(before)}\u0000${ngramKey(after)}`;

const countKeys = (keys) => {
    const counts = new Map();
    keys.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
    return counts;
};

/**
 * 2 つの並びが、順番を問わず同じものを同じ数だけ持つか（多重集合として等しいか）。
 * @param {Array<string>} a - キーの並び。
 * @param {Array<string>} b - キーの並び。
 * @returns {boolean} 等しければ true。
 */
export const sameMultiset = (a, b) => {
    if (a.length !== b.length) return false;
    const counts = countKeys(a);
    return b.every((key) => {
        const n = counts.get(key) || 0;
        if (n === 0) return false;
        counts.set(key, n - 1);
        return true;
    });
};

/**
 * 組の並びが、順番を問わず同じか（学習した順はちがってよい）。
 * @param {Array<Array<string>>} a - 組の並び。
 * @param {Array<Array<string>>} b - 組の並び。
 * @returns {boolean} 同じなら true。
 */
export const samePairs = (a, b) => sameMultiset(a.map(pairKey), b.map(pairKey));

/**
 * いまの文の最後の文脈の次に来うる文字（「こうほを集める」の答え）。
 * @param {Array<*>} before - リスト「まえ」の中身。
 * @param {Array<*>} after - リスト「つぎ」の中身。
 * @param {string} text - いまの文。
 * @param {number} length - 見る長さ。
 * @returns {Array<string>} こうほ（「まえ」の順。同じ文字が何回も入る）。
 */
export const candidatesFor = (before, after, text, length) => {
    const value = String(text);
    const context = ngramKey(contextBefore(value, value.length, length));
    return pairsFromLists(before, after)
        .filter(([b]) => ngramKey(b) === context)
        .map(([, a]) => a);
};

/**
 * 文が、学習した組だけでできているか（どの文字も、その前の文脈から学習した組にある）。
 * @param {string} text - 文。
 * @param {Array<*>} before - リスト「まえ」の中身。
 * @param {Array<*>} after - リスト「つぎ」の中身。
 * @param {number} length - 見る長さ。
 * @param {number} [from] - 何文字めから確かめるか（0 から。入力した書き出しは学習していなくてよい）。
 * @returns {boolean} 学習した組だけなら true（確かめる文字が無ければ false）。
 */
export const isLearnedText = (text, before, after, length, from = 0) => {
    const value = String(text);
    if (value.length <= from) return false;
    const known = new Set(pairsFromLists(before, after).map(pairKey));
    for (let pos = from; pos < value.length; pos += 1) {
        if (!known.has(pairKey([contextBefore(value, pos, length), value[pos]]))) return false;
    }
    return true;
};
