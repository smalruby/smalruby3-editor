import _ from 'lodash';

 
const createControlRepeatBlock = function (converter, times, body) {
    const block = converter._createBlock('control_repeat', 'statement');
    converter._addNumberInput(block, 'TIMES', 'math_whole_number', times, 10);
    converter._addSubstack(block, body);
    return block;
};

const StopOptions = [
    'all',
    'this script',
    'other scripts in sprite'
];

const WITH_SCREEN_REFRESH_COMMENT = '@ruby:method:with_screen_refresh';

const addWithScreenRefreshComment = function (converter, block) {
    if (block.comment) {
        const existingComment = converter._context.comments[block.comment];
        if (existingComment && !existingComment.text.includes(WITH_SCREEN_REFRESH_COMMENT)) {
            existingComment.text += `,${WITH_SCREEN_REFRESH_COMMENT}`;
        }
    } else {
        block.comment = converter._createComment(WITH_SCREEN_REFRESH_COMMENT, block.id);
    }
};
 

/**
 * Control converter
 */
const ControlConverter = {

    register: function (converter) {
        // sleep(duration) - control_wait
        converter.registerOnSend('self', 'sleep', 1, params => {
            const {args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const block = converter._createBlock('control_wait', 'statement');
            converter._addNumberInput(block, 'DURATION', 'math_positive_number', args[0], 1);
            return block;
        });

        // repeat(times) { block } - control_repeat
        converter.registerOnSendWithBlock('self', 'repeat', 1, 0, params => {
            const {args, rubyBlock} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
            const block = createControlRepeatBlock(converter, args[0], cleanedRubyBlock);
            if (converter._hadWaitInLastRemove) {
                block.comment = converter._createComment('@ruby:method:wait', block.id);
            }
            return block;
        });

        // loop (without block) - returns control_forever for chaining with with_screen_refresh
        converter.registerOnSend('self', 'loop', 0, () =>
            converter._createBlock('control_forever', 'terminate')
        );

        // loop { block } and forever { block } - control_forever
        ['loop', 'forever'].forEach(methodName => {
            converter.registerOnSendWithBlock('self', methodName, 0, 0, params => {
                const {rubyBlock} = params;
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
        converter.registerOnSend('self', 'stop', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0]) || StopOptions.indexOf(args[0].toString()) < 0) return null;

            const block = converter._createBlock('control_stop', 'terminate');
            converter._addField(block, 'STOP_OPTION', args[0]);
            return block;
        });

        // create_clone(target) - control_create_clone_of
        converter.registerOnSend('self', 'create_clone', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const block = converter._createBlock('control_create_clone_of', 'statement');
            const optionBlock = converter._createBlock('control_create_clone_of_menu', 'value', {
                shadow: true
            });
            converter._addField(optionBlock, 'CLONE_OPTION', args[0]);
            converter._addInput(block, 'CLONE_OPTION', optionBlock, optionBlock);
            return block;
        });

        // clone / self.clone - control_create_clone_of("myself") with @ruby:method:clone
        // Stage cannot be cloned
        converter.registerOnSend('self', 'clone', 0, params => {
            if (converter._context.target && converter._context.target.isStage) {
                return null; // fall through to ruby_statement (Stage cannot clone)
            }
            const block = converter._createBlock('control_create_clone_of', 'statement');
            const optionBlock = converter._createBlock('control_create_clone_of_menu', 'value', {
                shadow: true
            });
            converter._addField(optionBlock, 'CLONE_OPTION', '_myself_');
            converter._addInput(block, 'CLONE_OPTION', optionBlock, optionBlock);
            block.comment = converter._createComment('@ruby:method:clone', block.id);
            return block;
        });

        // number.times (without block) - returns control_repeat for chaining with with_screen_refresh
        converter.registerOnSend('any', 'times', 0, params => {
            const {receiver} = params;
            if (!converter._isNumberOrBlock(receiver)) return null;
            return createControlRepeatBlock(converter, receiver, null);
        });

        // number.times { block } and variable.times { block } - control_repeat
        converter.registerOnSendWithBlock('any', 'times', 0, 0, params => {
            const {receiver, rubyBlock} = params;
            if (!rubyBlock || !converter._isNumberOrBlock(receiver)) return null;

            const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
            const block = createControlRepeatBlock(converter, receiver, cleanedRubyBlock);
            if (converter._hadWaitInLastRemove) {
                block.comment = converter._createComment('@ruby:method:wait', block.id);
            }
            return block;
        });

        // number.times { |i| block } - smalrubyRuby_numberMethodWithBlock
        converter.registerOnSendWithBlock('any', 'times', 0, 1, params => {
            const {receiver, rubyBlockArgs, rubyBlock} = params;
            if (!rubyBlock || !converter._isNumberOrBlock(receiver)) return null;
            if (!rubyBlockArgs || rubyBlockArgs.length !== 1) return null;

            const block = converter._createBlock(
                'smalrubyRuby_numberMethodWithBlock',
                'statement'
            );
            converter._addNumberInput(block, 'RECEIVER', 'math_number', receiver, 5);
            converter._addField(block, 'METHOD', 'times');

            // Store block param mapping in comment
            const paramName = rubyBlockArgs[0];
            block.comment = converter._createComment(
                `@ruby:block_param:1:${paramName}`, block.id
            );

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
                        if (childBlock &&
                            childBlock.opcode === 'data_variable' &&
                            childBlock.fields &&
                            childBlock.fields.VARIABLE) {
                            const varName = childBlock.fields.VARIABLE.value;
                            const paramIdx = varNameToParamIdx[varName];
                            if (paramIdx >= 0) {
                                childBlock.opcode = 'smalrubyRuby_blockParam';
                                delete childBlock.fields.VARIABLE;
                                childBlock.fields.PARAM = {
                                    name: 'PARAM',
                                    value: `_${paramIdx + 1}`
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
            replaceParamVars(rubyBlock.id);

            converter._addSubstack(block, rubyBlock);
            return block;
        });

        // number.times.with_screen_refresh { block } - control_repeat + comment
        converter.registerOnSendWithBlock('any', 'with_screen_refresh', 0, 0, params => {
            const {receiver, rubyBlock} = params;
            if (!rubyBlock) return null;

            // receiver should be the result of N.times or loop (an Enumerator-like call)
            // Check if receiver is a control_repeat block (from N.times)
            if (converter._isBlock(receiver) && receiver.opcode === 'control_repeat') {
                // Replace the empty substack with our rubyBlock
                const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
                converter._addSubstack(receiver, cleanedRubyBlock);
                addWithScreenRefreshComment(converter, receiver);
                return receiver;
            }

            // Check if receiver is a control_forever block (from loop)
            if (converter._isBlock(receiver) && receiver.opcode === 'control_forever') {
                const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
                converter._addSubstack(receiver, cleanedRubyBlock);
                addWithScreenRefreshComment(converter, receiver);
                return receiver;
            }

            return null;
        });

        // when_start_as_a_clone { block } (sprite only)
        converter.registerOnSendWithBlock('sprite', 'when_start_as_a_clone', 0, 0, params => {
            const {rubyBlock} = params;
            const block = converter.createBlock('control_start_as_clone', 'hat');
            converter.setParent(rubyBlock, block);
            return block;
        });

        // delete_this_clone method (sprite only)
        converter.registerOnSend('sprite', 'delete_this_clone', 0, () =>
            converter._createBlock('control_delete_this_clone', 'statement')
        );

        // backward compatibility
        converter.registerOnSendWithBlock('self', 'when', 1, 0, params => {
            const {args} = params;

            if (!converter._isSymbol(args[0])) return null;

            switch (converter._getSymbolValue(args[0])) {
            case 'start_as_a_clone':
                return converter.callMethod(
                    params.receiver, 'when_start_as_a_clone', params.args.slice(1),
                    params.rubyBlockArgs, params.rubyBlock, params.node
                );
            }

            return null;
        });

        // Register onXxx handlers
        converter.registerOnIf((cond, statement, elseStatement) => {
            const block = converter._createBlock('control_if', 'statement');
            if (converter._isFalseOrBooleanBlock(cond)) {
                converter._addInput(block, 'CONDITION', cond);
            }
            converter._addSubstack(block, statement);
            if (elseStatement) {
                block.opcode = 'control_if_else';
                converter._addSubstack(block, elseStatement, 2);
            }
            return block;
        });

        // with_screen_refresh { block } - unwrap for until/while body
        // When with_screen_refresh do...end appears as the sole statement in until/while,
        // register it so it returns its inner block with a flag.
        converter.registerOnSendWithBlock('self', 'with_screen_refresh', 0, 0, params => {
            const {rubyBlock} = params;
            if (!rubyBlock) return null;

            // Mark that this came from with_screen_refresh so the parent until/while knows
            converter._hadWithScreenRefreshWrapper = true;
            return rubyBlock;
        });

        converter.registerOnUntil((cond, statement) => {
            const hadWithScreenRefresh = converter._hadWithScreenRefreshWrapper;
            converter._hadWithScreenRefreshWrapper = false;

            statement = converter._removeWaitBlocks(statement);
            const hadWait = converter._hadWaitInLastRemove;

            let opcode;
            if (statement === null) {
                opcode = 'control_wait_until';
            } else {
                opcode = 'control_repeat_until';
            }
            const block = converter._createBlock(opcode, 'statement');
            if (converter._isFalseOrBooleanBlock(cond)) {
                converter._addInput(block, 'CONDITION', cond);
            }
            converter._addSubstack(block, statement);
            if (hadWithScreenRefresh && opcode === 'control_repeat_until') {
                addWithScreenRefreshComment(converter, block);
            } else if (hadWait && opcode === 'control_repeat_until') {
                block.comment = converter._createComment('@ruby:method:wait', block.id);
            }
            return block;
        });
    }
};

export default ControlConverter;
