// === Smalruby: This file is Smalruby-specific (Ruby script preview panel) ===

import React, {useState, useCallback, useRef} from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import {defineMessages, useIntl} from 'react-intl';
import styles from './ruby-script-preview.css';

import closeIcon from '../cards/icon--close.svg';
import shrinkIcon from '../cards/icon--shrink.svg';
import expandIcon from '../cards/icon--expand.svg';

const MENU_BAR_HEIGHT = 48;

const messages = defineMessages({
    title: {
        id: 'gui.rubyScriptPreview.title',
        defaultMessage: 'Preview Ruby Script',
        description: 'Title for the Ruby script preview panel'
    },
    copy: {
        id: 'gui.rubyScriptPreview.copy',
        defaultMessage: 'Copy to Clipboard',
        description: 'Button to copy Ruby script to clipboard'
    },
    copied: {
        id: 'gui.rubyScriptPreview.copied',
        defaultMessage: 'Copied!',
        description: 'Shown after copying Ruby script to clipboard'
    },
    shrink: {
        id: 'gui.rubyScriptPreview.shrink',
        defaultMessage: 'Shrink',
        description: 'Title for button to shrink the preview panel'
    },
    expand: {
        id: 'gui.rubyScriptPreview.expand',
        defaultMessage: 'Expand',
        description: 'Title for button to expand the preview panel'
    },
    close: {
        id: 'gui.rubyScriptPreview.close',
        defaultMessage: 'Close',
        description: 'Title for button to close the preview panel'
    }
});

const RubyScriptPreview = ({code, onClose}) => {
    const intl = useIntl();
    const [expanded, setExpanded] = useState(true);
    const [copied, setCopied] = useState(false);
    const copiedTimerRef = useRef(null);

    const handleShrinkExpand = useCallback(() => {
        setExpanded(prev => !prev);
    }, []);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
            copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
        });
    }, [code]);

    // Position: right side, full height below menu bar
    const panelWidth = 600;
    const panelHeight = window.innerHeight - MENU_BAR_HEIGHT - 16;
    const defaultPosition = {
        x: window.innerWidth - panelWidth - 32,
        y: MENU_BAR_HEIGHT + 8
    };

    return (
        <div className={styles.overlay}>
            <Draggable
                bounds="parent"
                defaultPosition={defaultPosition}
                handle={`.${styles.header}`}
            >
                <div
                    className={styles.panelContainer}
                    style={{height: expanded ? `${panelHeight}px` : 'auto'}}
                >
                    <div className={styles.header}>
                        <div className={styles.headerTitle}>
                            {intl.formatMessage(messages.title)}
                        </div>
                        <div className={styles.headerButtons}>
                            <button
                                className={styles.headerButton}
                                onClick={handleShrinkExpand}
                                title={intl.formatMessage(
                                    expanded ? messages.shrink : messages.expand
                                )}
                            >
                                <img
                                    draggable={false}
                                    src={expanded ? shrinkIcon : expandIcon}
                                />
                            </button>
                            <button
                                className={styles.headerButton}
                                onClick={onClose}
                                title={intl.formatMessage(messages.close)}
                            >
                                <img
                                    draggable={false}
                                    src={closeIcon}
                                />
                            </button>
                        </div>
                    </div>
                    <div className={expanded ? styles.body : styles.hidden}>
                        <pre className={styles.codeArea}>
                            {code}
                        </pre>
                        <div className={styles.footer}>
                            <button
                                className={copied ? styles.copyButtonCopied : styles.copyButton}
                                onClick={handleCopy}
                            >
                                {intl.formatMessage(
                                    copied ? messages.copied : messages.copy
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </Draggable>
        </div>
    );
};

RubyScriptPreview.propTypes = {
    code: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired
};

export default RubyScriptPreview;
