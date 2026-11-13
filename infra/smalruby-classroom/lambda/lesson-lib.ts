/**
 * 課題のレッスンの設定と、席 × 課題の進み具合（issue #1597 / EPIC #1592）の純粋関数。
 *
 * I/O（DynamoDB の読み書き・認可）は handler.ts が行う。ここには入力の検証と
 * 進み具合のマージだけを置き、表の形で決めた性質を unit test で固定する:
 *
 * - サーバーはコースの中身（courses.js）を知らない。ID の形と件数だけを確かめる。
 * - 進み具合の送信は「その席・その課題の 1 件」をまとめて送る（D8: 費用を抑える）。
 *   サーバーは課題の対象外のチャレンジを捨て、できた記録を消さず、できた時刻を
 *   動かさない（あとから来た記録・端末の古い記録で上書きしない）。
 */

/** コース・チャレンジの ID の形（courses.js の id は小文字のケバブケース）。 */
export const LESSON_ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;
/** 1 課題で選べるチャレンジの数の上限（いまのコースは 11。余裕を持たせる）。 */
export const MAX_LESSON_CHALLENGES = 100;
/** 満点の上限。 */
export const MAX_SCORING_TOTAL = 1000;
/** これより前の日時は端末の時計の壊れとみなして受け付けない。 */
const MIN_TIMESTAMP_MS = Date.parse('2020-01-01T00:00:00.000Z');
const MAX_TIMESTAMP_LENGTH = 40;

export const COMPLETION_TYPES = ['all', 'count'] as const;

export type LessonCompletion = { type: 'all' } | { type: 'count'; count: number };

export interface LessonScoring {
  /** 満点（n 点）。 */
  total: number;
  /** 必須を全部こなしたときの点（必須の合計）。 */
  requiredPoints: number;
  /** 必須でないものの合計点。 */
  optionalPoints: number;
}

export interface LessonSetting {
  courseId: string;
  /** レッスンの順のチャレンジ ID。 */
  challengeIds: string[];
  requiredChallengeIds: string[];
  completion: LessonCompletion;
  /** レッスンのあとに作品の提出もする課題か。 */
  submitWork: boolean;
  scoring: LessonScoring | null;
}

export interface ChallengeProgress {
  completedAt: string;
  /** 課題の前から（端末の記録から）できていた。 */
  before: boolean;
}

export interface CurrentChallenge {
  challengeId: string;
  openedAt: string;
}

export interface LessonProgress {
  challenges: Record<string, ChallengeProgress>;
  current: CurrentChallenge | null;
}

export interface LessonProgressInput {
  challenges: Record<string, ChallengeProgress>;
  /** undefined = 送られていない（保存値を保つ）、null = いまやっていない。 */
  current: CurrentChallenge | null | undefined;
}

/** 入力の誤り。handler が 400 に変える。 */
export class LessonInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LessonInputError';
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function validateId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !LESSON_ID_REGEX.test(value)) {
    throw new LessonInputError(`${label} must match ${LESSON_ID_REGEX}`);
  }
  // `constructor` は形に合うが、map のキーにすると DynamoDB の marshall が普通の
  // オブジェクトと見なせず落ちる（500）。Object.prototype の名前は ID に使わせない。
  if (Object.prototype.hasOwnProperty.call(Object.prototype, value)) {
    throw new LessonInputError(`${label} must not be a reserved name (${value})`);
  }
  return value;
}

function validateIdList(value: unknown, label: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(value)) {
    throw new LessonInputError(`${label} must be an array`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new LessonInputError(`${label} must not be empty`);
  }
  if (value.length > MAX_LESSON_CHALLENGES) {
    throw new LessonInputError(`${label} may have at most ${MAX_LESSON_CHALLENGES} items`);
  }
  const ids = value.map((id, i) => validateId(id, `${label}[${i}]`));
  if (new Set(ids).size !== ids.length) {
    throw new LessonInputError(`${label} must not contain duplicates`);
  }
  return ids;
}

function validatePoints(value: unknown, label: string, max: number, allowZero: boolean): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0) || value > max) {
    throw new LessonInputError(`${label} must be a number in ${allowZero ? '[0' : '(0'}, ${max}]`);
  }
  return value;
}

function validateScoring(value: unknown): LessonScoring | null {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) {
    throw new LessonInputError('lesson.scoring must be an object');
  }
  const total = validatePoints(value.total, 'lesson.scoring.total', MAX_SCORING_TOTAL, false);
  return {
    total,
    requiredPoints: validatePoints(value.requiredPoints, 'lesson.scoring.requiredPoints', total, true),
    optionalPoints: validatePoints(value.optionalPoints, 'lesson.scoring.optionalPoints', total, true),
  };
}

function validateCompletion(value: unknown, challengeCount: number, requiredCount: number): LessonCompletion {
  if (value === undefined || value === null) return { type: 'all' };
  if (!isPlainObject(value) || !COMPLETION_TYPES.includes(value.type as typeof COMPLETION_TYPES[number])) {
    throw new LessonInputError(`lesson.completion.type must be one of: ${COMPLETION_TYPES.join(', ')}`);
  }
  if (value.type === 'all') return { type: 'all' };
  const count = value.count;
  // 「n つ（必須をふくむ）」なので、必須の数より少ない n は満たせない条件になる。
  if (typeof count !== 'number' || !Number.isInteger(count) ||
      count < Math.max(1, requiredCount) || count > challengeCount) {
    throw new LessonInputError(
      `lesson.completion.count must be an integer between ${Math.max(1, requiredCount)} and ${challengeCount}`,
    );
  }
  return { type: 'count', count };
}

/**
 * 課題の保存で送られた `lesson` を検証する。
 * @param value - リクエストの `lesson`
 * @returns undefined = 送られていない（古い画面。保存値を保つ）、null = 外す、または正規化した設定
 */
export function validateLessonSetting(value: unknown): LessonSetting | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isPlainObject(value)) {
    throw new LessonInputError('lesson must be an object or null');
  }
  const courseId = validateId(value.courseId, 'lesson.courseId');
  const challengeIds = validateIdList(value.challengeIds, 'lesson.challengeIds', false);
  const requiredChallengeIds = value.requiredChallengeIds === undefined
    ? []
    : validateIdList(value.requiredChallengeIds, 'lesson.requiredChallengeIds', true);
  const selected = new Set(challengeIds);
  for (const id of requiredChallengeIds) {
    if (!selected.has(id)) {
      throw new LessonInputError(`lesson.requiredChallengeIds must be chosen from lesson.challengeIds (${id})`);
    }
  }
  const completion = validateCompletion(value.completion, challengeIds.length, requiredChallengeIds.length);
  if (value.submitWork !== undefined && typeof value.submitWork !== 'boolean') {
    throw new LessonInputError('lesson.submitWork must be a boolean');
  }
  return {
    courseId,
    challengeIds,
    requiredChallengeIds,
    completion,
    submitWork: value.submitWork === true,
    scoring: validateScoring(value.scoring),
  };
}

/**
 * 課題（Classrooms の item）またはみんなの課題の item のレッスンの設定。
 * lesson の無い課題（いままでの課題）は null。
 */
export function lessonSettingOf(item: Record<string, unknown> | undefined): LessonSetting | null {
  const lesson = item?.lesson;
  if (!isPlainObject(lesson) || typeof lesson.courseId !== 'string' || !Array.isArray(lesson.challengeIds)) {
    return null;
  }
  return lesson as unknown as LessonSetting;
}

/** ISO 日時を正規化する。未来（端末の時計のずれ）は今に丸める。 */
function normalizeTimestamp(value: unknown, label: string, nowMs: number): string {
  const ms = typeof value === 'string' && value.length <= MAX_TIMESTAMP_LENGTH ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms) || ms < MIN_TIMESTAMP_MS) {
    throw new LessonInputError(`${label} must be an ISO 8601 date-time`);
  }
  return new Date(Math.min(ms, nowMs)).toISOString();
}

/**
 * 生徒が送る進み具合を検証・正規化する（課題の対象かどうかはマージで見る）。
 * @param body - リクエスト本文
 * @param nowMs - いまの時刻（未来の日時を丸める）
 */
export function validateLessonProgressInput(body: Record<string, unknown>, nowMs: number): LessonProgressInput {
  const challenges: Record<string, ChallengeProgress> = {};
  if (body.challenges !== undefined) {
    if (!isPlainObject(body.challenges)) {
      throw new LessonInputError('challenges must be an object');
    }
    const entries = Object.entries(body.challenges);
    if (entries.length > MAX_LESSON_CHALLENGES) {
      throw new LessonInputError(`challenges may have at most ${MAX_LESSON_CHALLENGES} items`);
    }
    for (const [id, record] of entries) {
      validateId(id, 'challenges key');
      if (!isPlainObject(record)) {
        throw new LessonInputError(`challenges.${id} must be an object`);
      }
      if (record.before !== undefined && typeof record.before !== 'boolean') {
        throw new LessonInputError(`challenges.${id}.before must be a boolean`);
      }
      challenges[id] = {
        completedAt: normalizeTimestamp(record.completedAt, `challenges.${id}.completedAt`, nowMs),
        before: record.before === true,
      };
    }
  }

  let current: CurrentChallenge | null | undefined;
  if (body.current === null) {
    current = null;
  } else if (body.current !== undefined) {
    if (!isPlainObject(body.current)) {
      throw new LessonInputError('current must be an object or null');
    }
    current = {
      challengeId: validateId(body.current.challengeId, 'current.challengeId'),
      openedAt: normalizeTimestamp(body.current.openedAt, 'current.openedAt', nowMs),
    };
  }
  return { challenges, current };
}

// `challenges` は通常のオブジェクトなので、`constructor` のような ID は in / [] だと
// Object.prototype のものに当たる。自分の項目かどうかは必ずこれで見る。
const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

const sameCurrent = (a: CurrentChallenge | null, b: CurrentChallenge | null): boolean =>
  a === b || (!!a && !!b && a.challengeId === b.challengeId && a.openedAt === b.openedAt);

/**
 * 保存されている進み具合に、送られた進み具合をマージする。
 *
 * - 課題の対象外（allowedIds にない）のチャレンジは捨てる。
 * - 既にできた記録は変えない（できた時刻を過去にも未来にも動かさない・`before` も変えない）。
 * - 保存されている記録は、送られなくても・課題から外されても消さない（先生が戻したときに見える）。
 * - current は送られたときだけ変える。対象外のチャレンジの current は無視する。
 * - 保存値から何も変わらなければ changed=false（はじめてで中身が空のときも書かない）。
 * @param existing - 保存されている進み具合（はじめてなら null）
 * @param input - validateLessonProgressInput の結果
 * @param allowedIds - 課題の対象のチャレンジ ID
 * @returns マージ後の進み具合と、保存値から変わったか（変わらなければ書かない）
 */
export function mergeLessonProgress(
  existing: LessonProgress | null,
  input: LessonProgressInput,
  allowedIds: string[],
): { progress: LessonProgress; changed: boolean } {
  const allowed = new Set(allowedIds);
  const challenges: Record<string, ChallengeProgress> = { ...(existing?.challenges || {}) };
  let changed = false;
  for (const [id, record] of Object.entries(input.challenges)) {
    if (!allowed.has(id) || hasOwn(challenges, id)) continue;
    challenges[id] = record;
    changed = true;
  }

  const prevCurrent = existing?.current ?? null;
  let current = prevCurrent;
  if (input.current === null) {
    current = null;
  } else if (input.current && allowed.has(input.current.challengeId)) {
    current = input.current;
  }
  if (!sameCurrent(prevCurrent, current)) changed = true;
  // はじめての送信でも、中身が空（{} や対象外だけ）なら空の行は書かない（D8）。

  return { progress: { challenges, current }, changed };
}
