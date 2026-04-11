import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import styles from './classroom-modal.css';

const TeacherMemberDetail = ({
    isLoading,
    members,
    memberMap,
    selectedMember,
    onDeleteMember,
    onOpenSubmission,
    onReturnSubmission,
}) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [commentText, setCommentText] = useState('');

    // Reset image index and comment only when a DIFFERENT member is selected
    const prevSelectedMemberRef = React.useRef(selectedMember);
    useEffect(() => {
        if (selectedMember !== prevSelectedMemberRef.current) {
            prevSelectedMemberRef.current = selectedMember;
            setCurrentImageIndex(0);
            if (selectedMember) {
                const member = memberMap[selectedMember];
                setCommentText(member?.teacherComment || '');
            } else {
                setCommentText('');
            }
        }
    }, [selectedMember, memberMap]);

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
        if (
            !selectedMember ||
            !memberMap[selectedMember]?.submissionId
        )
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

    const isSeated = useCallback((member) => {
        if (!member || !member.lastActiveAt) return false;
        const elapsed =
            Date.now() - new Date(member.lastActiveAt).getTime();
        return elapsed < 60 * 60 * 1000; // 1 hour
    }, []);

    // Pre-compute selected member's derived data
    const selectedMemberData = useMemo(() => {
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

    if (selectedMemberData) {
        return (
            <div
                className={styles.memberDetailPanel}
                data-testid="classroom-member-detail"
            >
                <div className={styles.memberDetailHeader}>
                    <span
                        className={styles.memberDetailSeat}
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
                        {selectedMemberData.displayName || '-'}
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
                    <div className={styles.memberDetailBody}>
                        {/* Image carousel */}
                        {selectedMemberData.allImages.length > 0 && (
                            <div className={styles.imageCarousel}>
                                {selectedMemberData.allImages.length >
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
                                        selectedMemberData.allImages[
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
                                {selectedMemberData.projectName}
                            </span>
                        )}
                        {selectedMemberData.projectUrl && (
                            <button
                                className={styles.primaryButton}
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
                        <div className={styles.commentSection}>
                            <textarea
                                className={styles.commentInput}
                                data-testid="classroom-member-detail-comment"
                                maxLength={500}
                                placeholder={
                                    selectedMemberData.isReturned
                                        ? ''
                                        : '...'
                                }
                                value={commentText}
                                onChange={handleCommentChange}
                            />
                            <button
                                className={styles.returnButton}
                                data-testid="classroom-member-detail-return"
                                disabled={
                                    isLoading ||
                                    selectedMemberData.isReturned
                                }
                                onClick={handleReturnClick}
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
        );
    }

    if (selectedMember && !memberMap[selectedMember]) {
        return (
            <div
                className={styles.memberDetailPanel}
                data-testid="classroom-member-detail"
            >
                <div className={styles.memberDetailHeader}>
                    <span
                        className={styles.memberDetailSeat}
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
                    <span>{' - '}</span>
                    <span
                        className={styles.notSeatedBadge}
                        data-testid="classroom-member-detail-name"
                    >
                        <FormattedMessage
                            defaultMessage="Not seated"
                            description="Student is not currently seated"
                            id="gui.classroom.teacherDetail.notSeated"
                        />
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.memberDetailEmpty}>
            <FormattedMessage
                defaultMessage="Select a member"
                description="Prompt to select a member in class detail"
                id="gui.classroom.teacherDetail.selectMember"
            />
        </div>
    );
};

TeacherMemberDetail.propTypes = {
    isLoading: PropTypes.bool,
    memberMap: PropTypes.object.isRequired,
    members: PropTypes.arrayOf(PropTypes.object).isRequired,
    onDeleteMember: PropTypes.func.isRequired,
    onOpenSubmission: PropTypes.func.isRequired,
    onReturnSubmission: PropTypes.func.isRequired,
    selectedMember: PropTypes.string,
};

export default TeacherMemberDetail;
