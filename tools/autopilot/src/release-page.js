'use strict';
/**
 * release-page.js — EPIC のリリース確認を 1 枚にまとめる確認ページ（claude.ai の artifact）の判断と描画（純粋関数・#2474）。
 *
 * release-check の「観点をまとめる」段で、worker がトラッカーのコメントに加えて確認ページを作る（2 回目からは同じ URL を
 * 更新する）。ページの形はテンプレート（tools/autopilot/templates/release-check/）が正で、worker はここの
 * {@link draftReleasePageData} が作るデータ（と、必要ならことば）だけを足す。データの形を変えたら
 * {@link RELEASE_PAGE_SCHEMA}・{@link draftReleasePageData}・テンプレートの JS を対で直す。
 *
 * 人間はページで観点ごとの OK / NG、決定待ちごとの「推奨でよい / 別の案 / コメント」、全体のコメントを書き、
 * 「答えを送る」でページの保存先（artifact の db）の {@link answerDocPath} に `status: 'submitted'` で入れる。
 * db を読めるのは Claude の ArtifactData だけ（daemon は Node で claude.ai の認証を持たない）なので、読むのは
 * release-check の worker。人間がモニターで 🙋 を外すと worker が起き、送られた答えを {@link answerToReviewBody} で
 * モニターの結果と同じ形にして、`<!-- autopilot-release-review round=N -->` のコメントを Bot で書く。
 *
 * URL は daemon が状態ファイルに持ち（release-check-http.js）、worker に `AUTOPILOT_ARTIFACT_URL` で渡す。
 * I/O・時計を持ち込まない（時刻は引数で受ける）。
 */

const { releaseCheckView } = require('./release-check');
const { findEpicDecisionsComment, parseEpicDecisionsData, DECISION_KIND_LABELS } = require('./epic-flow');
const { isArtifactUrl, embedTemplateData } = require('./current-status');

/** テンプレートの中で、データの JSON に置きかえる印。 */
const RELEASE_PAGE_TOKEN = '/*__RELEASE_CHECK_DATA__*/null';

/** テンプレートのデータの形の版。形を変えたら上げ、テンプレートの JS と合わせる。 */
const RELEASE_PAGE_SCHEMA = 1;

/** 観点の本文の決まった行（プロンプトの書き方 `- 開く: …` と対） */
const POINT_FIELDS = [['open', '開く'], ['do', 'する'], ['ok', 'OK'], ['source', '出どころ']];

/**
 * round ごとの答えを入れる db の文書のパス（`collection/doc` の 2 段）。
 * @param {number} round
 * @returns {string}
 */
function answerDocPath(round) { return `answers/round-${round}`; }

/**
 * 観点の本文から「開く / する / OK / 出どころ」を取り出す。ほかの行は `rest` に残す。
 * @param {string} body
 * @returns {{open:string, do:string, ok:string, source:string, rest:string}}
 */
function splitPointBody(body) {
    const out = { open: '', do: '', ok: '', source: '', rest: '' };
    const rest = [];
    for (const line of String(body || '').split('\n')) {
        const hit = POINT_FIELDS.find(([, ja]) => new RegExp(`^\\s*[-*]\\s*${ja}\\s*[:：]\\s*`).test(line));
        if (hit) out[hit[0]] = line.replace(new RegExp(`^\\s*[-*]\\s*${hit[1]}\\s*[:：]\\s*`), '').trim();
        else rest.push(line);
    }
    out.rest = rest.join('\n').trim();
    return out;
}

/**
 * トラッカーのコメントからページのデータの下書きを作る。観点はいちばん新しい round の観点のコメント、決定待ちは
 * EPIC の「決定待ち」まとめコメント（採用しなかった指摘もここに入る）から取る。
 * @param {{epic:number, title?:string, repo?:string, comments:object[], prNumber?:(number|null), prUrl?:(string|null),
 *   generatedAt?:(string|null)}} p comments はトラッカーの会話コメント（REST の形）
 * @returns {object} テンプレートのデータ（schema = RELEASE_PAGE_SCHEMA）
 */
function draftReleasePageData(p) {
    const repoUrl = p.repo ? `https://github.com/${p.repo}` : null;
    const issueUrl = (n) => (repoUrl && n ? `${repoUrl}/issues/${n}` : null);
    const pullUrl = (n) => (repoUrl && n ? `${repoUrl}/pull/${n}` : null);
    const view = releaseCheckView(p.comments || []);
    const check = view.check;
    const trackerUrl = issueUrl(p.epic);
    const dc = findEpicDecisionsComment(p.comments || []);
    const decisions = (dc ? parseEpicDecisionsData(dc.body) : []).map((d, i) => ({
        id: `D${i + 1}`,
        kind: d.kind,
        kindLabel: (DECISION_KIND_LABELS && DECISION_KIND_LABELS[d.kind]) || d.kind,
        title: d.title,
        issue: d.issue || null,
        issueUrl: issueUrl(d.issue),
        pr: d.pr || null,
        prUrl: pullUrl(d.pr),
        recommendation: d.recommendation || '',
        alternatives: d.alternatives || [],
        adopted: d.adopted || '',
    }));
    const round = check ? check.round : null;
    return {
        schema: RELEASE_PAGE_SCHEMA,
        epic: p.epic,
        title: p.title || '',
        round,
        generatedAt: p.generatedAt || null,
        lead: '',
        previewUrl: check ? check.previewUrl : null,
        prNumber: p.prNumber || null,
        prUrl: p.prUrl || pullUrl(p.prNumber),
        trackerUrl,
        checkUrl: check && check.id != null && trackerUrl ? `${trackerUrl}#issuecomment-${check.id}` : trackerUrl,
        answerDoc: round ? answerDocPath(round) : null,
        points: check ? check.points.map((pt) => ({ id: pt.id, title: pt.title, ...splitPointBody(pt.body) })) : [],
        decisions,
    };
}

/**
 * テンプレートの HTML にデータを埋め込む。
 * @param {string} template RELEASE_PAGE_TOKEN を含む HTML
 * @param {object} data {@link draftReleasePageData} の形
 * @returns {string}
 */
function renderReleasePageHtml(template, data) {
    return embedTemplateData(template, RELEASE_PAGE_TOKEN, data);
}

/**
 * ページの db の答えを `POST /release-check/review` と同じ形にする。送っていない（下書き）・round が違う・
 * 形が違うものは null。中身の検証は release-check.js の normalizeReleaseReviewBody が行う（閲覧者が書いた値なので必ず通す）。
 * @param {object|null} doc db の文書の中身（`{status, round, results, decisions, comment}`）
 * @param {{issue:number, round:number}} want
 * @returns {object|null}
 */
function answerToReviewBody(doc, want) {
    if (!doc || typeof doc !== 'object' || doc.status !== 'submitted') return null;
    if (Number(doc.round) !== want.round) return null;
    return {
        issue: want.issue,
        round: want.round,
        results: Array.isArray(doc.results) ? doc.results : [],
        decisions: Array.isArray(doc.decisions) ? doc.decisions : [],
        comment: typeof doc.comment === 'string' ? doc.comment : '',
        source: 'page',
    };
}

/**
 * 確認ページの URL の次の状態（EPIC ごと）。worker の申告は artifact の URL の形のときだけ受ける。
 * @param {object} prev `{ "<epic>": {url, round, updatedAt} }`
 * @param {{issue:number, round?:(number|null), artifactUrl:*, now:number}} p
 * @returns {{pages:object, changed:boolean}}
 */
function planReleasePageState(prev, p) {
    const pages = { ...(prev || {}) };
    if (!isArtifactUrl(p.artifactUrl)) return { pages, changed: false };
    const before = pages[p.issue] || {};
    const round = Number.isInteger(p.round) && p.round > 0 ? p.round : before.round || null;
    pages[p.issue] = { url: p.artifactUrl.trim(), round, updatedAt: p.now };
    return { pages, changed: true };
}

/**
 * EPIC の確認ページの URL（無ければ null）。
 * @param {object} pages
 * @param {number} issue
 * @returns {string|null}
 */
function releasePageUrl(pages, issue) {
    const e = pages && pages[issue];
    return e && isArtifactUrl(e.url) ? e.url : null;
}

module.exports = {
    RELEASE_PAGE_TOKEN,
    RELEASE_PAGE_SCHEMA,
    answerDocPath,
    splitPointBody,
    draftReleasePageData,
    renderReleasePageHtml,
    answerToReviewBody,
    planReleasePageState,
    releasePageUrl,
};
