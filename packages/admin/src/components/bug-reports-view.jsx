/**
 * バグ報告の閲覧ビュー (EPIC #1073 S5, decision D) — READ-ONLY.
 *
 * The existing bug-report feature is untouched: status changes / developer
 * replies remain on the current workflow. This view only lists reports and
 * shows one report's detail with its presigned attachment links.
 */
import PropTypes from 'prop-types';
import {useCallback, useEffect, useState} from 'react';
import {fetchBugReport, fetchBugReports, updateBugReport} from '../lib/bug-report-api.js';
import {buildClaudePrompts} from '../lib/bug-report-prompts.js';

const STATUS_LABELS = {
    open: '未対応',
    in_progress: '対応中',
    resolved: '解決済み',
    wont_fix: '対応しない'
};

const BugStatusBadge = ({status}) => {
    const active = status === 'open' || status === 'in_progress';
    return (
        <span className={`admin-badge ${active ? 'admin-badge-warn' : 'admin-badge-muted'}`}>
            {STATUS_LABELS[status] || status}
        </span>
    );
};

BugStatusBadge.propTypes = {status: PropTypes.string};

const formatDate = iso => (iso ?
    String(iso)
        .replace('T', ' ')
        .slice(0, 16) :
    '-');

// Real reports store appContext as a JSON object (the reporter's app state),
// older ones as a string — render both.
const asText = value => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

// A report can declare attachments whose upload never completed (the S3
// object 404s even though the presigned URL is valid) — hide those instead
// of showing a broken image.
const hideBrokenImage = event => {
    event.currentTarget.style.display = 'none';
};

const BugReportDetail = ({reportId, stage, onBack, onChanged}) => {
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');
    const [nextStatus, setNextStatus] = useState('');
    const [reply, setReply] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [copiedKey, setCopiedKey] = useState(null);

    useEffect(() => {
        fetchBugReport(reportId)
            .then(data => {
                setDetail(data);
                setNextStatus(data.status);
                setReply(data.developerReply || '');
            })
            .catch(err => setError(err.message));
    }, [reportId]);

    const dirty = detail &&
        (nextStatus !== detail.status || reply !== (detail.developerReply || ''));
    const turnsTerminal = detail && nextStatus !== detail.status &&
        (nextStatus === 'resolved' || nextStatus === 'wont_fix');

    const handleStatusChange = useCallback(e => setNextStatus(e.target.value), []);
    const handleReplyChange = useCallback(e => setReply(e.target.value), []);
    const handleArm = useCallback(() => setConfirming(true), []);
    const handleDisarm = useCallback(() => setConfirming(false), []);
    const handleSave = useCallback(async () => {
        if (!detail) return;
        setBusy(true);
        setError('');
        try {
            // Send only what changed — the API rejects an empty update.
            const updates = {};
            if (nextStatus !== detail.status) updates.status = nextStatus;
            if (reply !== (detail.developerReply || '')) updates.developerReply = reply;
            await updateBugReport(reportId, updates);
            setDetail(prev => ({...prev, status: nextStatus, developerReply: reply}));
            setConfirming(false);
            setSavedAt(new Date().toISOString());
            onChanged();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [detail, nextStatus, reply, reportId, onChanged]);

    const handleCopyPrompt = useCallback(async e => {
        const {key, prompt} = e.currentTarget.dataset;
        try {
            await navigator.clipboard.writeText(prompt);
            setCopiedKey(key);
        } catch {
            setCopiedKey(null);
        }
    }, []);

    if (error && !detail) {
        return (<p
            className="admin-error"
            data-testid="bug-admin-error"
        >{error}</p>);
    }
    if (!detail) return <p data-testid="bug-admin-loading">{'読み込み中…'}</p>;

    return (
        <div data-testid="bug-admin-detail">
            <button
                data-testid="bug-admin-back"
                type="button"
                onClick={onBack}
            >{'← 一覧に戻る'}</button>
            <h3>
                {detail.projectName || '(プロジェクト名なし)'}
                {' '}
                <BugStatusBadge status={detail.status} />
            </h3>
            <p className="admin-meta">
                {`報告者: ${detail.ownerEmail || '(メール非公開)'} ・ ${formatDate(detail.createdAt)}`}
            </p>
            <p data-testid="bug-admin-description">{detail.description}</p>
            {detail.appContext ? (
                <details>
                    <summary>{'アプリの状態 (appContext)'}</summary>
                    <pre
                        className="admin-pre"
                        data-testid="bug-admin-app-context"
                    >{asText(detail.appContext)}</pre>
                </details>
            ) : null}
            {detail.userAgent ? (
                <p className="admin-meta">{`UA: ${detail.userAgent}`}</p>
            ) : null}
            <div className="admin-actions">
                {detail.projectUrl ? (
                    <a
                        data-testid="bug-admin-project-download"
                        href={detail.projectUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >{'作品 (.sb3) をダウンロード'}</a>
                ) : (
                    <span className="admin-meta">{'作品の添付なし'}</span>
                )}
            </div>
            {(detail.screenshotUrls || []).map((url, index) => (
                <img
                    alt={`スクリーンショット ${index + 1}`}
                    className="admin-page-image"
                    data-testid={`bug-admin-screenshot-${index}`}
                    key={index}
                    src={url}
                    onError={hideBrokenImage}
                />
            ))}
            <div className="admin-respond">
                <h4>{'対応（報告者に表示されます）'}</h4>
                <label className="admin-meta">
                    {'状態: '}
                    <select
                        data-testid="bug-admin-status-select"
                        disabled={busy}
                        value={nextStatus}
                        onChange={handleStatusChange}
                    >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option
                                key={value}
                                value={value}
                            >{label}</option>
                        ))}
                    </select>
                </label>
                <textarea
                    data-testid="bug-admin-reply-input"
                    disabled={busy}
                    maxLength={2000}
                    placeholder="進捗や対応内容のコメント（報告者の「私の不具合報告」に表示されます）"
                    rows={4}
                    value={reply}
                    onChange={handleReplyChange}
                />
                {error ? <p
                    className="admin-error"
                    data-testid="bug-admin-save-error"
                >{error}</p> : null}
                <div className="admin-actions">
                    {confirming ? (
                        <span
                            className="admin-confirm"
                            data-testid="bug-admin-save-confirm"
                        >
                            {turnsTerminal ?
                                'この状態にすると報告と添付は一定期間後に自動削除されます。保存しますか？' :
                                '状態・コメントを保存しますか？報告者にも表示されます。'}
                            <button
                                data-testid="bug-admin-save-yes"
                                disabled={busy}
                                type="button"
                                onClick={handleSave}
                            >{'保存する'}</button>
                            <button
                                data-testid="bug-admin-save-no"
                                disabled={busy}
                                type="button"
                                onClick={handleDisarm}
                            >{'やめる'}</button>
                        </span>
                    ) : (
                        <button
                            data-testid="bug-admin-save"
                            disabled={!dirty || busy}
                            type="button"
                            onClick={handleArm}
                        >{'保存'}</button>
                    )}
                    {savedAt && !dirty ? (
                        <span
                            className="admin-meta"
                            data-testid="bug-admin-saved"
                        >{'保存しました。'}</span>
                    ) : null}
                </div>
            </div>
            <div
                className="admin-respond"
                data-testid="bug-admin-claude"
            >
                <h4>{'Claude に依頼（/bug-report スキル）'}</h4>
                <p className="admin-meta">
                    {'いまの状態に合わせたプロンプト案です。コピーして Claude Code に貼り付けてください。'}
                </p>
                {buildClaudePrompts(detail, stage).map(suggestion => (
                    <div
                        className="admin-prompt"
                        key={suggestion.key}
                    >
                        <div className="admin-prompt-head">
                            <strong>{suggestion.title}</strong>
                            <button
                                data-key={suggestion.key}
                                data-prompt={suggestion.prompt}
                                data-testid={`bug-admin-copy-${suggestion.key}`}
                                type="button"
                                onClick={handleCopyPrompt}
                            >
                                {copiedKey === suggestion.key ? 'コピーしました ✓' : 'コピー'}
                            </button>
                        </div>
                        <pre className="admin-pre">{suggestion.prompt}</pre>
                    </div>
                ))}
            </div>
        </div>
    );
};

BugReportDetail.propTypes = {
    onBack: PropTypes.func.isRequired,
    onChanged: PropTypes.func.isRequired,
    reportId: PropTypes.string.isRequired,
    stage: PropTypes.string
};

const BugReportsView = ({stage}) => {
    const [status, setStatus] = useState('');
    const [reports, setReports] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [error, setError] = useState('');

    const reload = useCallback(() => {
        setError('');
        setReports(null);
        fetchBugReports(status)
            .then(data => setReports(data.reports || []))
            .catch(err => setError(err.message));
    }, [status]);

    useEffect(reload, [reload]);

    const handleStatusChange = useCallback(e => setStatus(e.target.value), []);
    const handleOpen = useCallback(e => setSelectedId(e.currentTarget.dataset.reportId), []);
    const handleBack = useCallback(() => setSelectedId(null), []);

    if (selectedId) {
        return (
            <BugReportDetail
                reportId={selectedId}
                stage={stage}
                onBack={handleBack}
                onChanged={reload}
            />
        );
    }

    return (
        <div data-testid="bug-admin-view">
            <p className="admin-meta">
                {'状態の変更とコメント（開発者からの返信）は、報告者の「私の不具合報告」にも反映されます。'}
            </p>
            <div className="admin-search">
                <select
                    data-testid="bug-admin-filter-status"
                    value={status}
                    onChange={handleStatusChange}
                >
                    <option value="">{'すべての状態'}</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option
                            key={value}
                            value={value}
                        >{label}</option>
                    ))}
                </select>
            </div>
            {error ? <p
                className="admin-error"
                data-testid="bug-admin-error"
            >{error}</p> : null}
            {reports === null ? (
                <p data-testid="bug-admin-loading">{'読み込み中…'}</p>
            ) : reports.length === 0 ? (
                <p data-testid="bug-admin-empty">{'バグ報告はありません。'}</p>
            ) : (
                <ul
                    className="admin-list"
                    data-testid="bug-admin-list"
                >
                    {reports.map(report => (
                        <li key={report.reportId}>
                            <button
                                data-report-id={report.reportId}
                                data-testid={`bug-admin-item-${report.reportId}`}
                                type="button"
                                onClick={handleOpen}
                            >
                                {report.thumbnailUrl ? (
                                    <img
                                        alt=""
                                        className="admin-thumb"
                                        src={report.thumbnailUrl}
                                        onError={hideBrokenImage}
                                    />
                                ) : null}
                                <strong>{report.projectName || '(プロジェクト名なし)'}</strong>
                                <BugStatusBadge status={report.status} />
                                <span className="admin-meta">
                                    {`${report.ownerEmail || '(メール非公開)'} ・ ${formatDate(report.createdAt)}`}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

BugReportsView.propTypes = {
    stage: PropTypes.string
};

export default BugReportsView;
