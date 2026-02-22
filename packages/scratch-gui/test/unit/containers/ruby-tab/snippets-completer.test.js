import SnippetsCompleter from '../../../../src/containers/ruby-tab/snippets-completer';

// Minimal mock of the monaco instance used by SnippetsCompleter
const createMonacoMock = () => ({
    languages: {
        CompletionItemKind: {
            Method: 0,
            Function: 1,
            Variable: 3,
            Value: 12,
            Constant: 14,
            EnumMember: 16,
            Keyword: 17,
            Event: 23,
            Snippet: 27
        },
        CompletionItemInsertTextRule: {
            InsertAsSnippet: 4
        }
    }
});

// Helper to create a mock model.getWordUntilPosition return value
const createModel = wordText => ({
    getWordUntilPosition: () => ({
        word: wordText,
        startColumn: 1,
        endColumn: 1 + wordText.length
    })
});

const position = {lineNumber: 1, column: 1};
const context = {};
const token = {};

describe('SnippetsCompleter', () => {
    let completer;
    let monaco;

    beforeEach(() => {
        completer = new SnippetsCompleter();
        monaco = createMonacoMock();
    });

    describe('minimum word length for suggestions', () => {
        test('should return empty suggestions when word is 0 characters', () => {
            const model = createModel('');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            expect(result.suggestions).toHaveLength(0);
        });

        test('should return empty suggestions when word is 1 character', () => {
            const model = createModel('b');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            expect(result.suggestions).toHaveLength(0);
        });

        test('should return empty suggestions when word is 2 characters', () => {
            const model = createModel('mo');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            expect(result.suggestions).toHaveLength(0);
        });

        test('should return suggestions when word is 3 characters', () => {
            const model = createModel('mov');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });

        test('should return suggestions when word is longer than 3 characters', () => {
            const model = createModel('move');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });
    });
});
