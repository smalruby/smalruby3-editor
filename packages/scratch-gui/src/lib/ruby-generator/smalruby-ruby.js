// === Smalruby: This file is Smalruby-specific (Ruby extension generator) ===

/**
 * Define Ruby code generator for Smalruby Ruby Extension Blocks
 * @param {object} Generator - The RubyGenerator
 * @returns {object} same as param.
 */
export default function (Generator) {
    /**
     * The hash of `@h.keys` / `@h.values`. Their receiver is the keys (or values) list of the
     * hash, whose name must not come back into the Ruby code (`@_hash_h_keys_.keys`, issue #1652).
     * @param {object} block - A smalrubyRuby_hashMethod block.
     * @returns {?string} The Ruby name of the hash, or null for any other block.
     */
    const hashReceiver = function (block) {
        if (block.opcode !== 'smalrubyRuby_hashMethod') return null;
        const input = block.inputs && block.inputs.RECEIVER;
        const receiverBlock = input && Generator.getBlock(input.block);
        if (!receiverBlock || receiverBlock.opcode !== 'data_listcontents') return null;
        return Generator.hashVariableOfListBlock(receiverBlock);
    };

    const METHOD_OPCODES = ['smalrubyRuby_stringMethod', 'smalrubyRuby_arrayMethod', 'smalrubyRuby_hashMethod'];

    /**
     * The statement block just before the statement that holds the block, or null when the
     * statement is the first one of a script or of a C block.
     * @param {object} block - A reporter block.
     * @returns {?object} The previous statement block.
     */
    const previousStatementOf = function (block) {
        let child = block;
        let parent = child && child.parent ? Generator.getBlock(child.parent) : null;
        while (parent) {
            if (parent.next === child.id) return parent;
            const inputs = parent.inputs || {};
            const childId = child.id;
            for (const name of Object.keys(inputs)) {
                if (name.startsWith('SUBSTACK') && inputs[name].block === childId) return null;
            }
            child = parent;
            parent = child.parent ? Generator.getBlock(child.parent) : null;
        }
        return null;
    };

    /**
     * The order of the expression that replaces `_rv_`: the method block just before it, whose
     * line `finishTargets` moves into `_rv_`. `"ab" * 3` is a multiplication, so the outer block
     * puts parentheses around it where they are needed: `-("ab" * 3)`, `("ab" * 3).length`, but
     * not `"y" + "ab" * 3` (issue #1690). Any other method makes a call.
     * @param {object} block - A smalrubyRuby_returnValue(Truthy) block.
     * @returns {number} The order of the expression.
     */
    const returnValueOrder = function (block) {
        const prev = previousStatementOf(block);
        if (prev && METHOD_OPCODES.includes(prev.opcode) && Generator.getFieldValue(prev, 'METHOD') === '*') {
            return Generator.ORDER_MULTIPLICATIVE;
        }
        return Generator.ORDER_FUNCTION_CALL;
    };

    // --- Method call expression builder ---
    const buildMethodCallExpr = function (block) {
        const method = Generator.getFieldValue(block, 'METHOD') || 'reverse';
        const isBang = method.endsWith('!');

        let receiver;
        if (isBang) {
            const varName = Generator.getFieldValue(block, 'RECEIVER') || '';
            // Array bang methods (sort!, reverse!) reference the LIST
            // variant; string bang methods reference the SCALAR variant.
            // target-applier.js (issue #634) drops the eager SCALAR
            // entry when an array literal also creates a same-name LIST,
            // so try both stores.
            receiver = Generator.variableNameByName(varName) || Generator.listNameByName(varName) || 'nil';
        } else {
            receiver =
                hashReceiver(block) ||
                Generator.valueToCode(block, 'RECEIVER', Generator.ORDER_RECEIVER) ||
                Generator.quote_('');
        }

        const hasArg1 = block.inputs && block.inputs.ARG1;
        if (!hasArg1) {
            return `${receiver}.${method}`;
        }

        // Operator methods: generate infix notation (e.g. receiver * arg). The right side of `*`
        // needs parentheses only for an operator as loose as `*` or looser: `"ab" * a.length`,
        // `"ab" * (1 + 2)`.
        if (method === '*') {
            const operand =
                Generator.valueToCode(block, 'ARG1', Generator.ORDER_MULTIPLICATIVE) || Generator.quote_('');
            return `${receiver} ${method} ${operand}`;
        }

        // Arguments need no parentheses: `"ab".delete(a.reverse)`, not `"ab".delete((a.reverse))`.
        const arg1 = Generator.valueToCode(block, 'ARG1', Generator.ORDER_NONE) || Generator.quote_('');
        const arg2 = Generator.valueToCode(block, 'ARG2', Generator.ORDER_NONE);

        const args = [arg1];
        if (arg2) args.push(arg2);

        return `${receiver}.${method}(${args.join(', ')})`;
    };

    // --- Class method COMMAND blocks ---
    // Always generate as statement. Post-processing inlines _rv_ references.
    const generateMethodCall = function (block) {
        const expr = buildMethodCallExpr(block);
        return `${expr}\n`;
    };

    Generator.smalrubyRuby_stringMethod = generateMethodCall;
    Generator.smalrubyRuby_arrayMethod = generateMethodCall;
    Generator.smalrubyRuby_hashMethod = generateMethodCall;

    // --- Helper: resolve block parameter names from comment ---
    const resolveBlockParams = function (block, branch) {
        const comment = Generator.getCommentText(block);
        let paramStr = '';
        let resolvedBranch = branch;
        if (comment) {
            const paramMatches = comment.match(/@ruby:block_param:(\d+):(\S+)/g);
            if (paramMatches) {
                const params = paramMatches.map((m) => {
                    const [, idx, name] = m.match(/@ruby:block_param:(\d+):(\S+)/);
                    resolvedBranch = resolvedBranch.replace(new RegExp(`_bp_${idx}_`, 'g'), name);
                    return name;
                });
                paramStr = ` |${params.join(', ')}|`;
            }
        }
        return { paramStr, branch: resolvedBranch };
    };

    // The body is the SUBSTACK, so `end` closes it here. The next block is the statement after the
    // loop: `isStatement` (for hat blocks, whose next block is the body) would put it inside (#1628).
    const blockMethodCode = function (call, resolved) {
        return `${call} do${resolved.paramStr}\n${resolved.branch}end\n`;
    };

    // --- Array method with block (CONDITIONAL, C-shape) ---
    Generator.smalrubyRuby_arrayMethodWithBlock = function (block) {
        const receiver = Generator.valueToCode(block, 'RECEIVER', Generator.ORDER_RECEIVER) || Generator.quote_('');
        const method = Generator.getFieldValue(block, 'METHOD') || 'each';
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const resolved = resolveBlockParams(block, branch);

        return blockMethodCode(`${receiver}.${method}`, resolved);
    };

    // --- Hash method with block (CONDITIONAL, C-shape) ---
    Generator.smalrubyRuby_hashMethodWithBlock = function (block) {
        const receiver = Generator.valueToCode(block, 'RECEIVER', Generator.ORDER_RECEIVER) || Generator.quote_('');
        const method = Generator.getFieldValue(block, 'METHOD') || 'each';
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const resolved = resolveBlockParams(block, branch);

        return blockMethodCode(`${receiver}.${method}`, resolved);
    };

    // --- Number method with block (CONDITIONAL, C-shape) ---
    Generator.smalrubyRuby_numberMethodWithBlock = function (block) {
        const receiver = Generator.valueToCode(block, 'RECEIVER', Generator.ORDER_RECEIVER) || '0';
        const method = Generator.getFieldValue(block, 'METHOD') || 'times';
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const resolved = resolveBlockParams(block, branch);

        return blockMethodCode(`${receiver}.${method}`, resolved);
    };

    // --- Block parameter (REPORTER) ---
    Generator.smalrubyRuby_blockParam = function (block) {
        const param = Generator.getFieldValue(block, 'PARAM') || '_1';
        const idx = param.replace('_', '');
        return [`_bp_${idx}_`, Generator.ORDER_ATOMIC];
    };

    // --- Return value (REPORTER) ---
    Generator.smalrubyRuby_returnValue = function (block) {
        return ['_rv_', returnValueOrder(block)];
    };

    // --- Return value truthy? (BOOLEAN) ---
    Generator.smalrubyRuby_returnValueTruthy = function (block) {
        return ['_rv_truthy_', returnValueOrder(block)];
    };

    // --- Post-processing: inline _rv_ references ---
    // Override finishTargets to replace patterns like:
    //   receiver.method
    //   say(_rv_, 2)
    // with:
    //   say(receiver.method, 2)
    const originalFinishTargets = Generator.finishTargets.bind(Generator);
    Generator.finishTargets = function (code, options) {
        code = originalFinishTargets(code, options);
        // Replace: "  expr.method\n  ...(_rv_)..." → inline expr.method into _rv_
        // Pattern: a line ending with .method_call (optionally with args),
        // followed by a line that references _rv_ or _rv_truthy_
        const methodPattern =
            '\\S[^\\n]*(?:\\.(?:reverse|upcase|downcase|empty\\?|lines|delete|gsub|max|min|sort|join|first|last|keys|values|reverse!|delete!|gsub!|sort!)(?:\\((?:[^()\\n]|\\([^()\\n]*\\))*\\))?| \\* [^\\n]+)';
        // Process _rv_truthy_ BEFORE _rv_ to avoid partial match
        code = code.replace(
            new RegExp(`^([ \\t]*)(${methodPattern})\\n([ \\t]*)(.*?)_rv_truthy_`, 'gm'),
            (match, indent1, expr, indent2, before) => `${indent2}${before}${expr}`,
        );
        // The parentheses that the expression needs are already around `_rv_`: it told the outer
        // block the order of the expression (`returnValueOrder`).
        code = code.replace(
            new RegExp(`^([ \\t]*)(${methodPattern})\\n([ \\t]*)(.*?)_rv_`, 'gm'),
            (match, indent1, expr, indent2, before) => `${indent2}${before}${expr}`,
        );
        return code;
    };

    return Generator;
}
