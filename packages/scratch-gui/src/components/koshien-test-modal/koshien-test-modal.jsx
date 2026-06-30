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
import { buildKoshienTestPlan } from '../../lib/koshien-test-url';
import downloadBlob from '../../lib/download-blob';

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

/**
 * Build a safe `<sprite>.rb` filename for the downloaded AI program.
 * @param {object} vm - The Scratch VM.
 * @returns {string} The download filename.
 */
const aiFilename = (vm) => {
    const target = vm && vm.editingTarget;
    const name = target && typeof target.getName === 'function' ? target.getName() : '';
    const safe = (name || 'koshien_ai').replace(/[\\/:*?"<>|]/g, '_');
    return `${safe}.rb`;
};

export const KoshienTestModal = (props) => {
    const { intl, onRequestClose, vm, rubyVersion } = props;
    const [iframeKey, setIframeKey] = React.useState(0);
    const [loading, setLoading] = React.useState(true);

    // Generate the current sprite's AI program (current Ruby version). Short AIs
    // ride along in the player1 query parameter so the user's own AI is played.
    // A complex AI would overflow the URL length limit, so in that case we load
    // the viewer without the AI (default AI) and surface a download fallback.
    // Regenerated whenever the modal (re)loads via the reload button. Falls back
    // to the default AI if generation fails or yields nothing.
    const { iframeSrc, code, tooLong } = React.useMemo(() => {
        let generated = '';
        try {
            generated = generatePreviewCode(vm && vm.editingTarget, rubyVersion) || '';
        } catch (e) {
            generated = '';
        }
        const plan = buildKoshienTestPlan(generated);
        return { iframeSrc: plan.url, code: generated, tooLong: plan.tooLong };
        // iframeKey is intentionally included so Reload re-reads the latest code.
    }, [vm, rubyVersion, iframeKey]);

    const handleDownloadAi = React.useCallback(() => {
        downloadBlob(aiFilename(vm), new Blob([code], { type: 'text/plain' }));
    }, [vm, code]);

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
                {tooLong && (
                    <div
                        className={styles.tooLongBanner}
                        data-testid="koshien-test-too-long-banner"
                    >
                        <div className={styles.tooLongText}>
                            <FormattedMessage
                                defaultMessage="This AI is too large to pass to the viewer through the URL. Save it as a Ruby (.rb) file and load it from the viewer to test it."
                                description="Notice shown when the AI program is too long to embed in the Test AI viewer URL"
                                id="gui.koshienTestModal.tooLong"
                            />
                        </div>
                        <Button
                            className={styles.downloadButton}
                            data-testid="koshien-test-download-ai"
                            onClick={handleDownloadAi}
                        >
                            <FormattedMessage
                                defaultMessage="Save AI to a file"
                                description="Button to download the AI program as a .rb file"
                                id="gui.koshienTestModal.downloadAi"
                            />
                        </Button>
                    </div>
                )}
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
