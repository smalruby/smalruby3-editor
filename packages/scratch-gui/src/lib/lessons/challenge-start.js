// チャレンジを始めるときの作品の準備（`setup` のうち、deck-setup が扱わないもの）。
//   - `setup.sprites`: 新しい作品のネコを、ライブラリのスプライトに置きかえる（例 `['Shimaraby', 'Shimacat']`）。
//     1 つめはネコのいた場所、2 つめ以降は「プログラムを入れる」で足すときと同じ、ネコと重ならない右の場所に置く。
//     1 つめが `code` の入る先になる
//   - `setup.code` / `setup.spriteCodes` / `setup.stageCode`: 前の段の答え（Ruby）を入れておく。形はチャレンジの
//     `code` / `spriteCodes` と同じで、locale ごとにも書ける（courses.js の localizeCode）。生徒の前の作品ではない
// 変換して入れるのは「プログラムを入れる」の spriteCodes と同じ（targetCodeToBlocks → apply）。
import spriteLibraryContent from '../libraries/sprites.json';
import { localizeCode } from './courses';
import {
    ADDED_SPRITE_POSITION,
    addLibrarySprite,
    findSpriteByName,
    insertSpriteCodes,
    spritesOf,
} from './insert-sprite-code';

// 2 つめ以降のスプライトの間隔（3 つめからは下へずらす。このコースは 2 つまで）
const NEXT_SPRITE_GAP_Y = 100;

const warn = (...args) => {
    // eslint-disable-next-line no-console
    console.warn('[lesson-start]', ...args);
};

/**
 * 始めるときに作品へ何かするか（`sprites` か答えのプログラムがあるか）。
 * @param {?object} setup - チャレンジの setup（setupForChallenge の戻り値）。
 * @returns {boolean} するなら true。
 */
export const hasChallengeStart = (setup) =>
    Boolean(
        setup &&
        ((Array.isArray(setup.sprites) && setup.sprites.length > 0) ||
            setup.code ||
            setup.stageCode ||
            (Array.isArray(setup.spriteCodes) && setup.spriteCodes.length > 0)),
    );

/**
 * 作品のスプライト（新しい作品ならネコ）を、ライブラリのスプライトに置きかえる。ライブラリに 1 つも
 * 見つからないときは何もしない（ネコを消して空の作品にしない）。
 * @param {object} vm - Scratch VM。
 * @param {Array<string>} names - ライブラリのスプライトの名前（並び順）。
 * @param {object} [options] - ライブラリ。
 * @param {Array<object>} [options.library] - スプライトのライブラリ（テスト用。既定は sprites.json）。
 * @returns {Promise<Array<object>>} 足したスプライト（並び順）。
 */
export const replaceStartSprites = async (vm, names, { library = spriteLibraryContent } = {}) => {
    const before = spritesOf(vm);
    const first = before[0];
    const home = first ? { x: first.x || 0, y: first.y || 0 } : { x: 0, y: 0 };
    const added = [];
    for (const name of names) {
        const index = added.length;
        const position =
            index === 0
                ? home
                : { x: ADDED_SPRITE_POSITION.x, y: ADDED_SPRITE_POSITION.y - NEXT_SPRITE_GAP_Y * (index - 1) };
        const target = await addLibrarySprite(vm, name, library, position);
        if (target) added.push(target);
        else warn(`the sprite "${name}" is not in the library`);
    }
    if (added.length === 0) return added;
    for (const target of before) {
        if (!added.includes(target)) vm.deleteSprite(target.id);
    }
    vm.setEditingTarget(added[0].id);
    return added;
};

/**
 * 1 つのプログラムを変換して入れる。変換できなければ入れない（ほかのプログラムは入れ続ける）。
 * @param {object} target - 入れる相手。
 * @param {?string} code - Ruby。
 * @param {Function} toBlocks - `(target, code) => Promise<converter>`（targetCodeToBlocks）。
 * @returns {Promise<void>} 入れ終わったら。
 */
const insertCode = async (target, code, toBlocks) => {
    if (!target || !code) return;
    const converter = await toBlocks(target, code);
    if (converter.result) await converter.apply();
    else warn(`the starting code for "${target.getName()}" did not convert:`, converter.errors);
};

/**
 * チャレンジを始めるときの作品の準備をする（新しい作品ができて、deck-setup のあと）。
 * スプライトを置きかえてから、ステージ → `spriteCodes` → `code` の順にプログラムを入れ、
 * `code` を入れたスプライト（`sprites` の 1 つめ）を編集中にする。
 * @param {object} vm - Scratch VM。
 * @param {?object} setup - チャレンジの setup。
 * @param {object} options - 変換と locale。
 * @param {Function} options.toBlocks - `(target, code) => Promise<converter>`（targetCodeToBlocks）。
 * @param {string} options.locale - いまの locale（locale ごとに書いたプログラムを選ぶ）。
 * @param {Array<object>} [options.library] - スプライトのライブラリ（テスト用）。
 * @returns {Promise<boolean>} 作品を変えたら true（Ruby タブのプログラムを作り直すため）。
 */
export const applyChallengeStart = async (vm, setup, { toBlocks, locale, library = spriteLibraryContent }) => {
    if (!vm || !vm.runtime || !hasChallengeStart(setup)) return false;
    const names = Array.isArray(setup.sprites) ? setup.sprites : [];
    if (names.length > 0) await replaceStartSprites(vm, names, { library });
    const preferred = names[0] || null;
    const codeSprite = (preferred && findSpriteByName(vm, preferred)) || vm.editingTarget || spritesOf(vm)[0];

    await insertCode(vm.runtime.getTargetForStage(), localizeCode(setup.stageCode, locale), toBlocks);
    const spriteCodes = (setup.spriteCodes || [])
        .map(({ sprite, code }) => ({
            sprite,
            code: localizeCode(code, locale),
        }))
        .filter((s) => s.code);
    if (spriteCodes.length > 0) await insertSpriteCodes(vm, spriteCodes, { toBlocks, library, preferred });
    await insertCode(codeSprite, localizeCode(setup.code, locale), toBlocks);
    if (codeSprite) vm.setEditingTarget(codeSprite.id);
    return true;
};
