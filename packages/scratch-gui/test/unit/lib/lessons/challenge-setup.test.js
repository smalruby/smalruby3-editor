import { setupForChallenge } from '../../../../src/lib/lessons/challenge-setup';
import { LANGUAGES, defineChallenge, defineCourse } from '../../../../src/lib/lessons/courses';

const course = (language) => defineCourse({ id: 'c', language, lessons: [] });

describe('setupForChallenge', () => {
    test('a blocks course starts on the code tab when the challenge has no setup', () => {
        expect(setupForChallenge(course(LANGUAGES.BLOCKS), defineChallenge({ id: 'x' }))).toEqual({ tab: 'code' });
    });

    test('a Ruby course starts on the Ruby tab in Ruby mode', () => {
        expect(setupForChallenge(course(LANGUAGES.RUBY), defineChallenge({ id: 'x' }))).toEqual({
            tab: 'ruby',
            rubyMode: 'ruby',
        });
    });

    test('a DNCL course starts on the Ruby tab in DNCL mode', () => {
        expect(setupForChallenge(course(LANGUAGES.DNCL), defineChallenge({ id: 'x' }))).toEqual({
            tab: 'ruby',
            rubyMode: 'dncl',
        });
    });

    test('the challenge setup overrides the defaults and adds extensions', () => {
        const challenge = defineChallenge({ id: 'x', setup: { tab: 'costumes', extensions: ['pen'] } });
        expect(setupForChallenge(course(LANGUAGES.BLOCKS), challenge)).toEqual({
            tab: 'costumes',
            extensions: ['pen'],
        });
    });

    test('an unknown language has no defaults', () => {
        expect(setupForChallenge(course('other'), defineChallenge({ id: 'x' }))).toEqual({});
    });
});
