# Smalruby Completion System Analysis

## Overview
The Smalruby completion system is a Monaco Editor-based snippet completion provider for the Ruby mode in the Smalruby 3 Editor. It provides context-aware code completion for Ruby blocks, methods, and language features with heavy Japanese language support.

## 1. Current Architecture

### Main Components
1. **SnippetsCompleter** (`snippets-completer.js`) - Main completion provider
2. **BaseCompleter** (`base-completer.js`) - Base class for converting snippets to Monaco CompletionItems
3. **Snippet JSON Files** (23 files) - Data sources for completions
4. **RubyTab** (`ruby-tab.jsx`) - Integration point in React component
5. **SmalrubyMode** (`smalruby-mode.js`) - Language configuration

## 2. SnippetsCompleter.js (Full Content)

### Key Features:
- Manages both core and extension snippets
- Filters completions based on loaded extensions
- Handles Japanese character detection for minimum word length
- Provides completion items to Monaco Editor

### Core Logic:
- **Minimum word length**: 3 characters for ASCII, 1 character for Japanese
- **Japanese pattern**: `/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/` (hiragana, katakana, kanji)
- **Core snippets**: 9 categories (motion, looks, sound, events, control, sensing, operators, variables, procedures)
- **Extension snippets**: 11 categories (music, pen, video sensing, text-to-speech, translate, microbit, smalrubotS1, microbitMore, koshien, makeymakey, gdxfor)
- **Category sorting**: 01-09 for core, 10-21 for extensions

### Extension Filtering:
- Extensions are filtered dynamically via `vm.extensionManager.isExtensionLoaded(extensionId)`
- Categories with extensionId are only shown if extension is loaded
- Backward compatible: shows all if VM is not provided

### provideCompletionItems() Method:
```javascript
// Checks minimum word length
// Uses getWordUntilPosition() from Monaco model
// Combines core + active extension snippets
// Converts to CompletionItems and returns
```

## 3. BaseCompleter.js (Full Content)

### toCompletionItem() Method:
Converts snippet object to Monaco CompletionItem with:
- **label**: Uses structured label if `labelJa` exists: `{label, detail, description}`
- **kind**: Maps type to CompletionItemKind (Method, Function, Variable, Value, Constant, EnumMember, Keyword, Event, Snippet)
- **documentation**: Markdown formatted with description and code snippet
- **insertText**: The code snippet to insert
- **insertTextRules**: Marked as snippet for tab stops handling
- **range**: Where the completion will be inserted
- **detail**: "Smalruby Snippet" if no Japanese label
- **filterText**: Optional, used for matching
- **sortText**: Optional, used for sorting

### Type Mapping:
- `method` → Method
- `function` → Function
- `variable` → Variable
- `value` → Value
- `constant` → Constant
- `enum_member` → EnumMember
- `keyword` → Keyword
- `event` → Event
- `snippet` or default → Snippet

## 4. Snippet JSON Structure

### Structure of Each Snippet:
```json
{
    "key_name": {
        "snippet": "code(${1:default})",
        "description": "Japanese description of what it does",
        "type": "function|snippet|variable|value|constant|enum_member|keyword|event",
        "labelJa": "Japanese label shown in dropdown",
        "filterText": "romaji japanese kanji aliases additional_search_terms",
        "sortText": "XX_romanization"
    }
}
```

### Key Fields:
- **snippet**: Monaco snippet syntax with `${N:default}` for tab stops
- **description**: Full Japanese explanation (shown in docs)
- **type**: Determines icon and kind in completion menu
- **labelJa**: Japanese display name (becomes structured label)
- **filterText**: Space-separated romaji, Japanese, and aliases for matching
- **sortText**: Category prefix (01-21) + romanization for consistent ordering

### Example (motion-snippets.json):
```json
"move": {
    "snippet": "move(${1:10})",
    "description": "(10) 歩動かす",
    "type": "function",
    "labelJa": "動かす",
    "filterText": "ugokasu 動かす move 歩動かす",
    "sortText": "01_ugokasu"
}
```

## 5. Snippet Files Inventory (23 files)

### Core Snippets (9):
- **01**: motion-snippets.json (25 items) - move, turn, go_to, direction, x/y positioning
- **02**: looks-snippets.json - say, think, costume, backdrop, effects, size
- **03**: sound-snippets.json - play sound, effects, volume
- **04**: events-snippets.json - when_flag_clicked, when_key_pressed, when_clicked, broadcast
- **05**: control-snippets.json - sleep, times, loop, if, wait, stop, clone
- **06**: sensing-snippets.json - touching, distance, ask_and_wait, mouse, timer
- **07**: operators-snippets.json (30+ items) - rand, and, or, not, strings, math functions
- **08**: variables-snippets.json - variables, lists, operations
- **09**: procedure-snippets.json - define, call procedures

### Extension Snippets (11):
- **10**: music-snippets.json (extensionId: 'music')
- **11**: pen-snippets.json (extensionId: 'pen')
- **12**: video-sensing-snippets.json (extensionId: 'videoSensing')
- **13**: text-to-speech-snippets.json (extensionId: 'text2speech')
- **14**: translate-snippets.json (extensionId: 'translate')
- **15**: microbit-snippets.json (extensionId: 'microbit')
- **17**: smalrubot-s1-snippets.json (extensionId: 'smalrubotS1')
- **18**: microbit-more-snippets.json (extensionId: 'microbitMore')
- **19**: koshien-snippets.json (extensionId: 'koshien')
- **20**: makey-snippets.json (extensionId: 'makeymakey')
- **21**: gdx_for-snippets.json (extensionId: 'gdxfor')

## 6. RubyTab.jsx Integration

### Registration Point (lines 377-384):
```javascript
if (!this.completionProvider) {
    const completer = new SnippetsCompleter(this.props.vm);
    this.completionProvider = monaco.languages.registerCompletionItemProvider('smalruby', {
        provideCompletionItems: (model, position, context, token) => (
            completer.provideCompletionItems(model, position, context, token, monaco)
        )
    });
}
```

### Completion Registration:
- Registered in `handleEditorDidMount()` lifecycle method
- Uses 'smalruby' language ID
- Passes VM instance to completer for extension filtering
- Provider is disposed in `componentWillUnmount()`

## 7. SmalrubyMode.js Configuration

### Language Configuration:
- **wordPattern**: Includes Japanese characters (hiragana, katakana, kanji)
- **indentationRules**: Handles Ruby block indentation
- **autoClosingPairs**: Parentheses, brackets, quotes
- **comments**: Line comments with `#`

### Word Pattern:
```javascript
wordPattern: new RegExp(`(-?\\d*\\.\\d\\w*)|([a-zA-Z_${JA}][\\w${JA}]*)`)
```
This allows Japanese characters in word boundaries, enabling completion triggering on Japanese input.

## 8. Current Filtering/Context Capabilities

### Implemented:
1. **Minimum word length**: 3 ASCII or 1 Japanese character
2. **Extension filtering**: Based on loaded extensions via VM
3. **Category sorting**: Via sortText (01-21 prefixes)
4. **Type-based icons**: Via CompletionItemKind mapping

### NOT Yet Implemented (Opportunity for 課題4):
1. **Context awareness**: No analysis of preceding code/line context
2. **Block type filtering**: All snippets shown regardless of what's valid at cursor
3. **Scope analysis**: No variable/scope detection
4. **Line position analysis**: No detection of statement vs expression context
5. **Block nesting rules**: No Ruby syntax rules applied
6. **Parent block detection**: No detection of what block we're in (event, loop, if, etc.)
7. **Parameter context**: No showing only relevant enum values based on function context

## 9. Key Data in Snippets

### Context Information Available:
- **type field**: Distinguishes methods, functions, variables, events, constants
- **description field**: Describes what each snippet does
- **filterText field**: Contains contextual keywords

### Example Patterns:
- Event snippets (when_*) have type: 'event'
- Loop snippets (times, loop) have type: 'snippet'
- Parameter values have type: 'enum_member'
- Variables/expressions have type: 'variable' or 'value'

## 10. Opportunities for Context-Aware Completion (課題4)

### Analysis of Line Context:
Could analyze preceding code to understand:
1. Are we in an event block? (show only event-appropriate snippets)
2. Are we in a loop? (show loop-exit snippets)
3. Are we in an if condition? (show boolean/comparison snippets)
4. What's the expected type? (expression vs statement)

### Block Nesting Analysis:
- Detect if cursor is inside do...end block
- Detect if cursor is inside loop (times, loop, until, while)
- Show only exit-capable snippets in loops

### Parameter Context:
- Detect if we're inside a function parameter
- Show only enum values relevant to that parameter
- Example: If in `go_to(...)`, only show movement target enums

### Scope Analysis:
- Track defined variables and show only available ones
- Show method parameters in completion
- Filter based on what's defined in current target

## 11. Current Test Coverage

### Test File: snippets-completer.test.js
Tests cover:
- Minimum word length (3 ASCII, 1 Japanese)
- Structured labels with labelJa
- filterText matching
- sortText categorization
- Extension filtering (dynamic loading)
- Core snippets always shown
- Backward compatibility (no VM)

### Gap: No tests for context-aware filtering yet
