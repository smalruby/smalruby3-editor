import { rubyMarkersOf } from '../../../../src/lib/ruby-generator/ruby-markers';

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
});
