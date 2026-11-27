// ヒントのページを、そのページの操作ができたら自分で次へ進める（レッスン 0。`autoAdvanceHints` のレッスンだけ）。
// ページの `advanceOn` に「何ができたら進むか」を書き、ここの純粋関数がエディタの様子（observation）で決める。
// 様子を集めるのはコンテナ（containers/use-hint-auto-advance.js）。
//
// 進むのは「ページを出したときにはできていなかったことが、できたとき」だけ（`isStepAdvanced`）。もどるで前の
// ページを開いたとき、もうできていることで、すぐまた進んでしまわないように。
//
// あわせて、まちがった場所での操作にすぐ一言を出す（チャレンジの `wrongPlaceTip`・`isWrongPlaceClick`）。

/** `advanceOn` の種類（キーの名前）。1 つの `advanceOn` に 1 つだけ書く。 */
export const ADVANCE_KINDS = Object.freeze([
    // {click: 'palette', block: opcode}: ブロックパレットのそのブロックを押して動かした
    'click',
    // {placed: opcode}: そのブロックをスクリプトエリアに置いた（数がふえた）
    'placed',
    // {together: [opcode, ...]}: そのブロックが全部 1 つのスクリプトにつながった
    'together',
    // {tab: 'code' | 'costumes' | 'sounds'}: そのタブを開いた
    'tab',
    // {costume: n}: いま選んでいるスプライトの絵が n 番目（1 から）になった
    'costume',
    // {spriteAdded: true}: スプライトがふえた
    'spriteAdded',
    // {backdropChanged: true}: 背景が変わった
    'backdropChanged',
    // {field: {opcode, input, ne}}: そのブロックの入れるところ（input）の値が ne でなくなった
    'field',
    // {focusClicked: true}: 指しているもの（ページの `focus`）を押した
    'focusClicked',
]);

const kindOf = (advanceOn) =>
    advanceOn && typeof advanceOn === 'object' ? ADVANCE_KINDS.find((k) => k in advanceOn) || null : null;

const countOf = (blocks, opcode) => (blocks || []).filter((b) => b.opcode === opcode).length;

// いまの様子（obs）で、その条件が成り立っているか。base はページを出したときの様子（ふえた・変わったを見る）
const holds = (advanceOn, obs, base) => {
    switch (kindOf(advanceOn)) {
        case 'click':
            return (
                advanceOn.click === 'palette' &&
                (obs.paletteClicks || []).slice(base.paletteClickCount || 0).includes(advanceOn.block)
            );
        case 'placed':
            return countOf(obs.blocks, advanceOn.placed) > countOf(base.blocks, advanceOn.placed);
        case 'together': {
            const wanted = [].concat(advanceOn.together);
            return (obs.scripts || []).some((script) => wanted.every((op) => script.includes(op)));
        }
        case 'tab':
            return obs.activeTab === advanceOn.tab;
        case 'costume':
            return obs.costume === advanceOn.costume;
        case 'spriteAdded':
            return (obs.spriteCount || 0) > (base.spriteCount || 0);
        case 'backdropChanged':
            return obs.stageCostume !== base.stageCostume;
        case 'field': {
            const { opcode, input, ne } = advanceOn.field || {};
            return (obs.blocks || []).some(
                (b) =>
                    b.opcode === opcode &&
                    b.inputs &&
                    typeof b.inputs[input] !== 'undefined' &&
                    String(b.inputs[input]) !== String(ne),
            );
        }
        case 'focusClicked':
            return (obs.focusClicks || 0) > (base.focusClicks || 0);
        default:
            return false;
    }
};

/**
 * ページの操作ができたか（自分で次のページへ進めてよいか）。
 * @param {?object} advanceOn - ページの `advanceOn`（無ければいつも false）。
 * @param {object} now - いまのエディタの様子（`takeHintObservation`）。
 * @param {object} base - ページを出したときの様子。
 * @returns {boolean} ページを出したときには成り立っていなかったことが、いま成り立っていれば true。
 */
export const isStepAdvanced = (advanceOn, now, base) => {
    if (!kindOf(advanceOn) || !now || !base) return false;
    return holds(advanceOn, now, base) && !holds(advanceOn, base, base);
};

/**
 * 自分で次のページへ進めるか。レッスンが `autoAdvanceHints` で、吹き出しが出ていて（小さくした札でもよい）、
 * いまのページが最後の手順のページでない（最後の手段のページ「うまく動かないときは」へは進めない）とき。
 * @param {object} args - 引数。
 * @param {?object} args.lesson - レッスン。
 * @param {?object} args.hint - getCurrentHint の値。
 * @param {number} args.stepCount - チャレンジの手順のページの数（`steps.length`）。
 * @returns {boolean} 進めてよければ true（できたかどうかは `isStepAdvanced`）。
 */
export const canAutoAdvance = ({ lesson, hint, stepCount }) =>
    Boolean(
        lesson &&
        lesson.autoAdvanceHints &&
        hint &&
        (hint.visible || hint.minimized) &&
        !hint.lastResort &&
        hint.step &&
        hint.step.advanceOn &&
        hint.index < stepCount - 1,
    );

/**
 * まちがった場所での操作か（チャレンジの `wrongPlaceTip`）。いまは「スクリプトエリアで押した」だけを見る
 * （「ブロックを押してみよう」で、パレットのブロックを置いてから押していたため）。
 * @param {?object} tip - `{click: 'codeArea', blocks: [opcode], message}`。
 * @param {{opcode: string, stackClick: boolean, palette: boolean}} run - 動いたブロックと、どこで押したか。
 * @returns {boolean} 一言を出すなら true。
 */
export const isWrongPlaceClick = (tip, run) =>
    Boolean(
        tip &&
        run &&
        tip.click === 'codeArea' &&
        run.stackClick &&
        !run.palette &&
        (tip.blocks || []).includes(run.opcode),
    );

// 影のブロックの最初の値（数・▼）
const shadowValue = (container, id) => {
    const shadow = id && container.getBlock ? container.getBlock(id) : null;
    const field = shadow && shadow.fields ? Object.values(shadow.fields)[0] : null;
    return field && typeof field.value !== 'undefined' ? field.value : null;
};

/**
 * いまのエディタの様子（`isStepAdvanced` が見るもの）を VM から集める。VM は読むだけ。
 * @param {object} vm - VM。
 * @param {object} [ui] - VM の外の様子。
 * @param {?string} [ui.activeTab] - いまのタブ（'code' / 'costumes' / 'sounds'）。
 * @param {Array<string>} [ui.paletteClicks] - パレットで押して動いたブロックの opcode（押した順）。
 * @param {number} [ui.focusClicks] - 指しているものを押した回数。
 * @returns {object} 様子。
 */
export const takeHintObservation = (vm, { activeTab = null, paletteClicks = [], focusClicks = 0 } = {}) => {
    const runtime = vm && vm.runtime;
    const targets = (runtime && runtime.targets) || [];
    const editing = vm && vm.editingTarget;
    const container = editing && editing.blocks;
    const all = container && container._blocks ? Object.values(container._blocks) : [];
    const blocks = all
        .filter((b) => !b.shadow)
        .map((b) => {
            const inputs = {};
            Object.entries(b.inputs || {}).forEach(([name, input]) => {
                const value = shadowValue(container, input && input.shadow);
                if (value !== null) inputs[name] = value;
            });
            return { id: b.id, opcode: b.opcode, parent: b.parent, inputs };
        });
    // つながっている組（いちばん上のブロックごと）
    const byId = Object.fromEntries(blocks.map((b) => [b.id, b]));
    const topOf = (b) => {
        let cur = b;
        const seen = new Set();
        while (cur.parent && byId[cur.parent] && !seen.has(cur.id)) {
            seen.add(cur.id);
            cur = byId[cur.parent];
        }
        return cur.id;
    };
    const groups = {};
    blocks.forEach((b) => {
        const top = topOf(b);
        (groups[top] = groups[top] || []).push(b.opcode);
    });
    const stage = targets.find((t) => t.isStage);
    return {
        activeTab,
        paletteClicks: [...paletteClicks],
        paletteClickCount: paletteClicks.length,
        focusClicks,
        blocks: blocks.map(({ opcode, inputs }) => ({ opcode, inputs })),
        scripts: Object.values(groups),
        costume:
            editing && !editing.isStage && Number.isInteger(editing.currentCostume)
                ? editing.currentCostume + 1
                : null,
        stageCostume: stage && Number.isInteger(stage.currentCostume) ? stage.currentCostume : null,
        spriteCount: targets.filter((t) => !t.isStage && t.isOriginal !== false).length,
    };
};
