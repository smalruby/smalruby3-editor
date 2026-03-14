import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Text2Speech', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
        expected = null;
    });

    test('text2speech_speakAndWait', async () => {
        code = 'text2speech.speak("hello")';
        expected = [
            {
                opcode: 'text2speech_speakAndWait',
                inputs: [
                    {
                        name: 'WORDS',
                        block: expectedInfo.makeText('hello')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('text2speech_setVoice', async () => {
        code = 'text2speech.voice = "alto"';
        expected = [
            {
                opcode: 'text2speech_setVoice',
                inputs: [
                    {
                        name: 'VOICE',
                        block: {
                            opcode: 'text2speech_menu_voices',
                            fields: [{name: 'voices', value: 'ALTO'}],
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('invalid', async () => {
        for (const s of [
            'text2speech.speak(1)',
            'text2speech.voice = 1',
            'text2speech.voice = "invalid_voice"'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        }
    });
});
