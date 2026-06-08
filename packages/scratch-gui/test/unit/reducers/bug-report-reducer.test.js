import bugReportReducer, {
    initialState,
    openBugReportModal,
    closeBugReportModal,
    setBugReportView,
    VIEW_REPORT,
    VIEW_MY_REPORTS,
} from '../../../src/reducers/bug-report';

describe('bugReportReducer', () => {
    test('returns the initial state by default', () => {
        expect(bugReportReducer(undefined, { type: 'unknown' })).toEqual(initialState);
        expect(initialState.modalVisible).toBe(false);
        expect(initialState.view).toBe(VIEW_REPORT);
    });

    test('openBugReportModal opens to the report view by default', () => {
        const state = bugReportReducer(initialState, openBugReportModal());
        expect(state.modalVisible).toBe(true);
        expect(state.view).toBe(VIEW_REPORT);
    });

    test('openBugReportModal can open directly to my-reports', () => {
        const state = bugReportReducer(initialState, openBugReportModal(VIEW_MY_REPORTS));
        expect(state.modalVisible).toBe(true);
        expect(state.view).toBe(VIEW_MY_REPORTS);
    });

    test('closeBugReportModal hides the modal', () => {
        const open = bugReportReducer(initialState, openBugReportModal());
        const closed = bugReportReducer(open, closeBugReportModal());
        expect(closed.modalVisible).toBe(false);
    });

    test('setBugReportView switches the active view', () => {
        const state = bugReportReducer(initialState, setBugReportView(VIEW_MY_REPORTS));
        expect(state.view).toBe(VIEW_MY_REPORTS);
    });

    test('does not mutate the previous state', () => {
        const before = { ...initialState };
        bugReportReducer(initialState, openBugReportModal());
        expect(initialState).toEqual(before);
    });
});
