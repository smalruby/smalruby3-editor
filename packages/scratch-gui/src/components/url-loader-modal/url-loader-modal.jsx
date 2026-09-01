import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import {defineMessages, FormattedMessage, injectIntl} from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import urlLoaderIcon from './url-loader-icon.svg';

import styles from './url-loader-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Load from Scratch',
        description: 'Title for the Scratch loader modal',
        id: 'gui.urlLoader.title'
    },
    urlPlaceholder: {
        defaultMessage: 'Enter project URL...',
        description: 'Placeholder text for URL input field',
        id: 'gui.urlLoader.urlPlaceholder'
    },
    urlExamplesTitle: {
        defaultMessage: 'URL Examples',
        description: 'Title for URL examples section',
        id: 'gui.urlLoader.urlExamplesTitle'
    },
    urlExampleScratch: {
        defaultMessage: 'https://scratch.mit.edu/projects/1234567/',
        description: 'Example URL for Scratch projects',
        id: 'gui.urlLoader.urlExampleScratch'
    },
    openButton: {
        defaultMessage: 'Open',
        description: 'Label for open button',
        id: 'gui.urlLoader.openButton'
    },
    cancelButton: {
        defaultMessage: 'Cancel',
        description: 'Label for cancel button',
        id: 'gui.urlLoader.cancelButton'
    },
    loading: {
        defaultMessage: 'Loading…',
        description: 'Shown in the modal while a project is being fetched and loaded from a URL',
        id: 'gui.urlLoader.loading'
    }
});

class URLLoaderModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleUrlChange',
            'handleOpenClick',
            'handleCancelClick',
            'handleKeyPress',
            'clearError'
        ]);

        this.state = {
            url: '',
            error: null
        };
    }

    handleUrlChange (event) {
        this.setState({
            url: event.target.value,
            error: null // Clear error when user types
        });
    }

    clearError () {
        this.setState({error: null});
    }

    handleOpenClick () {
        // Ignore clicks while a load is already running so the project is only
        // loaded once even if the user taps "Open"/Enter repeatedly (#972).
        if (this.props.loading) {
            return;
        }
        const {url} = this.state;
        if (url.trim()) {
            this.props.onLoadUrl(url.trim(), error => {
                if (error) {
                    this.setState({error: error});
                }
            });
        }
    }

    handleCancelClick () {
        this.props.onRequestClose();
    }

    handleKeyPress (event) {
        // The Enter that commits an IME conversion must not open the project.
        // React's SyntheticKeyboardEvent omits isComposing, so read the native
        // event; keyCode 229 covers browsers that do not set isComposing.
        if ((event.nativeEvent && event.nativeEvent.isComposing) || event.keyCode === 229) return;
        if (event.key === 'Enter') {
            this.handleOpenClick();
        }
    }

    render () {
        const {intl, loading, onRequestClose} = this.props;
        const {url, error} = this.state;

        return (
            <Modal
                className={styles.modalContent}
                contentLabel={intl.formatMessage(messages.title)}
                headerClassName={styles.header}
                headerImage={urlLoaderIcon}
                id="urlLoaderModal"
                onRequestClose={onRequestClose}
            >
                <Box className={styles.body}>
                    <Box className={styles.inputSection}>
                        <input
                            className={classNames(styles.urlInput, {
                                [styles.inputError]: error
                            })}
                            type="text"
                            value={url}
                            placeholder={intl.formatMessage(messages.urlPlaceholder)}
                            onChange={this.handleUrlChange}
                            onKeyPress={this.handleKeyPress}
                            disabled={loading}
                            autoFocus
                        />
                        {error && (
                            <div className={styles.errorMessage} data-testid="url-loader-error">
                                {error}
                            </div>
                        )}
                    </Box>

                    {loading && (
                        <Box
                            className={styles.loadingIndicator}
                            data-testid="url-loader-loading"
                        >
                            <span className={styles.loadingSpinner} />
                            <FormattedMessage
                                {...messages.loading}
                            />
                        </Box>
                    )}

                    <Box className={styles.examplesSection}>
                        <div className={styles.examplesTitle}>
                            <FormattedMessage
                                {...messages.urlExamplesTitle}
                            />
                        </div>
                        <ul className={styles.examplesList}>
                            <li className={styles.exampleItem}>
                                <FormattedMessage
                                    {...messages.urlExampleScratch}
                                />
                            </li>
                        </ul>
                    </Box>

                    <Box className={styles.buttonSection}>
                        <button
                            className={styles.cancelButton}
                            onClick={this.handleCancelClick}
                        >
                            <FormattedMessage
                                {...messages.cancelButton}
                            />
                        </button>
                        <button
                            className={classNames(styles.openButton, {
                                [styles.disabled]: !url.trim() || loading
                            })}
                            onClick={this.handleOpenClick}
                            disabled={!url.trim() || loading}
                        >
                            <FormattedMessage
                                {...messages.openButton}
                            />
                        </button>
                    </Box>
                </Box>
            </Modal>
        );
    }
}

URLLoaderModal.propTypes = {
    intl: intlShape.isRequired,
    loading: PropTypes.bool,
    onRequestClose: PropTypes.func.isRequired,
    onLoadUrl: PropTypes.func.isRequired
};

export default injectIntl(URLLoaderModal);
