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

module.exports = { TOKENS, SIGNALS, VALID_SIZES, VALID_KINDS, validateResult, readResultFile, detectToken };
