import React, {useRef, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import {defineMessages, useIntl} from 'react-intl';
import styles from './gemini-modal.css';

import closeIcon from '../debug-modal/icons/icon--close.svg';
import iconAI from '../ruby-toolbar/icon--ai.svg';

const MODAL_WIDTH = 560;
const MODAL_HEIGHT = 520;
const MENU_BAR_HEIGHT = 48;
const MAX_STAGE_WIDTH = 1280;
const MAX_STAGE_HEIGHT = 600;

const messages = defineMessages({
    title: {
        id: 'gui.geminiModal.title',
        defaultMessage: 'AI Assistant (Gemini)',
        description: 'Title for the Gemini AI assistant modal'
    },
    clearHistory: {
        id: 'gui.geminiModal.clearHistory',
        defaultMessage: 'Clear history',
        description: 'Clear chat history button label'
    },
    inputPlaceholder: {
        id: 'gui.geminiModal.inputPlaceholder',
        defaultMessage: 'Tell me what you want to create...',
        description: 'Placeholder text for message input'
    },
    send: {
        id: 'gui.geminiModal.send',
        defaultMessage: 'Send',
        description: 'Send button label'
    },
    thinking: {
        id: 'gui.geminiModal.thinking',
        defaultMessage: 'Gemini is thinking... ({seconds}s)',
        description: 'Loading indicator text with elapsed seconds'
    },
    generatedCode: {
        id: 'gui.geminiModal.generatedCode',
        defaultMessage: 'Generated code',
        description: 'Label for generated code preview section'
    },
    applyCode: {
        id: 'gui.geminiModal.applyCode',
        defaultMessage: 'Apply code',
        description: 'Button to apply generated code to editor'
    },
    emptyHistory: {
        id: 'gui.geminiModal.emptyHistory',
        defaultMessage: 'Tell me what program you want to create! For example: "Make the cat chase the mouse"',
        description: 'Placeholder shown when chat history is empty'
    },
    you: {
        id: 'gui.geminiModal.you',
        defaultMessage: 'You',
        description: 'Label for user messages'
    },
    gemini: {
        id: 'gui.geminiModal.gemini',
        defaultMessage: 'Gemini',
        description: 'Label for Gemini messages'
    }
});

const GeminiModal = ({
    isVisible,
    history,
    isLoading,
    loadingSeconds,
    error,
    latestCode,
    inputValue,
    onClose,
    onSend,
    onApplyCode,
    onClearHistory,
    onInputChange,
    onInputKeyDown
}) => {
    const intl = useIntl();
    const chatHistoryRef = useRef(null);
    const inputRef = useRef(null);

    // Initial position: centered within the capped stage area
    const [defaultPosition] = useState(() => {
        const stageWidth = Math.min(window.innerWidth, MAX_STAGE_WIDTH);
        const stageHeight = Math.min(window.innerHeight - MENU_BAR_HEIGHT, MAX_STAGE_HEIGHT);
        const x = Math.max(0, ((stageWidth - MODAL_WIDTH) / 2));
        const y = Math.max(0, MENU_BAR_HEIGHT + ((stageHeight - MODAL_HEIGHT) / 2));
        return {x, y};
    });

    // Auto-scroll to bottom of chat history when new messages arrive
    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [history, isLoading]);

    // Focus input when modal opens
    useEffect(() => {
        if (isVisible && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <div className={styles.overlay}>
            <Draggable
                defaultPosition={defaultPosition}
                handle={`.${styles.modalHeader}`}
                bounds="parent"
            >
                <div className={styles.modalContainer}>
                    {/* Header - drag handle, matches debug-modal style */}
                    <div className={styles.modalHeader}>
                        <div className={styles.headerTitle}>
                            <img
                                className={styles.aiIcon}
                                src={iconAI}
                                alt=""
                            />
                            {intl.formatMessage(messages.title)}
                        </div>
                        <button
                            className={styles.closeButton}
                            onClick={onClose}
                        >
                            <img
                                className={styles.closeIcon}
                                src={closeIcon}
                                alt=""
                            />
                        </button>
                    </div>

                    {/* Body */}
                    <div className={styles.modalContent}>
                        {/* Chat history */}
                        <div
                            className={styles.chatHistory}
                            ref={chatHistoryRef}
                        >
                            {history.length === 0 ? (
                                <div className={styles.emptyHistory}>
                                    {intl.formatMessage(messages.emptyHistory)}
                                </div>
                            ) : (
                                history.map((msg, index) => (
                                    <div
                                        key={index}
                                        className={`${styles.chatMessage} ${
                                            msg.role === 'user' ?
                                                styles.chatMessageUser :
                                                styles.chatMessageModel
                                        }`}
                                    >
                                        <span className={styles.chatLabel}>
                                            {msg.role === 'user' ?
                                                intl.formatMessage(messages.you) :
                                                intl.formatMessage(messages.gemini)
                                            }
                                        </span>
                                        <div
                                            className={`${styles.chatBubble} ${
                                                msg.role === 'user' ?
                                                    styles.chatBubbleUser :
                                                    styles.chatBubbleModel
                                            }`}
                                        >
                                            {msg.role === 'model' ?
                                                msg.text.replace(/```ruby[\s\S]*?```/g, '[Rubyコード]') :
                                                msg.text
                                            }
                                        </div>
                                    </div>
                                ))
                            )}
                            {isLoading && (
                                <div className={styles.loadingIndicator}>
                                    <span className={styles.loadingSpinner} />
                                    {intl.formatMessage(messages.thinking, {seconds: loadingSeconds})}
                                </div>
                            )}
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className={styles.errorMessage}>
                                {error}
                            </div>
                        )}

                        {/* Generated code preview */}
                        {latestCode && (
                            <div className={styles.codePreviewSection}>
                                <div className={styles.codePreviewHeader}>
                                    <span>{intl.formatMessage(messages.generatedCode)}</span>
                                    <button
                                        className={styles.applyButton}
                                        onClick={onApplyCode}
                                    >
                                        {intl.formatMessage(messages.applyCode)}
                                    </button>
                                </div>
                                <pre className={styles.codePreview}>{latestCode}</pre>
                            </div>
                        )}

                        {/* Input area */}
                        <div className={styles.inputArea}>
                            <textarea
                                ref={inputRef}
                                className={styles.messageInput}
                                placeholder={intl.formatMessage(messages.inputPlaceholder)}
                                value={inputValue}
                                onChange={onInputChange}
                                onKeyDown={onInputKeyDown}
                                disabled={isLoading}
                                rows={2}
                            />
                            <button
                                className={styles.sendButton}
                                onClick={onSend}
                                disabled={isLoading || !inputValue.trim()}
                            >
                                {intl.formatMessage(messages.send)}
                            </button>
                        </div>

                        {/* Footer */}
                        <div className={styles.footer}>
                            <button
                                className={styles.clearButton}
                                onClick={onClearHistory}
                                disabled={isLoading}
                            >
                                {intl.formatMessage(messages.clearHistory)}
                            </button>
                        </div>
                    </div>
                </div>
            </Draggable>
        </div>
    );
};

GeminiModal.propTypes = {
    isVisible: PropTypes.bool.isRequired,
    history: PropTypes.arrayOf(PropTypes.shape({
        role: PropTypes.oneOf(['user', 'model']).isRequired,
        text: PropTypes.string.isRequired
    })).isRequired,
    isLoading: PropTypes.bool.isRequired,
    loadingSeconds: PropTypes.number,
    error: PropTypes.string,
    latestCode: PropTypes.string,
    inputValue: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    onSend: PropTypes.func.isRequired,
    onApplyCode: PropTypes.func.isRequired,
    onClearHistory: PropTypes.func.isRequired,
    onInputChange: PropTypes.func.isRequired,
    onInputKeyDown: PropTypes.func.isRequired
};

GeminiModal.defaultProps = {
    loadingSeconds: 0,
    error: null,
    latestCode: null
};

export default GeminiModal;
