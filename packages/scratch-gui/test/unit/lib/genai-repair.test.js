import { repairRuby, resolveName, splitBySprite } from '../../../src/lib/genai-repair.js';

describe('resolveName', () => {
    test('finds the name regardless of case, spaces and partial words', () => {
        expect(resolveName('pop', ['Pop', 'Meow'])).toBe('Pop');
        expect(resolveName('dance', ['Dance Around', 'Pop'])).toBe('Dance Around');
        expect(resolveName('ニャー', ['ニャー'])).toBe('ニャー');
    });

    test('does not stand in the only asset for a name that does not fit (#1280)', () => {
        expect(resolveName('beep', ['Pop'])).toBeNull();
        expect(resolveName('beep', ['Pop', 'Meow'])).toBeNull();
        expect(resolveName('beep', [])).toBeNull();
    });
});

describe('repairRuby', () => {
    test('rewrites a keyword sound call to the sprite own sound', () => {
        const { code, fixes } = repairRuby('when_receive("a") do\n  play(name: "pop")\nend\n', {
            sounds: ['Pop'],
        });
        expect(code).toBe('when_receive("a") do\n  play("Pop")\nend\n');
        expect(fixes).toEqual([{ line: 2, from: 'play(name: "pop")', to: 'play("Pop")' }]);
    });

    test('reports sound and costume names the sprite does not have instead of guessing', () => {
        const { code, missing } = repairRuby('play(name: "beep")\nswitch_costume("z")\nplay("Pop")\n', {
            sounds: ['Pop'],
            costumes: ['a', 'b'],
        });
        expect(code).toBe('play("beep")\nswitch_costume("z")\nplay("Pop")\n');
        expect(missing).toEqual([
            { line: 1, kind: 'sound', name: 'beep', names: ['Pop'] },
            { line: 2, kind: 'costume', name: 'z', names: ['a', 'b'] },
        ]);
    });

    test('normalizes other sound, costume and wait spellings', () => {
        const { code } = repairRuby(
            'play_sound("meow")\nplay_sound_until_done(sound: "meow")\nswitch_costume_to(name: "b")\nwait(0.5)\nwait 2',
            { sounds: ['Meow'], costumes: ['a', 'B'] },
        );
        expect(code).toBe('play("Meow")\nplay_until_done("Meow")\nswitch_costume("B")\nsleep(0.5)\nsleep(2)');
    });

    test('leaves correct code and wait until alone', () => {
        const source = 'play("Pop")\nwait until !($わたし == "")\n';
        expect(repairRuby(source, { sounds: ['Pop'] })).toEqual({ code: source, fixes: [], missing: [] });
    });
});

describe('splitBySprite', () => {
    test('splits at sprite heading comments and ignores other comments', () => {
        const code = '# 「Abby」\n# はじめに\nwhen_flag_clicked do\nend\n\n# 「Dee」\nwhen_clicked do\nend\n';
        expect(splitBySprite(code, ['Abby', 'Dee', 'ステージ'])).toEqual([
            { name: 'Abby', code: '# はじめに\nwhen_flag_clicked do\nend\n' },
            { name: 'Dee', code: 'when_clicked do\nend\n' },
        ]);
    });

    test('returns null without headings', () => {
        expect(splitBySprite('when_flag_clicked do\nend\n', ['Abby'])).toBeNull();
    });
});
