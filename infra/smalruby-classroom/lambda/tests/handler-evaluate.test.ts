import {
  validateEvaluateRequest,
  buildEvaluationPrompt,
  parseEvaluationResponse,
  parseDescribeResponse,
  parseRubricResponse,
  parseFairnessResponse,
  fairnessKnownSeats,
  evaluationResponseBody,
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

// --- rubric-aware modes (#2422) ---
describe('evaluate: rubric-aware grade and the new modes (#2422)', () => {
  const levels = [
    { grade: 'S', text: 'LED を順につけ、待つ時間も変えている' },
    { grade: 'A', text: 'LED を順につけている' },
    { grade: 'B', text: 'LED を1つだけつけている' },
    { grade: 'C', text: 'スターターのまま' },
  ];
  const examples = [
    { seatNumber: 4, grade: 'A', reason: '順につけている', group: '順につける', code: '◆ 旗\n  LED1 をつける\n  LED2 をつける' },
    { seatNumber: 7, grade: 'C', reason: '何も足していない', group: 'そのまま', code: '◆ 旗' },
  ];

  test('grade without the new fields keeps the old prompt', () => {
    const { system } = buildEvaluationPrompt(validateEvaluateRequest(validBody()));
    expect(system).not.toContain('スターター');
    expect(system).not.toContain('同じ形の作品');
    expect(system).not.toContain('評価の基準:');
  });

  test('grade with rubricLevels does not require rubricAxes', () => {
    const request = validateEvaluateRequest({ ...validBody(), rubricAxes: [], rubricLevels: levels });
    expect(request.rubricLevels).toHaveLength(4);
    expect(request.rubricAxes).toHaveLength(0);
  });

  test('grade prompt puts starter, levels and examples in the cached system prompt', () => {
    const request = validateEvaluateRequest({
      ...validBody(), starterPseudocode: '◆ 旗', rubricLevels: levels, examples,
    });
    const { system, user } = buildEvaluationPrompt(request);
    expect(system).toContain('足したところ・変えたところ');
    expect(system).toContain('同じ形の作品');
    expect(system).toContain('- S: LED を順につけ');
    expect(system).toContain('--- 正解の例1: A（まとまり「順につける」） ---');
    expect(system).toContain('--- 正解の例2: C（まとまり「そのまま」） ---');
    expect(system).not.toContain('出席番号4');
    expect(system).not.toContain('出席番号7');
    expect(system).toContain('「正解の例1」のように例の番号で呼び、出席番号では呼ばないでください');
    expect(system).toContain('スターター（先生が配った最初のプロジェクト）の擬似コード:');
    expect(user).toContain('出席番号2');
  });

  test('examples are numbered by order in every mode, never by seat', () => {
    const groups = [{ name: '順につける', seatNumbers: [4, 5], submissions: [{ seatNumber: 5, pseudocode: '◆ 旗' }] }];
    for (const body of [
      { mode: 'rubric', examples },
      { mode: 'fairness', examples, groups },
    ]) {
      const { system, user } = buildEvaluationPrompt(validateEvaluateRequest(body));
      expect(user).toContain('--- 正解の例1: A（まとまり「順につける」） ---');
      expect(user).toContain('--- 正解の例2: C（まとまり「そのまま」） ---');
      expect(user).not.toMatch(/正解の例 ?出席番号/);
      expect(system).toContain('「正解の例1」のように例の番号で呼び、出席番号では呼ばないでください');
    }
    const fairness = buildEvaluationPrompt(validateEvaluateRequest({ mode: 'fairness', examples, groups }));
    expect(fairness.system).toContain('正解の例は入れないでください');
    // Without examples, grade does not mention how to refer to them.
    const plain = buildEvaluationPrompt(validateEvaluateRequest(validBody()));
    expect(plain.system).not.toContain('例の番号で呼び');
  });

  test('rejects bad rubric levels and too many examples', () => {
    expect(() => validateEvaluateRequest({ ...validBody(), rubricLevels: [{ grade: 'D', text: 'x' }] }))
      .toThrow('rubricLevels[0].grade');
    expect(() => validateEvaluateRequest({ ...validBody(), rubricLevels: [levels[0], levels[0]] }))
      .toThrow('duplicated');
    const many = Array.from({ length: 21 }, (_, i) => ({ seatNumber: i + 1, grade: 'A' }));
    expect(() => validateEvaluateRequest({ ...validBody(), examples: many })).toThrow('at most 20');
  });

  test('describe needs submissions and asks for a description', () => {
    const request = validateEvaluateRequest({
      mode: 'describe', starterPseudocode: '◆ 旗', submissions: validBody().submissions,
    });
    const { system, user } = buildEvaluationPrompt(request);
    expect(system).toContain('{"description":"…"}');
    expect(user).toContain('スターター');
    expect(user).toContain('生徒の作品:');
    expect(() => validateEvaluateRequest({ mode: 'describe', submissions: [] })).toThrow('submissions');
    // With works, the teacher checks the draft against the works (unchanged, #2515).
    expect(system).toContain('合っていますか？');
    expect(system).not.toContain('生徒に見せる');
  });

  test('describe drafts a student-facing description from the starter alone (#2515)', () => {
    const request = validateEvaluateRequest({ mode: 'describe', assignmentName: 'LED', starterPseudocode: '◆ 旗' });
    expect(request.submissions).toHaveLength(0);
    const { system, user } = buildEvaluationPrompt(request);
    expect(system).toContain('生徒に見せる');
    expect(system).toContain('300文字以内');
    expect(system).toContain('{"description":"…"}');
    expect(system).not.toContain('合っていますか？');
    expect(user).toContain('スターター（先生が配った最初のプロジェクト）の擬似コード:');
    expect(user).not.toContain('生徒の作品:');
  });

  test('describe without starter and works is still rejected (#2515)', () => {
    expect(() => validateEvaluateRequest({ mode: 'describe' })).toThrow('submissions');
    expect(() => validateEvaluateRequest({ mode: 'describe', starterPseudocode: '', submissions: [] }))
      .toThrow('submissions');
    expect(() => validateEvaluateRequest({ mode: 'describe', starterPseudocode: ' \n ', submissions: [] }))
      .toThrow('submissions');
    const many = Array.from({ length: 11 }, (_, i) => ({ seatNumber: i + 1 }));
    expect(() => validateEvaluateRequest({ mode: 'describe', starterPseudocode: '◆ 旗', submissions: many }))
      .toThrow('submissions');
  });

  test('rubric needs examples, not submissions', () => {
    const request = validateEvaluateRequest({ mode: 'rubric', assignmentText: 'LED', examples });
    expect(request.submissions).toHaveLength(0);
    const { system, user } = buildEvaluationPrompt(request);
    expect(system).toContain('"levels"');
    expect(user).toContain('理由: 順につけている');
    expect(() => validateEvaluateRequest({ mode: 'rubric' })).toThrow('examples');
  });

  test('fairness needs examples and groups', () => {
    const groups = [{ name: '順につける', seatNumbers: [4, 5, 6], submissions: [{ seatNumber: 5, pseudocode: '◆ 旗' }] }];
    const request = validateEvaluateRequest({ mode: 'fairness', examples, groups });
    const { user } = buildEvaluationPrompt(request);
    expect(user).toContain('=== まとまり「順につける」 出席番号: 4, 5, 6 ===');
    expect(() => validateEvaluateRequest({ mode: 'fairness', examples })).toThrow('groups');
    const big = [{ name: 'g', seatNumbers: [], submissions: Array.from({ length: 21 }, (_, i) => ({ seatNumber: i + 1 })) }];
    expect(() => validateEvaluateRequest({ mode: 'fairness', examples, groups: big })).toThrow();
  });
});

describe('evaluation response parsing for the new modes (#2422)', () => {
  test('describe', () => {
    expect(parseDescribeResponse('```json\n{"description":" LED を順につける "}\n```'))
      .toEqual({ description: 'LED を順につける' });
    expect(() => parseDescribeResponse('{"description":""}')).toThrow();
  });

  test('rubric returns S→C order and drops bad entries', () => {
    const text = '{"levels":[{"grade":"B","text":"b"},{"grade":"S","text":"s"},{"grade":"X","text":"x"},{"grade":"S","text":"dup"}]}';
    expect(parseRubricResponse(text)).toEqual({ levels: [{ grade: 'S', text: 's' }, { grade: 'B', text: 'b' }] });
    expect(() => parseRubricResponse('{"levels":[]}')).toThrow();
  });

  test('fairness keeps known seats only and needs two options', () => {
    const text = JSON.stringify({ checks: [
      { question: '4 と 5 は同じ形ですが評価が違います。どちらに合わせますか？', options: ['A', 'B'], seatNumbers: [4, 5, 99] },
      { question: '選択肢が1つ', options: ['A'], seatNumbers: [4] },
      { question: '', options: ['A', 'B'] },
    ] });
    expect(parseFairnessResponse(text, [4, 5])).toEqual({ checks: [
      { question: '4 と 5 は同じ形ですが評価が違います。どちらに合わせますか？', options: ['A', 'B'], seatNumbers: [4, 5] },
    ] });
    expect(parseFairnessResponse('{"checks":[]}', [])).toEqual({ checks: [] });
  });

  test('evaluationResponseBody dispatches by mode', () => {
    const examples = [{ seatNumber: 4, grade: 'A', reason: 'r', code: 'c' }];
    const groups = [{ name: 'g', seatNumbers: [5], submissions: [] }];
    const request = validateEvaluateRequest({ mode: 'fairness', examples, groups });
    expect(fairnessKnownSeats(request).sort()).toEqual([4, 5]);
    expect(evaluationResponseBody('{"checks":[]}', request)).toEqual({ mode: 'fairness', checks: [] });
    const grade = validateEvaluateRequest(validBody());
    const body = evaluationResponseBody('{"results":[]}', grade);
    expect(body.mode).toBe('grade');
    expect(body.results).toHaveLength(2);
  });
});
