// SPDX-License-Identifier: MIT
// The helpers of the tests: they read the JSON test data (./data/, shared with
// the other implementations; see ../README.md) and make the tables the data names.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPrism } from '@ruby/prism';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

/**
 * Read a file of the test data.
 * @param {string} name - The file in ./data/ (`parse.json`, ...).
 * @returns {object} Its content.
 */
const readData = (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));

/**
 * Keep only what JSON keeps (no undefined, no functions, no classes), so a
 * result can be compared with the data.
 * @param {unknown} value - A result.
 * @returns {unknown} The same as JSON.
 */
const plain = (value) => JSON.parse(JSON.stringify(value));

/**
 * The tables the data names. Each implementation makes them in its own language:
 * - `none`: no table (the names are local variables, there is no function).
 * - `plain`: only `表示する` is `puts`.
 */
const TABLES = {
    none: {},
    plain: {
        functions: { 表示する: { build: (args, ruby) => ruby.send(null, 'puts', args) } },
    },
};

/**
 * A JaAST without the keys that say where a node is.
 * @param {unknown} node - A node, or a value of one.
 * @param {Array<string>} keys - The keys of the positions.
 * @returns {unknown} The node without them.
 */
const withoutPositions = (node, keys) => {
    if (Array.isArray(node)) return node.map((n) => withoutPositions(n, keys));
    if (!node || typeof node !== 'object') return node;
    const out = {};
    Object.entries(node).forEach(([key, value]) => {
        if (!keys.includes(key)) out[key] = withoutPositions(value, keys);
    });
    return out;
};

let loading = null;

/**
 * The parse function of prism (`parse(source)` gives `{value, comments, errors}`), loaded once.
 * @returns {Promise<function(string): object>} The parse function.
 */
const prism = () => {
    if (!loading) loading = loadPrism();
    return loading;
};

export { plain, prism, readData, TABLES, withoutPositions };
