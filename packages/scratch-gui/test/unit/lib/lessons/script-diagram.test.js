/**
 * ブロックを右クリックして描くアクティビティ図（#1647）: 作品のブロックから、右クリックしたブロックのある
 * 1 本のスクリプトだけの図を作る純粋関数を守る。ブロックは本物の Ruby → ブロック変換で作る
 * （VM の target のブロックと同じ形）。
 */
import { ja } from '../../../../src/lib/lessons/activity-diagram/activity-diagram.locale';
import { formatFromTable } from '../../../../src/lib/lessons/activity-diagram/labels';
import { NODE_KINDS } from '../../../../src/lib/lessons/activity-diagram/model';
import {
    scriptActivityDiagram,
    scriptBlocksOf,
    scriptRootId,
} from '../../../../src/lib/lessons/activity-diagram/script-diagram';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const format = formatFromTable(ja);

const toBlocks = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    expect({ ok, errors: converter.errors }).toEqual({ ok: true, errors: [] });
    return converter.blocks;
};

const idOf = (blocks, opcode) => Object.keys(blocks).find((id) => blocks[id].opcode === opcode);

const TWO_SCRIPTS =
    'when_flag_clicked do\n  say("こんにちは！", 2)\nend\n\n' +
    'when_clicked do\n  ask("名前は？")\n  if answer == "おわり"\n    say("またね")\n  end\nend\n';

describe('scriptRootId', () => {
    test('walks up from a block in a branch and from a reporter to the hat', async () => {
        const blocks = await toBlocks(TWO_SCRIPTS);
        const hat = idOf(blocks, 'event_whenthisspriteclicked');
        expect(scriptRootId(blocks, idOf(blocks, 'looks_say'))).toBe(hat);
        expect(scriptRootId(blocks, idOf(blocks, 'operator_equals'))).toBe(hat);
        expect(scriptRootId(blocks, hat)).toBe(hat);
    });

    test('is null for a block that is gone', async () => {
        const blocks = await toBlocks(TWO_SCRIPTS);
        expect(scriptRootId(blocks, 'no-such-block')).toBeNull();
        expect(scriptRootId(blocks, null)).toBeNull();
    });
});

describe('scriptBlocksOf', () => {
    test('keeps only the blocks of the script, with the top as the only top-level block', async () => {
        const blocks = await toBlocks(TWO_SCRIPTS);
        const hat = idOf(blocks, 'event_whenthisspriteclicked');
        const picked = scriptBlocksOf(blocks, hat);
        expect(Object.values(picked).some((b) => b.opcode === 'event_whenflagclicked')).toBe(false);
        expect(Object.values(picked).some((b) => b.opcode === 'operator_equals')).toBe(true);
        expect(Object.keys(picked).filter((id) => picked[id].topLevel)).toEqual([hat]);
        // もとのブロックは変えない
        expect(blocks[hat].topLevel).toBe(true);
    });
});

describe('scriptActivityDiagram', () => {
    test('draws only the script of the right-clicked block', async () => {
        const blocks = await toBlocks(TWO_SCRIPTS);
        const diagram = scriptActivityDiagram(blocks, idOf(blocks, 'operator_equals'), { format });
        const { scripts } = diagram.model.lanes[0].targets[0];
        expect(scripts).toHaveLength(1);
        expect(scripts[0].start).toBe('このスプライトが押されたとき');
        expect(scripts[0].body.map((node) => node.kind)).toEqual([NODE_KINDS.ACTION, NODE_KINDS.DECISION]);
        expect(scripts[0].body[1].yesGuard).toBe('[答え = 「おわり」]');
        // 見出し（レーン・スプライトの名前）は描かない
        expect(diagram.model.lanes[0].label).toBeNull();
        expect(diagram.layout.shapes.length).toBeGreaterThan(0);
        expect(diagram.layout.description).toBe(
            'このスプライトが押されたとき → 「名前は？」と聞いて待つ → 答え = 「おわり」？' +
                '（[答え = 「おわり」]: 「またね」と言う / [それ以外]: -）',
        );
    });

    test('is null when the block was deleted', async () => {
        const blocks = await toBlocks(TWO_SCRIPTS);
        expect(scriptActivityDiagram(blocks, 'deleted', { format })).toBeNull();
    });

    test('a loose stack without a hat is drawn from its first block', async () => {
        const blocks = await toBlocks('move(10)\nturn_right(15)\n');
        const diagram = scriptActivityDiagram(blocks, idOf(blocks, 'motion_turnright'), {
            format,
            blockName: (opcode) => ({ motion_movesteps: '%1 歩動かす', motion_turnright: '右に %1 度回す' })[opcode],
        });
        const [script] = diagram.model.lanes[0].targets[0].scripts;
        expect(script.start).toBeNull();
        expect(script.body.map((node) => node.label)).toEqual(['10 歩動かす', '右に 15 度回す']);
    });

    test('the text of the block on the workspace is used for blocks the diagram does not know', async () => {
        const blocks = await toBlocks('when_flag_clicked do\n  move(10)\nend\n');
        const diagram = scriptActivityDiagram(blocks, idOf(blocks, 'motion_movesteps'), {
            format,
            blockName: () => '%1 歩動かす',
            blockText: (block) => (block.opcode === 'motion_movesteps' ? '(10) 歩動かす' : null),
        });
        expect(diagram.model.lanes[0].targets[0].scripts[0].body[0].label).toBe('(10) 歩動かす');
    });

    test('a hat the opcode does not tell (an extension hat) becomes the start with isHat', async () => {
        const blocks = await toBlocks('when_flag_clicked do\n  move(10)\nend\n');
        const hat = idOf(blocks, 'event_whenflagclicked');
        // 拡張機能の帽子に見立てる
        const extension = { ...blocks, [hat]: { ...blocks[hat], opcode: 'meshV2_whenSomething' } };
        const options = {
            format,
            blockText: (block) => (block.opcode === 'meshV2_whenSomething' ? '何かのとき' : null),
        };
        const plain = scriptActivityDiagram(extension, hat, options).model.lanes[0].targets[0].scripts[0];
        expect(plain.start).toBeNull();
        const withHat = scriptActivityDiagram(extension, hat, { ...options, isHat: (b) => b.id === hat }).model
            .lanes[0].targets[0].scripts[0];
        expect(withHat.start).toBe('何かのとき');
        expect(withHat.body).toHaveLength(1);
    });

    test('my blocks: the definition is the start and a call is written with its values', () => {
        // VM の形（mutation の argumentids / argumentnames は JSON の文字列）
        const blocks = {
            def: {
                id: 'def',
                opcode: 'procedures_definition',
                topLevel: true,
                parent: null,
                next: 'call',
                inputs: { custom_block: { name: 'custom_block', block: 'proto', shadow: 'proto' } },
                fields: {},
            },
            proto: {
                id: 'proto',
                opcode: 'procedures_prototype',
                shadow: true,
                parent: 'def',
                next: null,
                inputs: {},
                fields: {},
                mutation: { proccode: 'ジャンプ %s', argumentids: '["a1"]', argumentnames: '["高さ"]' },
            },
            call: {
                id: 'call',
                opcode: 'procedures_call',
                parent: 'def',
                next: null,
                fields: {},
                inputs: { a1: { name: 'a1', block: 'num', shadow: 'num' } },
                mutation: { proccode: 'ジャンプ %s', argumentids: '["a1"]' },
            },
            num: {
                id: 'num',
                opcode: 'text',
                shadow: true,
                parent: 'call',
                next: null,
                inputs: {},
                fields: { TEXT: { name: 'TEXT', value: '10' } },
            },
        };
        const [script] = scriptActivityDiagram(blocks, 'call', { format }).model.lanes[0].targets[0].scripts;
        expect(script.start).toBe('ジャンプ (高さ)の定義');
        expect(script.body).toEqual([{ kind: NODE_KINDS.ACTION, label: 'ジャンプ 10' }]);
    });
});
