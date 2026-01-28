---
paths:
  - "packages/scratch-render/**/*.js"
  - "packages/scratch-render/package.json"
---

# scratch-render Development

WebGL-based rendering engine for Scratch 3.0. Handles sprite rendering, effects, and stage drawing.

**CRITICAL**: All npm commands MUST be run inside Docker containers using the `app` service.

## Package Commands

All commands are run from `/app/packages/scratch-render` inside the container.

### Installation

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-render && npm install"
```

### Build

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-render && npm run build"
```

### Testing

```bash
# All tests
docker compose run --rm app bash -c "cd /app/packages/scratch-render && npm test"
```

## Key Directories

- `src/`: WebGL rendering implementation
  - Sprite rendering
  - Effect shaders (color, fisheye, whirl, pixelate, mosaic, brightness, ghost)
  - Drawable management
  - Texture and skin handling

## Development Notes

- This package provides the WebGL rendering layer used by scratch-vm
- Renders sprites, backdrops, and visual effects
- Manages GPU resources and shader compilation
- Integrated with scratch-svg-renderer for vector graphics
