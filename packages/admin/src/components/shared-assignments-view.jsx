/**
 * みんなの課題 moderation view (EPIC #1073 S3): report queue + fleet-wide
 * listing + detail with unpublish/republish. Judgment criteria live in
 * docs/assignment-sharing/operations.md.
 */
import PropTypes from 'prop-types';
import {useCallback, useEffect, useState} from 'react';
import {
    fetchSharedAssignment,
    fetchSharedAssignments,
    fetchSharedReports,
    setSharedStatus
} from '../lib/admin-api.js';

const StatusBadge = ({status}) => (
    <span className={`admin-badge ${status === 'published' ? 'admin-badge-ok' : 'admin-badge-muted'}`}>
        {status === 'published' ? '公開中' : '非公開'}
    </span>
);

StatusBadge.propTypes = {status: PropTypes.string};

const SharedDetail = ({sharedId, onBack, onChanged}) => {
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetchSharedAssignment(sharedId)
            .then(setDetail)
            .catch(err => setError(err.message));
    }, [sharedId]);

    const handleArm = useCallback(() => setConfirming(true), []);
    const handleDisarm = useCallback(() => setConfirming(false), []);
    const handleFlip = useCallback(async () => {
        if (!detail) return;
        setBusy(true);
        setError('');
        try {
            const next = detail.status === 'published' ? 'unlisted' : 'published';
            const updated = await setSharedStatus(sharedId, next);
            setDetail(prev => ({...prev, status: updated.status}));
            setConfirming(false);
            onChanged();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [detail, sharedId, onChanged]);

    if (error) {
        return (<p
            className="admin-error"
            data-testid="shared-admin-error"
        >{error}</p>);
    }
    if (!detail) return <p data-testid="shared-admin-loading">{'読み込み中…'}</p>;

    return (
        <div data-testid="shared-admin-detail">
            <button
                data-testid="shared-admin-back"
                type="button"
                onClick={onBack}
            >{'← 一覧に戻る'}</button>
            <h3>
                {detail.title}
                {' '}
                <StatusBadge status={detail.status} />
            </h3>
            <p
                className="admin-meta"
                data-testid="shared-admin-credit"
            >
                {`© ${detail.authorName}${detail.authorAffiliation ? `（${detail.authorAffiliation}）` : ''} / CC BY 4.0`}
                {` ・ 取り込み ${detail.reuseCount} 回`}
            </p>
            <p className="admin-meta">
                {`${detail.schoolLevel} / ${detail.subject} / タグ: ${(detail.tags || []).join(', ') || '-'}`}
            </p>
            {detail.supplementUrl ? (
                <p
                    className="admin-meta"
                    data-testid="shared-admin-url"
                >
                    {'補足資料: '}
                    <a
                        href={detail.supplementUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >{detail.supplementUrl}</a>
                </p>
            ) : null}
            {(detail.pages || []).map((page, index) => (
                <div
                    className="admin-page"
                    key={index}
                >
                    {page.imageUrl ? (
                        <img
                            alt=""
                            className="admin-page-image"
                            src={page.imageUrl}
                        />
                    ) : null}
                    <p>{page.text}</p>
                </div>
            ))}
            <div className="admin-actions">
                {confirming ? (
                    <span
                        className="admin-confirm"
                        data-testid="shared-admin-confirm"
                    >
                        {detail.status === 'published' ?
                            'この投稿を非公開にしますか？（カタログから消えます。物理削除はされません）' :
                            'この投稿を再公開しますか？'}
                        <button
                            data-testid="shared-admin-confirm-yes"
                            disabled={busy}
                            type="button"
                            onClick={handleFlip}
                        >{'実行'}</button>
                        <button
                            data-testid="shared-admin-confirm-no"
                            disabled={busy}
                            type="button"
                            onClick={handleDisarm}
                        >{'やめる'}</button>
                    </span>
                ) : (
                    <button
                        data-testid="shared-admin-flip"
                        disabled={busy}
                        type="button"
                        onClick={handleArm}
                    >
                        {detail.status === 'published' ? '非公開にする' : '再公開する'}
                    </button>
                )}
            </div>
        </div>
    );
};

SharedDetail.propTypes = {
    onBack: PropTypes.func.isRequired,
    onChanged: PropTypes.func.isRequired,
    sharedId: PropTypes.string.isRequired
};

const SharedAssignmentsView = () => {
    const [tab, setTab] = useState('reports');
    const [queue, setQueue] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [error, setError] = useState('');

    const reload = useCallback(() => {
        setError('');
        if (tab === 'reports') {
            fetchSharedReports()
                .then(data => setQueue(data.queue || []))
                .catch(err => setError(err.message));
        } else {
            fetchSharedAssignments()
                .then(data => setItems(data.items || []))
                .catch(err => setError(err.message));
        }
    }, [tab]);

    useEffect(reload, [reload]);

    const handleTabReports = useCallback(() => {
        setTab('reports');
        setSelectedId(null);
    }, []);
    const handleTabAll = useCallback(() => {
        setTab('all');
        setSelectedId(null);
    }, []);
    const handleOpen = useCallback(e => setSelectedId(e.currentTarget.dataset.sharedId), []);
    const handleBack = useCallback(() => setSelectedId(null), []);

    if (selectedId) {
        return (
            <SharedDetail
                sharedId={selectedId}
                onBack={handleBack}
                onChanged={reload}
            />
        );
    }

    return (
        <div data-testid="shared-admin-view">
            <div className="admin-tabs">
                <button
                    className={tab === 'reports' ? 'admin-tab-active' : 'admin-tab'}
                    data-testid="shared-admin-tab-reports"
                    type="button"
                    onClick={handleTabReports}
                >{'通報キュー'}</button>
                <button
                    className={tab === 'all' ? 'admin-tab-active' : 'admin-tab'}
                    data-testid="shared-admin-tab-all"
                    type="button"
                    onClick={handleTabAll}
                >{'すべての投稿'}</button>
            </div>
            {error ? <p
                className="admin-error"
                data-testid="shared-admin-error"
            >{error}</p> : null}
            {tab === 'reports' ? (
                queue.length === 0 ? (
                    <p data-testid="shared-admin-queue-empty">{'通報はありません。'}</p>
                ) : (
                    <ul
                        className="admin-list"
                        data-testid="shared-admin-queue"
                    >
                        {queue.map(entry => (
                            <li key={entry.sharedId}>
                                <button
                                    data-shared-id={entry.sharedId}
                                    data-testid={`shared-admin-queue-item-${entry.sharedId}`}
                                    type="button"
                                    onClick={handleOpen}
                                >
                                    <strong>{entry.item ? entry.item.title : '(不明な投稿)'}</strong>
                                    {entry.item ? <StatusBadge status={entry.item.status} /> : null}
                                    <span className="admin-badge admin-badge-warn">{`通報 ${entry.count} 件`}</span>
                                    <ul>
                                        {entry.reports.map((report, index) => (
                                            <li
                                                className="admin-meta"
                                                key={index}
                                            >
                                                {`[${report.createdAt}] ${report.reason}`}
                                            </li>
                                        ))}
                                    </ul>
                                </button>
                            </li>
                        ))}
                    </ul>
                )
            ) : (
                <ul
                    className="admin-list"
                    data-testid="shared-admin-list"
                >
                    {items.map(item => (
                        <li key={item.sharedId}>
                            <button
                                data-shared-id={item.sharedId}
                                data-testid={`shared-admin-item-${item.sharedId}`}
                                type="button"
                                onClick={handleOpen}
                            >
                                <strong>{item.title}</strong>
                                <StatusBadge status={item.status} />
                                <span className="admin-meta">
                                    {`${item.authorName} ・ 取り込み ${item.reuseCount} 回 ・ ${item.createdAt}`}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SharedAssignmentsView;
