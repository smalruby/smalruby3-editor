import classNames from 'classnames';
import { FormattedMessage, useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import ClassCodeDisplay from './class-code-display.jsx';
import ErrorDisplay from './error-display.jsx';
import TeacherAssignmentEditor from './teacher-assignment-editor.jsx';
import TeacherMemberDetail from './teacher-member-detail.jsx';

import { formatClassLabel } from '../../lib/classroom-class-label.js';
import googleClassroomIcon from '../classroom-teacher-modal/google-classroom-icon.png';
import styles from './classroom-modal.css';

const TeacherClassDetail = ({
    selectedClassroom,
    members,
    selectedMember,
    isLoading,
    error,
    errorActionLabel,
    errorActionHandler,
    errorTitle,
    noBackButton,
    onBack,
    onSelectMember,
    onDeleteMember,
    onDeleteClassroom,
    onOpenSubmission,
    onRefresh,
    onReturnSubmission,
    onDownloadAll,
    downloadProgress,
    onShowCodeDisplay,
    onCloseCodeDisplay,
    onCopyInviteLink,
    onToggleCodeFullscreen,
    onShowPostAssignment,
    onUpdateAssignmentName,
    codeDisplayClassroom,
    codeDisplayFullscreen,
    kickRequestsBySeat,
    onApproveKickRequest,
    onRejectKickRequest,
    onDetailTabChange,
    assignmentEditor,
    group,
}) => {
    const intl = useIntl();
    // Destructured with handle-prefixed names for the embedded editor
    // (react/jsx-handler-names requires handler props to look like handlers).
    const descEditor = assignmentEditor || {};
    const handleDescAddPage = descEditor.onAddPage;
    const handleDescAttachPageImage = descEditor.onAttachPageImage;
    const handleDescCancel = descEditor.onCancel;
    const handleDescChangePageText = descEditor.onChangePageText;
    const handleDescMovePage = descEditor.onMovePage;
    const handleDescRemovePage = descEditor.onRemovePage;
    const handleDescRemovePageImage = descEditor.onRemovePageImage;
    const handleDescRemoveStarter = descEditor.onRemoveStarter;
    const handleDescSave = descEditor.onSave;
    const handleDescUseCurrentProject = descEditor.onUseCurrentProject;
    const handleDescUseFile = descEditor.onUseFile;
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const deleteConfirmRef = useRef(null);
    const [showCodeDisplay, setShowCodeDisplay] = useState(false);
    // The description tab is the entry view (teacher review): editing the
    // student-facing pages is the primary task when opening an assignment.
    const [activeTab, setActiveTab] = useState('description');
    const [previewPage, setPreviewPage] = useState(0);
    const [editAssignmentName, setEditAssignmentName] = useState(
        selectedClassroom.assignmentName || '',
    );

    // Sync local state when a different classroom is selected
    useEffect(() => {
        setEditAssignmentName(selectedClassroom.assignmentName || '');
        setShowDeleteConfirm(false);
        setShowCodeDisplay(false);
        setActiveTab('description');
        setPreviewPage(0);
        if (onDetailTabChange) onDetailTabChange('description');
    }, [selectedClassroom.classroomId]);

    const handleTabClick = useCallback(
        (e) => {
            const tab = e.currentTarget.dataset.tab;
            setActiveTab(tab);
            // Attendance/submission polling runs only while the members tab
            // is visible (cost control — teacher review).
            if (onDetailTabChange) onDetailTabChange(tab);
        },
        [onDetailTabChange],
    );
    const handlePreviewPrev = useCallback(() => setPreviewPage((i) => Math.max(0, i - 1)), []);
    const handlePreviewNext = useCallback(() => setPreviewPage((i) => i + 1), []);

    const memberMap = React.useMemo(() => {
        const map = {};
        for (const m of members) {
            map[m.memberId] = m;
        }
        return map;
    }, [members]);

    const handleCellClick = useCallback(
        (e) => {
            const memberId = e.currentTarget.dataset.memberId;
            if (memberId) {
                onSelectMember(memberId);
            }
        },
        [onSelectMember],
    );

    const handleDeleteClick = useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    // The confirm box appears at the bottom of a long page — bring it into
    // view so the teacher notices it (review round 3).
    useEffect(() => {
        if (showDeleteConfirm && deleteConfirmRef.current) {
            deleteConfirmRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [showDeleteConfirm]);

    const handleDeleteConfirm = useCallback(() => {
        setShowDeleteConfirm(false);
        onDeleteClassroom(selectedClassroom.classroomId);
    }, [onDeleteClassroom, selectedClassroom]);

    const handleDeleteCancel = useCallback(() => {
        setShowDeleteConfirm(false);
    }, []);

    const handleAssignmentNameChange = useCallback((e) => {
        setEditAssignmentName(e.target.value);
    }, []);

    const handleAssignmentNameBlur = useCallback(() => {
        const trimmed = editAssignmentName.trim();
        if (trimmed && trimmed !== (selectedClassroom.assignmentName || '') && onUpdateAssignmentName) {
            onUpdateAssignmentName(trimmed);
        }
    }, [editAssignmentName, selectedClassroom, onUpdateAssignmentName]);




    const handleShowCode = useCallback(() => {
        setShowCodeDisplay(true);
        onShowCodeDisplay(selectedClassroom.classroomId);
    }, [onShowCodeDisplay, selectedClassroom]);

    const handleCloseCode = useCallback(() => {
        setShowCodeDisplay(false);
        onCloseCodeDisplay();
    }, [onCloseCodeDisplay]);

    const isSeated = useCallback((member) => {
        if (!member || !member.lastActiveAt) return false;
        const elapsed = Date.now() - new Date(member.lastActiveAt).getTime();
        return elapsed < 60 * 60 * 1000; // 1 hour
    }, []);

    const joinedCount = members.filter((m) => !m.left).length;
    const totalCount = selectedClassroom.studentCount;

    return (
        <div
            className={styles.detailLayout}
            data-testid="classroom-phase-teacher-detail"
        >
            {showCodeDisplay ? (
                codeDisplayFullscreen ? (
                    <ClassCodeDisplay
                        classroom={codeDisplayClassroom || selectedClassroom}
                        isFullscreen
                        onClose={handleCloseCode}
                        onCopyInviteLink={onCopyInviteLink}
                        onToggleFullscreen={onToggleCodeFullscreen}
                    />
                ) : (
                    <div>
                        <ClassCodeDisplay
                            classroom={
                                codeDisplayClassroom || selectedClassroom
                            }
                            onClose={handleCloseCode}
                            onCopyInviteLink={onCopyInviteLink}
                            onToggleFullscreen={onToggleCodeFullscreen}
                        />
                    </div>
                )
            ) : (
                <React.Fragment>
                    {!noBackButton && (
                        <button
                            className={styles.backLink}
                            data-testid="classroom-back"
                            onClick={onBack}
                        >
                            {'<'}{' '}
                            <FormattedMessage
                                defaultMessage="Back"
                                description="Back button"
                                id="gui.classroom.back"
                            />
                        </button>
                    )}
                    <div className={styles.detailTwoPaneLayout}>
                        {/* Left pane */}
                        <div className={styles.detailLeftPane}>
                            <div
                                className={styles.teacherViewTitle}
                                data-testid="classroom-detail-name"
                            >
                                {group ? formatClassLabel(group) : selectedClassroom.className}
                            </div>

                            {/* Editable assignment name + post assignment button */}
                            <div className={styles.assignmentNameRow}>
                                <span className={styles.assignmentNameLabel}>
                                    <FormattedMessage
                                        defaultMessage="Assignment Name"
                                        description="Assignment name label in class detail"
                                        id="gui.classroom.teacherDetail.assignmentNameLabel"
                                    />
                                    {': '}
                                </span>
                                <input
                                    className={styles.assignmentNameInput}
                                    data-testid="classroom-detail-assignment-name"
                                    maxLength={50}
                                    type="text"
                                    value={editAssignmentName}
                                    onBlur={handleAssignmentNameBlur}
                                    onChange={handleAssignmentNameChange}
                                />
                                {selectedClassroom.googleClassroomCourseId &&
                                    (selectedClassroom.googleClassroomAlternateLink ? (
                                        <a
                                            className={
                                                styles.secondaryButton
                                            }
                                            data-testid="classroom-view-assignment"
                                            href={
                                                selectedClassroom.googleClassroomAlternateLink
                                            }
                                            rel="noopener noreferrer"
                                            target="_blank"
                                        >
                                            <img
                                                alt=""
                                                className={
                                                    styles.gcImportIcon
                                                }
                                                src={
                                                    googleClassroomIcon
                                                }
                                            />
                                            <FormattedMessage
                                                defaultMessage="View Assignment"
                                                description="View posted assignment on Google Classroom"
                                                id="gui.classroom.postAssignment.viewAssignment"
                                            />
                                        </a>
                                    ) : (
                                        <button
                                            className={
                                                styles.secondaryButton
                                            }
                                            data-testid="classroom-post-assignment"
                                            onClick={
                                                onShowPostAssignment
                                            }
                                        >
                                            <img
                                                alt=""
                                                className={
                                                    styles.gcImportIcon
                                                }
                                                src={
                                                    googleClassroomIcon
                                                }
                                            />
                                            <FormattedMessage
                                                defaultMessage="Post Assignment"
                                                description="Post assignment to Google Classroom"
                                                id="gui.classroom.postAssignment.title"
                                            />
                                        </button>
                                    ))}
                            </div>


                            {/* Join code with expand button */}
                            <div className={styles.joinCodeDisplay}>
                                <span className={styles.joinCodeLabel}>
                                    <FormattedMessage
                                        defaultMessage="Join Code"
                                        description="Join code label"
                                        id="gui.classroom.joinCode.label"
                                    />
                                    {': '}
                                </span>
                                <span
                                    className={styles.joinCodeValue}
                                    data-testid="classroom-detail-join-code"
                                >
                                    {selectedClassroom.joinCode.toLowerCase()}
                                </span>
                                <button
                                    className={styles.expandIconButton}
                                    data-testid="classroom-detail-expand-code"
                                    onClick={handleShowCode}
                                    title={intl.formatMessage({
                                        defaultMessage: 'Show fullscreen',
                                        description: 'Tooltip for join code fullscreen button',
                                        id: 'gui.classroom.joinCode.fullscreen',
                                    })}
                                >
                                    {'⛶'}
                                </button>
                            </div>
                            {selectedClassroom.expiresAt && (
                                <div className={styles.expiresAtText}>
                                    <FormattedMessage
                                        defaultMessage="Expires: {date}"
                                        description="Expiry date in class detail"
                                        id="gui.classroom.teacherDetail.expiresAt"
                                        values={{
                                            date: new Date(
                                                selectedClassroom.expiresAt,
                                            ).toLocaleDateString(),
                                        }}
                                    />
                                </div>
                            )}

                            {/* Tabs: Description (default) / Members */}
                            <div className={styles.detailTabs} role="tablist">
                                <button
                                    className={classNames(
                                        styles.detailTab,
                                        activeTab === 'description' && styles.detailTabActive,
                                    )}
                                    data-tab="description"
                                    data-testid="classroom-tab-description"
                                    onClick={handleTabClick}
                                >
                                    <FormattedMessage
                                        defaultMessage="Description"
                                        description="Assignment description tab label"
                                        id="gui.classroom.teacherDetail.descriptionTab"
                                    />
                                </button>
                                <button
                                    className={classNames(
                                        styles.detailTab,
                                        activeTab === 'members' && styles.detailTabActive,
                                    )}
                                    data-tab="members"
                                    data-testid="classroom-tab-members"
                                    onClick={handleTabClick}
                                >
                                    <FormattedMessage
                                        defaultMessage="Members"
                                        description="Members list title"
                                        id="gui.classroom.members.title"
                                    />
                                </button>
                                <button
                                    className={classNames(styles.secondaryButton, styles.detailTabsDownload)}
                                    data-testid="classroom-download-all"
                                    disabled={isLoading || !!downloadProgress}
                                    onClick={onDownloadAll}
                                >
                                    {downloadProgress ? (
                                        `${downloadProgress.current}/${downloadProgress.total}`
                                    ) : (
                                        <FormattedMessage
                                            defaultMessage="Download All"
                                            description="Download all submissions button"
                                            id="gui.classroom.teacherDetail.downloadAll"
                                        />
                                    )}
                                </button>
                            </div>

                            {/* Description tab: the student-facing pages editor.
                                Changes reach students only on save. */}
                            {activeTab === 'description' && assignmentEditor && (
                                <TeacherAssignmentEditor
                                    editorPages={descEditor.editorPages}
                                    embedded
                                    error={null}
                                    errorTitle={null}
                                    hasExistingStarter={descEditor.hasExistingStarter}
                                    isSaving={descEditor.isSaving}
                                    selectedClassroom={selectedClassroom}
                                    starterMode={descEditor.starterMode}
                                    starterSource={descEditor.starterSource}
                                    onAddPage={handleDescAddPage}
                                    onAttachPageImage={handleDescAttachPageImage}
                                    onCancel={handleDescCancel}
                                    onChangePageText={handleDescChangePageText}
                                    onMovePage={handleDescMovePage}
                                    onRemovePage={handleDescRemovePage}
                                    onRemovePageImage={handleDescRemovePageImage}
                                    onRemoveStarter={handleDescRemoveStarter}
                                    onSave={handleDescSave}
                                    onUseCurrentProject={handleDescUseCurrentProject}
                                    onUseFile={handleDescUseFile}
                                />
                            )}

                            {/* Members tab: legend + count/refresh + seat grid */}
                            {activeTab === 'members' && (
                                <React.Fragment>
                            <div className={styles.membersHeader}>
                                <div className={styles.membersLegend}>
                                    <span className={`${styles.legendItem} ${styles.memberCellJoined}`}>
                                        <span className={styles.legendSeated}>
                                            <FormattedMessage defaultMessage="Seated" description="Legend: seated" id="gui.classroom.teacherDetail.legend.seated" />
                                        </span>
                                    </span>
                                    <span className={`${styles.legendItem} ${styles.memberCellSubmitted}`}>
                                        <FormattedMessage defaultMessage="Submitted" description="Legend: submitted" id="gui.classroom.teacherDetail.legend.submitted" />
                                    </span>
                                    <span className={`${styles.legendItem} ${styles.memberCellReturned}`}>
                                        <FormattedMessage defaultMessage="Returned" description="Legend: returned" id="gui.classroom.teacherDetail.legend.returned" />
                                    </span>
                                </div>
                                <div className={styles.membersHeaderRight}>
                                    <span
                                        className={styles.membersCount}
                                        data-testid="classroom-members-count"
                                    >
                                        {joinedCount}
                                        {' / '}
                                        {totalCount}
                                    </span>
                                    <button
                                        className={styles.refreshButton}
                                        data-testid="classroom-refresh"
                                        disabled={isLoading}
                                        onClick={onRefresh}
                                    >
                                        {'↻'}
                                    </button>
                                </div>
                            </div>
                            <div
                                className={styles.membersGrid}
                                data-testid="classroom-members-grid"
                            >
                                {Array.from(
                                    { length: totalCount },
                                    (_, i) => {
                                        const seatNum = i + 1;
                                        const memberId = `seat-${String(seatNum).padStart(2, '0')}`;
                                        const member = memberMap[memberId];
                                        const isSelected =
                                            selectedMember === memberId;
                                        const hasSubmission =
                                            member && member.hasSubmission;
                                        const isReturned =
                                            member &&
                                            member.submissionStatus ===
                                                'returned';
                                        const seated =
                                            member &&
                                            isSeated(member);
                                        let cellColorClass =
                                            styles.memberCellEmpty;
                                        if (member) {
                                            if (isReturned) {
                                                cellColorClass =
                                                    styles.memberCellReturned;
                                            } else if (hasSubmission) {
                                                cellColorClass =
                                                    styles.memberCellSubmitted;
                                            } else {
                                                cellColorClass =
                                                    styles.memberCellJoined;
                                            }
                                        }
                                        const cellClass = classNames(
                                            styles.memberCell,
                                            cellColorClass,
                                            isSelected &&
                                                styles.memberCellSelected,
                                            seated &&
                                                styles.memberCellSeated,
                                        );
                                        const seatKickRequests =
                                            (kickRequestsBySeat && kickRequestsBySeat[seatNum]) || [];
                                        return (
                                            <button
                                                className={cellClass}
                                                data-member-id={memberId}
                                                data-testid={`classroom-member-${memberId}`}
                                                key={memberId}
                                                onClick={handleCellClick}
                                            >
                                                {seatNum}
                                                {seatKickRequests.length > 0 && (
                                                    <span
                                                        className={styles.seatKickRequestBadge}
                                                        data-testid={`classroom-seat-kick-request-${seatNum}`}
                                                        title="退室リクエストあり"
                                                    >
                                                        !
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    },
                                )}
                            </div>
                                </React.Fragment>
                            )}


                            {/* Delete classroom */}
                            <div className={styles.detailFooter}>
                                <ErrorDisplay
                                    actionLabel={errorActionLabel}
                                    error={error}
                                    errorTitle={errorTitle}
                                    onAction={errorActionHandler}
                                />
                                {showDeleteConfirm ? (
                                    <div className={styles.deleteConfirmBox} ref={deleteConfirmRef}>
                                        <div
                                            className={
                                                styles.deleteConfirmMessage
                                            }
                                        >
                                            <FormattedMessage
                                                defaultMessage="Are you sure you want to delete this classroom? All members will be removed."
                                                description="Delete classroom confirmation message"
                                                id="gui.classroom.teacherDetail.deleteConfirm"
                                            />
                                        </div>
                                        <div className={styles.buttonRow}>
                                            <button
                                                className={
                                                    styles.secondaryButton
                                                }
                                                data-testid="classroom-delete-cancel"
                                                onClick={handleDeleteCancel}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Cancel"
                                                    description="Cancel delete classroom button"
                                                    id="gui.classroom.teacherDetail.cancelDelete"
                                                />
                                            </button>
                                            <button
                                                className={
                                                    styles.dangerButton
                                                }
                                                data-testid="classroom-delete-confirm"
                                                onClick={handleDeleteConfirm}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Delete"
                                                    description="Confirm delete classroom button"
                                                    id="gui.classroom.teacherDetail.delete"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={
                                            styles.detailFooterButtons
                                        }
                                    >
                                        <button
                                            className={styles.dangerButton}
                                            data-testid="classroom-delete-classroom"
                                            disabled={isLoading}
                                            onClick={handleDeleteClick}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Delete Classroom"
                                                description="Delete classroom button"
                                                id="gui.classroom.teacherDetail.deleteClassroom"
                                            />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right pane - member detail */}
                        <div className={styles.detailRightPane}>
                            {activeTab === 'description' && assignmentEditor ? (
                                <div className={styles.assignmentPreview} data-testid="classroom-description-preview">
                                    {(() => {
                                        const pages = descEditor.editorPages || [];
                                        const index = Math.min(previewPage, Math.max(0, pages.length - 1));
                                        const page = pages[index];
                                        return (
                                            <React.Fragment>
                                                {/* Pager on top so it is visible without scrolling
                                                    past a tall preview (review round 3). */}
                                                <div className={styles.assignmentPreviewHeader}>
                                                    <div className={styles.assignmentPreviewTitle}>
                                                        <FormattedMessage
                                                            defaultMessage="Student view preview"
                                                            description="Title of the student-view preview pane"
                                                            id="gui.classroom.teacherDetail.previewTitle"
                                                        />
                                                    </div>
                                                    {pages.length > 1 ? (
                                                        <div className={styles.assignmentPreviewPager}>
                                                            <button
                                                                data-testid="classroom-description-preview-prev"
                                                                disabled={index === 0}
                                                                type="button"
                                                                onClick={handlePreviewPrev}
                                                            >
                                                                {'←'}
                                                            </button>
                                                            <span>{`${index + 1} / ${pages.length}`}</span>
                                                            <button
                                                                data-testid="classroom-description-preview-next"
                                                                disabled={index >= pages.length - 1}
                                                                type="button"
                                                                onClick={handlePreviewNext}
                                                            >
                                                                {'→'}
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <div
                                                    className={styles.assignmentPreviewBody}
                                                    data-testid="classroom-description-preview-body"
                                                >
                                                    {/* Image above text — matches the student panel. */}
                                                    {page && (page.previewUrl || page.imageUrl) ? (
                                                        <img
                                                            alt=""
                                                            className={styles.assignmentPreviewImage}
                                                            src={page.previewUrl || page.imageUrl}
                                                        />
                                                    ) : null}
                                                    <p className={styles.assignmentPreviewText}>
                                                        {page ? page.text : ''}
                                                    </p>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })()}
                                </div>
                            ) : (
                            <TeacherMemberDetail
                                isLoading={isLoading}
                                kickRequestsForSelectedSeat={(() => {
                                    if (!selectedMember || !kickRequestsBySeat) return [];
                                    const match = selectedMember.match(/^seat-(\d+)$/);
                                    if (!match) return [];
                                    return kickRequestsBySeat[parseInt(match[1], 10)] || [];
                                })()}
                                memberMap={memberMap}
                                members={members}
                                selectedMember={selectedMember}
                                onApproveKickRequest={onApproveKickRequest}
                                onDeleteMember={onDeleteMember}
                                onOpenSubmission={onOpenSubmission}
                                onRejectKickRequest={onRejectKickRequest}
                                onReturnSubmission={onReturnSubmission}
                            />
                            )}
                        </div>
                    </div>
                </React.Fragment>
            )}
        </div>
    );
};

TeacherClassDetail.propTypes = {
    codeDisplayClassroom: PropTypes.object,
    codeDisplayFullscreen: PropTypes.bool,
    downloadProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
    }),
    error: PropTypes.string,
    errorActionLabel: PropTypes.string,
    errorActionHandler: PropTypes.func,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    members: PropTypes.arrayOf(PropTypes.object).isRequired,
    noBackButton: PropTypes.bool,
    onBack: PropTypes.func,
    onCloseCodeDisplay: PropTypes.func.isRequired,
    onCopyInviteLink: PropTypes.func.isRequired,
    onDeleteClassroom: PropTypes.func.isRequired,
    onDeleteMember: PropTypes.func.isRequired,
    onDownloadAll: PropTypes.func.isRequired,
    onOpenSubmission: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired,
    onReturnSubmission: PropTypes.func.isRequired,
    onSelectMember: PropTypes.func.isRequired,
    onShowCodeDisplay: PropTypes.func.isRequired,
    onShowPostAssignment: PropTypes.func,
    onToggleCodeFullscreen: PropTypes.func.isRequired,
    onUpdateAssignmentName: PropTypes.func,
    kickRequestsBySeat: PropTypes.object,
    onApproveKickRequest: PropTypes.func,
    onRejectKickRequest: PropTypes.func,
    onDetailTabChange: PropTypes.func,
    assignmentEditor: PropTypes.object,
    group: PropTypes.object,
    selectedClassroom: PropTypes.object.isRequired,
    selectedMember: PropTypes.string,
};

export default TeacherClassDetail;
