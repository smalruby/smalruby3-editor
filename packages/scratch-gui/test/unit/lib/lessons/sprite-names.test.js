/**
 * sprite-names: コースのキャラクター（Shimaraby / Shimacat）の名前を言語ごとに変える。
 */
import {
    LOCALIZED_SPRITE_NAMES,
    isSpriteNamed,
    localSpriteName,
    localizeLibrarySprites,
    spriteNameAliases,
} from '../../../../src/lib/lessons/sprite-names';
import spriteLibraryContent from '../../../../src/lib/libraries/sprites.json';

describe('sprite-names', () => {
    test('the characters are シマラビ and シマネコ in ja / ja-Hira and keep the library name in en', () => {
        expect(localSpriteName('Shimaraby', 'ja')).toBe('シマラビ');
        expect(localSpriteName('Shimaraby', 'ja-Hira')).toBe('シマラビ');
        expect(localSpriteName('Shimaraby', 'en')).toBe('Shimaraby');
        expect(localSpriteName('Shimacat', 'ja')).toBe('シマネコ');
        expect(localSpriteName('Shimacat', 'ja-Hira')).toBe('シマネコ');
        expect(localSpriteName('Shimacat', 'en')).toBe('Shimacat');
    });

    test('other locales and other sprites keep the library name', () => {
        expect(localSpriteName('Shimaraby', 'zh-cn')).toBe('Shimaraby');
        expect(localSpriteName('Shimaraby', null)).toBe('Shimaraby');
        expect(localSpriteName('Penguin', 'ja')).toBe('Penguin');
        expect(localSpriteName('constructor', 'ja')).toBe('constructor');
    });

    test('a sprite is found by the name of any locale', () => {
        expect(spriteNameAliases('Shimaraby')).toEqual(['Shimaraby', 'シマラビ']);
        expect(isSpriteNamed('シマラビ', 'Shimaraby')).toBe(true);
        expect(isSpriteNamed('Shimaraby', 'Shimaraby')).toBe(true);
        expect(isSpriteNamed('シマネコ', 'Shimaraby')).toBe(false);
        expect(isSpriteNamed('Penguin', 'Penguin')).toBe(true);
        expect(isSpriteNamed('ペンギン', 'Penguin')).toBe(false);
    });

    test('every character is in the real library', () => {
        Object.keys(LOCALIZED_SPRITE_NAMES).forEach((name) =>
            expect({ name, inLibrary: spriteLibraryContent.some((s) => s.name === name) }).toEqual({
                name,
                inLibrary: true,
            }),
        );
    });

    test('the library of "Choose a Sprite" shows the names of the locale without changing the library', () => {
        const library = [{ name: 'Shimaraby', tags: ['animals'] }, { name: 'Penguin' }, { rawURL: 'x' }];
        const localized = localizeLibrarySprites(library, 'ja');
        expect(localized.map((item) => item.name)).toEqual(['シマラビ', 'Penguin', undefined]);
        expect(localized[0].tags).toEqual(['animals']);
        expect(localized[1]).toBe(library[1]);
        expect(library[0].name).toBe('Shimaraby');
    });
});
