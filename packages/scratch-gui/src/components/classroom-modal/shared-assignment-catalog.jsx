/**
 * みんなの課題 catalog (EPIC #1066, S3): browse/filter the nationwide shared
 * assignment library, preview an item, import it into the current class, and
 * manage the caller's own posts (unlist / republish). Supplement URLs open
 * behind an explicit confirmation that names the external domain (D4).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { SCHOOL_LEVELS, SUBJECTS_BY_LEVEL } from '../../lib/shared-assignment-taxonomy.js';

import styles from './classroom-modal.css';

// Static message map so the level label can be resolved at runtime from the
// taxonomy value (React Intl requires statically evaluate-able messages).
const levelMessages = defineMessages({
    elementary: {
        defaultMessage: 'Elementary school',
        description: 'School level choice: elementary',
        id: 'gui.classroom.shared.levelElementary',
    },
    'junior-high': {
        defaultMessage: 'Junior high school',
        description: 'School level choice: junior high',
        id: 'gui.classroom.shared.levelJuniorHigh',
    },
    high: {
        defaultMessage: 'High school',
        description: 'School level choice: high school',
        id: 'gui.classroom.shared.levelHigh',
    },
    other: {
        defaultMessage: 'Other',
        description: 'School level choice: other',
        id: 'gui.classroom.shared.levelOther',
    },
});

const CatalogCard = ({ item, onOpenDetail }) => {
    const intl = useIntl();
    const handleOpen = useCallback(() => onOpenDetail(item.sharedId), [onOpenDetail, item.sharedId]);
    return (
        <li className={styles.sharedCard} data-testid={`shared-catalog-item-${item.sharedId}`}>
            <button
                className={styles.sharedCardMain}
                data-testid={`shared-catalog-open-${item.sharedId}`}
                type="button"
                onClick={handleOpen}
            >
                <span className={styles.sharedCardTitle}>
                    {item.title}
                    {item.status === 'unlisted' ? (
                        <span className={styles.sharedCardUnlisted}>
                            <FormattedMessage
                                defaultMessage="Unlisted"
                                description="Badge for an unlisted own post"
                                id="gui.classroom.shared.unlistedBadge"
                            />
                        </span>
                    ) : null}
                </span>
                {item.summary ? <span className={styles.sharedCardSummary}>{item.summary}</span> : null}
                <span className={styles.sharedCardBadges}>
                    <span className={styles.classCardBadge}>
                        {intl.formatMessage(levelMessages[item.schoolLevel] || levelMessages.other)}
                    </span>
                    <span className={styles.classCardBadge}>{item.subject}</span>
                    {(item.grades || []).length > 0 ? (
                        <span className={styles.classCardBadge}>
                            {intl.formatMessage(
                                {
                                    defaultMessage: 'Grade {grades}',
                                    description: 'Grades badge on a catalog card',
                                    id: 'gui.classroom.shared.gradesBadge',
                                },
                                { grades: (item.grades || []).join('・') },
                            )}
                        </span>
                    ) : null}
                    {(item.tags || []).map((tag) => (
                        <span key={tag} className={styles.sharedCardTag}>{tag}</span>
                    ))}
                </span>
                <span className={styles.sharedCardMeta}>
                    {intl.formatMessage(
                        {
                            defaultMessage: 'by {author} — imported {count} times',
                            description: 'Author + reuse count line on a catalog card',
                            id: 'gui.classroom.shared.cardMeta',
                        },
                        { author: item.authorName, count: item.reuseCount || 0 },
                    )}
                </span>
            </button>
        </li>
    );
};

CatalogCard.propTypes = {
    item: PropTypes.object.isRequired,
    onOpenDetail: PropTypes.func.isRequired,
};

const SharedAssignmentDetail = ({
    detail,
    group,
    isLoading,
    reportSent,
    onClose,
    onImport,
    onReport,
    onSetStatus,
}) => {
    const intl = useIntl();
    const [showUrlConfirm, setShowUrlConfirm] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [reportReason, setReportReason] = useState('');

    const handleImport = useCallback(
        () => onImport(detail.sharedId, group.groupId),
        [onImport, detail.sharedId, group.groupId],
    );
    const handleShowUrl = useCallback(() => setShowUrlConfirm(true), []);
    const handleHideUrl = useCallback(() => setShowUrlConfirm(false), []);
    const handleToggleReport = useCallback(() => setShowReport((v) => !v), []);
    const handleReasonChange = useCallback((e) => setReportReason(e.target.value), []);
    const handleSendReport = useCallback(() => {
        if (reportReason.trim()) {
            onReport(detail.sharedId, reportReason.trim());
        }
    }, [onReport, detail.sharedId, reportReason]);
    const handleUnlist = useCallback(
        () => onSetStatus(detail.sharedId, 'unlisted'),
        [onSetStatus, detail.sharedId],
    );
    const handleRepublish = useCallback(
        () => onSetStatus(detail.sharedId, 'published'),
        [onSetStatus, detail.sharedId],
    );

    let urlDomain = '';
    if (detail.supplementUrl) {
        try {
            urlDomain = new URL(detail.supplementUrl).hostname;
        } catch {
            urlDomain = '';
        }
    }

    return (
        <div className={styles.sharedDetail} data-testid="shared-catalog-detail">
            <div className={styles.sharedDetailHeader}>
                <h3 className={styles.sharedFormTitle}>{detail.title}</h3>
                <button
                    data-testid="shared-detail-close"
                    type="button"
                    onClick={onClose}
                >
                    <FormattedMessage
                        defaultMessage="Back to the list"
                        description="Close the shared assignment detail"
                        id="gui.classroom.shared.detailBack"
                    />
                </button>
            </div>
            <p className={styles.sharedCardMeta} data-testid="shared-detail-credit">
                {`© ${detail.authorName}${detail.authorAffiliation ? `（${detail.authorAffiliation}）` : ''} / CC BY 4.0`}
            </p>
            {detail.summary ? <p className={styles.sharedFormHint}>{detail.summary}</p> : null}

            {(detail.pages || []).map((page, index) => (
                <div key={index} className={styles.sharedDetailPage}>
                    {page.imageUrl ? (
                        <img alt="" className={styles.assignmentPreviewImage} src={page.imageUrl} />
                    ) : null}
                    <p className={styles.assignmentPreviewText}>{page.text}</p>
                </div>
            ))}

            {detail.hasStarter ? (
                <p className={styles.sharedFormHint} data-testid="shared-detail-starter">
                    <FormattedMessage
                        defaultMessage="Includes a starter project — importing loads it for your class."
                        description="Note that the shared assignment carries a starter project"
                        id="gui.classroom.shared.hasStarter"
                    />
                </p>
            ) : null}

            {detail.supplementUrl ? (
                <div className={styles.sharedDetailUrlBlock}>
                    {showUrlConfirm ? (
                        <span className={styles.sharedDetailUrlConfirm} data-testid="shared-detail-url-confirm">
                            <FormattedMessage
                                defaultMessage="Opens an external site ({domain}). Its content is managed by the author."
                                description="Confirmation before opening the supplement URL (D4)"
                                id="gui.classroom.shared.urlConfirm"
                                values={{ domain: urlDomain }}
                            />
                            <a
                                data-testid="shared-detail-url-open"
                                href={detail.supplementUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                <FormattedMessage
                                    defaultMessage="Open"
                                    description="Open the supplement URL"
                                    id="gui.classroom.shared.urlOpen"
                                />
                            </a>
                            <button data-testid="shared-detail-url-cancel" type="button" onClick={handleHideUrl}>
                                <FormattedMessage
                                    defaultMessage="Cancel"
                                    description="Cancel button of the share form"
                                    id="gui.classroom.shared.cancel"
                                />
                            </button>
                        </span>
                    ) : (
                        <button
                            data-testid="shared-detail-url"
                            type="button"
                            onClick={handleShowUrl}
                        >
                            <FormattedMessage
                                defaultMessage="Supplement material (lesson plan etc.)"
                                description="Button that reveals the supplement URL confirmation"
                                id="gui.classroom.shared.urlButton"
                            />
                        </button>
                    )}
                </div>
            ) : null}

            <div className={styles.sharedFormActions}>
                {detail.isMine ? (
                    detail.status === 'published' ? (
                        <button
                            data-testid="shared-detail-unlist"
                            disabled={isLoading}
                            type="button"
                            onClick={handleUnlist}
                        >
                            <FormattedMessage
                                defaultMessage="Withdraw (unlist)"
                                description="Unlist the caller's own shared assignment"
                                id="gui.classroom.shared.unlist"
                            />
                        </button>
                    ) : (
                        <button
                            data-testid="shared-detail-republish"
                            disabled={isLoading}
                            type="button"
                            onClick={handleRepublish}
                        >
                            <FormattedMessage
                                defaultMessage="Republish"
                                description="Republish the caller's own unlisted assignment"
                                id="gui.classroom.shared.republish"
                            />
                        </button>
                    )
                ) : (
                    <button
                        data-testid="shared-detail-report"
                        disabled={isLoading || reportSent}
                        type="button"
                        onClick={handleToggleReport}
                    >
                        <FormattedMessage
                            defaultMessage="Report"
                            description="Open the report form for a shared assignment"
                            id="gui.classroom.shared.report"
                        />
                    </button>
                )}
                <span className={styles.classSettingsSpacer} />
                {detail.status === 'published' ? (
                    <button
                        className={styles.sharedFormSubmit}
                        data-testid="shared-detail-import"
                        disabled={isLoading}
                        type="button"
                        onClick={handleImport}
                    >
                        <FormattedMessage
                            defaultMessage="Import into this class"
                            description="Import the shared assignment into the current class"
                            id="gui.classroom.shared.import"
                        />
                    </button>
                ) : null}
            </div>

            {showReport && !reportSent ? (
                <div className={styles.sharedReportForm} data-testid="shared-report-form">
                    <textarea
                        data-testid="shared-report-reason"
                        maxLength={200}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'Why are you reporting this? (required)',
                            description: 'Placeholder of the report reason',
                            id: 'gui.classroom.shared.reportPlaceholder',
                        })}
                        value={reportReason}
                        onChange={handleReasonChange}
                    />
                    <button
                        data-testid="shared-report-submit"
                        disabled={isLoading || reportReason.trim().length === 0}
                        type="button"
                        onClick={handleSendReport}
                    >
                        <FormattedMessage
                            defaultMessage="Send report"
                            description="Submit the report"
                            id="gui.classroom.shared.reportSubmit"
                        />
                    </button>
                </div>
            ) : null}
            {reportSent ? (
                <p className={styles.sharedFormSuccess} data-testid="shared-report-sent">
                    <FormattedMessage
                        defaultMessage="Thank you. The report has been sent to the operators."
                        description="Confirmation after sending a report"
                        id="gui.classroom.shared.reportSent"
                    />
                </p>
            ) : null}
        </div>
    );
};

SharedAssignmentDetail.propTypes = {
    detail: PropTypes.object.isRequired,
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired,
    onReport: PropTypes.func.isRequired,
    onSetStatus: PropTypes.func.isRequired,
    reportSent: PropTypes.bool,
};

const SharedAssignmentCatalog = ({ group, isLoading, shared }) => {
    const intl = useIntl();
    const [schoolLevel, setSchoolLevel] = useState('');
    const [subject, setSubject] = useState('');
    const [grade, setGrade] = useState('');
    const [tag, setTag] = useState('');

    const filters = {};
    if (schoolLevel) filters.schoolLevel = schoolLevel;
    if (subject) filters.subject = subject;
    if (grade) filters.grade = grade;
    if (tag.trim()) filters.tag = tag.trim();

    const handleLevelChange = useCallback((e) => {
        setSchoolLevel(e.target.value);
        setSubject('');
    }, []);
    const handleSubjectChange = useCallback((e) => setSubject(e.target.value), []);
    const handleGradeChange = useCallback((e) => setGrade(e.target.value), []);
    const handleTagChange = useCallback((e) => setTag(e.target.value), []);
    const handleApply = useCallback(() => {
        shared.handleApplyCatalogFilters(filters);
    }, [shared, schoolLevel, subject, grade, tag]);
    const handleLoadMore = useCallback(() => {
        shared.handleLoadMoreCatalog(filters);
    }, [shared, schoolLevel, subject, grade, tag]);
    const handleTabAll = useCallback(() => shared.handleCatalogTabChange('all'), [shared]);
    const handleTabMine = useCallback(() => shared.handleCatalogTabChange('mine'), [shared]);

    const subjects = SUBJECTS_BY_LEVEL[schoolLevel] || [];
    const busy = isLoading || shared.catalogLoading;

    return (
        <div className={styles.sharedCatalog} data-testid="shared-catalog">
            <div className={styles.sharedDetailHeader}>
                <h3 className={styles.sharedFormTitle}>
                    <FormattedMessage
                        defaultMessage="みんなの課題 — assignments shared by teachers nationwide"
                        description="Title of the shared assignment catalog"
                        id="gui.classroom.shared.catalogTitle"
                    />
                </h3>
                <button data-testid="shared-catalog-close" type="button" onClick={shared.handleCloseCatalog}>
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Cancel button that leaves the shared catalog"
                        id="gui.classroom.shared.catalogClose"
                    />
                </button>
            </div>

            <div className={styles.detailTabs} role="tablist">
                <button
                    className={classNames(styles.detailTab, {
                        [styles.detailTabActive]: shared.catalogTab === 'all',
                    })}
                    data-testid="shared-catalog-tab-all"
                    type="button"
                    onClick={handleTabAll}
                >
                    <FormattedMessage
                        defaultMessage="Browse all"
                        description="Catalog tab showing every published assignment"
                        id="gui.classroom.shared.tabAll"
                    />
                </button>
                <button
                    className={classNames(styles.detailTab, {
                        [styles.detailTabActive]: shared.catalogTab === 'mine',
                    })}
                    data-testid="shared-catalog-tab-mine"
                    type="button"
                    onClick={handleTabMine}
                >
                    <FormattedMessage
                        defaultMessage="My posts"
                        description="Catalog tab showing the caller's own posts"
                        id="gui.classroom.shared.tabMine"
                    />
                </button>
            </div>

            {shared.sharedDetail ? (
                <SharedAssignmentDetail
                    detail={shared.sharedDetail}
                    group={group}
                    isLoading={busy}
                    reportSent={shared.reportSent}
                    onClose={shared.handleCloseSharedDetail}
                    onImport={shared.handleImportShared}
                    onReport={shared.handleReportShared}
                    onSetStatus={shared.handleSetSharedStatus}
                />
            ) : (
                <React.Fragment>
                    {shared.catalogTab === 'all' ? (
                        <div className={styles.sharedCatalogFilters}>
                            <select
                                data-testid="shared-catalog-filter-level"
                                disabled={busy}
                                value={schoolLevel}
                                onChange={handleLevelChange}
                            >
                                <option value="">
                                    {intl.formatMessage({
                                        defaultMessage: 'All school levels',
                                        description: 'Filter option: every school level',
                                        id: 'gui.classroom.shared.filterAllLevels',
                                    })}
                                </option>
                                {SCHOOL_LEVELS.map((level) => (
                                    <option key={level.value} value={level.value}>
                                        {intl.formatMessage(levelMessages[level.value])}
                                    </option>
                                ))}
                            </select>
                            <select
                                data-testid="shared-catalog-filter-subject"
                                disabled={busy || subjects.length === 0}
                                value={subject}
                                onChange={handleSubjectChange}
                            >
                                <option value="">
                                    {intl.formatMessage({
                                        defaultMessage: 'All subjects',
                                        description: 'Filter option: every subject',
                                        id: 'gui.classroom.shared.filterAllSubjects',
                                    })}
                                </option>
                                {subjects.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <select
                                data-testid="shared-catalog-filter-grade"
                                disabled={busy}
                                value={grade}
                                onChange={handleGradeChange}
                            >
                                <option value="">
                                    {intl.formatMessage({
                                        defaultMessage: 'All grades',
                                        description: 'Filter option: every grade',
                                        id: 'gui.classroom.shared.filterAllGrades',
                                    })}
                                </option>
                                {[1, 2, 3, 4, 5, 6].map((g) => (
                                    <option key={g} value={g}>
                                        {intl.formatMessage(
                                            {
                                                defaultMessage: 'Grade {grade}',
                                                description: 'Grade checkbox label',
                                                id: 'gui.classroom.shared.gradeN',
                                            },
                                            { grade: g },
                                        )}
                                    </option>
                                ))}
                            </select>
                            <input
                                data-testid="shared-catalog-filter-tag"
                                disabled={busy}
                                placeholder={intl.formatMessage({
                                    defaultMessage: 'Tag',
                                    description: 'Placeholder of the tag filter',
                                    id: 'gui.classroom.shared.filterTag',
                                })}
                                type="text"
                                value={tag}
                                onChange={handleTagChange}
                            />
                            <button
                                data-testid="shared-catalog-filter-apply"
                                disabled={busy}
                                type="button"
                                onClick={handleApply}
                            >
                                <FormattedMessage
                                    defaultMessage="Filter"
                                    description="Apply the catalog filters"
                                    id="gui.classroom.shared.filterApply"
                                />
                            </button>
                        </div>
                    ) : null}

                    {shared.catalogItems.length === 0 && !busy ? (
                        <p className={styles.sharedFormHint} data-testid="shared-catalog-empty">
                            <FormattedMessage
                                defaultMessage="No shared assignments found."
                                description="Empty state of the shared catalog"
                                id="gui.classroom.shared.catalogEmpty"
                            />
                        </p>
                    ) : null}
                    <ul className={styles.sharedCards} data-testid="shared-catalog-list">
                        {shared.catalogItems.map((item) => (
                            <CatalogCard
                                key={item.sharedId}
                                item={item}
                                onOpenDetail={shared.handleOpenSharedDetail}
                            />
                        ))}
                    </ul>
                    {shared.catalogCursor ? (
                        <button
                            data-testid="shared-catalog-load-more"
                            disabled={busy}
                            type="button"
                            onClick={handleLoadMore}
                        >
                            <FormattedMessage
                                defaultMessage="Load more"
                                description="Load the next catalog page"
                                id="gui.classroom.shared.loadMore"
                            />
                        </button>
                    ) : null}
                </React.Fragment>
            )}
        </div>
    );
};

SharedAssignmentCatalog.propTypes = {
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    shared: PropTypes.object.isRequired,
};

export default SharedAssignmentCatalog;
