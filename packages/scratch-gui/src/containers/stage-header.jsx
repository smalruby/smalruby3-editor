import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import VM from '@smalruby/scratch-vm';
import {STAGE_SIZE_MODES} from '../lib/layout-constants';
import {setStageSize} from '../reducers/stage-size';
import {setFullScreen} from '../reducers/mode';

import {connect} from 'react-redux';

import StageHeaderComponent from '../components/stage-header/stage-header.jsx';
import {showAlertWithTimeout, showStandardAlert} from '../reducers/alerts.js';
// === Smalruby: Start of classroom submission thumbnail ===
import {setSubmissionThumbnail} from '../reducers/classroom';

// A student is "joined" to a classroom once they hold an active student session.
// In that state we surface the upstream "Set Thumbnail" button so the student can
// pick which stage frame becomes their submission thumbnail (issue #631).
const isStudentJoined = classroom =>
    !!(classroom && classroom.role === 'student' && classroom.classroomId && classroom.sessionToken);
// === Smalruby: End of classroom submission thumbnail ===

const ALERT_ID = {
    settingThumbnail: 'settingThumbnail',
    thumbnailSuccess: 'thumbnailSuccess',
    thumbnailError: 'thumbnailError'
};
 
class StageHeader extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleKeyPress'
        ]);
    }
    componentDidMount () {
        document.addEventListener('keydown', this.handleKeyPress);
    }
    componentWillUnmount () {
        document.removeEventListener('keydown', this.handleKeyPress);
    }
    handleKeyPress (event) {
        if (event.key === 'Escape' && this.props.isFullScreen) {
            this.props.onSetStageUnFull(false);
        }
    }
    render () {
        const {
            ...props
        } = this.props;
        return (
            <StageHeaderComponent
                {...props}
                onKeyPress={this.handleKeyPress}
            />
        );
    }
}

StageHeader.propTypes = {
    isFullScreen: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    onSetStageUnFull: PropTypes.func.isRequired,
    showBranding: PropTypes.bool,
    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => {
    const projectState = state.scratchGui.projectState;
    // === Smalruby: Start of classroom submission thumbnail ===
    // Reuse upstream's `manuallySaveThumbnails && userOwnsProject` gate to show the
    // thumbnail-save button only while a student is joined to a classroom.
    const joined = isStudentJoined(state.scratchGui.classroom);
    // === Smalruby: End of classroom submission thumbnail ===

    return {
        stageSizeMode: state.scratchGui.stageSize.stageSize,
        showBranding: state.scratchGui.mode.showBranding,
        isFullScreen: state.scratchGui.mode.isFullScreen,
        isPlayerOnly: state.scratchGui.mode.isPlayerOnly,

        projectId: projectState.projectId,

        // === Smalruby: Start of classroom submission thumbnail ===
        manuallySaveThumbnails: joined,
        userOwnsProject: joined
        // === Smalruby: End of classroom submission thumbnail ===
    };

};

const mapDispatchToProps = dispatch => ({
    onSetStageLarge: () => dispatch(setStageSize(STAGE_SIZE_MODES.large)),
    onSetStageSmall: () => dispatch(setStageSize(STAGE_SIZE_MODES.small)),
    onSetStageMiddle: () => dispatch(setStageSize(STAGE_SIZE_MODES.middle)),
    onSetStageFull: () => dispatch(setFullScreen(true)),
    onSetStageUnFull: () => dispatch(setFullScreen(false)),
    onShowSettingThumbnail: () => dispatch(showStandardAlert(ALERT_ID.settingThumbnail)),
    onShowThumbnailSuccess: () => showAlertWithTimeout(dispatch, ALERT_ID.thumbnailSuccess),
    onShowThumbnailError: () => showAlertWithTimeout(dispatch, ALERT_ID.thumbnailError),
    // === Smalruby: Start of classroom submission thumbnail ===
    // Instead of uploading to a project host (no host in standalone Smalruby), cache the
    // captured stage frame in redux so the student-submit flow can attach it later.
    onUpdateProjectThumbnail: (projectId, blob, onSuccess, onError) => {
        try {
            const reader = new FileReader();
            reader.onloadend = () => {
                dispatch(setSubmissionThumbnail(reader.result));
                if (onSuccess) onSuccess();
            };
            reader.onerror = () => {
                if (onError) onError();
            };
            reader.readAsDataURL(blob);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to cache submission thumbnail.', e);
            if (onError) onError();
        }
    }
    // === Smalruby: End of classroom submission thumbnail ===
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(StageHeader);

// === Smalruby: Start of classroom submission thumbnail ===
export {isStudentJoined};
// === Smalruby: End of classroom submission thumbnail ===
