/**
 * Define Ruby code generator for Control Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.control_wait = function (block) {
        const secs = Generator.valueToCode(block, 'DURATION', Generator.ORDER_NONE) || 0;
        return `sleep(${secs})\n`;
    };

    const hasWaitComment = function (block) {
        const comment = Generator.getCommentText(block);
        return comment && comment.includes('@ruby:method:wait');
    };

    Generator.control_repeat = function (block) {
        const times = Generator.valueToCode(block, 'TIMES', Generator.ORDER_ATOMIC) || 0;
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const wait = hasWaitComment(block) ? `${Generator.INDENT}wait\n` : '';
        const screenRefresh = Generator._options && Generator._options.forSave ?
            '(screen_refresh: true) ' : ' ';
        return `${times}.times${screenRefresh}do\n${branch}${wait}end\n`;
    };

    Generator.control_forever = function (block) {
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const wait = hasWaitComment(block) ? `${Generator.INDENT}wait\n` : '';
        return `loop do\n${branch}${wait}end\n`;
    };

    const getCaseInfo = function (block) {
        const comment = Generator.getCommentText(block);
        const match = comment ? comment.match(/^@ruby:syntax:case:(.+):(\d+)$/) : null;
        if (match) {
            return {
                subject: match[1],
                id: match[2]
            };
        }
        return null;
    };

    const controlCaseInternal = function (block, caseInfo) {
        const condBlockId = block.inputs.CONDITION ? block.inputs.CONDITION.block : null;
        const condBlock = condBlockId ? Generator.getBlock(condBlockId) : null;
        if (!condBlock || condBlock.opcode !== 'operator_equals') {
            return '';
        }
        const rh = Generator.valueToCode(condBlock, 'OPERAND2', Generator.ORDER_NONE);
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';

        let result = `when ${Generator.nosToCode(rh)}\n${branch}`;

        if (block.opcode === 'control_if_else') {
            const substack2 = block.inputs.SUBSTACK2;
            if (substack2 && substack2.block) {
                const nextBlock = Generator.getBlock(substack2.block);
                const nextCaseInfo = nextBlock ? getCaseInfo(nextBlock) : null;
                if (nextCaseInfo && nextCaseInfo.subject === caseInfo.subject && nextCaseInfo.id === caseInfo.id) {
                    result += controlCaseInternal(nextBlock, caseInfo);
                } else {
                    const elseBranch = Generator.statementToCode(block, 'SUBSTACK2') || '';
                    if (elseBranch) {
                        result += `else\n${elseBranch}`;
                    }
                }
            }
        }
        return result;
    };

    const getUnlessInfo = function (block) {
        const comment = Generator.getCommentText(block);
        if (!comment) return null;
        // Check more specific patterns first to avoid substring conflicts
        if (comment.includes('@ruby:syntax:unless_else')) {
            return {hasElse: true};
        }
        if (comment.includes('@ruby:syntax:unless_modifier')) {
            return {isModifier: true};
        }
        if (comment.includes('@ruby:syntax:unless')) {
            return {hasElse: false};
        }
        return null;
    };

    // Extract condition from inside operator_not wrapper.
    // unless blocks store condition as operator_not(original_cond),
    // so we need to unwrap it to get the original condition for "unless" keyword output.
    const getUnlessCondition = function (block) {
        const condBlockId = block.inputs.CONDITION ? block.inputs.CONDITION.block : null;
        const condBlock = condBlockId ? Generator.getBlock(condBlockId) : null;
        if (condBlock && condBlock.opcode === 'operator_not') {
            return Generator.valueToCode(condBlock, 'OPERAND', Generator.ORDER_NONE) || false;
        }
        // Fallback: use the full condition as-is
        return Generator.valueToCode(block, 'CONDITION', Generator.ORDER_NONE) || false;
    };

    const getModifierInfo = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment && comment.includes('@ruby:syntax:if_modifier')) {
            return 'if';
        }
        return null;
    };

    const getVariableHint = function (block) {
        const comment = Generator.getCommentText(block);
        if (!comment) return null;
        const match = comment.match(/@ruby:variable:([^,]+)/);
        return match ? match[1] : null;
    };

    Generator.control_if = function (block) {
        const caseInfo = getCaseInfo(block);
        if (caseInfo) {
            const content = controlCaseInternal(block, caseInfo);
            if (content) {
                return `case ${caseInfo.subject}\n${content}end\n`;
            }
        }
        const comment = Generator.getCommentText(block);
        const varName = getVariableHint(block);
        if (varName) {
            const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
            if (comment.includes('@ruby:syntax:unless_modifier')) {
                return `${branch.trim()} unless ${varName}\n`;
            }
            if (comment.includes('@ruby:syntax:unless')) {
                return `unless ${varName}\n${branch}end\n`;
            }
            if (comment.includes('@ruby:syntax:if_modifier')) {
                return `${branch.trim()} if ${varName}\n`;
            }
            return `if ${varName}\n${branch}end\n`;
        }
        const unlessInfo = getUnlessInfo(block);
        if (unlessInfo) {
            const operator = getUnlessCondition(block);
            const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
            if (unlessInfo.isModifier) {
                return `${branch.trim()} unless ${operator}\n`;
            }
            return `unless ${operator}\n${branch}end\n`;
        }
        const modifierKeyword = getModifierInfo(block);
        if (modifierKeyword) {
            const operator = Generator.valueToCode(block, 'CONDITION', Generator.ORDER_NONE) || false;
            const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
            return `${branch.trim()} ${modifierKeyword} ${operator}\n`;
        }
        const operator = Generator.valueToCode(block, 'CONDITION', Generator.ORDER_NONE) || false;
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        return `if ${operator}\n${branch}end\n`;
    };

    const controlIfElseInternal = function (block, isTopLevel) {
        const comment = Generator.getCommentText(block);
        const match = comment ? comment.match(/^@ruby:syntax:elsif:(\d+)$/) : null;
        const elsifGroup = match ? match[1] : null;

        if (elsifGroup) {
            const substack2 = block.inputs.SUBSTACK2;
            if (substack2 && substack2.block) {
                const nextBlock = Generator.getBlock(substack2.block);
                if (nextBlock &&
                    (nextBlock.opcode === 'control_if' || nextBlock.opcode === 'control_if_else')) {
                    const nextComment = Generator.getCommentText(nextBlock);
                    const nextMatch = nextComment ? nextComment.match(/^@ruby:syntax:elsif:(\d+)$/) : null;
                    if (nextMatch && nextMatch[1] === elsifGroup) {
                        const nextOperator =
                            Generator.valueToCode(nextBlock, 'CONDITION', Generator.ORDER_NONE) || false;
                        const nextBranch = Generator.statementToCode(nextBlock, 'SUBSTACK') || '';
                        let nextBranch2 = '';
                        if (nextBlock.opcode === 'control_if_else') {
                            nextBranch2 = controlIfElseInternal(nextBlock, false);
                        }
                        if (nextBranch2) {
                            return `elsif ${nextOperator}\n${nextBranch}${nextBranch2}`;
                        }
                        return `elsif ${nextOperator}\n${nextBranch}`;
                    }
                }
            }
        }

        const branch2 = Generator.statementToCode(block, 'SUBSTACK2') || '';
        if (branch2 || isTopLevel) {
            return `else\n${branch2}`;
        }
        return '';
    };

    Generator.control_if_else = function (block) {
        const caseInfo = getCaseInfo(block);
        if (caseInfo) {
            const content = controlCaseInternal(block, caseInfo);
            if (content) {
                return `case ${caseInfo.subject}\n${content}end\n`;
            }
        }
        const varName = getVariableHint(block);
        if (varName) {
            const comment = Generator.getCommentText(block);
            const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
            const branch2 = Generator.statementToCode(block, 'SUBSTACK2') || '';
            if (comment.includes('@ruby:syntax:unless_else') ||
                comment.includes('@ruby:syntax:unless')) {
                return `unless ${varName}\n${branch}else\n${branch2}end\n`;
            }
            return `if ${varName}\n${branch}else\n${branch2}end\n`;
        }
        const unlessInfo = getUnlessInfo(block);
        if (unlessInfo && unlessInfo.hasElse) {
            const operator = getUnlessCondition(block);
            // Branches are in natural order: SUBSTACK = unless-then, SUBSTACK2 = unless-else
            const unlessThen = Generator.statementToCode(block, 'SUBSTACK') || '';
            const unlessElse = Generator.statementToCode(block, 'SUBSTACK2') || '';
            return `unless ${operator}\n${unlessThen}else\n${unlessElse}end\n`;
        }
        const operator = Generator.valueToCode(block, 'CONDITION', Generator.ORDER_NONE) || false;
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const branch2 = controlIfElseInternal(block, true);
        return `if ${operator}\n${branch}${branch2}end\n`;
    };

    Generator.control_wait_until = function (block) {
        const operator = Generator.valueToCode(block, 'CONDITION', Generator.ORDER_NONE) || false;
        return `wait until ${operator}\n`;
    };

    const getWhileCondition = function (block) {
        const condBlockId = block.inputs.CONDITION ? block.inputs.CONDITION.block : null;
        const condBlock = condBlockId ? Generator.getBlock(condBlockId) : null;
        if (condBlock && condBlock.opcode === 'operator_not') {
            return Generator.valueToCode(condBlock, 'OPERAND', Generator.ORDER_NONE) || false;
        }
        // Fallback: use the full condition as-is
        return Generator.valueToCode(block, 'CONDITION', Generator.ORDER_NONE) || false;
    };

    Generator.control_repeat_until = function (block) {
        const comment = Generator.getCommentText(block);
        const wait = hasWaitComment(block) ? `${Generator.INDENT}wait\n` : '';
        const varName = getVariableHint(block);
        if (varName) {
            const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
            if (comment.includes('@ruby:syntax:while')) {
                return `while ${varName}\n${branch}${wait}end\n`;
            }
            return `until ${varName}\n${branch}${wait}end\n`;
        }
        if (comment && comment.includes('@ruby:syntax:while')) {
            const operator = getWhileCondition(block);
            const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
            return `while ${operator}\n${branch}${wait}end\n`;
        }
        const operator = Generator.valueToCode(block, 'CONDITION', Generator.ORDER_NONE) || false;
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        return `until ${operator}\n${branch}${wait}end\n`;
    };

    Generator.control_stop = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment && comment.includes('@ruby:syntax:return')) {
            return '';
        }
        const target = Generator.quote_(Generator.getFieldValue(block, 'STOP_OPTION') || 'all');
        return `stop(${target})\n`;
    };

    Generator.control_start_as_clone = function (block) {
        block.isStatement = true;
        if (String(Generator.version) === '1') {
            return `self.when(:start_as_a_clone) do\n`;
        }
        return `when_start_as_a_clone do\n`;
    };

    Generator.control_create_clone_of = function (block) {
        const target = Generator.valueToCode(block, 'CLONE_OPTION', Generator.ORDER_NONE);
        return `create_clone(${target})\n`;
    };

    Generator.control_create_clone_of_menu = function (block) {
        const target = Generator.quote_(Generator.getFieldValue(block, 'CLONE_OPTION') || '_myself_');
        return [target, Generator.ORDER_ATOMIC];
    };

    Generator.control_delete_this_clone = function () {
        return 'delete_this_clone\n';
    };

    return Generator;
}
