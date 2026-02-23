import React, {useRef, useEffect} from 'react';
import PropTypes from 'prop-types';
import {defineMessages, useIntl} from 'react-intl';
import Modal from '../../containers/modal.jsx';
import styles from './gemini-modal.css';

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

    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            onRequestClose={onClose}
        >
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
                    <button
                        className={styles.closeButton}
                        onClick={onClose}
                    >
                        {intl.formatMessage(messages.close)}
                    </button>
                </div>
            </div>
        </Modal>
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
