// Regex to detect expression-expected keywords at end of line before cursor
const EXPRESSION_KEYWORD_PATTERN = /\b(if|unless|until|while|elsif)\s+$/;

// Context types for completion filtering
export const CONTEXT_TOP_LEVEL = 'top_level';
export const CONTEXT_INSIDE_BLOCK = 'inside_block';
export const CONTEXT_EXPRESSION_EXPECTED = 'expression_expected';

// Allowed snippet types per context
export const CONTEXT_ALLOWED_TYPES = {
    [CONTEXT_TOP_LEVEL]: new Set(['event', 'enum_member']),
    [CONTEXT_INSIDE_BLOCK]: new Set(['function', 'method', 'snippet', 'variable', 'value', 'constant', 'enum_member']),
    [CONTEXT_EXPRESSION_EXPECTED]: new Set(['variable', 'value', 'constant', 'method', 'enum_member'])
};

/**
 * Detect the code context at the cursor position.
 * @param {object} model - Monaco text model.
 * @param {object} position - Current cursor position.
 * @returns {string} One of 'top_level', 'inside_block', or 'expression_expected'.
 */
export const detectContext = (model, position) => {
    const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
    });

    // Count nesting level by tracking do/def vs end keywords
    let nestingLevel = 0;
    const lines = textBeforeCursor.split('\n');
    for (const line of lines) {
        // Strip comments
        const codePart = line.replace(/#.*$/, '');
        const opens = (codePart.match(/\bdo\b/g) || []).length +
                      (codePart.match(/\bdef\s/g) || []).length;
        const closes = (codePart.match(/\bend\b/g) || []).length;
        nestingLevel += opens - closes;
    }

    if (nestingLevel <= 0) {
        return CONTEXT_TOP_LEVEL;
    }

    // Check current line for expression-expected patterns
    const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
    });

    // Remove the current word being typed to check the preceding context
    const wordBeforeCursor = textUntilPosition.replace(/\S+$/, '');
    if (EXPRESSION_KEYWORD_PATTERN.test(wordBeforeCursor)) {
        return CONTEXT_EXPRESSION_EXPECTED;
    }

    return CONTEXT_INSIDE_BLOCK;
};
