import OperatorsMathGenBlocks from './operators-math-gen.js';

/**
 * Define Ruby code generator for Operators Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    // Register arithmetic and math function generators
    OperatorsMathGenBlocks(Generator);

    Generator.operator_gt = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                if (part.startsWith('@ruby:operator:>=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_RELATIONAL;
                    const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
                    const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
                    Generator.greaterThanOrEqualCallCache_[index] = {
                        lhs: Generator.nosToCode(operand1),
                        rhs: Generator.nosToCode(operand2),
                    };
                    return [`@ruby:operator:>=:${index}`, order];
                }
            }
        }

        const order = Generator.ORDER_RELATIONAL;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
        return [`${Generator.nosToCode(operand1)} > ${Generator.nosToCode(operand2)}`, order];
    };

    Generator.operator_lt = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                if (part.startsWith('@ruby:operator:<=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_RELATIONAL;
                    const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
                    const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
                    Generator.lessThanOrEqualCallCache_[index] = {
                        lhs: Generator.nosToCode(operand1),
                        rhs: Generator.nosToCode(operand2),
                    };
                    return [`@ruby:operator:<=:${index}`, order];
                }
                if (part.startsWith('@ruby:literal:false:')) {
                    return ['false', Generator.ORDER_ATOMIC];
                }
            }
        }

        const order = Generator.ORDER_RELATIONAL;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
        return [`${Generator.nosToCode(operand1)} < ${Generator.nosToCode(operand2)}`, order];
    };

    Generator.operator_equals = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            let methodName = null;
            let index = null;
            for (const part of commentParts) {
                if (part.startsWith('@ruby:method:empty?:')) {
                    methodName = 'empty?';
                    index = part.substring(20);
                } else if (part.startsWith('@ruby:operator:!=:')) {
                    methodName = '!=';
                    index = part.substring(18);
                } else if (part.startsWith('@ruby:operator:>=:')) {
                    methodName = '>=';
                    index = part.substring(18);
                } else if (part.startsWith('@ruby:operator:<=:')) {
                    methodName = '<=';
                    index = part.substring(18);
                } else if (part.startsWith('@ruby:literal:true:')) {
                    return ['true', Generator.ORDER_ATOMIC];
                }
            }
            if (methodName === 'empty?') {
                const operand1 = Generator.valueToCode(block, 'OPERAND1', Generator.ORDER_EQUALS);
                if (operand1 === `@ruby:method:empty?:${index}`) {
                    const operand2 = Generator.valueToCode(block, 'OPERAND2', Generator.ORDER_EQUALS);
                    if (Generator.nosToCode(operand2) === 0) {
                        const receiver = Generator.emptyCallCache_[index];
                        delete Generator.emptyCallCache_[index];
                        return [`${receiver}.empty?`, Generator.ORDER_FUNCTION_CALL];
                    }
                }
            } else if (methodName === '!=') {
                const order = Generator.ORDER_EQUALS;
                const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
                const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
                Generator.notEqualsCallCache_[index] = {
                    lhs: Generator.nosToCode(operand1),
                    rhs: Generator.nosToCode(operand2),
                };
                return [`@ruby:operator:!=:${index}`, order];
            } else if (methodName === '>=') {
                return [`@ruby:operator:>=:${index}`, Generator.ORDER_EQUALS];
            } else if (methodName === '<=') {
                return [`@ruby:operator:<=:${index}`, Generator.ORDER_EQUALS];
            }
        }

        const order = Generator.ORDER_EQUALS;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
        return [`${Generator.nosToCode(operand1)} == ${Generator.nosToCode(operand2)}`, order];
    };

    /**
     * The order to ask the left operand of a left-associative operator with, so that the same
     * operator on the left gets no parentheses: `a && b && c` is `(a && b) && c` in Ruby
     * (issue #1634). The right operand keeps `order`, so `a && (b && c)`, a different block tree,
     * keeps its parentheses and comes back the same.
     * @param {number} order - The order of the operator.
     * @returns {number} The order for the left operand.
     */
    const leftAssocOrder = function (order) {
        const leftSideOrder = order + 0.5;
        if (!Generator.ORDER_OVERRIDES.some((p) => p[0] === leftSideOrder && p[1] === order)) {
            Generator.ORDER_OVERRIDES.push([leftSideOrder, order]);
        }
        return leftSideOrder;
    };

    Generator.operator_and = function (block) {
        const order = Generator.ORDER_LOGICAL_AND;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', leftAssocOrder(order)) || 'false';
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 'false';
        return [`${operand1} && ${operand2}`, order];
    };

    Generator.operator_or = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                if (part.startsWith('@ruby:operator:>=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_RELATIONAL;
                    const operand1 = Generator.valueToCode(block, 'OPERAND1', Generator.ORDER_NONE);
                    if (operand1 === `@ruby:operator:>=:${index}`) {
                        const { lhs, rhs } = Generator.greaterThanOrEqualCallCache_[index];
                        delete Generator.greaterThanOrEqualCallCache_[index];
                        return [`${lhs} >= ${rhs}`, order];
                    }
                } else if (part.startsWith('@ruby:operator:<=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_RELATIONAL;
                    const operand1 = Generator.valueToCode(block, 'OPERAND1', Generator.ORDER_NONE);
                    if (operand1 === `@ruby:operator:<=:${index}`) {
                        const { lhs, rhs } = Generator.lessThanOrEqualCallCache_[index];
                        delete Generator.lessThanOrEqualCallCache_[index];
                        return [`${lhs} <= ${rhs}`, order];
                    }
                }
            }
        }

        const order = Generator.ORDER_LOGICAL_OR;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', leftAssocOrder(order)) || 'false';
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 'false';
        return [`${operand1} || ${operand2}`, order];
    };

    /**
     * The `x = "false"` block of `not (x = "false")` made for a variable alone as a condition (e.g. `while x`)
     * (issue #1611), or null if the block is not it. The block is marked `@ruby`:variable_condition.
     * Blocks made by an older version have no mark and compare with `(0 < 0)`; they are written as the
     * variable too, as the older version did with the mark on the `if` / loop.
     * @param {object} block - The operator_not block.
     * @param {string} comment - The comment of the block.
     * @returns {?object} The operator_equals block, whose OPERAND1 is the variable.
     */
    const variableConditionOf = function (block, comment) {
        const inputBlock = (b, name) => {
            const input = b && b.inputs && b.inputs[name];
            return input && input.block ? Generator.getBlock(input.block) : null;
        };
        const eqBlock = inputBlock(block, 'OPERAND');
        if (!eqBlock || eqBlock.opcode !== 'operator_equals' || Generator.getCommentText(eqBlock)) return null;
        const varBlock = inputBlock(eqBlock, 'OPERAND1');
        const rhBlock = inputBlock(eqBlock, 'OPERAND2');
        if (!varBlock || varBlock.opcode !== 'data_variable' || !rhBlock) return null;
        const isText = (b, value) => b && b.opcode === 'text' && String(Generator.getFieldValue(b, 'TEXT')) === value;
        const marked = !!comment && comment.split(/,(?=@ruby:)/).includes('@ruby:variable_condition');
        if (marked) {
            return isText(rhBlock, 'false') ? eqBlock : null;
        }
        if (
            !comment &&
            rhBlock.opcode === 'operator_lt' &&
            !Generator.getCommentText(rhBlock) &&
            isText(inputBlock(rhBlock, 'OPERAND1'), '0') &&
            isText(inputBlock(rhBlock, 'OPERAND2'), '0')
        ) {
            return eqBlock;
        }
        return null;
    };

    Generator.operator_not = function (block) {
        const comment = Generator.getCommentText(block);
        const conditionBlock = variableConditionOf(block, comment);
        if (conditionBlock) {
            return [
                Generator.valueToCode(conditionBlock, 'OPERAND1', Generator.ORDER_ATOMIC),
                Generator.ORDER_ATOMIC,
            ];
        }
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                if (part.startsWith('@ruby:operator:!=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_NONE;
                    const operand = Generator.valueToCode(block, 'OPERAND', order);
                    if (operand === `@ruby:operator:!=:${index}`) {
                        const { lhs, rhs } = Generator.notEqualsCallCache_[index];
                        delete Generator.notEqualsCallCache_[index];
                        return [`${lhs} != ${rhs}`, Generator.ORDER_EQUALS];
                    }
                }
                // === Smalruby: Start of !~ operator generation ===
                const matchNotMatch = part.match(/^@ruby:operator:!~:(\d+)(:receiver)?$/);
                if (matchNotMatch) {
                    const cacheKey = `${matchNotMatch[1]}${matchNotMatch[2] || ''}`;
                    const order = Generator.ORDER_NONE;
                    const operand = Generator.valueToCode(block, 'OPERAND', order);
                    if (operand === `@ruby:operator:!~:${cacheKey}`) {
                        const cached = Generator.regexNotMatchCallCache_[cacheKey];
                        delete Generator.regexNotMatchCallCache_[cacheKey];
                        if (cached.receiverFlag) {
                            return [`${cached.regex} !~ ${cached.str}`, Generator.ORDER_EQUALS];
                        }
                        return [`${cached.str} !~ ${cached.regex}`, Generator.ORDER_EQUALS];
                    }
                }
                // === Smalruby: End of !~ operator generation ===
            }
        }

        const order = Generator.ORDER_UNARY_SIGN;
        const operand = Generator.valueToCode(block, 'OPERAND', order) || 'false';
        return [`!${operand}`, order];
    };

    Generator.operator_join = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment && comment.startsWith('@ruby:symbol:')) {
            const symbolName = comment.slice('@ruby:symbol:'.length);
            return [`:${symbolName}.to_s`, Generator.ORDER_FUNCTION_CALL];
        }
        if (comment === '@ruby:method:to_s') {
            const value = Generator.valueToCode(block, 'STRING1', Generator.ORDER_RECEIVER) || Generator.quote_('');
            return [`${value}.to_s`, Generator.ORDER_FUNCTION_CALL];
        }

        const order = Generator.ORDER_ADDITIVE;
        // `+` is left-associative, so an inner `+` chain on the LEFT side
        // (STRING1) does not need parens — `(a + b) + c` and `a + b + c`
        // produce the same block tree. Request the left child at a slightly
        // higher precedence (`leftAssocOrder`) so `valueToCode` skips the
        // parens for the same-precedence join. The right side stays at `order` so that
        // `a + (b + c)` keeps its semantically meaningful parens.
        const rightStr = Generator.valueToCode(block, 'STRING1', leftAssocOrder(order)) || Generator.quote_('');
        const leftStr = Generator.valueToCode(block, 'STRING2', order) || Generator.quote_('');
        return [`${rightStr} + ${leftStr}`, order];
    };

    Generator.operator_letter_of = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const str = Generator.valueToCode(block, 'STRING', Generator.ORDER_RECEIVER) || Generator.quote_('');
        const letter = Generator.valueToCode(block, 'LETTER', Generator.ORDER_INDEX) - 1 || '0';
        return [`${str}[${letter}]`, order];
    };

    Generator.operator_length = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            let methodName = null;
            let index = null;
            for (const part of commentParts) {
                if (part.startsWith('@ruby:method:empty?:')) {
                    methodName = 'empty?';
                    index = part.substring(20);
                }
            }
            if (methodName === 'empty?') {
                const str = Generator.valueToCode(block, 'STRING', Generator.ORDER_RECEIVER) || Generator.quote_('');
                Generator.emptyCallCache_[index] = str;
                return [`@ruby:method:empty?:${index}`, Generator.ORDER_FUNCTION_CALL];
            }
        }

        const order = Generator.ORDER_FUNCTION_CALL;
        const str = Generator.valueToCode(block, 'STRING', Generator.ORDER_RECEIVER) || Generator.quote_('');
        return [`${str}.length`, order];
    };

    // === Smalruby: Start of regex-aware operator_contains ===
    /**
     * Convert a quoted regex string like "/^hello/i" to a regex literal /^hello/i.
     * Returns null if the value doesn't look like a regex string.
     * @param {string} quotedValue - The quoted string from valueToCode
     * @returns {string|null} The regex literal, or null
     */
    Generator.unquoteRegex_ = function (quotedValue) {
        const m = /^"(\/(?:.+)\/[gimsuy]*)"$/.exec(quotedValue);
        if (!m) return null;
        // Unescape Ruby string escapes back to literal characters
        const unescapes = {
            n: '\n',
            t: '\t',
            r: '\r',
            '\\': '\\',
            '"': '"',
        };
        return m[1].replace(/\\(.)/g, (_, ch) => unescapes[ch] || `\\${ch}`);
    };

    Generator.operator_contains = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                const matchOp = part.match(/^@ruby:operator:(=~|!~):(\d+)(:receiver)?$/);
                if (matchOp) {
                    const [, op, index, receiverFlag] = matchOp;
                    const order = Generator.ORDER_EQUALS;
                    const str1 = Generator.valueToCode(block, 'STRING1', order) || Generator.quote_('');
                    const str2 = Generator.valueToCode(block, 'STRING2', order) || Generator.quote_('');
                    const regexStr = Generator.unquoteRegex_(str2) || str2;

                    if (op === '!~') {
                        Generator.regexNotMatchCallCache_[`${index}${receiverFlag || ''}`] = {
                            str: str1,
                            regex: regexStr,
                            receiverFlag,
                        };
                        return [`@ruby:operator:!~:${index}${receiverFlag || ''}`, order];
                    }
                    // =~ operator
                    if (receiverFlag) {
                        return [`${regexStr} =~ ${str1}`, order];
                    }
                    return [`${str1} =~ ${regexStr}`, order];
                }
            }
        }

        const str1 = Generator.valueToCode(block, 'STRING1', Generator.ORDER_NONE) || Generator.quote_('');
        const str2 = Generator.valueToCode(block, 'STRING2', Generator.ORDER_NONE) || Generator.quote_('');
        return [`${str1}.include?(${str2})`, Generator.ORDER_ATOMIC];
    };
    // === Smalruby: End of regex-aware operator_contains ===

    return Generator;
}
