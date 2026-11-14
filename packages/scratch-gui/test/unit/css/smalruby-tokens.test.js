/**
 * @jest-environment node
 */
// smalruby-tokens.css is compiled with the same plugins as the webpack build (postcss-import and
// postcss-simple-vars, which throws on an unknown variable). A typo in an alias, or a token removed
// upstream, would otherwise be found only when a screen that imports the file is built.
import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssSimpleVars from 'postcss-simple-vars';

const TOKENS_PATH = path.resolve(__dirname, '../../../src/css/smalruby-tokens.css');

const compile = (css) => postcss([postcssImport, postcssSimpleVars]).process(css, { from: TOKENS_PATH });

const aliasNames = () => {
    const source = fs.readFileSync(TOKENS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return Array.from(source.matchAll(/^\$([\w-]+)\s*:/gm), (m) => m[1]);
};

describe('smalruby-tokens.css', () => {
    test('compiles with no unknown variable', async () => {
        const result = await compile(fs.readFileSync(TOKENS_PATH, 'utf8'));
        // The comments name tokens (`$space`); only the compiled values must have no variable left.
        expect(result.css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\$[\w-]/);
    });

    test('every alias has a value', async () => {
        const names = aliasNames();
        expect(names.length).toBeGreaterThan(0);
        const probe = names.map((name) => `.${name} { value: $${name}; }`).join('\n');
        const result = await compile(`@import './smalruby-tokens.css';\n${probe}`);
        const values = {};
        result.root.walkDecls('value', (decl) => {
            values[decl.parent.selector.slice(1)] = decl.value;
        });
        names.forEach((name) => {
            expect(values[name]).toBeTruthy();
            expect(values[name]).not.toMatch(/\$/);
        });
    });
});
