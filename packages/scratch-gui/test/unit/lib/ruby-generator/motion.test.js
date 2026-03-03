import RubyGenerator from '../../../../src/lib/ruby-generator';
import MotionBlocks from '../../../../src/lib/ruby-generator/motion';

describe('RubyGenerator/Motion', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {},
            targetCommentTexts: []
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        MotionBlocks(RubyGenerator);
    });

    const makeBlock = id => ({id, opcode: 'dummy', inputs: {}, fields: {}});

    describe('motion_changexby', () => {
        test('positive DX emits self.x += N', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('10');
            expect(RubyGenerator.motion_changexby(makeBlock('b1'))).toEqual('self.x += 10\n');
        });

        test('negative DX emits self.x -= N (absolute value)', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('-10');
            expect(RubyGenerator.motion_changexby(makeBlock('b1'))).toEqual('self.x -= 10\n');
        });

        test('negative float DX emits self.x -= N', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('-3.5');
            expect(RubyGenerator.motion_changexby(makeBlock('b1'))).toEqual('self.x -= 3.5\n');
        });

        test('zero DX emits self.x += 0', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('0');
            expect(RubyGenerator.motion_changexby(makeBlock('b1'))).toEqual('self.x += 0\n');
        });

        test('block expression DX emits self.x += expr', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('y');
            expect(RubyGenerator.motion_changexby(makeBlock('b1'))).toEqual('self.x += y\n');
        });
    });

    describe('motion_changeyby', () => {
        test('positive DY emits self.y += N', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('10');
            expect(RubyGenerator.motion_changeyby(makeBlock('b1'))).toEqual('self.y += 10\n');
        });

        test('negative DY emits self.y -= N (absolute value)', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('-10');
            expect(RubyGenerator.motion_changeyby(makeBlock('b1'))).toEqual('self.y -= 10\n');
        });

        test('zero DY emits self.y += 0', () => {
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('0');
            expect(RubyGenerator.motion_changeyby(makeBlock('b1'))).toEqual('self.y += 0\n');
        });
    });
});
