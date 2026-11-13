/**
 * レッスンの設定と進み具合の純粋関数（issue #1597 / EPIC #1592）。
 *
 * 守る性質:
 *
 * 1. 課題の `lesson` は任意。undefined = 送られていない（古い画面。保存値を保つ）、
 *    null = 外す、オブジェクト = 検証して保存（ID の形・件数の上限・完了の条件・採点の点）。
 * 2. 進み具合の入力は ID の形と件数を検証し、日時は ISO に正規化して未来は今に丸める。
 * 3. マージ: 課題の対象外のチャレンジは捨てる・できた記録は消えない・できた時刻は
 *    動かない（あとから来た記録で上書きしない）・current は送られたときだけ変える。
 */
import {
  LessonInputError,
  MAX_LESSON_CHALLENGES,
  lessonSettingOf,
  mergeLessonProgress,
  validateLessonProgressInput,
  validateLessonSetting,
} from '../lesson-lib';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `blocks-l1-c${i}`);

const validLesson = (over: Record<string, unknown> = {}) => ({
  courseId: 'kyou-kara-programmer',
  challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say'],
  requiredChallengeIds: ['blocks-l1-arrow-move'],
  completion: { type: 'all' },
  submitWork: false,
  scoring: { total: 100, requiredPoints: 70, optionalPoints: 30 },
  ...over,
});

describe('validateLessonSetting', () => {
  test('undefined は「送られていない」（undefined を返す）、null は外す', () => {
    expect(validateLessonSetting(undefined)).toBeUndefined();
    expect(validateLessonSetting(null)).toBeNull();
  });

  test('正しい設定を正規化して返す', () => {
    expect(validateLessonSetting(validLesson())).toEqual(validLesson());
  });

  test('省略できる項目は既定値になる（必須なし・全部・提出なし・採点なし）', () => {
    expect(validateLessonSetting({ courseId: 'c1', challengeIds: ['a1'] })).toEqual({
      courseId: 'c1',
      challengeIds: ['a1'],
      requiredChallengeIds: [],
      completion: { type: 'all' },
      submitWork: false,
      scoring: null,
    });
  });

  test('completion count は 必須の数 以上 チャレンジの数 以下', () => {
    expect(validateLessonSetting(validLesson({ completion: { type: 'count', count: 2 } }))?.completion)
      .toEqual({ type: 'count', count: 2 });
    expect(() => validateLessonSetting(validLesson({ completion: { type: 'count', count: 4 } }))).toThrow(LessonInputError);
    expect(() => validateLessonSetting(validLesson({ completion: { type: 'count', count: 0 } }))).toThrow(LessonInputError);
    expect(() => validateLessonSetting(validLesson({
      requiredChallengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move'],
      completion: { type: 'count', count: 1 },
    }))).toThrow(LessonInputError);
    expect(() => validateLessonSetting(validLesson({ completion: { type: 'count', count: 1.5 } }))).toThrow(LessonInputError);
  });

  test('all のときは count を保存しない', () => {
    expect(validateLessonSetting(validLesson({ completion: { type: 'all', count: 2 } }))?.completion)
      .toEqual({ type: 'all' });
  });

  test.each([
    ['オブジェクトでない', 'x'],
    ['配列', []],
    ['courseId が無い', validLesson({ courseId: undefined })],
    ['courseId の形が違う', validLesson({ courseId: 'Bad Id!' })],
    ['challengeIds が空', validLesson({ challengeIds: [], requiredChallengeIds: [] })],
    ['challengeIds が配列でない', validLesson({ challengeIds: 'a' })],
    ['challengeIds の形が違う', validLesson({ challengeIds: ['ok', '../x'], requiredChallengeIds: [] })],
    ['challengeIds が重複', validLesson({ challengeIds: ['a', 'a'], requiredChallengeIds: [] })],
    ['challengeIds が多すぎる', validLesson({ challengeIds: ids(MAX_LESSON_CHALLENGES + 1), requiredChallengeIds: [] })],
    ['必須が選んだチャレンジの外', validLesson({ requiredChallengeIds: ['other'] })],
    ['必須が重複', validLesson({ requiredChallengeIds: ['blocks-l1-arrow-move', 'blocks-l1-arrow-move'] })],
    ['completion の種類が違う', validLesson({ completion: { type: 'some' } })],
    ['submitWork が真偽でない', validLesson({ submitWork: 'yes' })],
    ['scoring がオブジェクトでない', validLesson({ scoring: 100 })],
    ['満点が 0', validLesson({ scoring: { total: 0, requiredPoints: 0, optionalPoints: 0 } })],
    ['満点が大きすぎる', validLesson({ scoring: { total: 1001, requiredPoints: 0, optionalPoints: 0 } })],
    ['点が負', validLesson({ scoring: { total: 100, requiredPoints: -1, optionalPoints: 30 } })],
    ['点が満点より大きい', validLesson({ scoring: { total: 100, requiredPoints: 101, optionalPoints: 0 } })],
    ['点が数でない', validLesson({ scoring: { total: 100, requiredPoints: '70', optionalPoints: 30 } })],
    ['点が NaN 相当', validLesson({ scoring: { total: 100, requiredPoints: null, optionalPoints: 30 } })],
  ])('不正な設定は LessonInputError: %s', (_label, value) => {
    expect(() => validateLessonSetting(value)).toThrow(LessonInputError);
  });

  test('ID は 64 文字まで', () => {
    const long = `a${'b'.repeat(63)}`;
    expect(validateLessonSetting({ courseId: long, challengeIds: [long] })?.courseId).toBe(long);
    expect(() => validateLessonSetting({ courseId: `${long}c`, challengeIds: ['a'] })).toThrow(LessonInputError);
  });
});

describe('lessonSettingOf', () => {
  test('lesson の無い課題（いままでの課題）は null', () => {
    expect(lessonSettingOf(undefined)).toBeNull();
    expect(lessonSettingOf({ classroomId: 'c1' })).toBeNull();
    expect(lessonSettingOf({ lesson: 'broken' })).toBeNull();
  });

  test('保存された設定を返す', () => {
    expect(lessonSettingOf({ lesson: validLesson() })).toEqual(validLesson());
  });
});

const NOW = Date.parse('2026-11-15T03:00:00.000Z');

describe('validateLessonProgressInput', () => {
  test('空の送信は何も変えない入力になる', () => {
    expect(validateLessonProgressInput({}, NOW)).toEqual({ challenges: {}, current: undefined });
  });

  test('できた記録と current を正規化する', () => {
    expect(validateLessonProgressInput({
      challenges: {
        a1: { completedAt: '2026-11-15T02:00:00Z' },
        a2: { completedAt: '2026-10-01T00:00:00.000Z', before: true },
      },
      current: { challengeId: 'a3', openedAt: '2026-11-15T02:30:00Z' },
    }, NOW)).toEqual({
      challenges: {
        a1: { completedAt: '2026-11-15T02:00:00.000Z', before: false },
        a2: { completedAt: '2026-10-01T00:00:00.000Z', before: true },
      },
      current: { challengeId: 'a3', openedAt: '2026-11-15T02:30:00.000Z' },
    });
  });

  test('current: null は「いまやっていない」', () => {
    expect(validateLessonProgressInput({ current: null }, NOW).current).toBeNull();
  });

  test('未来の日時は今に丸める（端末の時計のずれ）', () => {
    const input = validateLessonProgressInput({
      challenges: { a1: { completedAt: '2030-01-01T00:00:00Z' } },
      current: { challengeId: 'a1', openedAt: '2030-01-01T00:00:00Z' },
    }, NOW);
    expect(input.challenges.a1.completedAt).toBe(new Date(NOW).toISOString());
    expect(input.current?.openedAt).toBe(new Date(NOW).toISOString());
  });

  test.each([
    ['challenges が配列', { challenges: [] }],
    ['challenges が文字列', { challenges: 'a' }],
    ['ID の形が違う', { challenges: { 'Bad Id': { completedAt: '2026-11-15T00:00:00Z' } } }],
    ['記録がオブジェクトでない', { challenges: { a1: true } }],
    ['completedAt が無い', { challenges: { a1: {} } }],
    ['completedAt が日時でない', { challenges: { a1: { completedAt: 'yesterday' } } }],
    ['completedAt が古すぎる', { challenges: { a1: { completedAt: '1999-01-01T00:00:00Z' } } }],
    ['before が真偽でない', { challenges: { a1: { completedAt: '2026-11-15T00:00:00Z', before: 'y' } } }],
    ['件数が多すぎる', {
      challenges: Object.fromEntries(ids(MAX_LESSON_CHALLENGES + 1).map(id => [id, { completedAt: '2026-11-15T00:00:00Z' }])),
    }],
    ['current がオブジェクトでない', { current: 'a1' }],
    ['current の ID の形が違う', { current: { challengeId: 'x y', openedAt: '2026-11-15T00:00:00Z' } }],
    ['current の openedAt が日時でない', { current: { challengeId: 'a1', openedAt: 'now' } }],
  ])('不正な入力は LessonInputError: %s', (_label, body) => {
    expect(() => validateLessonProgressInput(body as Record<string, unknown>, NOW)).toThrow(LessonInputError);
  });
});

describe('mergeLessonProgress', () => {
  const allowed = ['a1', 'a2', 'a3'];

  test('はじめての送信: 課題の対象外のチャレンジは捨てる', () => {
    const { progress, changed } = mergeLessonProgress(null, {
      challenges: {
        a1: { completedAt: '2026-11-15T02:00:00.000Z', before: false },
        other: { completedAt: '2026-11-15T02:00:00.000Z', before: false },
      },
      current: { challengeId: 'a2', openedAt: '2026-11-15T02:10:00.000Z' },
    }, allowed);
    expect(changed).toBe(true);
    expect(progress).toEqual({
      challenges: { a1: { completedAt: '2026-11-15T02:00:00.000Z', before: false } },
      current: { challengeId: 'a2', openedAt: '2026-11-15T02:10:00.000Z' },
    });
  });

  test('できた記録は消えない（送られなかったチャレンジも残る）', () => {
    const existing = {
      challenges: { a1: { completedAt: '2026-11-15T02:00:00.000Z', before: false } },
      current: null,
    };
    const { progress, changed } = mergeLessonProgress(existing, {
      challenges: { a2: { completedAt: '2026-11-15T02:20:00.000Z', before: false } },
      current: undefined,
    }, allowed);
    expect(changed).toBe(true);
    expect(Object.keys(progress.challenges).sort()).toEqual(['a1', 'a2']);
  });

  test('できた時刻は動かさない（前の記録も、あとの記録も上書きしない）', () => {
    const existing = {
      challenges: { a1: { completedAt: '2026-11-15T02:00:00.000Z', before: false } },
      current: null,
    };
    for (const completedAt of ['2026-10-01T00:00:00.000Z', '2026-11-15T02:50:00.000Z']) {
      const { progress, changed } = mergeLessonProgress(existing, {
        challenges: { a1: { completedAt, before: true } },
        current: undefined,
      }, allowed);
      expect(changed).toBe(false);
      expect(progress.challenges.a1).toEqual({ completedAt: '2026-11-15T02:00:00.000Z', before: false });
    }
  });

  test('課題から外されたチャレンジの記録も消さない（先生が戻したときに見える）', () => {
    const existing = {
      challenges: { gone: { completedAt: '2026-11-15T02:00:00.000Z', before: false } },
      current: null,
    };
    const { progress } = mergeLessonProgress(existing, { challenges: {}, current: undefined }, allowed);
    expect(progress.challenges.gone).toBeDefined();
  });

  test('current: undefined は保つ、null は外す、対象外の ID は無視する', () => {
    const existing = {
      challenges: {},
      current: { challengeId: 'a1', openedAt: '2026-11-15T02:00:00.000Z' },
    };
    expect(mergeLessonProgress(existing, { challenges: {}, current: undefined }, allowed))
      .toEqual({ progress: existing, changed: false });
    expect(mergeLessonProgress(existing, { challenges: {}, current: null }, allowed).progress.current).toBeNull();
    expect(mergeLessonProgress(existing, {
      challenges: {},
      current: { challengeId: 'other', openedAt: '2026-11-15T02:30:00.000Z' },
    }, allowed)).toEqual({ progress: existing, changed: false });
    const moved = mergeLessonProgress(existing, {
      challenges: {},
      current: { challengeId: 'a2', openedAt: '2026-11-15T02:30:00.000Z' },
    }, allowed);
    expect(moved.changed).toBe(true);
    expect(moved.progress.current).toEqual({ challengeId: 'a2', openedAt: '2026-11-15T02:30:00.000Z' });
  });

  test('同じ内容の送信は changed=false（書き込みを省く）', () => {
    const existing = {
      challenges: { a1: { completedAt: '2026-11-15T02:00:00.000Z', before: false } },
      current: { challengeId: 'a2', openedAt: '2026-11-15T02:10:00.000Z' },
    };
    expect(mergeLessonProgress(existing, {
      challenges: { a1: { completedAt: '2026-11-15T02:00:00.000Z', before: false } },
      current: { challengeId: 'a2', openedAt: '2026-11-15T02:10:00.000Z' },
    }, allowed).changed).toBe(false);
  });
});
