import { diffFromStarter, splitScripts } from '../../../../src/lib/classroom-evaluation/starter-diff';

const STARTER = [
    '=== スプライト: ロボット ===',
    '◆ スクリプト:',
    '    緑の旗が押されたとき',
    '',
    '◆ スクリプト:',
    '    緑の旗が押されたとき',
    '    左の LED を点ける',
    '',
].join('\n');

describe('diffFromStarter', () => {
    test('a work equal to the starter added nothing', () => {
        expect(diffFromStarter(STARTER, STARTER)).toEqual({ added: [], unchanged: true });
    });

    test('returns running scripts that are not in the starter', () => {
        const work = [
            STARTER,
            '◆ スクリプト:',
            '    スペース キーが押されたとき',
            '    サーボを 90 度に曲げる（1 秒）',
            '',
        ].join('\n');
        expect(diffFromStarter(work, STARTER)).toEqual({
            added: ['スペース キーが押されたとき\nサーボを 90 度に曲げる（1 秒）'],
            unchanged: false,
        });
    });

    test('ignores loose scripts (◇) and a lone hat', () => {
        const work = [
            STARTER,
            '◇ スクリプト:',
            '    サーボを 90 度に曲げる（1 秒）',
            '◆ スクリプト:',
            '    このスプライトが押されたとき',
        ].join('\n');
        expect(diffFromStarter(work, STARTER).unchanged).toBe(true);
    });

    test('a changed starter script counts as added, with its nesting kept', () => {
        const work = [
            '◆ スクリプト:',
            '    緑の旗が押されたとき',
            '    ずっと',
            '        左の LED を点ける',
            '        1 秒待つ',
        ].join('\n');
        expect(diffFromStarter(work, STARTER).added).toEqual([
            '緑の旗が押されたとき\nずっと\n    左の LED を点ける\n    1 秒待つ',
        ]);
    });

    test('raw robot opcodes compare equal to their phrases', () => {
        const rawStarter = STARTER.replace('左の LED を点ける', '[smalrubotS1_turnLedOn] POSITION=left');
        expect(diffFromStarter(STARTER, rawStarter).unchanged).toBe(true);
    });

    test('accepts analysis objects and empty input', () => {
        expect(diffFromStarter({ pseudocode: STARTER }, { pseudocode: STARTER }).unchanged).toBe(true);
        expect(diffFromStarter('', null)).toEqual({ added: [], unchanged: true });
    });

    test('the same new script twice is listed once', () => {
        const script = '◆ スクリプト:\n    緑の旗が押されたとき\n    右の LED を消す';
        expect(diffFromStarter(`${script}\n${script}`, STARTER).added).toHaveLength(1);
    });
});

describe('splitScripts', () => {
    test('marks running and loose scripts', () => {
        const scripts = splitScripts('◆ スクリプト:\n    a\n◇ スクリプト:\n    b');
        expect(scripts.map((s) => s.runs)).toEqual([true, false]);
    });
});
