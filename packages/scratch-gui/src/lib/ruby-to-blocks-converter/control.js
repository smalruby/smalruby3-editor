import _ from 'lodash';
import { messages } from './converter-errors';
import { RubyToBlocksConverterError } from './errors';

const createControlRepeatBlock = function (converter, times, body) {
    const block = converter._createBlock('control_repeat', 'statement');
    converter._addNumberInput(block, 'TIMES', 'math_whole_number', times, 10);
    converter._addSubstack(block, body);
    return block;
};

const StopOptions = ['all', 'this script', 'other scripts in sprite'];

const WITH_SCREEN_REFRESH_COMMENT = '@ruby:method:with_screen_refresh';

const WAIT_COMMENT = '@ruby:method:wait';

const addMethodComment = function (converter, block, text) {
    if (block.comment) {
        const existingComment = converter._context.comments[block.comment];
        if (existingComment && !existingComment.text.includes(text)) {
            existingComment.text += `,${text}`;
        }
    } else {
        block.comment = converter._createComment(text, block.id);
    }
};

const addWithScreenRefreshComment = function (converter, block) {
    addMethodComment(converter, block, WITH_SCREEN_REFRESH_COMMENT);
};

/**
 * Control converter
 */
const ControlConverter = {
    register: function (converter) {
        // sleep(duration) - control_wait
        converter.registerOnSend('self', 'sleep', 1, (params) => {
            const { args } = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const block = converter._createBlock('control_wait', 'statement');
            converter._addNumberInput(block, 'DURATION', 'math_positive_number', args[0], 1);
            return block;
        });

        // repeat(times) { block } - control_repeat
        converter.registerOnSendWithBlock('self', 'repeat', 1, 0, (params) => {
            const { args, rubyBlock } = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
            const block = createControlRepeatBlock(converter, args[0], cleanedRubyBlock);
            if (converter._hadWaitInLastRemove) {
                block.comment = converter._createComment('@ruby:method:wait', block.id);
            }
            return block;
        });

        // loop (without block) - returns control_forever for chaining with with_screen_refresh
        converter.registerOnSend('self', 'loop', 0, () => converter._createBlock('control_forever', 'terminate'));

        // loop { block } and forever { block } - control_forever
        ['loop', 'forever'].forEach((methodName) => {
            converter.registerOnSendWithBlock('self', methodName, 0, 0, (params) => {
                const { rubyBlock } = params;
                if (typeof rubyBlock === 'undefined') return null;

                const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
                const block = converter._createBlock('control_forever', 'terminate');
                converter._addSubstack(block, cleanedRubyBlock);
                if (converter._hadWaitInLastRemove) {
                    block.comment = converter._createComment('@ruby:method:wait', block.id);
                }
                return block;
            });
        });

        // stop(option) - control_stop
        converter.registerOnSend('self', 'stop', 1, (params) => {
            const { args } = params;
            if (!converter._isString(args[0]) || StopOptions.indexOf(args[0].toString()) < 0) return null;

            const block = converter._createBlock('control_stop', 'terminate');
            converter._addField(block, 'STOP_OPTION', args[0]);
            return block;
        });

        // create_clone(target) - control_create_clone_of
        converter.registerOnSend('self', 'create_clone', 1, (params) => {
            const { args } = params;
            if (!converter._isString(args[0])) return null;

            const block = converter._createBlock('control_create_clone_of', 'statement');
            const optionBlock = converter._createBlock('control_create_clone_of_menu', 'value', {
                shadow: true,
            });
            converter._addField(optionBlock, 'CLONE_OPTION', args[0]);
            converter._addInput(block, 'CLONE_OPTION', optionBlock, optionBlock);
            return block;
        });

        // clone / self.clone - control_create_clone_of("myself") with @ruby:method:clone
        // Stage cannot be cloned
        converter.registerOnSend('self', 'clone', 0, (params) => {
            if (converter._context.target && converter._context.target.isStage) {
                return null; // fall through to ruby_statement (Stage cannot clone)
            }
            const block = converter._createBlock('control_create_clone_of', 'statement');
            const optionBlock = converter._createBlock('control_create_clone_of_menu', 'value', {
                shadow: true,
            });
            converter._addField(optionBlock, 'CLONE_OPTION', '_myself_');
            converter._addInput(block, 'CLONE_OPTION', optionBlock, optionBlock);
            block.comment = converter._createComment('@ruby:method:clone', block.id);
            return block;
        });

        // number.times (without block) - returns control_repeat for chaining with with_screen_refresh
        converter.registerOnSend('any', 'times', 0, (params) => {
            const { receiver } = params;
            if (!converter._isNumberOrBlock(receiver)) return null;
            return createControlRepeatBlock(converter, receiver, null);
        });

        // number.times { block } and variable.times { block } - control_repeat
        // An empty body (rubyBlock is null) is an empty C block, as Scratch allows (issue #1649).
        converter.registerOnSendWithBlock('any', 'times', 0, 0, (params) => {
            const { receiver, rubyBlock } = params;
            if (typeof rubyBlock === 'undefined' || !converter._isNumberOrBlock(receiver)) return null;

            const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
            const block = createControlRepeatBlock(converter, receiver, cleanedRubyBlock);
            if (converter._hadWaitInLastRemove) {
                block.comment = converter._createComment('@ruby:method:wait', block.id);
            }
            return block;
        });

        // number.times { |i| block } - smalrubyRuby_numberMethodWithBlock
        converter.registerOnSendWithBlock('any', 'times', 0, 1, (params) => {
            const { receiver, rubyBlockArgs, rubyBlock } = params;
            if (typeof rubyBlock === 'undefined' || !converter._isNumberOrBlock(receiver)) return null;
            if (!rubyBlockArgs || rubyBlockArgs.length !== 1) return null;

            const block = converter._createBlock('smalrubyRuby_numberMethodWithBlock', 'statement');
            converter._addNumberInput(block, 'RECEIVER', 'math_number', receiver, 5);
            converter._addField(block, 'METHOD', 'times');

            // Store block param mapping in comment
            const paramName = rubyBlockArgs[0];
            block.comment = converter._createComment(`@ruby:block_param:1:${paramName}`, block.id);

            // Replace variable references in body with blockParam blocks
            const varNameToParamIdx = {};
            const variable = converter._lookupOrCreateVariable(paramName);
            varNameToParamIdx[variable.name] = 0;

            const replaceParamVars = (blockId) => {
                if (!blockId) return;
                const b = converter._context.blocks[blockId];
                if (!b) return;
                if (b.inputs) {
                    for (const inputName of Object.keys(b.inputs)) {
                        const input = b.inputs[inputName];
                        const childBlock = converter._context.blocks[input.block];
                        if (
                            childBlock &&
                            childBlock.opcode === 'data_variable' &&
                            childBlock.fields &&
                            childBlock.fields.VARIABLE
                        ) {
                            const varName = childBlock.fields.VARIABLE.value;
                            const paramIdx = varNameToParamIdx[varName];
                            if (paramIdx >= 0) {
                                childBlock.opcode = 'smalrubyRuby_blockParam';
                                delete childBlock.fields.VARIABLE;
                                childBlock.fields.PARAM = {
                                    name: 'PARAM',
                                    value: `_${paramIdx + 1}`,
                                };
                                converter._setBlockType(childBlock, 'value');
                            }
                        }
                        if (input.block) replaceParamVars(input.block);
                    }
                }
                if (b.next) replaceParamVars(b.next);
                if (b.inputs && b.inputs.SUBSTACK && b.inputs.SUBSTACK.block) {
                    replaceParamVars(b.inputs.SUBSTACK.block);
                }
            };
            if (rubyBlock) replaceParamVars(rubyBlock.id);

            converter._addSubstack(block, rubyBlock);
            return block;
        });

        // number.times.with_screen_refresh { block } - control_repeat + comment
        // An empty body (rubyBlock is null) keeps the loop's empty C block (issue #1649).
        converter.registerOnSendWithBlock('any', 'with_screen_refresh', 0, 0, (params) => {
            const { receiver, rubyBlock } = params;
            if (typeof rubyBlock === 'undefined') return null;

            // receiver should be the result of N.times (control_repeat) or loop (control_forever)
            if (
                !converter._isBlock(receiver) ||
                (receiver.opcode !== 'control_repeat' && receiver.opcode !== 'control_forever')
            ) {
                return null;
            }

            const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
            const hadWait = converter._hadWaitInLastRemove;
            converter._addSubstack(receiver, cleanedRubyBlock);
            addWithScreenRefreshComment(converter, receiver);
            // Keep `wait` too, as `N.times do wait end` does (the generator reads both marks)
            if (hadWait) addMethodComment(converter, receiver, WAIT_COMMENT);
            return receiver;
        });

        // when_start_as_a_clone { block } (sprite only)
        converter.registerOnSendWithBlock('sprite', 'when_start_as_a_clone', 0, 0, (params) => {
            const { rubyBlock } = params;
            const block = converter.createBlock('control_start_as_clone', 'hat');
            converter.setParent(rubyBlock, block);
            return block;
        });

        // delete_this_clone method (sprite only)
        converter.registerOnSend('sprite', 'delete_this_clone', 0, () =>
            converter._createBlock('control_delete_this_clone', 'statement'),
        );

        // backward compatibility
        converter.registerOnSendWithBlock('self', 'when', 1, 0, (params) => {
            const { args } = params;

            if (!converter._isSymbol(args[0])) return null;

            switch (converter._getSymbolValue(args[0])) {
                case 'start_as_a_clone':
                    return converter.callMethod(
                        params.receiver,
                        'when_start_as_a_clone',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
            }

            return null;
        });

        // Register onXxx handlers
        converter.registerOnIf((cond, statement, elseStatement) => {
            const block = converter._createBlock('control_if', 'statement');
            if (converter._isFalseOrBooleanBlock(cond)) {
                converter._addBooleanInput(block, 'CONDITION', cond);
            }
            converter._addSubstack(block, statement);
            if (elseStatement) {
                block.opcode = 'control_if_else';
                converter._addSubstack(block, elseStatement, 2);
            }
            return block;
        });

        // with_screen_refresh { block } - unwrap for until/while body
        // The blocks have it only as a mark on the loop of until / while whose body has nothing else
        // (`_withScreenRefreshLoopBody`, set by visitUntilNode / visitWhileNode). Anywhere else it would
        // be dropped, or the mark would move to a later loop, so it is an error (issue #1633).
        converter.registerOnSendWithBlock('self', 'with_screen_refresh', 0, 0, (params) => {
            const { rubyBlock, node } = params;
            if (!node || node !== converter._withScreenRefreshLoopBody) {
                throw new RubyToBlocksConverterError(
                    node || converter._context.currentNode,
                    converter._translator(messages.withScreenRefreshOutsideLoop),
                );
            }
            // Mark that this came from with_screen_refresh so the parent until/while knows
            converter._hadWithScreenRefreshWrapper = true;
            // An empty body is what the generator writes for an empty "repeat until" in the saved form:
            // nothing goes in the loop, and the mark keeps it a "repeat until" (issue #1649).
            return rubyBlock || [];
        });

        // until / while (also `wait until x`, the modifier form of `until x` / `wait` / `end`).
        // `loop` tells how the loop is written: `modifier` for `wait until x`, `doKeyword` for
        // `until x do` (issues #1655 / #1656).
        converter.registerOnUntil((cond, statement, loop = {}) => {
            const hadWithScreenRefresh = converter._hadWithScreenRefreshWrapper;
            converter._hadWithScreenRefreshWrapper = false;

            statement = converter._removeWaitBlocks(statement);
            const hadWait = converter._hadWaitInLastRemove;

            // A loop with nothing in its body is "wait until" only when it is written as
            // `wait until x` or as `until x` / `end`. An empty "repeat until" is written
            // `until x do` / `end` (or with `with_screen_refresh do end` in the saved form), and
            // `wait` in the body of `until x` ... `end` is kept as a mark of the loop.
            let opcode = 'control_repeat_until';
            if (statement === null && !hadWithScreenRefresh) {
                const waitUntil = hadWait ? loop.modifier : !loop.doKeyword;
                if (waitUntil) opcode = 'control_wait_until';
            }
            const block = converter._createBlock(opcode, 'statement');
            if (converter._isFalseOrBooleanBlock(cond)) {
                converter._addBooleanInput(block, 'CONDITION', cond);
            }
            // control_wait_until has no SUBSTACK input
            if (opcode === 'control_repeat_until') {
                converter._addSubstack(block, statement);
                // Both marks, as `N.times.with_screen_refresh do ... wait end` keeps them
                if (hadWithScreenRefresh) addWithScreenRefreshComment(converter, block);
                if (hadWait) addMethodComment(converter, block, WAIT_COMMENT);
            }
            return block;
        });
    },
};

export default ControlConverter;
