import {buildClaudePrompts} from '../../src/lib/bug-report-prompts.js';

const report = {
    reportId: 'abcd1234-5678-90ef-ghij-klmnopqrstuv',
    projectName: 'ねこあつめ',
    description: 'ブロックが消える',
    createdAt: '2026-07-18T00:00:00.000Z',
    status: 'open'
};

describe('buildClaudePrompts (/bug-report スキル連携)', () => {
    test('open: 受付〜Issue 化 と 内容確認 の 2 案、フル reportId 入り', () => {
        const prompts = buildClaudePrompts(report, 'prod');
        expect(prompts.map(p => p.key)).toEqual(['triage', 'quick-look']);
        expect(prompts[0].prompt).toContain(`/bug-report show ${report.reportId}`);
        expect(prompts[0].prompt).toContain('in_progress');
        expect(prompts[0].prompt).toContain('やさしい返信');
        // 取り違え防止のコンテキスト行 (メールは含めない)
        expect(prompts[0].prompt).toContain('# ねこあつめ / 2026-07-18 / ブロックが消える');
    });

    test('stg では skill のステージ引数が付き、prod では付かない (スキルの既定が prod)', () => {
        const stg = buildClaudePrompts(report, 'stg');
        expect(stg[0].prompt).toContain(`/bug-report show ${report.reportId} stg`);
        const prod = buildClaudePrompts(report, 'prod');
        expect(prod[0].prompt).not.toContain(' stg');
    });

    test('in_progress: 改修続行 と 解決の返信 (reply サブコマンド)', () => {
        const prompts = buildClaudePrompts({...report, status: 'in_progress'}, 'prod');
        expect(prompts.map(p => p.key)).toEqual(['fix', 'resolve']);
        expect(prompts[1].prompt).toContain(`/bug-report reply ${report.reportId}`);
        expect(prompts[1].prompt).toContain('resolved');
    });

    test('resolved / wont_fix: 再開プロンプト (open へ戻すと TTL 解除の注意つき)', () => {
        for (const status of ['resolved', 'wont_fix']) {
            const prompts = buildClaudePrompts({...report, status}, 'prod');
            expect(prompts.map(p => p.key)).toEqual(['reopen']);
            expect(prompts[0].prompt).toContain('open に戻して');
            expect(prompts[0].prompt).toContain('自動削除タイマー');
        }
    });
});
