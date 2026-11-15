// === Smalruby: This file is Smalruby-specific (lesson goal evaluation) ===
// チャレンジの「できた」の判定。VM から集めた事実（facts）と、いまの作品の状態
// （snapshot）を、チャレンジの goal（条件の並び）に照らす純粋関数。VM との接続は
// goal-monitor.js。goal の書き方は docs/lessons/README.md。
//
// goal は条件の配列で、全部を満たしたら「できた」。条件の `type`:
//   uses      決めたきっかけ（trigger）から始まったスクリプトで、決めたブロックが動いた（`not: true` なら、
//             きっかけに合ういちばん新しい実行でそう動いていない）
//   said      言った（考えた）文字
//   variable  変数の値
//   list      リストの中身
//   sprites   スプライトの数
//   costumes  コスチューム（背景）の数が始めより増えた
//   extension 拡張機能を読み込んだ
//
// プログラムの形は見ない（ブロックの並びや個数は条件にしない）。

export const CONDITION_TYPES = Object.freeze([
    'uses',
    'said',
    'variable',
    'list',
    'sprites',
    'costumes',
    'extension',
]);

// facts の上限（ずっと動くプログラムでも際限なく増えないように）
const MAX_RUNS = 200;
const MAX_SAYS = 500;
const MAX_ANSWERS = 500;
const MAX_ARGS_SEEN = 50;

// メッセージを送るブロック（送り主の記録用）。メッシュの「といっしょに送る」も、引数は
// 標準の「送る」と同じ BROADCAST_OPTION（goal-monitor でメッセージ名にする）。
const BROADCAST_OPCODES = new Set(['event_broadcast', 'event_broadcastandwait', 'meshV2_broadcastWithValue']);

const isUnset = (value) => typeof value === 'undefined' || value === null;

const isNumeric = (value) => {
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return false;
    return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
};

/**
 * Scratch の比較に合わせて、両方が数なら数として、そうでなければ文字（大文字小文字を
 * 区別しない）として比べる。
 * @param {*} a - 左。
 * @param {*} b - 右。
 * @returns {number} 負・0・正。
 */
export const compareValues = (a, b) => {
    if (isNumeric(a) && isNumeric(b)) return Number(a) - Number(b);
    const sa = String(a).toLowerCase();
    const sb = String(b).toLowerCase();
    if (sa === sb) return 0;
    return sa < sb ? -1 : 1;
};

/**
 * 値の条件（matcher）に合うか。matcher は、値そのもの（等しい）・RegExp（test）・
 * `{eq, ne, gt, gte, lt, lte, includes, matches}` のどれか。
 * @param {*} matcher - 値の条件。undefined / null なら何でも合う。
 * @param {*} value - 調べる値。
 * @returns {boolean} 合えば true。
 */
export const matchValue = (matcher, value) => {
    if (isUnset(matcher)) return true;
    if (matcher instanceof RegExp) return matcher.test(String(value));
    if (typeof matcher !== 'object') return compareValues(value, matcher) === 0;
    return Object.entries(matcher).every(([op, expected]) => {
        switch (op) {
            case 'eq':
                return compareValues(value, expected) === 0;
            case 'ne':
                return compareValues(value, expected) !== 0;
            case 'gt':
                return compareValues(value, expected) > 0;
            case 'gte':
                return compareValues(value, expected) >= 0;
            case 'lt':
                return compareValues(value, expected) < 0;
            case 'lte':
                return compareValues(value, expected) <= 0;
            case 'includes':
                return String(value).includes(String(expected));
            case 'matches':
                return (expected instanceof RegExp ? expected : new RegExp(expected)).test(String(value));
            default:
                return false;
        }
    });
};

/**
 * 見張りで集める事実の入れ物。
 * @returns {object} facts。
 */
export const createFacts = () => ({
    // スクリプトの実行 1 回（スレッド 1 本）= run
    runs: [],
    // 言った文字（空は入れない）
    says: [],
    // 「聞いて待つ」に入力した答え
    answers: [],
    // メッセージ名（大文字）→ 最後に送ったターゲット id
    lastBroadcast: {},
});

const upper = (value) => String(value).toUpperCase();

/**
 * スクリプトの実行（スレッド）を 1 つ始める。
 * @param {object} facts - facts。
 * @param {object} info - `{trigger: {hat, fields, stackClick}, targetId, isStage}`。
 *   `fields` はハットのフィールド名 → 値（例: `{KEY_OPTION: 'space'}`）。
 * @returns {object} run（recordExecution に渡す）。
 */
export const startRun = (facts, info) => {
    const fields = (info.trigger && info.trigger.fields) || {};
    const run = {
        trigger: {
            hat: (info.trigger && info.trigger.hat) || null,
            fields,
            stackClick: Boolean(info.trigger && info.trigger.stackClick),
        },
        targetId: isUnset(info.targetId) ? null : info.targetId,
        isStage: Boolean(info.isStage),
        // メッセージを受け取ったスクリプトなら、送ったターゲット id（「別のスプライトから」の判定用）
        broadcaster: null,
        ops: {},
        seq: 0,
    };
    if (run.trigger.hat === 'event_whenbroadcastreceived' && !isUnset(fields.BROADCAST_OPTION)) {
        const sender = facts.lastBroadcast[upper(fields.BROADCAST_OPTION)];
        run.broadcaster = isUnset(sender) ? null : sender;
    }
    facts.runs.push(run);
    if (facts.runs.length > MAX_RUNS) facts.runs.shift();
    return run;
};

/**
 * ブロックが 1 回動いたことを記録する。
 * @param {object} facts - facts。
 * @param {object} run - startRun が返した run。
 * @param {string} opcode - 動いたブロックの opcode。
 * @param {object} [args] - 引数（名前 → 値。BROADCAST_OPTION はメッセージ名の文字列）。
 */
export const recordExecution = (facts, run, opcode, args) => {
    let op = run.ops[opcode];
    if (!op) {
        op = { count: 0, first: run.seq, last: run.seq, argsSeen: new Map() };
        run.ops[opcode] = op;
    }
    op.count += 1;
    op.last = run.seq;
    run.seq += 1;
    if (args) {
        const key = JSON.stringify(args);
        const seen = op.argsSeen.get(key);
        if (seen) {
            seen.count += 1;
        } else if (op.argsSeen.size < MAX_ARGS_SEEN) {
            op.argsSeen.set(key, { args: { ...args }, count: 1 });
        }
        if (BROADCAST_OPCODES.has(opcode) && !isUnset(args.BROADCAST_OPTION)) {
            facts.lastBroadcast[upper(args.BROADCAST_OPTION)] = run.targetId;
        }
    }
};

/**
 * 言った（考えた）文字を記録する。空の文字（吹き出しを消す）は記録しない。
 * @param {object} facts - facts。
 * @param {object} say - `{targetId, isStage, text, variables, run, remoteValues}`。`variables` は言った時点の
 *   変数名 → 値（`equalsVariable` の判定用）。`run` は言ったスクリプトの run（startRun の戻り値。
 *   分からなければ省く。said の `trigger` の判定用）。`remoteValues` は言った時点で、メッシュで自分以外の
 *   ノード（練習相手を含む）から届いていた変数の値（said の `remoteValue` の判定用）。
 */
export const recordSay = (facts, say) => {
    const text = isUnset(say.text) ? '' : String(say.text);
    if (text === '') return;
    facts.says.push({
        targetId: isUnset(say.targetId) ? null : say.targetId,
        isStage: Boolean(say.isStage),
        text,
        // 言った時点の最後の答え（まだ答えていなければ null）
        answer: facts.answers.length > 0 ? facts.answers[facts.answers.length - 1] : null,
        variables: say.variables || {},
        run: say.run || null,
        remoteValues: Array.isArray(say.remoteValues) ? say.remoteValues : [],
    });
    if (facts.says.length > MAX_SAYS) facts.says.shift();
};

/**
 * 「聞いて待つ」に入力した答えを記録する。
 * @param {object} facts - facts。
 * @param {*} answer - 答え。
 */
export const recordAnswer = (facts, answer) => {
    facts.answers.push(String(answer));
    if (facts.answers.length > MAX_ANSWERS) facts.answers.shift();
};

const sameKey = (fieldKey, key) => {
    if (isUnset(fieldKey)) return false;
    // 「どれかのキー」で作ったスクリプトも、そのキーで動いたことにする
    if (String(fieldKey) === 'any') return true;
    return String(fieldKey).toLowerCase() === String(key).toLowerCase();
};

const triggerMatches = (trigger, run) => {
    if (run.trigger.stackClick) return false;
    if (!trigger) return true;
    if (trigger.hat && run.trigger.hat !== trigger.hat) return false;
    if (!isUnset(trigger.key) && !sameKey(run.trigger.fields.KEY_OPTION, trigger.key)) return false;
    if (!isUnset(trigger.message)) {
        // 名前の配列なら、どれか 1 つに合えばよい（ペアのどちらの役の名前・どの locale の名前でも通す）
        const field = run.trigger.fields.BROADCAST_OPTION;
        const names = Array.isArray(trigger.message) ? trigger.message : [trigger.message];
        if (isUnset(field) || !names.some((name) => upper(field) === upper(name))) return false;
    }
    if (trigger.target === 'stage' && !run.isStage) return false;
    if (trigger.target === 'sprite' && run.isStage) return false;
    if (trigger.sentBy === 'other' && !(run.broadcaster !== null && run.broadcaster !== run.targetId)) return false;
    // この作品のスクリプトが送っていない合図（メッシュでほかのノード・練習相手から届いた）。メッシュで届いた合図は
    // 「送る」のブロックを通らないので送り手が記録されない（broadcaster が null）。自分で一度でも送った名前は、
    // あとで相手から届いても「この作品が送った」とみなす（#1645）
    if (trigger.sentBy === 'remote' && run.broadcaster !== null) return false;
    return true;
};

const normalizeBlockEntry = (entry) => (typeof entry === 'string' ? { opcode: entry } : entry);

const argsMatch = (matchers, args) =>
    Object.entries(matchers).every(([name, matcher]) => matchValue(matcher, args[name]));

// opcode は 1 つか、どれでもよい opcode の配列（「送る」「送って待つ」「値つきで送る」のどれで送ってもよい、など）
const entryOpcodes = (entry) => (Array.isArray(entry.opcode) ? entry.opcode : [entry.opcode]);

const blockEntrySatisfiedByRun = (entry, run) => {
    const ops = entryOpcodes(entry)
        .map((opcode) => run.ops[opcode])
        .filter(Boolean);
    if (ops.length === 0) return false;
    const need = entry.count || 1;
    if (entry.distinct) {
        const values = new Set();
        ops.forEach((op) => op.argsSeen.forEach(({ args }) => values.add(String(args[entry.distinct]))));
        return values.size >= need;
    }
    if (entry.args) {
        let count = 0;
        ops.forEach((op) =>
            op.argsSeen.forEach((seen) => {
                if (argsMatch(entry.args, seen.args)) count += seen.count;
            }),
        );
        return count >= need;
    }
    return ops.reduce((sum, op) => sum + op.count, 0) >= need;
};

const orderSatisfiedByRun = (order, run) => {
    for (let i = 0; i + 1 < order.length; i += 1) {
        const before = run.ops[order[i]];
        const after = run.ops[order[i + 1]];
        if (!before || !after || !(before.first < after.first)) return false;
    }
    return true;
};

// 決めた runs（きっかけに合うスクリプトの実行）の中で、blocks と order を満たしたか
const usesSatisfiedByRuns = (condition, runs) => {
    if (runs.length === 0) return false;
    const entries = (condition.blocks || []).map(normalizeBlockEntry);
    if (!entries.every((entry) => runs.some((run) => blockEntrySatisfiedByRun(entry, run)))) return false;
    if (condition.order && condition.order.length > 1) {
        return runs.some((run) => orderSatisfiedByRun(condition.order, run));
    }
    return true;
};

// 実行の中で、blocks のどれかの opcode が（引数を問わず）動いたか
const runUsesAnyOpcode = (condition, run) =>
    (condition.blocks || []).map(normalizeBlockEntry).some((entry) => entryOpcodes(entry).some((op) => run.ops[op]));

// `not: true` の uses は「きっかけに合い、blocks の opcode が動いた**いちばん新しい**スクリプトの実行で、そう動いて
// いない」（NG ワードを変数に入れて送った、など・#1645）。直して旗を押し直せば、新しい実行で見るので満たす（前の
// 実行の記録は見ない）。その opcode の動かない同じきっかけのスクリプト（ステージの旗のリストの準備など）は、
// いちばん新しいものにしない。そういう実行がまだ無ければ満たす
const evaluateUses = (condition, facts) => {
    const runs = facts.runs.filter((run) => triggerMatches(condition.trigger, run));
    if (!condition.not) return usesSatisfiedByRuns(condition, runs);
    const using = runs.filter((run) => runUsesAnyOpcode(condition, run));
    return using.length === 0 || !usesSatisfiedByRuns(condition, using.slice(-1));
};

// 変数名の条件（文字列か文字列の配列）を配列にする
const variableNames = (name) => (Array.isArray(name) ? name : [name]);

const isVariableName = (name) =>
    typeof name === 'string' || (Array.isArray(name) && name.length > 0 && name.every((n) => typeof n === 'string'));

// said の `variable`: 言った時点の変数の値が条件に合うか。`equalsAnswer` が true なら最後の答えと同じ、
// false なら最後の答えとちがう（どちらも、まだ答えていなければ合わない）。「1 なら大吉」「同じならあいこ」のように、
// 分岐で言い分けたこと（言ったときの変数の値）を見るため（#1642）
const saidVariableMatches = (spec, value, answer) => {
    if (!matchValue(spec.value, value)) return false;
    if (isUnset(spec.equalsAnswer)) return true;
    if (isUnset(answer)) return false;
    return (compareValues(value, answer) === 0) === spec.equalsAnswer;
};

const evaluateSaid = (condition, facts) =>
    facts.says.some((say) => {
        if (condition.target === 'stage' && !say.isStage) return false;
        // 言ったスクリプトのきっかけ（「受け取ったとき」のスクリプトで言った、など。uses の trigger と同じ形）
        if (!isUnset(condition.trigger) && !(say.run && triggerMatches(condition.trigger, say.run))) return false;
        // ほかのノードから届いた値を言った（自分の変数のセンサーの値を読んだだけでは通さない・#1643）
        if (
            condition.remoteValue &&
            !(say.remoteValues || []).some((value) => compareValues(say.text, value) === 0)
        ) {
            return false;
        }
        if (condition.target === 'sprite' && say.isStage) return false;
        if (!isUnset(condition.text) && !matchValue(condition.text, say.text)) return false;
        if (condition.equalsAnswer && (isUnset(say.answer) || compareValues(say.text, say.answer) !== 0)) {
            return false;
        }
        if (!isUnset(condition.equalsVariable)) {
            const names = variableNames(condition.equalsVariable).filter((name) =>
                Object.prototype.hasOwnProperty.call(say.variables, name),
            );
            if (!names.some((name) => compareValues(say.text, say.variables[name]) === 0)) return false;
        }
        if (!isUnset(condition.answer)) {
            if (isUnset(say.answer) || !matchValue(condition.answer, say.answer)) return false;
        }
        if (!isUnset(condition.variable)) {
            const names = variableNames(condition.variable.name).filter((name) =>
                Object.prototype.hasOwnProperty.call(say.variables, name),
            );
            if (!names.some((name) => saidVariableMatches(condition.variable, say.variables[name], say.answer))) {
                return false;
            }
        }
        return true;
    });

// 名前ごとに、ステージ（すべてのスプライト用）の変数を先に探す。name は名前の配列でもよい
// （locale ごとの名前。ja-Hira は「かいすう」、en は「count」と書く）。ja で作った作品を en で開いて
// 「プログラムを入れる」と両方の名前がそろうことがあるので、見つかった変数のどれかが合えばよい
// `target` が 'stage' ならステージ（すべてのスプライト用）の変数だけ、'sprite' ならスプライトの変数だけを見る
// （メッシュで共有されるのはステージの変数だけ・#1643）
const findVariables = (snapshot, name, type, target = null) =>
    variableNames(name)
        .map((n) => {
            const variables = (snapshot.variables || []).filter(
                (v) =>
                    (v.type || '') === type &&
                    v.name === n &&
                    !(target === 'stage' && !v.isStage) &&
                    !(target === 'sprite' && v.isStage),
            );
            return variables.find((v) => v.isStage) || variables[0] || null;
        })
        .filter((v) => v !== null);

// 値がほかの変数の値（空でない）を含むか（「名前：メッセージ」に名前の変数を入れた、など・#1644）
const includesVariableValue = (snapshot, names, value) =>
    findVariables(snapshot, names, '').some(
        (other) => String(other.value) !== '' && String(value).includes(String(other.value)),
    );

// `fromAnswer`: 値が「聞いて待つ」に入力した答えのどれか（空でない）。作っただけの変数（0）や、決まった文字を
// 入れた変数では合わない（#1644）。`includesVariable`: 値がその変数の値を含む（名前の配列ならどれか 1 つ）
const evaluateVariable = (condition, facts, snapshot) =>
    findVariables(snapshot, condition.name, '', condition.target).some(
        (variable) =>
            matchValue(condition.value, variable.value) &&
            (!condition.fromAnswer ||
                (String(variable.value) !== '' &&
                    ((facts && facts.answers) || []).includes(String(variable.value)))) &&
            (isUnset(condition.includesVariable) ||
                includesVariableValue(snapshot, condition.includesVariable, variable.value)),
    );

const listMatches = (condition, facts, variable) => {
    if (!Array.isArray(variable.value)) return false;
    const items = variable.value;
    if (!isUnset(condition.length) && !matchValue(condition.length, items.length)) return false;
    if (condition.itemsFromAnswers) {
        const answers = new Set(facts.answers);
        if (items.length === 0 || !items.every((item) => answers.has(String(item)))) return false;
    }
    return true;
};

const evaluateList = (condition, facts, snapshot) =>
    findVariables(snapshot, condition.name, 'list').some((variable) => listMatches(condition, facts, variable));

const evaluateSprites = (condition, snapshot) => (snapshot.spriteCount || 0) >= (condition.min || 1);

const evaluateCostumes = (condition, snapshot) => {
    const wantStage = condition.target === 'stage';
    const added = condition.added || 1;
    const baseline = snapshot.baselineCostumes || {};
    return Object.entries(baseline).some(([targetId, before]) => {
        if (Boolean(before.isStage) !== wantStage) return false;
        const now = (snapshot.costumes || {})[targetId];
        return Boolean(now) && now.count >= before.count + added;
    });
};

const evaluateExtension = (condition, snapshot) =>
    typeof snapshot.isExtensionLoaded === 'function' && Boolean(snapshot.isExtensionLoaded(condition.id));

/**
 * 条件 1 つを判定する。
 * @param {object} condition - 条件。
 * @param {object} facts - 見張りで集めた事実。
 * @param {object} snapshot - いまの作品の状態（goal-monitor の takeSnapshot）。
 * @returns {boolean} 満たしていれば true。
 */
export const evaluateCondition = (condition, facts, snapshot) => {
    switch (condition.type) {
        case 'uses':
            return evaluateUses(condition, facts);
        case 'said':
            return evaluateSaid(condition, facts);
        case 'variable':
            return evaluateVariable(condition, facts, snapshot);
        case 'list':
            return evaluateList(condition, facts, snapshot);
        case 'sprites':
            return evaluateSprites(condition, snapshot);
        case 'costumes':
            return evaluateCostumes(condition, snapshot);
        case 'extension':
            return evaluateExtension(condition, snapshot);
        default:
            return false;
    }
};

/**
 * goal（条件の並び）を判定する。全部を満たしたら「できた」。
 * @param {Array<object>} goal - 条件の並び。
 * @param {object} facts - 見張りで集めた事実。
 * @param {object} snapshot - いまの作品の状態。
 * @returns {{satisfied: boolean, results: Array<boolean>}} 全体と条件ごとの結果。
 */
export const evaluateGoal = (goal, facts, snapshot) => {
    const results = (goal || []).map((condition) => evaluateCondition(condition, facts, snapshot));
    return { satisfied: results.length > 0 && results.every(Boolean), results };
};

const isMatcher = (value) =>
    isUnset(value) ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof RegExp ||
    (typeof value === 'object' &&
        value !== null &&
        Object.keys(value).every((key) =>
            ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'includes', 'matches'].includes(key),
        ));

// uses / said の `trigger` の形
const validateTrigger = (trigger, at) => {
    if (isUnset(trigger)) return [];
    if (typeof trigger !== 'object') return [`${at}: trigger must be an object`];
    const errors = [];
    if (!isUnset(trigger.target) && !['stage', 'sprite'].includes(trigger.target)) {
        errors.push(`${at}: trigger.target must be 'stage' or 'sprite'`);
    }
    if (!isUnset(trigger.sentBy) && !['other', 'remote'].includes(trigger.sentBy)) {
        errors.push(`${at}: trigger.sentBy must be 'other' or 'remote'`);
    }
    if (!isUnset(trigger.message) && !isVariableName(trigger.message)) {
        errors.push(`${at}: trigger.message must be a message name or an array of names`);
    }
    return errors;
};

/**
 * goal の形を確かめる（courses.js に入れる前のテスト用）。
 * @param {*} goal - goal。
 * @returns {Array<string>} 問題の説明（空なら正しい）。
 */
export const validateGoal = (goal) => {
    const errors = [];
    if (!Array.isArray(goal) || goal.length === 0) return ['goal must be a non-empty array of conditions'];
    goal.forEach((condition, index) => {
        const at = `goal[${index}]`;
        if (!condition || typeof condition !== 'object' || !CONDITION_TYPES.includes(condition.type)) {
            errors.push(`${at}: type must be one of ${CONDITION_TYPES.join(', ')}`);
            return;
        }
        // `not` は uses だけ（ほかの条件に書いても効かないので、書きまちがいとして弾く）
        if (condition.type !== 'uses' && !isUnset(condition.not)) {
            errors.push(`${at}: not is only for uses`);
        }
        switch (condition.type) {
            case 'uses': {
                const blocks = condition.blocks;
                if (!Array.isArray(blocks) || blocks.length === 0) {
                    errors.push(`${at}: uses.blocks must be a non-empty array`);
                    break;
                }
                blocks.forEach((entry, i) => {
                    const e = normalizeBlockEntry(entry);
                    const opcodeOk =
                        e &&
                        ((typeof e.opcode === 'string' && e.opcode !== '') ||
                            (Array.isArray(e.opcode) &&
                                e.opcode.length > 0 &&
                                e.opcode.every((o) => typeof o === 'string' && o !== '')));
                    if (!opcodeOk) {
                        errors.push(`${at}.blocks[${i}]: opcode is required`);
                        return;
                    }
                    if (!isUnset(e.count) && !(Number.isInteger(e.count) && e.count >= 1)) {
                        errors.push(`${at}.blocks[${i}]: count must be a positive integer`);
                    }
                    if (!isUnset(e.args) && (typeof e.args !== 'object' || e.args === null)) {
                        errors.push(`${at}.blocks[${i}]: args must be an object of matchers`);
                    } else if (e.args) {
                        Object.entries(e.args).forEach(([name, matcher]) => {
                            if (!isMatcher(matcher)) errors.push(`${at}.blocks[${i}].args.${name}: invalid matcher`);
                        });
                    }
                    if (!isUnset(e.distinct) && typeof e.distinct !== 'string') {
                        errors.push(`${at}.blocks[${i}]: distinct must be an argument name`);
                    }
                });
                if (!isUnset(condition.order) && !Array.isArray(condition.order)) {
                    errors.push(`${at}: order must be an array of opcodes`);
                }
                if (!isUnset(condition.not) && typeof condition.not !== 'boolean') {
                    errors.push(`${at}: uses.not must be true or false`);
                }
                errors.push(...validateTrigger(condition.trigger, at));
                break;
            }
            case 'said':
                errors.push(...validateTrigger(condition.trigger, at));
                if (!isMatcher(condition.text)) errors.push(`${at}: said.text must be a string, RegExp or matcher`);
                if (!isMatcher(condition.answer)) errors.push(`${at}: said.answer must be a matcher`);
                if (
                    isUnset(condition.text) &&
                    !condition.equalsAnswer &&
                    isUnset(condition.equalsVariable) &&
                    isUnset(condition.answer) &&
                    isUnset(condition.variable)
                ) {
                    errors.push(`${at}: said needs text, equalsAnswer, equalsVariable, answer or variable`);
                }
                if (!isUnset(condition.remoteValue) && typeof condition.remoteValue !== 'boolean') {
                    errors.push(`${at}: said.remoteValue must be true or false`);
                }
                if (!isUnset(condition.equalsVariable) && !isVariableName(condition.equalsVariable)) {
                    errors.push(`${at}: said.equalsVariable must be a variable name or an array of names`);
                }
                if (!isUnset(condition.variable)) {
                    const spec = condition.variable;
                    if (typeof spec !== 'object' || !isVariableName(spec.name)) {
                        errors.push(`${at}: said.variable needs a variable name or an array of names`);
                    } else {
                        if (isUnset(spec.value) && isUnset(spec.equalsAnswer)) {
                            errors.push(`${at}: said.variable needs value or equalsAnswer`);
                        }
                        if (!isMatcher(spec.value)) errors.push(`${at}: said.variable.value must be a matcher`);
                        if (!isUnset(spec.equalsAnswer) && typeof spec.equalsAnswer !== 'boolean') {
                            errors.push(`${at}: said.variable.equalsAnswer must be true or false`);
                        }
                    }
                }
                break;
            case 'variable':
                if (!isVariableName(condition.name)) errors.push(`${at}: variable.name is required`);
                if (!isMatcher(condition.value)) errors.push(`${at}: variable.value must be a matcher`);
                if (!isUnset(condition.target) && !['stage', 'sprite'].includes(condition.target)) {
                    errors.push(`${at}: variable.target must be 'stage' or 'sprite'`);
                }
                if (!isUnset(condition.fromAnswer) && typeof condition.fromAnswer !== 'boolean') {
                    errors.push(`${at}: variable.fromAnswer must be true or false`);
                }
                if (!isUnset(condition.includesVariable) && !isVariableName(condition.includesVariable)) {
                    errors.push(`${at}: variable.includesVariable must be a variable name or an array of names`);
                }
                break;
            case 'list':
                if (!isVariableName(condition.name)) errors.push(`${at}: list.name is required`);
                if (!isMatcher(condition.length)) errors.push(`${at}: list.length must be a matcher`);
                break;
            case 'sprites':
                if (!(Number.isInteger(condition.min) && condition.min >= 1)) {
                    errors.push(`${at}: sprites.min must be a positive integer`);
                }
                break;
            case 'costumes':
                if (!isUnset(condition.added) && !(Number.isInteger(condition.added) && condition.added >= 1)) {
                    errors.push(`${at}: costumes.added must be a positive integer`);
                }
                if (!isUnset(condition.target) && !['stage', 'sprite'].includes(condition.target)) {
                    errors.push(`${at}: costumes.target must be 'stage' or 'sprite'`);
                }
                break;
            case 'extension':
                if (typeof condition.id !== 'string' || condition.id === '')
                    errors.push(`${at}: extension.id is required`);
                break;
            default:
                break;
        }
    });
    return errors;
};
