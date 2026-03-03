import RubyGenerator from '../../../../src/lib/ruby-generator';
import SoundBlocks from '../../../../src/lib/ruby-generator/sound';

describe('RubyGenerator/Sound', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {},
            targetCommentTexts: []
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        SoundBlocks(RubyGenerator);
    });

    const makeBlock = id => ({id, opcode: 'dummy', inputs: {}, fields: {}});

    describe('sound_changevolumeby', () => {
        test('positive VOLUME emits self.volume += N', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('10');
            expect(RubyGenerator.sound_changevolumeby(makeBlock('b1'))).toEqual('self.volume += 10\n');
        });

        test('negative VOLUME emits self.volume -= N (absolute value)', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('-10');
            expect(RubyGenerator.sound_changevolumeby(makeBlock('b1'))).toEqual('self.volume -= 10\n');
        });

        test('zero VOLUME emits self.volume += 0', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('0');
            expect(RubyGenerator.sound_changevolumeby(makeBlock('b1'))).toEqual('self.volume += 0\n');
        });

        test('block expression VOLUME emits self.volume += expr', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('x');
            expect(RubyGenerator.sound_changevolumeby(makeBlock('b1'))).toEqual('self.volume += x\n');
        });
    });
});
