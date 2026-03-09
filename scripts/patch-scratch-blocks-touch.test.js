#!/usr/bin/env node
// === Smalruby: This file is Smalruby-specific (tests for postinstall patch script) ===

/**
 * Tests for the postinstall patch logic in patch-scratch-blocks-touch.js.
 * Run with: node scripts/patch-scratch-blocks-touch.test.js
 */

const assert = require('assert');

// The exact patterns from the patch script
const OLD_CHECK = '"mousedown"==a.type||"touchstart"==a.type';
const NEW_CHECK = '"mousedown"==a.type||"touchstart"==a.type||"pointerdown"==a.type';

const OLD_IS_EVENT = 'Blockly.utils.startsWith(a.type,"touch")||Blockly.utils.startsWith(a.type,"mouse")';
const NEW_IS_EVENT = 'Blockly.utils.startsWith(a.type,"touch")||Blockly.utils.startsWith(a.type,"mouse")||Blockly.utils.startsWith(a.type,"pointer")';

function applyPatch (content) {
    let patched = false;

    if (content.includes(NEW_CHECK)) {
        // already patched
    } else if (content.includes(OLD_CHECK)) {
        content = content.replace(OLD_CHECK, NEW_CHECK);
        patched = true;
    }

    if (content.includes(NEW_IS_EVENT)) {
        // already patched
    } else if (content.includes(OLD_IS_EVENT)) {
        content = content.replace(OLD_IS_EVENT, NEW_IS_EVENT);
        patched = true;
    }

    return {content, patched};
}

// --- Tests ---

let passed = 0;
let failed = 0;

function test (name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
    }
}

console.log('patch-scratch-blocks-touch.js tests:');

test('patches checkTouchIdentifier to recognize pointerdown', () => {
    const input = `checkTouchIdentifier=function(a){return "mousedown"==a.type||"touchstart"==a.type}`;
    const {content, patched} = applyPatch(input);
    assert.ok(patched, 'should report patched=true');
    assert.ok(content.includes('"pointerdown"==a.type'), 'should include pointerdown check');
    assert.ok(content.includes(OLD_CHECK.replace(OLD_CHECK, NEW_CHECK)), 'should contain full new check');
});

test('patches isMouseOrTouchEvent to recognize pointer prefix', () => {
    const input = `isMouseOrTouchEvent=function(a){return Blockly.utils.startsWith(a.type,"touch")||Blockly.utils.startsWith(a.type,"mouse")}`;
    const {content, patched} = applyPatch(input);
    assert.ok(patched, 'should report patched=true');
    assert.ok(content.includes('startsWith(a.type,"pointer")'), 'should include pointer prefix check');
});

test('is idempotent - does not double-patch', () => {
    const input = `${NEW_CHECK} and ${NEW_IS_EVENT}`;
    const {content, patched} = applyPatch(input);
    assert.ok(!patched, 'should report patched=false');
    assert.strictEqual(content, input, 'content should be unchanged');
});

test('handles file with both patterns needing patch', () => {
    const input = [
        `checkTouchIdentifier=function(a){return "mousedown"==a.type||"touchstart"==a.type}`,
        `isMouseOrTouchEvent=function(a){return Blockly.utils.startsWith(a.type,"touch")||Blockly.utils.startsWith(a.type,"mouse")}`
    ].join('\n');
    const {content, patched} = applyPatch(input);
    assert.ok(patched, 'should report patched=true');
    assert.ok(content.includes('"pointerdown"==a.type'), 'should patch checkTouchIdentifier');
    assert.ok(content.includes('startsWith(a.type,"pointer")'), 'should patch isMouseOrTouchEvent');
});

test('preserves surrounding code', () => {
    const input = `var before=1;"mousedown"==a.type||"touchstart"==a.type;var after=2;`;
    const {content} = applyPatch(input);
    assert.ok(content.startsWith('var before=1;'), 'should preserve code before');
    assert.ok(content.endsWith(';var after=2;'), 'should preserve code after');
});

test('handles file with no matching patterns', () => {
    const input = 'some completely different code';
    const {content, patched} = applyPatch(input);
    assert.ok(!patched, 'should report patched=false');
    assert.strictEqual(content, input, 'content should be unchanged');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
