import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import styles from './classroom-teacher-kick-toast.css';

/**
 * One kick request with its approve / reject / open-assignment buttons.
 * @param {object} props - component props
 * @param {object} props.request - pending kick request (GET /kick-requests/pending)
 * @param {boolean} props.busy - an action on this request is in flight
 * @param {Function} props.onApprove - called with the request
 * @param {Function} props.onReject - called with the request
 * @param {Function} props.onOpenAssignment - called with the request
 * @returns {React.ReactElement} the row
 */
const KickRequestRow = ({ request, busy, onApprove, onReject, onOpenAssignment }) => {
    const handleApprove = useCallback(() => onApprove(request), [onApprove, request]);
    const handleReject = useCallback(() => onReject(request), [onReject, request]);
    const handleOpen = useCallback(() => onOpenAssignment(request), [onOpenAssignment, request]);
    return (
        <div
            className={styles.row}
            data-request-id={request.requestId}
            data-testid="classroom-teacher-kick-toast-request"
        >
            <div className={styles.title}>
                <FormattedMessage
                    defaultMessage="Seat {seatNumber}: a student asks you to free this seat"
                    description="Teacher kick-request toast: what is requested (#1200)"
                    id="gui.classroomTeacherKick.title"
                    values={{ seatNumber: request.seatNumber }}
                />
            </div>
            <div className={styles.meta}>
                {[request.className, request.assignmentName].filter(Boolean).join(' / ')}
            </div>
            <div className={styles.meta}>
                <FormattedMessage
                    defaultMessage="Now in this seat: {name}"
                    description="Teacher kick-request toast: nickname of the student currently in the seat (#1200)"
                    id="gui.classroomTeacherKick.occupant"
                    values={{ name: request.occupantName || '-' }}
                />
            </div>
            <div
                className={styles.reason}
                data-testid="classroom-teacher-kick-toast-reason"
            >
                {request.reason ? (
                    `「${request.reason}」`
                ) : (
                    <FormattedMessage
                        defaultMessage="(no message)"
                        description="Teacher kick-request toast: the student wrote no message (#1200)"
                        id="gui.classroomTeacherKick.noReason"
                    />
                )}
            </div>
            <div className={styles.note}>
                <FormattedMessage
                    defaultMessage="Check with the students in person before approving."
                    description="Teacher kick-request toast: confirm in the classroom before approving (#1200)"
                    id="gui.classroomTeacherKick.confirmNote"
                />
            </div>
            <div className={styles.actions}>
                <button
                    className={styles.approve}
                    data-testid="classroom-teacher-kick-toast-approve"
                    disabled={busy}
                    onClick={handleApprove}
                >
                    <FormattedMessage
                        defaultMessage="Approve"
                        description="Teacher kick-request toast: approve (removes the student in the seat) (#1200)"
                        id="gui.classroomTeacherKick.approve"
                    />
                </button>
                <button
                    className={styles.button}
                    data-testid="classroom-teacher-kick-toast-reject"
                    disabled={busy}
                    onClick={handleReject}
                >
                    <FormattedMessage
                        defaultMessage="Reject"
                        description="Teacher kick-request toast: reject (#1200)"
                        id="gui.classroomTeacherKick.reject"
                    />
                </button>
                <button
                    className={styles.link}
                    data-testid="classroom-teacher-kick-toast-open"
                    onClick={handleOpen}
                >
                    <FormattedMessage
                        defaultMessage="Open assignment"
                        description="Teacher kick-request toast: open the assignment in class management (#1200)"
                        id="gui.classroomTeacherKick.openAssignment"
                    />
                </button>
            </div>
        </div>
    );
};

KickRequestRow.propTypes = {
    busy: PropTypes.bool,
    onApprove: PropTypes.func.isRequired,
    onOpenAssignment: PropTypes.func.isRequired,
    onReject: PropTypes.func.isRequired,
    request: PropTypes.shape({
        requestId: PropTypes.string.isRequired,
        seatNumber: PropTypes.number,
        className: PropTypes.string,
        assignmentName: PropTypes.string,
        occupantName: PropTypes.string,
        reason: PropTypes.string,
    }).isRequired,
};

/**
 * Bottom-of-screen notice of pending kick requests for a logged-in teacher
 * (#1200). As a toast it shows the oldest request and how many more are
 * waiting (requests are summarized, never stacked); as a list (opened from
 * the teacher menu or "show all") it shows every pending request.
 * @param {object} props - component props
 * @param {Array<object>} props.requests - pending requests, oldest first
 * @param {boolean} props.expanded - show every request instead of the first
 * @param {Array<string>} props.busyIds - request ids with an action in flight
 * @param {?string} props.error - last action error, if any
 * @param {Function} props.onApprove - approve a request
 * @param {Function} props.onReject - reject a request
 * @param {Function} props.onOpenAssignment - open the request's assignment
 * @param {Function} props.onShowAll - switch to the list
 * @param {Function} props.onLater - hide until the next new request
 * @returns {React.ReactElement} the toast
 */
const ClassroomTeacherKickToast = ({
    requests,
    expanded,
    busyIds,
    error,
    onApprove,
    onReject,
    onOpenAssignment,
    onShowAll,
    onLater,
}) => {
    const shown = expanded ? requests : requests.slice(0, 1);
    const others = requests.length - shown.length;
    return (
        <div
            aria-live="polite"
            className={styles.toast}
            data-testid="classroom-teacher-kick-toast"
            role="status"
        >
            <div className={styles.header}>
                <FormattedMessage
                    defaultMessage="Kick requests ({count})"
                    description="Teacher kick-request toast header with the number of pending requests (#1200)"
                    id="gui.classroomTeacherKick.header"
                    values={{ count: requests.length }}
                />
            </div>
            <div className={styles.body}>
                {shown.map((request) => (
                    <KickRequestRow
                        busy={busyIds.includes(request.requestId)}
                        key={request.requestId}
                        request={request}
                        onApprove={onApprove}
                        onOpenAssignment={onOpenAssignment}
                        onReject={onReject}
                    />
                ))}
            </div>
            {error ? (
                <div
                    className={styles.error}
                    data-testid="classroom-teacher-kick-toast-error"
                >
                    {error}
                </div>
            ) : null}
            <div className={styles.footer}>
                {others > 0 ? (
                    <button
                        className={styles.link}
                        data-testid="classroom-teacher-kick-toast-show-all"
                        onClick={onShowAll}
                    >
                        <FormattedMessage
                            defaultMessage="{count} more"
                            description="Teacher kick-request toast: show the other pending requests (#1200)"
                            id="gui.classroomTeacherKick.others"
                            values={{ count: others }}
                        />
                    </button>
                ) : null}
                <button
                    className={styles.button}
                    data-testid="classroom-teacher-kick-toast-later"
                    onClick={onLater}
                >
                    <FormattedMessage
                        defaultMessage="Later"
                        description="Teacher kick-request toast: hide for now (the menu keeps the count) (#1200)"
                        id="gui.classroomTeacherKick.later"
                    />
                </button>
            </div>
        </div>
    );
};

ClassroomTeacherKickToast.propTypes = {
    busyIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    error: PropTypes.string,
    expanded: PropTypes.bool,
    onApprove: PropTypes.func.isRequired,
    onLater: PropTypes.func.isRequired,
    onOpenAssignment: PropTypes.func.isRequired,
    onReject: PropTypes.func.isRequired,
    onShowAll: PropTypes.func.isRequired,
    requests: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default ClassroomTeacherKickToast;
