import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import useClassroomHeartbeat from './use-classroom-heartbeat.js';

/**
 * Always-mounted, render-less host for the student heartbeat (issue #1197).
 * The classroom modal is only mounted while open, so the ping lives here to
 * keep running while the student works in the editor.
 * @param {object} props - component props
 * @param {?string} props.sessionToken - student session token from redux
 * @returns {null} renders nothing
 */
const ClassroomHeartbeat = ({ sessionToken }) => {
    useClassroomHeartbeat({ sessionToken });
    return null;
};

ClassroomHeartbeat.propTypes = {
    sessionToken: PropTypes.string,
};

const mapStateToProps = (state) => ({
    sessionToken: (state.scratchGui.classroom && state.scratchGui.classroom.sessionToken) || null,
});

export default connect(mapStateToProps)(ClassroomHeartbeat);
