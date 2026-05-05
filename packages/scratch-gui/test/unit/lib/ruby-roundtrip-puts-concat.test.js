// === Smalruby: Roundtrip tests for `puts(...)` with string concatenation ===
//
// Verifies that left-associative `+` chains do NOT acquire unnecessary
// parens during Ruby → Blocks → Ruby roundtrip. This is required for the
// DNCLv2 `表示する(a, b, c)` ↔ Ruby `puts(a + b + c)` mapping to remain
// stable across roundtrips.
//
// See Issue #640 (DNCLv2 syntax support).
import Blocks from '@smalruby/scratch-vm/src/engine/blocks';
import Variable from '@smalruby/scratch-vm/src/engine/variable';
import RubyGenerator from '../../../src/lib/ruby-generator';
import ColourBlocks from '../../../src/lib/ruby-generator/colour.js';
import ControlBlocks from '../../../src/lib/ruby-generator/control.js';
import DataBlocks from '../../../src/lib/ruby-generator/data.js';
import EventBlocks from '../../../src/lib/ruby-generator/event.js';
import LooksBlocks from '../../../src/lib/ruby-generator/looks.js';
import MathBlocks from '../../../src/lib/ruby-generator/math.js';
import MotionBlocks from '../../../src/lib/ruby-generator/motion.js';
import OperatorsBlocks from '../../../src/lib/ruby-generator/operators.js';
import ProcedureBlocks from '../../../src/lib/ruby-generator/procedure.js';
import RubyBlocks from '../../../src/lib/ruby-generator/ruby.js';
import SensingBlocks from '../../../src/lib/ruby-generator/sensing.js';
import SoundBlocks from '../../../src/lib/ruby-generator/sound.js';
import TextBlocks from '../../../src/lib/ruby-generator/text.js';
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

describe('Roundtrip: left-associative + chain does not gain parens', () => {
    let converter;
    let target;
    let runtime;
    let vm;

    beforeEach(() => {
        runtime = {
            emitProjectChanged: () => {},
            getTargetForStage: () => target,
        };
        target = {
            blocks: new Blocks(runtime),
            variables: {},
            lists: {},
            broadcastMsgs: {},
            comments: {},
            isStage: false,
            id: 'sprite1',
            createVariable(id, name, type) {
                this.variables[id] = new Variable(id, name, type);
            },
            lookupVariableByNameAndType(name, type) {
                for (const id in this.variables) {
                    const v = this.variables[id];
                    if (v.name === name && v.type === type) return v;
                }
                return null;
            },
            createComment(id, blockId, text, x, y, width, height, minimized) {
                this.comments[id] = { id, blockId, text, x, y, width, height, minimized };
            },
        };
        vm = {
            runtime,
            emitWorkspaceUpdate: () => {},
            extensionManager: {
                isExtensionLoaded: () => true,
                loadExtensionURL: () => Promise.resolve(),
            },
        };
        converter = new RubyToBlocksConverter(vm, { version: '2' });
        converter._context.target = target;

        RubyGenerator.cache_ = { comments: {}, targetCommentTexts: [] };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};

        MathBlocks(RubyGenerator);
        TextBlocks(RubyGenerator);
        ColourBlocks(RubyGenerator);
        MotionBlocks(RubyGenerator);
        LooksBlocks(RubyGenerator);
        SoundBlocks(RubyGenerator);
        EventBlocks(RubyGenerator);
        ControlBlocks(RubyGenerator);
        SensingBlocks(RubyGenerator);
        OperatorsBlocks(RubyGenerator);
        DataBlocks(RubyGenerator);
        ProcedureBlocks(RubyGenerator);
        RubyBlocks(RubyGenerator);
    });

    const round = async (code) => {
        const r = await converter.targetCodeToBlocks(target, code);
        if (!r) {
            throw new Error(`convert failed: ${JSON.stringify(converter.errors)}`);
        }
        await converter.applyTargetBlocks(target);
        target.runtime = runtime;
        runtime.targets = [{ isStage: true, sprite: { name: 'Stage' } }, target];
        target.sprite = { name: 'Sprite1' };
        RubyGenerator.currentTarget = target;
        return RubyGenerator.targetToCode(target, { version: '2' });
    };

    test('puts: three-string concat (operator_join chain)', async () => {
        const out = await round('puts("a" + "b" + "c")');
        expect(out).toBe('puts("a" + "b" + "c")\n');
    });

    test('puts: four-string concat (operator_join chain)', async () => {
        const out = await round('puts("a" + "b" + "c" + "d")');
        expect(out).toBe('puts("a" + "b" + "c" + "d")\n');
    });

    test('puts: right-leaning explicit parens are preserved', async () => {
        // `a + (b + c)` is right-leaning; the parens are semantically meaningful
        // (they force a particular block tree), so they MUST round-trip back.
        const out = await round('puts("a" + ("b" + "c"))');
        expect(out).toBe('puts("a" + ("b" + "c"))\n');
    });

    test('puts: 4 numbers chained with + (operator_add chain)', async () => {
        const out = await round('puts(1 + 2 + 3 + 4)');
        expect(out).toBe('puts(1 + 2 + 3 + 4)\n');
    });

    test('left-associative subtract chain stays flat', async () => {
        // (1 - 2) - 3 should print as `1 - 2 - 3`, NOT `(1 - 2) - 3`
        const out = await round('@x = 1 - 2 - 3');
        expect(out).toContain('1 - 2 - 3');
        expect(out).not.toContain('(1 - 2)');
    });

    test('right-leaning subtract keeps parens (semantically required)', async () => {
        // 1 - (2 - 3) ≠ 1 - 2 - 3, so parens must be preserved
        const out = await round('@x = 1 - (2 - 3)');
        expect(out).toContain('1 - (2 - 3)');
    });

    test('left-associative multiply chain stays flat', async () => {
        const out = await round('@x = 2 * 3 * 4');
        expect(out).toContain('2 * 3 * 4');
        expect(out).not.toContain('(2 * 3)');
    });

    test('left-associative divide chain stays flat', async () => {
        const out = await round('@x = 8 / 4 / 2');
        expect(out).toContain('8 / 4 / 2');
    });
});
