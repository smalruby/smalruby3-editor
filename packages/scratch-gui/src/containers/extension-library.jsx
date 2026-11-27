import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from '@smalruby/scratch-vm';
// === Smalruby: Start of show all extensions ===
import {connect} from 'react-redux';
// === Smalruby: End of show all extensions ===
import {defineMessages, injectIntl, FormattedMessage} from 'react-intl';
import intlShape from '../lib/intlShape.js';

import extensionLibraryContent from '../lib/libraries/extensions/index.jsx';

import LibraryComponent from '../components/library/library.jsx';
import extensionIcon from '../components/action-menu/icon--sprite.svg';

// === Smalruby: Start of show all extensions ===
import {toggleShowAllExtensions} from '../reducers/extension-filter';
// === Smalruby: End of show all extensions ===
// === Smalruby: Start of Smalrubot S1 legacy card ===
import {showStandardAlert} from '../reducers/alerts';
import {
    resolveLegacyCard,
    withLegacyCards
} from '../lib/libraries/extensions/smalrubot-s1/legacy-card.jsx';
// === Smalruby: End of Smalrubot S1 legacy card ===

// === Smalruby: Start of show all extensions ===
import styles from './extension-library.css';
// === Smalruby: End of show all extensions ===

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
        // === Smalruby: Start of extension translations ===
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
        // === Smalruby: End of extension translations ===
        bindAll(this, [
            'handleItemSelect',
            // === Smalruby: Start of show all extensions ===
            'handleToggleShowAllExtensions'
            // === Smalruby: End of show all extensions ===
        ]);
    }
    // === Smalruby: Start of show all extensions ===
    handleToggleShowAllExtensions (event) {
        this.props.onToggleShowAllExtensions(event.target.checked);
    }
    // === Smalruby: End of show all extensions ===
    // === Smalruby: Start of Smalrubot S1 legacy card ===
    // Upstream names the argument `item`. `item` is set from resolveLegacyCard below.
    // === Smalruby: End of Smalrubot S1 legacy card ===
    handleItemSelect (selectedItem) {
        // === Smalruby: Start of Smalrubot S1 legacy card ===
        // The old card loads the same extension as the current card and tells about the rename.
        const {item, alertId} = resolveLegacyCard(selectedItem, extensionLibraryContent);
        if (alertId && this.props.onShowAlert) this.props.onShowAlert(alertId);
        // === Smalruby: End of Smalrubot S1 legacy card ===
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
        // === Smalruby: Start of show all extensions ===
        const query = new URLSearchParams(window.location.search);
        const showAllExtensionsParam = query.get('showAllExtensions');
        const showAllExtensions = showAllExtensionsParam === 'true' ? true :
            showAllExtensionsParam === 'false' ? false :
                this.props.showAllExtensions;
        // === Smalruby: End of show all extensions ===

        // === Smalruby: Start of Smalrubot S1 legacy card ===
        const extensionLibraryThumbnailData = withLegacyCards(extensionLibraryContent, new Date())
        // === Smalruby: End of Smalrubot S1 legacy card ===
            // === Smalruby: Start of show all extensions ===
            .filter(extension => {
                if (!showAllExtensions && extension.defaultHidden) {
                    return false;
                }
                return true;
            })
            // === Smalruby: End of show all extensions ===
            .map(extension => ({
                rawURL: extension.iconURL || extensionIcon,
                ...extension
            }));

        // === Smalruby: Start of show all extensions ===
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
        // === Smalruby: End of show all extensions ===

        return (
            <LibraryComponent
                data={extensionLibraryThumbnailData}
                filterable={false}
                // === Smalruby: Start of show all extensions ===
                headerActions={headerActions}
                // === Smalruby: End of show all extensions ===
                id="extensionLibrary"
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

ExtensionLibrary.propTypes = {
    intl: intlShape.isRequired,
    onCategorySelected: PropTypes.func,
    onRequestClose: PropTypes.func,
    // === Smalruby: Start of Smalrubot S1 legacy card ===
    onShowAlert: PropTypes.func,
    // === Smalruby: End of Smalrubot S1 legacy card ===
    // === Smalruby: Start of show all extensions ===
    onToggleShowAllExtensions: PropTypes.func,
    showAllExtensions: PropTypes.bool,
    // === Smalruby: End of show all extensions ===
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};

// === Smalruby: Start of show all extensions ===
const mapStateToProps = state => ({
    showAllExtensions: state.scratchGui.extensionFilter.showAllExtensions
});
// === Smalruby: End of show all extensions ===

// === Smalruby: Start of show all extensions ===
// Upstream exports injectIntl(ExtensionLibrary) without connect.
// === Smalruby: End of show all extensions ===
const mapDispatchToProps = dispatch => ({
    // === Smalruby: Start of Smalrubot S1 legacy card ===
    onShowAlert: alertId => dispatch(showStandardAlert(alertId)),
    // === Smalruby: End of Smalrubot S1 legacy card ===
    // === Smalruby: Start of show all extensions ===
    onToggleShowAllExtensions: showAll => dispatch(toggleShowAllExtensions(showAll))
    // === Smalruby: End of show all extensions ===
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(injectIntl(ExtensionLibrary));
