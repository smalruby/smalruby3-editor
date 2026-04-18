/**
 * Helper utilities for Ruby roundtrip unit tests.
 *
 * These helpers enable testing Ruby → Blocks → Ruby conversions without
 * a browser (Selenium), replacing integration tests where possible.
 *
 * Key design decisions:
 * - `runtime.getTargetForStage()` always returns a separate `isStage: true`
 *   object, so global variables ($) go to stage and instance variables (@)
 *   go to sprite targets correctly.
 * - Sprite name references (e.g. go_to("Abby")) are stored as plain string
 *   field values and require no VM mock.
 * - `isStage: true` targets can be tested by passing the stage as the target.
 */
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';
import RubyGenerator from '../../../src/lib/ruby-generator';
import Variable from '@smalruby/scratch-vm/src/engine/variable';
import Blocks from '@smalruby/scratch-vm/src/engine/blocks';

import MathBlocks from '../../../src/lib/ruby-generator/math.js';
import TextBlocks from '../../../src/lib/ruby-generator/text.js';
import ColourBlocks from '../../../src/lib/ruby-generator/colour.js';
import MotionBlocks from '../../../src/lib/ruby-generator/motion.js';
import LooksBlocks from '../../../src/lib/ruby-generator/looks.js';
import SoundBlocks from '../../../src/lib/ruby-generator/sound.js';
import EventBlocks from '../../../src/lib/ruby-generator/event.js';
import ControlBlocks from '../../../src/lib/ruby-generator/control.js';
import SensingBlocks from '../../../src/lib/ruby-generator/sensing.js';
import OperatorsBlocks from '../../../src/lib/ruby-generator/operators.js';
import DataBlocks from '../../../src/lib/ruby-generator/data.js';
import ProcedureBlocks from '../../../src/lib/ruby-generator/procedure.js';
import RubyBlocks from '../../../src/lib/ruby-generator/ruby.js';
import SmalrubyRubyBlocks from '../../../src/lib/ruby-generator/smalruby-ruby.js';

/**
 * Build a minimal target-like object.
 * @param {string} id
 * @param {boolean} isStage
 * @param {object} runtime
 * @returns {object}
 */
const makeTargetObj = (id, isStage, runtime) => {
    const t = {
        isStage,
        id,
        variables: {},
        lists: {},
        broadcastMsgs: {},
        comments: {},
        runtime,
        createVariable (vid, name, type) {
            this.variables[vid] = new Variable(vid, name, type);
        },
        lookupVariableByNameAndType (name, type) {
            for (const varId in this.variables) {
                const currVar = this.variables[varId];
                if (currVar.name === name && currVar.type === type) return currVar;
            }
            return null;
        },
        createComment (cid, blockId, text, x, y, width, height, minimized) {
            this.comments[cid] = {id: cid, blockId, text, x, y, width, height, minimized};
        }
    };
    t.blocks = new Blocks(runtime);
    return t;
};

/**
 * Create a sprite target together with an implicit stage target and runtime.
 *
 * The returned `stage` object is what `runtime.getTargetForStage()` returns,
 * so global variables ($) are correctly placed on the stage.
 *
 * @returns {{ target: object, stage: object, runtime: object }}
 */
export const makeSpriteTarget = () => {
    const runtime = {
        emitProjectChanged: () => {},
        getTargetForStage: null // filled below
    };
    const stage = makeTargetObj('stage', true, runtime);
    const target = makeTargetObj('sprite1', false, runtime);
    runtime.getTargetForStage = () => stage;
    return {target, stage, runtime};
};

/**
 * Create a stage target (isStage: true).
 *
 * @returns {{ target: object, stage: object, runtime: object }}
 */
export const makeStageTarget = () => {
    const runtime = {
        emitProjectChanged: () => {},
        getTargetForStage: null // filled below
    };
    const stage = makeTargetObj('stage', true, runtime);
    runtime.getTargetForStage = () => stage;
    return {target: stage, stage, runtime};
};

/**
 * Register all block generators into RubyGenerator and reset its state.
 * Call this in beforeEach so each test starts fresh.
 */
export const setupRubyGenerator = () => {
    RubyGenerator.cache_ = {comments: {}, targetCommentTexts: []};
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
    SmalrubyRubyBlocks(RubyGenerator);
};

/**
 * Create a RubyToBlocksConverter bound to the given target and runtime.
 *
 * A minimal `extensionManager` mock is included so that extension blocks
 * (koshien, music, mesh, etc.) do not throw during `applyTargetBlocks`.
 * Extension loading itself is skipped in unit tests.
 *
 * @param {object} target
 * @param {object} runtime
 * @returns {RubyToBlocksConverter}
 */
export const makeConverter = (target, runtime, options) => {
    const vm = {
        runtime,
        emitWorkspaceUpdate: () => {},
        extensionManager: {
            isExtensionLoaded: () => true, // treat all extensions as already loaded
            loadExtensionURL: () => Promise.resolve()
        }
    };
    const converter = new RubyToBlocksConverter(vm, options);
    converter._context.target = target;
    return converter;
};

/**
 * Convert Ruby code → Blocks → Ruby and return the generated Ruby string.
 *
 * @param {RubyToBlocksConverter} converter
 * @param {object} target
 * @param {string} code  Ruby source
 * @returns {Promise<string>} Generated Ruby (trimmed)
 */
export const rubyToBlocksToRuby = async (converter, target, code, options = {}) => {
    const result = await converter.targetCodeToBlocks(target, code);
    if (!result) {
        throw new Error(
            `Failed to convert Ruby to blocks.\nErrors: ${JSON.stringify(converter.errors)}\nCode:\n${code}`
        );
    }
    await converter.applyTargetBlocks(target);
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, options).trim();
};

/**
 * Assert that a Ruby string survives a Ruby → Blocks → Ruby round trip
 * unchanged (or converts to `expectedRuby` if provided).
 *
 * Typical usage inside a test:
 *
 *   const {target, runtime} = makeSpriteTarget();
 *   setupRubyGenerator();
 *   const converter = makeConverter(target, runtime);
 *   await expectRoundTrip(converter, target, code);
 *
 * @param {RubyToBlocksConverter} converter
 * @param {object} target
 * @param {string} code           Input Ruby
 * @param {string|null} expectedRuby  Expected output Ruby (defaults to `code`)
 */
export const expectRoundTrip = async (converter, target, code, expectedRuby = null, options) => {
    const result = await rubyToBlocksToRuby(converter, target, code, options);
    expect(result).toBe((expectedRuby !== null ? expectedRuby : code).trim());
};
