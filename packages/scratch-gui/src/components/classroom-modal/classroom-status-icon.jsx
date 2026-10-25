import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';

import styles from './classroom-modal.css';

/**
 * Shared status icons for the classroom UI (#1196).
 *
 * Every status has its own SVG *shape* (not just a color) plus `title` /
 * `aria-label`, so the state is readable for color-blind users and screen
 * readers. Inline SVG only: external icon CDNs are not allowed.
 */

const messages = defineMessages({
    seated: {
        defaultMessage: 'Seated',
        description: 'Status icon label: the student is seated (active recently)',
        id: 'gui.classroom.statusIcon.seated',
    },
    notSeated: {
        defaultMessage: 'Not seated',
        description: 'Status icon label: the student joined but is not present now',
        id: 'gui.classroom.statusIcon.notSeated',
    },
    notJoined: {
        defaultMessage: 'Not joined',
        description: 'Status icon label: no student has joined this seat',
        id: 'gui.classroom.statusIcon.notJoined',
    },
    submitted: {
        defaultMessage: 'Submitted',
        description: 'Status icon label: the work has been submitted',
        id: 'gui.classroom.statusIcon.submitted',
    },
    notSubmitted: {
        defaultMessage: 'Not submitted',
        description: 'Status icon label: the work has not been submitted yet',
        id: 'gui.classroom.statusIcon.notSubmitted',
    },
    returned: {
        defaultMessage: 'Returned',
        description: 'Status icon label: the teacher returned the work with feedback',
        id: 'gui.classroom.statusIcon.returned',
    },
    kickRequested: {
        defaultMessage: 'Leave request',
        description: 'Status icon label: another student asked the teacher to free this seat',
        id: 'gui.classroom.statusIcon.kickRequested',
    },
    occupied: {
        defaultMessage: 'In use',
        description: 'Status icon label: the seat is already taken by another student',
        id: 'gui.classroom.statusIcon.occupied',
    },
});

// Geometry for a 16x16 viewBox. Shapes are intentionally different per status.
const ICONS = {
    // filled circle
    seated: {
        color: '#0fbd8c',
        body: <circle cx="8" cy="8" fill="currentColor" r="6" />,
    },
    // hollow circle
    notSeated: {
        color: '#855cd6',
        body: <circle cx="8" cy="8" fill="none" r="5.5" stroke="currentColor" strokeWidth="2" />,
    },
    // dashed circle with a minus
    notJoined: {
        color: '#8c8c8c',
        body: (
            <React.Fragment>
                <circle cx="8" cy="8" fill="none" r="5.5" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1.5" />
                <path d="M5 8h6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </React.Fragment>
        ),
    },
    // check mark in a filled square
    submitted: {
        color: '#0fbd8c',
        body: (
            <React.Fragment>
                <rect fill="currentColor" height="13" rx="2" width="13" x="1.5" y="1.5" />
                <path d="M4.5 8.2l2.4 2.4 4.6-5" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </React.Fragment>
        ),
    },
    // empty square
    notSubmitted: {
        color: '#8c8c8c',
        body: <rect fill="none" height="12" rx="2" stroke="currentColor" strokeWidth="2" width="12" x="2" y="2" />,
    },
    // curved return arrow
    returned: {
        color: '#ff8c1a',
        body: (
            <React.Fragment>
                <path d="M6 3L2.5 6.5 6 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </React.Fragment>
        ),
    },
    // warning triangle with "!"
    kickRequested: {
        color: '#d32f2f',
        body: (
            <React.Fragment>
                <path d="M8 1.5L15 14H1z" fill="currentColor" />
                <path d="M8 6v3.5" stroke="#fff" strokeLinecap="round" strokeWidth="1.8" />
                <circle cx="8" cy="11.8" fill="#fff" r="1" />
            </React.Fragment>
        ),
    },
    // person silhouette (seat in use)
    occupied: {
        color: '#575e75',
        body: (
            <React.Fragment>
                <circle cx="8" cy="5" fill="currentColor" r="3" />
                <path d="M2.5 14.5a5.5 5.5 0 0 1 11 0z" fill="currentColor" />
            </React.Fragment>
        ),
    },
};

const STATUS_KINDS = Object.keys(ICONS);

/**
 * Seat presence of a member (teacher grid / member detail).
 * @param {?object} member - member record (null when the seat is empty).
 * @param {boolean} seated - result of the caller's `isSeated` check.
 * @returns {string} 'seated' | 'notSeated' | 'notJoined'
 */
const getPresenceStatus = (member, seated) => {
    if (!member || member.left) return 'notJoined';
    return seated ? 'seated' : 'notSeated';
};

/**
 * Submission state. Accepts either a teacher-side member record or the
 * student-side `submissionStatus` string from the classroom reducer.
 * @param {?(object|string)} source - member record or status string.
 * @returns {?string} 'returned' | 'submitted' | 'notSubmitted' | null
 */
const getSubmissionStatus = (source) => {
    if (!source) return null;
    if (typeof source === 'string') {
        if (source === 'returned') return 'returned';
        if (source === 'submitted') return 'submitted';
        return null;
    }
    if (source.submissionStatus === 'returned') return 'returned';
    return source.hasSubmission ? 'submitted' : 'notSubmitted';
};

const ClassroomStatusIcon = ({ status, size, badge, className }) => {
    const intl = useIntl();
    const icon = status && ICONS[status];
    if (!icon) return null;
    const label = intl.formatMessage(messages[status]);
    return (
        <span
            aria-label={label}
            className={[styles.statusIcon, badge && styles.statusIconBadge, className].filter(Boolean).join(' ')}
            data-status={status}
            data-testid={`classroom-status-icon-${status}`}
            role="img"
            style={{ color: icon.color }}
            title={label}
        >
            <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 16 16" width={size}>
                {icon.body}
            </svg>
        </span>
    );
};

ClassroomStatusIcon.propTypes = {
    // white rounded backdrop so the icon stays legible on colored surfaces (menu bar)
    badge: PropTypes.bool,
    className: PropTypes.string,
    size: PropTypes.number,
    status: PropTypes.oneOf(STATUS_KINDS),
};

ClassroomStatusIcon.defaultProps = {
    size: 14,
};

/**
 * Presence + submission (+ optional leave request) side by side, so one
 * grid cell can show both axes at once.
 * @param {object} props - component props.
 * @param {?string} props.presence - 'seated' | 'notSeated' | 'notJoined'.
 * @param {?string} props.submission - 'submitted' | 'notSubmitted' | 'returned'.
 * @param {boolean} props.kickRequested - also show the leave-request icon.
 * @param {number} props.size - icon size in px.
 * @param {string} props.className - extra class for the wrapper.
 * @returns {React.ReactElement} the icon group.
 */
const ClassroomStatusIcons = ({ presence, submission, kickRequested, size, className }) => (
    <span
        className={className ? `${styles.statusIcons} ${className}` : styles.statusIcons}
        data-testid="classroom-status-icons"
    >
        {presence && <ClassroomStatusIcon size={size} status={presence} />}
        {submission && <ClassroomStatusIcon size={size} status={submission} />}
        {kickRequested && <ClassroomStatusIcon size={size} status="kickRequested" />}
    </span>
);

ClassroomStatusIcons.propTypes = {
    className: PropTypes.string,
    kickRequested: PropTypes.bool,
    presence: PropTypes.oneOf(['seated', 'notSeated', 'notJoined']),
    size: PropTypes.number,
    submission: PropTypes.oneOf(['submitted', 'notSubmitted', 'returned']),
};

ClassroomStatusIcons.defaultProps = {
    size: 14,
};

/**
 * Legend: icon + text label for each given status.
 * @param {object} props - component props.
 * @param {string[]} props.statuses - statuses to list, in order.
 * @param {string} props.className - extra class for the wrapper.
 * @returns {React.ReactElement} the legend.
 */
const ClassroomStatusLegend = ({ statuses, className }) => {
    const intl = useIntl();
    return (
        <div
            className={className ? `${styles.statusLegend} ${className}` : styles.statusLegend}
            data-testid="classroom-status-legend"
        >
            {statuses.map((status) => (
                <span
                    className={styles.statusLegendItem}
                    data-testid={`classroom-status-legend-${status}`}
                    key={status}
                >
                    <ClassroomStatusIcon status={status} />
                    <span>{intl.formatMessage(messages[status])}</span>
                </span>
            ))}
        </div>
    );
};

ClassroomStatusLegend.propTypes = {
    className: PropTypes.string,
    statuses: PropTypes.arrayOf(PropTypes.oneOf(STATUS_KINDS)).isRequired,
};

export { ClassroomStatusIcons, ClassroomStatusLegend, getPresenceStatus, getSubmissionStatus, STATUS_KINDS };
export default ClassroomStatusIcon;
