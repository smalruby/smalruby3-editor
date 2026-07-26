/**
 * お知らせセンター hook — EPIC #1111.
 *
 * Admin → teacher notices shown behind the bell in the class management title
 * bar. 運営からの連絡は多くても週 1 回程度なので、**取得は 1 日 1 回**に絞る
 * （コスト削減・レビュー指摘）: その日はじめてクラス管理を開いたときだけ
 * `GET /notifications` を 1 回呼び、結果を localStorage に日付つきで保存する。
 * 同じ日の再オープンはキャッシュを読むだけで API を叩かない（旧実装の 60 秒
 * ポーリングは廃止）。
 *
 * パネルを開くと全件を既読化する（バッジは即消える。未読ドットはその表示
 * 中だけ残す）。
 */
import { useCallback, useEffect, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import { teacherEmailFromToken } from '../lib/classroom-class-label.js';

// localStorage: 日次取得ガード + キャッシュ（smalruby: プレフィックス規約）。
const STORAGE_KEY = 'smalruby:classroomNotifications';

/** ローカル日付 YYYY-MM-DD（日次ガードのキー）。 */
const todayStr = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const readCache = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
        return null;
    }
};

const writeCache = (value) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (e) {
        // quota / private mode — キャッシュは best-effort。
    }
};

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token (null before login)
 * @param {Function} params.handleTeacher401 - 401 handler from auth hook
 * @returns {object} notification state and handlers
 */
const useTeacherNotifications = ({ idToken, handleTeacher401 }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    // 共有 PC 対策: 同じ日でも先生が違えばキャッシュを使わず取り直す。
    const teacherKey = teacherEmailFromToken(idToken) || '';

    useEffect(() => {
        if (!idToken) return () => {};
        const today = todayStr();
        // teacherKey が空（dev-bypass 等の非 JWT トークンで email を取れない）
        // ときはキャッシュを使わず毎回取得する。空キー同士だと共有 PC で別の
        // 先生の通知が混ざるため（レビュー指摘）。本番の Google/Microsoft ID
        // トークンは email を持つのでキャッシュが効く。
        const cache = teacherKey ? readCache() : null;
        if (cache && cache.date === today && cache.teacher === teacherKey) {
            // 今日はすでに取得済み（同じ先生）→ API を叩かずキャッシュを使う。
            setNotifications(cache.notifications || []);
            setUnreadCount(cache.unreadCount || 0);
            return () => {};
        }
        // その日はじめてのオープン → 1 回だけ取得してキャッシュする。
        let cancelled = false;
        (async () => {
            try {
                const data = await classroomAPI.listNotifications(idToken);
                if (cancelled) return;
                const list = data.notifications || [];
                const unread = data.unreadCount || 0;
                setNotifications(list);
                setUnreadCount(unread);
                // 空キー（識別不能）はキャッシュしない（共有 PC での取り違え防止）。
                if (teacherKey) {
                    writeCache({ date: today, teacher: teacherKey, notifications: list, unreadCount: unread });
                }
            } catch (err) {
                // お知らせは補助機能 — 取得失敗はクラス管理本体に影響させない。
                // 401（セッション切れ）のときだけサイレント再認証。
                if (err.status === 401) {
                    await handleTeacher401();
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [idToken, teacherKey, handleTeacher401]);

    const handleToggleNotifications = useCallback(() => {
        // 副作用は state updater の外（StrictMode / concurrent での二重実行対策）。
        const next = !isOpen;
        if (next && unreadCount > 0) {
            // パネルを開いた = すべて見た。バッジを即消し、サーバーへ既読を永続化。
            // 当日キャッシュの未読数も 0 にして同日再オープンと整合させる（未読
            // ドットは今の表示中だけ残すため in-memory の readAt は書き換えない）。
            setUnreadCount(0);
            classroomAPI.markNotificationsRead(idToken).catch(() => {});
            const cache = readCache();
            if (cache) writeCache({ ...cache, unreadCount: 0 });
        }
        setIsOpen(next);
    }, [idToken, isOpen, unreadCount]);

    const handleCloseNotifications = useCallback(() => setIsOpen(false), []);

    // Reset in-memory state (logout / go-to-login). 日次キャッシュは残す
    // （同じ先生が同じ日に入り直しても取得は 1 回に保つ）。
    const resetNotifications = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
        setIsOpen(false);
    }, []);

    return {
        notifications,
        unreadCount,
        isOpen,
        handleToggleNotifications,
        handleCloseNotifications,
        resetNotifications,
    };
};

export default useTeacherNotifications;
