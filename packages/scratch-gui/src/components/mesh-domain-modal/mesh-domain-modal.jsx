import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import {defineMessages, FormattedMessage, injectIntl} from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import meshIcon from '../../lib/libraries/extensions/mesh/mesh-small.png';

import styles from './mesh-domain-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Mesh V2 Domain Settings',
        description: 'Title for the Mesh V2 domain modal',
        id: 'mesh.domainModalTitle'
    },
    domainPlaceholder: {
        defaultMessage: 'Enter domain name...',
        description: 'Placeholder text for domain input field',
        id: 'mesh.domainPlaceholder'
    },
    saveButton: {
        defaultMessage: 'Save',
        description: 'Label for save button',
        id: 'mesh.domainSaveButton'
    },
    cancelButton: {
        defaultMessage: 'Cancel',
        description: 'Label for cancel button',
        id: 'mesh.domainCancelButton'
    },
    domainInvalidError: {
        defaultMessage: 'Domain name contains invalid characters.',
        description: 'Error message for invalid characters in domain name',
        id: 'mesh.domainInvalidError'
    },
    domainTooLongError: {
        defaultMessage: 'Domain name is too long (max 256 characters).',
        description: 'Error message for domain name exceeding 256 characters',
        id: 'mesh.domainTooLongError'
    },
    domainDescription: {
        defaultMessage: 'If the host you want to join does not appear, ' +
            'everyone including the host should set the same domain (address on the internet). ' +
            'The address of a facility such as a school is ideal.',
        description: 'Description for Mesh V2 domain setting',
        id: 'mesh.domainDescription'
    },
    domainExampleTitle: {
        defaultMessage: 'Example',
        description: 'Title for Mesh V2 domain example',
        id: 'mesh.domainExampleTitle'
    },
    domainExample: {
        defaultMessage: '100-0014',
        description: 'Example for Mesh V2 domain',
        id: 'mesh.domainExample'
    }
});

class MeshDomainModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleDomainChange',
            'handleSaveClick',
            'handleCancelClick',
            'handleKeyPress',
            'validate'
        ]);

        this.state = {
            domain: props.initialDomain || '',
            error: null
        };
    }

    validate (domain) {
        if (!domain) return null;

        if (domain.length > 256) {
            return 'tooLong';
        }

        // Allow alphanumeric, hyphen, underscore, dot.
        const validPattern = /^[a-zA-Z0-9-._]+$/;
        if (!validPattern.test(domain)) {
            return 'invalid';
        }

        return null;
    }

    handleDomainChange (event) {
        const domain = event.target.value;
        this.setState({
            domain: domain,
            error: this.validate(domain)
        });
    }

    handleSaveClick () {
        const error = this.validate(this.state.domain);
        if (!error) {
            this.props.onSave(this.state.domain.trim());
        }
    }

    handleCancelClick () {
        this.props.onRequestClose();
    }

    handleKeyPress (event) {
        if (event.key === 'Enter') {
            this.handleSaveClick();
        }
    }

    render () {
        const {intl, onRequestClose} = this.props;
        const {domain, error} = this.state;

        return (
            <Modal
                className={styles.modalContent}
                contentLabel={intl.formatMessage(messages.title)}
                headerClassName={styles.header}
                headerImage={meshIcon}
                id="meshDomainModal"
                onRequestClose={onRequestClose}
            >
                <Box className={styles.body}>
                    <Box className={styles.inputSection}>
                        <input
                            className={classNames(styles.domainInput, {
                                [styles.inputError]: error
                            })}
                            type="text"
                            value={domain}
                            placeholder={intl.formatMessage(messages.domainPlaceholder)}
                            onChange={this.handleDomainChange}
                            onKeyPress={this.handleKeyPress}
                            autoFocus
                        />
                        {error === 'tooLong' && (
                            <div className={styles.errorMessage}>
                                <FormattedMessage {...messages.domainTooLongError} />
                            </div>
                        )}
                        {error === 'invalid' && (
                            <div className={styles.errorMessage}>
                                <FormattedMessage {...messages.domainInvalidError} />
                            </div>
                        )}
                    </Box>

                    <Box className={styles.descriptionSection}>
                        <div className={styles.descriptionText}>
                            <FormattedMessage {...messages.domainDescription} />
                        </div>
                    </Box>

                    <Box className={styles.exampleSection}>
                        <div className={styles.exampleTitle}>
                            <FormattedMessage {...messages.domainExampleTitle} />
                        </div>
                        <div className={styles.exampleText}>
                            <FormattedMessage {...messages.domainExample} />
                        </div>
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
                            className={classNames(styles.saveButton, {
                                [styles.disabled]: !!error
                            })}
                            disabled={!!error}
                            onClick={this.handleSaveClick}
                        >
                            <FormattedMessage
                                {...messages.saveButton}
                            />
                        </button>
                    </Box>
                </Box>
            </Modal>
        );
    }
}

MeshDomainModal.propTypes = {
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    initialDomain: PropTypes.string
};

export default injectIntl(MeshDomainModal);
