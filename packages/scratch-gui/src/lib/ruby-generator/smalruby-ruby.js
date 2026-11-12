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

    /**
     * Whether the expression is a `*` at the top: `a * 3`, but not `(a * 3).reverse` or
     * `@a.join(" * ")`, whose `*` is inside parentheses or a string.
     * @param {string} expr - A Ruby expression.
     * @returns {boolean} True when a ` * ` is outside every bracket and string.
     */
    const isTopLevelMultiply = function (expr) {
        let depth = 0;
        let quote = null;
        for (let i = 0; i < expr.length; i++) {
            const c = expr[i];
            if (quote) {
                if (c === '\\') i++;
                else if (c === quote) quote = null;
            } else if (c === '"' || c === "'") {
                quote = c;
            } else if ('([{'.includes(c)) {
                depth++;
            } else if (')]}'.includes(c)) {
                depth--;
            } else if (depth === 0 && expr.startsWith(' * ', i)) {
                return true;
            }
        }
        return false;
    };

    // --- Method call expression builder ---
    const buildMethodCallExpr = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
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

        const arg1 = Generator.valueToCode(block, 'ARG1', order) || Generator.quote_('');
        const arg2 = Generator.valueToCode(block, 'ARG2', order);

        // Operator methods: generate infix notation (e.g. receiver * arg)
        if (method === '*') {
            return `${receiver} ${method} ${arg1}`;
        }

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
    Generator.smalrubyRuby_returnValue = function (_block) {
        return ['_rv_', Generator.ORDER_FUNCTION_CALL];
    };

    // --- Return value truthy? (BOOLEAN) ---
    Generator.smalrubyRuby_returnValueTruthy = function (_block) {
        return ['_rv_truthy_', Generator.ORDER_FUNCTION_CALL];
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
            '\\S[^\\n]*(?:\\.(?:reverse|upcase|downcase|empty\\?|lines|delete|gsub|max|min|sort|join|first|last|keys|values|reverse!|delete!|gsub!|sort!)(?:\\([^)]*\\))?| \\* \\S+)';
        // Process _rv_truthy_ BEFORE _rv_ to avoid partial match
        code = code.replace(
            new RegExp(`^([ \\t]*)(${methodPattern})\\n([ \\t]*)(.*?)_rv_truthy_`, 'gm'),
            (match, indent1, expr, indent2, before) => `${indent2}${before}${expr}`,
        );
        // `_rv_` is the receiver of a call without parentheses (issue #1675): `a * 3` there
        // needs them back, `(a * 3).length`, while `a.reverse.length` does not.
        code = code.replace(
            new RegExp(`^([ \\t]*)(${methodPattern})\\n([ \\t]*)(.*?)_rv_(?=([.[]?))`, 'gm'),
            (match, indent1, expr, indent2, before, after) => {
                const inlined = after && isTopLevelMultiply(expr) ? `(${expr})` : expr;
                return `${indent2}${before}${inlined}`;
            },
        );
        return code;
    };

    return Generator;
}
