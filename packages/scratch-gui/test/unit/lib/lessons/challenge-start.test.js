/**
 * applyChallengeStart: チャレンジを始めるときに、ネコをライブラリのスプライトに置きかえ
 * （`setup.sprites`）、前の段の答え（`setup.code` / `spriteCodes` / `stageCode`）を入れる。
 */
import {
    applyChallengeStart,
    applyStartLists,
    applyWarpProcedures,
    hasChallengeStart,
    replaceStartSprites,
} from '../../../../src/lib/lessons/challenge-start';

const sprite = (id, name, x = 0, y = 0) => ({ id, isOriginal: true, isStage: false, x, y, getName: () => name });
const stageTarget = () => ({ id: 'stage', isOriginal: true, isStage: true, getName: () => 'Stage' });

const LIBRARY = [{ name: 'Shimaraby', costumes: [] }, { name: 'Shimacat', costumes: [] }, { name: 'Penguin' }];

const makeVm = (targets) => {
    const vm = {
        editingTarget: targets.find((t) => !t.isStage) || null,
        runtime: {
            targets: [...targets],
            getTargetForStage: () => vm.runtime.targets.find((t) => t.isStage),
        },
        addSprite: jest.fn((json) => {
            const item = JSON.parse(json);
            vm.runtime.targets.push(sprite(`added-${item.name}`, item.name, item.x, item.y));
            return Promise.resolve();
        }),
        deleteSprite: jest.fn((id) => {
            vm.runtime.targets = vm.runtime.targets.filter((t) => t.id !== id);
        }),
        setEditingTarget: jest.fn((id) => {
            vm.editingTarget = vm.runtime.targets.find((t) => t.id === id);
        }),
    };
    return vm;
};

const makeToBlocks = (failFor = null) => {
    const applied = [];
    const toBlocks = jest.fn((target, code) =>
        Promise.resolve({
            result: code !== failFor,
            errors: code === failFor ? [{ text: 'x' }] : [],
            apply: () => {
                applied.push({ id: target.id, code });
                return Promise.resolve();
            },
        }),
    );
    return { toBlocks, applied };
};

const names = (vm) => vm.runtime.targets.filter((t) => !t.isStage).map((t) => t.getName());

describe('hasChallengeStart', () => {
    test('is true only when the setup changes the project', () => {
        expect(hasChallengeStart(null)).toBe(false);
        expect(hasChallengeStart({ tab: 'code', extensions: ['meshV2'] })).toBe(false);
        expect(hasChallengeStart({ sprites: [] })).toBe(false);
        expect(hasChallengeStart({ sprites: ['Shimaraby'] })).toBe(true);
        expect(hasChallengeStart({ code: 'x' })).toBe(true);
        expect(hasChallengeStart({ stageCode: { ja: 'x' } })).toBe(true);
        expect(hasChallengeStart({ spriteCodes: [{ sprite: 'Shimacat', code: 'x' }] })).toBe(true);
    });
});

describe('replaceStartSprites', () => {
    test('replaces the cat with the library sprites: the first where the cat was, the next to the right', async () => {
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1', 0, 0)]);
        const added = await replaceStartSprites(vm, ['Shimaraby', 'Shimacat'], { library: LIBRARY });
        expect(added.map((t) => t.getName())).toEqual(['Shimaraby', 'Shimacat']);
        expect(names(vm)).toEqual(['Shimaraby', 'Shimacat']);
        expect(vm.deleteSprite).toHaveBeenCalledWith('cat');
        expect(JSON.parse(vm.addSprite.mock.calls[0][0])).toMatchObject({ name: 'Shimaraby', x: 0, y: 0 });
        // 「プログラムを入れる」で足すときと同じ、ネコと重ならない右の場所
        expect(JSON.parse(vm.addSprite.mock.calls[1][0])).toMatchObject({ name: 'Shimacat', x: 150, y: 0 });
        expect(vm.editingTarget.getName()).toBe('Shimaraby');
        // ライブラリの項目そのものは変えない
        expect(LIBRARY[0]).toEqual({ name: 'Shimaraby', costumes: [] });
    });

    test('keeps the cat when none of the sprites is in the library', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
        const added = await replaceStartSprites(vm, ['Nobody'], { library: LIBRARY });
        expect(added).toEqual([]);
        expect(names(vm)).toEqual(['Sprite1']);
        expect(vm.deleteSprite).not.toHaveBeenCalled();
        console.warn.mockRestore();
    });

    test('skips only the sprites missing from the library', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1', 10, 20)]);
        const added = await replaceStartSprites(vm, ['Nobody', 'Shimacat'], { library: LIBRARY });
        expect(added.map((t) => t.getName())).toEqual(['Shimacat']);
        // 足せた 1 つめがネコの場所に入る
        expect(JSON.parse(vm.addSprite.mock.calls[0][0])).toMatchObject({ name: 'Shimacat', x: 10, y: 20 });
        expect(names(vm)).toEqual(['Shimacat']);
        console.warn.mockRestore();
    });

    test('a sprite that fails to be added is skipped and the next one still goes in', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
        const addSprite = vm.addSprite;
        vm.addSprite = jest.fn((json) =>
            JSON.parse(json).name === 'Shimaraby' ? Promise.reject(new Error('boom')) : addSprite(json),
        );
        const added = await replaceStartSprites(vm, ['Shimaraby', 'Shimacat'], { library: LIBRARY });
        expect(added.map((t) => t.getName())).toEqual(['Shimacat']);
        expect(vm.editingTarget.getName()).toBe('Shimacat');
        console.warn.mockRestore();
    });

    test('takes the added sprite by what is new, even when a sprite of the same name was there', async () => {
        const old = sprite('old', 'Shimaraby');
        const vm = makeVm([stageTarget(), old]);
        const addSprite = vm.addSprite;
        // VM は同じ名前のスプライトを足すと名前を変える
        vm.addSprite = jest.fn((json) => addSprite(JSON.stringify({ ...JSON.parse(json), name: 'Shimaraby2' })));
        const added = await replaceStartSprites(vm, ['Shimaraby'], { library: LIBRARY });
        expect(added.map((t) => t.id)).toEqual(['added-Shimaraby2']);
        expect(vm.deleteSprite).toHaveBeenCalledWith('old');
    });

    test('the real library has Shimaraby and Shimacat', () => {
        // eslint-disable-next-line global-require
        const library = require('../../../../src/lib/libraries/sprites.json');
        expect(library.some((s) => s.name === 'Shimaraby')).toBe(true);
        expect(library.some((s) => s.name === 'Shimacat')).toBe(true);
    });
});

describe('applyChallengeStart', () => {
    test('does nothing for a setup that does not change the project', async () => {
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
        const { toBlocks } = makeToBlocks();
        expect(await applyChallengeStart(vm, { tab: 'code' }, { toBlocks, locale: 'ja', library: LIBRARY })).toBe(
            false,
        );
        expect(vm.addSprite).not.toHaveBeenCalled();
        expect(toBlocks).not.toHaveBeenCalled();
    });

    test('puts the answer of the previous step into the replaced sprites and the stage', async () => {
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
        const { toBlocks, applied } = makeToBlocks();
        await applyChallengeStart(
            vm,
            {
                sprites: ['Shimaraby', 'Shimacat'],
                code: { ja: 'shimaraby-ja', en: 'shimaraby-en' },
                spriteCodes: [{ sprite: 'Shimacat', code: { ja: 'shimacat-ja', en: 'shimacat-en' } }],
                stageCode: 'stage-code',
            },
            { toBlocks, locale: 'ja', library: LIBRARY },
        );
        // 日本語では、キャラクターは日本語の名前で足す（sprite-names.js）。名前が変わっても同じスプライトに入る
        expect(applied).toEqual([
            { id: 'stage', code: 'stage-code' },
            { id: 'added-シマネコ', code: 'shimacat-ja' },
            { id: 'added-シマラビ', code: 'shimaraby-ja' },
        ]);
        // 子どもが続きを作るのは 1 つめのスプライト
        expect(vm.editingTarget.getName()).toBe('シマラビ');
    });

    test('the characters get the name of the locale (ja-Hira: シマラビ, en: Shimaraby)', async () => {
        const run = async (locale) => {
            const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
            const { toBlocks } = makeToBlocks();
            await applyChallengeStart(
                vm,
                { sprites: ['Shimaraby', 'Shimacat'], code: 'ok' },
                { toBlocks, locale, library: LIBRARY },
            );
            return names(vm);
        };
        expect(await run('ja-Hira')).toEqual(['シマラビ', 'シマネコ']);
        expect(await run('en')).toEqual(['Shimaraby', 'Shimacat']);
        // 名前を決めていない言語はライブラリの名前のまま
        expect(await run('zh-cn')).toEqual(['Shimaraby', 'Shimacat']);
    });

    test('a project made in Japanese still gets the code in English (the names of every locale match)', async () => {
        const vm = makeVm([stageTarget(), sprite('r', 'シマラビ'), sprite('c', 'シマネコ')]);
        const { toBlocks, applied } = makeToBlocks();
        await applyChallengeStart(
            vm,
            { spriteCodes: [{ sprite: 'Shimacat', code: 'shimacat-en' }], code: 'shimaraby-en' },
            { toBlocks, locale: 'en', library: LIBRARY },
        );
        expect(vm.addSprite).not.toHaveBeenCalled();
        expect(applied).toEqual([
            { id: 'c', code: 'shimacat-en' },
            { id: 'r', code: 'shimaraby-en' },
        ]);
    });

    test('without sprites the code goes into the sprite being edited (the cat)', async () => {
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
        const { toBlocks, applied } = makeToBlocks();
        expect(
            await applyChallengeStart(vm, { code: 'cat-code' }, { toBlocks, locale: 'en', library: LIBRARY }),
        ).toBe(true);
        expect(applied).toEqual([{ id: 'cat', code: 'cat-code' }]);
        expect(vm.addSprite).not.toHaveBeenCalled();
    });

    test('a program that throws is skipped and the rest still happens', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
        const { toBlocks: ok, applied } = makeToBlocks();
        const toBlocks = jest.fn((target, code) =>
            code === 'boom' ? Promise.reject(new Error('x')) : ok(target, code),
        );
        const changed = await applyChallengeStart(
            vm,
            {
                sprites: ['Shimaraby', 'Shimacat'],
                stageCode: 'boom',
                spriteCodes: [{ sprite: 'Shimacat', code: 'boom' }],
                code: 'ok',
            },
            { toBlocks, locale: 'ja', library: LIBRARY },
        );
        expect(changed).toBe(true);
        expect(applied).toEqual([{ id: 'added-シマラビ', code: 'ok' }]);
        expect(vm.editingTarget.getName()).toBe('シマラビ');
        console.warn.mockRestore();
    });

    test('stops when the challenge or the project changes on the way', async () => {
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
        const { toBlocks, applied } = makeToBlocks();
        let current = true;
        // 1 つめのスプライトを足したところで、ほかの作品に変わった
        const addSprite = vm.addSprite;
        vm.addSprite = jest.fn((json) => {
            current = false;
            return addSprite(json);
        });
        const changed = await applyChallengeStart(
            vm,
            { sprites: ['Shimaraby', 'Shimacat'], code: 'ok', stageCode: 'stage' },
            { toBlocks, locale: 'ja', library: LIBRARY, isCurrent: () => current },
        );
        expect(changed).toBe(false);
        expect(vm.addSprite).toHaveBeenCalledTimes(1);
        // ネコも消さず、プログラムも入れない
        expect(vm.deleteSprite).not.toHaveBeenCalled();
        expect(applied).toEqual([]);
    });

    test('a program that does not convert is skipped and the others still go in', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const vm = makeVm([stageTarget(), sprite('cat', 'Sprite1')]);
        const { toBlocks, applied } = makeToBlocks('broken');
        await applyChallengeStart(
            vm,
            { sprites: ['Shimaraby'], code: 'ok', stageCode: 'broken' },
            { toBlocks, locale: 'ja', library: LIBRARY },
        );
        expect(applied).toEqual([{ id: 'added-シマラビ', code: 'ok' }]);
        console.warn.mockRestore();
    });
});

// リスト・定義ブロックを持てるターゲット（Target の lookupVariableByNameAndType / createVariable の形）
const withData = (target, blocks = {}) => {
    target.variables = {};
    target.lookupVariableByNameAndType = (name, type) =>
        Object.values(target.variables).find((v) => v.name === name && v.type === type);
    target.createVariable = (id, name, type) => {
        target.variables[id] = { id, name, type, value: [] };
    };
    target.blocks = { _blocks: blocks, resetCache: jest.fn() };
    return target;
};

const monitorBlocks = () => {
    const blocks = {};
    return {
        blocks,
        getBlock: (id) => blocks[id],
        createBlock: jest.fn((block) => {
            blocks[block.id] = block;
        }),
        changeBlock: jest.fn(),
    };
};

describe('applyStartLists', () => {
    test('fills the list of the sprite (or the stage), creating it when missing', () => {
        const cat = withData(sprite('cat', 'Sprite1'));
        const stage = withData(stageTarget());
        cat.createVariable('l1', '教科書', 'list');
        const vm = makeVm([stage, cat]);
        applyStartLists(
            vm,
            [
                { name: { ja: '教科書', en: 'textbook' }, items: { ja: ['こんにちは。'], en: ['hello.'] } },
                { name: 'まえ', items: [], stage: true },
            ],
            cat,
            'ja',
        );
        expect(Object.values(cat.variables)).toEqual([
            expect.objectContaining({ id: 'l1', name: '教科書', value: ['こんにちは。'] }),
        ]);
        expect(Object.values(stage.variables)).toEqual([expect.objectContaining({ name: 'まえ', value: [] })]);
    });

    test('uses the locale (en, then ja when missing) and skips broken entries', () => {
        const cat = withData(sprite('cat', 'Sprite1'));
        const vm = makeVm([withData(stageTarget()), cat]);
        applyStartLists(
            vm,
            [{ name: { ja: '教科書', en: 'textbook' }, items: { ja: ['あ。'], en: ['a.'] } }, { name: 'x' }, null],
            cat,
            'ja-Hira',
        );
        expect(Object.values(cat.variables)).toEqual([expect.objectContaining({ name: 'textbook', value: ['a.'] })]);
    });

    test('shows the monitor of the list when asked', () => {
        const cat = withData(sprite('cat', 'Sprite1'));
        const vm = makeVm([withData(stageTarget()), cat]);
        vm.runtime.monitorBlocks = monitorBlocks();
        applyStartLists(vm, [{ name: 'まえ', items: ['こ'], monitor: true }], cat, 'ja');
        const list = Object.values(cat.variables)[0];
        expect(vm.runtime.monitorBlocks.createBlock).toHaveBeenCalledWith(
            expect.objectContaining({ id: list.id, opcode: 'data_listcontents', targetId: 'cat' }),
        );
        expect(vm.runtime.monitorBlocks.changeBlock).toHaveBeenCalledWith(
            { id: list.id, element: 'checkbox', value: true },
            vm.runtime,
        );
    });
});

describe('applyWarpProcedures', () => {
    const proc = (opcode, proccode) => ({ opcode, mutation: { proccode, warp: 'false' } });

    test('sets "run without screen refresh" on the named custom blocks only', () => {
        const blocks = {
            a: proc('procedures_prototype', '学習する'),
            b: proc('procedures_call', '学習する'),
            c: proc('procedures_prototype', 'ほか %s'),
            d: proc('procedures_prototype', '文字をえらぶ %s'),
        };
        const cat = withData(sprite('cat', 'Sprite1'), blocks);
        const vm = makeVm([withData(stageTarget()), cat]);
        expect(applyWarpProcedures(vm, ['学習する', '文字をえらぶ', 'learn'])).toBe(2);
        expect([blocks.a, blocks.b, blocks.c, blocks.d].map((b) => b.mutation.warp)).toEqual([
            'true',
            'true',
            'false',
            'true',
        ]);
        expect(cat.blocks.resetCache).toHaveBeenCalled();
        expect(applyWarpProcedures(vm, [])).toBe(0);
    });
});

describe('applyChallengeStart with lists and custom blocks', () => {
    test('puts the lists into the sprite of the code after the code, and sets warp', async () => {
        const blocks = { p: { opcode: 'procedures_prototype', mutation: { proccode: '学習する', warp: 'false' } } };
        const cat = withData(sprite('cat', 'Sprite1'), blocks);
        const vm = makeVm([withData(stageTarget()), cat]);
        const { toBlocks, applied } = makeToBlocks();
        const setup = {
            code: 'ai-code',
            lists: [{ name: '教科書', items: ['こんにちは、今日はよろしく。'] }],
            warpProcedures: ['学習する'],
        };
        expect(hasChallengeStart({ lists: setup.lists })).toBe(true);
        expect(await applyChallengeStart(vm, setup, { toBlocks, locale: 'ja', library: LIBRARY })).toBe(true);
        expect(applied).toEqual([{ id: 'cat', code: 'ai-code' }]);
        expect(Object.values(cat.variables)[0].value).toEqual(['こんにちは、今日はよろしく。']);
        expect(blocks.p.mutation.warp).toBe('true');
    });
});
