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

        converter.registerOnUntil((cond, statement) => {
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
            if (hadWait && opcode === 'control_repeat_until') {
                block.comment = converter._createComment('@ruby:method:wait', block.id);
            }
            return block;
        });
    }
};

export default ControlConverter;
