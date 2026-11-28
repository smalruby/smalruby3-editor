import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
// === Smalruby: Start of ruby to blocks before download ===
import {injectIntl} from 'react-intl';
import intlShape from '../lib/intlShape.js';
// === Smalruby: End of ruby to blocks before download ===
import {connect} from 'react-redux';
import {projectTitleInitialState} from '../reducers/project-title';
import downloadBlob from '../lib/download-blob';

// === Smalruby: Start of ruby to blocks before download ===
import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';
// === Smalruby: End of ruby to blocks before download ===

/**
 * Project saver component passes a downloadProject function to its child.
 * It expects this child to be a function with the signature
 *     function (downloadProject, props) {}
 * The component can then be used to attach project saving functionality
 * to any other component:
 *
 * <SB3Downloader>{(downloadProject, props) => (
 *     <MyCoolComponent
 *         onClick={downloadProject}
 *         {...props}
 *     />
 * )}</SB3Downloader>
 */
class SB3Downloader extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'downloadProject'
        ]);
    }
    // === Smalruby: Start of ruby to blocks before download ===
    // Upstream: downloadProject () saves the sb3 and downloads it without converting Ruby.
    async downloadProject () {
        const converter = await this.props.targetCodeToBlocks(this.props.intl);
        if (!converter.result) {
            return;
        }
        converter.apply().then(() => {
            this.props.saveProjectSb3().then(content => {
                if (this.props.onSaveFinished) {
                    this.props.onSaveFinished();
                }
                downloadBlob(this.props.projectFilename, content);
            });
        })
            .catch(error => {
                // apply() failed and rolled the target's blocks back
                // (issue #710); log instead of an unhandled rejection.
                // eslint-disable-next-line no-console
                console.error('[SB3Downloader] Ruby to blocks apply error:', error);
            });
    }
    // === Smalruby: End of ruby to blocks before download ===
    render () {
        const {
            children
        } = this.props;
        return children(
            this.props.className,
            this.downloadProject
        );
    }
}

const getProjectFilename = (curTitle, defaultTitle) => {
    let filenameTitle = curTitle;
    if (!filenameTitle || filenameTitle.length === 0) {
        filenameTitle = defaultTitle;
    }
    return `${filenameTitle.substring(0, 100)}.sb3`;
};

SB3Downloader.propTypes = {
    children: PropTypes.func,
    className: PropTypes.string,
    // === Smalruby: Start of ruby to blocks before download ===
    intl: intlShape.isRequired,
    // === Smalruby: End of ruby to blocks before download ===
    onSaveFinished: PropTypes.func,
    projectFilename: PropTypes.string,
    saveProjectSb3: PropTypes.func,
    // === Smalruby: Start of ruby to blocks before download ===
    targetCodeToBlocks: PropTypes.func
    // === Smalruby: End of ruby to blocks before download ===
};
SB3Downloader.defaultProps = {
    className: ''
};

const mapStateToProps = state => ({
    saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
    projectFilename: getProjectFilename(state.scratchGui.projectTitle, projectTitleInitialState)
});

// === Smalruby: Start of ruby to blocks before download ===
// Upstream: export default connect(mapStateToProps, () => ({}))(SB3Downloader);
export default RubyToBlocksConverterHOC(injectIntl(connect(
    mapStateToProps,
    () => ({}) // omit dispatch prop
)(SB3Downloader)));
// === Smalruby: End of ruby to blocks before download ===
