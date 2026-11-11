// === Smalruby: This file is Smalruby-specific (lesson insert code for other sprites) ===
// 「プログラムを入れる」で、チャレンジの `spriteCodes`（名前で決めたスプライトのプログラム）を
// 入れる。2 つのスプライトでやりとりするチャレンジ（レッスン 1 のチャレンジ 9: ネコとペンギン）用。
// Ruby タブは編集中のスプライト 1 つに向けて変換するので、ほかのスプライトには Ruby タブを通さず
// 変換して直接入れる（genai-code-adapter の loadCode と同じ: targetCodeToBlocks → apply）。

import spriteLibraryContent from '../libraries/sprites.json';

// ライブラリから足したスプライトを置く場所。ネコ（真ん中）と重ならないように右に置く
// （ライブラリの「スプライトを選ぶ」は真ん中あたりのランダムな場所に置く）
const ADDED_SPRITE_POSITION = Object.freeze({ x: 150, y: 0 });

const spritesOf = (vm) => vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage);

/**
 * 名前でスプライトを探す。
 * @param {object} vm - Scratch VM。
 * @param {string} name - スプライトの名前。
 * @returns {?object} スプライト（元の target）。無ければ null。
 */
export const findSpriteByName = (vm, name) => spritesOf(vm).find((t) => t.getName() === name) || null;

/**
 * ライブラリのスプライトを足す。
 * @param {object} vm - Scratch VM。
 * @param {string} name - ライブラリのスプライトの名前（例: `Penguin`）。
 * @param {Array<object>} library - スプライトのライブラリ（sprites.json の形）。
 * @returns {Promise<?object>} 足したスプライト。ライブラリに無ければ null。
 */
const addLibrarySprite = async (vm, name, library) => {
    const item = library.find((s) => s.name === name);
    if (!item) return null;
    await vm.addSprite(JSON.stringify({ ...item, ...ADDED_SPRITE_POSITION }));
    return findSpriteByName(vm, name);
};

/**
 * `spriteCodes` のプログラムを、それぞれのスプライトに入れる。スプライトがいなければライブラリから
 * 足す（子どもがヒントの途中で「プログラムを入れる」を押しても動くように）。入れたあと、残りの
 * プログラム（チャレンジの `code`）を入れるスプライトを返す。
 * @param {object} vm - Scratch VM。
 * @param {Array<{sprite: string, code: string}>} spriteCodes - スプライトの名前とプログラム。
 * @param {object} options - 変換とライブラリ。
 * @param {Function} options.toBlocks - `(target, code) => Promise<converter>`（targetCodeToBlocks）。
 * @param {Array<object>} [options.library] - スプライトのライブラリ（テスト用。既定は sprites.json）。
 * @returns {Promise<?object>} `code` を入れるスプライト（`spriteCodes` に無い最初のスプライト = ネコ）。
 *   いなければ null。
 */
export const insertSpriteCodes = async (vm, spriteCodes, { toBlocks, library = spriteLibraryContent }) => {
    for (const { sprite, code } of spriteCodes) {
        const target = findSpriteByName(vm, sprite) || (await addLibrarySprite(vm, sprite, library));
        if (!target) {
            // eslint-disable-next-line no-console
            console.warn(`[lesson-hint] the sprite "${sprite}" is not in the library`);
            continue;
        }
        const converter = await toBlocks(target, code);
        if (converter.result) {
            await converter.apply();
        } else {
            // eslint-disable-next-line no-console
            console.warn(`[lesson-hint] the code for "${sprite}" did not convert:`, converter.errors);
        }
    }
    const names = spriteCodes.map((s) => s.sprite);
    return spritesOf(vm).find((t) => !names.includes(t.getName())) || null;
};
