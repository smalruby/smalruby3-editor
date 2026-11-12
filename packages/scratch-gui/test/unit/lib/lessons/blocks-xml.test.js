/**
 * blocksToXml: VM 形式のブロック（Ruby → ブロック変換の出力）を、Blockly が読める
 * XML にする（scratch-vm の Blocks#toXML と同じ形。ヒントの吹き出しに描くため）。
 */
import { blocksToXml } from '../../../../src/lib/lessons/blocks-xml';

const hat = {
    id: 'hat',
    opcode: 'event_whenthisspriteclicked',
    inputs: {},
    fields: {},
    next: 'say',
    topLevel: true,
    shadow: false,
};
const say = {
    id: 'say',
    opcode: 'looks_sayforsecs',
    inputs: {
        MESSAGE: { name: 'MESSAGE', block: 'msg', shadow: 'msg' },
        SECS: { name: 'SECS', block: 'secs', shadow: 'secs' },
    },
    fields: {},
    next: null,
    parent: 'hat',
    topLevel: false,
    shadow: false,
};
const msg = {
    id: 'msg',
    opcode: 'text',
    inputs: {},
    fields: { TEXT: { name: 'TEXT', value: 'こんにちは！ <b>' } },
    next: null,
    parent: 'say',
    topLevel: false,
    shadow: true,
};
const secs = {
    id: 'secs',
    opcode: 'math_number',
    inputs: {},
    fields: { NUM: { name: 'NUM', value: 2 } },
    next: null,
    parent: 'say',
    topLevel: false,
    shadow: true,
};

describe('blocksToXml', () => {
    test('serializes top-level scripts with inputs, shadows, fields and next', () => {
        const xml = blocksToXml({ hat, say, msg, secs });
        expect(xml).toContain('<block id="hat" type="event_whenthisspriteclicked">');
        expect(xml).toContain('<next><block id="say" type="looks_sayforsecs">');
        expect(xml).toContain('<value name="MESSAGE"><shadow id="msg" type="text"><field name="TEXT">');
        // 文字列はエスケープ、数値はそのまま
        expect(xml).toContain('こんにちは！ &lt;b&gt;</field>');
        expect(xml).toContain('<field name="NUM">2</field>');
        expect(xml).toMatch(/^<xml xmlns="http:\/\/www\.w3\.org\/1999\/xhtml">.*<\/xml>$/);
    });

    test('an obscured shadow is written after the block that covers it', () => {
        const reporter = {
            id: 'rep',
            opcode: 'operators_add',
            inputs: {},
            fields: {},
            next: null,
            parent: 'say2',
            topLevel: false,
            shadow: false,
        };
        const say2 = {
            ...say,
            id: 'say2',
            inputs: { MESSAGE: { name: 'MESSAGE', block: 'rep', shadow: 'msg' } },
            topLevel: true,
        };
        const xml = blocksToXml({ say2, rep: reporter, msg: { ...msg, parent: 'say2' } });
        expect(xml).toContain(
            '<value name="MESSAGE"><block id="rep" type="operators_add"></block><shadow id="msg" type="text">',
        );
    });

    test('writes mutations before inputs and field ids / variable types', () => {
        const call = {
            id: 'call',
            opcode: 'procedures_call',
            mutation: { tagName: 'mutation', proccode: 'jump %s', argumentids: '["a"]', children: [] },
            inputs: {},
            fields: { VARIABLE: { name: 'VARIABLE', value: 'score', id: 'v1', variableType: '' } },
            next: null,
            topLevel: true,
            shadow: false,
        };
        const xml = blocksToXml({ call });
        expect(xml).toContain(
            '<mutation proccode="jump %s" argumentids="[&quot;a&quot;]"></mutation>' +
                '<field name="VARIABLE" id="v1" variabletype="">score</field>',
        );
    });

    test('skips blocks that are not top-level scripts and ignores dangling references', () => {
        const xml = blocksToXml({ hat: { ...hat, next: 'missing' } });
        expect(xml).toBe(
            '<xml xmlns="http://www.w3.org/1999/xhtml"><block id="hat" type="event_whenthisspriteclicked"></block></xml>',
        );
        expect(blocksToXml({})).toBe('<xml xmlns="http://www.w3.org/1999/xhtml"></xml>');
        expect(blocksToXml(null)).toBe('<xml xmlns="http://www.w3.org/1999/xhtml"></xml>');
    });
});
