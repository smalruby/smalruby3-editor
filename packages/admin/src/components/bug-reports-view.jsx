/**
 * バグ報告の閲覧ビュー (EPIC #1073 S5, decision D) — READ-ONLY.
 *
 * The existing bug-report feature is untouched: status changes / developer
 * replies remain on the current workflow. This view only lists reports and
 * shows one report's detail with its presigned attachment links.
 */
import PropTypes from 'prop-types';
import {useCallback, useEffect, useState} from 'react';
import {fetchBugReport, fetchBugReports} from '../lib/bug-report-api.js';

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

const BugReportDetail = ({reportId, onBack}) => {
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchBugReport(reportId)
            .then(setDetail)
            .catch(err => setError(err.message));
    }, [reportId]);

    if (error) {
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
            {detail.developerReply ? (
                <p
                    className="admin-meta"
                    data-testid="bug-admin-reply"
                >{`開発者からの返信: ${detail.developerReply}`}</p>
            ) : null}
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
                />
            ))}
        </div>
    );
};

BugReportDetail.propTypes = {
    onBack: PropTypes.func.isRequired,
    reportId: PropTypes.string.isRequired
};

const BugReportsView = () => {
    const [status, setStatus] = useState('');
    const [reports, setReports] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setError('');
        setReports(null);
        fetchBugReports(status)
            .then(data => setReports(data.reports || []))
            .catch(err => setError(err.message));
    }, [status]);

    const handleStatusChange = useCallback(e => setStatus(e.target.value), []);
    const handleOpen = useCallback(e => setSelectedId(e.currentTarget.dataset.reportId), []);
    const handleBack = useCallback(() => setSelectedId(null), []);

    if (selectedId) {
        return (
            <BugReportDetail
                reportId={selectedId}
                onBack={handleBack}
            />
        );
    }

    return (
        <div data-testid="bug-admin-view">
            <p className="admin-meta">
                {'閲覧専用です。状態の変更・返信は従来の運用手段で行ってください。'}
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

export default BugReportsView;
