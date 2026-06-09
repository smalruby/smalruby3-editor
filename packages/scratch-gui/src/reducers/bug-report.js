/**
 * Redux reducer for the program bug report modal.
 *
 * Tracks whether the modal is open and which view is active: the report form
 * ('report') or the reporter's list of their own reports ('myReports').
 */

const SET_MODAL_VISIBLE = 'scratch-gui/bug-report/SET_MODAL_VISIBLE';
const SET_VIEW = 'scratch-gui/bug-report/SET_VIEW';

const VIEW_REPORT = 'report';
const VIEW_MY_REPORTS = 'myReports';

const initialState = {
    modalVisible: false,
    view: VIEW_REPORT,
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case SET_MODAL_VISIBLE:
            return Object.assign({}, state, {
                modalVisible: action.visible,
                // Reset to the report form whenever the modal is freshly opened.
                view: action.visible ? action.view || VIEW_REPORT : state.view,
            });
        case SET_VIEW:
            return Object.assign({}, state, { view: action.view });
        default:
            return state;
    }
};

const openBugReportModal = function (view = VIEW_REPORT) {
    return { type: SET_MODAL_VISIBLE, visible: true, view };
};

const closeBugReportModal = function () {
    return { type: SET_MODAL_VISIBLE, visible: false };
};

const setBugReportView = function (view) {
    return { type: SET_VIEW, view };
};

export {
    reducer as default,
    initialState,
    initialState as bugReportInitialState,
    openBugReportModal,
    closeBugReportModal,
    setBugReportView,
    VIEW_REPORT,
    VIEW_MY_REPORTS,
};
