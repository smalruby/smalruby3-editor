'use strict';
/**
 * contract.js — autopilot 自律コントラクトの機械可読部分。
 * docs/autopilot/autonomous-contract.md の「シグナルとペイロード」を実装する。
 * 純粋関数のみ（I/O は呼び出し側）。
 */

const fs = require('fs');

/** pane に出る短い signal トークン（人間/補助用） */
const TOKENS = {
    DONE: 'AUTOPILOT_DONE',
    HITL: 'AUTOPILOT_HITL',
    ERROR: 'AUTOPILOT_ERROR',
};

/** 結果ペイロードの signal 値 */
const SIGNALS = ['done', 'hitl', 'error'];

const VALID_SIZES = ['small', 'middle', 'large'];
const VALID_KINDS = ['EPIC', 'Issue'];

/**
 * EPIC の流れ（#2385）の任意項目の値。epic-flow.js の HITL_KINDS / DECISION_KINDS と同じ
 * （contract.js は判断ロジックを持たないので、ここでは検証のために値の一覧だけを持つ）。
 */
const VALID_HITL_KINDS = ['diverge', 'must-exhausted', 'environment', 'design'];
const VALID_DECISION_KINDS = ['question', 'not-adopted', 'ai-decision', 'two-way', 'diverge', 'must-exhausted', 'unexpected-hitl'];

/**
 * EPIC の流れの任意項目（どの signal でも書ける）を検証する。
 * - `mustCount`: review が直せずに残した Must の数（0 以上の整数）
 * - `round`: review のまとめコメントの round（1 以上の整数）
 * - `hitlKind`: 🙋 の理由（signal=hitl のとき）
 * - `decisions`: EPIC の「決定待ち」に載せるもの（daemon が EPIC の Issue に書く）
 * @param {object} obj
 * @param {string[]} errors
 */
function validateEpicFields(obj, errors) {
    if (obj.mustCount != null && !(Number.isInteger(obj.mustCount) && obj.mustCount >= 0)) {
        errors.push('mustCount must be a non-negative integer');
    }
    if (obj.round != null && !(Number.isInteger(obj.round) && obj.round >= 1)) {
        errors.push('round must be a positive integer');
    }
    if (obj.hitlKind != null && !VALID_HITL_KINDS.includes(obj.hitlKind)) {
        errors.push(`hitlKind must be one of ${VALID_HITL_KINDS.join('|')}`);
    }
    if (obj.decisions == null) return;
    if (!Array.isArray(obj.decisions)) {
        errors.push('decisions must be an array');
        return;
    }
    obj.decisions.forEach((d, i) => {
        if (typeof d !== 'object' || d === null) { errors.push(`decisions[${i}] must be an object`); return; }
        if (!VALID_DECISION_KINDS.includes(d.kind)) errors.push(`decisions[${i}].kind must be one of ${VALID_DECISION_KINDS.join('|')}`);
        if (typeof d.title !== 'string' || !d.title.trim()) errors.push(`decisions[${i}].title must be a non-empty string`);
        if (d.alternatives != null && !(Array.isArray(d.alternatives) && d.alternatives.every((a) => typeof a === 'string'))) {
            errors.push(`decisions[${i}].alternatives must be an array of strings`);
        }
        for (const k of ['issue', 'pr', 'altPr']) {
            if (d[k] != null && !(Number.isInteger(d[k]) && d[k] > 0)) errors.push(`decisions[${i}].${k} must be a positive integer`);
        }
    });
}

/** 質問・選択肢の ID に使える文字（Issue のコメントのマーカーに入るので、`-->` などを入れさせない） */
const QUESTION_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const OPTION_KEY_RE = /^[A-Za-z0-9_-]{1,16}$/;
/** 1 回の hitl で出せる質問の数・1 問の選択肢の数の上限（モニターの 1 画面に収まる量） */
const MAX_QUESTIONS = 10;
const MAX_OPTIONS = 10;

/**
 * `signal=hitl` の任意項目 `questions`（モニターで人間が選んで答える質問）を検証する。
 * 形: `[{id, text, options: [{key, label, desc?}], recommended?}]`。新しい signal は作らない
 * （hitl の結果に足すだけ）。`recommended` は options の key のどれか。
 * @param {object} obj
 * @param {string[]} errors
 */
function validateQuestions(obj, errors) {
    if (obj.questions == null) return;
    if (obj.signal !== 'hitl') { errors.push('questions is allowed only when signal=hitl'); return; }
    errors.push(...questionListErrors(obj.questions));
}

/**
 * 質問の一覧（`questions`）そのものの検証。worker の結果と `bin/autopilot-ask`（#2565）が同じ形を通るように、
 * 形の検証はここ 1 か所に置く。
 * @param {*} qs
 * @returns {string[]} エラー（空なら正しい）
 */
function questionListErrors(qs) {
    const errors = [];
    if (!Array.isArray(qs) || qs.length === 0 || qs.length > MAX_QUESTIONS) {
        errors.push(`questions must be an array of 1..${MAX_QUESTIONS} items`);
        return errors;
    }
    const ids = new Set();
    qs.forEach((q, i) => {
        const at = `questions[${i}]`;
        if (typeof q !== 'object' || q === null) { errors.push(`${at} must be an object`); return; }
        if (typeof q.id !== 'string' || !QUESTION_ID_RE.test(q.id)) errors.push(`${at}.id must match ${QUESTION_ID_RE}`);
        else if (ids.has(q.id)) errors.push(`${at}.id is duplicated`);
        else ids.add(q.id);
        if (typeof q.text !== 'string' || !q.text.trim()) errors.push(`${at}.text must be a non-empty string`);
        if (!Array.isArray(q.options) || q.options.length === 0 || q.options.length > MAX_OPTIONS) {
            errors.push(`${at}.options must be an array of 1..${MAX_OPTIONS} items`);
            return;
        }
        const keys = new Set();
        q.options.forEach((o, j) => {
            const oat = `${at}.options[${j}]`;
            if (typeof o !== 'object' || o === null) { errors.push(`${oat} must be an object`); return; }
            if (typeof o.key !== 'string' || !OPTION_KEY_RE.test(o.key)) errors.push(`${oat}.key must match ${OPTION_KEY_RE}`);
            else if (keys.has(o.key)) errors.push(`${oat}.key is duplicated`);
            else keys.add(o.key);
            if (typeof o.label !== 'string' || !o.label.trim()) errors.push(`${oat}.label must be a non-empty string`);
            if (o.desc != null && typeof o.desc !== 'string') errors.push(`${oat}.desc must be a string`);
        });
        if (q.recommended != null && !keys.has(q.recommended)) errors.push(`${at}.recommended must be one of the option keys`);
    });
    return errors;
}

/**
 * 結果ペイロード（AUTOPILOT_RESULT_FILE の中身）を検証する。
 * @param {object} obj パース済み JSON
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateResult(obj) {
    const errors = [];
    if (typeof obj !== 'object' || obj === null) {
        return { ok: false, errors: ['result is not an object'] };
    }
    if (!Number.isInteger(obj.issue)) errors.push('issue must be an integer');
    if (typeof obj.phase !== 'string' || !obj.phase) errors.push('phase must be a non-empty string');
    if (!SIGNALS.includes(obj.signal)) errors.push(`signal must be one of ${SIGNALS.join('|')}`);
    if (typeof obj.summary !== 'string') errors.push('summary must be a string');

    if (obj.signal === 'done') {
        if (typeof obj.hitl !== 'boolean') errors.push('done: hitl must be boolean');
        if (obj.size != null && !VALID_SIZES.includes(obj.size)) {
            errors.push(`done: size must be one of ${VALID_SIZES.join('|')} or null`);
        }
        if (obj.kind != null && !VALID_KINDS.includes(obj.kind)) {
            errors.push(`done: kind must be one of ${VALID_KINDS.join('|')} or null`);
        }
        if (obj.createdSubIssues != null && !Array.isArray(obj.createdSubIssues)) {
            errors.push('done: createdSubIssues must be an array');
        }
        if (obj.subIssueSizes != null) {
            if (typeof obj.subIssueSizes !== 'object' || Array.isArray(obj.subIssueSizes)) {
                errors.push('done: subIssueSizes must be an object');
            } else {
                for (const [num, size] of Object.entries(obj.subIssueSizes)) {
                    if (!VALID_SIZES.includes(size)) {
                        errors.push(`done: subIssueSizes.${num} must be one of ${VALID_SIZES.join('|')}`);
                    }
                }
            }
        }
    }
    if (obj.signal === 'hitl') {
        if (typeof obj.reason !== 'string' || !obj.reason) errors.push('hitl: reason must be a non-empty string');
    }
    if (obj.signal === 'error') {
        if (typeof obj.error !== 'string' || !obj.error) errors.push('error: error must be a non-empty string');
    }
    validateEpicFields(obj, errors);
    validateQuestions(obj, errors);
    return { ok: errors.length === 0, errors };
}

/**
 * 結果ファイルを読んで検証して返す。
 * @param {string} filePath
 * @returns {{ok: boolean, result?: object, errors: string[]}}
 */
function readResultFile(filePath) {
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        return { ok: false, errors: [`cannot read result file: ${e.message}`] };
    }
    let obj;
    try {
        obj = JSON.parse(raw);
    } catch (e) {
        return { ok: false, errors: [`result file is not valid JSON: ${e.message}`] };
    }
    const { ok, errors } = validateResult(obj);
    return ok ? { ok: true, result: obj, errors: [] } : { ok: false, errors };
}

/**
 * pane テキストから最後に現れた signal トークンを返す（補助的な検出）。
 * 完了の権威は結果ファイル。これは人間観測・フォールバック用。
 * @param {string} paneText
 * @returns {string|null} 'AUTOPILOT_DONE' | 'AUTOPILOT_HITL' | 'AUTOPILOT_ERROR' | null
 */
function detectToken(paneText) {
    if (typeof paneText !== 'string') return null;
    let found = null;
    let lastIdx = -1;
    for (const tok of Object.values(TOKENS)) {
        const idx = paneText.lastIndexOf(tok);
        if (idx > lastIdx) {
            lastIdx = idx;
            found = tok;
        }
    }
    return found;
}

module.exports = {
    TOKENS, SIGNALS, QUESTION_ID_RE, OPTION_KEY_RE, MAX_QUESTIONS, MAX_OPTIONS, VALID_SIZES, VALID_KINDS, VALID_HITL_KINDS, VALID_DECISION_KINDS, validateResult, questionListErrors, readResultFile, detectToken,
};
