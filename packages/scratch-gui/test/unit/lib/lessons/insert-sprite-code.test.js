/**
 * insertSpriteCodes: 「プログラムを入れる」で、名前で決めたスプライト（チャレンジ 9 のペンギン）に
 * プログラムを入れる。いなければライブラリから足し、残りのスプライト（ネコ）を返す。
 */
import { findSpriteByName, insertSpriteCodes } from '../../../../src/lib/lessons/insert-sprite-code';

const sprite = (id, name) => ({ id, isOriginal: true, isStage: false, getName: () => name });
const stage = { id: 'stage', isOriginal: true, isStage: true, getName: () => 'Stage' };

const makeVm = (targets) => {
    const vm = {
        runtime: { targets: [...targets] },
        addSprite: jest.fn((json) => {
            const item = JSON.parse(json);
            vm.runtime.targets.push(sprite(`added-${item.name}`, item.name));
            return Promise.resolve();
        }),
    };
    return vm;
};

const makeToBlocks = (result = true) => {
    const applied = [];
    const toBlocks = jest.fn((target, code) =>
        Promise.resolve({
            result,
            errors: result ? [] : [{ text: 'x' }],
            apply: () => {
                applied.push({ id: target.id, code });
                return Promise.resolve();
            },
        }),
    );
    return { toBlocks, applied };
};

const PENGUIN_CODE = 'when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n';

describe('insertSpriteCodes', () => {
    test('puts the code into the sprite with that name and returns the other sprite', async () => {
        const cat = sprite('cat', 'Sprite1');
        const penguin = sprite('penguin', 'Penguin');
        const vm = makeVm([stage, cat, penguin]);
        const { toBlocks, applied } = makeToBlocks();
        const rest = await insertSpriteCodes(vm, [{ sprite: 'Penguin', code: PENGUIN_CODE }], { toBlocks });
        expect(applied).toEqual([{ id: 'penguin', code: PENGUIN_CODE }]);
        expect(vm.addSprite).not.toHaveBeenCalled();
        expect(rest).toBe(cat);
    });

    test('adds the sprite from the library at a fixed place away from the cat when it is missing', async () => {
        const cat = sprite('cat', 'Sprite1');
        const vm = makeVm([stage, cat]);
        const { toBlocks, applied } = makeToBlocks();
        const library = [{ name: 'Apple' }, { name: 'Penguin', costumes: [] }];
        const rest = await insertSpriteCodes(vm, [{ sprite: 'Penguin', code: PENGUIN_CODE }], { toBlocks, library });
        expect(vm.addSprite).toHaveBeenCalledTimes(1);
        expect(JSON.parse(vm.addSprite.mock.calls[0][0])).toEqual({ name: 'Penguin', costumes: [], x: 150, y: 0 });
        // ライブラリの項目そのものは変えない
        expect(library[1]).toEqual({ name: 'Penguin', costumes: [] });
        expect(applied).toEqual([{ id: 'added-Penguin', code: PENGUIN_CODE }]);
        expect(rest).toBe(cat);
    });

    test('the real library has the penguin of the "use two sprites" tutorial', () => {
        // eslint-disable-next-line global-require
        const library = require('../../../../src/lib/libraries/sprites.json');
        expect(library.some((s) => s.name === 'Penguin')).toBe(true);
    });

    test('skips a sprite that is not in the library, and does not apply code that did not convert', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const cat = sprite('cat', 'Sprite1');
        const vm = makeVm([stage, cat]);
        const { toBlocks, applied } = makeToBlocks(false);
        const rest = await insertSpriteCodes(
            vm,
            [
                { sprite: 'Nobody', code: '' },
                { sprite: 'Sprite1', code: 'x' },
            ],
            { toBlocks, library: [] },
        );
        expect(toBlocks).toHaveBeenCalledTimes(1);
        expect(applied).toEqual([]);
        // ネコも spriteCodes に入っているので、残りのスプライトは無い
        expect(rest).toBeNull();
        console.warn.mockRestore();
    });

    test('findSpriteByName ignores the stage and clones', () => {
        const clone = { ...sprite('clone', 'Penguin'), isOriginal: false };
        const vm = makeVm([stage, clone]);
        expect(findSpriteByName(vm, 'Penguin')).toBeNull();
        expect(findSpriteByName(vm, 'Stage')).toBeNull();
    });
});
