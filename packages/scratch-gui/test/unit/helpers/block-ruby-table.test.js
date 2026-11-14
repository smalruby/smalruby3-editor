import { cleanRuby, defineBlockRubyTable } from './block-ruby-table';

describe('cleanRuby', () => {
    test('a template literal that starts with a new line is dedented', () => {
        expect(cleanRuby('\n    3.times do\n      say("hi")\n    end\n')).toBe('3.times do\n  say("hi")\nend');
    });

    test('a string that starts on its first line keeps its indentation', () => {
        expect(cleanRuby('3.times do\n  say("hi")\nend')).toBe('3.times do\n  say("hi")\nend');
    });
});

// The runner itself: a row runs once per version, and a row's `versions` overrides the table's.
defineBlockRubyTable(
    'defineBlockRubyTable',
    [
        { blocks: 'control_repeat(TIMES: 3) { looks_say(MESSAGE: "hi") }', ruby: '3.times do\n  say("hi")\nend' },
        {
            name: 'a v2-only row',
            versions: ['2'],
            blocks: 'event_whenflagclicked\nlooks_hide',
            ruby: `
                when_flag_clicked do
                  hide
                end
            `,
        },
    ],
    { versions: ['1', '2'] },
);
