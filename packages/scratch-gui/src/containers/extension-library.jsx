import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from '@smalruby/scratch-vm';
import {connect} from 'react-redux';
import {defineMessages, injectIntl, FormattedMessage} from 'react-intl';
import intlShape from '../lib/intlShape.js';

import extensionLibraryContent from '../lib/libraries/extensions/index.jsx';

import LibraryComponent from '../components/library/library.jsx';
import extensionIcon from '../components/action-menu/icon--sprite.svg';

import {toggleShowAllExtensions} from '../reducers/extension-filter';

import styles from './extension-library.css';

const messages = defineMessages({
    extensionTitle: {
        defaultMessage: 'Choose an Extension',
        description: 'Heading for the extension library',
        id: 'gui.extensionLibrary.chooseAnExtension'
    },
    extensionUrl: {
        defaultMessage: 'Enter the URL of the extension',
        description: 'Prompt for unoffical extension url',
        id: 'gui.extensionLibrary.extensionUrl'
    }
});

class ExtensionLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        extensionLibraryContent.forEach(extension => {
            if (extension.setFormatMessage) {
                extension.setFormatMessage(this.props.intl.formatMessage);
            }
            if (extension.translationMap) {
                Object.assign(
                    this.props.intl.messages,
                    extension.translationMap[this.props.intl.locale]
                );
            }
        });
        bindAll(this, [
            'handleItemSelect',
            'handleToggleShowAllExtensions'
        ]);
    }
    handleToggleShowAllExtensions (event) {
        this.props.onToggleShowAllExtensions(event.target.checked);
    }
    handleItemSelect (item) {
        const id = item.extensionId;
        let url = item.extensionURL ? item.extensionURL : id;
        if (!item.disabled && !id) {
            // eslint-disable-next-line no-alert
            url = prompt(this.props.intl.formatMessage(messages.extensionUrl));
        }
        if (id && !item.disabled) {
            if (this.props.vm.extensionManager.isExtensionLoaded(url)) {
                this.props.onCategorySelected(id);
            } else {
                this.props.vm.extensionManager.loadExtensionURL(url).then(() => {
                    this.props.onCategorySelected(id);
                });
            }
        }
    }
    render () {
        const query = new URLSearchParams(window.location.search);
        const extensionsParam = query.get('extensions') || '';
        const showMeshV2 = extensionsParam.split(',').includes('meshV2');

        const showAllExtensionsParam = query.get('showAllExtensions');
        const showAllExtensions = showAllExtensionsParam === 'true' ? true :
            showAllExtensionsParam === 'false' ? false :
                this.props.showAllExtensions;

        const extensionLibraryThumbnailData = extensionLibraryContent
            .filter(extension => {
                if (extension.extensionId === 'meshV2' && !showMeshV2) {
                    return false;
                }
                if (!showAllExtensions && extension.defaultHidden) {
                    return false;
                }
                return true;
            })
            .map(extension => ({
                rawURL: extension.iconURL || extensionIcon,
                ...extension
            }));

        const checkboxLabel = this.props.intl.formatMessage({
            defaultMessage: 'Show all extensions',
            description: 'Checkbox label to show all extensions including hidden ones',
            id: 'gui.extensionLibrary.showAllExtensions'
        });

        const headerActions = (
            <label className={styles.showAllExtensionsLabel}>
                <input
                    aria-label={checkboxLabel}
                    checked={showAllExtensions}
                    className={styles.showAllExtensionsCheckbox}
                    type="checkbox"
                    onChange={this.handleToggleShowAllExtensions}
                />
                <FormattedMessage
                    defaultMessage="Show all extensions"
                    description="Checkbox label to show all extensions including hidden ones"
                    id="gui.extensionLibrary.showAllExtensions"
                />
            </label>
        );

        return (
            <LibraryComponent
                data={extensionLibraryThumbnailData}
                filterable={false}
                headerActions={headerActions}
                id="extensionLibrary"
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
                showNewFeatureCallouts={this.props.showNewFeatureCallouts}
                username={this.props.username}
            />
        );
    }
}

ExtensionLibrary.propTypes = {
    intl: intlShape.isRequired,
    onCategorySelected: PropTypes.func,
    onRequestClose: PropTypes.func,
    onToggleShowAllExtensions: PropTypes.func,
    showAllExtensions: PropTypes.bool,
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired,
    username: PropTypes.string,
    showNewFeatureCallouts: PropTypes.bool
};

const mapStateToProps = state => ({
    showAllExtensions: state.scratchGui.extensionFilter.showAllExtensions
});

const mapDispatchToProps = dispatch => ({
    onToggleShowAllExtensions: showAll => dispatch(toggleShowAllExtensions(showAll))
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(injectIntl(ExtensionLibrary));
