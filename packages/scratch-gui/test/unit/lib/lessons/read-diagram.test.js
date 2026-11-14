/* eslint-env jest */
import { defineChallenge } from '../../../../src/lib/lessons/courses';
import { HINT_TARGETS } from '../../../../src/lib/lessons/hint-targets';
import {
    CHALLENGE_MODES,
    READ_DIAGRAM_HINT_PAGES,
    applyChallengeMode,
    isReadDiagram,
    readDiagramMessages,
    readDiagramSteps,
} from '../../../../src/lib/lessons/read-diagram';

const TASK = { id: 'test.task', defaultMessage: 'Make a chat' };
const EXPLANATION = { id: 'test.explanation', defaultMessage: 'Read the diagram' };
const CODE = {
    ja: 'when_flag_clicked do\n  say("こんにちは")\nend\n',
    en: 'when_flag_clicked do\n  say("Hi")\nend\n',
};

describe('read-diagram (読んで作るチャレンジ)', () => {
    test('isReadDiagram is true only for mode readDiagram', () => {
        expect(isReadDiagram({ mode: CHALLENGE_MODES.READ_DIAGRAM })).toBe(true);
        expect(isReadDiagram({ mode: 'readDiagram' })).toBe(true);
        expect(isReadDiagram({ mode: null })).toBe(false);
        expect(isReadDiagram({})).toBe(false);
        expect(isReadDiagram(null)).toBe(false);
    });

    test('readDiagramSteps makes 3 pages: read (diagram + explanation), try, answer', () => {
        const steps = readDiagramSteps({ explanation: EXPLANATION, task: TASK, code: CODE });
        expect(steps).toHaveLength(READ_DIAGRAM_HINT_PAGES);
        expect(steps.map((s) => s.kind)).toEqual(['read', 'try', 'answer']);
        // 1 ページ目: 説明と、答えが最後のページにあること
        expect(steps[0].title).toBe(EXPLANATION);
        expect(steps[0].note).toBe(readDiagramMessages.answerAtEnd);
        expect(steps[0].blocks).toBeNull();
        // 2 ページ目: 試す（答えのページの手前）
        expect(steps[1].title).toBe(readDiagramMessages.try);
        expect(steps[1].blocks).toBeNull();
        // 3 ページ目: 答えのプログラム全体を描く（locale ごとのものもそのまま渡す）
        expect(steps[2].title).toBe(readDiagramMessages.answer);
        expect(steps[2].blocks).toBe(CODE);
    });

    test('the first page falls back to the task when there is no explanation', () => {
        expect(readDiagramSteps({ task: TASK, code: 'x' })[0].title).toBe(TASK);
        expect(readDiagramSteps({ code: 'x' })[0].title).toBeNull();
    });

    test('pages point next to the stage, never spotlight, and use no step-page rules', () => {
        for (const step of readDiagramSteps({ task: TASK, code: 'x' })) {
            expect(step.target).toBe(HINT_TARGETS.STAGE);
            expect(step.spotlight).toBe(false);
        }
    });

    test('the messages have ids under gui.lessonHint.readDiagram', () => {
        for (const m of Object.values(readDiagramMessages)) {
            expect(m.id).toMatch(/^gui\.lessonHint\.readDiagram\./);
            expect(typeof m.defaultMessage).toBe('string');
        }
    });

    test('applyChallengeMode leaves an ordinary challenge as it is', () => {
        const challenge = { mode: null, steps: [{ title: TASK }], activityDiagram: false };
        expect(applyChallengeMode(challenge)).toBe(challenge);
    });

    describe('defineChallenge with mode readDiagram', () => {
        const define = (def = {}) =>
            defineChallenge({
                id: 'test-read-diagram',
                mode: CHALLENGE_MODES.READ_DIAGRAM,
                task: TASK,
                code: CODE,
                ...def,
            });

        test('always shows the diagram, even if the definition says false', () => {
            expect(define().activityDiagram).toBe(true);
            expect(define({ activityDiagram: false }).activityDiagram).toBe(true);
        });

        test('replaces steps with the 3 pages (steps in the definition are not used)', () => {
            const challenge = define({ steps: [{ title: TASK, target: HINT_TARGETS.PALETTE, blocks: 'x' }] });
            expect(challenge.steps.map((s) => s.kind)).toEqual(['read', 'try', 'answer']);
            expect(challenge.steps[2].blocks).toBe(CODE);
        });

        test('uses the explanation on the first page when given', () => {
            expect(define({ explanation: EXPLANATION }).steps[0].title).toBe(EXPLANATION);
            expect(define().steps[0].title).toBe(TASK);
        });

        test('keeps goal and the rest of the definition as other challenges do', () => {
            const goal = [{ uses: ['looks_say'] }];
            const challenge = define({ goal });
            expect(challenge.goal).toBe(goal);
            expect(challenge.code).toBe(CODE);
            expect(challenge.mode).toBe('readDiagram');
        });
    });

    test('an ordinary challenge gets mode null and keeps its steps', () => {
        const challenge = defineChallenge({ id: 'test-ordinary', steps: [{ title: TASK }] });
        expect(challenge.mode).toBeNull();
        expect(challenge.explanation).toBeNull();
        expect(challenge.steps).toEqual([{ title: TASK, target: null, blocks: null, spotlight: false }]);
    });
});
