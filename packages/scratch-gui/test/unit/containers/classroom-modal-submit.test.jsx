/* eslint-env jest */
/**
 * メニューバーの「提出する」から開く提出確認のつなぎこみ (#1795)。
 * 見た目のコンポーネントはスタブにして、container が渡す props と dispatch だけを見る。
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomModal from '../../../src/containers/classroom-modal.jsx';

const mockVerifySession = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        verifySession: (...args) => mockVerifySession(...args),
        leaveClassroom: () => Promise.resolve(),
    },
}));

let mockProps = null;
jest.mock('../../../src/components/classroom-modal/classroom-modal.jsx', () => ({
    __esModule: true,
    default: (props) => {
        mockProps = props;
        return null;
    },
}));
jest.mock('../../../src/lib/ruby-to-blocks-converter-hoc.jsx', () => ({
    __esModule: true,
    default: (Component) => Component,
}));
jest.mock('../../../src/lib/url-params.js', () => ({
    getUrlParams: () => ({}),
    clearClasscode: () => {},
}));
jest.mock('../../../src/lib/analytics', () => ({ __esModule: true, default: { event: () => {} } }));
jest.mock('../../../src/lib/lessons/open-lessons-library.js', () => ({ openAssignmentLessonsLibrary: () => {} }));
jest.mock('../../../src/containers/use-kick-request-polling.js', () => ({ __esModule: true, default: () => {} }));
const mockSubmit = { isSubmitting: false, handleStartSubmit: jest.fn() };
jest.mock('../../../src/containers/use-student-submit.js', () => ({ __esModule: true, default: () => mockSubmit }));
jest.mock('../../../src/containers/use-student-assignment.js', () => ({
    __esModule: true,
    default: () => ({
        setHasAssignment: () => {},
        refreshContinueOptions: () => {},
        refreshLesson: () => Promise.resolve(),
    }),
}));

const mockStore = configureStore();

const renderModal = (classroom = {}) => {
    const store = mockStore({
        scratchGui: {
            classroom: { role: 'student', sessionToken: 's1', classroomId: 'c1', seatNumber: 3, ...classroom },
            vm: null,
            projectTitle: '',
            lessonMode: { progress: {} },
        },
    });
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <ClassroomModal />
            </IntlProvider>
        </Provider>,
    );
    return store;
};

const flush = () =>
    act(async () => {
        for (let i = 0; i < 6; i++) await Promise.resolve();
    });

const typesOf = (store) => store.getActions().map((a) => a.type);

describe('ClassroomModal container — submit from the menu bar (#1795)', () => {
    beforeEach(() => {
        mockProps = null;
        mockSubmit.isSubmitting = false;
        mockVerifySession.mockReset();
    });

    test('M1: the confirmation waits for the status check, then shows the normal confirmation', async () => {
        let answer;
        mockVerifySession.mockReturnValue(
            new Promise((resolve) => {
                answer = resolve;
            }),
        );
        renderModal();
        expect(mockProps.submitStatusChecking).toBe(true);
        expect(mockProps.isSubmitting).toBe(false);
        await act(async () => {
            answer({ valid: true, submission: { status: 'returned', submittedAt: 't', teacherComment: 'c' } });
        });
        await flush();
        expect(mockProps.submitStatusChecking).toBe(false);
        expect(mockProps.teacherComment).toBe('c');
    });

    test('Q2: a verify answer without a submission clears a stale status', async () => {
        mockVerifySession.mockResolvedValue({ valid: true, submission: null });
        const store = renderModal({ submissionStatus: 'submitted' });
        await flush();
        const action = store.getActions().find((a) => a.type === 'scratch-gui/classroom/SET_SUBMISSION_STATUS');
        expect(action).toMatchObject({ submissionStatus: null });
    });

    test('Q1: closing (×, overlay, Escape) is ignored while the submission is being sent', async () => {
        mockVerifySession.mockResolvedValue({ valid: true, submission: null });
        mockSubmit.isSubmitting = true;
        const store = renderModal();
        await flush();
        act(() => mockProps.onClose());
        expect(typesOf(store)).not.toContain('scratch-gui/classroom/CLOSE_MODAL');
        expect(mockProps.isSubmitting).toBe(true);
    });

    test('Q1: closing works again once the submission is not being sent', async () => {
        mockVerifySession.mockResolvedValue({ valid: true, submission: null });
        const store = renderModal();
        await flush();
        act(() => mockProps.onClose());
        expect(typesOf(store)).toContain('scratch-gui/classroom/CLOSE_MODAL');
    });
});
