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

        // number.times { |i| block } - control_repeat with counter variable
        converter.registerOnSendWithBlock('any', 'times', 0, 1, params => {
            const {receiver, rubyBlockArgs, rubyBlock} = params;
            if (!rubyBlock || !converter._isNumberOrBlock(receiver)) return null;
            if (!rubyBlockArgs || rubyBlockArgs.length !== 1) return null;

            const paramName = rubyBlockArgs[0];
            const variable = converter._lookupOrCreateVariable(paramName);

            // Create: paramVar = 0 (with marker comment)
            const initBlock = converter._createBlock('data_setvariableto', 'statement', {
                fields: {
                    VARIABLE: {
                        name: 'VARIABLE',
                        id: variable.id,
                        value: variable.name,
                        variableType: variable.type
                    }
                }
            });
            converter._addTextInput(initBlock, 'VALUE', '0', '0');
            initBlock.comment = converter._createComment(
                `@ruby:syntax:times_param_init:${paramName}`, initBlock.id
            );

            // Create: control_repeat with marker comment
            const cleanedRubyBlock = converter._removeWaitBlocks(rubyBlock);
            const repeatBlock = createControlRepeatBlock(converter, receiver, null);
            if (converter._hadWaitInLastRemove) {
                repeatBlock.comment = converter._createComment(
                    `@ruby:method:wait\n@ruby:syntax:times_param:${paramName}`, repeatBlock.id
                );
            } else {
                repeatBlock.comment = converter._createComment(
                    `@ruby:syntax:times_param:${paramName}`, repeatBlock.id
                );
            }

            // Create: paramVar += 1 (with marker comment) — append to end of body
            const incrBlock = converter._createBlock('data_changevariableby', 'statement', {
                fields: {
                    VARIABLE: {
                        name: 'VARIABLE',
                        id: variable.id,
                        value: variable.name,
                        variableType: variable.type
                    }
                }
            });
            converter._addNumberInput(incrBlock, 'VALUE', 'math_number', 1, 1);
            incrBlock.comment = converter._createComment(
                `@ruby:syntax:times_param_incr`, incrBlock.id
            );

            // Link body: cleanedRubyBlock → incrBlock at end
            if (cleanedRubyBlock) {
                let lastBody = cleanedRubyBlock;
                while (lastBody.next) {
                    lastBody = converter._context.blocks[lastBody.next];
                }
                lastBody.next = incrBlock.id;
                incrBlock.parent = lastBody.id;
                converter._addSubstack(repeatBlock, cleanedRubyBlock);
            } else {
                converter._addSubstack(repeatBlock, incrBlock);
            }

            return [initBlock, repeatBlock];
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
