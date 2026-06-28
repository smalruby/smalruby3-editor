import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';
import VM from '@smalruby/scratch-vm';
import intlShape from '../../lib/intlShape.js';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import Modal from '../../containers/modal.jsx';

import { generatePreviewCode } from '../../lib/ruby-script-preview';
import { buildKoshienTestUrl } from '../../lib/koshien-test-url';

import reloadIcon from '../../lib/assets/icon--reload.svg';
import stopIcon from '../close-button/icon--close.svg';

import styles from './koshien-test-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Test AI',
        description: 'Title for the Koshien test modal',
        id: 'gui.koshienTestModal.title',
    },
});

const KoshienTestModal = (props) => {
    const { intl, onRequestClose, vm, rubyVersion } = props;
    const [iframeKey, setIframeKey] = React.useState(0);
    const [loading, setLoading] = React.useState(true);

    // Generate the current sprite's AI program (current Ruby version) and pass
    // it to the viewer as player1 so the user's own AI is played. Regenerated
    // whenever the modal (re)loads via the reload button. Falls back to the
    // default AI (base URL, no param) if generation fails or yields nothing.
    const iframeSrc = React.useMemo(() => {
        try {
            const code = generatePreviewCode(vm && vm.editingTarget, rubyVersion);
            return buildKoshienTestUrl(code);
        } catch (e) {
            return buildKoshienTestUrl('');
        }
        // iframeKey is intentionally included so Reload re-reads the latest code.
    }, [vm, rubyVersion, iframeKey]);

    const handleReload = React.useCallback(() => {
        setIframeKey((prevKey) => prevKey + 1);
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
                    src={iframeSrc}
                    title={intl.formatMessage(messages.title)}
                    onLoad={handleLoad}
                />
            </Box>
        </Modal>
    );
};

KoshienTestModal.propTypes = {
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    rubyVersion: PropTypes.string,
    vm: PropTypes.instanceOf(VM),
};

const mapStateToProps = (state) => ({
    vm: state.scratchGui.vm,
    rubyVersion: state.scratchGui.settings.rubyVersion,
});

export default injectIntl(connect(mapStateToProps)(KoshienTestModal));
