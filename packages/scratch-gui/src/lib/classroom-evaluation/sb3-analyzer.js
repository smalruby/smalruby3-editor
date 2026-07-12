/**
 * Static analyzer for submitted projects (classroom evaluation support).
 *
 * Takes a parsed sb3 project.json object and produces:
 *  - machine signals: deterministic, explainable facts about the program
 *    (which constructs are used, how much is wired to run, ...) that anchor
 *    the AI evaluation and survive an engineer's audit, and
 *  - a pseudocode reconstruction: every script rendered as indented
 *    Japanese-ish text so a non-Scratch reader can review the program from
 *    a spreadsheet without opening 35 sb3 files.
 *
 * Pure module: no VM, no DOM, no I/O. The caller is responsible for
 * unzipping the .sb3 and parsing project.json.
 */

/**
 * Hat detection: event hats, extension hats (…_when…), custom block defs.
 * @param {string} opcode - Block opcode
 * @returns {boolean} true when the opcode starts a runnable script
 */
const isHatOpcode = (opcode) => /(^|_)when/i.test(opcode || '') || opcode === 'procedures_definition';

const LOOP_OPCODES = new Set(['control_repeat', 'control_forever', 'control_repeat_until', 'control_for_each']);
const CONDITIONAL_OPCODES = new Set(['control_if', 'control_if_else', 'control_wait_until']);
const VARIABLE_OPCODES = new Set([
    'data_setvariableto',
    'data_changevariableby',
    'data_addtolist',
    'data_deleteoflist',
    'data_replaceitemoflist',
    'data_insertatlist',
]);
const DEFAULT_SPRITE_NAMES = new Set(['Sprite1', 'スプライト1']);

/**
 * Japanese labels for common opcodes. Placeholders: {NAME} resolves the
 * input/field of that name. Unknown opcodes fall back to `[opcode] args…`,
 * which is still auditable.
 */
const OPCODE_LABELS = {
    // Events
    event_whenflagclicked: '緑の旗が押されたとき',
    event_whenkeypressed: '{KEY_OPTION} キーが押されたとき',
    event_whenthisspriteclicked: 'このスプライトが押されたとき',
    event_whenstageclicked: 'ステージが押されたとき',
    event_whenbroadcastreceived: '{BROADCAST_OPTION} を受け取ったとき',
    event_whenbackdropswitchesto: '背景が {BACKDROP} になったとき',
    event_whengreaterthan: '{WHENGREATERTHANMENU} > {VALUE} のとき',
    event_broadcast: '{BROADCAST_INPUT} を送る',
    event_broadcastandwait: '{BROADCAST_INPUT} を送って待つ',
    // Motion
    motion_movesteps: '{STEPS} 歩動かす',
    motion_turnright: '右に {DEGREES} 度回す',
    motion_turnleft: '左に {DEGREES} 度回す',
    motion_gotoxy: 'x座標を {X} 、y座標を {Y} にする',
    motion_goto: '{TO} へ行く',
    motion_glidesecstoxy: '{SECS} 秒でx座標を {X} 、y座標を {Y} に変える',
    motion_glideto: '{SECS} 秒で {TO} へ行く',
    motion_pointindirection: '{DIRECTION} 度に向ける',
    motion_pointtowards: '{TOWARDS} へ向ける',
    motion_changexby: 'x座標を {DX} ずつ変える',
    motion_setx: 'x座標を {X} にする',
    motion_changeyby: 'y座標を {DY} ずつ変える',
    motion_sety: 'y座標を {Y} にする',
    motion_ifonedgebounce: 'もし端に着いたら、跳ね返る',
    motion_setrotationstyle: '回転方法を {STYLE} にする',
    motion_xposition: 'x座標',
    motion_yposition: 'y座標',
    motion_direction: '向き',
    // Looks
    looks_say: '{MESSAGE} と言う',
    looks_sayforsecs: '{MESSAGE} と {SECS} 秒言う',
    looks_think: '{MESSAGE} と考える',
    looks_thinkforsecs: '{MESSAGE} と {SECS} 秒考える',
    looks_switchcostumeto: 'コスチュームを {COSTUME} にする',
    looks_nextcostume: '次のコスチュームにする',
    looks_switchbackdropto: '背景を {BACKDROP} にする',
    looks_nextbackdrop: '次の背景にする',
    looks_changesizeby: '大きさを {CHANGE} ずつ変える',
    looks_setsizeto: '大きさを {SIZE} %にする',
    looks_changeeffectby: '{EFFECT} の効果を {CHANGE} ずつ変える',
    looks_seteffectto: '{EFFECT} の効果を {VALUE} にする',
    looks_cleargraphiceffects: '画像効果をなくす',
    looks_show: '表示する',
    looks_hide: '隠す',
    looks_gotofrontback: '{FRONT_BACK} へ移動する',
    looks_costumenumbername: 'コスチュームの {NUMBER_NAME}',
    looks_size: '大きさ',
    // Sound
    sound_playuntildone: '終わるまで {SOUND_MENU} の音を鳴らす',
    sound_play: '{SOUND_MENU} の音を鳴らす',
    sound_stopallsounds: 'すべての音を止める',
    sound_changevolumeby: '音量を {VOLUME} ずつ変える',
    sound_setvolumeto: '音量を {VOLUME} %にする',
    sound_changeeffectby: '音の {EFFECT} の効果を {VALUE} ずつ変える',
    sound_seteffectto: '音の {EFFECT} の効果を {VALUE} にする',
    sound_cleareffects: '音の効果をなくす',
    sound_volume: '音量',
    // Control
    control_wait: '{DURATION} 秒待つ',
    control_repeat: '{TIMES} 回繰り返す',
    control_forever: 'ずっと',
    control_if: 'もし {CONDITION} なら',
    control_if_else: 'もし {CONDITION} なら…でなければ',
    control_wait_until: '{CONDITION} まで待つ',
    control_repeat_until: '{CONDITION} まで繰り返す',
    control_stop: '{STOP_OPTION} を止める',
    control_start_as_clone: 'クローンされたとき',
    control_create_clone_of: '{CLONE_OPTION} のクローンを作る',
    control_delete_this_clone: 'このクローンを削除する',
    // Sensing
    sensing_touchingobject: '{TOUCHINGOBJECTMENU} に触れた',
    sensing_touchingcolor: '{COLOR} 色に触れた',
    sensing_askandwait: '{QUESTION} と聞いて待つ',
    sensing_answer: '答え',
    sensing_keypressed: '{KEY_OPTION} キーが押された',
    sensing_mousedown: 'マウスが押された',
    sensing_mousex: 'マウスのx座標',
    sensing_mousey: 'マウスのy座標',
    sensing_timer: 'タイマー',
    sensing_resettimer: 'タイマーをリセット',
    sensing_of: '{OBJECT} の {PROPERTY}',
    // Operators
    operator_add: '({NUM1} + {NUM2})',
    operator_subtract: '({NUM1} - {NUM2})',
    operator_multiply: '({NUM1} × {NUM2})',
    operator_divide: '({NUM1} ÷ {NUM2})',
    operator_random: '{FROM} から {TO} までの乱数',
    operator_gt: '({OPERAND1} > {OPERAND2})',
    operator_lt: '({OPERAND1} < {OPERAND2})',
    operator_equals: '({OPERAND1} = {OPERAND2})',
    operator_and: '({OPERAND1} かつ {OPERAND2})',
    operator_or: '({OPERAND1} または {OPERAND2})',
    operator_not: '({OPERAND} ではない)',
    operator_join: '({STRING1} と {STRING2})',
    operator_mod: '({NUM1} を {NUM2} で割った余り)',
    operator_round: '({NUM} を四捨五入)',
    // Data
    data_setvariableto: '変数 {VARIABLE} を {VALUE} にする',
    data_changevariableby: '変数 {VARIABLE} を {VALUE} ずつ変える',
    data_showvariable: '変数 {VARIABLE} を表示する',
    data_hidevariable: '変数 {VARIABLE} を隠す',
    data_addtolist: '{ITEM} を {LIST} に追加する',
    // Procedures
    procedures_definition: 'ブロック定義 {custom_block}',
    procedures_call: '自作ブロック {mutation_proccode}',
};

const INDENT = '    ';

/**
 * All non-shadow blocks of a target.
 * @param {object} blocks - Target's blocks map
 * @returns {Array<[string, object]>} [id, block] entries
 */
const realBlocks = (blocks) =>
    Object.entries(blocks || {}).filter(([, block]) => block && typeof block === 'object' && !block.shadow);

/**
 * Resolve one argument (field or input) of a block to display text.
 * @param {object} blocks - Target's blocks map
 * @param {object} block - The block whose argument to resolve
 * @param {string} name - Field/input name
 * @param {Function} renderReporter - Renders a nested reporter block id
 * @returns {string} Display text
 */
const resolveArg = (blocks, block, name, renderReporter) => {
    if (block.fields && block.fields[name]) {
        return String(block.fields[name][0]);
    }
    const input = block.inputs && block.inputs[name];
    if (!input) return '?';
    // Input format: [state, value, obscured?] where value is either a
    // primitive array [type, "literal", ...] or a block id string.
    const value = input[1];
    if (Array.isArray(value)) {
        // Primitive: literal is at index 1; broadcast/variable primitives
        // carry [type, name, id].
        return String(value[1]);
    }
    if (typeof value === 'string') {
        const nested = blocks[value];
        if (!nested) return '?';
        if (nested.shadow) {
            const fieldNames = Object.keys(nested.fields || {});
            if (fieldNames.length > 0) return String(nested.fields[fieldNames[0]][0]);
            return '?';
        }
        return renderReporter(value);
    }
    return '?';
};

/**
 * Render one block's display line (without indentation).
 * @param {object} blocks - Target's blocks map
 * @param {string} blockId - Block to render
 * @returns {string} One-line label
 */
const renderBlockLabel = (blocks, blockId) => {
    const block = blocks[blockId];
    if (!block) return '?';
    const renderReporter = (id) => renderBlockLabel(blocks, id);

    if (block.opcode === 'procedures_call') {
        const proccode = block.mutation?.proccode || 'カスタムブロック';
        return `自作ブロック「${proccode}」`;
    }
    if (block.opcode === 'procedures_definition') {
        const prototypeId = block.inputs?.custom_block?.[1];
        const proccode = (typeof prototypeId === 'string' && blocks[prototypeId]?.mutation?.proccode) || '';
        return `ブロック定義「${proccode}」`;
    }

    const template = OPCODE_LABELS[block.opcode];
    if (!template) {
        // Fallback: raw opcode + resolved args (auditable even if not pretty)
        const argNames = [...Object.keys(block.fields || {}), ...Object.keys(block.inputs || {})].filter(
            (n) => n !== 'SUBSTACK' && n !== 'SUBSTACK2',
        );
        const args = argNames.map((n) => `${n}=${resolveArg(blocks, block, n, renderReporter)}`).join(', ');
        return args ? `[${block.opcode}] ${args}` : `[${block.opcode}]`;
    }
    return template.replace(/\{(\w+)\}/g, (_, name) => resolveArg(blocks, block, name, renderReporter));
};

/**
 * Render a statement chain (block + next…) as indented lines.
 * @param {object} blocks - Target's blocks map
 * @param {string} blockId - First block of the chain
 * @param {number} depth - Indent depth
 * @param {string[]} lines - Output accumulator
 */
const renderChain = (blocks, blockId, depth, lines) => {
    let currentId = blockId;
    let guard = 0;
    while (currentId && guard < 10000) {
        guard++;
        const block = blocks[currentId];
        if (!block) break;
        lines.push(`${INDENT.repeat(depth)}${renderBlockLabel(blocks, currentId)}`);
        const substack = block.inputs?.SUBSTACK?.[1];
        if (typeof substack === 'string') {
            renderChain(blocks, substack, depth + 1, lines);
        }
        const substack2 = block.inputs?.SUBSTACK2?.[1];
        if (typeof substack2 === 'string') {
            lines.push(`${INDENT.repeat(depth)}でなければ:`);
            renderChain(blocks, substack2, depth + 1, lines);
        }
        currentId = block.next;
    }
};

/**
 * Collect every block id reachable from a top-level block (next chains,
 * substacks, and reporter inputs).
 * @param {object} blocks - Target's blocks map
 * @param {string} topId - Top-level block id
 * @returns {Set<string>} Reachable block ids (including topId)
 */
const collectReachable = (blocks, topId) => {
    const seen = new Set();
    const stack = [topId];
    while (stack.length > 0) {
        const id = stack.pop();
        if (!id || seen.has(id)) continue;
        const block = blocks[id];
        if (!block) continue;
        seen.add(id);
        if (block.next) stack.push(block.next);
        for (const input of Object.values(block.inputs || {})) {
            if (typeof input[1] === 'string') stack.push(input[1]);
        }
    }
    return seen;
};

/**
 * Analyze a parsed project.json.
 * @param {object} projectJson - Parsed sb3 project.json
 * @returns {{signals: object, pseudocode: string}} Signals + pseudocode text
 */
const analyzeProject = (projectJson) => {
    const targets = projectJson?.targets || [];
    const sprites = targets.filter((t) => !t.isStage);

    const categories = new Set();
    let totalBlocks = 0;
    let scriptCount = 0;
    let wiredScriptCount = 0;
    let wiredBlockCount = 0;
    let usesLoops = false;
    let usesConditionals = false;
    let usesVariables = false;
    let usesOperators = false;
    let usesCustomBlocks = false;
    let usesBroadcast = false;
    let wiredSoundBlockCount = 0;
    const pseudocodeParts = [];

    for (const target of targets) {
        const blocks = target.blocks || {};
        const real = realBlocks(blocks);
        totalBlocks += real.length;

        const targetLines = [];
        const tops = real.filter(([, block]) => block.topLevel);
        for (const [topId, topBlock] of tops) {
            scriptCount++;
            const wired = isHatOpcode(topBlock.opcode);
            if (wired) wiredScriptCount++;

            const reachable = collectReachable(blocks, topId);
            const reachableReal = [...reachable].filter((id) => blocks[id] && !blocks[id].shadow);
            if (wired) {
                wiredBlockCount += reachableReal.length;
                wiredSoundBlockCount += reachableReal.filter((id) =>
                    (blocks[id].opcode || '').startsWith('sound_'),
                ).length;
            }

            targetLines.push(`${wired ? '◆' : '◇'} スクリプト:`);
            renderChain(blocks, topId, 1, targetLines);
            targetLines.push('');
        }

        for (const [, block] of real) {
            const opcode = block.opcode || '';
            const category = opcode.split('_')[0];
            if (category) categories.add(category);
            if (LOOP_OPCODES.has(opcode)) usesLoops = true;
            if (CONDITIONAL_OPCODES.has(opcode)) usesConditionals = true;
            if (VARIABLE_OPCODES.has(opcode)) usesVariables = true;
            if (category === 'operator') usesOperators = true;
            if (opcode === 'procedures_definition') usesCustomBlocks = true;
            if (opcode === 'event_broadcast' || opcode === 'event_broadcastandwait') usesBroadcast = true;
        }

        if (targetLines.length > 0) {
            const kind = target.isStage ? 'ステージ' : 'スプライト';
            pseudocodeParts.push(`=== ${kind}: ${target.name} ===`);
            pseudocodeParts.push(...targetLines);
        }
    }

    const changedSprites =
        sprites.length > 1 || sprites.some((s) => !DEFAULT_SPRITE_NAMES.has(s.name));

    return {
        signals: {
            spriteCount: sprites.length,
            totalBlocks,
            scriptCount,
            wiredScriptCount,
            wiredBlockCount,
            wiredSoundBlockCount,
            categories: [...categories].sort(),
            usesLoops,
            usesConditionals,
            usesVariables,
            usesOperators,
            usesCustomBlocks,
            usesBroadcast,
            changedSprites,
        },
        pseudocode: pseudocodeParts.join('\n').trim(),
    };
};

export { analyzeProject, isHatOpcode, renderBlockLabel, collectReachable };
