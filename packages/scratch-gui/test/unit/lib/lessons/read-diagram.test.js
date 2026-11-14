/* eslint-env jest */
import { defineChallenge } from '../../../../src/lib/lessons/courses';
import { HINT_TARGETS } from '../../../../src/lib/lessons/hint-targets';
import {
    CHALLENGE_MODES,
    READ_DIAGRAM_HINT_PAGES,
    applyChallengeMode,
    hasAnswerProgram,
    isReadDiagram,
    readDiagramAnswer,
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

    describe('the answer page with more than one script (Q1)', () => {
        const PENGUIN = { sprite: 'Penguin 2', code: 'when_flag_clicked do\n  say("P")\nend\n' };
        const OWL = { sprite: 'Owl', code: 'when_flag_clicked do\n  say("O")\nend\n' };

        test('draws code with no label when it is the only script', () => {
            expect(readDiagramAnswer({ code: 'x' })).toEqual({ blocks: 'x', label: null });
        });

        test('draws code and names the cat when spriteCodes are there too', () => {
            const { blocks, label } = readDiagramAnswer({ code: 'x', spriteCodes: [PENGUIN] });
            expect(blocks).toBe('x');
            expect(label.message).toBe(readDiagramMessages.answerOf);
            expect(label.name).toEqual(expect.objectContaining({ id: 'gui.lessons.activityDiagram.codeSprite' }));
        });

        test('names the stage when the code is the stage program', () => {
            const { label } = readDiagramAnswer({ code: 'x', codeTarget: 'stage', spriteCodes: [PENGUIN] });
            expect(label.name).toEqual(expect.objectContaining({ id: 'gui.lessons.activityDiagram.stage' }));
        });

        test('draws the first spriteCodes entry when there is no code', () => {
            expect(readDiagramAnswer({ spriteCodes: [PENGUIN] })).toEqual({ blocks: PENGUIN.code, label: null });
            const two = readDiagramAnswer({ spriteCodes: [PENGUIN, OWL] });
            expect(two.blocks).toBe(PENGUIN.code);
            expect(two.label).toEqual({ message: readDiagramMessages.answerOf, name: 'Penguin 2' });
        });

        test('the answer step carries the blocks and the label', () => {
            const steps = readDiagramSteps({ task: TASK, spriteCodes: [PENGUIN, OWL] });
            expect(steps[2].blocks).toBe(PENGUIN.code);
            expect(steps[2].label.name).toBe('Penguin 2');
            expect(steps[0].label).toBeNull();
            expect(steps[1].label).toBeNull();
        });

        test('the answerOf message has a name placeholder', () => {
            expect(readDiagramMessages.answerOf.defaultMessage).toContain('{name}');
        });
    });

    describe('a read-and-build challenge with no answer program (Q2)', () => {
        let warn;
        beforeEach(() => {
            warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        });
        afterEach(() => {
            warn.mockRestore();
        });

        test('hasAnswerProgram looks at code and spriteCodes', () => {
            expect(hasAnswerProgram({ code: 'x' })).toBe(true);
            expect(hasAnswerProgram({ code: null, spriteCodes: [{ sprite: 'Owl', code: 'x' }] })).toBe(true);
            expect(hasAnswerProgram({ code: null, spriteCodes: [] })).toBe(false);
            expect(hasAnswerProgram({ code: null, spriteCodes: [{ sprite: 'Owl', code: null }] })).toBe(false);
        });

        test('warns in development but still makes the challenge (never throws)', () => {
            const challenge = defineChallenge({ id: 'test-no-answer', mode: 'readDiagram', task: TASK });
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('test-no-answer'));
            expect(challenge.steps).toHaveLength(READ_DIAGRAM_HINT_PAGES);
        });

        test('does not warn in production', () => {
            const env = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            try {
                expect(() => defineChallenge({ id: 'test-no-answer-prod', mode: 'readDiagram' })).not.toThrow();
                expect(warn).not.toHaveBeenCalled();
            } finally {
                process.env.NODE_ENV = env;
            }
        });

        test('does not warn for a challenge with an answer or an ordinary challenge', () => {
            defineChallenge({ id: 'test-answer', mode: 'readDiagram', code: 'x' });
            defineChallenge({ id: 'test-ordinary-no-code' });
            expect(warn).not.toHaveBeenCalled();
        });
    });
});
