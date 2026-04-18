// === Smalruby: This file is Smalruby-specific (Ruby method extension converter) ===

import { convertToListBlock } from './variable-hash-ops';
import { messages } from './converter-errors';
import {
    buildMutation,
    stringMethodArgs,
    stringMethodMenuItems,
    arrayMethodArgs,
    arrayMethodMenuItems,
    hashMethodArgs,
    hashMethodMenuItems,
} from './smalruby-ruby-definitions';

// Set of all registered method names per class
const STRING_METHODS = new Set(Object.keys(stringMethodArgs));
const ARRAY_METHODS = new Set(Object.keys(arrayMethodArgs));
const HASH_METHODS = new Set(Object.keys(hashMethodArgs));

/**
 * Converter for Smalruby Ruby extension blocks.
 */
const SmalrubyRubyConverter = {
    register: function (converter) {
        // --- Helper: create a class method COMMAND block ---
        const createMethodBlock = (opcode, method, receiver, args, methodArgs, menuItems) => {
            const mutation = buildMutation(
                method,
                `${opcode.replace('smalrubyRuby_', '').replace('Method', '')}MethodMenu`,
                methodArgs,
                menuItems,
            );
            if (!mutation) return null;
            const block = converter._createBlock(opcode, 'statement', {
                mutation,
            });
            converter._addTextInput(block, 'RECEIVER', receiver, 'string');
            converter._addField(block, 'METHOD', method);
            if (args.length > 0) {
                converter._addTextInput(block, 'ARG1', args[0], '');
            }
            if (args.length > 1) {
                converter._addTextInput(block, 'ARG2', args[1], '');
            }
            return block;
        };

        // --- Helper: create a bang method COMMAND block ---
        const createBangMethodBlock = (opcode, method, receiver, args, methodArgs, menuItems) => {
            const varInfo = converter.lookupVariableFromVariableBlock(receiver);
            if (!varInfo) return null;
            const mutation = buildMutation(
                method,
                `${opcode.replace('smalrubyRuby_', '').replace('Method', '')}MethodMenu`,
                methodArgs,
                menuItems,
            );
            if (!mutation) return null;
            const block = converter._createBlock(opcode, 'statement', {
                mutation,
            });
            converter._addField(block, 'RECEIVER', varInfo.name);
            converter._addField(block, 'METHOD', method);
            if (args.length > 0) {
                converter._addTextInput(block, 'ARG1', args[0], '');
            }
            if (args.length > 1) {
                converter._addTextInput(block, 'ARG2', args[1], '');
            }
            return block;
        };

        // --- Register string methods ---
        const registerStringMethod = (method, numArgs) => {
            if (method.endsWith('!')) {
                converter.registerOnSend(['variable'], method, numArgs, (params) => {
                    const { receiver, args } = params;
                    return createBangMethodBlock(
                        'smalrubyRuby_stringMethod',
                        method,
                        receiver,
                        args,
                        stringMethodArgs,
                        stringMethodMenuItems,
                    );
                });
            } else {
                converter.registerOnSend(
                    ['string', 'block', 'variable'],
                    method,
                    numArgs,
                    (params) => {
                        const { receiver, args } = params;
                        return createMethodBlock(
                            'smalrubyRuby_stringMethod',
                            method,
                            receiver,
                            args,
                            stringMethodArgs,
                            stringMethodMenuItems,
                        );
                    },
                );
            }
        };

        // 0-arg string methods (empty? handled by operators.js)
        ['reverse', 'upcase', 'downcase', 'lines'].forEach((m) =>
            registerStringMethod(m, 0),
        );
        // 1-arg string methods
        registerStringMethod('delete', 1);
        // 2-arg string methods
        registerStringMethod('gsub', 2);
        // bang methods
        registerStringMethod('reverse!', 0);
        registerStringMethod('delete!', 1);
        registerStringMethod('gsub!', 2);

        // --- Register array methods ---
        const registerArrayMethod = (method, numArgs) => {
            if (method.endsWith('!')) {
                converter.registerOnSend(['variable'], method, numArgs, (params) => {
                    const { receiver, args } = params;
                    return createBangMethodBlock(
                        'smalrubyRuby_arrayMethod',
                        method,
                        receiver,
                        args,
                        arrayMethodArgs,
                        arrayMethodMenuItems,
                    );
                });
            } else {
                converter.registerOnSend(
                    ['string', 'block', 'variable', 'array'],
                    method,
                    numArgs,
                    (params) => {
                        let { receiver } = params;
                        const { args } = params;
                        // Convert data_variable to data_listcontents for list variables
                        const result = convertToListBlock(
                            converter,
                            messages,
                            receiver,
                        );
                        if (result.converted) {
                            receiver = result.block;
                        }
                        return createMethodBlock(
                            'smalrubyRuby_arrayMethod',
                            method,
                            receiver,
                            args,
                            arrayMethodArgs,
                            arrayMethodMenuItems,
                        );
                    },
                );
            }
        };

        // 0-arg array methods (empty? handled by variable-list-ops.js)
        ['max', 'min', 'sort', 'reverse', 'first', 'last'].forEach(
            (m) => registerArrayMethod(m, 0),
        );
        // join: 0-1 args
        registerArrayMethod('join', 0);
        registerArrayMethod('join', 1);
        // bang methods
        registerArrayMethod('sort!', 0);
        registerArrayMethod('reverse!', 0);

        // --- Register hash methods ---
        const registerHashMethod = (method) => {
            converter.registerOnSend(
                ['string', 'block', 'variable', 'hash'],
                method,
                0,
                (params) => {
                    const { receiver } = params;

                    // For keys/values, reference the correct hash sub-list
                    if (
                        (method === 'keys' || method === 'values') &&
                        converter._isBlock(receiver) &&
                        receiver.opcode === 'data_variable'
                    ) {
                        const varName = receiver.fields.VARIABLE.value;
                        const variable =
                            converter._context.variables[varName] ||
                            converter._context.localVariables[varName];
                        if (variable) {
                            let prefixedName;
                            if (variable.scope === 'global')
                                prefixedName = `$${varName}`;
                            else if (variable.scope === 'instance')
                                prefixedName = `@${varName}`;
                            else if (variable.scope === 'local')
                                prefixedName = variable.originalName;

                            if (prefixedName) {
                                const listName =
                                    method === 'keys'
                                        ? converter._hashKeysListName(
                                              prefixedName,
                                          )
                                        : converter._hashValuesListName(
                                              prefixedName,
                                          );
                                const listVar =
                                    converter._lookupOrCreateList(listName);
                                receiver.opcode = 'data_listcontents';
                                delete receiver.fields.VARIABLE;
                                receiver.fields.LIST = {
                                    name: 'LIST',
                                    id: listVar.id,
                                    value: listVar.name,
                                    variableType: listVar.type,
                                };
                            }
                        }
                    }

                    return createMethodBlock(
                        'smalrubyRuby_hashMethod',
                        method,
                        receiver,
                        [],
                        hashMethodArgs,
                        hashMethodMenuItems,
                    );
                },
            );
        };

        registerHashMethod('keys');
        registerHashMethod('values');
    },
};

export { STRING_METHODS, ARRAY_METHODS, HASH_METHODS };
export default SmalrubyRubyConverter;
