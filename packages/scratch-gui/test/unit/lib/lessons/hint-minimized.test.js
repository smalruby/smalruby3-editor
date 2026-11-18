import {
    MINIMIZED_HEADING_MAX,
    minimizedHintPosition,
    shortHintHeading,
} from '../../../../src/lib/lessons/hint-minimized';

describe('shortHintHeading', () => {
    test('takes the first sentence and drops the emphasis marks', () => {
        expect(shortHintHeading('**イベント**のブロックを置こう。つぎに…')).toBe('イベントのブロックを置こう。');
        expect(shortHintHeading('Drag the **hat** block. Then…')).toBe('Drag the hat block.');
    });

    test('takes the first line', () => {
        expect(shortHintHeading('旗を押そう\nネコが動くよ')).toBe('旗を押そう');
    });

    test('cuts a long heading with …', () => {
        const long = 'あ'.repeat(MINIMIZED_HEADING_MAX + 5);
        expect(shortHintHeading(long)).toBe(`${'あ'.repeat(MINIMIZED_HEADING_MAX)}…`);
    });

    test('empty without text', () => {
        expect(shortHintHeading(null)).toBe('');
        expect(shortHintHeading('')).toBe('');
    });
});

describe('minimizedHintPosition', () => {
    // 1300×600・課題バーは 48〜88px・「ヒント」ボタンは右の端の近く・ステージの列は右（中サイズ）
    const viewport = { left: 0, top: 88, width: 1300, height: 600 };
    const bar = { left: 0, top: 48, right: 1300, bottom: 88 };
    const hintButton = { left: 1000, top: 56, right: 1060, bottom: 80 };
    const chip = { width: 200, height: 28 };

    test('just under the bar, the right end under the hint button when nothing is below', () => {
        expect(minimizedHintPosition({ bar, hintButton, stage: null, chip, viewport })).toEqual({
            left: 860,
            top: 94,
        });
    });

    test('moves to the left of the stage column so the stage buttons stay free', () => {
        const stage = { left: 820, top: 88, right: 1300, bottom: 600 };
        expect(minimizedHintPosition({ bar, hintButton, stage, chip, viewport })).toEqual({
            left: 614,
            top: 94,
        });
    });

    test('a stage column that does not reach the band of the tag does not move it', () => {
        const stage = { left: 820, top: 300, right: 1300, bottom: 600 };
        expect(minimizedHintPosition({ bar, hintButton, stage, chip, viewport }).left).toBe(860);
    });

    test('moves to the right of the palette when it would cover the palette (SP)', () => {
        const sp = { left: 56, top: 40, width: 844, height: 390 };
        const spBar = { left: 56, top: 0, right: 844, bottom: 40 };
        const button = { left: 500, top: 8, right: 560, bottom: 32 };
        const palette = { left: 56, top: 40, right: 368, bottom: 390 };
        expect(
            minimizedHintPosition({ bar: spBar, hintButton: button, stage: null, palette, chip, viewport: sp }),
        ).toEqual({ left: 374, top: 46 });
        // パレットの右に入らないときは、ずらさない
        const wide = { width: 500, height: 28 };
        expect(
            minimizedHintPosition({ bar: spBar, hintButton: button, stage: null, palette, chip: wide, viewport: sp })
                .left,
        ).toBe(64);
    });

    test('stays inside the screen (and right of the SP side rail)', () => {
        const narrow = { left: 60, top: 88, width: 360, height: 640 };
        const button = { left: 240, top: 56, right: 300, bottom: 80 };
        const stage = { left: 100, top: 88, right: 360, bottom: 300 };
        expect(minimizedHintPosition({ bar, hintButton: button, stage, chip, viewport: narrow })).toEqual({
            left: 68,
            top: 94,
        });
    });

    test('without the bar: under the top of the usable screen, at the right end', () => {
        expect(
            minimizedHintPosition({
                bar: null,
                hintButton: null,
                stage: null,
                chip,
                viewport: { ...viewport, top: 0 },
            }),
        ).toEqual({ left: 1092, top: 6 });
    });
});
