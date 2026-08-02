/**
 * クラス・課題管理 view (EPIC #1073 S4 #1084 + 俯瞰ダッシュボード 2026-07-19).
 *
 * Three tabs:
 * - 俯瞰: dashboard (creation trend / content richness / theme / candidates).
 * - 課題検索: live assignment search (archive⇄active flip).
 * - 期限切れ復元: ddb-archive snapshot restore, narrowed by facets
 *   (削除時期 / 先生) so a large deleted set is browsable みんなの課題-style.
 * Every mutation goes through an explicit two-step confirmation.
 *
 * 用語 (#1131・辞典は docs/admin/README.md「用語辞典」):
 * この view の操作対象は **課題（1授業）= `Classrooms` / `classroomId`**。俯瞰・
 * 課題検索・アーカイブ切替は `Classrooms` にしか書き込まない。唯一の例外が期限切れ
 * 復元で、削除スナップショットに親の **クラス（学級）= `ClassroomGroups` /
 * `groupId`** が含まれていればサーバー側で一緒に復元する（そのときだけプランに
 * 「クラス（学級）も復元します」と出す）。
 * ユーザー可視文言は必ず「課題」と呼ぶこと（「クラス」と呼ぶと、運用者が
 * 「先生の画面に戻った」と誤読する — EPIC #1129 の発端になった実際の事故）。
 * 一方で `classroomId` / `classroom-admin-*` testid / `/admin/classrooms` API パスは
 * **意図的に現状維持**（サーバー・スナップショット・E2E と一体の互換識別子。
 * 対応表と理由は docs/admin/README.md）。
 */
import PropTypes from 'prop-types';
import {useCallback, useEffect, useState} from 'react';
import {
    executeRestore,
    fetchClassroom,
    fetchClassrooms,
    fetchRestoreCandidates,
    fetchRestorePlan,
    sendNotification,
    setClassroomStatus,
    setSharingRecommendation
} from '../lib/admin-api.js';
import ClassroomOverviewView from './classroom-overview-view.jsx';

const ClassroomStatusBadge = ({status}) => (
    <span className={`admin-badge ${status === 'active' ? 'admin-badge-ok' : 'admin-badge-muted'}`}>
        {status === 'active' ? '利用中' : 'アーカイブ'}
    </span>
);

ClassroomStatusBadge.propTypes = {status: PropTypes.string};

const formatDate = iso => (iso ? iso.replace('T', ' ').slice(0, 16) : '-');

// One-line summary shared by the live and restore item rows.
const itemLine = (item, tail) =>
    `課題: ${item.assignmentName || '-'} ・ コード: ${item.joinCode} ・ ${tail}`;

// 行・詳細の主タイトルに使う見出し (#1131)。`Classrooms.className` は課題に
// 写された **クラス（学級）名** なので、無ラベルで太字に置くと「これが課題名だ」と
// 読まれる（EPIC #1129 の発端になった誤読）。俯瞰の候補行と同じく `クラス: ` を
// 付けて、下段の `課題: …` と役割を対にする。
// className はサーバーが未設定を '' に正規化して返しうる。
const classTitle = className => `クラス: ${className || '(名称なし)'}`;

// お知らせ送信 (notification center #1111): この課題を作った先生の
// クラス管理画面右上「お知らせ」に届く。宛先はサーバー側で classroomId
// から解決される（teacherSub は SPA に出さない）。
const NotificationSendPanel = ({classroomId}) => {
    const [title, setTitle] = useState('運営からのお知らせ');
    const [message, setMessage] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleTitle = useCallback(e => setTitle(e.target.value), []);
    const handleMessage = useCallback(e => setMessage(e.target.value), []);
    const handleArm = useCallback(() => {
        setSent(false);
        setError('');
        setConfirming(true);
    }, []);
    const handleDisarm = useCallback(() => setConfirming(false), []);
    const handleSend = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            await sendNotification(classroomId, {title: title.trim(), message: message.trim()});
            setConfirming(false);
            setSent(true);
            setMessage('');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [classroomId, title, message]);

    return (
        <div
            className="admin-panel"
            data-testid="classroom-admin-notify"
        >
            <h4>{'先生へのお知らせ'}</h4>
            <p className="admin-meta">
                {'この課題を作成した先生のクラス管理画面（右上「お知らせ」）に届きます。'}
            </p>
            <input
                data-testid="classroom-admin-notify-title"
                maxLength={100}
                placeholder="タイトル"
                type="text"
                value={title}
                onChange={handleTitle}
            />
            <textarea
                data-testid="classroom-admin-notify-message"
                maxLength={1000}
                placeholder="本文（例: この課題、みんなの課題に共有しませんか？）"
                rows={3}
                value={message}
                onChange={handleMessage}
            />
            {error ? <p
                className="admin-error"
                data-testid="classroom-admin-notify-error"
            >{error}</p> : null}
            {sent ? <p data-testid="classroom-admin-notify-done">{'送信しました。'}</p> : null}
            <div className="admin-actions">
                {confirming ? (
                    <span
                        className="admin-confirm"
                        data-testid="classroom-admin-notify-confirm"
                    >
                        {'この内容で先生にお知らせを送りますか？'}
                        <button
                            data-testid="classroom-admin-notify-confirm-yes"
                            disabled={busy}
                            type="button"
                            onClick={handleSend}
                        >{'送信'}</button>
                        <button
                            data-testid="classroom-admin-notify-confirm-no"
                            disabled={busy}
                            type="button"
                            onClick={handleDisarm}
                        >{'やめる'}</button>
                    </span>
                ) : (
                    <button
                        data-testid="classroom-admin-notify-send"
                        disabled={busy || !title.trim() || !message.trim()}
                        type="button"
                        onClick={handleArm}
                    >{'お知らせを送る'}</button>
                )}
            </div>
        </div>
    );
};

NotificationSendPanel.propTypes = {
    classroomId: PropTypes.string.isRequired
};

const ClassroomDetail = ({classroomId, onBack, onChanged}) => {
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState(false);
    // 共有推奨 (#1106) はアーカイブ切替とは独立した確認ステップ
    // （同時にどちらか一方しか arm できない）。
    const [confirmingRecommend, setConfirmingRecommend] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetchClassroom(classroomId)
            .then(setDetail)
            .catch(err => setError(err.message));
    }, [classroomId]);

    const handleArm = useCallback(() => {
        setConfirmingRecommend(false);
        setConfirming(true);
    }, []);
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

    const handleArmRecommend = useCallback(() => {
        setConfirming(false);
        setConfirmingRecommend(true);
    }, []);
    const handleDisarmRecommend = useCallback(() => setConfirmingRecommend(false), []);
    const handleFlipRecommend = useCallback(async () => {
        if (!detail) return;
        setBusy(true);
        setError('');
        try {
            const updated = await setSharingRecommendation(classroomId, !detail.recommendedForSharing);
            setDetail(prev => ({
                ...prev,
                recommendedForSharing: updated.recommendedForSharing,
                recommendedForSharingAt: updated.recommendedForSharingAt,
                recommendedForSharingBy: updated.recommendedForSharingBy
            }));
            setConfirmingRecommend(false);
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
                className="admin-back-button"
                data-testid="classroom-admin-back"
                type="button"
                onClick={onBack}
            >{'← 一覧に戻る'}</button>
            <h3>
                {classTitle(detail.className)}
                {' '}
                <ClassroomStatusBadge status={detail.status} />
                {' '}
                {detail.recommendedForSharing ? (
                    <span
                        className="admin-badge admin-badge-ok"
                        data-testid="classroom-admin-recommended-badge"
                    >{'共有推奨中'}</span>
                ) : null}
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
                            'この課題をアーカイブしますか？（先生の課題一覧から非表示になります）' :
                            'この課題を利用中に戻しますか？'}
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
                {' '}
                {detail.status === 'active' ? (
                    confirmingRecommend ? (
                        <span
                            className="admin-confirm"
                            data-testid="classroom-admin-recommend-confirm"
                        >
                            {detail.recommendedForSharing ?
                                '共有推奨を取り消しますか？（先生には通知されません）' :
                                'この課題の共有を推奨しますか？（作成した先生にお知らせが届き、課題にバナーが出ます）'}
                            <button
                                data-testid="classroom-admin-recommend-confirm-yes"
                                disabled={busy}
                                type="button"
                                onClick={handleFlipRecommend}
                            >{'実行'}</button>
                            <button
                                data-testid="classroom-admin-recommend-confirm-no"
                                disabled={busy}
                                type="button"
                                onClick={handleDisarmRecommend}
                            >{'やめる'}</button>
                        </span>
                    ) : (
                        <button
                            data-testid="classroom-admin-recommend"
                            disabled={busy}
                            type="button"
                            onClick={handleArmRecommend}
                        >
                            {detail.recommendedForSharing ? '共有推奨を取り消す' : 'みんなの課題への共有を推奨する'}
                        </button>
                    )
                ) : null}
            </div>
            <NotificationSendPanel classroomId={classroomId} />
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
                    className="admin-back-button"
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
                <p>
                    {'この課題はまだ存在しています（削除されていません）。'}
                    {'アーカイブ済みなら、先生自身のクラス管理画面から戻せます。'}
                </p>
                <button
                    className="admin-back-button"
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
                className="admin-back-button"
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
                {plan.restoresGroup ? ' ・ クラス（学級）も復元します' : ''}
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
                        {'この課題を復元しますか？（保存期間は今日から数え直されます）'}
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

// 期限切れ復元タブ: q は任意。ファセット（削除時期 / 先生）で大量の削除済みを
// 絞り込んでから課題（と、消えていれば親クラス）を丸ごと復元する。
const RestoreBrowser = ({onOpen}) => {
    const [query, setQuery] = useState('');
    const [month, setMonth] = useState('');
    const [teacher, setTeacher] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const load = useCallback(async filters => {
        setError('');
        setData(null);
        try {
            setData(await fetchRestoreCandidates(filters));
        } catch (err) {
            setError(err.message);
        }
    }, []);

    // First open browses everything (so the facets are populated).
    useEffect(() => {
        load({});
    }, [load]);

    const handleSubmit = useCallback(e => {
        e.preventDefault();
        load({q: query.trim(), month, teacher});
    }, [load, query, month, teacher]);
    const handleQueryChange = useCallback(e => setQuery(e.target.value), []);
    const handleMonth = useCallback(e => {
        const next = e.currentTarget.dataset.month === month ? '' : e.currentTarget.dataset.month;
        setMonth(next);
        load({q: query.trim(), month: next, teacher});
    }, [load, query, month, teacher]);
    const handleTeacher = useCallback(e => {
        const next = e.currentTarget.dataset.teacher === teacher ? '' : e.currentTarget.dataset.teacher;
        setTeacher(next);
        load({q: query.trim(), month, teacher: next});
    }, [load, query, month, teacher]);

    return (
        <div>
            <form
                className="admin-search"
                onSubmit={handleSubmit}
            >
                <input
                    data-testid="classroom-admin-query"
                    placeholder="参加コード・クラス名・課題名（任意）"
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                />
                <button
                    data-testid="classroom-admin-search"
                    type="submit"
                >{'絞り込み'}</button>
            </form>
            {error ? <p
                className="admin-error"
                data-testid="classroom-admin-error"
            >{error}</p> : null}
            {data === null ? (
                <p data-testid="classroom-admin-hint">{'読み込み中…'}</p>
            ) : (
                <div>
                    <div
                        className="admin-facets"
                        data-testid="restore-facets"
                    >
                        <span className="admin-facet-group">
                            <span className="admin-meta">{'削除時期:'}</span>
                            {data.facets.byMonth.map(f => (
                                <button
                                    className={month === f.month ? 'admin-chip-active' : 'admin-chip'}
                                    data-month={f.month}
                                    data-testid={`restore-facet-month-${f.month}`}
                                    key={f.month}
                                    type="button"
                                    onClick={handleMonth}
                                >{`${f.month} (${f.count})`}</button>
                            ))}
                        </span>
                        <span className="admin-facet-group">
                            <span className="admin-meta">{'先生:'}</span>
                            {data.facets.byTeacher.slice(0, 8).map(f => (
                                <button
                                    className={teacher === f.teacherSub ? 'admin-chip-active' : 'admin-chip'}
                                    data-teacher={f.teacherSub}
                                    data-testid={`restore-facet-teacher-${f.teacherSub}`}
                                    key={f.teacherSub}
                                    type="button"
                                    onClick={handleTeacher}
                                >{`${f.teacherSub.slice(0, 8)}… (${f.count})`}</button>
                            ))}
                        </span>
                    </div>
                    <p className="admin-meta">{`${data.total} 件中 ${Math.min(data.total, data.items.length)} 件を表示`}</p>
                    {data.items.length === 0 ? (
                        <p data-testid="classroom-admin-empty">{'該当する削除済み課題はありません。'}</p>
                    ) : (
                        <ul
                            className="admin-list"
                            data-testid="classroom-admin-list"
                        >
                            {data.items.map(item => (
                                <li key={item.classroomId}>
                                    <button
                                        data-classroom-id={item.classroomId}
                                        data-testid={`classroom-admin-item-${item.classroomId}`}
                                        type="button"
                                        onClick={onOpen}
                                    >
                                        <strong>{classTitle(item.className)}</strong>
                                        <span className="admin-badge admin-badge-warn">{'削除済み'}</span>
                                        <span className="admin-meta">
                                            {itemLine(item, `削除 ${formatDate(item.deletedAt)}`)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

RestoreBrowser.propTypes = {
    onOpen: PropTypes.func.isRequired
};

// 課題検索タブ: 生きている課題の一覧・検索 + アーカイブ切替（クラス（学級）は
// 対象外 — 検索・アーカイブ解除は EPIC #1129 の C で扱う）。
const LiveBrowser = ({onOpen, reloadKey}) => {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');

    // search takes the query explicitly so it stays referentially stable — the
    // effect can then key on reloadKey without refetching on every keystroke.
    const search = useCallback(async q => {
        setError('');
        setItems(null);
        try {
            const data = await fetchClassrooms(q.trim());
            setItems(data.items || []);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    // reloadKey bumps after a detail change so the list refreshes.
    useEffect(() => {
        search('');
    }, [reloadKey, search]);

    const handleSubmit = useCallback(e => {
        e.preventDefault();
        search(query);
    }, [search, query]);
    const handleQueryChange = useCallback(e => setQuery(e.target.value), []);

    return (
        <div>
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
                <p data-testid="classroom-admin-hint">{'読み込み中…'}</p>
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
                                onClick={onOpen}
                            >
                                <strong>{classTitle(item.className)}</strong>
                                <ClassroomStatusBadge status={item.status} />
                                <span className="admin-meta">
                                    {itemLine(item, `期限 ${formatDate(item.expiresAt)}`)}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

LiveBrowser.propTypes = {
    onOpen: PropTypes.func.isRequired,
    reloadKey: PropTypes.number.isRequired
};

const ClassroomsView = () => {
    const [tab, setTab] = useState('overview');
    // 'live' detail (archive flip) vs 'restore' panel — track which kind is open.
    // どちらも対象は課題（classroomId）。
    const [selected, setSelected] = useState(null); // {id, kind}
    const [reloadKey, setReloadKey] = useState(0);

    const handleTabOverview = useCallback(() => {
        setTab('overview');
        setSelected(null);
    }, []);
    const handleTabLive = useCallback(() => {
        setTab('live');
        setSelected(null);
    }, []);
    const handleTabRestore = useCallback(() => {
        setTab('restore');
        setSelected(null);
    }, []);

    // Candidates and live items open the live assignment detail; restore items
    // open the restore panel.
    const openLive = useCallback(e => setSelected({id: e.currentTarget.dataset.classroomId, kind: 'live'}), []);
    const openRestore = useCallback(e => setSelected({id: e.currentTarget.dataset.classroomId, kind: 'restore'}), []);
    const handleBack = useCallback(() => {
        setSelected(null);
        setReloadKey(k => k + 1);
    }, []);
    const bumpReload = useCallback(() => setReloadKey(k => k + 1), []);

    if (selected && selected.kind === 'live') {
        return (
            <ClassroomDetail
                classroomId={selected.id}
                onBack={handleBack}
                onChanged={bumpReload}
            />
        );
    }
    if (selected && selected.kind === 'restore') {
        return (
            <RestorePanel
                classroomId={selected.id}
                onBack={handleBack}
            />
        );
    }

    return (
        <div data-testid="classroom-admin-view">
            <div className="admin-tabs">
                <button
                    className={tab === 'overview' ? 'admin-tab-active' : 'admin-tab'}
                    data-testid="classroom-admin-tab-overview"
                    type="button"
                    onClick={handleTabOverview}
                >{'俯瞰'}</button>
                <button
                    className={tab === 'live' ? 'admin-tab-active' : 'admin-tab'}
                    data-testid="classroom-admin-tab-live"
                    type="button"
                    onClick={handleTabLive}
                >{'課題検索'}</button>
                <button
                    className={tab === 'restore' ? 'admin-tab-active' : 'admin-tab'}
                    data-testid="classroom-admin-tab-restore"
                    type="button"
                    onClick={handleTabRestore}
                >{'期限切れ復元'}</button>
            </div>
            {tab === 'overview' && <ClassroomOverviewView onOpenCandidate={openLive} />}
            {tab === 'live' && <LiveBrowser
                reloadKey={reloadKey}
                onOpen={openLive}
            />}
            {tab === 'restore' && <RestoreBrowser onOpen={openRestore} />}
        </div>
    );
};

export default ClassroomsView;
