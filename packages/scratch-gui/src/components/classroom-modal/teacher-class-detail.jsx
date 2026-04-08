import classNames from 'classnames';
import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';

import ClassCodeDisplay from './class-code-display.jsx';
import ErrorDisplay from './error-display.jsx';
import TeacherMemberDetail from './teacher-member-detail.jsx';

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
    onUpdateStudentCount,
    codeDisplayClassroom,
    codeDisplayFullscreen,
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCodeDisplay, setShowCodeDisplay] = useState(false);
    const [showStudentCountDialog, setShowStudentCountDialog] = useState(false);
    const [editStudentCount, setEditStudentCount] = useState(0);
    const [editAssignmentName, setEditAssignmentName] = useState(
        selectedClassroom.assignmentName || '',
    );

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

    const handleOpenStudentCountDialog = useCallback(() => {
        setEditStudentCount(selectedClassroom.studentCount);
        setShowStudentCountDialog(true);
    }, [selectedClassroom]);

    const handleIncrementStudentCount = useCallback(() => {
        setEditStudentCount((prev) => prev + 1);
    }, []);

    const handleConfirmStudentCount = useCallback(() => {
        setShowStudentCountDialog(false);
        if (editStudentCount > selectedClassroom.studentCount && onUpdateStudentCount) {
            onUpdateStudentCount(editStudentCount);
        }
    }, [editStudentCount, selectedClassroom, onUpdateStudentCount]);

    const handleCancelStudentCount = useCallback(() => {
        setShowStudentCountDialog(false);
    }, []);

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
                                className={styles.phaseTitle}
                                data-testid="classroom-detail-name"
                            >
                                {selectedClassroom.className}
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

                            {/* Members header + grid */}
                            <div className={styles.membersHeader}>
                                <div
                                    className={styles.phaseTitle}
                                    style={{ marginBottom: 0 }}
                                >
                                    <FormattedMessage
                                        defaultMessage="Members"
                                        description="Members list title"
                                        id="gui.classroom.members.title"
                                    />
                                </div>
                                <div className={styles.membersHeaderRight}>
                                    <span
                                        className={styles.membersCount}
                                        data-testid="classroom-members-count"
                                    >
                                        {joinedCount} /{' '}
                                        <button
                                            className={styles.studentCountButton}
                                            data-testid="classroom-student-count-btn"
                                            onClick={handleOpenStudentCountDialog}
                                        >
                                            {totalCount}
                                        </button>
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
                                        return (
                                            <button
                                                className={cellClass}
                                                data-member-id={memberId}
                                                data-testid={`classroom-member-${memberId}`}
                                                key={memberId}
                                                onClick={handleCellClick}
                                            >
                                                {seatNum}
                                            </button>
                                        );
                                    },
                                )}
                            </div>

                            {/* Delete classroom */}
                            <div className={styles.detailFooter}>
                                <ErrorDisplay
                                    actionLabel={errorActionLabel}
                                    error={error}
                                    errorTitle={errorTitle}
                                    onAction={errorActionHandler}
                                />
                                {showDeleteConfirm ? (
                                    <div className={styles.deleteConfirmBox}>
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
                                            className={
                                                styles.secondaryButton
                                            }
                                            data-testid="classroom-download-all"
                                            disabled={
                                                isLoading ||
                                                !!downloadProgress
                                            }
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

                        {showStudentCountDialog && (
                            <div className={styles.studentCountDialog} data-testid="classroom-student-count-dialog">
                                <div className={styles.studentCountDialogContent}>
                                    <div className={styles.studentCountDialogTitle}>
                                        <FormattedMessage
                                            defaultMessage="Change Student Count"
                                            description="Student count dialog title"
                                            id="gui.classroom.teacherDetail.studentCountTitle"
                                        />
                                    </div>
                                    <div className={styles.studentCountDialogBody}>
                                        <span className={styles.studentCountValue} data-testid="classroom-student-count-value">
                                            {editStudentCount}
                                        </span>
                                        <button
                                            className={styles.studentCountIncrement}
                                            data-testid="classroom-student-count-increment"
                                            onClick={handleIncrementStudentCount}
                                        >
                                            {'+'}
                                        </button>
                                    </div>
                                    <div className={styles.studentCountDialogHint}>
                                        <FormattedMessage
                                            defaultMessage="You can increase the number of seats. Decreasing is not allowed."
                                            description="Student count dialog hint"
                                            id="gui.classroom.teacherDetail.studentCountHint"
                                        />
                                    </div>
                                    <div className={styles.buttonRow}>
                                        <button
                                            className={styles.secondaryButton}
                                            data-testid="classroom-student-count-cancel"
                                            onClick={handleCancelStudentCount}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Cancel"
                                                description="Cancel button"
                                                id="gui.classroom.teacherDetail.cancelStudentCount"
                                            />
                                        </button>
                                        <button
                                            className={styles.primaryButton}
                                            data-testid="classroom-student-count-ok"
                                            disabled={editStudentCount <= selectedClassroom.studentCount}
                                            onClick={handleConfirmStudentCount}
                                        >
                                            {'OK'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Right pane - member detail */}
                        <div className={styles.detailRightPane}>
                            <TeacherMemberDetail
                                isLoading={isLoading}
                                memberMap={memberMap}
                                members={members}
                                selectedMember={selectedMember}
                                onDeleteMember={onDeleteMember}
                                onOpenSubmission={onOpenSubmission}
                                onReturnSubmission={onReturnSubmission}
                            />
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
    onUpdateStudentCount: PropTypes.func,
    selectedClassroom: PropTypes.object.isRequired,
    selectedMember: PropTypes.string,
};

export default TeacherClassDetail;
