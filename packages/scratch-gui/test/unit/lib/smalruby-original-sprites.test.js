/**
 * Verifies that Smalruby's original sprites/costumes (Shimaraby, Shimacat) are
 * present in the sprite/costume libraries. Regression guard for issue #688:
 * upstream merges silently overwrite these libraries and wipe the entries.
 */
import costumeLibraryContent from '../../../src/lib/libraries/costumes.json';
import spriteLibraryContent from '../../../src/lib/libraries/sprites.json';

const requiredSprites = ['Shimaraby', 'Shimacat'];
const requiredCostumes = ['Shimaraby-a', 'Shimaraby-b', 'Shimacat-a', 'Shimacat-b'];

describe('Smalruby original sprites/costumes', () => {
    test('sprite library contains Shimaraby and Shimacat', () => {
        const spriteNames = spriteLibraryContent.map((sprite) => sprite.name);
        for (const name of requiredSprites) {
            expect(spriteNames).toContain(name);
        }
    });

    test('costume library contains Shimaraby-a/b and Shimacat-a/b', () => {
        const costumeNames = costumeLibraryContent.map((costume) => costume.name);
        for (const name of requiredCostumes) {
            expect(costumeNames).toContain(name);
        }
    });

    test('Shimaraby/Shimacat sprite costumes reference smalruby-assets PNGs', () => {
        const expectedRawURLs = {
            Shimaraby: [
                'static/smalruby-assets/ddaccfcda466a4887299feddc899fea7.png',
                'static/smalruby-assets/bd0ff11c925936ed5e0363112103cd0b.png',
            ],
            Shimacat: [
                'static/smalruby-assets/851e679b8f113ee90e0d686c33fbc940.png',
                'static/smalruby-assets/57613248603bb9c5b4b767b72cd4fdef.png',
            ],
        };
        for (const spriteName of requiredSprites) {
            const sprite = spriteLibraryContent.find((s) => s.name === spriteName);
            expect(sprite).toBeDefined();
            const rawURLs = sprite.costumes.map((c) => c.rawURL);
            expect(rawURLs).toEqual(expectedRawURLs[spriteName]);
        }
    });
});
