// The Japanese mode keeps the console extension in the palette and hides the other
// extensions (#1758, docs/dncl/design.md, chapter 5).
import { DNCL_ALLOWED_BLOCKS } from '../../../src/lib/dncl/dncl-block-filter';
import makeToolboxXML from '../../../src/lib/make-toolbox-xml';

const category = (id) => ({
    id,
    xml: `<category name="${id}" id="${id}"><block type="${id}_block"/></category>`,
});

const toolbox = (dnclMode) =>
    makeToolboxXML(
        false,
        false,
        'sprite',
        [category('smalrubyConsole'), category('pen')],
        'costume1',
        'backdrop1',
        '',
        undefined,
        dnclMode ? DNCL_ALLOWED_BLOCKS.join(',') : null,
        dnclMode,
        dnclMode,
    );

describe('makeToolboxXML: extensions in the Japanese mode', () => {
    test('keeps the console and hides the other extensions', () => {
        const xml = toolbox(true);
        expect(xml).toContain('id="smalrubyConsole"');
        expect(xml).not.toContain('id="pen"');
    });

    test('shows every extension out of the Japanese mode', () => {
        const xml = toolbox(false);
        expect(xml).toContain('id="smalrubyConsole"');
        expect(xml).toContain('id="pen"');
    });
});
