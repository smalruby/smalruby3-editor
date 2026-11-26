import {
    carryOverExamples,
    exampleSignature,
    inconsistentShapes,
    normalizeScript,
    seatsToReview,
    shapeSignature,
} from '../../../../src/lib/classroom-evaluation/grade-consistency';
import { UNCHANGED_CODE } from '../../../../src/lib/classroom-evaluation/grading-ai';

const SERVO_BY_LIGHT = (low, high, threshold) =>
    '緑の旗が押されたとき\nずっと\n' +
    `    もし 光センサーの値 < ${threshold} なら\n` +
    `        サーボを ${low} 度に曲げる（1 秒）\n` +
    '    でなければ:\n' +
    `        サーボを ${high} 度に曲げる（1 秒）`;
const SERVO_ONLY = '緑の旗が押されたとき\nサーボを 90 度に曲げる（1 秒）';
const LED_ON = '緑の旗が押されたとき\n左の LED を点ける';
const IR = '緑の旗が押されたとき\nもし 赤外線センサー（A4）の値 > 10 なら\n    左の LED を点ける';

describe('normalizeScript', () => {
    test('takes out number literals, keeps names with digits', () => {
        expect(normalizeScript('サーボを -12.5 度に曲げる（1 秒）')).toBe('サーボを # 度に曲げる（# 秒）');
        expect(normalizeScript(IR)).toContain('赤外線センサー（A4）の値 > #');
        expect(normalizeScript('変数1 を 3 にする')).toBe('変数1 を # にする');
    });
});

describe('shapeSignature', () => {
    test('same shape with other numbers is the same signature', () => {
        expect(shapeSignature([SERVO_BY_LIGHT(30, 120, 50)])).toBe(shapeSignature([SERVO_BY_LIGHT(0, 90, 20)]));
    });

    test('a different structure is a different signature', () => {
        expect(shapeSignature([SERVO_BY_LIGHT(30, 120, 50)])).not.toBe(shapeSignature([SERVO_ONLY]));
        expect(shapeSignature([SERVO_ONLY, LED_ON])).not.toBe(shapeSignature([SERVO_ONLY]));
    });

    test('the order and duplicates of scripts do not matter', () => {
        expect(shapeSignature([LED_ON, SERVO_ONLY])).toBe(shapeSignature([SERVO_ONLY, LED_ON, LED_ON]));
    });

    test('nothing added is the empty signature', () => {
        expect(shapeSignature([])).toBe('');
        expect(shapeSignature(undefined)).toBe('');
    });
});

describe('exampleSignature', () => {
    test('matches the signature of the work the example came from', () => {
        const added = [SERVO_ONLY, LED_ON];
        expect(exampleSignature({ code: added.join('\n\n') })).toBe(shapeSignature(added));
        expect(exampleSignature({ code: UNCHANGED_CODE })).toBe('');
    });
});

describe('carryOverExamples', () => {
    const teacher = [{ seatNumber: 1, grade: 'B', reason: 'サーボだけ', group: 'サーボだけ', code: SERVO_ONLY }];
    const works = [
        { seatNumber: 3, added: [SERVO_BY_LIGHT(30, 120, 50)] },
        { seatNumber: 9, added: [SERVO_BY_LIGHT(0, 90, 40)] },
        { seatNumber: 4, added: [SERVO_ONLY.replace('90', '45')] },
        { seatNumber: 5, added: [LED_ON] },
        { seatNumber: 6, added: [IR] },
    ];

    test('adds one work per new shape after the teacher’s examples', () => {
        const results = [
            { seatNumber: 3, grade: 'B', reason: '明るさで切りかえる' },
            { seatNumber: 9, grade: 'B', reason: '同じ' },
            { seatNumber: 4, grade: 'B', reason: 'サーボだけ' },
            { seatNumber: 5, grade: 'C', reason: 'LED だけ' },
        ];
        const next = carryOverExamples({ examples: teacher, results, works, groupBySeat: { 3: 'サーボだけ' } });
        expect(next[0]).toBe(teacher[0]);
        expect(next.map((e) => e.seatNumber)).toEqual([1, 3, 5]);
        expect(next[1]).toEqual({
            seatNumber: 3,
            grade: 'B',
            reason: '明るさで切りかえる',
            group: 'サーボだけ',
            code: SERVO_BY_LIGHT(30, 120, 50),
        });
    });

    test('does not carry works the AI was not sure of, or without a grade', () => {
        const results = [
            { seatNumber: 3, grade: 'B', reason: '', needsReview: true },
            { seatNumber: 5, grade: '', reason: '' },
        ];
        expect(carryOverExamples({ examples: teacher, results, works })).toEqual(teacher);
    });

    test('keeps the limit and never pushes the teacher’s examples out', () => {
        const results = [
            { seatNumber: 3, grade: 'B' },
            { seatNumber: 5, grade: 'C' },
            { seatNumber: 6, grade: 'A' },
        ];
        const next = carryOverExamples({ examples: teacher, results, works, limit: 2 });
        expect(next.map((e) => e.seatNumber)).toEqual([1, 3]);
        const full = carryOverExamples({ examples: teacher, results, works, limit: 1 });
        expect(full).toEqual(teacher);
    });

    test('adds at most perChunk from one chunk', () => {
        const results = [
            { seatNumber: 3, grade: 'B' },
            { seatNumber: 5, grade: 'C' },
            { seatNumber: 6, grade: 'A' },
        ];
        expect(carryOverExamples({ examples: [], results, works, perChunk: 2 })).toHaveLength(2);
    });
});

describe('inconsistentShapes', () => {
    test('finds works of the same shape with different grades', () => {
        const graded = [
            { seatNumber: 30, added: [SERVO_BY_LIGHT(10, 170, 50)], grade: 'S' },
            { seatNumber: 3, added: [SERVO_BY_LIGHT(30, 120, 50)], grade: 'B' },
            { seatNumber: 9, added: [SERVO_BY_LIGHT(0, 90, 40)], grade: 'B' },
            { seatNumber: 35, added: [SERVO_BY_LIGHT(20, 160, 60)], grade: 'S' },
            { seatNumber: 4, added: [SERVO_ONLY], grade: 'B' },
            { seatNumber: 5, added: [SERVO_ONLY], grade: 'B' },
            { seatNumber: 7, added: [LED_ON], grade: null },
            { seatNumber: 8, added: [LED_ON], grade: 'C' },
        ];
        expect(inconsistentShapes(graded)).toEqual([
            { signature: shapeSignature([SERVO_BY_LIGHT(0, 0, 0)]), seatNumbers: [3, 9, 30, 35], grades: ['S', 'B'] },
        ]);
    });

    test('nothing when the same shapes have the same grade', () => {
        expect(inconsistentShapes([{ seatNumber: 1, added: [LED_ON], grade: 'C' }])).toEqual([]);
        expect(inconsistentShapes([])).toEqual([]);
    });
});

describe('seatsToReview with shape tags', () => {
    test('uses the shape of the tags when a work brings one', () => {
        const works = [
            { seatNumber: 30, added: ['a 0'], shape: 'switch', grade: 'A' },
            { seatNumber: 37, added: ['a 90'], shape: 'same', grade: 'B' },
        ];
        expect(seatsToReview(works)).toEqual([]);
    });
});

describe('seatsToReview', () => {
    test('marks the AI grades of an inconsistent shape, not the teacher’s', () => {
        const works = [
            { seatNumber: 3, added: [SERVO_BY_LIGHT(30, 120, 50)], grade: 'B', manual: true },
            { seatNumber: 30, added: [SERVO_BY_LIGHT(10, 170, 50)], grade: 'S' },
            { seatNumber: 35, added: [SERVO_BY_LIGHT(20, 160, 60)], grade: 'S' },
            { seatNumber: 5, added: [LED_ON], grade: 'C' },
        ];
        expect(seatsToReview(works)).toEqual([30, 35]);
    });

    test('nothing when every shape is consistent', () => {
        expect(seatsToReview([{ seatNumber: 5, added: [LED_ON], grade: 'C' }])).toEqual([]);
    });
});
