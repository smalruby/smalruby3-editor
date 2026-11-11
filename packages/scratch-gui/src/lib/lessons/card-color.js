// === Smalruby: This file is Smalruby-specific (lessons library card color) ===
// レッスン表のカードの色の決め方（docs/lessons/design.md の「カード」）。
// できあがりのプログラムのブロックを、なかまごとに数え、いちばん多いなかまの色にする。
// 同じ数で並んだら、そのチャレンジで覚えるメインのなかま。
// 変換（Ruby → ブロック）はここではしない（RubyToBlocksConverter は重いので、数えた結果を
// 定義に書いておき、unit テストで変換して決め方どおりかを確かめる）。

import { CATEGORIES } from './courses';

// opcode の接頭辞 → なかま。data_ は変数とリストに分かれる（下の LIST_OPCODE）
const PREFIX_CATEGORIES = [
    ['motion_', CATEGORIES.MOTION],
    ['looks_', CATEGORIES.LOOKS],
    ['sound_', CATEGORIES.SOUND],
    ['event_', CATEGORIES.EVENTS],
    ['control_', CATEGORIES.CONTROL],
    ['sensing_', CATEGORIES.SENSING],
    ['operator_', CATEGORIES.OPERATORS],
];

// リストのブロック（data_addtolist / data_deletealloflist / data_listcontents など）
const LIST_OPCODE = /list/;

/**
 * ブロックの opcode のなかま。接頭辞が分からないもの（text2speech_ など）は拡張機能。
 * @param {string} opcode - ブロックの opcode。
 * @returns {string} なかま（`CATEGORIES` の値）。
 */
export const blockCategoryOf = (opcode) => {
    if (opcode.startsWith('data_')) return LIST_OPCODE.test(opcode) ? CATEGORIES.LISTS : CATEGORIES.VARIABLES;
    const found = PREFIX_CATEGORIES.find(([prefix]) => opcode.startsWith(prefix));
    return found ? found[1] : CATEGORIES.EXTENSIONS;
};

/**
 * 形のあるブロック（帽子・値のブロックを含む）をなかまごとに数える。shadow（数の入力などの
 * 白い穴・▼のメニュー）は数えない。
 * @param {Array<{opcode: string, shadow: boolean}>} blocks - ブロック。
 * @returns {object} なかま → 数。
 */
export const countBlockCategories = (blocks) =>
    blocks.reduce((counts, block) => {
        if (block.shadow) return counts;
        const category = blockCategoryOf(block.opcode);
        return { ...counts, [category]: (counts[category] || 0) + 1 };
    }, {});

/**
 * カードの色のなかま: いちばん多いなかま。同じ数で並んだら main。
 * @param {object} counts - なかま → 数（`countBlockCategories`）。
 * @param {string} main - そのチャレンジで覚えるメインのなかま。
 * @returns {?string} なかま。ブロックが無ければ main。
 */
export const cardCategoryFor = (counts, main) => {
    const max = Math.max(0, ...Object.values(counts));
    const top = Object.keys(counts).filter((category) => counts[category] === max);
    if (top.length === 0 || top.includes(main)) return main;
    return top.length === 1 ? top[0] : null;
};
