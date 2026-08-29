/**
 * Claude 連携プロンプト生成 (バグ報告)。
 *
 * バグ報告の受付・改修・返信は Claude の /bug-report スキル
 * (.claude/skills/bug-report/SKILL.md) で進める運用。この lib は報告の
 * 状態に応じた「次にやること」のプロンプト案を組み立て、管理画面から
 * ワンクリックでコピーして Claude に貼れるようにする。
 *
 * スキル仕様に合わせる点:
 * - サブコマンド: show / issue / reply <reportId> [stg|prod]
 * - ステージ引数は prod がデフォルトなので stg のときだけ付ける
 * - 返信 (developerReply) は子どもが読む前提のやさしい日本語
 * - メールアドレスはマスキングされる前提 (プロンプトには含めない)
 */

/**
 * @param {string} [stage] - deployment stage
 * @returns {string} the stage argument for the skill ('' on prod)
 */
const stageArg = stage => (stage && stage !== 'prod' ? ` ${stage}` : '');

/**
 * 報告の 1 行コンテキスト (コピペ先で取り違えに気付けるように)。
 * メールは含めない (スキル側のマスキング方針に合わせる)。
 * @param {object} report - report detail
 * @returns {string} one-line summary
 */
const contextLine = report => {
    const name = report.projectName || '(プロジェクト名なし)';
    const desc = String(report.description || '').slice(0, 60);
    return `# ${name} / ${String(report.createdAt || '').slice(0, 10)} / ${desc}`;
};

/**
 * 状態に応じた Claude 向けプロンプト案を返す。
 * @param {object} report - report detail ({reportId, status, ...})
 * @param {string} [stage] - 'stg' | 'prod' (既定 prod)
 * @returns {{key: string, title: string, prompt: string}[]} suggestions
 */
const buildClaudePrompts = (report, stage) => {
    const id = report.reportId;
    const s = stageArg(stage);
    const ctx = contextLine(report);

    if (report.status === 'open') {
        return [
            {
                key: 'triage',
                title: '受付 → 再現確認 → Issue 化',
                prompt: `/bug-report show ${id}${s}

${ctx}
上記の不具合報告を受け付けてください。添付作品をダウンロードして再現確認し、\
再現したら /bug-report issue ${id}${s} で GitHub Issue 化してください。\
最後に /bug-report reply ${id}${s} で状態を in_progress にし、\
報告者へ「受け付けました」のやさしい返信を書き戻してください。`
            },
            {
                key: 'quick-look',
                title: 'まず内容だけ確認',
                prompt: `/bug-report show ${id}${s}

${ctx}
上記の不具合報告の内容と添付を確認して、再現手順・原因の当たり・対応の要否を要約してください。書き戻しはまだしないでください。`
            }
        ];
    }

    if (report.status === 'in_progress') {
        return [
            {
                key: 'fix',
                title: '改修を進める',
                prompt: `/bug-report show ${id}${s}

${ctx}
上記の不具合報告は対応中です。関連する GitHub Issue と修正状況を確認し、未修正なら原因を特定して改修を進めてください（TDD で。トピックブランチ + PR の通常フロー）。`
            },
            {
                key: 'resolve',
                title: '修正済み → 解決の返信',
                prompt: `/bug-report reply ${id}${s}

${ctx}
上記の不具合の修正がリリース済みです。状態を resolved にして、報告者へ修正内容のやさしい返信（子ども向けの日本語）を書き戻してください。`
            }
        ];
    }

    // resolved / wont_fix — 完了後の見直し・再開
    return [
        {
            key: 'reopen',
            title: '対応を再開する',
            prompt: `/bug-report show ${id}${s}

${ctx}
上記の報告は完了扱い（${report.status}）ですが、対応を再開します。内容を再確認し、\
/bug-report reply ${id}${s} で状態を open に戻して（自動削除タイマーが解除されます）、\
次のアクションを提案してください。`
        }
    ];
};

export {buildClaudePrompts};
