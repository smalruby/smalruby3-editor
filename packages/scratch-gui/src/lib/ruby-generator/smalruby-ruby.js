// === Smalruby: This file is Smalruby-specific (Ruby extension generator) ===

/**
 * Define Ruby code generator for Smalruby Ruby Extension Blocks
 * @param {object} Generator - The RubyGenerator
 * @returns {object} same as param.
 */
export default function (Generator) {
    // --- Method call expression builder ---
    const buildMethodCallExpr = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const method = Generator.getFieldValue(block, 'METHOD') || 'reverse';
        const isBang = method.endsWith('!');

        let receiver;
        if (isBang) {
            const varName =
                Generator.getFieldValue(block, 'RECEIVER') || '';
            receiver = Generator.variableNameByName(varName) || 'nil';
        } else {
            receiver =
                Generator.valueToCode(block, 'RECEIVER', order) ||
                Generator.quote_('');
        }

        const hasArg1 = block.inputs && block.inputs.ARG1;
        if (!hasArg1) {
            return `${receiver}.${method}`;
        }

        const arg1 =
            Generator.valueToCode(block, 'ARG1', order) ||
            Generator.quote_('');
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
            const paramMatches = comment.match(
                /@ruby:block_param:(\d+):(\S+)/g,
            );
            if (paramMatches) {
                const params = paramMatches.map(m => {
                    const [, idx, name] = m.match(
                        /@ruby:block_param:(\d+):(\S+)/,
                    );
                    resolvedBranch = resolvedBranch.replace(
                        new RegExp(`_bp_${idx}_`, 'g'),
                        name,
                    );
                    return name;
                });
                paramStr = ` |${params.join(', ')}|`;
            }
        }
        return { paramStr, branch: resolvedBranch };
    };

    // --- Array method with block (CONDITIONAL, C-shape) ---
    Generator.smalrubyRuby_arrayMethodWithBlock = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const receiver =
            Generator.valueToCode(block, 'RECEIVER', order) ||
            Generator.quote_('');
        const method = Generator.getFieldValue(block, 'METHOD') || 'each';
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const resolved = resolveBlockParams(block, branch);

        block.isStatement = true;
        return `${receiver}.${method} do${resolved.paramStr}\n${resolved.branch}`;
    };

    // --- Hash method with block (CONDITIONAL, C-shape) ---
    Generator.smalrubyRuby_hashMethodWithBlock = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const receiver =
            Generator.valueToCode(block, 'RECEIVER', order) ||
            Generator.quote_('');
        const method = Generator.getFieldValue(block, 'METHOD') || 'each';
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const resolved = resolveBlockParams(block, branch);

        block.isStatement = true;
        return `${receiver}.${method} do${resolved.paramStr}\n${resolved.branch}`;
    };

    // --- Number method with block (CONDITIONAL, C-shape) ---
    Generator.smalrubyRuby_numberMethodWithBlock = function (block) {
        const receiver =
            Generator.valueToCode(block, 'RECEIVER', Generator.ORDER_ATOMIC) ||
            '0';
        const method = Generator.getFieldValue(block, 'METHOD') || 'times';
        const branch = Generator.statementToCode(block, 'SUBSTACK') || '';
        const resolved = resolveBlockParams(block, branch);

        block.isStatement = true;
        return `${receiver}.${method} do${resolved.paramStr}\n${resolved.branch}`;
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
            new RegExp(
                `^([ \\t]*)(${methodPattern})\\n([ \\t]*)(.*?)_rv_truthy_`,
                'gm',
            ),
            (match, indent1, expr, indent2, before) =>
                `${indent2}${before}${expr}`,
        );
        code = code.replace(
            new RegExp(
                `^([ \\t]*)(${methodPattern})\\n([ \\t]*)(.*?)_rv_`,
                'gm',
            ),
            (match, indent1, expr, indent2, before) =>
                `${indent2}${before}${expr}`,
        );
        return code;
    };

    return Generator;
}
