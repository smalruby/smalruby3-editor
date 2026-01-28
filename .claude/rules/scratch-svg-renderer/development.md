---
paths:
  - "packages/scratch-svg-renderer/**/*.js"
  - "packages/scratch-svg-renderer/package.json"
---

# scratch-svg-renderer Development

SVG processing and rendering for Scratch 3.0 vector costumes.

**CRITICAL**: All npm commands MUST be run inside Docker containers using the `app` service.

## Package Commands

All commands are run from `/app/packages/scratch-svg-renderer` inside the container.

### Installation

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-svg-renderer && npm install"
```

### Build

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-svg-renderer && npm run build"
```

### Testing

```bash
# All tests
docker compose run --rm app bash -c "cd /app/packages/scratch-svg-renderer && npm test"
```

## Key Directories

- `src/`: SVG processing implementation
  - SVG parsing and manipulation
  - Font loading and text handling
  - Vector-to-bitmap conversion

## Development Notes

- Processes SVG files for use in Scratch projects
- Handles text rendering and font management
- Converts vector graphics to bitmaps when needed
- Works with scratch-render for final display
