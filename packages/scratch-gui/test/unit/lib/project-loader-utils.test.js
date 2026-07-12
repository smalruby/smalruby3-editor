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

        await loadProjectWithChecks(vm, mockIntl, PROJECT_DATA);

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

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA)).rejects.toMatchObject({
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

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA)).rejects.toBeInstanceOf(ProjectLoadError);
    });

    test('failed load with no snapshot available: does not attempt restore', async () => {
        const vm = makeVm({
            toJSON: jest.fn(() => {
                throw new Error('cannot serialize');
            }),
            loadProject: jest.fn(() => Promise.reject(new Error('boom'))),
        });

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA)).rejects.toMatchObject({
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

        await expect(loadProjectWithChecks(vm, mockIntl, PROJECT_DATA)).rejects.toMatchObject({
            name: 'ProjectLoadError',
            cause: loadErr,
        });
        expect(vm.loadProject).toHaveBeenCalledTimes(2);
    });

    test('mesh v1 project: loads with migrateMeshV1ToV2 true', async () => {
        const vm = makeVm({ hasMeshV1Project: jest.fn(() => Promise.resolve(true)) });

        await loadProjectWithChecks(vm, mockIntl, PROJECT_DATA);

        expect(vm.loadProject).toHaveBeenCalledWith(PROJECT_DATA, { migrateMeshV1ToV2: true });
    });

    test('koshien project: does not alert and does not force the Ruby version', async () => {
        // A koshien project must load like any other: no Koshien detection, no
        // alert, and no forced downgrade to Ruby version 1 (v1 and v2 both work,
        // and v2 is the correct default).
        const hasKoshienProject = jest.fn(() => Promise.resolve(true));
        const vm = makeVm({ hasKoshienProject });

        await loadProjectWithChecks(vm, mockIntl, PROJECT_DATA);

        expect(hasKoshienProject).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
        expect(vm.loadProject).toHaveBeenCalledTimes(1);
    });
});
