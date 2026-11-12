// === Smalruby: This file is Smalruby-specific (lesson goal evaluation) ===
// チャレンジの「できた」の判定。VM から集めた事実（facts）と、いまの作品の状態
// （snapshot）を、チャレンジの goal（条件の並び）に照らす純粋関数。VM との接続は
// goal-monitor.js。goal の書き方は docs/lessons/README.md。
//
// goal は条件の配列で、全部を満たしたら「できた」。条件の `type`:
//   uses      決めたきっかけ（trigger）から始まったスクリプトで、決めたブロックが動いた
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

const BROADCAST_OPCODES = new Set(['event_broadcast', 'event_broadcastandwait']);

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
 * @param {object} say - `{targetId, isStage, text, variables}`。`variables` は言った時点の
 *   変数名 → 値（`equalsVariable` の判定用）。
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
        const field = run.trigger.fields.BROADCAST_OPTION;
        if (isUnset(field) || upper(field) !== upper(trigger.message)) return false;
    }
    if (trigger.target === 'stage' && !run.isStage) return false;
    if (trigger.target === 'sprite' && run.isStage) return false;
    if (trigger.sentBy === 'other' && !(run.broadcaster !== null && run.broadcaster !== run.targetId)) return false;
    return true;
};

const normalizeBlockEntry = (entry) => (typeof entry === 'string' ? { opcode: entry } : entry);

const argsMatch = (matchers, args) =>
    Object.entries(matchers).every(([name, matcher]) => matchValue(matcher, args[name]));

const blockEntrySatisfiedByRun = (entry, run) => {
    const op = run.ops[entry.opcode];
    if (!op) return false;
    const need = entry.count || 1;
    if (entry.distinct) {
        const values = new Set();
        op.argsSeen.forEach(({ args }) => values.add(String(args[entry.distinct])));
        return values.size >= need;
    }
    if (entry.args) {
        let count = 0;
        op.argsSeen.forEach((seen) => {
            if (argsMatch(entry.args, seen.args)) count += seen.count;
        });
        return count >= need;
    }
    return op.count >= need;
};

const orderSatisfiedByRun = (order, run) => {
    for (let i = 0; i + 1 < order.length; i += 1) {
        const before = run.ops[order[i]];
        const after = run.ops[order[i + 1]];
        if (!before || !after || !(before.first < after.first)) return false;
    }
    return true;
};

const evaluateUses = (condition, facts) => {
    const runs = facts.runs.filter((run) => triggerMatches(condition.trigger, run));
    if (runs.length === 0) return false;
    const entries = (condition.blocks || []).map(normalizeBlockEntry);
    if (!entries.every((entry) => runs.some((run) => blockEntrySatisfiedByRun(entry, run)))) return false;
    if (condition.order && condition.order.length > 1) {
        return runs.some((run) => orderSatisfiedByRun(condition.order, run));
    }
    return true;
};

// 変数名の条件（文字列か文字列の配列）を配列にする
const variableNames = (name) => (Array.isArray(name) ? name : [name]);

const isVariableName = (name) =>
    typeof name === 'string' || (Array.isArray(name) && name.length > 0 && name.every((n) => typeof n === 'string'));

const evaluateSaid = (condition, facts) =>
    facts.says.some((say) => {
        if (condition.target === 'stage' && !say.isStage) return false;
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
        return true;
    });

// 名前ごとに、ステージ（すべてのスプライト用）の変数を先に探す。name は名前の配列でもよい
// （locale ごとの名前。ja-Hira は「かいすう」、en は「count」と書く）。ja で作った作品を en で開いて
// 「プログラムを入れる」と両方の名前がそろうことがあるので、見つかった変数のどれかが合えばよい
const findVariables = (snapshot, name, type) =>
    variableNames(name)
        .map((n) => {
            const variables = (snapshot.variables || []).filter((v) => (v.type || '') === type && v.name === n);
            return variables.find((v) => v.isStage) || variables[0] || null;
        })
        .filter((v) => v !== null);

const evaluateVariable = (condition, snapshot) =>
    findVariables(snapshot, condition.name, '').some((variable) => matchValue(condition.value, variable.value));

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
            return evaluateVariable(condition, snapshot);
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
        switch (condition.type) {
            case 'uses': {
                const blocks = condition.blocks;
                if (!Array.isArray(blocks) || blocks.length === 0) {
                    errors.push(`${at}: uses.blocks must be a non-empty array`);
                    break;
                }
                blocks.forEach((entry, i) => {
                    const e = normalizeBlockEntry(entry);
                    if (!e || typeof e.opcode !== 'string' || e.opcode === '') {
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
                const trigger = condition.trigger;
                if (!isUnset(trigger) && typeof trigger !== 'object') {
                    errors.push(`${at}: trigger must be an object`);
                } else if (!isUnset(trigger)) {
                    if (!isUnset(trigger.target) && !['stage', 'sprite'].includes(trigger.target)) {
                        errors.push(`${at}: trigger.target must be 'stage' or 'sprite'`);
                    }
                    if (!isUnset(trigger.sentBy) && trigger.sentBy !== 'other') {
                        errors.push(`${at}: trigger.sentBy must be 'other'`);
                    }
                }
                break;
            }
            case 'said':
                if (!isMatcher(condition.text)) errors.push(`${at}: said.text must be a string, RegExp or matcher`);
                if (!isMatcher(condition.answer)) errors.push(`${at}: said.answer must be a matcher`);
                if (
                    isUnset(condition.text) &&
                    !condition.equalsAnswer &&
                    isUnset(condition.equalsVariable) &&
                    isUnset(condition.answer)
                ) {
                    errors.push(`${at}: said needs text, equalsAnswer, equalsVariable or answer`);
                }
                if (!isUnset(condition.equalsVariable) && !isVariableName(condition.equalsVariable)) {
                    errors.push(`${at}: said.equalsVariable must be a variable name or an array of names`);
                }
                break;
            case 'variable':
                if (!isVariableName(condition.name)) errors.push(`${at}: variable.name is required`);
                if (!isMatcher(condition.value)) errors.push(`${at}: variable.value must be a matcher`);
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
