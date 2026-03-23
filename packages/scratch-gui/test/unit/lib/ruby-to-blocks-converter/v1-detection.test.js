import {containsV1Code} from '../../../../src/lib/ruby-to-blocks-converter/v1-detection';

describe('containsV1Code', () => {
    describe('v1 patterns that should be detected', () => {
        test('should detect self.when(:flag_clicked)', () => {
            expect(containsV1Code('self.when(:flag_clicked) do\nend')).toBe(true);
        });

        test('should detect self.when(:clicked)', () => {
            expect(containsV1Code('self.when(:clicked) do\nend')).toBe(true);
        });

        test('should detect self.when(:key_pressed, "space")', () => {
            expect(containsV1Code('self.when(:key_pressed, "space") do\nend')).toBe(true);
        });

        test('should detect self.when(:start_as_a_clone)', () => {
            expect(containsV1Code('self.when(:start_as_a_clone) do\nend')).toBe(true);
        });

        test('should detect self.when(:microbit_gesture, "jumped")', () => {
            expect(containsV1Code('self.when(:microbit_gesture, "jumped") do\nend')).toBe(true);
        });

        test('should detect self.when( :flag_clicked) with space', () => {
            expect(containsV1Code('self.when( :flag_clicked) do\nend')).toBe(true);
        });

        test('should detect bare play_drum()', () => {
            expect(containsV1Code('play_drum(drum: 1, beats: 0.25)')).toBe(true);
        });

        test('should detect bare rest()', () => {
            expect(containsV1Code('rest(0.25)')).toBe(true);
        });

        test('should detect self.instrument', () => {
            expect(containsV1Code('self.instrument = 5')).toBe(true);
        });

        test('should detect pen_down', () => {
            expect(containsV1Code('pen_down')).toBe(true);
        });

        test('should detect pen_clear', () => {
            expect(containsV1Code('pen_clear')).toBe(true);
        });

        test('should detect self.color +=', () => {
            expect(containsV1Code('self.color += 10')).toBe(true);
        });

        test('should detect self.color =', () => {
            expect(containsV1Code('self.color = 0')).toBe(true);
        });

        test('should detect self.color -=', () => {
            expect(containsV1Code('self.color -= 5')).toBe(true);
        });
    });

    describe('v2 patterns that should NOT be detected', () => {
        test('should not detect self.when_flag_clicked', () => {
            expect(containsV1Code('self.when_flag_clicked do\nend')).toBe(false);
        });

        test('should not detect music.play_drum()', () => {
            expect(containsV1Code('music.play_drum(drum: 1, beats: 0.25)')).toBe(false);
        });

        test('should not detect music.rest()', () => {
            expect(containsV1Code('music.rest(0.25)')).toBe(false);
        });

        test('should not detect music.instrument', () => {
            expect(containsV1Code('music.instrument = 5')).toBe(false);
        });

        test('should not detect pen.down', () => {
            expect(containsV1Code('pen.down')).toBe(false);
        });

        test('should not detect pen.clear', () => {
            expect(containsV1Code('pen.clear')).toBe(false);
        });

        test('should not detect pen.color +=', () => {
            expect(containsV1Code('pen.color += 10')).toBe(false);
        });
    });

    describe('normal Ruby code that should NOT be detected', () => {
        test('should not detect simple assignment', () => {
            expect(containsV1Code('x = 1')).toBe(false);
        });

        test('should not detect method definition', () => {
            expect(containsV1Code('def foo\nend')).toBe(false);
        });

        test('should not detect puts', () => {
            expect(containsV1Code('puts "hello"')).toBe(false);
        });

        test('should not detect v2 event handlers', () => {
            expect(containsV1Code('self.when_clicked do\nend')).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('should return false for empty string', () => {
            expect(containsV1Code('')).toBe(false);
        });

        test('should return false for null', () => {
            expect(containsV1Code(null)).toBe(false);
        });

        test('should return false for undefined', () => {
            expect(containsV1Code(undefined)).toBe(false);
        });

        test('should return false for non-string', () => {
            expect(containsV1Code(42)).toBe(false);
        });
    });
});
