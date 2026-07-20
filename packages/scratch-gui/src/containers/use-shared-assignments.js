/**
 * みんなの課題 (shared assignment library) hook — EPIC #1066.
 *
 * S2 (#1069): publishing an assignment from the detail view.
 * S3 (#1070): the catalog — browse/filter, detail preview, import into the
 * current class, own-posts management (unlist/republish) and reporting.
 */
import { useCallback, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import translateError from './classroom-error-utils.js';

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {Function} params.handleTeacher401 - 401 handler from auth hook
 * @param {Function} params.loadClassrooms - refresh the assignment list after an import
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setIsLoading - loading state setter
 * @returns {object} shared assignment state and handlers
 */
const useSharedAssignments = ({
    idToken,
    handleTeacher401,
    loadClassrooms,
    clearError,
    showError,
    intl,
    setIsLoading,
}) => {
    // 共有導線はボード（課題一覧）の各行から開く（#1109）。shareTarget が
    // その課題（classroom）で、これが立っている間だけ共有設定ステップを出す。
    // lastShared に発行結果（限定公開なら合言葉）を保持してステップ内で確認する。
    const [shareTarget, setShareTarget] = useState(null);
    const [lastShared, setLastShared] = useState(null);

    // Catalog state (S3). `catalogTab` switches the whole list between the
    // public catalog and the caller's own posts (mine=1).
    const [showCatalog, setShowCatalog] = useState(false);
    const [catalogTab, setCatalogTab] = useState('all');
    const [catalogItems, setCatalogItems] = useState([]);
    const [catalogCursor, setCatalogCursor] = useState(null);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [sharedDetail, setSharedDetail] = useState(null);
    const [lastImported, setLastImported] = useState(null);
    const [reportSent, setReportSent] = useState(false);

    const handleOpenShareFor = useCallback((classroom) => {
        setLastShared(null);
        setShareTarget(classroom);
    }, []);
    const handleCloseShareForm = useCallback(() => {
        setShareTarget(null);
        setLastShared(null);
    }, []);

    const handleShareAssignment = useCallback(
        async (payload) => {
            clearError();
            setIsLoading(true);
            try {
                const shared = await classroomAPI.shareAssignment(idToken, payload);
                // ステップに留まり、結果（限定公開なら合言葉）を確認させる。
                setLastShared(shared);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, clearError, showError, handleTeacher401, intl, setIsLoading],
    );

    // --- Catalog (S3) ---

    const loadCatalog = useCallback(
        async ({ tab = catalogTab, filters = {}, cursor = null, append = false } = {}) => {
            clearError();
            setCatalogLoading(true);
            try {
                const data = await classroomAPI.listSharedAssignments(idToken, {
                    ...filters,
                    ...(tab === 'mine' ? { mine: '1' } : {}),
                    ...(cursor ? { cursor } : {}),
                });
                setCatalogItems((prev) => (append ? [...prev, ...(data.items || [])] : data.items || []));
                setCatalogCursor(data.cursor || null);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setCatalogLoading(false);
            }
        },
        [idToken, catalogTab, clearError, showError, handleTeacher401, intl],
    );

    const handleOpenCatalog = useCallback(() => {
        setShowCatalog(true);
        setCatalogTab('all');
        setSharedDetail(null);
        setLastImported(null);
        loadCatalog({ tab: 'all' });
    }, [loadCatalog]);

    const handleCloseCatalog = useCallback(() => {
        setShowCatalog(false);
        setSharedDetail(null);
    }, []);

    const handleCatalogTabChange = useCallback(
        (tab) => {
            setCatalogTab(tab);
            setSharedDetail(null);
            loadCatalog({ tab });
        },
        [loadCatalog],
    );

    const handleApplyCatalogFilters = useCallback((filters) => loadCatalog({ filters }), [loadCatalog]);

    const handleLoadMoreCatalog = useCallback(
        (filters) => loadCatalog({ filters, cursor: catalogCursor, append: true }),
        [loadCatalog, catalogCursor],
    );

    const handleOpenSharedDetail = useCallback(
        async (sharedId) => {
            clearError();
            setCatalogLoading(true);
            setReportSent(false);
            try {
                setSharedDetail(await classroomAPI.getSharedAssignment(idToken, sharedId));
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setCatalogLoading(false);
            }
        },
        [idToken, clearError, showError, handleTeacher401, intl],
    );

    const handleCloseSharedDetail = useCallback(() => setSharedDetail(null), []);

    const handleImportShared = useCallback(
        async (sharedId, groupId) => {
            clearError();
            setIsLoading(true);
            try {
                const created = await classroomAPI.importSharedAssignment(idToken, sharedId, { groupId });
                setLastImported(created);
                setShowCatalog(false);
                setSharedDetail(null);
                if (loadClassrooms) {
                    await loadClassrooms();
                }
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, clearError, loadClassrooms, showError, handleTeacher401, intl, setIsLoading],
    );

    /** Own-posts management: unlist / republish, then refresh the mine tab. */
    const handleSetSharedStatus = useCallback(
        async (sharedId, status) => {
            clearError();
            setCatalogLoading(true);
            try {
                if (status === 'unlisted') {
                    await classroomAPI.unlistSharedAssignment(idToken, sharedId);
                } else {
                    await classroomAPI.updateSharedAssignment(idToken, sharedId, { status });
                }
                setSharedDetail(null);
                await loadCatalog({ tab: 'mine' });
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setCatalogLoading(false);
            }
        },
        [idToken, clearError, loadCatalog, showError, handleTeacher401, intl],
    );

    const handleReportShared = useCallback(
        async (sharedId, reason) => {
            clearError();
            setCatalogLoading(true);
            try {
                await classroomAPI.reportSharedAssignment(idToken, sharedId, reason);
                setReportSent(true);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setCatalogLoading(false);
            }
        },
        [idToken, clearError, showError, handleTeacher401, intl],
    );

    /** Reset share state (view switch / logout). */
    const resetSharedAssignments = useCallback(() => {
        setShareTarget(null);
        setLastShared(null);
        setShowCatalog(false);
        setCatalogItems([]);
        setCatalogCursor(null);
        setSharedDetail(null);
        setLastImported(null);
        setReportSent(false);
    }, []);

    return {
        shareTarget,
        lastShared,
        handleOpenShareFor,
        handleCloseShareForm,
        handleShareAssignment,
        showCatalog,
        catalogTab,
        catalogItems,
        catalogCursor,
        catalogLoading,
        sharedDetail,
        lastImported,
        reportSent,
        handleOpenCatalog,
        handleCloseCatalog,
        handleCatalogTabChange,
        handleApplyCatalogFilters,
        handleLoadMoreCatalog,
        handleOpenSharedDetail,
        handleCloseSharedDetail,
        handleImportShared,
        handleSetSharedStatus,
        handleReportShared,
        resetSharedAssignments,
    };
};

export default useSharedAssignments;
