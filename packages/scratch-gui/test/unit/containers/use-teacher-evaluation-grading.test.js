/* eslint-env jest */
/**
 * 採点簿と課題ごとの採点の保存 (EPIC #2421 / #2424)。
 *
 * - 採点のタブを開くと、クラスの課題ごとに保存した採点（GET /grading）を読む。列は新しい課題が左。
 * - 課題を開くと説明を読み、AI には説明（assignmentText）と基準を渡す。
 * - AI の点・先生の直しは PUT /grading に保存する（先生の直しは少し待ってまとめて）。
 * - ［確定］で confirmedAt を保存する。確定したあとに点を変えると確定を取り消す。
 * - 読み込むと、保存した点が戻る。メンバーで提出していない席は「未提出」として並ぶ。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherEvaluation from '../../../src/containers/use-teacher-evaluation.js';

const mockGetGrading = jest.fn();
const mockPutGrading = jest.fn();
const mockListMembers = jest.fn();
const mockGetAssignment = jest.fn();
const mockListSubmissions = jest.fn();
const mockEvaluateSubmissions = jest.fn();
const mockGetEvaluationQuota = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getGrading: (...args) => mockGetGrading(...args),
        putGrading: (...args) => mockPutGrading(...args),
        listMembers: (...args) => mockListMembers(...args),
        getAssignment: (...args) => mockGetAssignment(...args),
        listSubmissions: (...args) => mockListSubmissions(...args),
        evaluateSubmissions: (...args) => mockEvaluateSubmissions(...args),
        getEvaluationQuota: (...args) => mockGetEvaluationQuota(...args),
        updateSubmission: jest.fn(() => Promise.resolve({})),
    },
}));

const group = { groupId: 'g1', name: '技術' };
const classrooms = [
    { classroomId: 'old', groupId: 'g1', assignmentName: '02_LED', createdAt: '2026-10-01T00:00:00Z' },
    { classroomId: 'new', groupId: 'g1', assignmentName: '04_モーター', createdAt: '2026-11-01T00:00:00Z' },
    { classroomId: 'other', groupId: 'g2', assignmentName: 'ほかのクラス' },
];
const savedOld = {
    rubric: null,
    grades: { 1: { grade: 'A', reason: '点ける', source: 'ai' }, 3: { grade: 'S', reason: '', source: 'teacher' } },
    confirmedAt: '2026-11-20T00:00:00Z',
};

const submissions = [1, 2].map((n) => ({
    submissionId: `s${n}`,
    memberId: `seat-0${n}`,
    status: 'submitted',
    projectUrl: `https://example.invalid/${n}.sb3`,
}));

const setup = async () => {
    const deps = {
        idToken: 'id-token',
        classrooms,
        handleTeacher401: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || m.id || String(m) },
        setPhase: jest.fn(),
    };
    const hook = renderHook(() => useTeacherEvaluation(deps));
    await act(async () => {
        hook.result.current.handleShowEvaluation(group);
    });
    return { hook, deps };
};

const open = async (hook, id, seat) => {
    await act(async () => {
        hook.result.current.handleOpenAssignment(id, seat);
    });
};

const load = async (hook) => {
    await act(async () => {
        await hook.result.current.handleLoadSubmissions();
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockGetGrading.mockImplementation((token, id) => Promise.resolve({ grading: id === 'old' ? savedOld : null }));
    mockPutGrading.mockImplementation((token, id, updates) => Promise.resolve({ grading: { ...updates } }));
    mockListMembers.mockResolvedValue({ members: [1, 2, 3].map((n) => ({ memberId: `seat-0${n}` })) });
    mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'モーターを動かす' }] }, lesson: null });
    mockListSubmissions.mockResolvedValue({ submissions });
    mockEvaluateSubmissions.mockImplementation((token, id, payload) =>
        Promise.resolve({
            results: payload.submissions.map((s) => ({ seatNumber: s.seatNumber, grade: 'B', reason: 'ok' })),
        }),
    );
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
    mockGetEvaluationQuota.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
});

describe('useTeacherEvaluation — 採点簿 (#2424)', () => {
    test('採点のタブは採点簿から始まり、クラスの課題を新しい順に並べ、課題ごとの採点を読む', async () => {
        const { hook } = await setup();
        expect(hook.result.current.view).toBe('book');
        expect(hook.result.current.evalLessons.map((l) => l.classroomId)).toEqual(['new', 'old']);
        expect(mockGetGrading.mock.calls.map((call) => call[1]).sort()).toEqual(['new', 'old']);
        expect(hook.result.current.gradings).toEqual({ new: null, old: savedOld });
        expect(hook.result.current.evalProgress).toBeNull();
    });

    test('読めなかった課題は採点なしで並べる（401 ならログインし直し）', async () => {
        mockGetGrading.mockImplementation((token, id) =>
            id === 'old'
                ? Promise.reject(Object.assign(new Error('x'), { status: 401 }))
                : Promise.resolve({ grading: null }),
        );
        const { hook, deps } = await setup();
        expect(hook.result.current.gradings).toEqual({ new: null, old: null });
        expect(deps.handleTeacher401).toHaveBeenCalledTimes(1);
    });

    test('セルを押すと、その席を選んで課題の採点を開く（［生徒］のタブ）', async () => {
        const { hook } = await setup();
        await open(hook, 'old', 3);
        expect(hook.result.current.view).toBe('assignment');
        expect(hook.result.current.currentId).toBe('old');
        expect(hook.result.current.chosenCell).toEqual({ seat: 3, classroomId: 'old' });
        expect(hook.result.current.innerTab).toBe('student');
        // 読み込む前も、保存した評価の席が並ぶ
        expect(hook.result.current.seats).toEqual([1, 3]);
        expect(hook.result.current.loaded).toBe(false);
        act(() => hook.result.current.handleShowGradebook());
        expect(hook.result.current.view).toBe('book');
    });
});

describe('useTeacherEvaluation — 課題の採点の保存 (#2424)', () => {
    test('課題の説明を AI に渡す', async () => {
        const { hook } = await setup();
        await open(hook, 'new');
        await load(hook);
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(mockEvaluateSubmissions.mock.calls[0][2]).toMatchObject({
            assignmentName: '04_モーター',
            assignmentText: 'モーターを動かす',
        });
        expect(mockEvaluateSubmissions.mock.calls[0][2].rubricLevels).toBeUndefined();
    });

    test('基準が無いときは決まった観点（動くこと・課題の要件・工夫）を標準の厳しさで送る (#2455 F2)', async () => {
        const { hook } = await setup();
        await open(hook, 'new');
        await load(hook);
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        const payload = mockEvaluateSubmissions.mock.calls[0][2];
        expect(payload.rubricAxes.map((axis) => axis.name)).toEqual(['動くこと', '課題の要件', '工夫']);
        expect(payload.strictness).toBe('standard');
        expect(hook.result.current).not.toHaveProperty('rubricAxes');
        expect(hook.result.current).not.toHaveProperty('handleSetStrictness');
    });

    test('基準があれば基準と正解の例も渡す', async () => {
        const rubric = { levels: [{ grade: 'S', text: '両方' }], examples: [{ seat: 1, grade: 'A' }] };
        mockGetGrading.mockResolvedValue({ grading: { rubric, grades: {}, confirmedAt: null } });
        const { hook } = await setup();
        await open(hook, 'new');
        await load(hook);
        expect(hook.result.current.rubricDone).toBe(true);
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(mockEvaluateSubmissions.mock.calls[0][2]).toMatchObject({
            rubricLevels: rubric.levels,
            examples: rubric.examples,
            // The sentences grade: no criteria are sent (#2455 F2).
            rubricAxes: [],
        });
    });

    test('読み込むと、提出していないメンバーも並び、保存した点が戻る', async () => {
        const { hook } = await setup();
        await open(hook, 'old');
        await load(hook);
        expect(hook.result.current.seats).toEqual([1, 2, 3]);
        expect(hook.result.current.loaded).toBe(true);
        expect(hook.result.current.getCell(1, 'old')).toMatchObject({ grade: 'A', reason: '点ける', manual: false });
        expect(hook.result.current.getCell(2, 'old')).toMatchObject({ grade: null });
        expect(hook.result.current.getCell(3, 'old')).toBeNull();
    });

    test('AI の点は保存し（source: ai）、先生の直しは少し待ってまとめて保存する（source: teacher）', async () => {
        const { hook } = await setup();
        await open(hook, 'new');
        await load(hook);
        jest.useFakeTimers();
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(hook.result.current.gradeSaveState).toBe('pending');
        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockPutGrading).toHaveBeenCalledTimes(1);
        expect(mockPutGrading.mock.calls[0][1]).toBe('new');
        expect(mockPutGrading.mock.calls[0][2]).toEqual({
            grades: {
                // 作品を読めない（offline）ので、どちらもスターターのまま
                1: { grade: 'B', reason: 'ok', source: 'ai', group: 'スターターのまま' },
                2: { grade: 'B', reason: 'ok', source: 'ai', group: 'スターターのまま' },
            },
        });
        expect(hook.result.current.gradeSaveState).toBeNull();

        act(() => hook.result.current.handleSetCellGrade(1, 'new', 'A'));
        act(() => hook.result.current.handleSetCellGrade(2, 'new', 'S'));
        await act(async () => {
            jest.advanceTimersByTime(500);
        });
        expect(mockPutGrading).toHaveBeenCalledTimes(1);
        await act(async () => {
            jest.advanceTimersByTime(500);
        });
        expect(mockPutGrading).toHaveBeenCalledTimes(2);
        expect(mockPutGrading.mock.calls[1][2].grades).toEqual({
            1: { grade: 'A', reason: 'ok', source: 'teacher', group: 'スターターのまま' },
            2: { grade: 'S', reason: 'ok', source: 'teacher', group: 'スターターのまま' },
        });
    });

    test('［確定］で confirmedAt を保存し、確定のあとに点を変えると確定を取り消す', async () => {
        const { hook } = await setup();
        await open(hook, 'new');
        await load(hook);
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        await act(async () => {
            await hook.result.current.handleConfirmGrades();
        });
        const confirmCall = mockPutGrading.mock.calls[mockPutGrading.mock.calls.length - 1][2];
        expect(typeof confirmCall.confirmedAt).toBe('string');
        expect(Object.keys(confirmCall.grades)).toEqual(['1', '2']);
        expect(hook.result.current.currentGrading.confirmedAt).toBe(confirmCall.confirmedAt);
        expect(hook.result.current.evalResult).toEqual({ kind: 'confirm', count: 2 });

        jest.useFakeTimers();
        act(() => hook.result.current.handleSetCellGrade(1, 'new', 'C'));
        expect(hook.result.current.currentGrading.confirmedAt).toBeNull();
        expect(hook.result.current.unconfirmedByEdit).toBe(true);
        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        const after = mockPutGrading.mock.calls[mockPutGrading.mock.calls.length - 1][2];
        expect(after.confirmedAt).toBeNull();
        expect(after.grades['1']).toMatchObject({ grade: 'C', source: 'teacher' });
    });

    test('保存に失敗したら知らせて、離れるときに確かめる', async () => {
        const { hook, deps } = await setup();
        await open(hook, 'new');
        await load(hook);
        mockPutGrading.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 500 }));
        act(() => hook.result.current.handleSetCellGrade(1, 'new', 'A'));
        await act(async () => {
            await hook.result.current.handleConfirmGrades();
        });
        expect(deps.showError).toHaveBeenCalledTimes(1);
        expect(hook.result.current.gradeSaveState).toBe('failed');
        expect(hook.result.current.evalResult).toEqual({ kind: 'confirm', failed: true });
        expect(hook.result.current.unsavedWork.grades).toBe(true);
    });

    test('課題の CSV は開いた課題だけ（ファイル名に課題名）', async () => {
        global.URL.createObjectURL = jest.fn(() => 'blob:x');
        global.URL.revokeObjectURL = jest.fn();
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const { hook } = await setup();
        await open(hook, 'old');
        await load(hook);
        let name = null;
        const create = document.createElement.bind(document);
        const spy = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = create(tag);
            if (tag === 'a') {
                Object.defineProperty(el, 'download', {
                    set: (v) => {
                        name = v;
                    },
                    get: () => name,
                });
            }
            return el;
        });
        act(() => hook.result.current.handleExportEvaluationCsv());
        expect(name).toBe('技術_02_LED_採点結果.csv');
        spy.mockRestore();
        click.mockRestore();
    });
});

describe('useTeacherEvaluation — スターターから足した台本とまとまり (#2424)', () => {
    const JSZip = jest.requireActual('jszip');
    const block = (opcode, next, parent, extra = {}) => ({
        opcode,
        next,
        parent,
        inputs: {},
        fields: {},
        topLevel: parent === null,
        ...extra,
    });
    // 緑の旗 → 10 歩動かす（スターター）。席 1 は「言う」も足し、席 2 はそのまま。
    const project = (withSay) => ({
        targets: [
            { isStage: true, name: 'Stage', blocks: {}, variables: {}, lists: {}, costumes: [], sounds: [] },
            {
                isStage: false,
                name: 'ねこ',
                variables: {},
                lists: {},
                costumes: [],
                sounds: [],
                blocks: {
                    a: block('event_whenflagclicked', 'b', null),
                    b: block('motion_movesteps', null, 'a', { inputs: { STEPS: [1, [4, '10']] } }),
                    ...(withSay
                        ? {
                              c: block('event_whenkeypressed', 'd', null, { fields: { KEY_OPTION: ['space', null] } }),
                              d: block('looks_say', null, 'c', { inputs: { MESSAGE: [1, [10, 'こんにちは']] } }),
                          }
                        : {}),
                },
            },
        ],
        meta: { semver: '3.0.0' },
    });
    const sb3 = async (json) => {
        const zip = new JSZip();
        zip.file('project.json', JSON.stringify(json));
        return zip.generateAsync({ type: 'arraybuffer' });
    };

    test('読み込むとスターターとの違いとまとまりを出し、AI にスターターを渡し、まとまりを保存する', async () => {
        const files = {
            'https://example.invalid/starter.sb3': await sb3(project(false)),
            'https://example.invalid/1.sb3': await sb3(project(true)),
            'https://example.invalid/2.sb3': await sb3(project(false)),
        };
        global.fetch = jest.fn((url) =>
            Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(files[url]) }),
        );
        mockGetAssignment.mockResolvedValue({
            assignment: { pages: [{ text: '言わせる' }], starterUrl: 'https://example.invalid/starter.sb3' },
            lesson: null,
        });
        const { hook } = await setup();
        await open(hook, 'new');
        await load(hook);
        const one = hook.result.current.getCell(1, 'new');
        const two = hook.result.current.getCell(2, 'new');
        expect(one.added).toHaveLength(1);
        expect(one.added[0]).toMatch(/こんにちは/);
        expect(two.added).toEqual([]);
        expect(two.groupName).toBe('スターターのまま');
        expect(one.groupName).not.toBe(two.groupName);

        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(mockEvaluateSubmissions.mock.calls[0][2].starterPseudocode).toMatch(/10/);
        await act(async () => {
            await hook.result.current.handleConfirmGrades();
        });
        const saved = mockPutGrading.mock.calls[mockPutGrading.mock.calls.length - 1][2].grades;
        expect(saved['2'].group).toBe('スターターのまま');
        expect(saved['1'].group).toBe(one.groupName);
    });

    test('全員の採点: まとまりの間で例を引き継ぎ、同じ形なのに評価が違えば要確認にする', async () => {
        // 12 人とも「スペースで 言う + n 歩動かす」を足した同じ形（数だけ違う）。10 人ずつに分けて AI に頼む。
        const work = (steps) => {
            const json = project(true);
            const blocks = json.targets[1].blocks;
            blocks.d.next = 'e';
            blocks.e = block('motion_movesteps', null, 'd', { inputs: { STEPS: [1, [4, String(steps)]] } });
            return json;
        };
        const seats = Array.from({ length: 12 }, (_, i) => i + 1);
        const files = { 'https://example.invalid/starter.sb3': await sb3(project(false)) };
        for (const n of seats) files[`https://example.invalid/${n}.sb3`] = await sb3(work(n * 5));
        global.fetch = jest.fn((url) =>
            Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(files[url]) }),
        );
        mockGetAssignment.mockResolvedValue({
            assignment: { pages: [{ text: '言わせる' }], starterUrl: 'https://example.invalid/starter.sb3' },
            lesson: null,
        });
        mockListMembers.mockResolvedValue({ members: seats.map((n) => ({ memberId: `seat-${n}` })) });
        mockListSubmissions.mockResolvedValue({
            submissions: seats.map((n) => ({
                submissionId: `s${n}`,
                memberId: `seat-${n}`,
                status: 'submitted',
                projectUrl: `https://example.invalid/${n}.sb3`,
            })),
        });
        // 1 つ目のまとまりは B、2 つ目は S（本番で起きたぶれ）。
        let call = 0;
        mockEvaluateSubmissions.mockImplementation((token, id, payload) => {
            call++;
            const grade = call === 1 ? 'B' : 'S';
            return Promise.resolve({
                results: payload.submissions.map((x) => ({ seatNumber: x.seatNumber, grade, reason: `理由${grade}` })),
            });
        });
        const { hook } = await setup();
        await open(hook, 'new');
        await load(hook);
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(2);
        expect(mockEvaluateSubmissions.mock.calls[0][2].examples).toBeUndefined();
        // 2 つ目のまとまりには、1 つ目の形の作品が 1 件だけ AI の評価と理由つきで例に入る。
        expect(mockEvaluateSubmissions.mock.calls[1][2].examples).toEqual([
            expect.objectContaining({ seatNumber: 1, grade: 'B', reason: '理由B' }),
        ]);
        // 評価は書きかえず、同じ形の 12 件を要確認にして知らせる。
        expect(hook.result.current.getCell(1, 'new')).toMatchObject({
            grade: 'B',
            needsReview: true,
            reviewReason: 'shape',
        });
        expect(hook.result.current.getCell(12, 'new')).toMatchObject({
            grade: 'S',
            needsReview: true,
            reviewReason: 'shape',
        });
        expect(hook.result.current.evalResult).toMatchObject({ kind: 'grade', count: 12, inconsistent: 12 });
    });
});

describe('useTeacherEvaluation — 今日の AI の残り (#2448)', () => {
    test('課題を開くと 1 回読み、AI の答えの quota で更新する', async () => {
        mockGetEvaluationQuota.mockResolvedValue({ quota: { used: 3, limit: 200, resetsAt: 'r' } });
        mockEvaluateSubmissions.mockImplementation((token, id, payload) =>
            Promise.resolve({
                results: payload.submissions.map((s) => ({ seatNumber: s.seatNumber, grade: 'B', reason: 'ok' })),
                quota: { used: 4, limit: 200, resetsAt: 'r' },
            }),
        );
        const { hook } = await setup();
        expect(hook.result.current.aiQuota).toBeNull();
        expect(mockGetEvaluationQuota).not.toHaveBeenCalled();
        await open(hook, 'new');
        expect(mockGetEvaluationQuota).toHaveBeenCalledTimes(1);
        expect(mockGetEvaluationQuota.mock.calls[0][0]).toBe('id-token');
        expect(hook.result.current.aiQuota).toEqual({ used: 3, limit: 200, resetsAt: 'r' });
        await load(hook);
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(hook.result.current.aiQuota).toMatchObject({ used: 4 });
    });

    test('読めないとき（404・quota の無い答え）は何も出さず、ほかは動く', async () => {
        const { hook, deps } = await setup();
        await open(hook, 'new');
        expect(hook.result.current.aiQuota).toBeNull();
        expect(deps.showError).not.toHaveBeenCalled();
        await load(hook);
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(hook.result.current.aiQuota).toBeNull();
        expect(hook.result.current.getCell(1, 'new')).toMatchObject({ grade: 'B' });
    });
});
