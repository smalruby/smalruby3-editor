/* eslint-disable no-console */
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {projectTitleInitialState} from '../reducers/project-title';
import RubyGenerator from '../lib/ruby-generator';
import VM from '@smalruby/scratch-vm';
import {rubyCodeShape} from '../reducers/ruby-code';
import {setKoshienFileHandle, clearKoshienFileHandle} from '../reducers/koshien-file';

class RubyDownloader extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'downloadProject',
            'saveWithFileSystemAPI',
            'supportsFileSystemAPI'
        ]);
    }
    supportsFileSystemAPI () {
        return 'showSaveFilePicker' in window;
    }
    saveRuby () {
        const idToTarget = {};
        this.props.vm.runtime.targets.forEach(target => {
            idToTarget[target.id] = target;
        });
        const targets = [idToTarget[this.props.stage.id]];
        for (const id in this.props.sprites) {
            const sprite = this.props.sprites[id];
            targets[sprite.order + 1] = idToTarget[id];
        }
        const options = {
            requires: ['smalruby3'],
            withSpriteNew: true
        };
        if (this.props.rubyCode.modified) {
            options.targetsCode = {
                [this.props.rubyCode.target.id]: this.props.rubyCode.code
            };
        }
        const code = RubyGenerator.targetsToCode(targets, options);

        return new Blob([code], {
            type: 'text/x-ruby-script'
        });
    }
    async saveWithFileSystemAPI () {
        try {
            const content = this.saveRuby();
            // If forceFilePicker is true, ignore existing file handle
            let fileHandle = this.props.forceFilePicker ? null : this.props.koshienFileHandle;

            // If no file handle exists, show save dialog
            if (!fileHandle) {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: this.props.projectFilename,
                    types: [{
                        description: 'Ruby Script',
                        accept: {'text/x-ruby-script': ['.rb']}
                    }]
                });
                // Store the file handle for future saves
                this.props.onSetKoshienFileHandle(fileHandle);
            }

            // Write to the file
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            if (this.props.onSaveFinished) {
                this.props.onSaveFinished();
            }
        } catch (err) {
            // User cancelled the save dialog or permission denied
            if (err.name !== 'AbortError') {
                console.error('Error saving file:', err);
            }
            if (this.props.onSaveError) {
                this.props.onSaveError(err);
            }
        }
    }
    downloadProject () {
        // Use File System Access API if available (Chrome/Edge)
        if (this.supportsFileSystemAPI()) {
            this.saveWithFileSystemAPI();
            return;
        }

        // Fallback to traditional download for other browsers
        const downloadLink = document.createElement('a');
        document.body.appendChild(downloadLink);

        const content = this.saveRuby();
        if (this.props.onSaveFinished) {
            this.props.onSaveFinished();
        }
        // Use special ms version if available to get it working on Edge.
        if (navigator.msSaveOrOpenBlob) {
            navigator.msSaveOrOpenBlob(content, this.props.projectFilename);
            return;
        }

        const url = window.URL.createObjectURL(content);
        downloadLink.href = url;
        downloadLink.download = this.props.projectFilename;
        downloadLink.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(downloadLink);
    }
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
    return `${filenameTitle.substring(0, 100)}.rb`;
};

RubyDownloader.propTypes = {
    children: PropTypes.func,
    className: PropTypes.string,
    forceFilePicker: PropTypes.bool,
    koshienFileHandle: PropTypes.object,
    onSaveFinished: PropTypes.func,
    onSaveError: PropTypes.func,
    onSetKoshienFileHandle: PropTypes.func,
    projectFilename: PropTypes.string,
    rubyCode: rubyCodeShape,
    sprites: PropTypes.objectOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        order: PropTypes.number.isRequired
    })),
    stage: PropTypes.shape({
        id: PropTypes.string
    }),
    vm: PropTypes.instanceOf(VM)
};
RubyDownloader.defaultProps = {
    className: ''
};

const mapStateToProps = state => ({
    koshienFileHandle: state.scratchGui.koshienFile.fileHandle,
    projectFilename: getProjectFilename(state.scratchGui.projectTitle, projectTitleInitialState),
    sprites: state.scratchGui.targets.sprites,
    stage: state.scratchGui.targets.stage,
    vm: state.scratchGui.vm,
    rubyCode: state.scratchGui.rubyCode
});

const mapDispatchToProps = dispatch => ({
    onSetKoshienFileHandle: fileHandle => dispatch(setKoshienFileHandle(fileHandle)),
    onClearKoshienFileHandle: () => dispatch(clearKoshienFileHandle())
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(RubyDownloader);
