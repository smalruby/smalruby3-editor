// チャレンジを始めるときの作品の準備（`setup` のうち、apply-setup が扱わないもの）。
//   - `setup.sprites`: 新しい作品のネコを、ライブラリのスプライトに置きかえる（例 `['Shimaraby', 'Shimacat']`）。
//     1 つめはネコのいた場所、2 つめ以降は「プログラムを入れる」で足すときと同じ、ネコと重ならない右の場所に置く。
//     1 つめが `code` の入る先になる
//   - `setup.code` / `setup.spriteCodes` / `setup.stageCode`: 前の段の答え（Ruby）を入れておく。形はチャレンジの
//     `code` / `spriteCodes` と同じで、locale ごとにも書ける（courses.js の localizeCode）。生徒の前の作品ではない
//   - `setup.lists`: リストの中身を入れておく（「ことばを予想する AI」の教科書）。`[{name, items, stage, monitor}]`。
//     `name` / `items` は locale ごとの `{ja, 'ja-Hira', en}` でも書ける。`stage: true` ならステージ（すべての
//     スプライト用）、無ければ `code` を入れたスプライトのリスト。同じ名前のリストがあれば中身を置きかえ、無ければ作る。
//     `monitor: true` ならステージにリストのモニターを出す
//   - `setup.warpProcedures`: 定義ブロックの名前の並び（locale ごとの名前を全部並べてよい）。入れたプログラムの
//     その定義ブロックを「画面を再描画せずに実行する」にする。Ruby の `def` には、まだこの設定を書けないため
//     （Ruby → ブロックの変換が warp を作らない・#2114）
// 変換して入れるのは「プログラムを入れる」の spriteCodes と同じ（targetCodeToBlocks → apply）。
import { Map } from 'immutable';
import spriteLibraryContent from '../libraries/sprites.json';
import { localizeCode } from './courses';
import {
    ADDED_SPRITE_POSITION,
    addLibrarySprite,
    insertSpriteCodes,
    resolveCodeSprite,
    spritesOf,
} from './insert-sprite-code';

// 2 つめ以降のスプライトの間隔（3 つめからは下へずらす。このコースは 2 つまで）
const NEXT_SPRITE_GAP_Y = 100;
// setup.lists のモニターを横に並べる間隔（リストのモニターの既定の幅 100 より少し広く）
const LIST_MONITOR_GAP_X = 110;

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
            (Array.isArray(setup.spriteCodes) && setup.spriteCodes.length > 0) ||
            (Array.isArray(setup.lists) && setup.lists.length > 0)),
    );

// locale ごとに書ける値（文字列・配列、または `{ja, 'ja-Hira', en}`）から、いまの locale のものを選ぶ。キーが無い
// locale は en、en も無ければ ja（courses.js の localizeCode と同じ順。localizeCode は配列を扱わないので別に持つ）
const localizeValue = (value, locale) => {
    if (typeof value === 'string' || Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return null;
    const key = [locale, 'en', 'ja'].find((l) => Object.prototype.hasOwnProperty.call(value, l));
    return key ? value[key] : null;
};

let listIdSeq = 0;
const newListId = (name) => {
    listIdSeq += 1;
    return `lesson-list-${Date.now().toString(36)}-${listIdSeq}-${name}`;
};

// ステージにリストのモニターを出す（作品の読み込みと同じく、モニター用のブロックを作ってからチェックを入れる。
// パレットにリストのブロックが無いチャレンジでもモニターを出せるように）
const showListMonitor = (vm, target, list, position) => {
    const monitorBlocks = vm.runtime.monitorBlocks;
    if (!monitorBlocks) return;
    if (!monitorBlocks.getBlock(list.id)) {
        monitorBlocks.createBlock({
            id: list.id,
            opcode: 'data_listcontents',
            inputs: {},
            fields: { LIST: { name: 'LIST', id: list.id, value: list.name, variableType: 'list' } },
            next: null,
            parent: null,
            topLevel: true,
            shadow: false,
            targetId: target.isStage ? null : target.id,
        });
    }
    monitorBlocks.changeBlock({ id: list.id, element: 'checkbox', value: true }, vm.runtime);
    // チェックで足したモニターは位置を持たず、GUI が空いている場所に置く。同じときに 2 つ足すと同じ場所を取って
    // 重なるので、位置を入れておく（位置のあるモニターは GUI がその位置に置く・containers/monitor.jsx）
    if (position && typeof vm.runtime.requestUpdateMonitor === 'function') {
        vm.runtime.requestUpdateMonitor(Map({ id: list.id, x: position.x, y: position.y }));
    }
};

/**
 * `setup.lists` のリストに中身を入れる（同じ名前のリストがあれば中身を置きかえ、無ければ作る）。入れられない
 * もの（名前・中身が無い、相手がいない）はとばして警告する。
 * @param {object} vm - Scratch VM。
 * @param {Array<object>} lists - `[{name, items, stage, monitor}]`。
 * @param {?object} sprite - `stage` でないリストを入れるスプライト。
 * @param {string} locale - いまの locale。
 */
export const applyStartLists = (vm, lists, sprite, locale) => {
    let shown = 0;
    (lists || []).forEach((spec) => {
        const name = localizeValue(spec && spec.name, locale);
        const items = localizeValue(spec && spec.items, locale);
        const target = spec && spec.stage ? vm.runtime.getTargetForStage() : sprite;
        if (typeof name !== 'string' || name === '' || !Array.isArray(items) || !target) {
            warn('could not put the starting list:', spec);
            return;
        }
        let list = target.lookupVariableByNameAndType(name, 'list', true);
        if (!list) {
            target.createVariable(newListId(name), name, 'list');
            list = target.lookupVariableByNameAndType(name, 'list', true);
        }
        list.value = items.map(String);
        list._monitorUpToDate = false;
        // 2 つ以上出すときは左から横に並べる（同じ位置にすると重なる。同時に出すモニターは GUI の自動の並べ方でも
        // 同じ空き場所を取ってしまう）
        if (spec.monitor) showListMonitor(vm, target, list, { x: LIST_MONITOR_GAP_X * shown++, y: 0 });
    });
};

// 定義ブロックの名前（proccode の引数より前）
const procedureName = (proccode) => String(proccode).split(/ %[sbn]/)[0];

/**
 * 名前の合う定義ブロックを「画面を再描画せずに実行する」にする（定義と呼び出しの mutation の warp）。
 * @param {object} vm - Scratch VM。
 * @param {Array<string>} names - 定義ブロックの名前。
 * @returns {number} warp にした定義ブロックの数。
 */
export const applyWarpProcedures = (vm, names) => {
    const wanted = new Set(names || []);
    if (wanted.size === 0) return 0;
    let count = 0;
    vm.runtime.targets.forEach((target) => {
        const blocks = target.blocks;
        if (!blocks || !blocks._blocks) return;
        Object.values(blocks._blocks).forEach((block) => {
            if (!block.mutation || !wanted.has(procedureName(block.mutation.proccode))) return;
            if (block.opcode === 'procedures_prototype') {
                block.mutation.warp = 'true';
                count += 1;
            } else if (block.opcode === 'procedures_call') {
                block.mutation.warp = 'true';
            }
        });
        if (typeof blocks.resetCache === 'function') blocks.resetCache();
    });
    return count;
};

const isAlive = (isCurrent) => !isCurrent || isCurrent();

/**
 * 作品のスプライト（新しい作品ならネコ）を、ライブラリのスプライトに置きかえる。ライブラリに無い・足すのに
 * 失敗したスプライトはとばして（警告）続ける。1 つも足せなかったときはネコを残す（空の作品にしない）。
 * @param {object} vm - Scratch VM。
 * @param {Array<string>} names - ライブラリのスプライトの名前（並び順）。
 * @param {object} [options] - ライブラリと中断。
 * @param {Array<object>} [options.library] - スプライトのライブラリ（テスト用。既定は sprites.json）。
 * @param {?function(): boolean} [options.isCurrent] - まだ同じチャレンジ・同じ作品か（false なら止める）。
 * @param {?string} [options.locale] - いまの言語（シマラビ / Shimaraby のように、その言語の名前で足す・
 *   sprite-names.js）。
 * @returns {Promise<Array<object>>} 足したスプライト（並び順）。
 */
export const replaceStartSprites = async (
    vm,
    names,
    { library = spriteLibraryContent, isCurrent = null, locale = null } = {},
) => {
    const before = spritesOf(vm);
    const first = before[0];
    const home = first ? { x: first.x || 0, y: first.y || 0 } : { x: 0, y: 0 };
    const added = [];
    for (const name of names) {
        if (!isAlive(isCurrent)) return added;
        const index = added.length;
        const position =
            index === 0
                ? home
                : { x: ADDED_SPRITE_POSITION.x, y: ADDED_SPRITE_POSITION.y - NEXT_SPRITE_GAP_Y * (index - 1) };
        try {
            const target = await addLibrarySprite(vm, name, library, position, locale);
            if (target) added.push(target);
            else warn(`the sprite "${name}" is not in the library`);
        } catch (err) {
            warn(`could not add the sprite "${name}":`, err);
        }
    }
    if (added.length === 0 || !isAlive(isCurrent)) return added;
    for (const target of before) {
        if (added.includes(target)) continue;
        try {
            vm.deleteSprite(target.id);
        } catch (err) {
            warn(`could not delete the sprite "${target.getName()}":`, err);
        }
    }
    vm.setEditingTarget(added[0].id);
    return added;
};

/**
 * 1 つのプログラムを変換して入れる。変換できない・入れるのに失敗したときは入れずに警告する（ほかのプログラムは
 * 入れ続ける）。
 * @param {object} target - 入れる相手。
 * @param {?string} code - Ruby。
 * @param {Function} toBlocks - `(target, code) => Promise<converter>`（targetCodeToBlocks）。
 * @returns {Promise<void>} 入れ終わったら。
 */
const insertCode = async (target, code, toBlocks) => {
    if (!target || !code) return;
    try {
        const converter = await toBlocks(target, code);
        if (converter.result) await converter.apply();
        else warn(`the starting code for "${target.getName()}" did not convert:`, converter.errors);
    } catch (err) {
        warn(`could not put the starting code into "${target.getName()}":`, err);
    }
};

/**
 * チャレンジを始めるときの作品の準備をする（新しい作品ができて、apply-setup のあと）。
 * スプライトを置きかえてから、ステージ → `spriteCodes` → `code` の順にプログラムを入れ、
 * `code` を入れたスプライト（`sprites` の 1 つめ）を編集中にする。途中で失敗したものはとばして続ける。
 * 段ごとに `isCurrent` を確かめ、ほかのチャレンジ・ほかの作品に変わっていたら止める（変わったあとの作品に
 * 手を入れない）。
 * @param {object} vm - Scratch VM。
 * @param {?object} setup - チャレンジの setup。
 * @param {object} options - 変換と locale。
 * @param {Function} options.toBlocks - `(target, code) => Promise<converter>`（targetCodeToBlocks）。
 * @param {string} options.locale - いまの locale（locale ごとに書いたプログラムを選ぶ）。
 * @param {Array<object>} [options.library] - スプライトのライブラリ（テスト用）。
 * @param {?function(): boolean} [options.isCurrent] - まだ同じチャレンジ・同じ作品か。
 * @returns {Promise<boolean>} 作品を変えて最後まで済ませたら true（Ruby タブの出し直しと「変更なし」に
 *   もどすため）。何もしない setup・途中で止めたときは false。
 */
export const applyChallengeStart = async (
    vm,
    setup,
    { toBlocks, locale, library = spriteLibraryContent, isCurrent = null },
) => {
    if (!vm || !vm.runtime || !hasChallengeStart(setup)) return false;
    const names = Array.isArray(setup.sprites) ? setup.sprites : [];
    if (names.length > 0) await replaceStartSprites(vm, names, { library, isCurrent, locale });
    if (!isAlive(isCurrent)) return false;

    await insertCode(vm.runtime.getTargetForStage(), localizeCode(setup.stageCode, locale), toBlocks);
    if (!isAlive(isCurrent)) return false;
    const spriteCodes = (setup.spriteCodes || [])
        .map(({ sprite, code }) => ({
            sprite,
            code: localizeCode(code, locale),
        }))
        .filter((s) => s.code);
    const preferred = names[0] || null;
    if (spriteCodes.length > 0) {
        try {
            await insertSpriteCodes(vm, spriteCodes, { toBlocks, library, preferred, locale });
        } catch (err) {
            warn('could not put the starting code into the other sprites:', err);
        }
        if (!isAlive(isCurrent)) return false;
    }
    // 「プログラムを入れる」と同じ決め方（insert-sprite-code.js の resolveCodeSprite）。無ければ編集中のスプライト
    const codeSprite = resolveCodeSprite(vm, spriteCodes, preferred) || vm.editingTarget || spritesOf(vm)[0];
    await insertCode(codeSprite, localizeCode(setup.code, locale), toBlocks);
    if (!isAlive(isCurrent)) return false;
    // プログラムのあとに入れる（`@教科書 = []` のようにプログラムが作ったリストの中身を置きかえるため）
    applyStartLists(vm, setup.lists, codeSprite, locale);
    applyWarpProcedures(vm, setup.warpProcedures);
    if (codeSprite) vm.setEditingTarget(codeSprite.id);
    return true;
};
