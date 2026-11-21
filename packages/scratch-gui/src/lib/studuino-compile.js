// Studuino モードの書きこみ（#2219）: 構文木を hex を作る API に送る（Lambda・#2209 / #2210）。
// エラーの形と意味は docs/studuino-mode/README.md の「Lambda の API」。
// 子ども向けの言葉は studuinoCompileErrorMessageId で選ぶ（文言は locales の gui.studuinoWrite.error.*）。

/** webpack で埋めこむ API の場所（`.env` / GitHub Actions の STUDUINO_COMPILE_ENDPOINT）。 */
const STUDUINO_COMPILE_ENDPOINT = process.env.STUDUINO_COMPILE_ENDPOINT || '';

/**
 * hex を作る API に構文木を送る。
 * @param {object} ir - 構文木（buildStuduinoIr の ir）
 * @param {object} [options] - 差しこみ（テスト用）と中断
 * @param {string} [options.endpoint] - API の場所
 * @param {Function} [options.fetch] - fetch
 * @param {AbortSignal} [options.signal] - 中断
 * @returns {Promise<object>} 成功なら `{ok: true, hex, source, size, maxSize, toolchain}`、
 *   失敗なら `{ok: false, error, reason, retryAfter}`
 */
const compileStuduinoIr = async (ir, options = {}) => {
    const endpoint = Object.prototype.hasOwnProperty.call(options, 'endpoint')
        ? options.endpoint
        : STUDUINO_COMPILE_ENDPOINT;
    const doFetch = options.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!endpoint || !doFetch) return { ok: false, error: 'not_configured' };
    let response;
    try {
        response = await doFetch(`${endpoint.replace(/\/+$/, '')}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ir }),
            signal: options.signal,
        });
    } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false, error: 'aborted' };
        return { ok: false, error: 'network' };
    }
    let body = null;
    try {
        body = await response.json();
    } catch (e) {
        body = null;
    }
    if (response.ok && body && typeof body.hex === 'string') {
        return {
            ok: true,
            hex: body.hex,
            source: typeof body.source === 'string' ? body.source : '',
            size: body.size,
            maxSize: body.maxSize,
            toolchain: body.toolchain || null,
        };
    }
    return {
        ok: false,
        error: (body && typeof body.error === 'string' && body.error) || 'internal',
        reason: body && typeof body.reason === 'string' ? body.reason : null,
        retryAfter: body && typeof body.retryAfter === 'number' ? body.retryAfter : null,
    };
};

/**
 * 失敗を子どもにわかる言葉の id にする（docs の「Lambda の API」の error ごと）。
 * @param {{error: string, reason: ?string}} failure - compileStuduinoIr の失敗
 * @returns {string} locales の id
 */
const studuinoCompileErrorMessageId = (failure) => {
    const error = failure && failure.error;
    if (error === 'compile_failed' && failure.reason === 'flash_overflow') {
        return 'gui.studuinoWrite.error.flashOverflow';
    }
    const ids = {
        not_configured: 'gui.studuinoWrite.error.notConfigured',
        network: 'gui.studuinoWrite.error.network',
        invalid_ir: 'gui.studuinoWrite.error.invalidIr',
        forbidden_origin: 'gui.studuinoWrite.error.forbidden',
        too_large: 'gui.studuinoWrite.error.tooLarge',
        compile_failed: 'gui.studuinoWrite.error.compileFailed',
        rate_limited: 'gui.studuinoWrite.error.rateLimited',
        timeout: 'gui.studuinoWrite.error.timeout',
    };
    return ids[error] || 'gui.studuinoWrite.error.internal';
};

export { compileStuduinoIr, STUDUINO_COMPILE_ENDPOINT, studuinoCompileErrorMessageId };
