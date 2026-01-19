import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, FormattedMessage} from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import Modal from '../../containers/modal.jsx';

import reloadIcon from '../../lib/assets/icon--reload.svg';
import stopIcon from '../close-button/icon--close.svg';

import styles from './koshien-test-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Test AI',
        description: 'Title for the Koshien test modal',
        id: 'gui.koshienTestModal.title'
    }
});

const KoshienTestModal = props => {
    const {intl, onRequestClose} = props;
    const [iframeKey, setIframeKey] = React.useState(0);
    const [loading, setLoading] = React.useState(true);

    const handleReload = React.useCallback(() => {
        setIframeKey(prevKey => prevKey + 1);
        setLoading(true);
    }, []);

    const handleStop = React.useCallback(() => {
        setLoading(false);
    }, []);

    const handleLoad = React.useCallback(() => {
        setLoading(false);
    }, []);

    const headerActions = loading ? (
        <Button
            className={styles.reloadButton}
            iconClassName={styles.stopIcon}
            iconSrc={stopIcon}
            onClick={handleStop}
        >
            <FormattedMessage
                defaultMessage="Stop"
                description="Stop button in modal"
                id="gui.modal.stop"
            />
        </Button>
    ) : (
        <Button
            className={styles.reloadButton}
            iconSrc={reloadIcon}
            onClick={handleReload}
        >
            <FormattedMessage
                defaultMessage="Reload"
                description="Reload button in modal"
                id="gui.modal.reload"
            />
        </Button>
    );

    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            fullScreen
            headerActions={headerActions}
            headerClassName={styles.header}
            id="koshienTestModal"
            loading={loading}
            onRequestClose={onRequestClose}
        >
            <Box
                className={styles.body}
                grow={1}
            >
                <iframe
                    key={iframeKey}
                    className={styles.iframe}
                    src="https://smalruby-koshien-web.netlab.jp/"
                    title={intl.formatMessage(messages.title)}
                    onLoad={handleLoad}
                />
            </Box>
        </Modal>
    );
};

KoshienTestModal.propTypes = {
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func.isRequired
};

export default injectIntl(KoshienTestModal);
