// === Smalruby: This file is Smalruby-specific (lesson insert code for other sprites) ===
// 「プログラムを入れる」で、チャレンジの `spriteCodes`（名前で決めたスプライトのプログラム）を
// 入れる。2 つのスプライトでやりとりするチャレンジ（レッスン 1 のチャレンジ 9: ネコとペンギン）用。
// Ruby タブは編集中のスプライト 1 つに向けて変換するので、ほかのスプライトには Ruby タブを通さず
// 変換して直接入れる（genai-code-adapter の loadCode と同じ: targetCodeToBlocks → apply）。
import spriteLibraryContent from '../libraries/sprites.json';

// ライブラリから足したスプライトを置く場所。ネコ（真ん中）と重ならないように右に置く
// （ライブラリの「スプライトを選ぶ」は真ん中あたりのランダムな場所に置く）
export const ADDED_SPRITE_POSITION = Object.freeze({ x: 150, y: 0 });

export const spritesOf = (vm) => vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage);

/**
 * 名前でスプライトを探す。
 * @param {object} vm - Scratch VM。
 * @param {string} name - スプライトの名前。
 * @returns {?object} スプライト（元の target）。無ければ null。
 */
export const findSpriteByName = (vm, name) => spritesOf(vm).find((t) => t.getName() === name) || null;

/**
 * `spriteCodes` のほかに、チャレンジの `code` を入れるスプライトを探す。`preferred`（チャレンジの
 * `setup.sprites` の 1 つめ = 始めるときに置きかえたスプライト）がいればそれ、いなければ `spriteCodes` に
 * 名前の無い最初のスプライト（ネコ）。
 * @param {object} vm - Scratch VM。
 * @param {Array<{sprite: string}>} spriteCodes - スプライトの名前とプログラム。
 * @param {?string} [preferred] - 先に探すスプライトの名前。
 * @returns {?object} スプライト。いなければ null。
 */
export const findCodeSprite = (vm, spriteCodes, preferred = null) => {
    const found = preferred ? findSpriteByName(vm, preferred) : null;
    if (found) return found;
    const names = spriteCodes.map((s) => s.sprite);
    return spritesOf(vm).find((t) => !names.includes(t.getName())) || null;
};

/**
 * ライブラリのスプライトを足す。
 * @param {object} vm - Scratch VM。
 * @param {string} name - ライブラリのスプライトの名前（例: `Penguin`）。
 * @param {Array<object>} library - スプライトのライブラリ（sprites.json の形）。
 * @param {{x: number, y: number}} [position] - 置く場所（既定はネコの右）。
 * @returns {Promise<?object>} 足したスプライト。ライブラリに無ければ null。
 */
export const addLibrarySprite = async (vm, name, library, position = ADDED_SPRITE_POSITION) => {
    const item = library.find((s) => s.name === name);
    if (!item) return null;
    // 足したスプライトは、足す前後のスプライトの差分で取る（同じ名前のスプライトがあると VM は名前を変えて
    // 足すので、名前で探すと前からいたほうを取ってしまう）
    const before = new Set(spritesOf(vm).map((t) => t.id));
    await vm.addSprite(JSON.stringify({ ...item, ...position }));
    return spritesOf(vm).find((t) => !before.has(t.id)) || null;
};

/**
 * `code` を入れるスプライト（「プログラムを入れる」とチャレンジの始め方で同じ決め方）。`spriteCodes` があれば
 * `findCodeSprite`（`preferred`、いなければ `spriteCodes` に名前の無い最初のスプライト）、無ければ `preferred`
 * のスプライト。どちらも無ければ null（呼ぶ側が、いま編集中のスプライトに入れる）。
 * @param {object} vm - Scratch VM。
 * @param {Array<{sprite: string}>} spriteCodes - スプライトの名前とプログラム。
 * @param {?string} [preferred] - `setup.sprites` の 1 つめ。
 * @returns {?object} スプライト。
 */
export const resolveCodeSprite = (vm, spriteCodes, preferred = null) => {
    if (spriteCodes.length > 0) return findCodeSprite(vm, spriteCodes, preferred);
    return preferred ? findSpriteByName(vm, preferred) : null;
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
 * @param {?string} [options.preferred] - `code` を入れるスプライトの名前（`setup.sprites` の 1 つめ）。
 * @returns {Promise<?object>} `code` を入れるスプライト（`preferred`、いなければ `spriteCodes` に無い最初の
 *   スプライト = ネコ）。
 *   いなければ null。
 */
export const insertSpriteCodes = async (
    vm,
    spriteCodes,
    { toBlocks, library = spriteLibraryContent, preferred = null },
) => {
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
    return findCodeSprite(vm, spriteCodes, preferred);
};
