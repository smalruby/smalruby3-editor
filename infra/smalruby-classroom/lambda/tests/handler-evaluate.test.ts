import {
  validateEvaluateRequest,
  buildEvaluationPrompt,
  parseEvaluationResponse,
} from '../handler';

const validBody = () => ({
  mode: 'grade',
  assignmentName: 'ねこを動かそう',
  assignmentText: 'ねこを10歩動かすプログラムを作ろう',
  rubricAxes: [
    { name: '動くこと', description: 'イベントに接続されて実行される' },
    { name: '要件', description: '10歩動かすブロックがある' },
  ],
  strictness: 'standard',
  samples: [{ seatNumber: 1, grade: 'A', reason: '動くが要件は一部' }],
  submissions: [
    { seatNumber: 2, signals: { wiredScriptCount: 1 }, pseudocode: '◆ スクリプト:\n    緑の旗が押されたとき' },
    { seatNumber: 3, signals: {}, pseudocode: '' },
  ],
});

describe('validateEvaluateRequest', () => {
  test('accepts a valid grade request', () => {
    const request = validateEvaluateRequest(validBody());
    expect(request.mode).toBe('grade');
    expect(request.rubricAxes).toHaveLength(2);
    expect(request.samples).toHaveLength(1);
    expect(request.submissions).toHaveLength(2);
  });

  test('rejects unknown mode', () => {
    expect(() => validateEvaluateRequest({ ...validBody(), mode: 'rank' })).toThrow('mode must be');
  });

  test('grade mode requires 1-6 rubric axes', () => {
    expect(() => validateEvaluateRequest({ ...validBody(), rubricAxes: [] })).toThrow('rubricAxes');
    const seven = Array.from({ length: 7 }, (_, i) => ({ name: `軸${i}` }));
    expect(() => validateEvaluateRequest({ ...validBody(), rubricAxes: seven })).toThrow('rubricAxes');
  });

  test('comment mode does not require rubric axes', () => {
    const request = validateEvaluateRequest({ ...validBody(), mode: 'comment', rubricAxes: [] });
    expect(request.mode).toBe('comment');
  });

  test('rejects bad sample grades and too many samples', () => {
    expect(() =>
      validateEvaluateRequest({ ...validBody(), samples: [{ seatNumber: 1, grade: 'D' }] }),
    ).toThrow('grade must be');
    const six = Array.from({ length: 6 }, (_, i) => ({ seatNumber: i + 1, grade: 'A' }));
    expect(() => validateEvaluateRequest({ ...validBody(), samples: six })).toThrow('at most 5');
  });

  test('rejects empty or oversized submissions list', () => {
    expect(() => validateEvaluateRequest({ ...validBody(), submissions: [] })).toThrow('submissions');
    const eleven = Array.from({ length: 11 }, (_, i) => ({ seatNumber: i + 1, pseudocode: '' }));
    expect(() => validateEvaluateRequest({ ...validBody(), submissions: eleven })).toThrow('submissions');
  });

  test('truncates oversized pseudocode with a marker', () => {
    const body = validBody();
    body.submissions[0].pseudocode = 'あ'.repeat(5000);
    const request = validateEvaluateRequest(body);
    expect(request.submissions[0].pseudocode.length).toBeLessThan(4100);
    expect(request.submissions[0].pseudocode).toContain('…(以降省略)');
  });

  test('defaults strictness to standard', () => {
    const request = validateEvaluateRequest({ ...validBody(), strictness: 'brutal' });
    expect(request.strictness).toBe('standard');
  });
});

describe('buildEvaluationPrompt', () => {
  test('grade prompt carries axes, samples, strictness and submissions', () => {
    const { system, user } = buildEvaluationPrompt(validateEvaluateRequest(validBody()));
    expect(system).toContain('S / A / B / C');
    expect(system).toContain('1. 動くこと — イベントに接続されて実行される');
    expect(system).toContain('needsReview');
    expect(system).toContain('標準');
    expect(user).toContain('課題名: ねこを動かそう');
    expect(user).toContain('較正サンプル');
    expect(user).toContain('- 出席番号1: A（動くが要件は一部）');
    expect(user).toContain('--- 出席番号2 ---');
    expect(user).toContain('"wiredScriptCount":1');
    expect(user).toContain('(提出なし/空)');
  });

  test('comment prompt is student-facing and forbids grades', () => {
    const { system } = buildEvaluationPrompt(
      validateEvaluateRequest({ ...validBody(), mode: 'comment', rubricAxes: [] }),
    );
    expect(system).toContain('ポジティブな返却コメント');
    expect(system).toContain('45〜120文字');
    expect(system).toContain('評点・順位・他の生徒との比較は書かない');
  });
});

describe('parseEvaluationResponse', () => {
  test('parses a clean grade response', () => {
    const text = '{"results":[{"seatNumber":2,"grade":"A","reason":"◆で動く","needsReview":false}]}';
    const results = parseEvaluationResponse(text, 'grade', [2]);
    expect(results).toEqual([{ seatNumber: 2, grade: 'A', reason: '◆で動く', needsReview: false }]);
  });

  test('tolerates code fences and stray prose', () => {
    const text = 'はい、評価します。\n```json\n{"results":[{"seatNumber":2,"grade":"S","reason":"x"}]}\n```';
    const results = parseEvaluationResponse(text, 'grade', [2]);
    expect(results[0].grade).toBe('S');
    expect(results[0].needsReview).toBe(false);
  });

  test('missing seats come back as needsReview C, invalid grades dropped', () => {
    const text = '{"results":[{"seatNumber":2,"grade":"D","reason":"bad"}]}';
    const results = parseEvaluationResponse(text, 'grade', [2, 3]);
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.grade).toBe('C');
      expect(result.needsReview).toBe(true);
    }
  });

  test('comment mode parses comments and caps length', () => {
    const long = 'よ'.repeat(600);
    const text = `{"results":[{"seatNumber":2,"comment":"${long}"}]}`;
    const results = parseEvaluationResponse(text, 'comment', [2]);
    expect((results[0].comment as string).length).toBeLessThanOrEqual(500);
  });

  test('throws on non-JSON responses', () => {
    expect(() => parseEvaluationResponse('ごめんなさい、できません', 'grade', [1])).toThrow('no JSON');
    expect(() => parseEvaluationResponse('{broken', 'grade', [1])).toThrow();
  });
});
