'use strict';
/**
 * phases.js — フェーズ↔スキルの対応、結果→Project フィールド意図への変換、
 * watchdog の判断ロジック。すべて純粋関数（I/O なし）でテスト可能にする。
 */

/**
 * 子 claude を起動する既定コマンド。
 * **非対話**で動かすため `--allowedTools` を広げ、`gh`/`git` 等の Bash 実行で
 * 権限プロンプト（= 課題2 の停止要因）が出ないようにする。コントラクト §1 準拠。
 * 上書きは CLI の `--command` または env `AUTOPILOT_CLAUDE_CMD`。
 */
const DEFAULT_CLAUDE_COMMAND =
    'claude --permission-mode acceptEdits --allowedTools Bash Edit Read Glob Grep WebFetch';

/** 既定のベースブランチ（PR 先・worktree 分岐元） */
const DEFAULT_BASE_BRANCH = 'develop';

/** autopilot が Issue ごとに切る head ブランチの既定接頭辞（bin/autopilot-worktree と同一規約）。 */
const AUTOPILOT_BRANCH_PREFIX = 'topic/autopilot-';

/**
 * Issue 番号 → autopilot の head ブランチ名（純粋関数）。
 * autopilot の PR は base に関わらず必ずこの head ブランチを持つ（bin/autopilot-worktree が
 * `topic/autopilot-<N>` を切る）。これを使うと PR が非デフォルト base 宛て（EPIC サブ Issue を
 * 親 epic ブランチに積む等）でも base 非依存に PR を特定できる（#831）。
 * @param {number} issueNumber Issue 番号
 * @param {string} [prefix] ブランチ接頭辞（既定 `topic/autopilot-`。呼び出し側が env で上書き可）
 * @returns {string} head ブランチ名
 */
function autopilotHeadBranch(issueNumber, prefix = AUTOPILOT_BRANCH_PREFIX) {
    return `${prefix}${issueNumber}`;
}

/**
 * Issue 本文から「明示的に宣言されたベースブランチ」を抽出する（純粋関数）。
 *
 * 既定では develop から分岐し PR も develop 宛てにするが、EPIC のサブ Issue など
 * 「親 epic ブランチに積みたい」ケースでは、Issue 本文で base を明示できる。実装フェーズの
 * 振る舞いを人間（implement スキルの判断）任せにせず、宣言があれば確実に効かせるための防御策。
 *
 * 認識する書式（いずれか）:
 *  1. ディレクティブ: `autopilot-base: <branch>`。**行頭のみ**反応する（HTML コメントが
 *     行頭から始まる場合は `<!-- autopilot-base: x -->` も可）。本文の途中で
 *     「autopilot-base: と書くと…」のように**言及**しただけでは発火しない。最優先。
 *  2. 「## ベースブランチ」/「base branch」見出し・ラベルの直後にあるバッククォート囲みのブランチ。
 *
 * いずれも無ければ null（= 既定 develop）。誤検出を避けるため、明示宣言があるときだけ返す。
 * @param {string} body Issue 本文
 * @returns {string|null} 宣言されたベースブランチ名、無ければ null
 */
function parseBaseBranch(body) {
    if (!body) return null;
    const directive = body.match(/^(?:<!--\s*)?autopilot-base:\s*`?([\w.\/-]+)`?/im);
    if (directive) return directive[1];
    const section = body.match(/(?:ベースブランチ|base[ -]?branch)[^\n]*\n+[^\n]*?`([\w.\/-]+)`/i);
    if (section) return section[1];
    return null;
}

/**
 * Issue 本文から `autopilot-after:` ディレクティブ（着手順の依存宣言）を抽出する（純粋関数）。
 *
 * `autopilot-after: #123` と宣言すると、その Issue（依存）が完了（GitHub closed または
 * Project Status が終端）するまで autopilot はこの Issue に着手しない。
 * `autopilot-base:` と同じく**行頭のみ**反応する（行頭 HTML コメントも可）。
 * 複数依存はカンマ/空白区切り（`autopilot-after: #12, #34`）、複数行の宣言も合算する。
 * `#` は省略可。重複は除去する。
 * @param {string} body Issue 本文
 * @returns {number[]} 依存 Issue 番号（宣言順・重複なし）
 */
function parseAfterIssues(body) {
    if (!body) return [];
    const out = [];
    const re = /^(?:<!--\s*)?autopilot-after:\s*([^\n]*)/gim;
    let m;
    while ((m = re.exec(body)) !== null) {
        for (const t of m[1].matchAll(/#?(\d+)/g)) out.push(Number(t[1]));
    }
    return [...new Set(out)];
}

/**
 * `autopilot-after:` の依存のうち、まだ完了していないものを返す（純粋関数）。
 * 完了 = GitHub で closed（closedSet に含まれる）または Project Status が終端
 * （{@link TERMINAL_STATUSES}）。Project にも closedSet にも見つからない依存は
 * 「まだ完了していない」と保守的に扱う（依存の消し忘れ・番号ミスを人間が気付ける）。
 * @param {number[]} after 依存 Issue 番号
 * @param {object} ctx { closedSet: Set<number>|number[], statusByIssue: {[issue]: string} }
 * @returns {number[]} 未完了の依存 Issue 番号
 */
function unresolvedAfterIssues(after, ctx = {}) {
    const closed = ctx.closedSet instanceof Set ? ctx.closedSet : new Set(ctx.closedSet || []);
    const statusByIssue = ctx.statusByIssue || {};
    return (after || []).filter((n) => {
        if (closed.has(n)) return false;
        return !TERMINAL_STATUSES.has(statusByIssue[n]);
    });
}

/**
 * CLI コマンド名 → { skill, aiStatus }。
 * `skill` は **フェーズプロンプトのファイル basename**（`tools/autopilot/prompts/<skill>.md`）。
 * 以前は `.claude/skills/` の Skill だったが、開発者が誤ってスラッシュ起動するのを防ぐため
 * `tools/autopilot/prompts/` に移動し、Runner がそのファイルを読ませて実行する（Skill ではない）。
 */
const PHASE_BY_COMMAND = {
    triage: { skill: 'autopilot-triage', aiStatus: 'Triaging' },
    understand: { skill: 'autopilot-understand', aiStatus: 'Understanding' },
    decompose: { skill: 'autopilot-decompose', aiStatus: 'Decomposing' },
    implement: { skill: 'autopilot-implement', aiStatus: 'Implementing' },
    review: { skill: 'autopilot-review', aiStatus: 'Self-Reviewing' },
    'address-review': { skill: 'autopilot-address-review', aiStatus: 'Addressing Comments' },
    verify: { skill: 'autopilot-verify', aiStatus: 'Running DoD' },
};

/** フェーズプロンプトファイルの配置ディレクトリ（worktree/repo 内の相対パス） */
const PROMPT_DIR = 'tools/autopilot/prompts';

/**
 * Runner が対話 Claude に送る起動メッセージを組み立てる（純粋関数）。
 * Skill のスラッシュコマンドではなく、**プロンプトファイルを Read して従わせる**指示にする
 * （プロンプトは Skill ではないので `/autopilot-*` は存在しない）。対象 Issue は env の
 * `AUTOPILOT_ISSUE` にも入るが、確実性のためメッセージにも番号を含める。
 * @param {string} skill プロンプト basename（例 'autopilot-triage'）
 * @param {number|string} issue 対象 Issue 番号
 * @param {string} [promptDir] プロンプト配置ディレクトリ。daemon は起動時スナップショットの
 *   絶対パスを渡す（checkout のブランチ切り替えに非依存）。省略時は worktree 内の相対パス。
 * @returns {string} 送信メッセージ
 */
function phasePromptCommand(skill, issue, promptDir = PROMPT_DIR) {
    return `${promptDir}/${skill}.md を Read して、その手順に厳密に従ってください。` +
        `対象 Issue は AUTOPILOT_ISSUE=${issue} です。`;
}

/**
 * 結果ペイロードを Project フィールドの設定意図に変換する。
 * 値が null のものは「クリア」を意味する。単一ライター原則: 実際の書き込みは
 * daemon/CLI が行う（スキルは書かない）。
 * @param {object} result 検証済み結果ペイロード
 * @returns {Array<{field: string, value: string|null}>}
 */
function applyResult(result) {
    const intents = [];
    const set = (field, value) => intents.push({ field, value });

    // HITL は Project フィールドではなく 🙋 ラベルで表現する（#813）。よって applyResult は
    // HITL 意図を返さない。HITL の希望は {@link hitlDesireFromResult} が結果から導き、
    // daemon が face sync（ラベル付与/除去）として反映する（単一ライター）。
    if (result.signal === 'done') {
        if (result.nextStatus !== undefined) set('Status', result.nextStatus);
        // 完了時は AI Status をクリア（明示指定があればそれを使う）
        set('AI Status', result.nextAiStatus != null ? result.nextAiStatus : null);
        if (result.size != null) set('Size', result.size);
        if (result.kind != null) set('Kind', result.kind);
    } else if (result.signal === 'hitl') {
        if (result.nextStatus != null) set('Status', result.nextStatus);
        if (result.nextAiStatus != null) set('AI Status', result.nextAiStatus);
    } else if (result.signal === 'error') {
        set('Status', 'Blocked');
    }
    return intents;
}

/**
 * 結果から「完了後に人間の番（HITL）になるか」を導く（純粋関数・#813）。
 * done は result.hitl の真偽、hitl / error は常に人間の番（true）。
 * daemon はこの真偽を face sync に渡し、🙋 ラベルの付与/除去を決める。
 * @param {object} result 検証済み結果ペイロード
 * @returns {boolean}
 */
function hitlDesireFromResult(result) {
    if (!result) return false;
    if (result.signal === 'done') return Boolean(result.hitl);
    // signal=hitl / error は人間の対応待ち
    return result.signal === 'hitl' || result.signal === 'error';
}

/**
 * HITL の解除判定（OR セマンティクス・#813 でラベル一本化）。
 *
 * HITL は 🙋 ラベルで表現され、Issue と PR の両面に投影される。人間が両方を外すのは
 * 二重管理で大変なので、**適用される signal のいずれか1つでも No（ラベル除去）になったら
 * 処理を進める**。逆に「人間に渡す（set）」ときは daemon が両面に一括でラベルを付与する。
 *
 * @param {object} signals 各面の "まだ人間待ちか"。true=ラベルあり / false=除去 / undefined=非適用
 * @param {boolean} [signals.issueLabel] Issue に `🙋 HITL` ラベルが付いているか
 * @param {boolean} [signals.prLabel] PR に `🙋 HITL` ラベルが付いているか（PR 無しは undefined）
 * @returns {boolean} 解除されたら true（autopilot は処理を進める）
 */
function isHitlReleased(signals) {
    const applicable = [signals.issueLabel, signals.prLabel].filter((v) => v !== undefined);
    return applicable.some((v) => v === false);
}

/**
 * merge は HITL と独立した「前進シグナル」。PR が merge されたとき、ひも付く Issue を
 * どの Status へ進めるかを返す（純粋関数）。
 * - leaf（Kind=Issue）: `Close`（HITL ラベル/フィールドが残っていても進める）
 * - EPIC: `null`（子 PR の merge では完了しない。EPIC 運用 原則3/4）
 * @param {string} kind `EPIC` | `Issue`（未指定は leaf 扱い）
 * @returns {string|null} 進める先の Status、または進めない場合 null
 */
function progressOnMerge(kind) {
    return kind === 'EPIC' ? null : 'Close';
}

/**
 * merge 後の前進をチェックすべき Status の集合。
 * PR が出た後〜Close 前の leaf だけを対象にする（New Item/Backlog/Sprint Backlog はまだ PR が
 * 無いので除外、Close/Done は終端なので除外）。人間は Review でも DoD でも手動 merge しうるため
 * In Progress / Review / DoD の 3 つを見る。
 */
const MERGE_CHECK_STATUSES = new Set(['In Progress', 'Review', 'DoD']);

/**
 * Project item から「merge 検知の対象（連携 PR が merge 済みか問い合わせる価値がある）」を選ぶ。
 * 純粋関数。GitHub への問い合わせは I/O 側（daemon）が行うので、ここでは候補の絞り込みだけ。
 * @param {object[]} items 各 { issue, status, kind, ... }
 * @returns {object[]} merge チェック対象
 */
function selectMergeCandidates(items) {
    return (items || []).filter(
        (it) => it && !isTrackerItem(it) && MERGE_CHECK_STATUSES.has(it.status),
    );
}

/**
 * 連携 PR の merge を検知したときに Project へ書く意図を返す（純粋関数）。
 * leaf（Kind=Issue）で PR が merge 済みなら Close へ前進し、AI Status をクリアする
 * （merge は HITL と独立した前進シグナル）。HITL の解除（🙋 ラベル除去）は Project フィールド
 * ではなく face sync が行う（#813）ので、ここでは Project 意図に HITL を含めない。
 * EPIC・未 merge・既に target の場合は空配列（冪等）。
 * @param {object} item { status, kind }
 * @param {boolean} prMerged 連携 PR が merge 済みか
 * @returns {Array<{field: string, value: string|null}>}
 */
function mergeProgressionIntents(item, prMerged) {
    if (!prMerged) return [];
    const target = progressOnMerge(item && item.kind);
    if (target == null) return []; // EPIC は子 PR の merge で閉じない
    if (item && item.status === target) return []; // 冪等: 既に Close なら何もしない
    return [
        { field: 'Status', value: target },
        { field: 'AI Status', value: null },
    ];
}

/**
 * 終端 Status の集合。GitHub issue が close 済みでも、Project がこれらなら整合済みとみなす
 * （Close は完了、Done は upstream 由来の完了。これ以外は GitHub と乖離なので reconcile 対象）。
 */
const TERMINAL_STATUSES = new Set(['Close', 'Done']);

/**
 * GitHub で closed な issue のうち、Project Status がまだ終端（Close/Done）でない item を選ぶ
 * （純粋関数・#843）。「GitHub issue 状態 → Project Close」の整合パス用。
 *
 * merge-progression（{@link selectMergeCandidates}）は **leaf の連携 PR merge** だけを見るため、
 * (A) 非デフォルト base 宛て PR で GitHub の `Closes #N` が効かず手動 close した leaf、
 * (B) 統合 PR の `Closes #<epic>` で閉じた EPIC、(C) 人手で閉じた issue が Project に取り残される。
 * ここは **closed という事実だけ**を根拠に整合するので EPIC も対象に含める（子 PR merge とは別経路）。
 * 既に終端の item は除外（冪等）。実行中 item の除外は I/O 側（daemon）が行う。
 * @param {object[]} items 各 { issue, status, kind, ... }
 * @param {Set<number>|number[]} closedSet GitHub で closed な issue 番号の集合（配列も可）
 * @returns {object[]} reconcile 対象（closed かつ非終端）
 */
function selectClosedToReconcile(items, closedSet) {
    const closed = closedSet instanceof Set ? closedSet : new Set(closedSet || []);
    return (items || []).filter(
        (it) => it && closed.has(it.issue) && !TERMINAL_STATUSES.has(it.status),
    );
}

/**
 * PR の承認状態を導く（純粋関数・#815）。
 *
 * GitHub の集約判定 `reviewDecision` は **ブランチ保護でレビューが必須でないと空**になり、
 * 人間が approve しても APPROVED にならない（approved 検知漏れ → approved な PR が前進しない
 * バグの原因だった）。そこで reviewDecision が決め手にならないときは、**個々のレビューの
 * 著者ごとの最新 state** から導く。
 *
 * - reviewDecision が APPROVED / CHANGES_REQUESTED ならそれを尊重（ブランチ保護で必須の場合）。
 * - それ以外（空・REVIEW_REQUIRED 等）は人間レビューの著者ごと最新 state で判定:
 *   - 誰か1人でも最新が CHANGES_REQUESTED → changesRequested（approve より優先）。
 *   - 変更要求が無く、誰か1人でも最新が APPROVED → approved。
 * - COMMENTED / PENDING は承認判断に効かない（コメントは approve を取り消さない）。
 *   DISMISSED は approve でも変更要求でもない中立に戻す。
 * @param {Array<{author?:{login?:string}, state?:string}>} reviews PR の review ノード（古い→新しい順）
 * @param {string} reviewDecision GitHub 集約判定（APPROVED/CHANGES_REQUESTED/REVIEW_REQUIRED/空）
 * @param {(login:string)=>boolean} [isHuman] 人間判定（bot/[bot] を除外）。既定は全員 true
 * @returns {{approved:boolean, changesRequested:boolean}}
 */
function computeReviewApproval(reviews, reviewDecision, isHuman = () => true) {
    if (reviewDecision === 'APPROVED') return { approved: true, changesRequested: false };
    if (reviewDecision === 'CHANGES_REQUESTED') return { approved: false, changesRequested: true };
    const latestByAuthor = new Map();
    for (const r of reviews || []) {
        const login = r && r.author && r.author.login;
        if (!login || !isHuman(login)) continue;
        const state = r.state;
        if (state === 'APPROVED' || state === 'CHANGES_REQUESTED' || state === 'DISMISSED') {
            latestByAuthor.set(login, state); // 古い→新しい順なので最後の代入が最新
        }
    }
    const states = [...latestByAuthor.values()];
    const changesRequested = states.includes('CHANGES_REQUESTED');
    return { approved: !changesRequested && states.includes('APPROVED'), changesRequested };
}

/**
 * 人間がレビュー/検証して 🙋 を外すと autopilot が再開する「人間ゲート」状態。
 * Review（コードレビュー）と DoD（headful 検証）が該当し、いずれも 🙋 解除 = NG 差し戻しで
 * address-review へ渡す（OR セマンティクスも同じ・#821）。OK のときは人間が merge して
 * merge-progression が Close する（解除ではなく前進シグナル）。
 */
const HUMAN_GATE_STATUSES = new Set(['Review', 'DoD']);

/**
 * Project item から「次に autopilot が自律実行すべきフェーズ」を決める（純粋関数）。
 * 人間駆動の状態（Close/Backlog/Icebox/Paused）や 🙋 ラベルあり（人間の番）では null（何もしない）。
 *
 * Review / DoD は特別: 人間がレビュー/検証を終えて HITL を解除したとき、autopilot が再開して
 * 指摘対応（address-review）へ進める。解除判定は OR セマンティクス（Issue・PR の 🙋 ラベルの
 * いずれか1つでも除去なら解除・#813）で、解除シグナルと PR レビュー状態は ctx 経由で daemon が
 * 渡す（純粋性を保つため I/O は外）。DoD は headful 検証の NG 差し戻しで、Review と対称（#821）。
 * @param {object} item { status, aiStatus, hitlLabel, kind }
 * @param {object} [ctx] { review, hitlSignals } — Review/DoD item の付帯情報
 * @returns {string|null} フェーズ名（triage/decompose/implement/address-review ...）または null
 */
function phaseForItem(item, ctx = {}) {
    if (!item) return null;
    // 🧭 tracking ラベル付き = 分解済みの親トラッカー。作業 item ではないので何もしない
    // （完了は closed-reconcile が拾う）。Kind=EPIC でも未分解なら decompose 対象なので
    // ここではラベルだけを見る。
    if (hasTrackingLabel(item)) return null;
    const status = item.status || 'New Item';
    if (HUMAN_GATE_STATUSES.has(status)) {
        // 解除シグナルがあれば OR 判定、無ければ Issue の 🙋 ラベル単独で判定（#813）。
        const released = ctx.hitlSignals
            ? isHitlReleased(ctx.hitlSignals)
            : !item.hitlLabel;
        // 人間が HITL を解除したら、構造化シグナル（approve/changes-requested 等）で機械的に
        // 分岐せず、必ず address-review へ渡す（#815/#821）。address-review スキルが PR の diff と
        // **全コメント（Issue/レビュー本文/インライン）**を読んで意図を分類する:
        //   - 質問・改善依頼 / DoD NG → 対応（コード修正 or 返信）
        //   - LGTM など対応不要 → 何もせず人間の merge を待つ
        //   - 判断がつかない → 人間に質問（HITL）
        // 自由文の分類は純粋関数では不可能なため、判断はスキル側に置く（daemon は dispatch のみ）。
        return released ? 'address-review' : null;
    }
    if (item.hitlLabel) return null; // 人間の番（🙋 ラベルあり）
    if (status === 'New Item') return 'triage';
    if (status === 'Sprint Backlog') {
        return item.kind === 'EPIC' ? 'decompose' : 'implement';
    }
    // In Progress で AI Status=Self-Reviewing は implement 完了直後の状態（#805）。
    // daemon が autopilot-review（敵対的レビュー）を自動ディスパッチして人間レビュー待ちまで進める。
    // それ以外の In Progress は実行中の run が所有する。DoD/Close 等は人間駆動。
    if (status === 'In Progress' && item.aiStatus === 'Self-Reviewing') return 'review';
    return null;
}

/**
 * item が今 autopilot の処理対象か（純粋関数）。
 * @param {object} item
 * @param {object} [opts] { paused, ctx } — ctx は Review item の付帯情報（review/hitlSignals）
 * @returns {boolean}
 */
function isActionable(item, opts = {}) {
    if (opts.paused) return false;
    return phaseForItem(item, opts.ctx || {}) !== null;
}

/**
 * 「In Progress + AI が作業中マーカー」のまま実行中の run が無い＝stall した可能性がある item か
 * （純粋関数・#816）。daemon が再起動して in-memory の running を失った／run が catch を通らず
 * 死んだ場合、Status が In Progress + AI Status=xxxing のまま誰も再 dispatch せず固まる
 * （phaseForItem は In Progress を Self-Reviewing 以外では再開しないため）。
 *
 * Self-Reviewing は次 tick で自動 dispatch（review）されるので stuck 対象外。EPIC Decomposed は
 * decompose が正常終了した EPIC の resting 状態（子の実装待ち）で、run を持たなくて当然なので
 * 対象外（#856）。AI Status が空の In Progress（人間が手で In Progress にした等）も対象外。
 * 実際に「実行中の run が無いか」「十分な時間が経過したか」は I/O・時間を持つ daemon 側で
 * 判定する（ここは形だけ見る）。
 * @param {object} item { status, aiStatus }
 * @returns {boolean}
 */
const STUCK_EXEMPT_AI_STATUSES = new Set(['Self-Reviewing', 'EPIC Decomposed']);
function isStuckCandidate(item) {
    if (!item || item.status !== 'In Progress') return false;
    if (!item.aiStatus || STUCK_EXEMPT_AI_STATUSES.has(item.aiStatus)) return false;
    return true;
}

/**
 * item の決定的な単一オーナーを返す（純粋関数・enroll モデル）。
 * assignee の**辞書順先頭**をオーナーとする。複数 assignee の Issue を複数開発者の
 * daemon が同時に拾わないための決定的なタイブレーク。未 assign は null（オーナー不在）。
 * @param {object} item { assignees?: string[] }
 * @returns {string|null} オーナーの GitHub login、未 assign なら null
 */
function itemOwner(item) {
    const assignees = (item && item.assignees) || [];
    if (!assignees.length) return null;
    return [...assignees].sort()[0];
}

/**
 * enroll 判定: assignee=login で起動した daemon がこの item を処理してよいか（純粋関数）。
 * プロジェクトに携わる開発者が**個人ごとに autopilot を起動する**想定で、
 * 「自分が決定的な単一オーナー（{@link itemOwner}）」の item だけ処理する。
 * 未 assign の item は誰も拾わない（先に assign して enroll する運用）。
 * login 未設定（従来運用・単一 daemon）は全件処理する。
 * @param {object} item { assignees?: string[] }
 * @param {string|null} login 自分の GitHub login（daemon の --assignee）
 * @returns {boolean}
 */
function ownsItem(item, login) {
    if (!login) return true;
    return itemOwner(item) === login;
}

/**
 * Status の表示順ランク（純粋関数）。Project Board view の列順 = Status フィールドの
 * option 定義順に合わせる。'New Item'（No Status）は Board の最左列なので先頭扱い。
 * 未知の Status は末尾。
 * @param {string} status
 * @param {string[]} statusOrder Status フィールドの option 名（定義順）
 * @returns {number}
 */
function statusRank(status, statusOrder) {
    const s = status || 'New Item';
    if (s === 'New Item') return -1;
    const idx = (statusOrder || []).indexOf(s);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

/**
 * item の並びを Project Board view の見た目（Status 列順 + 列内は手動並び順）に揃える
 * （純粋関数）。items は `gh project item-list` の手動並び順で渡ってくる前提。
 * Array.prototype.sort は安定なので、同 Status 内の相対順（手動並び順）は保存される。
 * @param {object[]} items
 * @param {string[]} statusOrder Status フィールドの option 名（定義順）
 * @returns {object[]} 新しい配列（元は破壊しない）
 */
function orderItemsLikeBoard(items, statusOrder) {
    return [...(items || [])].sort(
        (a, b) => statusRank(a && a.status, statusOrder) - statusRank(b && b.status, statusOrder),
    );
}

/**
 * 着手すべき item を並行上限内で選ぶ（純粋関数）。
 * @param {object[]} items 各 { issue, status, aiStatus, hitlLabel, kind, assignees }
 * @param {object} opts { paused, running:Set<number>, limit, contexts, assignee, statusOrder }
 *   contexts は issue 番号 → { review, hitlSignals, pr } の map（Review item の付帯情報）。
 *   assignee を渡すと enroll フィルタ（{@link ownsItem}）が効く。
 *   statusOrder を渡すと投入順を Board view の見た目（{@link orderItemsLikeBoard}）に揃える。
 * @returns {object[]} 実行対象（issue + phase）。Review 由来は pr 番号も付く。
 */
function selectActionable(items, opts = {}) {
    const running = opts.running || new Set();
    const limit = opts.limit ?? 2;
    const contexts = opts.contexts || {};
    const ordered = opts.statusOrder ? orderItemsLikeBoard(items, opts.statusOrder) : (items || []);
    const out = [];
    for (const item of ordered) {
        if (out.length >= Math.max(0, limit - running.size)) break;
        if (running.has(item.issue)) continue;
        if (!ownsItem(item, opts.assignee)) continue;
        const ctx = contexts[item.issue] || {};
        if (!isActionable(item, { paused: opts.paused, ctx })) continue;
        out.push({ ...item, phase: phaseForItem(item, ctx), pr: ctx.pr });
    }
    return out;
}

// ---- PR projection (#794): Issue 状態を PR/Issue の面へ投影する純粋ロジック ----

/** autopilot が管理する PR/Issue に常時付ける管理ラベル */
const AUTOPILOT_LABEL = '🤖 autopilot';
/** 人間の対応待ちを示すラベル（Project HITL=Yes を投影） */
const HITL_LABEL = '🙋 HITL';
/**
 * sub-issue に分解済みの親（トラッカー）を示すラベル。
 * 「作業 item かどうか」を毎 tick GitHub に問い合わせて判定するコストを避け、
 * ラベル 1 つで merge 検知・PR 投影・DoD 引き継ぎ・フェーズ選択から除外できるようにする。
 * daemon が Kind=EPIC の item に自動付与するほか、人間が手動で付けて
 * 任意の Issue をトラッカー扱いにもできる（外せば作業 item に戻る）。
 */
const TRACKING_LABEL = '🧭 tracking';

/**
 * item がトラッカー（sub-issue に分解済みの親 = 作業 item ではない）か（純粋関数）。
 * Kind=EPIC または 🧭 tracking ラベルで判定する。
 * @param {object} item { kind, labels }
 * @returns {boolean}
 */
function isTrackerItem(item) {
    if (!item) return false;
    if (item.kind === 'EPIC') return true;
    return hasTrackingLabel(item);
}

/**
 * item に 🧭 tracking ラベルが付いているか（純粋関数）。
 * {@link isTrackerItem} と違い Kind は見ない（フェーズ選択では「未分解の EPIC は
 * decompose 対象」なので、Kind=EPIC だけではフェーズ対象から外さない）。
 * @param {object} item { labels }
 * @returns {boolean}
 */
function hasTrackingLabel(item) {
    return Boolean(item) && Array.isArray(item.labels) && item.labels.includes(TRACKING_LABEL);
}
/**
 * sticky ステータスコメントの識別マーカー（bot が1コメントを upsert し続ける目印）。
 * コントラクト `docs/autopilot/autonomous-contract.md` §2/§7 が規定する正準マーカー。
 */
const STICKY_MARKER = '<!-- autopilot-sticky-status -->';
/**
 * 過去の実装（daemon #794 の PR 同期）が使っていた旧マーカー。
 * 検出時は正準マーカーへ集約するため、引き続きマッチ対象に含める（#809）。
 */
const LEGACY_STICKY_MARKERS = ['<!-- autopilot:sticky -->'];
/** 検出に使う全マーカー（正準 + 旧）。upsert はこのいずれかにマッチした既存コメントを吸収する。 */
const STICKY_MARKERS = [STICKY_MARKER, ...LEGACY_STICKY_MARKERS];

/**
 * コメント本文が sticky ステータスコメントか判定する（純粋関数）。
 * 正準・旧いずれのマーカーにもマッチする（#809: マーカー不一致による重複投稿の防止）。
 * @param {string} body コメント本文
 * @returns {boolean}
 */
function isStickyComment(body) {
    if (!body) return false;
    return STICKY_MARKERS.some((m) => body.includes(m));
}

/**
 * コメント一覧から sticky ステータスコメントの id を抽出する（純粋関数）。
 * 返る順序は入力順。先頭を残して残りは重複として集約する想定（upsert 側で処理）。
 * @param {Array<{id: *, body: string}>} comments
 * @returns {Array<*>} マッチしたコメントの id 配列
 */
function selectStickyCommentIds(comments) {
    return (comments || []).filter((c) => c && isStickyComment(c.body)).map((c) => c.id);
}

/**
 * PR 投影を行う対象 Status（= 連携 PR が存在しうる post-PR ステータス）。
 * New Item/Backlog/Sprint Backlog はまだ PR が無い、Close/Done は終端なので除外。
 * Blocked は PR がある状態で HITL=Yes になるため含める。
 */
const PR_SYNC_STATUSES = new Set(['In Progress', 'Review', 'DoD', 'Blocked']);

/**
 * PR を Ready for review にすべき Status（= 人間が見る段階）。
 * これ以外（In Progress 等の AI 作業中）は Draft に保つ（#815）。
 * Draft/Ready は「いま AI が作業中か / 人間が見る番か」を Status で表す（HITL ラベルでは
 * 表さない）。Review で人間が approve しつつ 🙋 を外しても Status は Review のまま →
 * Ready を維持する（旧実装は HITL ラベル基準で、解除のたびに Draft へ戻すバグがあった）。
 * Blocked も人間が PR を見て対処する段階なので Ready にする。
 */
const READY_STATUSES = new Set(['Review', 'DoD', 'Close', 'Blocked']);

/**
 * PR 投影の対象 item を選ぶ（純粋関数）。トラッカー（EPIC / 🧭 tracking）は実装 PR を
 * 持たないので除外。
 * @param {object[]} items
 * @returns {object[]}
 */
function selectPrSyncCandidates(items) {
    return (items || []).filter(
        (it) => it && !isTrackerItem(it) && PR_SYNC_STATUSES.has(it.status),
    );
}

/**
 * PR は AI 作業中（In Progress 等）は Draft、人間が見る段階（Review/DoD/Close/Blocked）で
 * Ready for review にする。判定は **Status 基準**（#815）。
 *
 * 旧実装は 🙋 HITL ラベル基準だったため、Review 中に人間が approve して 🙋 を外した
 * （= AI に差し戻した）瞬間に Draft へ戻り、approved な PR が Draft のまま merge されない
 * バグ（#808）があった。Status は解除では変わらない（Review のまま）ので Ready を維持できる。
 * @param {object} item { status }
 * @returns {boolean} Draft であるべきか
 */
function desiredDraft(item) {
    return !READY_STATUSES.has(item && item.status);
}

/**
 * 現在の draft 状態と望ましい状態を比べ、必要な操作を返す（冪等。差分が無ければ null）。
 * @param {boolean} currentIsDraft
 * @param {object} item
 * @returns {'draft'|'ready'|null}
 */
function draftAction(currentIsDraft, item) {
    const want = desiredDraft(item);
    if (Boolean(currentIsDraft) === want) return null;
    return want ? 'draft' : 'ready';
}

/**
 * 🙋 HITL ラベルの操作を決める（純粋関数）。
 *
 * HITL の真実は 🙋 ラベルそのもの（#813）。canonical は Issue の 🙋 ラベル（item.hitlLabel）で、
 * per-tick 同期は PR 面をそこへ合わせる。ただし Review / DoD 中の HITL ラベルは「人間の解除
 * ジェスチャ」を兼ねるため、steady-state（force でない per-tick 同期）では人間が外したラベルを
 * **再付与しない**（= 解除シグナルを潰さない・#821 で DoD も対象）。Review/DoD へ渡す権威的な遷移・
 * merge 後の解除は force=true で明示する。
 * @param {object} item { status, hitlLabel }
 * @param {boolean} present 現在その面にラベルが付いているか
 * @param {object} [opts] { force }
 * @returns {'add'|'remove'|null}
 */
function hitlLabelAction(item, present, opts = {}) {
    const want = Boolean(item && item.hitlLabel);
    if (item && HUMAN_GATE_STATUSES.has(item.status) && !opts.force) {
        // steady-state: No への正規化（除去）だけ許可。Yes の再付与はしない。
        return !want && present ? 'remove' : null;
    }
    if (want) return present ? null : 'add';
    return present ? 'remove' : null;
}

/**
 * Issue/PR のラベルを Project 状態へ合わせる差分を返す（純粋関数）。
 * autopilot ラベルは常時担保し、HITL ラベルは {@link hitlLabelAction} に従う。
 * @param {object} item
 * @param {string[]} currentLabels 現在付いているラベル名
 * @param {object} [opts] { force }
 * @returns {{add: string[], remove: string[]}}
 */
function labelActions(item, currentLabels, opts = {}) {
    const cur = currentLabels || [];
    const add = [];
    const remove = [];
    if (!cur.includes(AUTOPILOT_LABEL)) add.push(AUTOPILOT_LABEL);
    // Kind=EPIC には 🧭 tracking を担保する（以後の tick はラベルだけで判定できる）。
    // 自動では外さない（人間が手動で付けたトラッカー指定を潰さない）。
    if (item && item.kind === 'EPIC' && !cur.includes(TRACKING_LABEL)) add.push(TRACKING_LABEL);
    const h = hitlLabelAction(item, cur.includes(HITL_LABEL), opts);
    if (h === 'add') add.push(HITL_LABEL);
    else if (h === 'remove') remove.push(HITL_LABEL);
    return { add, remove };
}

/**
 * sticky ステータスコメント本文を組み立てる（純粋関数）。
 * 連携 Issue の Project 状態（Status / AI Status / Size）と HITL（🙋 ラベル）を投影する。
 * @param {object} item { issue, status, aiStatus, hitlLabel, size }
 * @returns {string}
 */
function renderSticky(item) {
    const v = (x) => (x == null || x === '' ? '—' : String(x));
    const lines = [
        STICKY_MARKER,
        '## 🤖 autopilot status',
        '',
        '| field | value |',
        '| --- | --- |',
        `| Status | ${v(item.status)} |`,
        `| AI Status | ${v(item.aiStatus)} |`,
        `| HITL | ${item.hitlLabel ? 'Yes' : 'No'} |`,
        `| Size | ${v(item.size)} |`,
    ];
    // DoD では daemon が headful 検証手順を別コメント（autopilot:dod-handoff マーカー）として
    // 生成する（sticky 本体は上書きしない）。sticky には 1 行ポインタだけ足す（#821）。
    if (item && item.status === 'DoD') {
        lines.push(
            '',
            '> 🧪 **DoD 引き継ぎあり** — このスレッドの `autopilot:dod-handoff` コメント'
                + '（headful Playwright の検証手順）を参照。',
        );
    }
    lines.push(
        '',
        `_Linked issue #${item.issue}. Maintained by autopilot (single writer); do not edit._`,
    );
    return lines.join('\n');
}

/** Project フィールド名 → listItems が返す item キーの対応（HITL はラベルなので含めない・#813） */
const FIELD_TO_ITEM_KEY = {
    Status: 'status',
    'AI Status': 'aiStatus',
    Size: 'size',
    Kind: 'kind',
};

/**
 * フィールド設定意図（applyResult / mergeProgressionIntents の戻り）を item のコピーに適用する。
 * 投影用に「フェーズ適用後の item 像」を I/O なしで得るための純粋関数（value=null はクリア）。
 * @param {object} item
 * @param {Array<{field: string, value: string|null}>} intents
 * @returns {object} 新しい item（元は破壊しない）
 */
function applyIntentsToItem(item, intents) {
    const out = { ...item };
    for (const { field, value } of intents || []) {
        const key = FIELD_TO_ITEM_KEY[field];
        if (key) out[key] = value;
    }
    return out;
}

// ---- DoD handoff (#821): headful 検証をホスト Claude へ渡す引き継ぎ生成 ----

/**
 * DoD 引き継ぎコメントの識別マーカーを組む（冪等性の判定に使う）。手動実演（PR #818）と同形式。
 * @param {number} issue
 * @param {number} pr
 * @returns {string}
 */
function dodHandoffMarker(issue, pr) {
    return `<!-- autopilot:dod-handoff issue=${issue} pr=${pr} -->`;
}

/**
 * コメント本文が DoD 引き継ぎコメントか判定する（純粋関数）。issue/pr 番号には依存しない
 * （マーカーの接頭辞のみで判定するので、再投稿の冪等チェックに使える）。
 * @param {string} body
 * @returns {boolean}
 */
function isDodHandoffComment(body) {
    if (!body) return false;
    return body.includes('<!-- autopilot:dod-handoff');
}

/**
 * コメント一覧に DoD 引き継ぎコメントが既にあるか（純粋関数・冪等性の判定）。
 * @param {Array<{body: string}>} comments
 * @returns {boolean}
 */
function hasDodHandoffComment(comments) {
    return (comments || []).some((c) => c && isDodHandoffComment(c.body));
}

/** CI のブランチプレビュー URL（`https://smalruby.jp/smalruby3-editor/<branch>/`）のパターン。 */
const PREVIEW_URL_RE = /https:\/\/smalruby\.jp\/smalruby3-editor\/[^\s)<>"'`]+/;

/**
 * PR のコメント群から CI が貼ったブランチプレビュー URL を拾う（純粋関数）。
 * 先に現れたものを採用する。見つからなければ null。
 * @param {Array<{body: string}>} comments
 * @returns {string|null}
 */
function extractPreviewUrl(comments) {
    for (const c of comments || []) {
        const m = c && c.body && c.body.match(PREVIEW_URL_RE);
        if (m) return m[0];
    }
    return null;
}

/**
 * Issue 本文から DoD チェックリストのブロックを抜き出す（純粋関数）。
 * `## DoD`（または `Definition of Done`）見出しの次行から次の見出しまでを返す。
 * 見つからなければ null（呼び出し側がフォールバック文言を入れる）。
 * @param {string} body Issue 本文（Markdown）
 * @returns {string|null}
 */
function extractDodChecklist(body) {
    if (!body) return null;
    const lines = body.split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^#{1,6}\s+(DoD|Definition of Done)\b/i.test(lines[i].trim())) {
            start = i + 1;
            break;
        }
    }
    if (start === -1) return null;
    const block = [];
    for (let i = start; i < lines.length; i++) {
        if (/^#{1,6}\s/.test(lines[i].trim())) break; // 次の見出しで打ち切り
        block.push(lines[i]);
    }
    const text = block.join('\n').trim();
    return text || null;
}

/**
 * DoD 引き継ぎが必要か判定する（純粋関数）。DoD + 連携 PR あり + 未生成（引き継ぎコメント無し）
 * で true。EPIC は実装 PR を持たないので対象外。生成済みなら false（冪等・二重投稿防止）。
 * @param {object} item { status, kind }
 * @param {object} ctx { hasHandoffComment: boolean, hasPr: boolean }
 * @returns {boolean}
 */
function needsDodHandoff(item, ctx = {}) {
    if (!item || isTrackerItem(item)) return false;
    if (item.status !== 'DoD') return false;
    if (!ctx.hasPr) return false;
    return !ctx.hasHandoffComment;
}

/**
 * DoD 引き継ぎコメントの本文をテンプレート生成する（純粋関数・LLM 不使用）。
 * コンテナ内 daemon は headless なので、ホスト側 Claude（headful Playwright）に渡す
 * 検証手順をそのまま投稿できる文面にする。具体手順は host Claude が Issue/PR を読んで補完する前提
 * の雛形（プレビュー URL ＋ Issue の DoD チェックリスト転記 ＋ 定型 headful 手順 ＋ 報告の出口）。
 * @param {object} p
 * @param {number} p.issue 連携 Issue 番号
 * @param {number} p.pr PR 番号
 * @param {string} [p.repo] `owner/name`（PR リンク用。省略時は番号のみ）
 * @param {string} [p.branch] PR のブランチ名（省略可）
 * @param {string|null} [p.previewUrl] CI のブランチプレビュー URL（無ければフォールバック文言）
 * @param {string|null} [p.dodChecklist] Issue の DoD チェックリスト（無ければフォールバック文言）
 * @returns {string}
 */
function dodHandoffBody({ issue, pr, repo, branch, previewUrl, dodChecklist }) {
    const prRef = repo ? `${repo} #${pr}` : `#${pr}`;
    const branchLine = branch ? ` / ブランチ \`${branch}\`` : '';
    const preview = previewUrl
        ? `\`${previewUrl}\``
        : '_（プレビュー URL を CI コメントから取得できませんでした。CI のビルド完了を待つか、'
            + 'ローカル dev server で確認してください。）_';
    const checklist = dodChecklist && dodChecklist.trim()
        ? dodChecklist.trim()
        : '_（Issue 本文に DoD チェックリストが見つかりませんでした。Issue と PR 本文を読んで'
            + '検証項目を補完してください。）_';
    return [
        dodHandoffMarker(issue, pr),
        '## 🧪 DoD 引き継ぎ（headful Playwright / ホスト Claude 用）',
        '',
        'このコメントは **DoD フェーズの引き継ぎドキュメント**です。コンテナ内 autopilot は headless の',
        'ため実ブラウザ確認ができません。**ホスト側のあなたの Claude（headful Playwright MCP）**で以下を',
        '実施し、結果をこの PR にコメントしてください。',
        '',
        '`---` 以下をそのままホストの Claude に貼り付けてください。',
        '',
        '---',
        '',
        `**役割**: PR ${prRef}（Issue #${issue}）の **DoD を headful Playwright MCP（ホストの実 Chrome）で`,
        '検証**してください。autopilot はコンテナ内で headless のためあなたに引き継ぎます。',
        '',
        '### 対象',
        '',
        `- PR: ${prRef}${branchLine}`,
        `- プレビュー（CI ビルド済み・dev server 不要）: ${preview}`,
        '- 変更点の要約は PR 本文を参照。**検証前に PR の CI が green であることを確認すること**',
        '  （daemon は CI 状態をチェックせずこの引き継ぎを生成している）。',
        '',
        '### 事前準備',
        '',
        '- ホストの Chrome を Playwright MCP で headful 操作する（`reference_host_playwright_mcp.md` の構成）。',
        '- URL には常に `?no_beforeunload=1` を付ける。',
        '- **秘密情報（バイパストークン等）は本文・ログに残さないこと**。必要ならローカル `.env` の値を',
        '  読み、URL パラメータに使うだけにする（値はコメントに書かない）。',
        '',
        '### 検証手順（Issue の DoD チェックリスト）',
        '',
        `以下は Issue #${issue} の DoD をそのまま転記したもの。各項目を headful で確認し、結果を記録する。`,
        'スクショは `tmp/` に保存し、UI に視覚的変更があれば `docs/<feature>/screenshots/` に既存の命名規則',
        '（`docs/_screenshot-guidelines.md`）で追加してブランチに追加コミット（あなたの手元で commit/push）する。',
        '',
        checklist,
        '',
        '### 報告（完了の出口）',
        '',
        `- **すべて OK**: この PR ${prRef} に「DoD 検証 OK」+ スクショ要約をコメント。スクショ commit を push。`,
        '  → 人間が merge して Close（既存 merge-progression が leaf を Close）。',
        '- **NG / 要修正**: NG 項目を PR にコメントし、`🙋 HITL` ラベルを外す → autopilot が **DoD を解除して',
        '  address-review** を起動し、差分と全コメントを読んで対応します（Review と対称）。',
        '- **判断に迷う**: 論点を PR にコメントして人間に確認。',
        '',
        '検証は **本番 Chrome** で行うこと（Playwright の Chromium はポリシーが緩く誤検知することがある）。',
    ].join('\n');
}

/**
 * watchdog の状態を評価して次アクションを返す（純粋関数）。
 * 完了の権威は「結果ファイルの存在」。それ以外はタイマーで stuck を処理する。
 * @param {object} state
 * @param {boolean} state.resultPresent 結果ファイルが書かれたか
 * @param {boolean} state.ready claude が入力受付可能になったか
 * @param {boolean} state.dead claude プロセスが終了したか（結果なしで死んだ）
 * @param {number} state.elapsedMs 起動からの経過
 * @param {number} state.idleMs pane が変化していない時間
 * @param {number} state.restarts これまでの再起動回数
 * @param {object} cfg
 * @param {number} cfg.tReadyMs 起動完了の許容時間（課題1）
 * @param {number} cfg.tIdleMs 無変化で stuck とみなす時間（課題2）
 * @param {number} cfg.tMaxMs 絶対上限（課題3）
 * @param {number} cfg.maxRestarts 再起動上限
 * @returns {{action: 'collect'|'wait'|'restart'|'fail', reason: string}}
 */
function evaluate(state, cfg) {
    // 1. 結果ファイルが書かれていれば最優先で回収（done/hitl/error は中身で判定）
    if (state.resultPresent) {
        return { action: 'collect', reason: 'result file present' };
    }
    // 3. 絶対上限超過は即失敗（暴走の最終防壁・課題3）
    if (state.elapsedMs > cfg.tMaxMs) {
        return { action: 'fail', reason: `exceeded tMax (${cfg.tMaxMs}ms)` };
    }
    const canRestart = state.restarts < cfg.maxRestarts;
    // 4. 結果なしでプロセスが死んだ（課題4）
    if (state.dead) {
        return canRestart
            ? { action: 'restart', reason: 'process exited without result' }
            : { action: 'fail', reason: 'process exited without result; restart limit reached' };
    }
    // 1. 起動できず入力受付に至らない（課題1）
    if (!state.ready && state.elapsedMs > cfg.tReadyMs) {
        return canRestart
            ? { action: 'restart', reason: `not ready within tReady (${cfg.tReadyMs}ms)` }
            : { action: 'fail', reason: 'not ready; restart limit reached' };
    }
    // 2. 入力受付後に長時間無変化＝インタビュー等で停止（課題2）
    if (state.ready && state.idleMs > cfg.tIdleMs) {
        return canRestart
            ? { action: 'restart', reason: `idle/stalled beyond tIdle (${cfg.tIdleMs}ms)` }
            : { action: 'fail', reason: 'stalled; restart limit reached' };
    }
    return { action: 'wait', reason: 'in progress' };
}

/**
 * スラッシュコマンド送信後に「受理されたか」を判定し、未達なら再送すべきかを返す（純粋関数）。
 * claude TUI は起動直後に入力受付前のことがあり、最初の send-keys が捨てられる（課題1）。
 * 受理確認（busy 表示 or 結果ファイル）が取れないまま acceptWindow を超えたら、上限まで再送する。
 * @param {object} s
 * @param {number} s.sinceSendMs 直近送信からの経過
 * @param {number} s.attempts これまでの送信回数
 * @param {number} s.maxAttempts 送信上限
 * @param {number} s.acceptWindowMs 受理待ちの猶予
 * @returns {boolean}
 */
function shouldResend(s) {
    return s.sinceSendMs > s.acceptWindowMs && s.attempts < s.maxAttempts;
}

const DEFAULT_WATCHDOG = {
    // worker（claude TUI）の起動は環境負荷が高いと 60s を超えることがあるため 150s。
    // 起動失敗の検知が遅れるコストより、生きている起動を誤 kill するコストの方が高い。
    tReadyMs: 150_000,
    // claude の思考/実行は数分に及ぶ。busy 検知（runner の BUSY_RE）が主防御で、
    // これは pane が完全停止した場合の保険なので長め（10 分）にする。
    tIdleMs: 600_000,
    tMaxMs: 1_800_000,
    maxRestarts: 2,
    pollMs: 3_000,
    // 送信後この時間内に受理（busy/結果）が確認できなければ再送（課題1: cold-start 不達）
    acceptWindowMs: 8_000,
    maxSendAttempts: 4,
};

module.exports = {
    PHASE_BY_COMMAND,
    PROMPT_DIR,
    phasePromptCommand,
    DEFAULT_CLAUDE_COMMAND,
    DEFAULT_BASE_BRANCH,
    parseBaseBranch,
    parseAfterIssues,
    unresolvedAfterIssues,
    AUTOPILOT_BRANCH_PREFIX,
    autopilotHeadBranch,
    applyResult,
    hitlDesireFromResult,
    isHitlReleased,
    progressOnMerge,
    MERGE_CHECK_STATUSES,
    selectMergeCandidates,
    mergeProgressionIntents,
    TERMINAL_STATUSES,
    selectClosedToReconcile,
    computeReviewApproval,
    phaseForItem,
    isActionable,
    isStuckCandidate,
    itemOwner,
    ownsItem,
    statusRank,
    orderItemsLikeBoard,
    selectActionable,
    shouldResend,
    evaluate,
    DEFAULT_WATCHDOG,
    AUTOPILOT_LABEL,
    HITL_LABEL,
    TRACKING_LABEL,
    isTrackerItem,
    hasTrackingLabel,
    STICKY_MARKER,
    LEGACY_STICKY_MARKERS,
    STICKY_MARKERS,
    isStickyComment,
    selectStickyCommentIds,
    HUMAN_GATE_STATUSES,
    dodHandoffMarker,
    isDodHandoffComment,
    hasDodHandoffComment,
    extractPreviewUrl,
    extractDodChecklist,
    needsDodHandoff,
    dodHandoffBody,
    PR_SYNC_STATUSES,
    READY_STATUSES,
    selectPrSyncCandidates,
    desiredDraft,
    draftAction,
    hitlLabelAction,
    labelActions,
    renderSticky,
    applyIntentsToItem,
};
