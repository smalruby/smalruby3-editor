// === Smalruby: This file is Smalruby-specific (IME composition guard for Blockly field editors, #1167) ===
/* eslint-env jest */
import { installImeCompositionPatch } from '../../../src/lib/scratch-blocks-ime-patch.js';

/**
 * Build a stand-in for `ScratchBlocks` whose `FieldTextInput` prototype chain
 * mirrors Blockly v12: `FieldTextInput.prototype` inherits from
 * `FieldInput.prototype`, and `onHtmlInputKeyDown_` lives on the latter.
 * @returns {object} `{ScratchBlocks, calls}` where `calls` records the events
 *   that reached the original (unpatched) handler.
 */
const makeScratchBlocks = () => {
    const calls = [];
    class FieldInput {
        onHtmlInputKeyDown_(e) {
            calls.push(e);
            return 'original';
        }
    }
    class FieldTextInput extends FieldInput {}
    return { ScratchBlocks: { FieldTextInput }, calls };
};

const keydown = (props) => Object.assign({ key: 'Enter', keyCode: 13, isComposing: false }, props);

describe('installImeCompositionPatch (#1167)', () => {
    test('swallows Enter fired while the IME is composing', () => {
        const { ScratchBlocks, calls } = makeScratchBlocks();
        installImeCompositionPatch(ScratchBlocks);

        const field = new ScratchBlocks.FieldTextInput();
        field.onHtmlInputKeyDown_(keydown({ isComposing: true }));

        expect(calls).toHaveLength(0);
    });

    test('swallows Enter reported only via keyCode 229 (Safari fallback)', () => {
        const { ScratchBlocks, calls } = makeScratchBlocks();
        installImeCompositionPatch(ScratchBlocks);

        const field = new ScratchBlocks.FieldTextInput();
        field.onHtmlInputKeyDown_(keydown({ keyCode: 229, isComposing: false }));

        expect(calls).toHaveLength(0);
    });

    test('passes a plain Enter through to the original handler', () => {
        const { ScratchBlocks, calls } = makeScratchBlocks();
        installImeCompositionPatch(ScratchBlocks);

        const field = new ScratchBlocks.FieldTextInput();
        const event = keydown({});
        expect(field.onHtmlInputKeyDown_(event)).toBe('original');
        expect(calls).toEqual([event]);
    });

    test('passes Escape through when not composing but swallows it while composing', () => {
        const { ScratchBlocks, calls } = makeScratchBlocks();
        installImeCompositionPatch(ScratchBlocks);

        const field = new ScratchBlocks.FieldTextInput();
        field.onHtmlInputKeyDown_(keydown({ key: 'Escape', keyCode: 27 }));
        expect(calls).toHaveLength(1);

        // Escape while composing cancels the conversion; it must not close the editor.
        field.onHtmlInputKeyDown_(keydown({ key: 'Escape', isComposing: true }));
        expect(calls).toHaveLength(1);
    });

    test('is idempotent (installing twice does not double-wrap)', () => {
        const { ScratchBlocks, calls } = makeScratchBlocks();
        installImeCompositionPatch(ScratchBlocks);
        const patched = Object.getPrototypeOf(ScratchBlocks.FieldTextInput.prototype).onHtmlInputKeyDown_;
        installImeCompositionPatch(ScratchBlocks);
        expect(Object.getPrototypeOf(ScratchBlocks.FieldTextInput.prototype).onHtmlInputKeyDown_).toBe(patched);

        new ScratchBlocks.FieldTextInput().onHtmlInputKeyDown_(keydown({}));
        expect(calls).toHaveLength(1);
    });

    test('does not throw when scratch-blocks does not expose FieldTextInput', () => {
        expect(() => installImeCompositionPatch({})).not.toThrow();
        expect(() => installImeCompositionPatch(null)).not.toThrow();
    });
});
