// === Smalruby: This file is Smalruby-specific (the parts of the four stages, docs/ruby-editor/converter-stages.md) ===
import AnalyzeStage from './analyze-stage';
import AstHandlers from './ast-handlers';
import BlockUtils from './block-utils';
import ClassVisitor from './class-visitor';
import CommentHandler from './comment-handler';
import ContextUtils from './context-utils';
import ConvertStage from './convert-stage';
import ConverterRegistry from './converter-registry';
import Finish from './finish';
import InitializeHandler from './initialize-handler';
import LineMappingUtils from './line-mapping';
import ModuleVisitor from './module-visitor';
import NodeUtils from './node-utils';
import ParseStage from './parse-stage';
import ReturnValueTemps from './return-value-temps';
import ScopeManager from './scope-manager';
import TargetApplier from './target-applier';
import VariableUtils from './variable-utils';

// The parts that RubyToBlocksConverter is made of, by the stage they work in. `targetCodeToBlocks`
// (index.js) calls the stages in turn: `_indexSource` / `_parse` → `_analyze` → `_convert` →
// `_finish`. `shared` holds what every stage uses: the state of a conversion (`_context`, its
// journal) and the source and the locations that the errors point at.
const STAGES = Object.freeze([
    { name: 'shared', parts: { ContextUtils, NodeUtils } },
    { name: 'parse', parts: { ParseStage } },
    { name: 'analyze', parts: { AnalyzeStage } },
    {
        name: 'convert',
        parts: {
            ConvertStage,
            AstHandlers,
            ClassVisitor,
            InitializeHandler,
            ModuleVisitor,
            ConverterRegistry,
            BlockUtils,
            VariableUtils,
            ScopeManager,
            ReturnValueTemps,
        },
    },
    // After the conversion: the checks of the whole code, the comments of the source, writing into
    // the target (`applyTargetBlocks`) and finding the block of a line (the Ruby tab)
    { name: 'finish', parts: { Finish, CommentHandler, TargetApplier, LineMappingUtils } },
]);

/**
 * Put the methods of the parts of the stages on a prototype. A method defined twice (in two parts,
 * or in a part and the class) is an error: `Object.assign` would let the later one win silently.
 * @param {object} prototype - The prototype of the converter.
 * @param {Array<object>} stages - The stages (`STAGES`).
 * @returns {object} The prototype.
 */
const mixStages = (prototype, stages) => {
    const partOf = Object.create(null);
    stages.forEach(({ name, parts }) => {
        Object.entries(parts).forEach(([partName, part]) => {
            Object.keys(part).forEach((key) => {
                const where = `${name}/${partName}`;
                if (partOf[key] || Object.prototype.hasOwnProperty.call(prototype, key)) {
                    throw new Error(`${key} of ${where} is already defined (${partOf[key] || 'the class'})`);
                }
                partOf[key] = where;
                prototype[key] = part[key];
            });
        });
    });
    return prototype;
};

export { STAGES, mixStages };
