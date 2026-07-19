/**
 * クラス・課題管理 + 期限切れ復元 view (EPIC #1073 S4 #1084).
 *
 * Two tabs: live classroom search (archive⇄active flip) and the
 * ddb-archive snapshot restore — the UI successor to classroom's
 * bin/restore-classroom.ts (EPIC #1049 D6). Every mutation goes through an
 * explicit two-step confirmation, matching the moderation view.
 */
import PropTypes from 'prop-types';
import {useCallback, useEffect, useState} from 'react';
import {
    executeRestore,
    fetchClassroom,
    fetchClassrooms,
    fetchRestoreCandidates,
    fetchRestorePlan,
    setClassroomStatus
} from '../lib/admin-api.js';

const ClassroomStatusBadge = ({status}) => (
    <span className={`admin-badge ${status === 'active' ? 'admin-badge-ok' : 'admin-badge-muted'}`}>
        {status === 'active' ? '利用中' : 'アーカイブ'}
    </span>
);

ClassroomStatusBadge.propTypes = {status: PropTypes.string};

const formatDate = iso => (iso ? iso.replace('T', ' ').slice(0, 16) : '-');

const ClassroomDetail = ({classroomId, onBack, onChanged}) => {
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetchClassroom(classroomId)
            .then(setDetail)
            .catch(err => setError(err.message));
    }, [classroomId]);

    const handleArm = useCallback(() => setConfirming(true), []);
    const handleDisarm = useCallback(() => setConfirming(false), []);
    const handleFlip = useCallback(async () => {
        if (!detail) return;
        setBusy(true);
        setError('');
        try {
            const next = detail.status === 'active' ? 'archived' : 'active';
            const updated = await setClassroomStatus(classroomId, next);
            setDetail(prev => ({...prev, status: updated.status}));
            setConfirming(false);
            onChanged();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [detail, classroomId, onChanged]);

    if (error) {
        return (<p
            className="admin-error"
            data-testid="classroom-admin-error"
        >{error}</p>);
    }
    if (!detail) return <p data-testid="classroom-admin-loading">{'読み込み中…'}</p>;

    return (
        <div data-testid="classroom-admin-detail">
            <button
                data-testid="classroom-admin-back"
                type="button"
                onClick={onBack}
            >{'← 一覧に戻る'}</button>
            <h3>
                {detail.className}
                {' '}
                <ClassroomStatusBadge status={detail.status} />
            </h3>
            <p className="admin-meta">
                {`課題: ${detail.assignmentName || '-'} ・ 参加コード: ${detail.joinCode}`}
            </p>
            <p
                className="admin-meta"
                data-testid="classroom-admin-counts"
            >
                {`参加 ${detail.memberCount} 人 ・ 提出 ${detail.submissionCount} 件 ・ 期限 ${formatDate(detail.expiresAt)}`}
            </p>
            <div className="admin-actions">
                {confirming ? (
                    <span
                        className="admin-confirm"
                        data-testid="classroom-admin-confirm"
                    >
                        {detail.status === 'active' ?
                            'このクラスをアーカイブしますか？（先生の一覧から非表示になります）' :
                            'このクラスを利用中に戻しますか？'}
                        <button
                            data-testid="classroom-admin-confirm-yes"
                            disabled={busy}
                            type="button"
                            onClick={handleFlip}
                        >{'実行'}</button>
                        <button
                            data-testid="classroom-admin-confirm-no"
                            disabled={busy}
                            type="button"
                            onClick={handleDisarm}
                        >{'やめる'}</button>
                    </span>
                ) : (
                    <button
                        data-testid="classroom-admin-flip"
                        disabled={busy}
                        type="button"
                        onClick={handleArm}
                    >
                        {detail.status === 'active' ? 'アーカイブする' : '利用中に戻す'}
                    </button>
                )}
            </div>
        </div>
    );
};

ClassroomDetail.propTypes = {
    classroomId: PropTypes.string.isRequired,
    onBack: PropTypes.func.isRequired,
    onChanged: PropTypes.func.isRequired
};

const RestorePanel = ({classroomId, onBack}) => {
    const [plan, setPlan] = useState(null);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        fetchRestorePlan(classroomId)
            .then(setPlan)
            .catch(err => setError(err.message));
    }, [classroomId]);

    const handleArm = useCallback(() => setConfirming(true), []);
    const handleDisarm = useCallback(() => setConfirming(false), []);
    const handleExecute = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            setResult(await executeRestore(classroomId));
            setConfirming(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [classroomId]);

    if (error) {
        return (<p
            className="admin-error"
            data-testid="restore-admin-error"
        >{error}</p>);
    }
    if (!plan) return <p data-testid="restore-admin-loading">{'読み込み中…'}</p>;

    if (result) {
        return (
            <div data-testid="restore-admin-done">
                <p>{`復元しました（${result.restored} 件のデータを書き戻し）。`}</p>
                {result.missingFiles > 0 && (
                    <p className="admin-error">
                        {`注意: 提出ファイル ${result.missingFiles} 件は保存期間を過ぎており復元できませんでした。`}
                    </p>
                )}
                <button
                    data-testid="restore-admin-done-back"
                    type="button"
                    onClick={onBack}
                >{'一覧に戻る'}</button>
            </div>
        );
    }

    if (plan.alive) {
        return (
            <div data-testid="restore-admin-alive">
                <p>{'このクラスはまだ存在しています。アーカイブからの復旧は先生自身のクラス管理画面から行えます。'}</p>
                <button
                    data-testid="restore-admin-back"
                    type="button"
                    onClick={onBack}
                >{'← 一覧に戻る'}</button>
            </div>
        );
    }

    return (
        <div data-testid="restore-admin-plan">
            <button
                data-testid="restore-admin-back"
                type="button"
                onClick={onBack}
            >{'← 一覧に戻る'}</button>
            <h3>{plan.classroom.className}</h3>
            <p className="admin-meta">
                {`課題: ${plan.classroom.assignmentName || '-'} ・ 参加コード: ${plan.classroom.joinCode}`}
            </p>
            <p
                className="admin-meta"
                data-testid="restore-admin-summary"
            >
                {`削除日時: ${formatDate(plan.deletedAt)} ・ 参加 ${plan.memberCount} 人 ・ 提出 ${plan.submissionCount} 件`}
                {plan.restoresGroup ? ' ・ 組も復元します' : ''}
            </p>
            {plan.missingFiles > 0 && (
                <p
                    className="admin-error"
                    data-testid="restore-admin-missing"
                >
                    {`注意: 提出ファイル ${plan.missingFiles} 件は保存期間を過ぎており復元できません（記録のみ復元されます）。`}
                </p>
            )}
            <div className="admin-actions">
                {confirming ? (
                    <span
                        className="admin-confirm"
                        data-testid="restore-admin-confirm"
                    >
                        {'このクラスを復元しますか？（保存期間は今日から数え直されます）'}
                        <button
                            data-testid="restore-admin-confirm-yes"
                            disabled={busy}
                            type="button"
                            onClick={handleExecute}
                        >{'実行'}</button>
                        <button
                            data-testid="restore-admin-confirm-no"
                            disabled={busy}
                            type="button"
                            onClick={handleDisarm}
                        >{'やめる'}</button>
                    </span>
                ) : (
                    <button
                        data-testid="restore-admin-execute"
                        disabled={busy}
                        type="button"
                        onClick={handleArm}
                    >{'復元する'}</button>
                )}
            </div>
        </div>
    );
};

RestorePanel.propTypes = {
    classroomId: PropTypes.string.isRequired,
    onBack: PropTypes.func.isRequired
};

const ClassroomsView = () => {
    const [tab, setTab] = useState('live');
    const [query, setQuery] = useState('');
    const [items, setItems] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [error, setError] = useState('');

    const search = useCallback(async () => {
        setError('');
        setItems(null);
        try {
            const data = tab === 'live' ?
                await fetchClassrooms(query.trim()) :
                await fetchRestoreCandidates(query.trim());
            setItems(data.items || []);
        } catch (err) {
            setError(err.message);
        }
    }, [tab, query]);

    // The live tab lists everything up-front; the snapshot tab waits for an
    // explicit query (a full S3 sweep per keystroke would be wasteful) —
    // hence the effect keys on the tab alone, not on the query/search pair.
    useEffect(() => {
        if (tab === 'live') {
            search();
        } else {
            setItems(null);
        }
    }, [tab]);

    const handleTabLive = useCallback(() => {
        setTab('live');
        setSelectedId(null);
    }, []);
    const handleTabRestore = useCallback(() => {
        setTab('restore');
        setSelectedId(null);
    }, []);
    const handleQueryChange = useCallback(e => setQuery(e.target.value), []);
    const handleSubmit = useCallback(e => {
        e.preventDefault();
        search();
    }, [search]);
    const handleOpen = useCallback(e => setSelectedId(e.currentTarget.dataset.classroomId), []);
    const handleBack = useCallback(() => {
        setSelectedId(null);
        search();
    }, [search]);

    if (selectedId && tab === 'live') {
        return (
            <ClassroomDetail
                classroomId={selectedId}
                onBack={handleBack}
                onChanged={search}
            />
        );
    }
    if (selectedId && tab === 'restore') {
        return (
            <RestorePanel
                classroomId={selectedId}
                onBack={handleBack}
            />
        );
    }

    return (
        <div data-testid="classroom-admin-view">
            <div className="admin-tabs">
                <button
                    className={tab === 'live' ? 'admin-tab-active' : 'admin-tab'}
                    data-testid="classroom-admin-tab-live"
                    type="button"
                    onClick={handleTabLive}
                >{'クラス検索'}</button>
                <button
                    className={tab === 'restore' ? 'admin-tab-active' : 'admin-tab'}
                    data-testid="classroom-admin-tab-restore"
                    type="button"
                    onClick={handleTabRestore}
                >{'期限切れ復元'}</button>
            </div>
            <form
                className="admin-search"
                onSubmit={handleSubmit}
            >
                <input
                    data-testid="classroom-admin-query"
                    placeholder="参加コード・クラス名・課題名"
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                />
                <button
                    data-testid="classroom-admin-search"
                    type="submit"
                >{'検索'}</button>
            </form>
            {error ? <p
                className="admin-error"
                data-testid="classroom-admin-error"
            >{error}</p> : null}
            {items === null ? (
                <p data-testid="classroom-admin-hint">
                    {tab === 'restore' ?
                        '参加コードかクラス名・課題名で、期限切れで消えたクラスを検索します。' :
                        '読み込み中…'}
                </p>
            ) : items.length === 0 ? (
                <p data-testid="classroom-admin-empty">{'見つかりませんでした。'}</p>
            ) : (
                <ul
                    className="admin-list"
                    data-testid="classroom-admin-list"
                >
                    {items.map(item => (
                        <li key={item.classroomId}>
                            <button
                                data-classroom-id={item.classroomId}
                                data-testid={`classroom-admin-item-${item.classroomId}`}
                                type="button"
                                onClick={handleOpen}
                            >
                                <strong>{item.className}</strong>
                                {tab === 'live' ?
                                    <ClassroomStatusBadge status={item.status} /> :
                                    <span className="admin-badge admin-badge-warn">{'期限切れ'}</span>}
                                <span className="admin-meta">
                                    {`課題: ${item.assignmentName || '-'} ・ コード: ${item.joinCode}`}
                                    {tab === 'live' ?
                                        ` ・ 期限 ${formatDate(item.expiresAt)}` :
                                        ` ・ 削除 ${formatDate(item.deletedAt)}`}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ClassroomsView;
