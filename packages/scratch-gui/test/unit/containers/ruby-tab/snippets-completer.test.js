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

// Helper to create a mock model with getWordUntilPosition and getValueInRange.
// fullText: the entire document text (defaults to empty = top-level context).
// cursorLine/cursorCol: cursor position within fullText (1-based).
const createModel = (wordText, fullText = '', cursorLine = 1, cursorCol = 1 + wordText.length) => ({
    getWordUntilPosition: () => ({
        word: wordText,
        startColumn: cursorCol - wordText.length,
        endColumn: cursorCol
    }),
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

// Helper to create a mock VM with extensionManager
const createVmMock = (loadedExtensions = []) => ({
    extensionManager: {
        isExtensionLoaded: jest.fn(id => loadedExtensions.includes(id))
    }
});

const position = {lineNumber: 1, column: 1};
const context = {};
const token = {};

// Common text placing cursor inside a block (line 2, after indentation)
const INSIDE_BLOCK_TEXT = 'when_flag_clicked do\n  ';
const INSIDE_BLOCK_LINE = 2;
const INSIDE_BLOCK_COL_BASE = 3; // after "  " (2 spaces + 1 for 1-based)

describe('SnippetsCompleter', () => {
    let completer;
    let monaco;

    beforeEach(() => {
        completer = new SnippetsCompleter();
        monaco = createMonacoMock();
    });

    describe('minimum word length for suggestions', () => {
        test('should return empty suggestions when word is 0 characters', () => {
            const model = createModel('', INSIDE_BLOCK_TEXT, INSIDE_BLOCK_LINE, INSIDE_BLOCK_COL_BASE);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: INSIDE_BLOCK_COL_BASE};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            expect(result.suggestions).toHaveLength(0);
        });

        test('should return empty suggestions when word is 1 character', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}b`;
            const col = INSIDE_BLOCK_COL_BASE + 1;
            const model = createModel('b', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            expect(result.suggestions).toHaveLength(0);
        });

        test('should return empty suggestions when word is 2 characters', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}mo`;
            const col = INSIDE_BLOCK_COL_BASE + 2;
            const model = createModel('mo', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            expect(result.suggestions).toHaveLength(0);
        });

        test('should return suggestions when word is 3 characters', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}mov`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('mov', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });

        test('should return suggestions when word is longer than 3 characters', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}move`;
            const col = INSIDE_BLOCK_COL_BASE + 4;
            const model = createModel('move', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });
    });

    describe('Japanese minimum word length', () => {
        test('should return suggestions for a single Japanese character', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}動`;
            const col = INSIDE_BLOCK_COL_BASE + 1;
            const model = createModel('動', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });

        test('should return suggestions for two Japanese characters', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}もし`;
            const col = INSIDE_BLOCK_COL_BASE + 2;
            const model = createModel('もし', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });
    });

    describe('structured label', () => {
        test('should use structured label with labelJa, detail, and description', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}mov`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('mov', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
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
            const fullText = `${INSIDE_BLOCK_TEXT}mov`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('mov', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
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
            const fullText = `${INSIDE_BLOCK_TEXT}mov`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('mov', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            const moveSuggestion = result.suggestions.find(s =>
                s.filterText && s.filterText.includes('move')
            );
            expect(moveSuggestion).toBeDefined();
            expect(moveSuggestion.sortText).toMatch(/^01_/);
        });

        test('should include sortText with category prefix for looks snippets', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}sho`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('sho', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            const showSuggestion = result.suggestions.find(s =>
                s.sortText && s.sortText.startsWith('02_')
            );
            expect(showSuggestion).toBeDefined();
        });

        test('should auto-generate sortText for snippets without explicit sortText', () => {
            const fullText = `${INSIDE_BLOCK_TEXT}mov`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('mov', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = completer.provideCompletionItems(model, pos, context, token, monaco);
            // All suggestions should have sortText (either from JSON or auto-generated)
            result.suggestions.forEach(s => {
                expect(s.sortText).toBeDefined();
            });
        });
    });

    describe('extension filtering', () => {
        test('should exclude extension snippets when no extensions are loaded', () => {
            const vm = createVmMock([]);
            const extCompleter = new SnippetsCompleter(vm);
            const fullText = `${INSIDE_BLOCK_TEXT}pla`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('pla', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = extCompleter.provideCompletionItems(model, pos, context, token, monaco);
            // Music snippet "play_drum" should not appear
            const musicSuggestion = result.suggestions.find(s =>
                s.sortText && s.sortText.startsWith('10_')
            );
            expect(musicSuggestion).toBeUndefined();
        });

        test('should include extension snippets when the extension is loaded', () => {
            const vm = createVmMock(['music']);
            const extCompleter = new SnippetsCompleter(vm);
            const fullText = `${INSIDE_BLOCK_TEXT}pla`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('pla', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = extCompleter.provideCompletionItems(model, pos, context, token, monaco);
            // Music snippet should appear
            const musicSuggestion = result.suggestions.find(s =>
                s.sortText && s.sortText.startsWith('10_')
            );
            expect(musicSuggestion).toBeDefined();
        });

        test('should always include core snippets regardless of loaded extensions', () => {
            const vm = createVmMock([]);
            const extCompleter = new SnippetsCompleter(vm);
            const fullText = `${INSIDE_BLOCK_TEXT}mov`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('mov', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = extCompleter.provideCompletionItems(model, pos, context, token, monaco);
            // Core motion snippet should still appear
            const moveSuggestion = result.suggestions.find(s =>
                s.filterText && s.filterText.includes('move')
            );
            expect(moveSuggestion).toBeDefined();
        });

        test('should show all snippets when vm is not provided (backward compatibility)', () => {
            const noVmCompleter = new SnippetsCompleter();
            const fullText = `${INSIDE_BLOCK_TEXT}pla`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('pla', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
            const result = noVmCompleter.provideCompletionItems(model, pos, context, token, monaco);
            // Extension snippets should still appear without VM
            const musicSuggestion = result.suggestions.find(s =>
                s.sortText && s.sortText.startsWith('10_')
            );
            expect(musicSuggestion).toBeDefined();
        });

        test('should dynamically reflect extension loading changes', () => {
            const loadedExtensions = [];
            const vm = {
                extensionManager: {
                    isExtensionLoaded: jest.fn(id => loadedExtensions.includes(id))
                }
            };
            const extCompleter = new SnippetsCompleter(vm);
            const fullText = `${INSIDE_BLOCK_TEXT}pla`;
            const col = INSIDE_BLOCK_COL_BASE + 3;
            const model = createModel('pla', fullText, INSIDE_BLOCK_LINE, col);
            const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};

            // Initially no music extension
            let result = extCompleter.provideCompletionItems(model, pos, context, token, monaco);
            let musicSuggestion = result.suggestions.find(s =>
                s.sortText && s.sortText.startsWith('10_')
            );
            expect(musicSuggestion).toBeUndefined();

            // Load music extension
            loadedExtensions.push('music');
            result = extCompleter.provideCompletionItems(model, pos, context, token, monaco);
            musicSuggestion = result.suggestions.find(s =>
                s.sortText && s.sortText.startsWith('10_')
            );
            expect(musicSuggestion).toBeDefined();
        });
    });

    describe('context-aware completion', () => {
        describe('context detection', () => {
            test('should detect top_level in an empty document', () => {
                const fullText = 'whe';
                const model = createModel('whe', fullText, 1, 4);
                const pos = {lineNumber: 1, column: 4};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                // At top level, event snippets should appear
                const eventSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('04_')
                );
                expect(eventSuggestion).toBeDefined();
                // function snippets (e.g., move from motion) should NOT appear at top level
                const functionSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('ugokasu')
                );
                expect(functionSuggestion).toBeUndefined();
            });

            test('should detect inside_block inside when_flag_clicked do...end', () => {
                const fullText = 'when_flag_clicked do\n  mov';
                const model = createModel('mov', fullText, 2, 6);
                const pos = {lineNumber: 2, column: 6};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                // Inside block, function snippets should appear
                const moveSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('ugokasu')
                );
                expect(moveSuggestion).toBeDefined();
                // event snippets should NOT appear inside block
                const eventSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('04_hataga')
                );
                expect(eventSuggestion).toBeUndefined();
            });

            test('should detect inside_block inside def...end', () => {
                const fullText = 'def self.my_method(n)\n  mov';
                const model = createModel('mov', fullText, 2, 6);
                const pos = {lineNumber: 2, column: 6};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const moveSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('move')
                );
                expect(moveSuggestion).toBeDefined();
            });

            test('should return to top_level after end closes a block', () => {
                const fullText = 'when_flag_clicked do\n  move(10)\nend\nwhe';
                const model = createModel('whe', fullText, 4, 4);
                const pos = {lineNumber: 4, column: 4};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                // Back at top level: events should appear
                const eventSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('04_')
                );
                expect(eventSuggestion).toBeDefined();
                // function snippets (e.g., move from motion) should NOT appear
                const functionSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('ugokasu')
                );
                expect(functionSuggestion).toBeUndefined();
            });

            test('should detect inside_block in nested blocks (if inside event)', () => {
                const fullText = 'when_flag_clicked do\n  if true\n    mov';
                const model = createModel('mov', fullText, 3, 8);
                const pos = {lineNumber: 3, column: 8};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const moveSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('move')
                );
                expect(moveSuggestion).toBeDefined();
            });

            test('should stay inside_block after nested end (if closed, event still open)', () => {
                const fullText = 'when_flag_clicked do\n  if true\n    move(10)\n  end\n  mov';
                const model = createModel('mov', fullText, 5, 6);
                const pos = {lineNumber: 5, column: 6};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const moveSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('move')
                );
                expect(moveSuggestion).toBeDefined();
            });

            test('should ignore do/end in comment lines', () => {
                const fullText = '# do\nwhe';
                const model = createModel('whe', fullText, 2, 4);
                const pos = {lineNumber: 2, column: 4};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                // Comment do should not affect nesting, so we are at top level
                const eventSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('04_')
                );
                expect(eventSuggestion).toBeDefined();
            });

            test('should detect expression_expected after if keyword', () => {
                const fullText = 'when_flag_clicked do\n  if tou';
                const model = createModel('tou', fullText, 2, 9);
                const pos = {lineNumber: 2, column: 9};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                // method type (e.g., touching?) should appear in expression context
                const touchingSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('touching')
                );
                expect(touchingSuggestion).toBeDefined();
                // function type (e.g., move) should NOT appear in expression context
                const moveSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('ugokasu')
                );
                expect(moveSuggestion).toBeUndefined();
            });

            test('should detect expression_expected after until keyword', () => {
                const fullText = 'when_flag_clicked do\n  until tou';
                const model = createModel('tou', fullText, 2, 12);
                const pos = {lineNumber: 2, column: 12};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const touchingSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('touching')
                );
                expect(touchingSuggestion).toBeDefined();
            });

            test('should detect expression_expected after elsif keyword', () => {
                const fullText = 'when_flag_clicked do\n  if false\n    move(10)\n  elsif tou';
                const model = createModel('tou', fullText, 4, 12);
                const pos = {lineNumber: 4, column: 12};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const touchingSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('touching')
                );
                expect(touchingSuggestion).toBeDefined();
            });

            test('should detect expression_expected after unless keyword', () => {
                const fullText = 'when_flag_clicked do\n  unless tou';
                const model = createModel('tou', fullText, 2, 13);
                const pos = {lineNumber: 2, column: 13};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const touchingSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('touching')
                );
                expect(touchingSuggestion).toBeDefined();
            });

            test('should detect expression_expected after while keyword', () => {
                const fullText = 'when_flag_clicked do\n  while tou';
                const model = createModel('tou', fullText, 2, 12);
                const pos = {lineNumber: 2, column: 12};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const touchingSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('touching')
                );
                expect(touchingSuggestion).toBeDefined();
            });
        });

        describe('type filtering', () => {
            test('should allow def snippet at top level', () => {
                const fullText = 'def';
                const model = createModel('def', fullText, 1, 4);
                const pos = {lineNumber: 1, column: 4};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const defSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('09_')
                );
                expect(defSuggestion).toBeDefined();
            });

            test('should not allow def snippet inside block', () => {
                const fullText = 'when_flag_clicked do\n  def';
                const model = createModel('def', fullText, 2, 6);
                const pos = {lineNumber: 2, column: 6};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const defSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('09_')
                );
                expect(defSuggestion).toBeUndefined();
            });

            test('should allow control structure snippets (if, loop) inside block', () => {
                const fullText = 'when_flag_clicked do\n  loo';
                const model = createModel('loo', fullText, 2, 6);
                const pos = {lineNumber: 2, column: 6};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const loopSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('loop')
                );
                expect(loopSuggestion).toBeDefined();
            });

            test('should not allow control structure snippets at top level', () => {
                const fullText = 'loo';
                const model = createModel('loo', fullText, 1, 4);
                const pos = {lineNumber: 1, column: 4};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const loopSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('zutto') && s.filterText.includes('loop')
                );
                expect(loopSuggestion).toBeUndefined();
            });

            test('should always allow enum_member at top level', () => {
                const fullText = 'ran';
                const model = createModel('ran', fullText, 1, 4);
                const pos = {lineNumber: 1, column: 4};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const enumSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('01z_')
                );
                expect(enumSuggestion).toBeDefined();
            });

            test('should always allow enum_member inside block', () => {
                const fullText = 'when_flag_clicked do\n  ran';
                const model = createModel('ran', fullText, 2, 6);
                const pos = {lineNumber: 2, column: 6};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const enumSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('01z_')
                );
                expect(enumSuggestion).toBeDefined();
            });

            test('should not allow snippet types in expression_expected context', () => {
                const fullText = 'when_flag_clicked do\n  if loo';
                const model = createModel('loo', fullText, 2, 9);
                const pos = {lineNumber: 2, column: 9};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                // loop (snippet type) should not appear after "if "
                const loopSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('zutto') && s.filterText.includes('loop')
                );
                expect(loopSuggestion).toBeUndefined();
            });

            test('should allow variable type in expression_expected context', () => {
                const fullText = 'when_flag_clicked do\n  if ran';
                const model = createModel('ran', fullText, 2, 9);
                const pos = {lineNumber: 2, column: 9};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                // rand (variable type) should appear after "if "
                const randSuggestion = result.suggestions.find(s =>
                    s.filterText && s.filterText.includes('ransuu') && s.filterText.includes('rand')
                );
                expect(randSuggestion).toBeDefined();
            });

            test('should allow constant type in expression_expected context', () => {
                const fullText = 'when_flag_clicked do\n  if gen';
                const model = createModel('gen', fullText, 2, 9);
                const pos = {lineNumber: 2, column: 9};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                // Time.now.year (constant type) should appear
                const constantSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('06_genzaino')
                );
                expect(constantSuggestion).toBeDefined();
            });
        });

        describe('integration with extension filtering', () => {
            test('should apply both context and extension filtering', () => {
                const vm = createVmMock([]);
                const extCompleter = new SnippetsCompleter(vm);
                const fullText = `${INSIDE_BLOCK_TEXT}pla`;
                const col = INSIDE_BLOCK_COL_BASE + 3;
                const model = createModel('pla', fullText, INSIDE_BLOCK_LINE, col);
                const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
                const result = extCompleter.provideCompletionItems(model, pos, context, token, monaco);
                // Music extension not loaded, so music snippets should not appear
                const musicSuggestion = result.suggestions.find(s =>
                    s.sortText && s.sortText.startsWith('10_')
                );
                expect(musicSuggestion).toBeUndefined();
            });
        });
    });
});
