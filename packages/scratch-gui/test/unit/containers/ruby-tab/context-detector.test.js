import {
    detectContext,
    CONTEXT_TOP_LEVEL,
    CONTEXT_INSIDE_BLOCK,
    CONTEXT_EXPRESSION_EXPECTED,
    CONTEXT_ALLOWED_TYPES
} from '../../../../src/containers/ruby-tab/context-detector';

// Helper to create a mock model with getValueInRange.
// fullText: the entire document text.
// cursorLine/cursorCol: cursor position within fullText (1-based).
const createModel = (fullText, cursorLine, cursorCol) => ({
    getValueInRange: ({startLineNumber, startColumn, endLineNumber, endColumn}) => {
        if (!fullText) return '';
        const lines = fullText.split('\n');
        if (startLineNumber === endLineNumber) {
            const line = lines[startLineNumber - 1] || '';
            return line.substring(startColumn - 1, endColumn - 1);
        }
        const result = [];
        for (let i = startLineNumber; i <= endLineNumber; i++) {
            let line = lines[i - 1] || '';
            if (i === startLineNumber) {
                line = line.substring(startColumn - 1);
            } else if (i === endLineNumber) {
                line = line.substring(0, endColumn - 1);
            }
            result.push(line);
        }
        return result.join('\n');
    }
});

describe('detectContext', () => {
    test('should detect top_level in an empty document', () => {
        const model = createModel('whe', 1, 4);
        const pos = {lineNumber: 1, column: 4};
        expect(detectContext(model, pos)).toBe(CONTEXT_TOP_LEVEL);
    });

    test('should detect inside_block inside when_flag_clicked do...end', () => {
        const model = createModel('when_flag_clicked do\n  mov', 2, 6);
        const pos = {lineNumber: 2, column: 6};
        expect(detectContext(model, pos)).toBe(CONTEXT_INSIDE_BLOCK);
    });

    test('should detect inside_block inside def...end', () => {
        const model = createModel('def self.my_method(n)\n  mov', 2, 6);
        const pos = {lineNumber: 2, column: 6};
        expect(detectContext(model, pos)).toBe(CONTEXT_INSIDE_BLOCK);
    });

    test('should return to top_level after end closes a block', () => {
        const model = createModel('when_flag_clicked do\n  move(10)\nend\nwhe', 4, 4);
        const pos = {lineNumber: 4, column: 4};
        expect(detectContext(model, pos)).toBe(CONTEXT_TOP_LEVEL);
    });

    test('should detect inside_block in nested blocks (if inside event)', () => {
        const model = createModel('when_flag_clicked do\n  if true\n    mov', 3, 8);
        const pos = {lineNumber: 3, column: 8};
        expect(detectContext(model, pos)).toBe(CONTEXT_INSIDE_BLOCK);
    });

    test('should stay inside_block after nested end (loop closed, event still open)', () => {
        const model = createModel('when_flag_clicked do\n  loop do\n    move(10)\n  end\n  mov', 5, 6);
        const pos = {lineNumber: 5, column: 6};
        expect(detectContext(model, pos)).toBe(CONTEXT_INSIDE_BLOCK);
    });

    test('should ignore do/end in comment lines', () => {
        const model = createModel('# do\nwhe', 2, 4);
        const pos = {lineNumber: 2, column: 4};
        expect(detectContext(model, pos)).toBe(CONTEXT_TOP_LEVEL);
    });

    test('should detect expression_expected after if keyword', () => {
        const model = createModel('when_flag_clicked do\n  if tou', 2, 9);
        const pos = {lineNumber: 2, column: 9};
        expect(detectContext(model, pos)).toBe(CONTEXT_EXPRESSION_EXPECTED);
    });

    test('should detect expression_expected after until keyword', () => {
        const model = createModel('when_flag_clicked do\n  until tou', 2, 12);
        const pos = {lineNumber: 2, column: 12};
        expect(detectContext(model, pos)).toBe(CONTEXT_EXPRESSION_EXPECTED);
    });

    test('should detect expression_expected after elsif keyword', () => {
        const model = createModel('when_flag_clicked do\n  if false\n    move(10)\n  elsif tou', 4, 12);
        const pos = {lineNumber: 4, column: 12};
        expect(detectContext(model, pos)).toBe(CONTEXT_EXPRESSION_EXPECTED);
    });

    test('should detect expression_expected after unless keyword', () => {
        const model = createModel('when_flag_clicked do\n  unless tou', 2, 13);
        const pos = {lineNumber: 2, column: 13};
        expect(detectContext(model, pos)).toBe(CONTEXT_EXPRESSION_EXPECTED);
    });

    test('should detect expression_expected after while keyword', () => {
        const model = createModel('when_flag_clicked do\n  while tou', 2, 12);
        const pos = {lineNumber: 2, column: 12};
        expect(detectContext(model, pos)).toBe(CONTEXT_EXPRESSION_EXPECTED);
    });
});

describe('CONTEXT_ALLOWED_TYPES', () => {
    test('should allow only event and enum_member at top level', () => {
        const allowed = CONTEXT_ALLOWED_TYPES[CONTEXT_TOP_LEVEL];
        expect(allowed.has('event')).toBe(true);
        expect(allowed.has('enum_member')).toBe(true);
        expect(allowed.has('function')).toBe(false);
        expect(allowed.has('method')).toBe(false);
        expect(allowed.has('snippet')).toBe(false);
    });

    test('should allow statements and expressions inside block', () => {
        const allowed = CONTEXT_ALLOWED_TYPES[CONTEXT_INSIDE_BLOCK];
        expect(allowed.has('function')).toBe(true);
        expect(allowed.has('method')).toBe(true);
        expect(allowed.has('snippet')).toBe(true);
        expect(allowed.has('variable')).toBe(true);
        expect(allowed.has('value')).toBe(true);
        expect(allowed.has('constant')).toBe(true);
        expect(allowed.has('enum_member')).toBe(true);
        expect(allowed.has('event')).toBe(false);
    });

    test('should allow only expression types in expression_expected context', () => {
        const allowed = CONTEXT_ALLOWED_TYPES[CONTEXT_EXPRESSION_EXPECTED];
        expect(allowed.has('variable')).toBe(true);
        expect(allowed.has('value')).toBe(true);
        expect(allowed.has('constant')).toBe(true);
        expect(allowed.has('method')).toBe(true);
        expect(allowed.has('enum_member')).toBe(true);
        expect(allowed.has('function')).toBe(false);
        expect(allowed.has('snippet')).toBe(false);
        expect(allowed.has('event')).toBe(false);
    });
});
