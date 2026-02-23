import React, {useRef, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import {defineMessages, useIntl} from 'react-intl';
import styles from './gemini-modal.css';

const MODAL_WIDTH = 360;
const MODAL_HEIGHT = 480;
const MENU_BAR_HEIGHT = 48;

const messages = defineMessages({
    title: {
        id: 'gui.geminiModal.title',
        defaultMessage: 'AI Assistant (Gemini)',
        description: 'Title for the Gemini AI assistant modal'
    },
    close: {
        id: 'gui.geminiModal.close',
        defaultMessage: 'Close',
        description: 'Close button label'
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
        defaultMessage: 'Gemini is thinking...',
        description: 'Loading indicator text'
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

    // Initial position: bottom-right area of the workspace
    const [defaultPosition] = useState(() => ({
        x: Math.max(0, window.innerWidth - MODAL_WIDTH - 20),
        y: Math.max(0, window.innerHeight - MODAL_HEIGHT - MENU_BAR_HEIGHT - 20)
    }));

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
                handle={`.${styles.header}`}
                bounds="parent"
            >
                <div className={styles.panel}>
                    {/* Draggable header */}
                    <div className={styles.header}>
                        <span className={styles.headerTitle}>
                            {intl.formatMessage(messages.title)}
                        </span>
                        <button
                            className={styles.headerCloseButton}
                            onClick={onClose}
                        >
                            {'✕'}
                        </button>
                    </div>

                    <div className={styles.body}>
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
                                    {intl.formatMessage(messages.thinking)}
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
                                rows={1}
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
    error: null,
    latestCode: null
};

export default GeminiModal;
