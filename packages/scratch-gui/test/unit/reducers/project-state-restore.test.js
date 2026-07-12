// === Smalruby: This file is Smalruby-specific (restore project state after URL load failure, #972) ===
import projectStateReducer, {
    LoadingState,
    defaultProjectId,
    restoreProjectState,
} from '../../../src/reducers/project-state';

// Regression guard for #972: a failed Scratch-URL load must recover to a
// *showing* state that matches the VM (which loadProjectWithChecks restores to
// the previous project) and must never strand the editor in the fatal ERROR
// state ("初期画面に戻る"). restoreProjectState is the single, explicit action
// the URL loader dispatches on failure, so pinning its contract here keeps the
// symptom from silently regressing.
describe('projectStateReducer restoreProjectState (#972)', () => {
    test.each([
        LoadingState.FETCHING_WITH_ID,
        LoadingState.LOADING_VM_WITH_ID,
        LoadingState.SHOWING_WITH_ID,
        LoadingState.SHOWING_WITHOUT_ID,
    ])('restoreProjectState never results in ERROR (from %s)', (loadingState) => {
        const state = {loadingState, projectId: '999', error: null, projectData: null};
        const result = projectStateReducer(state, restoreProjectState('42'));
        expect(result.loadingState).not.toBe(LoadingState.ERROR);
    });

    test('restores a real previous id to SHOWING_WITH_ID with that id', () => {
        const state = {loadingState: LoadingState.FETCHING_WITH_ID, projectId: '999'};
        const result = projectStateReducer(state, restoreProjectState('42'));
        expect(result.loadingState).toBe(LoadingState.SHOWING_WITH_ID);
        // Not the failed target id ('999') — must match the restored VM project.
        expect(result.projectId).toBe('42');
    });

    test('restores a null previous id to SHOWING_WITHOUT_ID with the default id', () => {
        const state = {loadingState: LoadingState.FETCHING_WITH_ID, projectId: '999'};
        const result = projectStateReducer(state, restoreProjectState(null));
        expect(result.loadingState).toBe(LoadingState.SHOWING_WITHOUT_ID);
        expect(result.projectId).toBe(defaultProjectId);
    });

    test('restores the default previous id to SHOWING_WITHOUT_ID', () => {
        const state = {loadingState: LoadingState.FETCHING_WITH_ID, projectId: '999'};
        const result = projectStateReducer(state, restoreProjectState(defaultProjectId));
        expect(result.loadingState).toBe(LoadingState.SHOWING_WITHOUT_ID);
        expect(result.projectId).toBe(defaultProjectId);
    });
});
