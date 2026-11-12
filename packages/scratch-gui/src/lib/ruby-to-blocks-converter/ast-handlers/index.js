import AssignmentHandlers from './assignments';
import ControlFlowHandlers from './control-flow';
import CoreHandlers from './core';
import ExpressionHandlers from './expressions';

/**
 * Aggregated AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const AstHandlers = Object.assign({}, CoreHandlers, ExpressionHandlers, ControlFlowHandlers, AssignmentHandlers);

export default AstHandlers;
