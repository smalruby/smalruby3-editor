/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import LessonProgressSync from '../../../src/containers/lesson-progress-sync.jsx';
import classroomAPI from '../../../src/lib/classroom-api.js';
import { normalizeAssignmentLesson } from '../../../src/lib/lessons/assignment-progress';
import { LESSON_PROGRESS_STORAGE_KEY, loadProgress } from '../../../src/lib/lessons/lesson-progress';
import { LESSON_PROGRESS_CONSENT_STORAGE_KEY } from '../../../src/lib/lessons/lesson-progress-sync';
import lessonModeReducer, {
    closeLesson,
    lessonModeInitialState,
    markChallengeCompleted,
    openChallenge,
    requestProgressSend,
} from '../../../src/reducers/lesson-mode';

jest.mock('../../../src/containers/modal.jsx', () => {
    const FakeModal = ({ children }) => <div data-testid="fake-modal">{children}</div>;
    return FakeModal;
});

jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: { putLessonProgress: jest.fn() },
}));

const A = 'blocks-l1-key-sound';
const B = 'blocks-l1-arrow-move';
const OUTSIDE = 'blocks-l1-click-say';
const T1 = '2026-11-01T01:00:00.000Z';
const JOINED_AT = '2026-11-15T00:00:00.000Z';
const KEY = `class-1#3#j${JOINED_AT}`;
const C = 'blocks-l1-click-say';
// 答えたあとにできた記録（答えた日時は実際の時計なので、テストの日付に依らないよう今より後にする）
const LATER = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const LATER2 = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

const lesson = normalizeAssignmentLesson({ courseId: 'kyou-kara-programmer', challengeIds: [A, B] });

const student = (overrides = {}) => ({
    role: 'student',
    sessionToken: 'token-1',
    classroomId: 'class-1',
    seatNumber: 3,
    joinedAt: JOINED_AT,
    studentLesson: lesson,
    ...overrides,
});

const SET_CLASSROOM = 'test/SET_CLASSROOM';
const classroomReducer = (state = student(), action) => (action.type === SET_CLASSROOM ? action.classroom : state);

const storeWith = (classroom) => {
    const store = createStore(
        combineReducers({
            scratchGui: combineReducers({ classroom: classroomReducer, lessonMode: lessonModeReducer }),
        }),
        { scratchGui: { classroom, lessonMode: { ...lessonModeInitialState, progress: loadProgress() } } },
    );
    return store;
};

const saveDeviceRecords = (ids) => {
    const challenges = Object.fromEntries(
        ids.map((id) => [id, { completedAt: T1, courseId: 'kyou-kara-programmer', lessonId: 'blocks-l1' }]),
    );
    window.localStorage.setItem(LESSON_PROGRESS_STORAGE_KEY, JSON.stringify({ version: 1, challenges }));
};

const renderSync = (classroom = student()) => {
    const store = storeWith(classroom);
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <LessonProgressSync />
            </IntlProvider>
        </Provider>,
    );
    return store;
};

const flush = () => act(() => Promise.resolve());

describe('LessonProgressSync', () => {
    beforeEach(() => {
        window.localStorage.clear();
        classroomAPI.putLessonProgress.mockReset();
        classroomAPI.putLessonProgress.mockResolvedValue({});
    });

    test('should not ask and send an empty record when the device has no records', async () => {
        renderSync();
        await flush();
        expect(screen.queryByTestId('lesson-progress-confirm')).toBeNull();
        expect(classroomAPI.putLessonProgress).toHaveBeenCalledWith('token-1', 'class-1', { challenges: {} });
    });

    test('should send nothing for a teacher or without a lesson', async () => {
        renderSync(student({ role: 'teacher' }));
        renderSync(student({ studentLesson: null }));
        await flush();
        expect(classroomAPI.putLessonProgress).not.toHaveBeenCalled();
    });

    test('should send a "done" and an opened assignment challenge, but not other challenges', async () => {
        const store = renderSync();
        await flush();
        act(() => {
            store.dispatch(openChallenge(B));
        });
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenLastCalledWith('token-1', 'class-1', {
            challenges: {},
            current: { challengeId: B, openedAt: expect.any(String) },
        });
        act(() => {
            store.dispatch(markChallengeCompleted(B, LATER));
        });
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenLastCalledWith('token-1', 'class-1', {
            challenges: { [B]: { completedAt: LATER, before: false } },
            current: { challengeId: B, openedAt: expect.any(String) },
        });
        const calls = classroomAPI.putLessonProgress.mock.calls.length;
        act(() => {
            store.dispatch(closeLesson());
            store.dispatch(openChallenge(OUTSIDE));
            store.dispatch(markChallengeCompleted(OUTSIDE, LATER2));
        });
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenCalledTimes(calls);
    });

    test('should ask once before the first send when the device has records, and send them as before', async () => {
        saveDeviceRecords([A]);
        const store = renderSync();
        await flush();
        expect(screen.getByTestId('lesson-progress-confirm')).toBeInTheDocument();
        expect(screen.getByTestId('lesson-progress-confirm-list').children).toHaveLength(1);
        expect(classroomAPI.putLessonProgress).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('lesson-progress-confirm-mine'));
        await flush();
        expect(screen.queryByTestId('lesson-progress-confirm')).toBeNull();
        expect(classroomAPI.putLessonProgress).toHaveBeenLastCalledWith('token-1', 'class-1', {
            challenges: { [A]: { completedAt: T1, before: true } },
        });
        const consents = JSON.parse(window.localStorage.getItem(LESSON_PROGRESS_CONSENT_STORAGE_KEY));
        expect(consents[KEY]).toEqual(expect.objectContaining({ answer: 'mine', beforeIds: [A] }));

        // a record made after the answer is not "before"
        act(() => {
            store.dispatch(markChallengeCompleted(B, LATER));
        });
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenLastCalledWith('token-1', 'class-1', {
            challenges: {
                [A]: { completedAt: T1, before: true },
                [B]: { completedAt: LATER, before: false },
            },
        });
    });

    test('should confirm once more, then clear the lesson records without sending them', async () => {
        saveDeviceRecords([A, B]);
        const store = renderSync();
        await flush();
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-not-mine'));
        expect(screen.getByTestId('lesson-progress-confirm-clear')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-back'));
        expect(screen.getByTestId('lesson-progress-confirm-mine')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-not-mine'));
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-clear'));
        await flush();
        expect(screen.queryByTestId('lesson-progress-confirm')).toBeNull();
        expect(store.getState().scratchGui.lessonMode.progress.challenges).toEqual({});
        expect(JSON.parse(window.localStorage.getItem(LESSON_PROGRESS_STORAGE_KEY)).challenges).toEqual({});
        classroomAPI.putLessonProgress.mock.calls.forEach(([, , payload]) => {
            expect(payload.challenges).toEqual({});
        });
    });

    test('should ask again when the teacher adds a challenge with an old record (answered none)', async () => {
        saveDeviceRecords([C]);
        const store = renderSync();
        await flush();
        // C is outside the assignment: nothing to ask, answered "none"
        expect(screen.queryByTestId('lesson-progress-confirm')).toBeNull();
        expect(JSON.parse(window.localStorage.getItem(LESSON_PROGRESS_CONSENT_STORAGE_KEY))[KEY].answer).toBe('none');
        classroomAPI.putLessonProgress.mockClear();
        const widened = normalizeAssignmentLesson({ courseId: 'kyou-kara-programmer', challengeIds: [A, B, C] });
        act(() => {
            store.dispatch({ type: SET_CLASSROOM, classroom: student({ studentLesson: widened }) });
        });
        await flush();
        expect(screen.getByTestId('lesson-progress-confirm-list').children).toHaveLength(1);
        expect(classroomAPI.putLessonProgress).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-mine'));
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenLastCalledWith('token-1', 'class-1', {
            challenges: { [C]: { completedAt: T1, before: true } },
        });
    });

    test('should ask only about the added record when the answer was "mine"', async () => {
        saveDeviceRecords([A, C]);
        const store = renderSync();
        await flush();
        expect(screen.getByTestId('lesson-progress-confirm-list').children).toHaveLength(1);
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-mine'));
        await flush();
        const widened = normalizeAssignmentLesson({ courseId: 'kyou-kara-programmer', challengeIds: [A, B, C] });
        act(() => {
            store.dispatch({ type: SET_CLASSROOM, classroom: student({ studentLesson: widened }) });
        });
        await flush();
        const list = screen.getByTestId('lesson-progress-confirm-list');
        expect(list.children).toHaveLength(1);
        expect(classroomAPI.putLessonProgress).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-mine'));
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenLastCalledWith('token-1', 'class-1', {
            challenges: {
                [A]: { completedAt: T1, before: true },
                [C]: { completedAt: T1, before: true },
            },
        });
    });

    test('should not send cleared records that another tab writes back', async () => {
        saveDeviceRecords([A]);
        const store = renderSync();
        await flush();
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-not-mine'));
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-clear'));
        await flush();
        // another tab still holding the old copy marks a challenge done and writes the old record back
        saveDeviceRecords([A]);
        act(() => {
            store.dispatch({ type: 'scratch-gui/lesson-mode/RELOAD_PROGRESS' });
            store.dispatch(markChallengeCompleted(B, LATER));
        });
        await flush();
        expect(screen.queryByTestId('lesson-progress-confirm')).toBeNull();
        const [, , payload] = classroomAPI.putLessonProgress.mock.calls.at(-1);
        expect(Object.keys(payload.challenges)).toEqual([B]);
    });

    test('should keep asking separately for another person joining the same seat', async () => {
        saveDeviceRecords([A]);
        renderSync();
        await flush();
        fireEvent.click(screen.getByTestId('lesson-progress-confirm-mine'));
        await flush();
        expect(screen.queryByTestId('lesson-progress-confirm')).toBeNull();
        renderSync(student({ joinedAt: '2026-11-16T00:00:00.000Z', sessionToken: 'token-2' }));
        await flush();
        expect(screen.getByTestId('lesson-progress-confirm')).toBeInTheDocument();
    });

    test('should not send again when nothing is new, but catch up after a failure', async () => {
        classroomAPI.putLessonProgress.mockRejectedValueOnce(Object.assign(new Error('offline'), { status: 503 }));
        const store = renderSync();
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenCalledTimes(1);
        act(() => {
            store.dispatch(requestProgressSend());
        });
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenCalledTimes(2);
        act(() => {
            store.dispatch(requestProgressSend());
        });
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenCalledTimes(2);
    });

    test('should stop sending for a session that ended (410), keeping the records', async () => {
        classroomAPI.putLessonProgress.mockRejectedValueOnce(Object.assign(new Error('gone'), { status: 410 }));
        const store = renderSync();
        await flush();
        act(() => {
            store.dispatch(markChallengeCompleted(A, LATER));
        });
        await flush();
        expect(classroomAPI.putLessonProgress).toHaveBeenCalledTimes(1);
        expect(store.getState().scratchGui.lessonMode.progress.challenges[A]).toBeDefined();
    });
});
