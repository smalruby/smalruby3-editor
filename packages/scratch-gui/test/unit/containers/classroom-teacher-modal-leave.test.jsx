/* eslint-env jest */
/**
 * 採点の画面から、確認なしに離れない (#1923 C4・レビュー M1)。
 *
 * - 退室依頼のトースト（モーダルより上）の「課題を開く」・メニューバーの先生メニューは、
 *   ナビゲーションの要求（teacherNavTarget）でモーダルの画面を移す。採点の画面にいるときは、
 *   要求は受け取って消し、移動は requestLeave に渡して先生の答えを待つ。
 * - ログアウト・お知らせも同じ。モーダルの［戻る］（✕・Esc）は聞かない: 閉じても先生の画面は
 *   隠して残る（#1990）ので、何も消えない。
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomTeacherModal from '../../../src/containers/classroom-teacher-modal.jsx';
import classroomReducer, {
    requestTeacherNavigation,
    setTeacherLastSelection,
} from '../../../src/reducers/classroom.js';

let mockSetPhase = null;
let mockTeacher = null;
let mockComponentProps = null;

jest.mock('../../../src/containers/use-teacher-classroom.js', () => ({
    __esModule: true,
    default: (args) => {
        mockSetPhase = args.setPhase;
        return mockTeacher;
    },
    getCachedTeacherIdToken: () => 'cached-token',
    setCachedTeacherIdToken: () => {},
}));

jest.mock('../../../src/containers/use-teacher-auth.js', () => ({
    getCachedTeacherAuthProvider: () => 'google',
}));

jest.mock('../../../src/lib/url-params.js', () => ({
    getUrlParams: () => ({ noBeforeUnload: true }),
}));

jest.mock('../../../src/components/classroom-teacher-modal/classroom-teacher-modal.jsx', () => ({
    __esModule: true,
    default: (props) => {
        mockComponentProps = props;
        return null;
    },
}));

const makeTeacher = () => ({
    idToken: 'cached-token',
    authProvider: 'google',
    setIdToken: jest.fn(),
    setAuthProvider: jest.fn(),
    groups: [{ groupId: 'g1', name: '技術' }],
    groupsLoaded: true,
    selectedClassroom: null,
    selectedGroup: null,
    notificationsCenter: { unreadCount: 0, handleShowAll: jest.fn(), handleOpenLink: jest.fn() },
    evaluation: { hasUnsavedWork: true, handleRequestLeave: jest.fn() },
    handleSelectGroup: jest.fn(),
    handleSelectClassroom: jest.fn(() => Promise.resolve()),
    handleSelectMember: jest.fn(),
    handleShowClassList: jest.fn(),
    handleTeacherLogout: jest.fn(),
});

const renderModal = () => {
    const store = createStore(
        combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer, vm: (s = null) => s }) }),
    );
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <ClassroomTeacherModal />
            </IntlProvider>
        </Provider>,
    );
    return store;
};

describe('ClassroomTeacherModal — leaving the grading screen (#1923)', () => {
    beforeEach(() => {
        mockTeacher = makeTeacher();
        mockComponentProps = null;
    });

    const openGrading = () => {
        act(() => mockSetPhase('teacher-evaluation'));
    };

    test('the kick toast / menu bar jump waits for the answer on the grading screen', async () => {
        const store = renderModal();
        openGrading();
        act(() => {
            store.dispatch(setTeacherLastSelection({ classroomId: 'c1', groupId: 'g1' }));
            store.dispatch(requestTeacherNavigation('current-assignment', 'seat-04'));
        });
        // The request is consumed, but nothing moved yet.
        expect(store.getState().scratchGui.classroom.teacherNavTarget).toBeNull();
        expect(mockTeacher.handleSelectClassroom).not.toHaveBeenCalled();
        expect(mockTeacher.evaluation.handleRequestLeave).toHaveBeenCalledTimes(1);
        const [action, kind] = mockTeacher.evaluation.handleRequestLeave.mock.calls[0];
        expect(kind).toBe('leave');
        // 「離れる」: the jump runs with the handlers of that time.
        await act(async () => {
            action();
        });
        expect(mockTeacher.handleSelectGroup).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }));
        expect(mockTeacher.handleSelectClassroom).toHaveBeenCalledWith('c1', { tab: 'members' });
        expect(mockTeacher.handleSelectMember).toHaveBeenCalledWith('seat-04');
    });

    test('outside the grading screen the jump runs at once', async () => {
        const store = renderModal();
        await act(async () => {
            store.dispatch(requestTeacherNavigation('class-list'));
        });
        expect(mockTeacher.evaluation.handleRequestLeave).not.toHaveBeenCalled();
        expect(mockTeacher.handleShowClassList).toHaveBeenCalledTimes(1);
    });

    test('logging out and the notifications ask on the grading screen', () => {
        renderModal();
        openGrading();
        act(() => mockComponentProps.containerProps.onTeacherLogout());
        act(() => mockComponentProps.containerProps.notificationsCenter.handleShowAll());
        expect(mockTeacher.evaluation.handleRequestLeave).toHaveBeenCalledTimes(2);
        expect(mockTeacher.handleTeacherLogout).not.toHaveBeenCalled();
        expect(mockTeacher.notificationsCenter.handleShowAll).not.toHaveBeenCalled();
    });

    test('closing the modal does not ask: the screen stays behind the editor (#1990)', () => {
        const store = renderModal();
        act(() => store.dispatch({ type: 'scratch-gui/classroom/OPEN_TEACHER_MODAL' }));
        openGrading();
        act(() => mockComponentProps.onClose());
        expect(mockTeacher.evaluation.handleRequestLeave).not.toHaveBeenCalled();
        expect(store.getState().scratchGui.classroom.teacherModalVisible).toBe(false);
    });
});
