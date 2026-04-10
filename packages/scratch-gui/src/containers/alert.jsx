import React from 'react';
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import SB3Downloader from './sb3-downloader.jsx';
import AlertComponent from '../components/alerts/alert.jsx';
import {openConnectionModal} from '../reducers/modals';
import {setConnectionModalExtensionId} from '../reducers/connection-modal';
import {manualUpdateProject} from '../reducers/project-state';
// === Smalruby: Start of classroom session expired ===
import {openClassroomModal, clearClassroomSession} from '../reducers/classroom';
import {closeAlertsWithId} from '../reducers/alerts';
// === Smalruby: End of classroom session expired ===

class Alert extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleOnCloseAlert',
            'handleOnReconnect',
            'handleOnRejoin' // === Smalruby: classroom session expired ===
        ]);
    }
    handleOnCloseAlert () {
        this.props.onCloseAlert(this.props.index);
    }
    handleOnReconnect () {
        this.props.onOpenConnectionModal(this.props.extensionId);
        this.handleOnCloseAlert();
    }
    // === Smalruby: Start of classroom session expired ===
    handleOnRejoin () {
        this.props.onRejoinClassroom();
        this.handleOnCloseAlert();
    }
    // === Smalruby: End of classroom session expired ===
    render () {
        const {
            closeButton,
            content,
            extensionName,
            index,
            level,
            iconSpinner,
            iconURL,
            message,
            onSaveNow,
            showDownload,
            showReconnect,
            showRejoin, // === Smalruby: classroom session expired ===
            showSaveNow
        } = this.props;
        return (
            <SB3Downloader>{(_, downloadProject) => (
                <AlertComponent
                    closeButton={closeButton}
                    content={content}
                    extensionName={extensionName}
                    iconSpinner={iconSpinner}
                    iconURL={iconURL}
                    level={level}
                    message={message}
                    showDownload={showDownload}
                    showReconnect={showReconnect}
                    showRejoin={showRejoin}
                    showSaveNow={showSaveNow}
                    onCloseAlert={this.handleOnCloseAlert}
                    onDownload={downloadProject}
                    onReconnect={this.handleOnReconnect}
                    onRejoin={this.handleOnRejoin}
                    onSaveNow={onSaveNow}
                />
            )}</SB3Downloader>
        );
    }
}

const mapStateToProps = () => ({});

const mapDispatchToProps = dispatch => ({
    onOpenConnectionModal: id => {
        dispatch(setConnectionModalExtensionId(id));
        dispatch(openConnectionModal());
    },
    onSaveNow: () => {
        dispatch(manualUpdateProject());
    },
    // === Smalruby: Start of classroom session expired ===
    onRejoinClassroom: () => {
        dispatch(closeAlertsWithId('classroomSessionExpired'));
        dispatch(clearClassroomSession());
        dispatch(openClassroomModal());
    }
    // === Smalruby: End of classroom session expired ===
});

Alert.propTypes = {
    closeButton: PropTypes.bool,
    content: PropTypes.element,
    extensionId: PropTypes.string,
    extensionName: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    iconSpinner: PropTypes.bool,
    iconURL: PropTypes.string,
    index: PropTypes.number,
    level: PropTypes.string.isRequired,
    message: PropTypes.string,
    onCloseAlert: PropTypes.func.isRequired,
    onOpenConnectionModal: PropTypes.func,
    onRejoinClassroom: PropTypes.func, // === Smalruby: classroom session expired ===
    onSaveNow: PropTypes.func,
    showDownload: PropTypes.bool,
    showReconnect: PropTypes.bool,
    showRejoin: PropTypes.bool, // === Smalruby: classroom session expired ===
    showSaveNow: PropTypes.bool
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Alert);
