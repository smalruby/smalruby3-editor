import classNames from 'classnames';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {setProjectTitle} from '../../reducers/project-title';

import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import Input from '../forms/input.jsx';
const BufferedInput = BufferedInputHOC(Input);

import styles from './project-title-input.css';

const messages = defineMessages({
    projectTitlePlaceholder: {
        id: 'gui.gui.projectTitlePlaceholder',
        description: 'Placeholder for project title when blank',
        defaultMessage: 'Project title here'
    }
});

const ProjectTitleInput = ({
    className,
    // === Smalruby: Start of read-only project title for Google Drive ===
    disabled,
    // === Smalruby: End of read-only project title for Google Drive ===
    onSubmit,
    projectTitle
}) => {
    const intl = useIntl();
    return (
        <BufferedInput
            className={classNames(styles.titleField, className)}
            // === Smalruby: Start of read-only project title for Google Drive ===
            disabled={disabled}
            // === Smalruby: End of read-only project title for Google Drive ===
            maxLength="100"
            placeholder={intl.formatMessage(messages.projectTitlePlaceholder)}
            tabIndex="0"
            type="text"
            value={projectTitle}
            onSubmit={onSubmit}
        />
    );
};

ProjectTitleInput.propTypes = {
    className: PropTypes.string,
    // === Smalruby: Start of read-only project title for Google Drive ===
    disabled: PropTypes.bool,
    // === Smalruby: End of read-only project title for Google Drive ===
    onSubmit: PropTypes.func,
    projectTitle: PropTypes.string
};

const mapStateToProps = state => ({
    // === Smalruby: Start of read-only project title for Google Drive ===
    disabled: state.scratchGui.googleDriveFile && state.scratchGui.googleDriveFile.isGoogleDriveFile,
    // === Smalruby: End of read-only project title for Google Drive ===
    projectTitle: state.scratchGui.projectTitle
});

const mapDispatchToProps = dispatch => ({
    onSubmit: title => dispatch(setProjectTitle(title))
});

export default connect(mapStateToProps, mapDispatchToProps)(ProjectTitleInput);
