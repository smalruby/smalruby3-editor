/**
 * 「どこでしょう？」のクイズの判定（src/lib/lessons/part-quiz.js・#2134）。
 */
import { HINT_TARGETS } from '../../../../src/lib/lessons/hint-targets';
import { PART_NAMES } from '../../../../src/lib/lessons/part-names';
import {
    isPartQuizAnswer,
    isPointInRect,
    partQuizTarget,
    validatePartQuiz,
} from '../../../../src/lib/lessons/part-quiz';

describe('part quiz', () => {
    test('the part names are the labels of the name tags', () => {
        expect(partQuizTarget('palette')).toBe(HINT_TARGETS.PALETTE);
        expect(partQuizTarget('soundsTab')).toBe(HINT_TARGETS.SOUNDS_TAB);
        PART_NAMES.forEach(({ label, target }) => expect(partQuizTarget(label)).toBe(target));
        expect(partQuizTarget('nothing')).toBeNull();
    });

    test('validatePartQuiz finds unknown, repeated or missing questions', () => {
        expect(validatePartQuiz({ questions: ['palette', 'stage'] })).toEqual([]);
        expect(validatePartQuiz(null)).toEqual(['partQuiz.questions must be a non-empty array of part names']);
        expect(validatePartQuiz({ questions: [] })).toEqual([
            'partQuiz.questions must be a non-empty array of part names',
        ]);
        expect(validatePartQuiz({ questions: ['palette', 'nothing', 'palette'] })).toEqual([
            'partQuiz.questions[1]: unknown part name nothing',
            'partQuiz.questions must be unique',
        ]);
    });

    test('isPointInRect includes the edges', () => {
        const rect = { left: 10, top: 10, right: 20, bottom: 20 };
        expect(isPointInRect({ x: 10, y: 20 }, rect)).toBe(true);
        expect(isPointInRect({ x: 21, y: 15 }, rect)).toBe(false);
        expect(isPointInRect({ x: 15, y: 15 }, null)).toBe(false);
    });

    test('isPartQuizAnswer looks for the part on the page', () => {
        document.body.innerHTML = '<div data-testid="lesson-task-bar"></div>';
        const bar = document.querySelector('[data-testid="lesson-task-bar"]');
        bar.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1300, bottom: 40, width: 1300, height: 40 });
        expect(isPartQuizAnswer('taskBar', { x: 100, y: 20 }, document)).toBe(true);
        expect(isPartQuizAnswer('taskBar', { x: 100, y: 60 }, document)).toBe(false);
        // 画面に無い部分は正しくない
        expect(isPartQuizAnswer('palette', { x: 100, y: 20 }, document)).toBe(false);
        document.body.innerHTML = '';
    });
});
