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

    describe('Japanese minimum word length', () => {
        test('should return suggestions for a single Japanese character', () => {
            const model = createModel('動');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });

        test('should return suggestions for two Japanese characters', () => {
            const model = createModel('もし');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });
    });

    describe('structured label', () => {
        test('should use structured label with labelJa, detail, and description', () => {
            const model = createModel('mov');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            const moveSuggestion = result.suggestions.find(s =>
                typeof s.label === 'object' && s.label.label === '動かす'
            );
            expect(moveSuggestion).toBeDefined();
            expect(moveSuggestion.label.detail).toContain('move(10)');
            expect(moveSuggestion.label.description).toBe('(10) 歩動かす');
        });
    });

    describe('filterText', () => {
        test('should include filterText with romaji, Japanese, and caption', () => {
            const model = createModel('mov');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            const moveSuggestion = result.suggestions.find(s =>
                s.filterText && s.filterText.includes('ugokasu')
            );
            expect(moveSuggestion).toBeDefined();
            expect(moveSuggestion.filterText).toContain('move');
            expect(moveSuggestion.filterText).toContain('動かす');
        });
    });

    describe('sortText', () => {
        test('should include sortText with category prefix for motion snippets', () => {
            const model = createModel('mov');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            const moveSuggestion = result.suggestions.find(s =>
                s.filterText && s.filterText.includes('move')
            );
            expect(moveSuggestion).toBeDefined();
            expect(moveSuggestion.sortText).toMatch(/^01_/);
        });

        test('should include sortText with category prefix for looks snippets', () => {
            const model = createModel('sho');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            const showSuggestion = result.suggestions.find(s =>
                s.sortText && s.sortText.startsWith('02_')
            );
            expect(showSuggestion).toBeDefined();
        });

        test('should auto-generate sortText for snippets without explicit sortText', () => {
            const model = createModel('mov');
            const result = completer.provideCompletionItems(model, position, context, token, monaco);
            // All suggestions should have sortText (either from JSON or auto-generated)
            result.suggestions.forEach(s => {
                expect(s.sortText).toBeDefined();
            });
        });
    });
});
