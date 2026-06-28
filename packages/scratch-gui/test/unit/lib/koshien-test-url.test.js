import { KOSHIEN_TEST_BASE_URL, encodeAiToPlayerParam, buildKoshienTestUrl } from '../../../src/lib/koshien-test-url';

// Replicate how the game viewer decodes the player1/player2 parameter
// (game_viewer/js/player-ai-client.js parsePlayerAIParameter):
//   decodeURIComponent -> strip "data:" -> atob -> bytes -> TextDecoder utf-8
const decodeLikeGameViewer = (paramValue) => {
    const str = decodeURIComponent(paramValue);
    expect(str.startsWith('data:')).toBe(true);
    const base64 = str.substring('data:'.length);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
};

describe('koshien-test-url', () => {
    describe('encodeAiToPlayerParam', () => {
        test('produces a data: base64 value the game viewer can decode (ASCII)', () => {
            const code = 'koshien.connect_game(name: "player1")\n';
            const param = encodeAiToPlayerParam(code);
            expect(param.startsWith('data:')).toBe(true);
            expect(decodeLikeGameViewer(param)).toBe(code);
        });

        test('round-trips UTF-8 (Japanese comments / variable names)', () => {
            const code = '# 最短経路を計算する\nkoshien.calc_route(result: $最短経路)\n';
            const param = encodeAiToPlayerParam(code);
            expect(decodeLikeGameViewer(param)).toBe(code);
        });
    });

    describe('buildKoshienTestUrl', () => {
        test('returns the base URL unchanged when code is empty', () => {
            expect(buildKoshienTestUrl('')).toBe(KOSHIEN_TEST_BASE_URL);
        });

        test('returns the base URL unchanged when code is blank/whitespace', () => {
            expect(buildKoshienTestUrl('   \n  ')).toBe(KOSHIEN_TEST_BASE_URL);
        });

        test('sets player1 to the encoded AI program', () => {
            const code = 'move_to("1:1")\n';
            const url = new URL(buildKoshienTestUrl(code));
            expect(`${url.origin}${url.pathname}`).toBe(KOSHIEN_TEST_BASE_URL);
            const player1 = url.searchParams.get('player1');
            expect(player1).not.toBeNull();
            // URLSearchParams already percent-decodes; the value is the data: blob.
            expect(player1.startsWith('data:')).toBe(true);
            const bytes = Uint8Array.from(atob(player1.substring('data:'.length)), (c) => c.charCodeAt(0));
            expect(new TextDecoder().decode(bytes)).toBe(code);
        });

        test('does not set player2 (player2 stays the default AI)', () => {
            const url = new URL(buildKoshienTestUrl('move_to("1:1")\n'));
            expect(url.searchParams.get('player2')).toBeNull();
        });

        test('honors a custom base URL', () => {
            const url = new URL(buildKoshienTestUrl('x\n', 'http://localhost:7521/'));
            expect(url.origin).toBe('http://localhost:7521');
            expect(url.searchParams.get('player1')).not.toBeNull();
        });
    });
});
