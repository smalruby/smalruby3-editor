# Playwright MCP Tips for Smalruby Tutorial Cards

## Tutorial Card Navigation (data attributes)

Use `data-card-action` attributes to reliably identify card navigation elements:

```javascript
// Navigate to next step
await page.locator('[data-card-action="next"]').click();

// Navigate to previous step
await page.locator('[data-card-action="prev"]').click();

// Click insert code button
await page.locator('[data-card-action="insert-blocks"]').click();
// or
await page.locator('[data-card-action="insert-ruby"]').click();
```

## Card State Attributes

The card container also exposes:
- `data-deck-id` — currently active deck ID (e.g., "chat-1-basic-1")
- `data-step` — current step number (1-based)
- `data-total-steps` — total number of steps
- `data-steps-remaining` — remaining steps after current

These are defined in `packages/scratch-gui/src/components/cards/cards.jsx`.

## Chrome Launch Issues

If Chrome is already running and Playwright can't attach:
- Stop any existing Playwright MCP browser session
- Restart the Playwright MCP server
- Use `browser_close` to clear the session

## CSS Modules

Class names are transformed by CSS Modules (e.g., `.left-button` becomes `.left-button_abc123`).
Use `[class*="left-button"]` or data attributes instead for Playwright selectors.
