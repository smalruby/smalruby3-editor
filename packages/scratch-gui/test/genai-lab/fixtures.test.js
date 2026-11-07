import RubyToBlocksConverter from '../../src/lib/ruby-to-blocks-converter';
import scenarios from './scenarios.js';

const RAW = ['ruby_statement', 'ruby_expression'];

describe('genai-lab scenarios', () => {
    for (const scenario of scenarios) {
        for (const sprite of scenario.sprites.filter((s) => s.code)) {
            test(`${scenario.id} / ${sprite.name} converts`, async () => {
                const converter = new RubyToBlocksConverter(null, { version: '2' });
                const ok = await converter.targetCodeToBlocks(null, sprite.code);
                const raw = Object.values(converter.blocks || {}).filter((b) => RAW.includes(b.opcode));
                expect({ ok, errors: converter.errors, raw: raw.length }).toEqual({ ok: true, errors: [], raw: 0 });
            });
        }
    }
});
