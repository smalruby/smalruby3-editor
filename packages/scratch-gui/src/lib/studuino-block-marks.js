// Studuino モードの使えないブロックの印と、そのブロックへ移る（#2214）。ワークスペース（scratch-blocks）を触る I/O。
// どのブロックが使えないかの判断は lib/studuino-mode-check.js（純粋関数）。
import * as ScratchBlocks from 'scratch-blocks';

/** 使えないブロックにつける CSS のクラス（containers/studuino-unusable-blocks.css の :global）。 */
const UNUSABLE_CLASS = 'studuinoUnusableBlock';

/** 書きこみのモーダルの一覧から移ったブロックにつける色（#2353）。 */
const NOTICE_CLASS = 'studuinoNoticeBlock';

const svgRootOf = (block) => (block && typeof block.getSvgRoot === 'function' ? block.getSvgRoot() : null);

/**
 * いま開いているワークスペースのブロックに印をつけ直す（前の印は外す）。
 * @param {Array<string>} blockIds - 印をつけるブロック（いまの target のもの）
 */
const markUnusableBlocks = (blockIds) => {
    const workspace = ScratchBlocks.getMainWorkspace && ScratchBlocks.getMainWorkspace();
    if (!workspace || typeof workspace.getAllBlocks !== 'function') return;
    const ids = new Set(blockIds);
    workspace.getAllBlocks(false).forEach((block) => {
        const root = svgRootOf(block);
        if (!root || !root.classList) return;
        if (ids.has(block.id)) root.classList.add(UNUSABLE_CLASS);
        else root.classList.remove(UNUSABLE_CLASS);
    });
};

/**
 * ブロックに色をつける（ほかのブロックの色は外す）。ワークスペースを作り直すと（target を変えると）消える。
 * @param {object} workspace - いまのワークスペース
 * @param {?string} blockId - 色をつけるブロック（null ならすべて外す）
 */
const highlightBlock = (workspace, blockId) => {
    if (!workspace || typeof workspace.getAllBlocks !== 'function') return;
    workspace.getAllBlocks(false).forEach((block) => {
        const root = svgRootOf(block);
        if (!root || !root.classList) return;
        if (block.id === blockId) root.classList.add(NOTICE_CLASS);
        else root.classList.remove(NOTICE_CLASS);
    });
};

/**
 * そのブロックへ移る（target を開き、ブロックが見えるようにして選ぶ）。
 * @param {object} vm - VM
 * @param {{targetId: string, blockId: string}} where - 移る先
 * @param {{highlight?: boolean}} [options] - highlight: 移ったブロックに色をつける（#2353）
 */
const jumpToBlock = (vm, where, options = {}) => {
    if (!vm || !where) return;
    const show = () => {
        const workspace = ScratchBlocks.getMainWorkspace && ScratchBlocks.getMainWorkspace();
        const block = workspace && workspace.getBlockById(where.blockId);
        if (!block) return;
        if (typeof workspace.centerOnBlock === 'function') workspace.centerOnBlock(where.blockId);
        if (typeof block.select === 'function') block.select();
        if (options.highlight) highlightBlock(workspace, where.blockId);
    };
    if (where.targetId && vm.editingTarget && vm.editingTarget.id !== where.targetId) {
        vm.setEditingTarget(where.targetId);
        // ワークスペースが新しい target のブロックに入れかわってから移る
        setTimeout(show, 300);
    } else {
        show();
    }
};

export { highlightBlock, jumpToBlock, markUnusableBlocks, NOTICE_CLASS, UNUSABLE_CLASS };
