#!/usr/bin/env node

/**
 * Generate ruby-logo-icon-uri.js from ruby-logo-icon.svg.
 *
 * Usage:
 *   cd packages/scratch-vm && npm run generate:ruby-icon
 *
 * The script reads ruby-logo-icon.svg from the smalruby_ruby extension
 * directory, strips XML declarations/DOCTYPE/metadata while preserving
 * path and gradient data, base64-encodes it, and writes the result to
 * ruby-logo-icon-uri.js in the same extension directory.
 */

const fs = require('fs');
const path = require('path');

const extDir = path.join(__dirname, '..', 'src', 'extensions', 'smalruby_ruby');

const svgPath = path.join(extDir, 'ruby-logo-icon.svg');
let svg = fs.readFileSync(svgPath, 'utf8');

// Strip XML declaration, DOCTYPE, and processing instructions
svg = svg.replace(/<\?xml[^?]*\?>\s*/g, '');
svg = svg.replace(/<!DOCTYPE[^>]*>\s*/g, '');
// Strip Adobe Illustrator metadata blocks
svg = svg.replace(/<metadata[\s\S]*?<\/metadata>\s*/gi, '');
// Collapse leading/trailing whitespace
svg = svg.trim();

const base64 = Buffer.from(svg, 'utf8').toString('base64');
const dataURI = `data:image/svg+xml;base64,${base64}`;

const output = `// Auto-generated from ruby-logo-icon.svg by scripts/generate-ruby-icon-uri.js — do not edit manually.
// To regenerate:
//   cd packages/scratch-vm && npm run generate:ruby-icon
const blockIconURI =
    '${dataURI}';

module.exports = blockIconURI;
`;

const outPath = path.join(extDir, 'ruby-logo-icon-uri.js');
fs.writeFileSync(outPath, output, 'utf8');

console.log(`Written ${outPath} (${dataURI.length} chars)`);
