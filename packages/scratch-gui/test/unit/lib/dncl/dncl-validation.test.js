/**
 * Tests for DNCL mode switch validation.
 *
 * When switching from Ruby to DNCL mode, the editor performs a dry-run:
 * Ruby → DNCL → Ruby → Blocks. If the blocks conversion fails, the switch
 * is blocked and errors are shown with a prefix.
 */
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import {
    makeSpriteTarget,
    makeConverter,
} from '../../helpers/ruby-roundtrip-helper';

const DNCL_ERROR_PREFIX = '日本語モードでは対応していない記述です: ';

/**
 * Simulate the DNCL mode switch validation pipeline:
 * 1. Ruby → DNCL
 * 2. DNCL → Ruby
 * 3. Ruby → Blocks (dry run, no apply)
 *
 * Returns { valid, errors } where errors have the prefix applied.
 */
const validateForDncl = async (code) => {
    const dnclResult = rubyToDncl(code);
    const rubyResult = dnclToRuby(dnclResult.dncl);

    if (rubyResult.errors && rubyResult.errors.length > 0) {
        return {
            valid: false,
            errors: rubyResult.errors.map((err) => ({
                row: err.line - 1,
                column: err.column - 1,
                text: `${DNCL_ERROR_PREFIX}${err.message}`,
                type: 'error',
            })),
        };
    }

    const { target, runtime } = makeSpriteTarget();
    const converter = makeConverter(target, runtime, { version: '2' });
    const result = await converter.targetCodeToBlocks(target, rubyResult.ruby);

    if (!result) {
        return {
            valid: false,
            errors: converter.errors.map((err) => ({
                ...err,
                text: `${DNCL_ERROR_PREFIX}${err.text}`,
            })),
        };
    }

    return { valid: true, errors: [] };
};

describe('DNCL mode switch validation', () => {
    describe('valid code (should allow switch)', () => {
        test('empty code', async () => {
            const { valid } = await validateForDncl('');
            expect(valid).toBe(true);
        });

        test('simple variable assignment and say', async () => {
            const code = '@x = 10\nsay("hello", 1)\n';
            const { valid, errors } = await validateForDncl(code);
            expect(errors).toHaveLength(0);
            expect(valid).toBe(true);
        });

        test('variable with if and say', async () => {
            const code = [
                '@x = 10',
                'if @x > 5',
                '  say("big", 1)',
                'end',
                '',
            ].join('\n');
            const { valid } = await validateForDncl(code);
            expect(valid).toBe(true);
        });
    });

    describe('invalid code (should block switch)', () => {
        test('when_flag_clicked breaks in DNCL round-trip', async () => {
            const code =
                'when_flag_clicked do\n  say("hello", 1)\nend\n';
            const { valid, errors } = await validateForDncl(code);
            expect(valid).toBe(false);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].text).toMatch(DNCL_ERROR_PREFIX);
        });

        test('when_key_pressed is not supported in DNCL', async () => {
            const code =
                'when_key_pressed("a") do\n  say("hello", 1)\nend\n';
            const { valid, errors } = await validateForDncl(code);
            expect(valid).toBe(false);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].text).toMatch(DNCL_ERROR_PREFIX);
        });

        test('move is not supported in DNCL', async () => {
            const code = 'move(10)\n';
            const { valid, errors } = await validateForDncl(code);
            expect(valid).toBe(false);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].text).toMatch(DNCL_ERROR_PREFIX);
        });

        test('turn_right is not supported in DNCL', async () => {
            const code = 'turn_right(90)\n';
            const { valid, errors } = await validateForDncl(code);
            expect(valid).toBe(false);
            expect(errors.length).toBeGreaterThan(0);
        });

        test('broadcast is not supported in DNCL', async () => {
            const code = 'broadcast("message1")\n';
            const { valid, errors } = await validateForDncl(code);
            expect(valid).toBe(false);
            expect(errors.length).toBeGreaterThan(0);
        });

        test('when_clicked is not supported in DNCL', async () => {
            const code = 'when_clicked do\n  say("hello", 1)\nend\n';
            const { valid, errors } = await validateForDncl(code);
            expect(valid).toBe(false);
            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('error message prefix', () => {
        test('errors include the DNCL prefix', async () => {
            const code =
                'when_key_pressed("a") do\n  say("hello", 1)\nend\n';
            const { errors } = await validateForDncl(code);
            for (const err of errors) {
                expect(err.text).toContain(DNCL_ERROR_PREFIX);
            }
        });
    });
});
