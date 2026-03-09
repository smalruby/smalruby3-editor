#!/usr/bin/env node
// === Smalruby: This file is Smalruby-specific (postinstall patch for scratch-blocks Touch module) ===

/**
 * Patch the scratch-blocks Closure-compiled code to recognize pointer events.
 *
 * On touch-capable devices, Google Closure Library's PointerFallbackEventType remaps
 * TOUCH_MAP from touchstart to pointerdown. However, the internal checkTouchIdentifier
 * only recognizes mousedown and touchstart as gesture starts, and isMouseOrTouchEvent
 * only checks for mouse/touch prefixes. This causes all pointer-based block drags to
 * silently fail on touch devices (e.g. Chromebooks).
 *
 * This script patches the compiled blockly_compressed_vertical.js to also recognize
 * pointerdown as a gesture start and pointer events as input events.
 *
 * See: https://github.com/smalruby/smalruby3-editor/issues/251
 */

const fs = require('fs');
const path = require('path');

const BLOCKLY_FILE = path.resolve(
    __dirname,
    '../node_modules/scratch-blocks/blockly_compressed_vertical.js'
);

// Original checkTouchIdentifier: only recognizes mousedown and touchstart
const OLD_CHECK = '"mousedown"==a.type||"touchstart"==a.type';
// Patched: also recognizes pointerdown
const NEW_CHECK = '"mousedown"==a.type||"touchstart"==a.type||"pointerdown"==a.type';

// Original isMouseOrTouchEvent: only checks touch and mouse prefixes
const OLD_IS_EVENT = 'Blockly.utils.startsWith(a.type,"touch")||Blockly.utils.startsWith(a.type,"mouse")';
// Patched: also checks pointer prefix
const NEW_IS_EVENT = 'Blockly.utils.startsWith(a.type,"touch")||Blockly.utils.startsWith(a.type,"mouse")||Blockly.utils.startsWith(a.type,"pointer")';

function patchFile () {
    if (!fs.existsSync(BLOCKLY_FILE)) {
        console.log('[patch-scratch-blocks-touch] blockly_compressed_vertical.js not found, skipping');
        return;
    }

    let content = fs.readFileSync(BLOCKLY_FILE, 'utf8');
    let patched = false;

    if (content.includes(NEW_CHECK)) {
        console.log('[patch-scratch-blocks-touch] checkTouchIdentifier already patched');
    } else if (content.includes(OLD_CHECK)) {
        content = content.replace(OLD_CHECK, NEW_CHECK);
        patched = true;
        console.log('[patch-scratch-blocks-touch] Patched checkTouchIdentifier for pointerdown');
    } else {
        console.warn('[patch-scratch-blocks-touch] WARNING: Could not find checkTouchIdentifier pattern to patch');
    }

    if (content.includes(NEW_IS_EVENT)) {
        console.log('[patch-scratch-blocks-touch] isMouseOrTouchEvent already patched');
    } else if (content.includes(OLD_IS_EVENT)) {
        content = content.replace(OLD_IS_EVENT, NEW_IS_EVENT);
        patched = true;
        console.log('[patch-scratch-blocks-touch] Patched isMouseOrTouchEvent for pointer events');
    } else {
        console.warn('[patch-scratch-blocks-touch] WARNING: Could not find isMouseOrTouchEvent pattern to patch');
    }

    if (patched) {
        fs.writeFileSync(BLOCKLY_FILE, content, 'utf8');
        console.log('[patch-scratch-blocks-touch] Patch applied successfully');
    }
}

patchFile();
