import CoreHandlers from './core';
import ExpressionHandlers from './expressions';
import ControlFlowHandlers from './control-flow';
import AssignmentHandlers from './assignments';

/**
 * Aggregated AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const AstHandlers = Object.assign(
    {},
    CoreHandlers,
    ExpressionHandlers,
    ControlFlowHandlers,
    AssignmentHandlers
);

export default AstHandlers;
