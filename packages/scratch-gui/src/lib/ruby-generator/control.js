import { beginLoopBodyOf, isLoopConditionCall } from './scrub.js';

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

    const getComment = function (block) {
        return Generator.getCommentText(block) || '';
    };

    const hasWaitComment = function (block) {
        return getComment(block).includes('@ruby:method:wait');
    };

    const hasWithScreenRefreshComment = function (block) {
        return getComment(block).includes('@ruby:method:with_screen_refresh');
    };

    const forSave = function () {
        return Generator._options && Generator._options.forSave && String(Generator.version) !== '1';
    };

    const needsWithScreenRefresh = function (block) {
        // Comment takes priority (round-trip preservation)
        if (hasWithScreenRefreshComment(block)) return true;
        // Otherwise, forSave auto-adds it
        return forSave();
    };

    Generator.control_repeat = function (block) {
        const times = Generator.valueToCode(block, 'TIMES', Generator.ORDER_ATOMIC) || 0;
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const wait = hasWaitComment(block) ? `${Generator.INDENT}wait\n` : '';
        const suffix = needsWithScreenRefresh(block) ? '.with_screen_refresh' : '';
        return `${times}.times${suffix} do\n${branch}${wait}end\n`;
    };

    Generator.control_forever = function (block) {
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const wait = hasWaitComment(block) ? `${Generator.INDENT}wait\n` : '';
        const suffix = needsWithScreenRefresh(block) ? '.with_screen_refresh' : '';
        return `loop${suffix} do\n${branch}${wait}end\n`;
    };

    const getCaseInfo = function (block) {
        const comment = Generator.getCommentText(block);
        const match = comment ? comment.match(/^@ruby:syntax:case:(.+):(\d+)$/) : null;
        if (match) {
            return {
                subject: match[1],
                id: match[2],
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
            return { hasElse: true };
        }
        if (comment.includes('@ruby:syntax:unless_modifier')) {
            return { isModifier: true };
        }
        if (comment.includes('@ruby:syntax:unless')) {
            return { hasElse: false };
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

    Generator.control_if = function (block) {
        const caseInfo = getCaseInfo(block);
        if (caseInfo) {
            const content = controlCaseInternal(block, caseInfo);
            if (content) {
                return `case ${caseInfo.subject}\n${content}end\n`;
            }
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

    const ELSIF_PATTERN = /^@ruby:syntax:elsif:(\d+)$/;

    // A block in `else` before the `if` of `elsif` that calls a method of its condition: the call
    // and the block that keeps its value for a later call of the same method (issue #1615).
    const isElsifConditionCall = function (block) {
        const comment = getComment(block);
        if (block.opcode === 'procedures_call') {
            return /^(?:@ruby:super(?::forwarding)?,)?@ruby:return:\S+$/.test(comment);
        }
        if (block.opcode === 'data_setvariableto') return /^@ruby:return:\w+:\d+$/.test(comment);
        return false;
    };

    /**
     * Find the `if` of `elsif` in `else` of a block, after the blocks that call the methods of its
     * condition (issue #1615), and write those blocks: they write nothing and put the calls in the
     * cache that the condition takes them from.
     * @param {object} block - The control_if_else block of `if` / `elsif`.
     * @param {string} elsifGroup - The number of the `elsif` marker of the block.
     * @returns {?object} The block of `elsif`, or null when `else` is not only one `elsif`.
     */
    const elsifBlockOf = function (block, elsifGroup) {
        const substack2 = block.inputs.SUBSTACK2;
        const calls = [];
        let nextBlock = substack2 && substack2.block ? Generator.getBlock(substack2.block) : null;
        while (nextBlock && isElsifConditionCall(nextBlock)) {
            calls.push(nextBlock);
            nextBlock = Generator.getBlock(nextBlock.next);
        }
        if (!nextBlock || (nextBlock.opcode !== 'control_if' && nextBlock.opcode !== 'control_if_else')) {
            return null;
        }
        const nextMatch = getComment(nextBlock).match(ELSIF_PATTERN);
        if (!nextMatch || nextMatch[1] !== elsifGroup) return null;
        // Blocks after the `if` would be lost in `elsif`.
        if (nextBlock.next) return null;
        if (calls.length === 0) return nextBlock;
        const written = calls.every((call) => {
            call._skipNextInScrub = true;
            const code = Generator.blockToCode(call);
            delete call._skipNextInScrub;
            return code === '';
        });
        return written ? nextBlock : null;
    };

    const controlIfElseInternal = function (block, isTopLevel) {
        const match = getComment(block).match(ELSIF_PATTERN);
        const elsifGroup = match ? match[1] : null;

        const nextBlock = elsifGroup ? elsifBlockOf(block, elsifGroup) : null;
        if (nextBlock) {
            const nextOperator = Generator.valueToCode(nextBlock, 'CONDITION', Generator.ORDER_NONE) || false;
            const nextBranch = Generator.statementToCode(nextBlock, 'SUBSTACK') || '';
            let nextBranch2 = '';
            if (nextBlock.opcode === 'control_if_else') {
                nextBranch2 = controlIfElseInternal(nextBlock, false);
            }
            return `elsif ${nextOperator}\n${nextBranch}${nextBranch2}`;
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

    const wrapWithScreenRefresh = function (branch) {
        // Indent the branch body one extra level inside with_screen_refresh.
        // branch is already indented one level (e.g. "  move(10)\n").
        const indented = branch.replace(/^(?=.)/gm, Generator.INDENT);
        return `${Generator.INDENT}with_screen_refresh do\n${indented}${Generator.INDENT}end\n`;
    };

    // Whether the body of a loop has only the blocks that call the methods of its condition again
    // (`@ruby`:loop_condition_call, issue #1606).
    const hasOnlyConditionCalls = function (block) {
        const substack = block.inputs.SUBSTACK;
        let child = substack ? Generator.getBlock(substack.block) : null;
        while (child) {
            if (!isLoopConditionCall(Generator.getCommentText(child))) {
                return false;
            }
            child = Generator.getBlock(child.next);
        }
        return true;
    };

    Generator.control_repeat_until = function (block) {
        const comment = Generator.getCommentText(block);
        // `wait until bar(a) == 0`: a loop whose body only calls the methods of the condition again (issue #1606).
        // A block put in the body on the blocks screen is written, as `until ... end`.
        if (comment && comment.split(',').includes('@ruby:syntax:wait_until') && hasOnlyConditionCalls(block)) {
            return Generator.control_wait_until(block);
        }
        const useScreenRefresh = needsWithScreenRefresh(block);
        const wait = hasWaitComment(block) ? `${Generator.INDENT}wait\n` : '';
        const isWhile = !!comment && comment.includes('@ruby:syntax:while');
        let operator;
        if (isWhile) {
            operator = getWhileCondition(block);
        } else {
            operator = Generator.valueToCode(block, 'CONDITION', Generator.ORDER_NONE) || false;
        }
        const keyword = isWhile ? 'while' : 'until';
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        // `wait` goes in `with_screen_refresh do ... end`, the only statement the loop can have (issue #1656).
        const body = useScreenRefresh ? wrapWithScreenRefresh(`${branch}${wait}`) : `${branch}${wait}`;
        // `begin ... end while cond` (issue #1610): the body before the loop is not written (see scrub.js).
        if (beginLoopBodyOf(Generator, block)) {
            return `begin\n${body}end ${keyword} ${operator}\n`;
        }
        // An empty "repeat until" is `until x do` / `end`: `until x` / `end` is "wait until" (issue #1655).
        // A body of only the calls of the condition (not written, issue #1606) comes back from
        // `until x` / `end` as it is, so it does not get `do`.
        const substack = block.inputs && block.inputs.SUBSTACK;
        const emptyLoop = body === '' && !(substack && Generator.getBlock(substack.block));
        const doKeyword = emptyLoop ? ' do' : '';
        return `${keyword} ${operator}${doKeyword}\n${body}end\n`;
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
        const comment = Generator.getCommentText(block);
        if (comment && comment.includes('@ruby:method:clone')) {
            return `clone\n`;
        }
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
