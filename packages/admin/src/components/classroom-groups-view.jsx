/**
 * クラス（学級）検索・アーカイブ解除 view (EPIC #1129 C #1133).
 *
 * 用語 (#1131・辞典は docs/admin/README.md「用語辞典」): この view の操作対象は
 * **クラス（学級）= `ClassroomGroups` / `groupId`**。姉妹の `classrooms-view.jsx`
 * が扱う **課題（1 授業）** とは別物で、書き込み先テーブルも API パスも違う。
 *
 * なぜ必要か: クラスがアーカイブ中だと、中の課題が `active` でも先生の画面には
 * 出てこない (#1132)。これまでアーカイブ解除は先生用 UI だけの操作だったので、
 * 先生がその画面に辿り着けない問い合わせに運用者が対応できなかった。
 *
 * 同名クラスが実際に並ぶ（Google Classroom 連携での二重作成）ため、行には
 * **年度・人数・中の課題名・作成日時** を必ず併記する。クラス名だけでは
 * 「どちらを戻すのか」を運用者が判断できない。
 */
import PropTypes from 'prop-types';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
    fetchClassroomGroup,
    fetchClassroomGroups,
    setClassroomGroupStatus
} from '../lib/admin-api.js';

const formatDate = iso => (iso ? iso.replace('T', ' ').slice(0, 16) : '-');

const GroupStatusBadge = ({status}) => (
    <span
        className={`admin-badge ${status === 'active' ? 'admin-badge-ok' : 'admin-badge-muted'}`}
        data-testid="classroom-group-admin-status-badge"
    >{status === 'active' ? '利用中' : 'アーカイブ'}</span>
);

GroupStatusBadge.propTypes = {status: PropTypes.string};

const STATUS_FILTERS = [
    {key: '', label: 'すべて'},
    {key: 'active', label: '利用中'},
    {key: 'archived', label: 'アーカイブ'}
];

// 同名クラスの区別に必要な材料（DoD）。人数・年度が未設定のクラス（v1 の
// 名残）もあるので、欠けている項目は '-' で埋めて列を崩さない。
const orDash = value => (value === null || typeof value === 'undefined' ? '-' : value);

const identityLine = item => [
    `年度: ${orDash(item.year)}`,
    `人数: ${orDash(item.studentCount)}`,
    `作成: ${formatDate(item.createdAt)}`
].join(' ・ ');

const assignmentLine = item => {
    const names = item.assignmentNames || [];
    if (item.assignmentCount === 0) return '課題: なし';
    const shown = names.join('、') || '(名称なし)';
    const rest = item.assignmentCount - names.length;
    return `課題(${item.assignmentCount}件): ${shown}${rest > 0 ? ` ほか ${rest} 件` : ''}`;
};

const GroupDetail = ({groupId, onBack, onChanged}) => {
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetchClassroomGroup(groupId)
            .then(setDetail)
            .catch(err => setError(err.message));
    }, [groupId]);

    const handleArm = useCallback(() => setConfirming(true), []);
    const handleDisarm = useCallback(() => setConfirming(false), []);
    const handleFlip = useCallback(async () => {
        if (!detail) return;
        setBusy(true);
        setError('');
        try {
            const next = detail.status === 'active' ? 'archived' : 'active';
            const updated = await setClassroomGroupStatus(groupId, next);
            setDetail(prev => ({
                ...prev,
                status: updated.status,
                updatedAt: updated.updatedAt,
                restoredAt: updated.restoredAt,
                expiresAt: updated.expiresAt
            }));
            setConfirming(false);
            onChanged();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [detail, groupId, onChanged]);

    if (error) {
        return (<p
            className="admin-error"
            data-testid="classroom-group-admin-error"
        >{error}</p>);
    }
    if (!detail) return <p data-testid="classroom-group-admin-loading">{'読み込み中…'}</p>;

    return (
        <div data-testid="classroom-group-admin-detail">
            <button
                className="admin-back-button"
                data-testid="classroom-group-admin-back"
                type="button"
                onClick={onBack}
            >{'← 一覧に戻る'}</button>
            <h3>
                {`クラス（学級）: ${detail.name || '(名称なし)'}`}
                {' '}
                <GroupStatusBadge status={detail.status} />
            </h3>
            <p
                className="admin-meta"
                data-testid="classroom-group-admin-identity"
            >
                {identityLine(detail)}
                {detail.section ? ` ・ 組: ${detail.section}` : ''}
                {` ・ 期限: ${formatDate(detail.expiresAt)}`}
            </p>
            <p className="admin-meta">{`ID: ${detail.groupId}`}</p>
            {detail.status === 'active' ? null : (
                <p
                    className="admin-error"
                    data-testid="classroom-group-admin-archived-note"
                >
                    {'アーカイブ中のため、中の課題が利用中でも先生の画面には表示されません。'}
                </p>
            )}
            <div className="admin-actions">
                {confirming ? (
                    <span
                        className="admin-confirm"
                        data-testid="classroom-group-admin-confirm"
                    >
                        {detail.status === 'active' ?
                            'このクラス（学級）をアーカイブしますか？（中の課題ごと先生の画面から消えます）' :
                            'このクラス（学級）を利用中に戻しますか？' +
                                '（保持期間は今日から数え直します。中の課題の状態は変わりません）'}
                        <button
                            data-testid="classroom-group-admin-confirm-yes"
                            disabled={busy}
                            type="button"
                            onClick={handleFlip}
                        >{'実行'}</button>
                        <button
                            data-testid="classroom-group-admin-confirm-no"
                            disabled={busy}
                            type="button"
                            onClick={handleDisarm}
                        >{'やめる'}</button>
                    </span>
                ) : (
                    <button
                        data-testid="classroom-group-admin-flip"
                        disabled={busy}
                        type="button"
                        onClick={handleArm}
                    >{detail.status === 'active' ? 'アーカイブする' : 'アーカイブを解除する'}</button>
                )}
            </div>
            <h4>{`このクラスの課題（${detail.assignmentCount} 件）`}</h4>
            {detail.assignments.length === 0 ? (
                <p data-testid="classroom-group-admin-assignments-empty">
                    {'このクラスに課題はありません。'}
                </p>
            ) : (
                <ul
                    className="admin-list"
                    data-testid="classroom-group-admin-assignments"
                >
                    {detail.assignments.map(a => (
                        <li
                            data-testid={`classroom-group-admin-assignment-${a.classroomId}`}
                            key={a.classroomId}
                        >
                            <span className="admin-meta">
                                {`課題: ${a.assignmentName || '-'} ・ コード: ${a.joinCode || '-'}`}
                                {` ・ 状態: ${a.status === 'active' ? '利用中' : 'アーカイブ'}`}
                                {` ・ 作成: ${formatDate(a.createdAt)}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

GroupDetail.propTypes = {
    groupId: PropTypes.string.isRequired,
    onBack: PropTypes.func.isRequired,
    onChanged: PropTypes.func.isRequired
};

const GroupBrowser = ({onOpen, reloadKey}) => {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    // filters are passed explicitly so the callback stays referentially stable
    // (the effect keys on reloadKey without refetching on every keystroke).
    const load = useCallback(async filters => {
        setError('');
        setData(null);
        try {
            setData(await fetchClassroomGroups(filters));
        } catch (err) {
            setError(err.message);
        }
    }, []);

    // 適用中の絞り込みを ref に持つ: reloadKey（状態変更後の再読み込み）で
    // 同じ絞り込みのまま引き直したいが、入力のたびに再取得はしたくない。
    const appliedRef = useRef({q: '', status: ''});

    useEffect(() => {
        load(appliedRef.current);
    }, [reloadKey, load]);

    const apply = useCallback(filters => {
        appliedRef.current = filters;
        load(filters);
    }, [load]);

    const handleSubmit = useCallback(e => {
        e.preventDefault();
        apply({q: query.trim(), status});
    }, [apply, query, status]);
    const handleQueryChange = useCallback(e => setQuery(e.target.value), []);
    const handleStatus = useCallback(e => {
        const next = e.currentTarget.dataset.status;
        setStatus(next);
        apply({q: query.trim(), status: next});
    }, [apply, query]);

    return (
        <div>
            <form
                className="admin-search"
                onSubmit={handleSubmit}
            >
                <input
                    data-testid="classroom-group-admin-query"
                    placeholder="クラス名・年度・組・中の課題名"
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                />
                <button
                    data-testid="classroom-group-admin-search"
                    type="submit"
                >{'検索'}</button>
            </form>
            <div
                className="admin-facets"
                data-testid="classroom-group-admin-status-filters"
            >
                {STATUS_FILTERS.map(f => (
                    <button
                        className={status === f.key ? 'admin-chip-active' : 'admin-chip'}
                        data-status={f.key}
                        data-testid={`classroom-group-admin-status-${f.key || 'all'}`}
                        key={f.key || 'all'}
                        type="button"
                        onClick={handleStatus}
                    >{f.label}</button>
                ))}
            </div>
            {error ? <p
                className="admin-error"
                data-testid="classroom-group-admin-error"
            >{error}</p> : null}
            {data === null ? (
                <p data-testid="classroom-group-admin-hint">{'読み込み中…'}</p>
            ) : data.items.length === 0 ? (
                <p data-testid="classroom-group-admin-empty">{'該当するクラス（学級）はありません。'}</p>
            ) : (
                <ul
                    className="admin-list"
                    data-testid="classroom-group-admin-list"
                >
                    {data.items.map(item => (
                        <li key={item.groupId}>
                            <button
                                data-group-id={item.groupId}
                                data-testid={`classroom-group-admin-item-${item.groupId}`}
                                type="button"
                                onClick={onOpen}
                            >
                                <strong>{`クラス（学級）: ${item.name || '(名称なし)'}`}</strong>
                                <GroupStatusBadge status={item.status} />
                                {/* 同名クラスの区別材料（DoD）。名前だけでは選べない。 */}
                                <span className="admin-meta">{identityLine(item)}</span>
                                <span className="admin-meta">{assignmentLine(item)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

GroupBrowser.propTypes = {
    onOpen: PropTypes.func.isRequired,
    reloadKey: PropTypes.number.isRequired
};

const ClassroomGroupsView = () => {
    const [selected, setSelected] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    const handleOpen = useCallback(e => setSelected(e.currentTarget.dataset.groupId), []);
    const handleBack = useCallback(() => {
        setSelected(null);
        setReloadKey(k => k + 1);
    }, []);
    const bumpReload = useCallback(() => setReloadKey(k => k + 1), []);

    if (selected) {
        return (
            <GroupDetail
                groupId={selected}
                onBack={handleBack}
                onChanged={bumpReload}
            />
        );
    }
    return (
        <div data-testid="classroom-group-admin-view">
            <p className="admin-meta">
                {'先生が自分では戻せないクラス（学級）のアーカイブを解除できます。'}
                {'解除しても中の課題の状態は変わりません（アーカイブ済みの課題は課題検索から個別に戻します）。'}
            </p>
            <GroupBrowser
                reloadKey={reloadKey}
                onOpen={handleOpen}
            />
        </div>
    );
};

export default ClassroomGroupsView;
