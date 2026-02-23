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
- `packages/scratch-gui`: The React web interface.
- `packages/scratch-vm`: The execution engine.
- `packages/scratch-render`: WebGL rendering engine.
- `packages/scratch-svg-renderer`: SVG rendering engine.
- `packages/task-herder`: Task management/tracking utility.
