'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    REVIEW_FINDINGS_MARKER_PREFIX,
    reviewFindingsMarker,
    parseReviewFindingsRound,
    nextReviewFindingsRound,
    findReviewFindingsComment,
    parseReviewFindingId,
    parseReviewFindings,
    countReviewFindings,
    nextReviewFindingNumbers,
    assignReviewFindingIds,
    renderReviewFindingsComment,
    parseFindingReferences,
    resolveFindingAction,
    planAddressReview,
} = require('../src/phases');

const combined = (round, lines) => ({
    body: [reviewFindingsMarker(round), '🤖 敵対的レビュー', ...lines].join('\n'),
});

test('reviewFindingsMarker / parseReviewFindingsRound: round を往復できる（#1248）', () => {
    assert.equal(reviewFindingsMarker(2), '<!-- autopilot-review-findings round=2 -->');
    assert.ok(reviewFindingsMarker(1).startsWith(REVIEW_FINDINGS_MARKER_PREFIX));
    assert.equal(parseReviewFindingsRound(reviewFindingsMarker(3) + '\nbody'), 3);
    assert.equal(parseReviewFindingsRound('**[Must]** 旧形式'), null);
    assert.equal(parseReviewFindingsRound(null), null);
});

test('nextReviewFindingsRound: 既存まとめコメントの最大 round + 1', () => {
    assert.equal(nextReviewFindingsRound([]), 1);
    assert.equal(nextReviewFindingsRound(undefined), 1);
    assert.equal(nextReviewFindingsRound([combined(1, []), { body: 'LGTM' }, combined(2, [])]), 3);
});

test('findReviewFindingsComment: 同じ round のまとめコメントを返す（冪等判定）', () => {
    const c1 = { id: 10, ...combined(1, []) };
    const c2 = { id: 11, ...combined(2, []) };
    assert.equal(findReviewFindingsComment([c1, c2], 2), c2);
    assert.equal(findReviewFindingsComment([c1], 2), null);
    assert.equal(findReviewFindingsComment(undefined, 1), null);
});

test('parseReviewFindingId: 表記ゆれ（大小文字・Question1・Must1・F1・全角数字）を正規化する', () => {
    const q1 = { id: 'Q1', category: 'Question', number: 1 };
    assert.deepEqual(parseReviewFindingId('Q1'), q1);
    assert.deepEqual(parseReviewFindingId('q1'), q1);
    assert.deepEqual(parseReviewFindingId('Question1'), q1);
    assert.deepEqual(parseReviewFindingId('Ｑ１'), q1);
    assert.deepEqual(parseReviewFindingId('M2'), { id: 'M2', category: 'Must', number: 2 });
    assert.deepEqual(parseReviewFindingId('must2'), { id: 'M2', category: 'Must', number: 2 });
    assert.deepEqual(parseReviewFindingId('FYI3'), { id: 'FYI3', category: 'FYI', number: 3 });
    assert.deepEqual(parseReviewFindingId('F3'), { id: 'FYI3', category: 'FYI', number: 3 });
    assert.equal(parseReviewFindingId('X1'), null);
    assert.equal(parseReviewFindingId('Q0'), null);
    assert.equal(parseReviewFindingId(''), null);
});

test('parseReviewFindings: まとめコメント内の複数指摘を ID 付きで抜き出す', () => {
    const c = combined(1, [
        '### Must',
        '- **[M1]** `a.js:10` null 未処理 — 修正済み（abc123）',
        '### Question',
        '- **[Q1]** `b.js:3` 命名',
        '- **[Q2]** `b.js:9` 競合',
        '### FYI',
        '- **[FYI1]** `c.js:1` 整理の余地',
    ]);
    assert.deepEqual(parseReviewFindings(c.body).map(f => f.id), ['M1', 'Q1', 'Q2', 'FYI1']);
    assert.equal(parseReviewFindings(c.body)[2].category, 'Question');
});

test('parseReviewFindings: 旧形式（1 コメント 1 マーカー）は ID なし 1 件として扱う', () => {
    assert.deepEqual(parseReviewFindings('**[Must]** バグ'), [{ id: null, category: 'Must', number: null }]);
    assert.deepEqual(parseReviewFindings('人間のコメント Q1 はOK'), []);
    assert.deepEqual(parseReviewFindings(null), []);
});

test('countReviewFindings: 1 コメント内の複数指摘を数え、旧形式とも合算する（後方互換）', () => {
    const comments = [
        { body: '**[Must]** 旧形式のバグ' },
        { body: '**[FYI]** 旧形式の気になる点' },
        combined(1, ['- **[M1]** a', '- **[Q1]** b', '- **[Q2]** c', '- **[FYI1]** d']),
        { body: '<!-- autopilot-sticky-status -->\n## 🤖 autopilot status' },
        { body: 'Q1はOK, FYI1は修正して' },
    ];
    assert.deepEqual(countReviewFindings(comments), { Must: 2, Question: 2, FYI: 2 });
});

test('countReviewFindings: 同じ ID が複数コメントにあっても 1 件（再掲・編集で二重計上しない）', () => {
    const comments = [combined(1, ['- **[M1]** a']), combined(1, ['- **[M1]** a', '- **[M1]** a'])];
    assert.deepEqual(countReviewFindings(comments), { Must: 1, Question: 0, FYI: 0 });
});

test('nextReviewFindingNumbers: 再レビューでは連番を継続する', () => {
    assert.deepEqual(nextReviewFindingNumbers([]), { Must: 1, Question: 1, FYI: 1 });
    const comments = [combined(1, ['- **[M1]** a', '- **[Q1]** b', '- **[Q2]** c'])];
    assert.deepEqual(nextReviewFindingNumbers(comments), { Must: 2, Question: 3, FYI: 1 });
});

test('assignReviewFindingIds: 分類順（Must→Question→FYI）に並べて開始番号から採番する', () => {
    const findings = [
        { category: 'FYI', text: 'f' },
        { category: 'Question', text: 'q-a' },
        { category: 'Must', text: 'm' },
        { category: 'Question', text: 'q-b' },
    ];
    const out = assignReviewFindingIds(findings, { Must: 2, Question: 3, FYI: 1 });
    assert.deepEqual(out.map(f => [f.id, f.text]), [['M2', 'm'], ['Q3', 'q-a'], ['Q4', 'q-b'], ['FYI1', 'f']]);
    assert.deepEqual(assignReviewFindingIds(findings).map(f => f.id), ['M1', 'Q1', 'Q2', 'FYI1']);
    // 未知分類は捨てる
    assert.deepEqual(assignReviewFindingIds([{ category: 'Nope', text: 'x' }]), []);
});

test('renderReviewFindingsComment: サマリ先頭・分類見出し・ID・場所・対応を 1 コメントにまとめる', () => {
    const body = renderReviewFindingsComment({
        round: 2,
        start: { Must: 1, Question: 3, FYI: 1 },
        findings: [
            { category: 'Must', location: 'src/a.js:10', text: 'null 未処理', handling: '修正済み（abc1234）' },
            { category: 'Question', location: 'src/b.js:3', text: '命名' },
            { category: 'FYI', text: '整理の余地' },
        ],
    });
    const lines = body.split('\n');
    assert.equal(lines[0], '<!-- autopilot-review-findings round=2 -->');
    assert.match(lines[1], /指摘 3 件（Must 1 \/ Question 1 \/ FYI 1）/);
    assert.match(body, /- \*\*\[M1\]\*\* `src\/a\.js:10` null 未処理 — 修正済み（abc1234）/);
    assert.match(body, /- \*\*\[Q3\]\*\* `src\/b\.js:3` 命名/);
    assert.match(body, /- \*\*\[FYI1\]\*\* 整理の余地/);
    assert.ok(body.indexOf('### Must') < body.indexOf('### Question'));
    assert.ok(body.indexOf('### Question') < body.indexOf('### FYI'));
    // 自分自身を解析すると同じ件数・ID になる（往復）
    assert.deepEqual(parseReviewFindings(body).map(f => f.id), ['M1', 'Q3', 'FYI1']);
    assert.equal(parseReviewFindingsRound(body), 2);
});

test('renderReviewFindingsComment: 指摘 0 件でもマーカー + 「指摘なし。」を残す', () => {
    const body = renderReviewFindingsComment({ round: 1, findings: [] });
    assert.match(body, /^<!-- autopilot-review-findings round=1 -->\n.*指摘なし。/);
    assert.deepEqual(parseReviewFindings(body), []);
});

test('parseFindingReferences: 「Q1はOK, FYI1は修正して」を ID ごとの指示に分解する（#1248 DoD）', () => {
    assert.deepEqual(parseFindingReferences('Q1はOK, FYI1は修正して'), [
        { id: 'Q1', category: 'Question', instruction: 'ok' },
        { id: 'FYI1', category: 'FYI', instruction: 'fix' },
    ]);
});

test('parseFindingReferences: 表記ゆれ・区切り・複数 ID・その他の指示', () => {
    assert.deepEqual(parseFindingReferences('ｑ１はそのままで。must2 直して\nf1 これはなぜ？'), [
        { id: 'Q1', category: 'Question', instruction: 'ok' },
        { id: 'M2', category: 'Must', instruction: 'fix' },
        { id: 'FYI1', category: 'FYI', instruction: 'other' },
    ]);
    assert.deepEqual(
        parseFindingReferences('Q1とQ2はOK').map(r => [r.id, r.instruction]),
        [['Q1', 'ok'], ['Q2', 'ok']],
    );
    // 否定（修正しなくて良い）は OK 扱い
    assert.equal(parseFindingReferences('Q1は修正しなくていい')[0].instruction, 'ok');
    // ID でない英数字に誤マッチしない
    assert.deepEqual(parseFindingReferences('HTTP2 と MQ1x と AM1 は関係ない'), []);
    // 同じ ID が複数回出たら後勝ち
    assert.deepEqual(parseFindingReferences('Q1はOK。やっぱり Q1 直して'), [
        { id: 'Q1', category: 'Question', instruction: 'fix' },
    ]);
    assert.deepEqual(parseFindingReferences(''), []);
    assert.deepEqual(parseFindingReferences(null), []);
});

test('parseFindingReferences: ID だけの節は次の節の指示を引き継ぐ（「Q1, Q2は直して」）', () => {
    assert.deepEqual(
        parseFindingReferences('Q1, Q2は直して').map(r => [r.id, r.instruction]),
        [['Q1', 'fix'], ['Q2', 'fix']],
    );
    assert.deepEqual(
        parseFindingReferences('Q1、FYI1 は OK').map(r => [r.id, r.instruction]),
        [['Q1', 'ok'], ['FYI1', 'ok']],
    );
    // ID の後に ID なしの節で指示
    assert.equal(parseFindingReferences('Q1, 直してください')[0].instruction, 'fix');
    // 指示が続かなければ other。既にある指示は上書きしない
    assert.equal(parseFindingReferences('Q1')[0].instruction, 'other');
    assert.equal(parseFindingReferences('Q1はOK。Q1')[0].instruction, 'ok');
});

test('parseFindingReferences: 引用行（Quote reply）の bot 本文を人間の指示と取り違えない', () => {
    const reply = ['> - **[FYI1]** `c.js:1` x の修正の余地', '', 'FYI2はそのままで'].join('\n');
    assert.deepEqual(parseFindingReferences(reply), [{ id: 'FYI2', category: 'FYI', instruction: 'ok' }]);
});

test('parseFindingReferences: ファイル名の `.` で節を割らない', () => {
    assert.equal(parseFindingReferences('Q1 の b.js は直して')[0].instruction, 'fix');
});

test('assignReviewFindingIds: 分類名の大小文字ゆれ（"must"）を黙って捨てない', () => {
    const out = assignReviewFindingIds([{ category: 'must', text: 'm' }, { category: 'fyi', text: 'f' }]);
    assert.deepEqual(out.map(f => [f.id, f.category]), [['M1', 'Must'], ['FYI1', 'FYI']]);
});

test('resolveFindingAction: 人間の指示が既定方針より優先、指示なしは既定方針', () => {
    assert.equal(resolveFindingAction('FYI', 'fix'), 'fix');
    assert.equal(resolveFindingAction('Must', 'ok'), 'no-change');
    assert.equal(resolveFindingAction('Question', 'other'), 'reply');
    assert.equal(resolveFindingAction('Must', null), 'fix');
    assert.equal(resolveFindingAction('Question', undefined), 'fix-or-hitl');
    assert.equal(resolveFindingAction('FYI', null), 'ignore');
});

test('planAddressReview: 「Q1はOK, FYI1は修正して」→ Q1 は変更なし・FYI1 は修正、未言及は既定方針', () => {
    const comments = [
        combined(1, ['- **[M1]** a', '- **[Q1]** b', '- **[Q2]** c', '- **[FYI1]** d', '- **[FYI2]** e']),
    ];
    const plan = planAddressReview(comments, ['Q1はOK, FYI1は修正して']);
    assert.deepEqual(plan.map(p => [p.id, p.action, p.source]), [
        ['M1', 'fix', 'policy'],
        ['Q1', 'no-change', 'human'],
        ['Q2', 'fix-or-hitl', 'policy'],
        ['FYI1', 'fix', 'human'],
        ['FYI2', 'ignore', 'policy'],
    ]);
});

test('planAddressReview: 存在しない ID への言及は無視し、旧形式コメントは計画に載らない', () => {
    const comments = [{ body: '**[Must]** 旧形式' }, combined(1, ['- **[Q1]** b'])];
    const plan = planAddressReview(comments, ['Q9 直して', 'q1 直して']);
    assert.deepEqual(plan.map(p => [p.id, p.action, p.source]), [['Q1', 'fix', 'human']]);
    assert.deepEqual(planAddressReview([], []), []);
});
