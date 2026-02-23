# Smalruby 3 Editor Monorepo

Smalruby 3 is a Ruby-based visual programming environment forked from Scratch 3.0. Users write Ruby code in a Monaco Editor; the code is parsed by @ruby/prism (WASM) and converted to/from Scratch blocks within the browser.

## Tech Stack
- **Frontend**: React, Redux, Monaco Editor (for Ruby code editing)
- **Parser**: @ruby/prism (WebAssembly-based Ruby parser — runs in browser and Node.js)
- **Runtime**: Node.js/JavaScript (Scratch VM)
- **Rendering**: WebGL (scratch-render), SVG (scratch-svg-renderer)
- **Environment**: Docker-based development environment
- **Monorepo Management**: npm workspaces

## Codebase Structure
- `packages/scratch-gui`: React web interface. Key subdirectories:
  - `src/lib/ruby-to-blocks-converter/`: Ruby AST (prism) → Scratch blocks
  - `src/lib/ruby-generator/`: Scratch blocks → Ruby source
  - `src/containers/ruby-tab/`: Monaco Editor integration and tab switching
  - `src/lib/prism-parser.js`: @ruby/prism WASM loader (browser + Node.js)
- `packages/scratch-vm`: Scratch VM — executes projects, manages block runtime.
- `packages/scratch-render`: WebGL rendering engine.
- `packages/scratch-svg-renderer`: SVG rendering engine.
- `packages/task-herder`: Async task queue with throttling.

## Key Rules Files
- `.claude/rules/scratch-gui/development.md`: Testing philosophy, Ruby mode architecture, commands
- `.claude/rules/scratch-vm/development.md`: VM-specific commands and patterns
- `.claude/rules/code-style.md`: ESLint, naming conventions, React/Redux patterns
- `.claude/rules/git-workflow.md`: Branching, Conventional Commits, PR workflow
