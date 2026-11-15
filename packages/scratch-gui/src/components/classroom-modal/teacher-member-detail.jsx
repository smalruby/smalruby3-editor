import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { isMemberSeated } from '../../lib/classroom-presence.js';
import BoardMenu, { BoardMenuItem } from './board-menu.jsx';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import ClassroomStatusIcon from './classroom-status-icon.jsx';
import LessonMemberDetail from './lesson-member-detail.jsx';

// 提出時刻は日付つきで書く（別の日の提出と見分けるため）。値が無い・読めないときは何も出さない
// （そのまま Date にすると「Invalid Date」や 1970 年の時刻が出てしまう）。
const formatSubmittedAt = (iso, locale) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(locale, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

// 「seat-04」→ 4（確認の文で「出席番号 4」と読む）。
const seatNumberOf = (memberId) => {
    const n = parseInt(String(memberId || '').replace('seat-', ''), 10);
    return Number.isNaN(n) ? memberId : n;
};

const TeacherMemberDetail = ({
    isLoading,
    members,
    memberMap,
    selectedMember,
    onDeleteMember,
    onOpenSubmission,
    onReturnSubmission,
    onSetHiddenFromPeers,
    kickRequestsForSelectedSeat,
    onApproveKickRequest,
    onRejectKickRequest,
    lessonDetail,
    lessonNow,
    showSubmission = true,
}) => {
    const intl = useIntl();
    // Ties the visible label to the comment field (R1)
    const commentInputId = useId();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [commentText, setCommentText] = useState('');
    // 「退室させる」の確認（#1923 C3）。押してすぐ退室させない。
    const [confirmingRemove, setConfirmingRemove] = useState(false);
    // 作品を開くとクラス管理が閉じ、返却していないコメントが消える。そのときだけ先に聞く（#1980）。
    const [confirmingOpen, setConfirmingOpen] = useState(false);

    // Reset image index and comment only when a DIFFERENT member is selected
    const prevSelectedMemberRef = React.useRef(selectedMember);
    useEffect(() => {
        if (selectedMember !== prevSelectedMemberRef.current) {
            prevSelectedMemberRef.current = selectedMember;
            setCurrentImageIndex(0);
            setConfirmingRemove(false);
            setConfirmingOpen(false);
            if (selectedMember) {
                const member = memberMap[selectedMember];
                setCommentText(member?.teacherComment || '');
            } else {
                setCommentText('');
            }
        }
    }, [selectedMember, memberMap]);

    const openSelected = useCallback(() => {
        setConfirmingOpen(false);
        const projectUrl = selectedMember && memberMap[selectedMember]?.projectUrl;
        if (projectUrl) onOpenSubmission(projectUrl);
    }, [selectedMember, memberMap, onOpenSubmission]);
    // 書きかけのコメント: 空でなく、返却したもの（保存されているもの）と違う。
    const hasCommentDraft = useCallback(() => {
        const draft = commentText.trim();
        const saved = ((selectedMember && memberMap[selectedMember]?.teacherComment) || '').trim();
        return draft !== '' && draft !== saved;
    }, [commentText, selectedMember, memberMap]);
    const handleOpenClick = useCallback(() => {
        if (hasCommentDraft()) setConfirmingOpen(true);
        else openSelected();
    }, [hasCommentDraft, openSelected]);
    const handleOpenStay = useCallback(() => setConfirmingOpen(false), []);

    // ⋮ の［退室させる］は確認を開くだけ。確認の［退室させる］で退室させる（#1923 C3）。
    const handleRemoveClick = useCallback(() => setConfirmingRemove(true), []);
    const handleRemoveCancel = useCallback(() => setConfirmingRemove(false), []);
    // onDeleteMember は生徒の ID を受け取る（クリックのイベントをそのまま渡さない）。
    const handleRemoveConfirm = useCallback(() => {
        setConfirmingRemove(false);
        if (selectedMember) onDeleteMember(selectedMember);
    }, [selectedMember, onDeleteMember]);

    const handleReturnClick = useCallback(() => {
        if (!selectedMember || !memberMap[selectedMember]?.submissionId) return;
        onReturnSubmission(memberMap[selectedMember].submissionId, commentText);
    }, [selectedMember, memberMap, commentText, onReturnSubmission]);

    const handleHideFromPeersChange = useCallback(
        (e) => {
            const submissionId = memberMap[selectedMember]?.submissionId;
            if (submissionId && onSetHiddenFromPeers) {
                onSetHiddenFromPeers(submissionId, e.target.checked);
            }
        },
        [selectedMember, memberMap, onSetHiddenFromPeers],
    );

    const handleCommentChange = useCallback((e) => {
        setCommentText(e.target.value);
    }, []);

    const handleApproveKickClick = useCallback(
        (e) => {
            const requestId = e.currentTarget.dataset.requestId;
            if (requestId && onApproveKickRequest) onApproveKickRequest(requestId);
        },
        [onApproveKickRequest],
    );

    const handleRejectKickClick = useCallback(
        (e) => {
            const requestId = e.currentTarget.dataset.requestId;
            if (requestId && onRejectKickRequest) onRejectKickRequest(requestId);
        },
        [onRejectKickRequest],
    );

    const handlePrevImage = useCallback(() => {
        setCurrentImageIndex((prev) => Math.max(0, prev - 1));
    }, []);

    const handleNextImage = useCallback(() => {
        setCurrentImageIndex((prev) => {
            const member = memberMap[selectedMember];
            if (!member) return prev;
            const allImages = [member.thumbnailUrl, ...(member.screenshotUrls || [])].filter(Boolean);
            return Math.min(allImages.length - 1, prev + 1);
        });
    }, [memberMap, selectedMember]);

    const isSeated = useCallback((member) => isMemberSeated(member), []);

    // Clamp image index if images changed (e.g. re-submission with fewer screenshots)
    useEffect(() => {
        if (!selectedMember || !memberMap[selectedMember]) return;
        const member = memberMap[selectedMember];
        const imageCount = [member.thumbnailUrl, ...(member.screenshotUrls || [])].filter(Boolean).length;
        if (imageCount > 0 && currentImageIndex >= imageCount) {
            setCurrentImageIndex(0);
        }
    }, [selectedMember, memberMap, currentImageIndex]);

    // Pre-compute selected member's derived data
    const selectedMemberData = useMemo(() => {
        if (!selectedMember || !memberMap[selectedMember]) return null;
        const member = memberMap[selectedMember];
        return {
            ...member,
            allImages: [member.thumbnailUrl, ...(member.screenshotUrls || [])].filter(Boolean),
            isReturned: member.submissionStatus === 'returned',
            isSeated: isSeated(member),
        };
    }, [selectedMember, memberMap, isSeated]);

    if (selectedMemberData) {
        return (
            <div className={styles.memberDetailPanel} data-testid="classroom-member-detail">
                <div className={styles.memberDetailHeader}>
                    <span className={styles.memberDetailSeat} data-testid="classroom-member-detail-seat">
                        <FormattedMessage
                            defaultMessage="Seat {number}"
                            description="Seat number display in member detail"
                            id="gui.classroom.teacherDetail.seatNumber"
                            values={{
                                number: selectedMember.replace('seat-', ''),
                            }}
                        />
                    </span>
                    <span data-testid="classroom-member-detail-name">{selectedMemberData.displayName || '-'}</span>
                    {showSubmission && selectedMemberData.hasSubmission && (
                        <span
                            className={selectedMemberData.isReturned ? styles.returnedBadge : styles.submissionBadge}
                            data-testid="classroom-member-detail-submitted"
                        >
                            <ClassroomStatusIcon status={selectedMemberData.isReturned ? 'returned' : 'submitted'} />{' '}
                            {formatSubmittedAt(selectedMemberData.submittedAt, intl.locale)}
                        </span>
                    )}
                    {showSubmission && !selectedMemberData.hasSubmission && (
                        <span
                            className={styles.notSubmittedBadge}
                            data-testid="classroom-member-detail-not-submitted"
                        >
                            <ClassroomStatusIcon status="notSubmitted" />{' '}
                            <FormattedMessage
                                defaultMessage="Not submitted"
                                description="Student has not submitted yet (member detail)"
                                id="gui.classroom.teacherDetail.notSubmitted"
                            />
                        </span>
                    )}
                    <span
                        className={selectedMemberData.isSeated ? styles.seatedBadge : styles.notSeatedBadge}
                        data-testid="classroom-member-detail-seated"
                    >
                        <ClassroomStatusIcon status={selectedMemberData.isSeated ? 'seated' : 'notSeated'} />{' '}
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
                    {/* まれな操作は ⋮ に入れる（R2）。退室させても作品は残るので赤にしない（R4・#1923 C3）。 */}
                    <div className={styles.memberDetailMore}>
                        <BoardMenu
                            alignRight
                            ariaLabel={intl.formatMessage({
                                defaultMessage: 'More actions for this student',
                                description: 'Accessible name of the ⋮ menu of the member detail',
                                id: 'gui.classroom.members.moreMenu',
                            })}
                            buttonClassName={styles.boardKebab}
                            disabled={isLoading}
                            label="⋮"
                            testId="classroom-member-more-menu"
                        >
                            {(close) => (
                                <BoardMenuItem
                                    close={close}
                                    disabled={isLoading}
                                    testId="classroom-member-remove"
                                    onSelect={handleRemoveClick}
                                >
                                    <FormattedMessage
                                        defaultMessage="Remove from the assignment"
                                        description="Member detail ⋮ menu: remove (kick) the student from the assignment"
                                        id="gui.classroom.members.remove"
                                    />
                                </BoardMenuItem>
                            )}
                        </BoardMenu>
                    </div>
                </div>
                {confirmingRemove && (
                    <div
                        className={classNames(styles.confirmNote, styles.memberRemoveConfirm)}
                        data-testid="classroom-member-remove-confirm-box"
                    >
                        <p
                            className={styles.memberRemoveConfirmMessage}
                            data-testid="classroom-member-remove-confirm-message"
                            role="alert"
                        >
                            <FormattedMessage
                                defaultMessage="Remove the student at seat {number} from the assignment? (Their work is kept.)"
                                description="Member detail: confirmation before removing (kicking) a student from the assignment"
                                id="gui.classroom.members.removeConfirm"
                                values={{ number: seatNumberOf(selectedMember) }}
                            />
                        </p>
                        <div className={styles.buttonRow}>
                            <ClassroomButton
                                autoFocus
                                dataTestId="classroom-member-remove-cancel"
                                disabled={isLoading}
                                onClick={handleRemoveCancel}
                            >
                                <FormattedMessage
                                    defaultMessage="Cancel"
                                    description="Member detail: cancel removing the student"
                                    id="gui.classroom.members.removeCancel"
                                />
                            </ClassroomButton>
                            <ClassroomButton
                                dataTestId="classroom-member-remove-confirm"
                                disabled={isLoading}
                                variant="primary"
                                onClick={handleRemoveConfirm}
                            >
                                <FormattedMessage
                                    defaultMessage="Remove from the assignment"
                                    description="Member detail: confirm button that removes (kicks) the student"
                                    id="gui.classroom.members.removeConfirmYes"
                                />
                            </ClassroomButton>
                        </div>
                    </div>
                )}
                {kickRequestsForSelectedSeat && kickRequestsForSelectedSeat.length > 0 && (
                    <div className={styles.kickRequestPanel} data-testid="classroom-member-kick-request-panel">
                        <div className={styles.kickRequestPanelTitle}>
                            <ClassroomStatusIcon status="kickRequested" />{' '}
                            <FormattedMessage
                                defaultMessage="{count, plural, one {# kick request from a student} other {# kick requests from students}}"
                                description="Header in the member-detail panel listing pending kick requests"
                                id="gui.classroom.kickRequest.teacherTitle"
                                values={{ count: kickRequestsForSelectedSeat.length }}
                            />
                        </div>
                        {kickRequestsForSelectedSeat.map((req) => (
                            <div
                                className={styles.kickRequestPanelRow}
                                data-testid={`classroom-kick-request-row-${req.requestId}`}
                                key={req.requestId}
                            >
                                <div className={styles.kickRequestPanelReason}>
                                    {req.reason ? (
                                        <span>「{req.reason}」</span>
                                    ) : (
                                        <em>
                                            <FormattedMessage
                                                defaultMessage="(no reason given)"
                                                description="Placeholder shown when a kick request has no reason text"
                                                id="gui.classroom.kickRequest.noReason"
                                            />
                                        </em>
                                    )}
                                </div>
                                <div className={styles.kickRequestPanelButtons}>
                                    <button
                                        className={styles.kickRequestApproveButton}
                                        data-request-id={req.requestId}
                                        data-testid={`classroom-kick-request-approve-${req.requestId}`}
                                        disabled={isLoading}
                                        onClick={handleApproveKickClick}
                                        type="button"
                                    >
                                        <FormattedMessage
                                            defaultMessage="Approve (kick this student)"
                                            description="Approve button in the teacher's kick-request panel"
                                            id="gui.classroom.kickRequest.approve"
                                        />
                                    </button>
                                    <button
                                        className={styles.kickRequestRejectButton}
                                        data-request-id={req.requestId}
                                        data-testid={`classroom-kick-request-reject-${req.requestId}`}
                                        disabled={isLoading}
                                        onClick={handleRejectKickClick}
                                        type="button"
                                    >
                                        <FormattedMessage
                                            defaultMessage="Reject"
                                            description="Reject button in the teacher's kick-request panel"
                                            id="gui.classroom.kickRequest.reject"
                                        />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* Lesson assignments (#1603): per-challenge progress first; the
                    work (thumbnail, comment, return) follows when work is submitted too. */}
                {lessonDetail ? <LessonMemberDetail detail={lessonDetail} now={lessonNow} /> : null}
                {showSubmission && selectedMemberData.hasSubmission && (
                    <div className={styles.memberDetailBody}>
                        {/* Image carousel */}
                        {selectedMemberData.allImages.length > 0 && (
                            <div className={styles.imageCarousel}>
                                {selectedMemberData.allImages.length > 1 && (
                                    <div className={styles.carouselNav}>
                                        <button
                                            className={styles.carouselButton}
                                            data-testid="classroom-member-detail-prev"
                                            disabled={currentImageIndex === 0}
                                            onClick={handlePrevImage}
                                        >
                                            {'<'}
                                        </button>
                                        <span data-testid="classroom-member-detail-image-index">
                                            {`${currentImageIndex + 1} / ${selectedMemberData.allImages.length}`}
                                        </span>
                                        <button
                                            className={styles.carouselButton}
                                            data-testid="classroom-member-detail-next"
                                            disabled={currentImageIndex >= selectedMemberData.allImages.length - 1}
                                            onClick={handleNextImage}
                                        >
                                            {'>'}
                                        </button>
                                    </div>
                                )}
                                <img
                                    alt="Submission image"
                                    className={styles.memberDetailThumbnailLarge}
                                    data-testid="classroom-member-detail-thumbnail"
                                    src={
                                        selectedMemberData.allImages[currentImageIndex] ||
                                        selectedMemberData.allImages[0]
                                    }
                                />
                            </div>
                        )}
                        {selectedMemberData.projectName && (
                            <span
                                className={styles.submissionProjectName}
                                data-testid="classroom-member-detail-project-name"
                            >
                                {selectedMemberData.projectName}
                            </span>
                        )}
                        {selectedMemberData.projectUrl && (
                            /* A secondary button: the main one of this pane is［返却］(R2・#1961). */
                            <ClassroomButton
                                className={styles.memberDetailOpenButton}
                                dataTestId="classroom-member-detail-open"
                                disabled={isLoading}
                                onClick={handleOpenClick}
                            >
                                <FormattedMessage
                                    defaultMessage="Open in Smalruby"
                                    description="Open student submission button"
                                    id="gui.classroom.teacherDetail.openSubmission"
                                />
                            </ClassroomButton>
                        )}
                        {confirmingOpen && (
                            <div
                                className={classNames(styles.confirmNote, styles.memberRemoveConfirm)}
                                data-testid="classroom-member-open-confirm-box"
                            >
                                <p
                                    className={styles.memberRemoveConfirmMessage}
                                    data-testid="classroom-member-open-confirm-message"
                                    role="alert"
                                >
                                    <FormattedMessage
                                        defaultMessage="The comment you have not returned will be lost. Leave this screen and open the work?"
                                        description="Member detail: question before opening the work over a comment not returned (#1980)"
                                        id="gui.classroom.teacherDetail.openLoseComment"
                                    />
                                </p>
                                <div className={styles.buttonRow}>
                                    <ClassroomButton
                                        autoFocus
                                        dataTestId="classroom-member-open-stay"
                                        onClick={handleOpenStay}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Stay"
                                            description="Member detail: closes the question and keeps the comment (#1980)"
                                            id="gui.classroom.teacherDetail.openStay"
                                        />
                                    </ClassroomButton>
                                    <ClassroomButton
                                        dataTestId="classroom-member-open-leave"
                                        disabled={isLoading}
                                        variant="danger"
                                        onClick={openSelected}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Leave"
                                            description="Member detail: opens the work and drops the comment not returned (#1980)"
                                            id="gui.classroom.teacherDetail.openLeave"
                                        />
                                    </ClassroomButton>
                                </div>
                            </div>
                        )}
                        {/* Peer view (#1208): keep an inappropriate submission
                            out of what classmates can see. */}
                        {onSetHiddenFromPeers && selectedMemberData.submissionId && (
                            <label className={styles.hideFromPeers}>
                                <input
                                    checked={!!selectedMemberData.hiddenFromPeers}
                                    data-testid="classroom-member-detail-hide-from-peers"
                                    disabled={isLoading}
                                    type="checkbox"
                                    onChange={handleHideFromPeersChange}
                                />
                                <FormattedMessage
                                    defaultMessage="Don't show to other students"
                                    description="Member detail: exclude this submission from peer view"
                                    id="gui.classroom.teacherDetail.hideFromPeers"
                                />
                            </label>
                        )}
                        {/* Comment + Return */}
                        <div className={styles.commentSection}>
                            {/* R1: a visible label, not「...」in the field (#1924 C5) */}
                            <label
                                className={styles.commentLabel}
                                data-testid="classroom-member-detail-comment-label"
                                htmlFor={commentInputId}
                            >
                                <FormattedMessage
                                    defaultMessage="Comment to the student (sent when you return it)"
                                    description="Member detail: label above the comment field"
                                    id="gui.classroom.teacherDetail.commentLabel"
                                />
                            </label>
                            <textarea
                                className={styles.commentInput}
                                data-testid="classroom-member-detail-comment"
                                id={commentInputId}
                                maxLength={500}
                                value={commentText}
                                onChange={handleCommentChange}
                            />
                            {/* The main button of the seat detail (R2・#1961). */}
                            <ClassroomButton
                                className={styles.memberDetailReturnButton}
                                dataTestId="classroom-member-detail-return"
                                disabled={isLoading || selectedMemberData.isReturned}
                                variant="primary"
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
                            </ClassroomButton>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (selectedMember && !memberMap[selectedMember]) {
        return (
            <div className={styles.memberDetailPanel} data-testid="classroom-member-detail">
                <div className={styles.memberDetailHeader}>
                    <span className={styles.memberDetailSeat} data-testid="classroom-member-detail-seat">
                        <FormattedMessage
                            defaultMessage="Seat {number}"
                            description="Seat number display in member detail"
                            id="gui.classroom.teacherDetail.seatNumber"
                            values={{
                                number: selectedMember.replace('seat-', ''),
                            }}
                        />
                    </span>
                    <span>{' - '}</span>
                    <span className={styles.notSeatedBadge} data-testid="classroom-member-detail-name">
                        <FormattedMessage
                            defaultMessage="Not seated"
                            description="Student is not currently seated"
                            id="gui.classroom.teacherDetail.notSeated"
                        />
                    </span>
                </div>
                {/* A seat whose last student left still shows its progress record. */}
                {lessonDetail ? <LessonMemberDetail detail={lessonDetail} now={lessonNow} /> : null}
            </div>
        );
    }

    return (
        <div className={styles.memberDetailEmpty}>
            <FormattedMessage
                defaultMessage="Click a seat number to view student details"
                description="Prompt to select a member in class detail"
                id="gui.classroom.teacherDetail.selectMember"
            />
        </div>
    );
};

TeacherMemberDetail.propTypes = {
    isLoading: PropTypes.bool,
    lessonDetail: PropTypes.shape({
        progress: PropTypes.object,
        rows: PropTypes.arrayOf(PropTypes.object),
    }),
    lessonNow: PropTypes.number,
    showSubmission: PropTypes.bool,
    kickRequestsForSelectedSeat: PropTypes.arrayOf(
        PropTypes.shape({
            requestId: PropTypes.string.isRequired,
            seatNumber: PropTypes.number,
            reason: PropTypes.string,
            createdAt: PropTypes.string,
        }),
    ),
    memberMap: PropTypes.object.isRequired,
    members: PropTypes.arrayOf(PropTypes.object).isRequired,
    onApproveKickRequest: PropTypes.func,
    onDeleteMember: PropTypes.func.isRequired,
    onOpenSubmission: PropTypes.func.isRequired,
    onRejectKickRequest: PropTypes.func,
    onReturnSubmission: PropTypes.func.isRequired,
    onSetHiddenFromPeers: PropTypes.func,
    selectedMember: PropTypes.string,
};

export default TeacherMemberDetail;
