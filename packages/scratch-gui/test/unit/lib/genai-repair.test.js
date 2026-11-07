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

    test('renames Scratch-style commands the AI makes up to Smalruby ones (#1283)', () => {
        const { code, fixes } = repairRuby(
            [
                'when_green_flag_clicked do',
                '  point_in_direction(-90)',
                '  forever do',
                '    if touched?("Apple") || key_pressed?("space")',
                '      broadcast("a")',
                '    end',
                '  end',
                'end',
                'when_this_sprite_clicked do',
                'end',
                'when_sprite_clicked do',
                'end',
                'when_broadcast_received("ゴール") do',
                'end',
                'when_i_receive("ゴール") do',
                'end',
            ].join('\n'),
        );
        expect(code).toBe(
            [
                'when_flag_clicked do',
                '  self.direction = -90',
                '  loop do',
                '    if touching?("Apple") || keyboard.pressed?("space")',
                '      broadcast("a")',
                '    end',
                '  end',
                'end',
                'when_clicked do',
                'end',
                'when_clicked do',
                'end',
                'when_receive("ゴール") do',
                'end',
                'when_receive("ゴール") do',
                'end',
            ].join('\n'),
        );
        expect(fixes.map((fix) => fix.line)).toEqual([1, 2, 3, 4, 9, 11, 13, 15]);
    });

    test('fixes clone and stop commands the AI gets wrong (#1283)', () => {
        const { code } = repairRuby(
            'create_clone\nwhen_start_as_clone do\n  stop_all\nend\nstop_all()\nstop_all_sounds\ncreate_clone("_myself_")\n',
        );
        expect(code).toBe(
            'create_clone("_myself_")\nwhen_start_as_a_clone do\n  stop("all")\nend\nstop("all")\nstop_all_sounds\ncreate_clone("_myself_")\n',
        );
    });

    test('writes random numbers as a range (#1283)', () => {
        const { code } = repairRuby(
            'go_to([rand(-220, 220), 180])\nsleep(pick_random(1, 3))\nmove(random(1,5))\nrand(1..10)\n',
        );
        expect(code).toBe('go_to([rand(-220..220), 180])\nsleep(rand(1..3))\nmove(rand(1..5))\nrand(1..10)\n');
    });

    test('does not rename inside strings, comments or longer names', () => {
        const source = [
            '# when_this_sprite_clicked は使えない',
            'say("forever do")',
            'keyboard.pressed?("space")',
            'my_touched?("a")',
            'self.direction = 90',
        ].join('\n');
        expect(repairRuby(source).code).toBe(source);
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
