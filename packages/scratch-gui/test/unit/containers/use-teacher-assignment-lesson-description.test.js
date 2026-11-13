/* eslint-env jest */
/**
 * レッスンの説明文をページに入れる (#1780) と、［＋ 作成 ▾］→「レッスン」の始まり方。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherAssignment from '../../../src/containers/use-teacher-assignment.js';
import { buildLessonDescription, firstLessonDraft } from '../../../src/lib/classroom-lesson-description.js';
import { createLessonDraft, setLessonChecked } from '../../../src/lib/classroom-lesson-settings.js';
import { COURSES, findCourse } from '../../../src/lib/lessons/courses.js';

const mockGetAssignment = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getAssignment: (...args) => mockGetAssignment(...args),
        setAssignment: jest.fn(),
        updateClassroom: jest.fn(),
        uploadToPresignedUrl: jest.fn(),
    },
}));

const course = COURSES[0];
const describeJa = (draft) => buildLessonDescription({ course: findCourse(draft.courseId), draft, locale: 'ja' });
const lesson2 = setLessonChecked(createLessonDraft(course.id), course, course.lessons[1].id, true);

const makeDeps = (classroomId = 'c1', phase = 'teacher-class-detail') => ({
    idToken: 'id-token',
    selectedClassroom: { classroomId },
    handleTeacher401: jest.fn(),
    clearError: jest.fn(),
    showError: jest.fn(),
    intl: { formatMessage: (m) => m.defaultMessage, locale: 'ja' },
    setIsLoading: jest.fn(),
    phase,
    setPhase: jest.fn(),
    vm: {},
});
const setup = (classroomId, phase) =>
    renderHook((props) => useTeacherAssignment(props), { initialProps: makeDeps(classroomId, phase) });

describe('useTeacherAssignment — lesson description (#1780)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
    });

    test('an empty page gets the description, and follows the lesson', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: '' }] } });
        const hook = setup();
        await act(async () => {});
        act(() => hook.result.current.handleChangeLesson(firstLessonDraft()));
        expect(hook.result.current.editorPages[0].text).toBe(describeJa(firstLessonDraft()));
        act(() => hook.result.current.handleChangeLesson(lesson2));
        expect(hook.result.current.editorPages[0].text).toBe(describeJa(lesson2));
        // 「レッスンを使わない」: the generated text goes away
        act(() => hook.result.current.handleChangeLesson(null));
        expect(hook.result.current.editorPages[0].text).toBe('');
        // nothing was asked
        act(() => hook.result.current.handleLessonPanelClose());
        expect(hook.result.current.descriptionQuestion).toBe(false);
    });

    test('a page the teacher wrote is asked about on close; ［いいえ］ keeps it', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'mine' }] } });
        const hook = setup();
        await act(async () => {});
        act(() => hook.result.current.handleChangeLesson(firstLessonDraft()));
        expect(hook.result.current.editorPages[0].text).toBe('mine');
        expect(hook.result.current.descriptionQuestion).toBe(false);
        act(() => hook.result.current.handleLessonPanelClose());
        expect(hook.result.current.descriptionQuestion).toBe(true);
        act(() => hook.result.current.handleAnswerDescriptionQuestion(false));
        expect(hook.result.current.descriptionQuestion).toBe(false);
        expect(hook.result.current.editorPages[0].text).toBe('mine');
    });

    test('［はい］ overwrites page 1', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'mine' }, { text: 'p2' }] } });
        const hook = setup();
        await act(async () => {});
        act(() => hook.result.current.handleChangeLesson(firstLessonDraft()));
        act(() => hook.result.current.handleLessonPanelClose());
        act(() => hook.result.current.handleAnswerDescriptionQuestion(true));
        expect(hook.result.current.editorPages.map((p) => p.text)).toEqual([describeJa(firstLessonDraft()), 'p2']);
    });

    test('closing the panel without changing the lesson does not ask', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'mine' }] } });
        const hook = setup();
        await act(async () => {});
        act(() => hook.result.current.handleLessonPanelClose());
        expect(hook.result.current.descriptionQuestion).toBe(false);
    });

    test('「レッスン」 from the create menu: the first lesson, its description and the panel open', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: null });
        const hook = setup('c-other');
        await act(async () => {});
        expect(hook.result.current.lessonDraft).toBeNull();
        expect(hook.result.current.lessonPanelAutoOpen).toBe(false);

        // A new assignment created with「レッスン」is opened next (from the board).
        const next = setup('c-new', 'teacher-dashboard');
        act(() => next.result.current.requestLessonStart('c-new'));
        next.rerender(makeDeps('c-new', 'teacher-class-detail'));
        await act(async () => {});
        expect(next.result.current.lessonDraft).toEqual(firstLessonDraft());
        expect(next.result.current.editorPages[0].text).toBe(describeJa(firstLessonDraft()));
        expect(next.result.current.lessonPanelAutoOpen).toBe(true);
        act(() => next.result.current.handleLessonPanelAutoOpened());
        expect(next.result.current.lessonPanelAutoOpen).toBe(false);
        // Only once: reloading (e.g. after a save) does not start it again.
        await act(async () => {
            await next.result.current.loadAssignmentEditor();
        });
        expect(next.result.current.lessonDraft).toBeNull();
        expect(next.result.current.lessonPanelAutoOpen).toBe(false);
    });
});
