import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';

import ClassCodeDisplay from './class-code-display.jsx';
import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const TeacherClassDetail = ({
    selectedClassroom,
    members,
    selectedMember,
    isLoading,
    error,
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
    codeDisplayClassroom,
    codeDisplayFullscreen,
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCodeDisplay, setShowCodeDisplay] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [commentText, setCommentText] = useState('');

    // Reset image index and comment when selected member changes
    useEffect(() => {
        setCurrentImageIndex(0);
        if (selectedMember) {
            const memberMap2 = {};
            for (const m of members) memberMap2[m.memberId] = m;
            const member = memberMap2[selectedMember];
            setCommentText(member?.teacherComment || '');
        } else {
            setCommentText('');
        }
    }, [selectedMember, members]);

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

    const handleOpenClick = useCallback(
        (e) => {
            const projectUrl = e.currentTarget.dataset.projectUrl;
            if (projectUrl) {
                onOpenSubmission(projectUrl);
            }
        },
        [onOpenSubmission],
    );

    const handleReturnClick = useCallback(() => {
        if (!selectedMember || !memberMap[selectedMember]?.submissionId)
            return;
        onReturnSubmission(
            memberMap[selectedMember].submissionId,
            commentText,
        );
    }, [selectedMember, memberMap, commentText, onReturnSubmission]);

    const handleCommentChange = useCallback((e) => {
        setCommentText(e.target.value);
    }, []);

    const handlePrevImage = useCallback(() => {
        setCurrentImageIndex((prev) => Math.max(0, prev - 1));
    }, []);

    const handleNextImage = useCallback(() => {
        setCurrentImageIndex((prev) => {
            const member = memberMap[selectedMember];
            if (!member) return prev;
            const allImages = [
                member.thumbnailUrl,
                ...(member.screenshotUrls || []),
            ].filter(Boolean);
            return Math.min(allImages.length - 1, prev + 1);
        });
    }, [memberMap, selectedMember]);

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

    // Pre-compute selected member's derived data for the right pane
    const selectedMemberData = React.useMemo(() => {
        if (!selectedMember || !memberMap[selectedMember]) return null;
        const member = memberMap[selectedMember];
        return {
            ...member,
            allImages: [
                member.thumbnailUrl,
                ...(member.screenshotUrls || []),
            ].filter(Boolean),
            isReturned: member.submissionStatus === 'returned',
            isSeated: isSeated(member),
        };
    }, [selectedMember, memberMap, isSeated]);

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
                                        {joinedCount} / {totalCount}
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
                                        const cellClass = `${styles.memberCell} ${cellColorClass} ${isSelected ? styles.memberCellSelected : ''}`;
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
                                    error={error}
                                    errorTitle={errorTitle}
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
                                        {selectedClassroom.googleClassroomCourseId && (
                                            <button
                                                className={
                                                    styles.secondaryButton
                                                }
                                                data-testid="classroom-post-assignment"
                                                onClick={
                                                    onShowPostAssignment
                                                }
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Post Assignment"
                                                    description="Post assignment to Google Classroom"
                                                    id="gui.classroom.postAssignment.title"
                                                />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right pane - member detail */}
                        <div className={styles.detailRightPane}>
                            {selectedMemberData ? (
                                <div
                                    className={styles.memberDetailPanel}
                                    data-testid="classroom-member-detail"
                                >
                                    <div
                                        className={
                                            styles.memberDetailHeader
                                        }
                                    >
                                        <span
                                            className={
                                                styles.memberDetailSeat
                                            }
                                            data-testid="classroom-member-detail-seat"
                                        >
                                            <FormattedMessage
                                                defaultMessage="Seat {number}"
                                                description="Seat number display in member detail"
                                                id="gui.classroom.teacherDetail.seatNumber"
                                                values={{
                                                    number: selectedMember.replace(
                                                        'seat-',
                                                        '',
                                                    ),
                                                }}
                                            />
                                        </span>
                                        <span data-testid="classroom-member-detail-name">
                                            {selectedMemberData.displayName ||
                                                '-'}
                                        </span>
                                        {selectedMemberData.hasSubmission && (
                                            <span
                                                className={
                                                    selectedMemberData.isReturned
                                                        ? styles.returnedBadge
                                                        : styles.submissionBadge
                                                }
                                                data-testid="classroom-member-detail-submitted"
                                            >
                                                {selectedMemberData.isReturned
                                                    ? '↩ '
                                                    : '✓ '}
                                                {new Date(
                                                    selectedMemberData.submittedAt,
                                                ).toLocaleTimeString()}
                                            </span>
                                        )}
                                        <span
                                            className={
                                                selectedMemberData.isSeated
                                                    ? styles.seatedBadge
                                                    : styles.notSeatedBadge
                                            }
                                            data-testid="classroom-member-detail-seated"
                                        >
                                            {selectedMemberData.isSeated ? (
                                                <FormattedMessage
                                                    defaultMessage="Seated"
                                                    description="Student is currently seated"
                                                    id="gui.classroom.teacherDetail.seated"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Not seated"
                                                    description="Student is not currently seated"
                                                    id="gui.classroom.teacherDetail.notSeated"
                                                />
                                            )}
                                        </span>
                                        <button
                                            className={styles.deleteButton}
                                            data-member-id={selectedMember}
                                            data-testid="classroom-member-remove"
                                            onClick={onDeleteMember}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Remove"
                                                description="Remove member button"
                                                id="gui.classroom.members.remove"
                                            />
                                        </button>
                                    </div>
                                    {selectedMemberData.hasSubmission && (
                                        <div
                                            className={
                                                styles.memberDetailBody
                                            }
                                        >
                                            {/* Image carousel */}
                                            {selectedMemberData.allImages
                                                .length > 0 && (
                                                <div
                                                    className={
                                                        styles.imageCarousel
                                                    }
                                                >
                                                    {selectedMemberData
                                                        .allImages.length >
                                                        1 && (
                                                        <div
                                                            className={
                                                                styles.carouselNav
                                                            }
                                                        >
                                                            <button
                                                                className={
                                                                    styles.carouselButton
                                                                }
                                                                data-testid="classroom-member-detail-prev"
                                                                disabled={
                                                                    currentImageIndex ===
                                                                    0
                                                                }
                                                                onClick={
                                                                    handlePrevImage
                                                                }
                                                            >
                                                                {'<'}
                                                            </button>
                                                            <span data-testid="classroom-member-detail-image-index">
                                                                {`${currentImageIndex + 1} / ${selectedMemberData.allImages.length}`}
                                                            </span>
                                                            <button
                                                                className={
                                                                    styles.carouselButton
                                                                }
                                                                data-testid="classroom-member-detail-next"
                                                                disabled={
                                                                    currentImageIndex >=
                                                                    selectedMemberData
                                                                        .allImages
                                                                        .length -
                                                                        1
                                                                }
                                                                onClick={
                                                                    handleNextImage
                                                                }
                                                            >
                                                                {'>'}
                                                            </button>
                                                        </div>
                                                    )}
                                                    <img
                                                        alt="Submission image"
                                                        className={
                                                            styles.memberDetailThumbnailLarge
                                                        }
                                                        data-testid="classroom-member-detail-thumbnail"
                                                        src={
                                                            selectedMemberData
                                                                .allImages[
                                                                currentImageIndex
                                                            ] ||
                                                            selectedMemberData
                                                                .allImages[0]
                                                        }
                                                    />
                                                </div>
                                            )}
                                            {selectedMemberData.projectName && (
                                                <span
                                                    className={
                                                        styles.submissionProjectName
                                                    }
                                                    data-testid="classroom-member-detail-project-name"
                                                >
                                                    {
                                                        selectedMemberData.projectName
                                                    }
                                                </span>
                                            )}
                                            {selectedMemberData.projectUrl && (
                                                <button
                                                    className={
                                                        styles.primaryButton
                                                    }
                                                    data-project-url={
                                                        selectedMemberData.projectUrl
                                                    }
                                                    data-testid="classroom-member-detail-open"
                                                    disabled={isLoading}
                                                    onClick={handleOpenClick}
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Open in Smalruby"
                                                        description="Open student submission button"
                                                        id="gui.classroom.teacherDetail.openSubmission"
                                                    />
                                                </button>
                                            )}
                                            {/* Comment + Return */}
                                            <div
                                                className={
                                                    styles.commentSection
                                                }
                                            >
                                                <textarea
                                                    className={
                                                        styles.commentInput
                                                    }
                                                    data-testid="classroom-member-detail-comment"
                                                    maxLength={500}
                                                    placeholder={
                                                        selectedMemberData.isReturned
                                                            ? ''
                                                            : '...'
                                                    }
                                                    value={commentText}
                                                    onChange={
                                                        handleCommentChange
                                                    }
                                                />
                                                <button
                                                    className={
                                                        styles.returnButton
                                                    }
                                                    data-testid="classroom-member-detail-return"
                                                    disabled={
                                                        isLoading ||
                                                        selectedMemberData.isReturned
                                                    }
                                                    onClick={
                                                        handleReturnClick
                                                    }
                                                >
                                                    {selectedMemberData.isReturned ? (
                                                        <FormattedMessage
                                                            defaultMessage="Returned"
                                                            description="Returned status label"
                                                            id="gui.classroom.teacherDetail.returned"
                                                        />
                                                    ) : (
                                                        <FormattedMessage
                                                            defaultMessage="Return"
                                                            description="Return submission button"
                                                            id="gui.classroom.teacherDetail.returnSubmission"
                                                        />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : selectedMember && !memberMap[selectedMember] ? (
                                <div className={styles.memberDetailPanel} data-testid="classroom-member-detail">
                                    <div className={styles.memberDetailHeader}>
                                        <span className={styles.memberDetailSeat} data-testid="classroom-member-detail-seat">
                                            <FormattedMessage defaultMessage="Seat {number}" description="Seat number display in member detail" id="gui.classroom.teacherDetail.seatNumber" values={{ number: selectedMember.replace('seat-', '') }} />
                                        </span>
                                        <span data-testid="classroom-member-detail-name">
                                            <FormattedMessage defaultMessage="Not seated" description="Student is not currently seated" id="gui.classroom.teacherDetail.notSeated" />
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.memberDetailEmpty}>
                                    <FormattedMessage
                                        defaultMessage="Select a member"
                                        description="Prompt to select a member in class detail"
                                        id="gui.classroom.teacherDetail.selectMember"
                                    />
                                </div>
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
    selectedClassroom: PropTypes.object.isRequired,
    selectedMember: PropTypes.string,
};

export default TeacherClassDetail;
