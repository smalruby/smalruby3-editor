import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectRubyBlockError
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Translate', () => {
    let converter;
    let target;
    let code;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
    });

    test('translate_getTranslate', async () => {
        code = 'say(translate("hello", "ja"))';
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('translate_getViewerLanguage', async () => {
        code = 'say(language)';
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('invalid', async () => {
        await convertAndExpectRubyBlockError(converter, target, 'translate("hello")');
    });
});
