'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
    TOKEN_HEADER, isWriteMethod, parseAllowedHosts, allowedHostSet, isAllowedHost, isAllowedOrigin,
    tokenMatches, checkHttpRequest,
} = require('../src/http-guard');

const TOKEN = 'a'.repeat(64);

test('isWriteMethod: GET / HEAD だけが読み取り。ほかは全部書き込み扱い', () => {
    assert.strictEqual(isWriteMethod('GET'), false);
    assert.strictEqual(isWriteMethod('head'), false);
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', '', undefined]) {
        assert.strictEqual(isWriteMethod(m), true, String(m));
    }
});

test('parseAllowedHosts: カンマ・空白区切り、小文字化、空は除く', () => {
    assert.deepStrictEqual(parseAllowedHosts(' LocalHost:8788, devbox:9000 ,,'), ['localhost:8788', 'devbox:9000']);
    assert.deepStrictEqual(parseAllowedHosts(undefined), []);
});

test('allowedHostSet / isAllowedHost: localhost・127.0.0.1・[::1] と設定のポートだけ', () => {
    const set = allowedHostSet(8787);
    assert.ok(set.has('localhost:8787') && set.has('127.0.0.1:8787') && set.has('[::1]:8787'));
    assert.strictEqual(isAllowedHost('localhost:8787', 8787), true);
    assert.strictEqual(isAllowedHost('LOCALHOST:8787', 8787), true);
    assert.strictEqual(isAllowedHost('127.0.0.1:8787', 8787), true);
    assert.strictEqual(isAllowedHost('localhost:8788', 8787), false); // 別のポート
    assert.strictEqual(isAllowedHost('localhost', 8787), false); // ポート無し（80 番）
    assert.strictEqual(isAllowedHost('evil.example:8787', 8787), false); // DNS rebinding
    assert.strictEqual(isAllowedHost(undefined, 8787), false);
    assert.strictEqual(isAllowedHost('localhost:8788', 8787, ['localhost:8788']), true); // 追加の許可
});

test('isAllowedOrigin: 無しは許可（curl・同一オリジンの GET）、ほかは http の自分自身だけ', () => {
    assert.strictEqual(isAllowedOrigin(undefined, 8787), true);
    assert.strictEqual(isAllowedOrigin('http://localhost:8787', 8787), true);
    assert.strictEqual(isAllowedOrigin('http://127.0.0.1:8787', 8787), true);
    assert.strictEqual(isAllowedOrigin('null', 8787), false); // sandbox iframe / file://
    assert.strictEqual(isAllowedOrigin('https://localhost:8787', 8787), false);
    assert.strictEqual(isAllowedOrigin('http://evil.example', 8787), false);
    assert.strictEqual(isAllowedOrigin('http://localhost:3000', 8787), false);
    assert.strictEqual(isAllowedOrigin('not a url', 8787), false);
});

test('tokenMatches: 一致だけ true。長さ違い・空・文字列以外は false', () => {
    assert.strictEqual(tokenMatches(TOKEN, TOKEN), true);
    assert.strictEqual(tokenMatches(TOKEN, 'b'.repeat(64)), false);
    assert.strictEqual(tokenMatches(TOKEN, TOKEN.slice(1)), false);
    assert.strictEqual(tokenMatches(TOKEN, undefined), false);
    assert.strictEqual(tokenMatches(TOKEN, ['x']), false);
    assert.strictEqual(tokenMatches('', ''), false); // 合言葉が無い daemon は全部断る
});

test('checkHttpRequest: GET は Host と Origin だけ見る（合言葉は要らない）', () => {
    const base = { port: 8787, token: TOKEN };
    assert.deepStrictEqual(checkHttpRequest({ ...base, method: 'GET', headers: { host: 'localhost:8787' } }), { ok: true });
    const bad = checkHttpRequest({ ...base, method: 'GET', headers: { host: 'evil.example:8787' } });
    assert.strictEqual(bad.ok, false);
    assert.strictEqual(bad.status, 403);
    assert.strictEqual(bad.reason, 'host');
    const badOrigin = checkHttpRequest({ ...base, method: 'GET', headers: { host: 'localhost:8787', origin: 'http://evil.example' } });
    assert.strictEqual(badOrigin.reason, 'origin');
});

test('checkHttpRequest: 書き込みは合言葉のヘッダが要る', () => {
    const base = { port: 8787, token: TOKEN, method: 'POST' };
    const none = checkHttpRequest({ ...base, headers: { host: 'localhost:8787' } });
    assert.deepStrictEqual(none, { ok: false, status: 403, reason: 'token' });
    const wrong = checkHttpRequest({ ...base, headers: { host: 'localhost:8787', [TOKEN_HEADER]: 'x' } });
    assert.strictEqual(wrong.reason, 'token');
    const ok = checkHttpRequest({
        ...base, headers: { host: '127.0.0.1:8787', origin: 'http://127.0.0.1:8787', [TOKEN_HEADER]: TOKEN },
    });
    assert.deepStrictEqual(ok, { ok: true });
    // 合言葉が合っていても、別のオリジンからは断る
    const cross = checkHttpRequest({
        ...base, headers: { host: 'localhost:8787', origin: 'http://evil.example', [TOKEN_HEADER]: TOKEN },
    });
    assert.strictEqual(cross.reason, 'origin');
});
