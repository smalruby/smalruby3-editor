import { defineMessages, useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';

import StudentJoinForm from './student-join-form.jsx';
import StudentJoinedConfirmation from './student-joined-confirmation.jsx';
import StudentSeatSelector from './student-seat-selector.jsx';
import StudentStatusView from './student-status-view.jsx';
import StudentSubmitConfirm from './student-submit-confirm.jsx';

import styles from './classroom-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Classroom',
        description: 'Title for the classroom modal',
        id: 'gui.classroom.title',
    },
});

const ClassroomModal = ({
    phase,
    seatCount,
    takenSeats,
    selectedSeat,
    joinedInfo,
    kickedNotice,
    kickRequestDialogSeat,
    kickRequestPending,
    kickRequestRejectedNotice,
    kickRequestError,
    error,
    errorActionHandler,
    errorActionLabel,
    errorTitle,
    isLoading,
    joinCodeHistory,
    onSelectTeacher,
    onJoinWithCode,
    onSelectSeat,
    onConfirmJoin,
    onClose,
    onDismissKickRequestRejectedNotice,
    onDismissKickedNotice,
    onRequestKick,
    onConfirmKickRequest,
    onCancelKickRequest,
    onLeaveClassroom,
    onStartSubmit,
    onConfirmSubmit,
    onCancelSubmit,
    submitProgress,
    teacherComment,
    onRefreshStudentStatus,
    thumbnailDataUrl,
    classroomState,
}) => {
    const intl = useIntl();

    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            id="classroomModal"
            onRequestClose={onClose}
        >
            <Box className={styles.body} data-testid="classroom-modal">
                {/* Phase: student-join */}
                {phase === 'student-join' && (
                    <StudentJoinForm
                        error={error}
                        errorActionHandler={errorActionHandler}
                        errorActionLabel={errorActionLabel}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        joinCodeHistory={joinCodeHistory}
                        noBackButton
                        onJoin={onJoinWithCode}
                        onTeacherLink={onSelectTeacher}
                    />
                )}

                {/* Phase: student-seat */}
                {phase === 'student-seat' && (
                    <StudentSeatSelector
                        error={error}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        kickedNotice={kickedNotice}
                        kickRequestDialogSeat={kickRequestDialogSeat}
                        kickRequestError={kickRequestError}
                        kickRequestPending={kickRequestPending}
                        kickRequestRejectedNotice={kickRequestRejectedNotice}
                        seatCount={seatCount}
                        selectedSeat={selectedSeat}
                        takenSeats={takenSeats}
                        onCancelKickRequest={onCancelKickRequest}
                        onConfirmJoin={onConfirmJoin}
                        onConfirmKickRequest={onConfirmKickRequest}
                        onDismissKickRequestRejectedNotice={onDismissKickRequestRejectedNotice}
                        onDismissKickedNotice={onDismissKickedNotice}
                        onRequestKick={onRequestKick}
                        onSelectSeat={onSelectSeat}
                    />
                )}

                {/* Phase: student-joined */}
                {phase === 'student-joined' && joinedInfo && (
                    <StudentJoinedConfirmation
                        joinedInfo={joinedInfo}
                        onClose={onClose}
                    />
                )}

                {/* Phase: student-status (already joined) */}
                {phase === 'student-status' && classroomState && (
                    <StudentStatusView
                        classroomState={classroomState}
                        error={error}
                        errorActionHandler={errorActionHandler}
                        errorActionLabel={errorActionLabel}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        teacherComment={teacherComment}
                        onLeaveClassroom={onLeaveClassroom}
                        onRefreshStudentStatus={onRefreshStudentStatus}
                        onStartSubmit={onStartSubmit}
                    />
                )}

                {/* Phase: student-submit-confirm */}
                {phase === 'student-submit-confirm' && (
                    <StudentSubmitConfirm
                        error={error}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        submitProgress={submitProgress}
                        thumbnailDataUrl={thumbnailDataUrl}
                        onCancelSubmit={onCancelSubmit}
                        onConfirmSubmit={onConfirmSubmit}
                    />
                )}
            </Box>
        </Modal>
    );
};

ClassroomModal.propTypes = {
    classroomState: PropTypes.object,
    error: PropTypes.string,
    errorActionHandler: PropTypes.func,
    errorActionLabel: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    joinCodeHistory: PropTypes.arrayOf(
        PropTypes.shape({
            joinCode: PropTypes.string.isRequired,
            className: PropTypes.string,
            assignmentName: PropTypes.string,
        }),
    ),
    joinedInfo: PropTypes.shape({
        assignmentName: PropTypes.string,
        className: PropTypes.string,
        seatNumber: PropTypes.number,
    }),
    kickedNotice: PropTypes.shape({
        joinCode: PropTypes.string,
        className: PropTypes.string,
        seatNumber: PropTypes.number,
    }),
    kickRequestDialogSeat: PropTypes.number,
    kickRequestError: PropTypes.string,
    kickRequestPending: PropTypes.shape({
        requestId: PropTypes.string,
        joinCode: PropTypes.string,
        seatNumber: PropTypes.number,
    }),
    kickRequestRejectedNotice: PropTypes.shape({
        seatNumber: PropTypes.number,
    }),
    onCancelKickRequest: PropTypes.func,
    onCancelSubmit: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirmJoin: PropTypes.func.isRequired,
    onConfirmKickRequest: PropTypes.func,
    onConfirmSubmit: PropTypes.func.isRequired,
    onDismissKickRequestRejectedNotice: PropTypes.func,
    onDismissKickedNotice: PropTypes.func,
    onJoinWithCode: PropTypes.func.isRequired,
    onRequestKick: PropTypes.func,
    onLeaveClassroom: PropTypes.func.isRequired,
    onRefreshStudentStatus: PropTypes.func.isRequired,
    onSelectSeat: PropTypes.func.isRequired,
    onSelectTeacher: PropTypes.func,
    onStartSubmit: PropTypes.func.isRequired,
    phase: PropTypes.string.isRequired,
    seatCount: PropTypes.number,
    selectedSeat: PropTypes.number,
    submitProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
        label: PropTypes.string,
    }),
    takenSeats: PropTypes.arrayOf(PropTypes.number),
    teacherComment: PropTypes.string,
    thumbnailDataUrl: PropTypes.string,
};

ClassroomModal.defaultProps = {
    error: null,
    errorTitle: null,
    isLoading: false,
    joinedInfo: null,
    seatCount: 0,
    selectedSeat: null,
    takenSeats: [],
};

export default ClassroomModal;
