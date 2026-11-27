// Studuino モードの使えないブロック（#2214・M6・S5・M4）。判断は純粋関数で、ここに集める。
//
// - Studuino モードで使えないブロック = 構文木の生成（lib/studuino-ir）がエラーにするブロック。
//   一覧に無いブロック・文字の値・割り当てていない（外した）ポート・その部品でないポート・
//   2 つ目以降の「旗が押されたとき」など。印・件数・書きこみの検査が同じ判断になるよう、生成と同じ関数を使う。
//   旗の下に無いスクリプトは、コメントと同じ扱いで印を付けない（S8。生成が検査しないので）。
// - 通常モードで使えないブロック = 書きこまないと動かない Studuino モードの部品のブロック。
import { buildStuduinoIr, STUDUINO_IR_ERRORS } from './studuino-ir/build-studuino-ir';
import { STUDUINO_EXTENSION_ID } from './studuino-mode';

/**
 * ブロックに結びつくエラーか（旗が無い・全体が大きすぎるなど、ブロックに結びつかないものは印にしない）。
 * @param {{blockId: ?string, reason: string}} error - 構文木の生成のエラー
 * @returns {boolean} 印にするなら true
 */
const isBlockError = (error) => Boolean(error.blockId) && error.reason !== STUDUINO_IR_ERRORS.NO_FLAG;

/**
 * VM の target を、判断に使う形（元の target だけ）にする。
 * @param {object} vm - VM
 * @returns {Array<{id: string, isStage: boolean, blocks: object, variables: object}>} target
 */
const targetsFromVm = (vm) =>
    ((vm && vm.runtime && vm.runtime.targets) || [])
        .filter((t) => t.isOriginal)
        .map((t) => ({ id: t.id, isStage: t.isStage, blocks: t.blocks._blocks, variables: t.variables }));

/**
 * Studuino モードで使えないブロック（同じブロックは 1 回だけ）。
 * @param {Array<object>} targets - targetsFromVm の戻り値
 * @param {object} settings - getStuduinoSettings の戻り値
 * @returns {Array<{targetId: string, blockId: string, reason: string}>} 使えないブロック
 */
const findStuduinoUnusableBlocks = (targets, settings) => {
    const result = buildStuduinoIr({ targets, settings });
    if (result.ok) return [];
    const seen = new Set();
    const blocks = [];
    result.errors.filter(isBlockError).forEach((e) => {
        if (seen.has(e.blockId)) return;
        seen.add(e.blockId);
        blocks.push({ targetId: e.targetId, blockId: e.blockId, reason: e.reason });
    });
    return blocks;
};

const PART_BLOCK_PREFIX = `${STUDUINO_EXTENSION_ID}_studuino`;

/**
 * 通常モードで使えないブロック（Studuino モードの部品のブロック。書きこまないと動かない）。
 * @param {Array<object>} targets - targetsFromVm の戻り値
 * @returns {Array<{targetId: string, blockId: string, reason: string}>} 使えないブロック
 */
const findNormalModeUnusableBlocks = (targets) => {
    const blocks = [];
    (targets || []).forEach((target) => {
        Object.values(target.blocks || {}).forEach((block) => {
            if (!block.shadow && typeof block.opcode === 'string' && block.opcode.startsWith(PART_BLOCK_PREFIX)) {
                blocks.push({ targetId: target.id, blockId: block.id, reason: 'studuino_only_block' });
            }
        });
    });
    return blocks;
};

/**
 * 動かし方を変えてよいか（M6: 使えないブロックがあれば変えられない。通常 → Studuino も、その逆も）。
 * @param {Array<object>} targets - targetsFromVm の戻り値
 * @param {object} settings - getStuduinoSettings の戻り値（ポートの設定）
 * @param {boolean} toStuduino - Studuino モードに入るなら true、通常モードにもどすなら false
 * @returns {{allowed: boolean, blocks: Array<object>}} 変えてよいか、と止める理由のブロック
 */
const checkModeSwitch = (targets, settings, toStuduino) => {
    const blocks = toStuduino ? findStuduinoUnusableBlocks(targets, settings) : findNormalModeUnusableBlocks(targets);
    return { allowed: blocks.length === 0, blocks };
};

/**
 * 「すべて消して切り替える」で新規の作品にしたあとに入れる設定（ポートの設定・補正値は残し、動かし方だけ変える）。
 * @param {object} settings - いまの設定
 * @param {boolean} toStuduino - Studuino モードに入るなら true
 * @returns {object} 新しい作品に入れる設定
 */
const settingsAfterClear = (settings, toStuduino) => ({
    ...settings,
    mode: toStuduino ? 'studuino' : 'normal',
});

export {
    checkModeSwitch,
    findNormalModeUnusableBlocks,
    findStuduinoUnusableBlocks,
    settingsAfterClear,
    targetsFromVm,
};
