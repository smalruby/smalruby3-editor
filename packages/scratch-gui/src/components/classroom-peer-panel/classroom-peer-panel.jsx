import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import Draggable from 'react-draggable';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import { isPeerSeatSelectable } from '../../lib/classroom-peer-view.js';
import ClassroomStatusIcon from '../classroom-modal/classroom-status-icon.jsx';
// The floating frame (overlay / header / buttons / seat grid) is shared with
// the teacher's status panel (#1203) so both panels look and behave alike.
import frameStyles from '../classroom-teacher-panel/classroom-teacher-panel.css';
import ImageViewer from '../image-viewer/image-viewer.jsx';
import styles from './classroom-peer-panel.css';

const messages = defineMessages({
    minimize: {
        defaultMessage: 'Minimize',
        description: 'Peer view panel: minimize button (#1210)',
        id: 'gui.classroomPeerPanel.minimize',
    },
    restore: {
        defaultMessage: 'Restore',
        description: 'Peer view panel: restore button (#1210)',
        id: 'gui.classroomPeerPanel.restore',
    },
    close: {
        defaultMessage: 'Close',
        description: 'Peer view panel / viewer: close button (#1210)',
        id: 'gui.classroomPeerPanel.close',
    },
    refresh: {
        defaultMessage: 'Refresh',
        description: 'Peer view panel: refresh button (#1210)',
        id: 'gui.classroomPeerPanel.refresh',
    },
    openSeat: {
        defaultMessage: 'Seat {seatNumber}: see the work',
        description: 'Peer view panel: tooltip of a submitted seat (#1210)',
        id: 'gui.classroomPeerPanel.openSeat',
    },
    notSubmittedSeat: {
        defaultMessage: 'Seat {seatNumber}: not submitted yet',
        description: 'Peer view panel: tooltip of a seat without a submission (#1210)',
        id: 'gui.classroomPeerPanel.notSubmittedSeat',
    },
    ownSeat: {
        defaultMessage: 'Seat {seatNumber}: you',
        description: 'Peer view panel: tooltip of the own seat (#1210)',
        id: 'gui.classroomPeerPanel.ownSeat',
    },
});

const ERROR_MESSAGES = defineMessages({
    off: {
        defaultMessage: "This assignment does not show classmates' work.",
        description: 'Peer view panel: the assignment has peer view off (#1210)',
        id: 'gui.classroomPeerPanel.errorOff',
    },
    notSubmitted: {
        defaultMessage: "Submit your work to see your classmates' work.",
        description: 'Peer view panel: peer view opens after the student submits (#1210)',
        id: 'gui.classroomPeerPanel.errorNotSubmitted',
    },
    ended: {
        defaultMessage: 'The class has ended or you are no longer in it.',
        description: 'Peer view panel: the session or classroom is gone (#1210)',
        id: 'gui.classroomPeerPanel.errorEnded',
    },
    failed: {
        defaultMessage: 'Could not load the work. Press refresh to try again.',
        description: 'Peer view panel: loading failed (#1210)',
        id: 'gui.classroomPeerPanel.errorFailed',
    },
});

const HeaderButton = ({ label, testId, children, disabled, onClick }) => (
    <button
        aria-label={label}
        className={frameStyles.headerButton}
        data-testid={testId}
        disabled={disabled}
        title={label}
        onClick={onClick}
    >
        {children}
    </button>
);

HeaderButton.propTypes = {
    children: PropTypes.node,
    disabled: PropTypes.bool,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    testId: PropTypes.string.isRequired,
};

const seatTitle = (intl, seat) => {
    if (seat.own) return intl.formatMessage(messages.ownSeat, { seatNumber: seat.seatNumber });
    if (seat.submitted) return intl.formatMessage(messages.openSeat, { seatNumber: seat.seatNumber });
    return intl.formatMessage(messages.notSubmittedSeat, { seatNumber: seat.seatNumber });
};

/**
 * Student's floating "みんなの作品を見る" panel (#1210): a mini seat grid of the
 * classmates' submissions and, for the picked seat, an image viewer window.
 * Both are non-modal and draggable so the student keeps editing the blocks;
 * the viewer can be resized for small Chromebook screens.
 * @param {object} props - component props
 * @param {?string} props.error - error kind ('off' | 'notSubmitted' | 'ended' | 'failed')
 * @param {Array<{name: string, src: string}>} props.images - images of the picked seat
 * @param {boolean} props.loading - a request is running
 * @param {boolean} props.minimized - only the header is shown
 * @param {object} props.panelRef - ref to the panel element (to measure it)
 * @param {{x: number, y: number}} props.position - panel position
 * @param {Array<object>} props.seats - cells of buildPeerSeats
 * @param {?number} props.selectedSeat - seat shown in the viewer
 * @param {{x: number, y: number}} props.viewerPosition - viewer window position
 * @param {Function} props.onClose - close the panel
 * @param {Function} props.onCloseViewer - close the viewer window
 * @param {Function} props.onDrag - panel dragged
 * @param {Function} props.onDragStop - panel drag ended
 * @param {Function} props.onOpenSeat - called with a seat number
 * @param {Function} props.onRefresh - read the list again
 * @param {Function} props.onToggleMinimize - minimize / restore
 * @param {Function} props.onViewerDrag - viewer window dragged
 * @returns {React.ReactElement} the panel
 */
const ClassroomPeerPanel = ({
    error,
    images,
    loading,
    minimized,
    panelRef,
    position,
    seats,
    selectedSeat,
    viewerPosition,
    onClose,
    onCloseViewer,
    onDrag,
    onDragStop,
    onOpenSeat,
    onRefresh,
    onToggleMinimize,
    onViewerDrag,
}) => {
    const intl = useIntl();
    const handleSeatClick = useCallback((e) => onOpenSeat(Number(e.currentTarget.dataset.seatNumber)), [onOpenSeat]);
    const submittedCount = seats.filter((s) => s.submitted).length;

    return (
        <div className={frameStyles.overlay}>
            <Draggable
                bounds="parent"
                handle={`.${frameStyles.header}`}
                position={position}
                onDrag={onDrag}
                onStop={onDragStop}
            >
                <div
                    className={classNames(frameStyles.panel, { [frameStyles.minimized]: minimized })}
                    data-testid="classroom-peer-panel"
                    ref={panelRef}
                    role="dialog"
                >
                    <div className={frameStyles.header}>
                        <span className={frameStyles.headerTitle}>
                            <FormattedMessage
                                defaultMessage="Classmates' work"
                                description="Peer view panel title (#1210)"
                                id="gui.classroomPeerPanel.title"
                            />
                        </span>
                        <HeaderButton
                            disabled={loading}
                            label={intl.formatMessage(messages.refresh)}
                            testId="classroom-peer-panel-refresh"
                            onClick={onRefresh}
                        >
                            {'↻'}
                        </HeaderButton>
                        <HeaderButton
                            label={intl.formatMessage(minimized ? messages.restore : messages.minimize)}
                            testId="classroom-peer-panel-minimize"
                            onClick={onToggleMinimize}
                        >
                            {minimized ? '▢' : '—'}
                        </HeaderButton>
                        <HeaderButton
                            label={intl.formatMessage(messages.close)}
                            testId="classroom-peer-panel-close"
                            onClick={onClose}
                        >
                            {'×'}
                        </HeaderButton>
                    </div>
                    {minimized ? null : (
                        <div
                            className={frameStyles.body}
                            data-testid="classroom-peer-panel-body"
                        >
                            <p
                                className={styles.hint}
                                data-testid="classroom-peer-panel-hint"
                            >
                                <FormattedMessage
                                    defaultMessage="Don't copy — find good ideas and use them in your own work."
                                    description="Peer view panel: guidance for students (#1210)"
                                    id="gui.classroomPeerPanel.hint"
                                />
                            </p>
                            {error ? (
                                <div
                                    className={frameStyles.error}
                                    data-error={error}
                                    data-testid="classroom-peer-panel-error"
                                >
                                    {intl.formatMessage(ERROR_MESSAGES[error])}
                                </div>
                            ) : (
                                <React.Fragment>
                                    <div
                                        className={styles.summary}
                                        data-testid="classroom-peer-panel-count"
                                    >
                                        <ClassroomStatusIcon
                                            size={12}
                                            status="submitted"
                                        />
                                        <FormattedMessage
                                            defaultMessage="Submitted: {count}"
                                            description="Peer view panel: number of classmates' submissions (#1210)"
                                            id="gui.classroomPeerPanel.count"
                                            values={{ count: submittedCount }}
                                        />
                                    </div>
                                    {seats.length === 0 && !loading ? (
                                        <div
                                            className={frameStyles.empty}
                                            data-testid="classroom-peer-panel-empty"
                                        >
                                            <FormattedMessage
                                                defaultMessage="No one has submitted yet."
                                                description="Peer view panel: no submissions yet (#1210)"
                                                id="gui.classroomPeerPanel.empty"
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className={frameStyles.grid}
                                            data-testid="classroom-peer-panel-grid"
                                        >
                                            {seats.map((seat) => (
                                                <button
                                                    className={classNames(frameStyles.seat, {
                                                        [frameStyles.seatEmpty]: !seat.submitted,
                                                        [styles.seatOwn]: seat.own,
                                                        [styles.seatSelected]: seat.seatNumber === selectedSeat,
                                                    })}
                                                    data-seat-number={seat.seatNumber}
                                                    data-testid={`classroom-peer-panel-seat-${seat.seatNumber}`}
                                                    disabled={!isPeerSeatSelectable(seat)}
                                                    key={seat.seatNumber}
                                                    title={seatTitle(intl, seat)}
                                                    onClick={handleSeatClick}
                                                >
                                                    <span className={frameStyles.seatNumber}>{seat.seatNumber}</span>
                                                    {seat.submitted ? (
                                                        <ClassroomStatusIcon
                                                            size={8}
                                                            status="submitted"
                                                        />
                                                    ) : null}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </React.Fragment>
                            )}
                        </div>
                    )}
                </div>
            </Draggable>
            {selectedSeat && images.length > 0 ? (
                <Draggable
                    bounds="parent"
                    handle={`.${styles.viewerHeader}`}
                    position={viewerPosition}
                    onDrag={onViewerDrag}
                >
                    <div
                        className={styles.viewerWindow}
                        data-testid="classroom-peer-viewer"
                        role="dialog"
                    >
                        <div className={classNames(frameStyles.header, styles.viewerHeader)}>
                            <span className={frameStyles.headerTitle}>
                                <FormattedMessage
                                    defaultMessage="Seat {seatNumber}'s work"
                                    description="Peer view image viewer title (#1210)"
                                    id="gui.classroomPeerPanel.viewerTitle"
                                    values={{ seatNumber: selectedSeat }}
                                />
                            </span>
                            <HeaderButton
                                label={intl.formatMessage(messages.close)}
                                testId="classroom-peer-viewer-close"
                                onClick={onCloseViewer}
                            >
                                {'×'}
                            </HeaderButton>
                        </div>
                        <div className={styles.viewerBody}>
                            <ImageViewer
                                images={images}
                                key={selectedSeat}
                            />
                        </div>
                    </div>
                </Draggable>
            ) : null}
        </div>
    );
};

const positionShape = PropTypes.shape({ x: PropTypes.number, y: PropTypes.number });

ClassroomPeerPanel.propTypes = {
    error: PropTypes.oneOf(['off', 'notSubmitted', 'ended', 'failed']),
    images: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, src: PropTypes.string })).isRequired,
    loading: PropTypes.bool,
    minimized: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onCloseViewer: PropTypes.func.isRequired,
    onDrag: PropTypes.func.isRequired,
    onDragStop: PropTypes.func.isRequired,
    onOpenSeat: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired,
    onToggleMinimize: PropTypes.func.isRequired,
    onViewerDrag: PropTypes.func.isRequired,
    panelRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
    position: positionShape.isRequired,
    seats: PropTypes.arrayOf(
        PropTypes.shape({
            seatNumber: PropTypes.number,
            submitted: PropTypes.bool,
            own: PropTypes.bool,
        }),
    ).isRequired,
    selectedSeat: PropTypes.number,
    viewerPosition: positionShape.isRequired,
};

export default ClassroomPeerPanel;
