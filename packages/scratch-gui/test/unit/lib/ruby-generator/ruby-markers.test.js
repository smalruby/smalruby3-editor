import { rubyMarkersOf, rubyMarkerValueOf } from '../../../../src/lib/ruby-markers';

describe('rubyMarkersOf', () => {
    test('a comment of one marker', () => {
        expect(rubyMarkersOf('@ruby:method:puts')).toEqual(['@ruby:method:puts']);
    });

    test('markers joined with a comma', () => {
        expect(rubyMarkersOf('@ruby:method:puts,@ruby:argument:1:type:Integer')).toEqual([
            '@ruby:method:puts',
            '@ruby:argument:1:type:Integer',
        ]);
    });

    test('markers joined with a space (the explicit return)', () => {
        expect(rubyMarkersOf('@ruby:syntax:return @ruby:return:foo')).toEqual([
            '@ruby:syntax:return',
            '@ruby:return:foo',
        ]);
    });

    test('markers on their own lines', () => {
        expect(rubyMarkersOf('@ruby:block_param:1:i\n@ruby:block_param:2:j')).toEqual([
            '@ruby:block_param:1:i',
            '@ruby:block_param:2:j',
        ]);
    });

    test('a trailing comment of the user before the markers', () => {
        expect(
            rubyMarkersOf('うしろ\n@ruby:comment_position:inline\n@ruby:method:puts,@ruby:argument:1:type:Integer'),
        ).toEqual(['@ruby:comment_position:inline', '@ruby:method:puts', '@ruby:argument:1:type:Integer']);
    });

    test('comments of the user on the lines before and the trailing one', () => {
        expect(rubyMarkersOf('前1\n前2\nうしろ\n@ruby:comment_position:inline:last\n@ruby:symbol:hello')).toEqual([
            '@ruby:comment_position:inline:last',
            '@ruby:symbol:hello',
        ]);
    });

    test('markers before the comment of the user (an older order)', () => {
        expect(rubyMarkersOf('@ruby:lvar:a:1\nメモ')).toEqual(['@ruby:lvar:a:1']);
    });

    test('a comma inside the value of a marker is kept', () => {
        expect(rubyMarkersOf('@ruby:syntax:case:foo(1, 2):1')).toEqual(['@ruby:syntax:case:foo(1, 2):1']);
        expect(rubyMarkersOf('@ruby:class:<=//Smalruby3/Sprite,name=Cat')).toEqual([
            '@ruby:class:<=//Smalruby3/Sprite,name=Cat',
        ]);
    });

    test('a line of the user that only mentions a marker is not a marker', () => {
        expect(rubyMarkersOf('メモ @ruby:method:puts')).toEqual([]);
    });

    test('no comment', () => {
        expect(rubyMarkersOf(null)).toEqual([]);
        expect(rubyMarkersOf('')).toEqual([]);
        expect(rubyMarkersOf('メモ')).toEqual([]);
    });

    // A marker whose value is program text runs to the end of the line (review of #1857, M1).
    test.each([
        ['@ruby:syntax:case:"a @ruby:b":1'],
        ['@ruby:syntax:case:"a,@ruby:b":1'],
        ['@ruby:syntax:case:"a  @ruby:b @ruby:c":2'],
        ['@ruby:symbol:a @ruby:x'],
        ['@ruby:module_source:Walk'],
    ])('%s is one marker', (text) => {
        expect(rubyMarkersOf(text)).toEqual([text]);
    });

    test('a marker of program text after the explicit return', () => {
        expect(rubyMarkersOf('@ruby:syntax:return @ruby:return:foo,@ruby:symbol:a @ruby:x')).toEqual([
            '@ruby:syntax:return',
            '@ruby:return:foo',
            '@ruby:symbol:a @ruby:x',
        ]);
    });

    test('the markers that the converter adds after a marker of program text', () => {
        expect(rubyMarkersOf('@ruby:symbol:hello,@ruby:method:puts')).toEqual([
            '@ruby:symbol:hello',
            '@ruby:method:puts',
        ]);
        expect(rubyMarkersOf('@ruby:syntax:case:"a @ruby:b":1,@ruby:begin_loop_body')).toEqual([
            '@ruby:syntax:case:"a @ruby:b":1',
            '@ruby:begin_loop_body',
        ]);
    });

    test('a user comment before the case marker', () => {
        expect(rubyMarkersOf('前\n@ruby:syntax:case:"a @ruby:b":1')).toEqual(['@ruby:syntax:case:"a @ruby:b":1']);
    });
});

describe('rubyMarkerValueOf', () => {
    test('the value of a marker after the comment of the user', () => {
        expect(rubyMarkerValueOf('メモ\n@ruby:module_source:Walk', '@ruby:module_source:')).toBe('Walk');
        expect(rubyMarkerValueOf('メモ', '@ruby:module_source:')).toBeNull();
    });

    // The converter's markers come after the user's text, so the last one wins (review of #1857, FYI1).
    test('the last marker wins over a line of the user that starts with @ruby:', () => {
        const text = '@ruby:symbol:bye\n@ruby:comment_position:inline\n@ruby:symbol:hello';
        expect(rubyMarkerValueOf(text, '@ruby:symbol:')).toBe('hello');
    });
});
