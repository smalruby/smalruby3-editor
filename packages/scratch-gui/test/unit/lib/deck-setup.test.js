import { applyDeckSetup } from '../../../src/lib/deck-setup';
import { SET_DNCL_MODE } from '../../../src/reducers/dncl-mode';

const ACTIVATE_TAB = 'scratch-gui/navigation/ACTIVATE_TAB';
const SET_RUBY_VERSION = 'scratch-gui/settings/SET_RUBY_VERSION';
const RUBY_VERSION_KEY = 'smalruby:rubyVersion';

const BLOCKS_TAB_INDEX = 0;
const COSTUMES_TAB_INDEX = 1;
const SOUNDS_TAB_INDEX = 2;
const RUBY_TAB_INDEX = 3;

const FURIGANA_KEY = 'smalruby:furiganaEnabled';

const makeDispatch = () => {
    const calls = [];
    const dispatch = (action) => calls.push(action);
    dispatch.calls = calls;
    return dispatch;
};

const makeVM = ({ alreadyLoaded = [], failOn = [] } = {}) => {
    const loaded = new Set(alreadyLoaded);
    return {
        extensionManager: {
            isExtensionLoaded: (id) => loaded.has(id),
            loadExtensionURL: jest.fn(async (id) => {
                if (failOn.includes(id)) throw new Error(`load failed: ${id}`);
                loaded.add(id);
            }),
        },
        loaded,
    };
};

describe('applyDeckSetup', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('returns immediately for missing or non-object setup', async () => {
        const dispatch = makeDispatch();
        await applyDeckSetup(undefined, dispatch, makeVM());
        await applyDeckSetup(null, dispatch, makeVM());
        await applyDeckSetup('not-an-object', dispatch, makeVM());
        expect(dispatch.calls).toEqual([]);
    });

    test('dispatches activateTab for each supported tab name', async () => {
        const cases = [
            ['code', BLOCKS_TAB_INDEX],
            ['blocks', BLOCKS_TAB_INDEX],
            ['costumes', COSTUMES_TAB_INDEX],
            ['sounds', SOUNDS_TAB_INDEX],
            ['ruby', RUBY_TAB_INDEX],
        ];
        for (const [tab, expectedIndex] of cases) {
            const dispatch = makeDispatch();
            await applyDeckSetup({ tab }, dispatch, makeVM());
            expect(dispatch.calls).toContainEqual({
                type: ACTIVATE_TAB,
                activeTabIndex: expectedIndex,
            });
        }
    });

    test('ignores unknown tab names without dispatching', async () => {
        const dispatch = makeDispatch();
        await applyDeckSetup({ tab: 'unknown-tab' }, dispatch, makeVM());
        expect(dispatch.calls.filter((a) => a.type === ACTIVATE_TAB)).toEqual([]);
    });

    test('rubyMode dispatches setDnclMode and updates furigana localStorage', async () => {
        // dncl: SET_DNCL_MODE true, furigana=false
        let dispatch = makeDispatch();
        await applyDeckSetup({ rubyMode: 'dncl' }, dispatch, makeVM());
        expect(dispatch.calls).toContainEqual({
            type: SET_DNCL_MODE,
            dnclMode: true,
        });
        expect(window.localStorage.getItem(FURIGANA_KEY)).toBe('false');

        // furigana: SET_DNCL_MODE false, furigana=true
        dispatch = makeDispatch();
        window.localStorage.clear();
        await applyDeckSetup({ rubyMode: 'furigana' }, dispatch, makeVM());
        expect(dispatch.calls).toContainEqual({
            type: SET_DNCL_MODE,
            dnclMode: false,
        });
        expect(window.localStorage.getItem(FURIGANA_KEY)).toBe('true');

        // ruby: SET_DNCL_MODE false, furigana=false
        dispatch = makeDispatch();
        window.localStorage.clear();
        await applyDeckSetup({ rubyMode: 'ruby' }, dispatch, makeVM());
        expect(dispatch.calls).toContainEqual({
            type: SET_DNCL_MODE,
            dnclMode: false,
        });
        expect(window.localStorage.getItem(FURIGANA_KEY)).toBe('false');
    });

    test('invalid rubyMode value is ignored', async () => {
        const dispatch = makeDispatch();
        await applyDeckSetup({ rubyMode: 'bogus' }, dispatch, makeVM());
        expect(dispatch.calls.filter((a) => a.type === SET_DNCL_MODE)).toEqual([]);
    });

    test('rubyVersion (number) dispatches setRubyVersion and persists to localStorage', async () => {
        for (const [input, expected] of [
            [1, '1'],
            [2, '2'],
        ]) {
            const dispatch = makeDispatch();
            window.localStorage.clear();
            await applyDeckSetup({ rubyVersion: input }, dispatch, makeVM());
            expect(dispatch.calls).toContainEqual({
                type: SET_RUBY_VERSION,
                rubyVersion: expected,
            });
            expect(window.localStorage.getItem(RUBY_VERSION_KEY)).toBe(expected);
        }
    });

    test('rubyVersion (string) is accepted as well', async () => {
        const dispatch = makeDispatch();
        await applyDeckSetup({ rubyVersion: '1' }, dispatch, makeVM());
        expect(dispatch.calls).toContainEqual({
            type: SET_RUBY_VERSION,
            rubyVersion: '1',
        });
        expect(window.localStorage.getItem(RUBY_VERSION_KEY)).toBe('1');
    });

    test('invalid or omitted rubyVersion is ignored', async () => {
        for (const rubyVersion of [undefined, 3, 0, '9', 'bogus', null]) {
            const dispatch = makeDispatch();
            window.localStorage.clear();
            await applyDeckSetup({ rubyVersion }, dispatch, makeVM());
            expect(dispatch.calls.filter((a) => a.type === SET_RUBY_VERSION)).toEqual([]);
            expect(window.localStorage.getItem(RUBY_VERSION_KEY)).toBeNull();
        }
    });

    test('loads required extensions sequentially', async () => {
        const dispatch = makeDispatch();
        const vm = makeVM();
        await applyDeckSetup({ extensions: ['pen', 'microbitMore'] }, dispatch, vm);
        expect(vm.extensionManager.loadExtensionURL).toHaveBeenCalledWith('pen');
        expect(vm.extensionManager.loadExtensionURL).toHaveBeenCalledWith('microbitMore');
        expect(vm.extensionManager.loadExtensionURL).toHaveBeenCalledTimes(2);
    });

    test('skips already-loaded extensions (idempotent)', async () => {
        const dispatch = makeDispatch();
        const vm = makeVM({ alreadyLoaded: ['pen'] });
        await applyDeckSetup({ extensions: ['pen', 'microbitMore'] }, dispatch, vm);
        expect(vm.extensionManager.loadExtensionURL).toHaveBeenCalledWith('microbitMore');
        expect(vm.extensionManager.loadExtensionURL).not.toHaveBeenCalledWith('pen');
    });

    test('extension load failure is logged but not thrown', async () => {
        const dispatch = makeDispatch();
        const vm = makeVM({ failOn: ['broken'] });
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(applyDeckSetup({ extensions: ['broken', 'pen'] }, dispatch, vm)).resolves.toBeUndefined();
        // pen should still be loaded after broken fails
        expect(vm.extensionManager.loadExtensionURL).toHaveBeenCalledWith('pen');
        expect(consoleWarn).toHaveBeenCalled();
        consoleWarn.mockRestore();
    });

    test('combines tab + rubyMode + extensions in one call', async () => {
        const dispatch = makeDispatch();
        const vm = makeVM();
        await applyDeckSetup(
            {
                tab: 'ruby',
                rubyMode: 'dncl',
                extensions: ['pen'],
            },
            dispatch,
            vm,
        );
        expect(dispatch.calls).toContainEqual({
            type: ACTIVATE_TAB,
            activeTabIndex: RUBY_TAB_INDEX,
        });
        expect(dispatch.calls).toContainEqual({
            type: SET_DNCL_MODE,
            dnclMode: true,
        });
        expect(window.localStorage.getItem(FURIGANA_KEY)).toBe('false');
        expect(vm.extensionManager.loadExtensionURL).toHaveBeenCalledWith('pen');
    });

    test('missing vm with extensions does not throw', async () => {
        const dispatch = makeDispatch();
        await expect(applyDeckSetup({ extensions: ['pen'] }, dispatch, undefined)).resolves.toBeUndefined();
    });
});
