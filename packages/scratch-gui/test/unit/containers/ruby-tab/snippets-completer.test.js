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

    describe('legacy notation snippets (self.when / print / puts / p)', () => {
        describe('self.when(:xxx) event snippets at top level', () => {
            const topLevelWord = 'when';
            const topLevelModel = () => createModel(topLevelWord, topLevelWord, 1, 1 + topLevelWord.length);
            const topLevelPos = {lineNumber: 1, column: 1 + topLevelWord.length};

            test('should include when(:flag_clicked) compat snippet at top level', () => {
                const result = completer.provideCompletionItems(topLevelModel(), topLevelPos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.includes('when(:flag_clicked)')
                );
                expect(snippet).toBeDefined();
            });

            test('should include when(:clicked) compat snippet at top level', () => {
                const result = completer.provideCompletionItems(topLevelModel(), topLevelPos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.includes('when(:clicked)')
                );
                expect(snippet).toBeDefined();
            });

            test('should include when(:key_pressed) compat snippet at top level', () => {
                const result = completer.provideCompletionItems(topLevelModel(), topLevelPos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.includes('when(:key_pressed,')
                );
                expect(snippet).toBeDefined();
            });

            test('should include when(:backdrop_switches) compat snippet at top level', () => {
                const result = completer.provideCompletionItems(topLevelModel(), topLevelPos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.includes('when(:backdrop_switches,')
                );
                expect(snippet).toBeDefined();
            });

            test('should include when(:receive) compat snippet at top level', () => {
                const result = completer.provideCompletionItems(topLevelModel(), topLevelPos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.includes('when(:receive,')
                );
                expect(snippet).toBeDefined();
            });

            test('should include when(:greater_than) compat snippet at top level', () => {
                const result = completer.provideCompletionItems(topLevelModel(), topLevelPos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.includes('when(:greater_than,')
                );
                expect(snippet).toBeDefined();
            });

            test('should include when(:start_as_a_clone) compat snippet at top level', () => {
                const result = completer.provideCompletionItems(topLevelModel(), topLevelPos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.includes('when(:start_as_a_clone)')
                );
                expect(snippet).toBeDefined();
            });

            test('should not show compat event snippets inside a block', () => {
                const fullText = `${INSIDE_BLOCK_TEXT}when`;
                const col = INSIDE_BLOCK_COL_BASE + 4;
                const model = createModel('when', fullText, INSIDE_BLOCK_LINE, col);
                const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.includes('when(:flag_clicked)')
                );
                expect(snippet).toBeUndefined();
            });

            test('compat when snippets filterText should not contain "self" to prevent matching when typing "sel"', () => {
                // When user types "sel", Monaco word is "sel".
                // If filterText contains "self.when", Monaco fuzzy-matches "sel" and shows these snippets.
                // When selected, it replaces "sel" with "when(:xxx)..." — missing the "self." prefix.
                // Fix: remove "self.when" from filterText so "sel" does not trigger compat snippets.
                const result = completer.provideCompletionItems(topLevelModel(), topLevelPos, context, token, monaco);
                const compatSnippets = result.suggestions.filter(s =>
                    s.insertText && s.insertText.includes('when(:')
                );
                expect(compatSnippets.length).toBeGreaterThan(0);
                compatSnippets.forEach(snippet => {
                    expect(snippet.filterText).not.toContain('self');
                });
            });
        });

        describe('print/puts/p output snippets inside block', () => {
            test('should include print snippet when typing "pri" inside a block', () => {
                const fullText = `${INSIDE_BLOCK_TEXT}pri`;
                const col = INSIDE_BLOCK_COL_BASE + 3;
                const model = createModel('pri', fullText, INSIDE_BLOCK_LINE, col);
                const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.startsWith('print(')
                );
                expect(snippet).toBeDefined();
            });

            test('should include puts snippet when typing "put" inside a block', () => {
                const fullText = `${INSIDE_BLOCK_TEXT}put`;
                const col = INSIDE_BLOCK_COL_BASE + 3;
                const model = createModel('put', fullText, INSIDE_BLOCK_LINE, col);
                const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.startsWith('puts(')
                );
                expect(snippet).toBeDefined();
            });

            test('should include p snippet when typing "p_o" inside a block', () => {
                const fullText = `${INSIDE_BLOCK_TEXT}p_o`;
                const col = INSIDE_BLOCK_COL_BASE + 3;
                const model = createModel('p_o', fullText, INSIDE_BLOCK_LINE, col);
                const pos = {lineNumber: INSIDE_BLOCK_LINE, column: col};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.startsWith('p(')
                );
                expect(snippet).toBeDefined();
            });

            test('should not show print snippet at top level', () => {
                const fullText = 'pri';
                const model = createModel('pri', fullText, 1, 4);
                const pos = {lineNumber: 1, column: 4};
                const result = completer.provideCompletionItems(model, pos, context, token, monaco);
                const snippet = result.suggestions.find(s =>
                    s.insertText && s.insertText.startsWith('print(')
                );
                expect(snippet).toBeUndefined();
            });
        });
    });

    describe('context-aware completion', () => {
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
