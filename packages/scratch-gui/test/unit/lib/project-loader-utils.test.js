import { loadProjectWithChecks } from '../../../src/lib/project-loader-utils';
import { ProjectLoadError } from '../../../src/lib/url-loader';

const mockIntl = {
    formatMessage: (msg) => (msg && msg.defaultMessage) || '',
};

const PROJECT_DATA = '{"targets":[]}';
const PREVIOUS_JSON = '{"targets":["previous"]}';

/**
 * Build a minimal VM mock for loadProjectWithChecks.
 * @param {object} overrides - Methods to override on the mock.
 * @returns {object} The VM mock.
 */
const makeVm = (overrides = {}) => ({
    toJSON: jest.fn(() => PREVIOUS_JSON),
    hasMeshV1Project: jest.fn(() => Promise.resolve(false)),
    hasKoshienProject: jest.fn(() => Promise.resolve(false)),
    loadProject: jest.fn(() => Promise.resolve()),
    ...overrides,
});

describe('loadProjectWithChecks', () => {
    let originalAlert;

    beforeEach(() => {
        originalAlert = window.alert;
        window.alert = jest.fn();
    });

    afterEach(() => {
        window.alert = originalAlert;
    });

    test('successful load: snapshots the current project and loads the new one (no restore)', async () => {
        const vm = makeVm();

        await loadProjectWithChecks(vm, mockIntl, PROJECT_DATA, '2', jest.fn());

        expect(vm.toJSON).toHaveBeenCalledTimes(1);
        expect(vm.loadProject).toHaveBeenCalledTimes(1);
        expect(vm.loadProject).toHaveBeenCalledWith(PROJECT_DATA, { migrateMeshV1ToV2: false });
    });

    test('failed load: restores the previous project and rejects with ProjectLoadError', async () => {
        const loadErr = new Error('deserialize boom');
        const vm = makeVm({
            loadProject: jest
                .fn()
                .mockImplementationOnce(() => Promise.reject(loadErr)) // new project load fails
                .mockImplementationOnce(() => Promise.resolve()), // restore succeeds
        });

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA, '2', jest.fn())).rejects.toMatchObject({
            name: 'ProjectLoadError',
            cause: loadErr,
        });

        // First call loads the new project; second call restores the snapshot.
        expect(vm.loadProject).toHaveBeenCalledTimes(2);
        expect(vm.loadProject).toHaveBeenNthCalledWith(1, PROJECT_DATA, { migrateMeshV1ToV2: false });
        expect(vm.loadProject).toHaveBeenNthCalledWith(2, PREVIOUS_JSON);
    });

    test('rejects with a ProjectLoadError instance', async () => {
        const vm = makeVm({
            loadProject: jest
                .fn()
                .mockImplementationOnce(() => Promise.reject(new Error('boom')))
                .mockImplementationOnce(() => Promise.resolve()),
        });

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA, '2', jest.fn())).rejects.toBeInstanceOf(
            ProjectLoadError,
        );
    });

    test('failed load with no snapshot available: does not attempt restore', async () => {
        const vm = makeVm({
            toJSON: jest.fn(() => {
                throw new Error('cannot serialize');
            }),
            loadProject: jest.fn(() => Promise.reject(new Error('boom'))),
        });

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA, '2', jest.fn())).rejects.toMatchObject({
            name: 'ProjectLoadError',
        });

        // Only the failed new-project load; no restore call.
        expect(vm.loadProject).toHaveBeenCalledTimes(1);
    });

    test('restore also fails: still rejects with ProjectLoadError carrying the original cause', async () => {
        const loadErr = new Error('primary');
        const vm = makeVm({
            loadProject: jest
                .fn()
                .mockImplementationOnce(() => Promise.reject(loadErr)) // new load fails
                .mockImplementationOnce(() => Promise.reject(new Error('restore fail'))), // restore fails
        });

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA, '2', jest.fn())).rejects.toMatchObject({
            name: 'ProjectLoadError',
            cause: loadErr,
        });
        expect(vm.loadProject).toHaveBeenCalledTimes(2);
    });

    test('mesh v1 project: loads with migrateMeshV1ToV2 true', async () => {
        const vm = makeVm({ hasMeshV1Project: jest.fn(() => Promise.resolve(true)) });

        await loadProjectWithChecks(vm, mockIntl, PROJECT_DATA, '2', jest.fn());

        expect(vm.loadProject).toHaveBeenCalledWith(PROJECT_DATA, { migrateMeshV1ToV2: true });
    });

    test('koshien project: forces ruby version 1', async () => {
        const onSetRubyVersion = jest.fn();
        const vm = makeVm({ hasKoshienProject: jest.fn(() => Promise.resolve(true)) });

        await loadProjectWithChecks(vm, mockIntl, PROJECT_DATA, '2', onSetRubyVersion);

        expect(onSetRubyVersion).toHaveBeenCalledWith('1');
    });

    test('post-load check failure is not treated as a load failure (no restore, not ProjectLoadError)', async () => {
        const koshienErr = new Error('koshien detect boom');
        const vm = makeVm({
            hasKoshienProject: jest.fn(() => Promise.reject(koshienErr)),
        });

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA, '2', jest.fn())).rejects.toBe(koshienErr);
        // New project loaded successfully; no restore should be attempted.
        expect(vm.loadProject).toHaveBeenCalledTimes(1);
    });
});
