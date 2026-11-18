// ブロックを右クリック →「アクティビティ図」で描く図（#1647）のもとを、作品のブロック（VM の target の
// ブロック）から作る純粋関数。描き方はレッスンの答えから描く図（challenge-diagram.js）と同じモデル・置き方を
// そのまま使う（2 つめの描き方を作らない）。図にするのは、右クリックしたブロックのある 1 本のスクリプトだけ。
import { layoutActivityDiagram } from './layout';
import { buildActivityModel, countScripts, describeActivityModel } from './model';

/**
 * ブロックのあるスクリプトのいちばん上のブロック（親をたどった先）。ブロックが無ければ null。
 * @param {object} blocks - id → VM 形式のブロック（`target.blocks._blocks`）。
 * @param {string} blockId - 右クリックしたブロック。
 * @returns {?string} いちばん上のブロックの id。
 */
export const scriptRootId = (blocks, blockId) => {
    const all = blocks || {};
    if (!blockId || !all[blockId]) return null;
    const seen = new Set();
    let id = blockId;
    while (all[id].parent && all[all[id].parent] && !seen.has(id)) {
        seen.add(id);
        id = all[id].parent;
    }
    return id;
};

/**
 * スクリプト 1 本ぶんのブロック（いちばん上から next・入力でたどれるもの）だけを取り出す。
 * ほかのスクリプトを図に入れないため。いちばん上のブロックだけを topLevel にする。
 * @param {object} blocks - id → VM 形式のブロック。
 * @param {string} rootId - いちばん上のブロック。
 * @returns {object} id → ブロック（もとのブロックは変えない）。
 */
export const scriptBlocksOf = (blocks, rootId) => {
    const all = blocks || {};
    const picked = {};
    const stack = [rootId];
    while (stack.length > 0) {
        const id = stack.pop();
        if (!id || picked[id] || !all[id]) continue;
        const block = all[id];
        picked[id] = { ...block, topLevel: id === rootId };
        stack.push(block.next);
        Object.values(block.inputs || {}).forEach((input) => {
            stack.push(input.block, input.shadow);
        });
    }
    return picked;
};

/**
 * 右クリックしたブロックのスクリプトのアクティビティ図を作る。
 * @param {object} blocks - id → VM 形式のブロック（その target のもの）。
 * @param {string} blockId - 右クリックしたブロック。
 * @param {object} options - 文の作り方（`createBlockLabeler` と同じ `format` / `blockName` / `blockText` /
 *   `isHat`）。
 * @returns {?{model: object, layout: object}} 図。ブロックが無くなった（消した）ときは null。
 */
export const scriptActivityDiagram = (blocks, blockId, options) => {
    const rootId = scriptRootId(blocks, blockId);
    if (!rootId) return null;
    const model = buildActivityModel(
        { lanes: [{ id: 'own', label: null, targets: [{ name: null, blocks: scriptBlocksOf(blocks, rootId) }] }] },
        options,
    );
    if (countScripts(model) === 0) return null;
    const layout = { ...layoutActivityDiagram(model), description: describeActivityModel(model, options.format) };
    return { model, layout };
};
