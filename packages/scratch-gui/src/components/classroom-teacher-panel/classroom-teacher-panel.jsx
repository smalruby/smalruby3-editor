import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import Draggable from 'react-draggable';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import ClassroomStatusIcon, { ClassroomStatusIcons } from '../classroom-modal/classroom-status-icon.jsx';
import styles from './classroom-teacher-panel.css';

const messages = defineMessages({
    seatedHint: {
        defaultMessage: 'Students who opened the class screen within the last hour (a rough guide, not live)',
        description: 'Teacher status panel: tooltip of the seated count (#1203)',
        id: 'gui.classroomTeacherPanel.seatedHint',
    },
    minimize: {
        defaultMessage: 'Minimize',
        description: 'Teacher status panel: minimize button (#1203)',
        id: 'gui.classroomTeacherPanel.minimize',
    },
    restore: {
        defaultMessage: 'Restore',
        description: 'Teacher status panel: restore the minimized panel (#1203)',
        id: 'gui.classroomTeacherPanel.restore',
    },
    close: {
        defaultMessage: 'Close',
        description: 'Teacher status panel: close button (#1203)',
        id: 'gui.classroomTeacherPanel.close',
    },
    refresh: {
        defaultMessage: 'Refresh',
        description: 'Teacher status panel: refresh now (#1203)',
        id: 'gui.classroomTeacherPanel.refresh',
    },
    openSeat: {
        defaultMessage: 'Seat {seatNumber}: open the details',
        description: 'Teacher status panel: tooltip of a seat cell (#1203)',
        id: 'gui.classroomTeacherPanel.openSeat',
    },
    selectAssignment: {
        defaultMessage: 'Assignment',
        description: 'Teacher status panel: label of the assignment switcher (#1203)',
        id: 'gui.classroomTeacherPanel.selectAssignment',
    },
});

const assignmentLabel = (c) => [c.className, c.assignmentName].filter(Boolean).join(' / ') || c.classroomId;

/**
 * One kick request (退室依頼) in the panel: approve after checking with the
 * students in person, or reject (#1200 / #1203).
 * @param {object} props - component props
 * @param {object} props.request - pending request
 * @param {boolean} props.busy - an action is in flight
 * @param {Function} props.onApprove - called with the request
 * @param {Function} props.onReject - called with the request
 * @returns {React.ReactElement} the row
 */
const PanelKickRequest = ({ request, busy, onApprove, onReject }) => {
    const handleApprove = useCallback(() => onApprove(request), [onApprove, request]);
    const handleReject = useCallback(() => onReject(request), [onReject, request]);
    return (
        <div
            className={styles.kickRow}
            data-request-id={request.requestId}
            data-testid="classroom-teacher-panel-kick-request"
        >
            <div className={styles.kickTitle}>
                <ClassroomStatusIcon
                    size={12}
                    status="kickRequested"
                />
                <FormattedMessage
                    defaultMessage="Seat {seatNumber} (now: {name})"
                    description="Teacher status panel: seat of a kick request and the nickname now in it (#1203)"
                    id="gui.classroomTeacherPanel.kickSeat"
                    values={{ seatNumber: request.seatNumber, name: request.occupantName || '-' }}
                />
            </div>
            {request.reason ? <div className={styles.kickReason}>{`「${request.reason}」`}</div> : null}
            <div className={styles.kickActions}>
                <button
                    className={styles.approve}
                    data-testid="classroom-teacher-panel-kick-approve"
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
                    data-testid="classroom-teacher-panel-kick-reject"
                    disabled={busy}
                    onClick={handleReject}
                >
                    <FormattedMessage
                        defaultMessage="Reject"
                        description="Teacher kick-request toast: reject (#1200)"
                        id="gui.classroomTeacherKick.reject"
                    />
                </button>
            </div>
        </div>
    );
};

PanelKickRequest.propTypes = {
    busy: PropTypes.bool,
    onApprove: PropTypes.func.isRequired,
    onReject: PropTypes.func.isRequired,
    request: PropTypes.shape({
        requestId: PropTypes.string.isRequired,
        seatNumber: PropTypes.number,
        occupantName: PropTypes.string,
        reason: PropTypes.string,
    }).isRequired,
};

/**
 * Floating, draggable "いまの課題の状況" panel for a logged-in teacher (#1203).
 * Non-modal: the overlay lets pointer events through, so the teacher keeps
 * using the stage / blocks / menu bar while it is shown.
 * @param {object} props - component props
 * @param {{x: number, y: number}} props.position - top-left (controlled)
 * @param {object} props.panelRef - ref of the panel element (size measuring)
 * @param {boolean} props.minimized - only the header is shown
 * @param {?object} props.classroom - the assignment shown (null until chosen)
 * @param {Array<object>} props.assignments - recent assignments for the switcher
 * @param {?object} props.summary - counts (summarizePanelStatus), null before the first load
 * @param {Array<object>} props.seats - mini grid cells (buildPanelSeats)
 * @param {Array<object>} props.kickRequests - pending requests of this assignment
 * @param {Array<string>} props.busyIds - request ids with an action in flight
 * @param {boolean} props.loading - a manual refresh is running
 * @param {?string} props.error - last error, if any
 * @param {boolean} props.sessionExpired - the teacher's login expired (#1250)
 * @param {boolean} props.reauthing - a re-authentication is running
 * @param {Function} props.onReauth - re-authenticate (the "再認証する" link)
 * @param {Function} props.onDrag - react-draggable onDrag
 * @param {Function} props.onDragStop - react-draggable onStop
 * @param {Function} props.onToggleMinimize - minimize / restore
 * @param {Function} props.onClose - close the panel
 * @param {Function} props.onRefresh - refresh now
 * @param {Function} props.onSelectAssignment - called with a classroomId
 * @param {Function} props.onOpenSeat - called with a memberId
 * @param {Function} props.onApprove - approve a kick request
 * @param {Function} props.onReject - reject a kick request
 * @returns {React.ReactElement} the panel
 */
const ClassroomTeacherPanel = ({
    position,
    panelRef,
    minimized,
    classroom,
    assignments,
    summary,
    seats,
    kickRequests,
    busyIds,
    loading,
    error,
    sessionExpired,
    reauthing,
    onReauth,
    onDrag,
    onDragStop,
    onToggleMinimize,
    onClose,
    onRefresh,
    onSelectAssignment,
    onOpenSeat,
    onApprove,
    onReject,
}) => {
    const intl = useIntl();
    const handleSelectChange = useCallback((e) => onSelectAssignment(e.target.value), [onSelectAssignment]);
    const handleSeatClick = useCallback((e) => onOpenSeat(e.currentTarget.dataset.memberId), [onOpenSeat]);
    const counts = summary ? (
        <span
            className={styles.headerCounts}
            data-testid="classroom-teacher-panel-header-counts"
        >
            {`${summary.seated}/${summary.capacity} · ${summary.submitted}/${summary.joined}`}
            {kickRequests.length > 0 ? (
                <ClassroomStatusIcon
                    badge
                    size={12}
                    status="kickRequested"
                />
            ) : null}
        </span>
    ) : null;

    return (
        <div className={styles.overlay}>
            <Draggable
                bounds="parent"
                handle={`.${styles.header}`}
                position={position}
                onDrag={onDrag}
                onStop={onDragStop}
            >
                <div
                    className={classNames(styles.panel, { [styles.minimized]: minimized })}
                    data-testid="classroom-teacher-panel"
                    ref={panelRef}
                    role="dialog"
                >
                    <div
                        className={styles.header}
                        data-testid="classroom-teacher-panel-header"
                    >
                        <span className={styles.headerTitle}>
                            <FormattedMessage
                                defaultMessage="Current assignment status"
                                description="Teacher status panel title (#1203)"
                                id="gui.classroomTeacherPanel.title"
                            />
                        </span>
                        {minimized ? counts : null}
                        <button
                            aria-label={intl.formatMessage(messages.refresh)}
                            className={styles.headerButton}
                            data-testid="classroom-teacher-panel-refresh"
                            disabled={loading}
                            title={intl.formatMessage(messages.refresh)}
                            onClick={onRefresh}
                        >
                            {'↻'}
                        </button>
                        <button
                            aria-label={intl.formatMessage(minimized ? messages.restore : messages.minimize)}
                            className={styles.headerButton}
                            data-testid="classroom-teacher-panel-minimize"
                            title={intl.formatMessage(minimized ? messages.restore : messages.minimize)}
                            onClick={onToggleMinimize}
                        >
                            {minimized ? '▢' : '—'}
                        </button>
                        <button
                            aria-label={intl.formatMessage(messages.close)}
                            className={styles.headerButton}
                            data-testid="classroom-teacher-panel-close"
                            title={intl.formatMessage(messages.close)}
                            onClick={onClose}
                        >
                            {'×'}
                        </button>
                    </div>
                    {minimized ? null : (
                        <div
                            className={styles.body}
                            data-testid="classroom-teacher-panel-body"
                        >
                            <label className={styles.switcher}>
                                <span className={styles.switcherLabel}>
                                    {intl.formatMessage(messages.selectAssignment)}
                                </span>
                                <select
                                    className={styles.select}
                                    data-testid="classroom-teacher-panel-assignment"
                                    value={(classroom && classroom.classroomId) || ''}
                                    onChange={handleSelectChange}
                                >
                                    {classroom ? null : (
                                        <option
                                            disabled
                                            value=""
                                        >
                                            {'-'}
                                        </option>
                                    )}
                                    {assignments.map((c) => (
                                        <option
                                            key={c.classroomId}
                                            value={c.classroomId}
                                        >
                                            {assignmentLabel(c)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {classroom ? (
                                <React.Fragment>
                                    <div className={styles.summary}>
                                        <span
                                            className={styles.summaryItem}
                                            data-testid="classroom-teacher-panel-seated"
                                            title={intl.formatMessage(messages.seatedHint)}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Seated (approx.) {seated} / {capacity}"
                                                description="Teacher status panel: seated count (a rough hint) / seats (#1203)"
                                                id="gui.classroomTeacherPanel.seated"
                                                values={{
                                                    seated: summary ? summary.seated : '-',
                                                    capacity: summary ? summary.capacity : classroom.studentCount,
                                                }}
                                            />
                                        </span>
                                        <span
                                            className={styles.summaryItem}
                                            data-testid="classroom-teacher-panel-submitted"
                                        >
                                            <FormattedMessage
                                                defaultMessage="Submitted {submitted} / {joined}"
                                                description="Teacher status panel: submitted / joined members (#1203)"
                                                id="gui.classroomTeacherPanel.submitted"
                                                values={{
                                                    submitted: summary ? summary.submitted : '-',
                                                    joined: summary ? summary.joined : '-',
                                                }}
                                            />
                                        </span>
                                    </div>
                                    <div
                                        className={styles.grid}
                                        data-testid="classroom-teacher-panel-grid"
                                    >
                                        {seats.map((seat) => (
                                            <button
                                                className={classNames(styles.seat, {
                                                    [styles.seatEmpty]: seat.presence === 'notJoined',
                                                    [styles.seatKick]: seat.kickRequested,
                                                })}
                                                data-member-id={seat.memberId}
                                                data-testid={`classroom-teacher-panel-seat-${seat.seatNumber}`}
                                                key={seat.memberId}
                                                title={[
                                                    intl.formatMessage(messages.openSeat, {
                                                        seatNumber: seat.seatNumber,
                                                    }),
                                                    seat.nickname,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' — ')}
                                                onClick={handleSeatClick}
                                            >
                                                <span className={styles.seatNumber}>{seat.seatNumber}</span>
                                                <ClassroomStatusIcons
                                                    kickRequested={seat.kickRequested}
                                                    presence={seat.presence}
                                                    size={8}
                                                    submission={seat.submission}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    {kickRequests.length > 0 ? (
                                        <div
                                            className={styles.kickList}
                                            data-testid="classroom-teacher-panel-kick-list"
                                        >
                                            <div className={styles.kickNote}>
                                                <FormattedMessage
                                                    defaultMessage="Check with the students in person before approving."
                                                    description="Teacher kick-request toast: confirm in the classroom before approving (#1200)"
                                                    id="gui.classroomTeacherKick.confirmNote"
                                                />
                                            </div>
                                            {kickRequests.map((request) => (
                                                <PanelKickRequest
                                                    busy={busyIds.includes(request.requestId)}
                                                    key={request.requestId}
                                                    request={request}
                                                    onApprove={onApprove}
                                                    onReject={onReject}
                                                />
                                            ))}
                                        </div>
                                    ) : null}
                                </React.Fragment>
                            ) : (
                                <div
                                    className={styles.empty}
                                    data-testid="classroom-teacher-panel-empty"
                                >
                                    <FormattedMessage
                                        defaultMessage="Choose an assignment."
                                        description="Teacher status panel: no assignment is chosen yet (#1203)"
                                        id="gui.classroomTeacherPanel.empty"
                                    />
                                </div>
                            )}
                            {sessionExpired ? (
                                <div
                                    className={styles.error}
                                    data-testid="classroom-teacher-panel-error"
                                >
                                    <FormattedMessage
                                        defaultMessage="Your login has expired."
                                        description="Teacher status panel: the teacher's login expired (#1250)"
                                        id="gui.classroomTeacherPanel.sessionExpired"
                                    />{' '}
                                    <button
                                        className={styles.reauthLink}
                                        data-testid="classroom-teacher-panel-reauth"
                                        disabled={reauthing}
                                        type="button"
                                        onClick={onReauth}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Re-authenticate"
                                            description="Teacher status panel: link to log in again after expiry (#1250)"
                                            id="gui.classroomTeacherPanel.reauth"
                                        />
                                    </button>
                                </div>
                            ) : error ? (
                                <div
                                    className={styles.error}
                                    data-testid="classroom-teacher-panel-error"
                                >
                                    {error}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </Draggable>
        </div>
    );
};

ClassroomTeacherPanel.propTypes = {
    assignments: PropTypes.arrayOf(PropTypes.object).isRequired,
    busyIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    classroom: PropTypes.object,
    error: PropTypes.string,
    sessionExpired: PropTypes.bool,
    reauthing: PropTypes.bool,
    onReauth: PropTypes.func,
    kickRequests: PropTypes.arrayOf(PropTypes.object).isRequired,
    loading: PropTypes.bool,
    minimized: PropTypes.bool,
    panelRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
    position: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }).isRequired,
    seats: PropTypes.arrayOf(PropTypes.object).isRequired,
    summary: PropTypes.shape({
        seated: PropTypes.number,
        capacity: PropTypes.number,
        joined: PropTypes.number,
        submitted: PropTypes.number,
    }),
    onApprove: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onDrag: PropTypes.func.isRequired,
    onDragStop: PropTypes.func.isRequired,
    onOpenSeat: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired,
    onReject: PropTypes.func.isRequired,
    onSelectAssignment: PropTypes.func.isRequired,
    onToggleMinimize: PropTypes.func.isRequired,
};

export default ClassroomTeacherPanel;
