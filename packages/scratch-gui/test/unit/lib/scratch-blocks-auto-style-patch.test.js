import { installAutoStyleSelectedPatch } from '../../../src/lib/scratch-blocks-auto-style-patch.js';

const buildMockScratchBlocks = () => {
    class ConstantProvider {
        constructor() {
            this.blockStyles = {};
        }

        validatedBlockStyle_(input) {
            const colour = input.colourPrimary;
            if (typeof colour !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colour)) {
                throw new Error(`Invalid colour: "${colour}"`);
            }
            return {
                colourPrimary: colour,
                colourSecondary: colour,
                colourTertiary: '#0b8e69',
                hat: '',
            };
        }

        createBlockStyle_(colour) {
            return this.validatedBlockStyle_({ colourPrimary: colour });
        }

        getBlockStyleForColour(colour) {
            const name = `auto_${colour}`;
            if (!this.blockStyles[name]) {
                this.blockStyles[name] = this.createBlockStyle_(colour);
            }
            return { style: this.blockStyles[name], name };
        }

        getBlockStyle(name) {
            if (this.blockStyles[name || '']) return this.blockStyles[name];
            if (name && name.startsWith('auto_')) {
                return this.getBlockStyleForColour(name.substring(5)).style;
            }
            return this.createBlockStyle_('#000000');
        }
    }
    return { blockRendering: { ConstantProvider } };
};

describe('installAutoStyleSelectedPatch', () => {
    test('without patch: opening dropdown on auto-styled shadow throws "Invalid colour"', () => {
        const ScratchBlocks = buildMockScratchBlocks();
        const constants = new ScratchBlocks.blockRendering.ConstantProvider();
        constants.getBlockStyleForColour('#0fbd8c');
        expect(() => constants.getBlockStyle('auto_#0fbd8c_selected')).toThrow(/Invalid colour/);
    });

    test('with patch: returns a selected variant matching the base style', () => {
        const ScratchBlocks = buildMockScratchBlocks();
        installAutoStyleSelectedPatch(ScratchBlocks);
        const constants = new ScratchBlocks.blockRendering.ConstantProvider();
        const base = constants.getBlockStyleForColour('#0fbd8c').style;

        const selected = constants.getBlockStyle('auto_#0fbd8c_selected');

        expect(selected).toBeDefined();
        expect(selected.colourPrimary).toBe(base.colourPrimary);
        expect(selected.colourSecondary).toBe(base.colourTertiary);
        expect(selected.hat).toBe('');
        // cached so subsequent calls return the same object
        expect(constants.getBlockStyle('auto_#0fbd8c_selected')).toBe(selected);
    });

    test('with patch: existing named styles still resolve unchanged', () => {
        const ScratchBlocks = buildMockScratchBlocks();
        installAutoStyleSelectedPatch(ScratchBlocks);
        const constants = new ScratchBlocks.blockRendering.ConstantProvider();
        const named = { colourPrimary: '#abcdef', colourSecondary: '#abcdef', colourTertiary: '#000000', hat: '' };
        constants.blockStyles.foo = named;
        expect(constants.getBlockStyle('foo')).toBe(named);
    });

    test('idempotent: applying the patch twice does not double-wrap', () => {
        const ScratchBlocks = buildMockScratchBlocks();
        installAutoStyleSelectedPatch(ScratchBlocks);
        const wrapped = ScratchBlocks.blockRendering.ConstantProvider.prototype.getBlockStyle;
        installAutoStyleSelectedPatch(ScratchBlocks);
        expect(ScratchBlocks.blockRendering.ConstantProvider.prototype.getBlockStyle).toBe(wrapped);
    });

    test('no-op when ConstantProvider is missing', () => {
        expect(() => installAutoStyleSelectedPatch({})).not.toThrow();
        expect(() => installAutoStyleSelectedPatch(null)).not.toThrow();
    });
});
