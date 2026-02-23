import React, {useRef, useEffect, useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import {defineMessages, useIntl} from 'react-intl';
import {marked} from 'marked';
import hljs from 'highlight.js/lib/core';
import rubyLang from 'highlight.js/lib/languages/ruby';
import styles from './gemini-modal.css';

import closeIcon from '../debug-modal/icons/icon--close.svg';
import iconAI from '../ruby-toolbar/icon--ai.svg';
import iconSurprise from '../action-menu/icon--surprise.svg';

// Register only Ruby language for highlight.js (keep bundle small)
hljs.registerLanguage('ruby', rubyLang);

const MODAL_WIDTH = 560;
const MODAL_HEIGHT = 520;
const MENU_BAR_HEIGHT = 48;
const MAX_STAGE_WIDTH = 1280;
const MAX_STAGE_HEIGHT = 600;

// Preset prompts for the surprise button
const SURPRISE_PROMPTS = [
    'ネコがマウスを追いかける',
    'スーパースピン、画面を動き回りながら回転しまくる',
    'キーボードの矢印キーでキャラクターを操作する',
    '壁に当たったら跳ね返るボールを作る',
    'クリックするたびにどんどん大きくなる',
    'コスチュームをどんどん切り替えてアニメーションする',
    'スコアをカウントしながらネコをよける',
    'タイマーが 0 になるまでにゴールを目指す',
    'マウスから逃げ回る恐怖のゴースト',
    'ランダムな場所に現れる星を集めるゲーム'
];

const messages = defineMessages({
    title: {
        id: 'gui.geminiModal.title',
        defaultMessage: 'Smalruby Teacher (Gemini)',
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
    applyCode: {
        id: 'gui.geminiModal.applyCode',
        defaultMessage: 'Apply code',
        description: 'Button to apply generated code to editor'
    },
    emptyHistory: {
        id: 'gui.geminiModal.emptyHistory',
        defaultMessage: "Let's have fun programming together with Smalruby Teacher! Tell me what you want to create!",
        description: 'Placeholder shown when chat history is empty'
    },
    you: {
        id: 'gui.geminiModal.you',
        defaultMessage: 'You',
        description: 'Label for user messages'
    },
    gemini: {
        id: 'gui.geminiModal.gemini',
        defaultMessage: 'Smalruby Teacher',
        description: 'Label for Gemini messages'
    },
    surprise: {
        id: 'gui.geminiModal.surprise',
        defaultMessage: 'Surprise me!',
        description: 'Tooltip for surprise prompt button'
    }
});

// Configure marked: disable HTML embedding and external links
const markedOptions = {
    breaks: true,
    gfm: true
};

/**
 * Render Gemini model response as safe Markdown HTML with syntax highlighting.
 * Strips raw HTML, disables external links, and applies highlight.js to code blocks.
 * @param {string} text - Raw markdown text from Gemini
 * @returns {string} Safe HTML string
 */
const renderMarkdown = text => {
    // Custom renderer: disable links, highlight Ruby code blocks
    const renderer = new marked.Renderer();

    // Disable external links - render as plain text
    renderer.link = (_href, _title, linkText) => linkText;

    // Disable raw HTML in output
    renderer.html = () => '';

    // Code block with syntax highlighting
    renderer.code = (code, language) => {
        const lang = language && hljs.getLanguage(language) ? language : null;
        const highlighted = lang ?
            hljs.highlight(code, {language: lang}).value :
            hljs.highlightAuto(code).value;
        return `<pre class="hljs-pre"><code class="hljs">${highlighted}</code></pre>`;
    };

    marked.use({renderer, ...markedOptions});
    return marked.parse(text);
};

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

    // Surprise button: pick a random preset prompt
    const handleSurprise = useCallback(() => {
        const randomPrompt = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
        // Simulate an onChange event to update the input
        onInputChange({target: {value: randomPrompt}});
    }, [onInputChange]);

    if (!isVisible) return null;

    // Find whether the last message in history has code (for Apply button)
    const hasLatestCode = Boolean(latestCode);

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
                                history.map((msg, index) => {
                                    const isLastModel = msg.role === 'model' && index === history.length - 1;
                                    return (
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
                                            {msg.role === 'user' ? (
                                                <div className={styles.chatBubbleUser}>
                                                    {msg.text}
                                                </div>
                                            ) : (
                                                <div className={styles.chatBubbleModel}>
                                                    <div
                                                        className={styles.markdownContent}
                                                        /* eslint-disable-next-line react/no-danger */
                                                        dangerouslySetInnerHTML={{
                                                            __html: renderMarkdown(msg.text)
                                                        }}
                                                    />
                                                    {isLastModel && hasLatestCode && !isLoading && (
                                                        <div className={styles.applyButtonContainer}>
                                                            <button
                                                                className={styles.applyButton}
                                                                onClick={onApplyCode}
                                                            >
                                                                {intl.formatMessage(messages.applyCode)}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
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

                        {/* Input area */}
                        <div className={styles.inputArea}>
                            <button
                                className={styles.surpriseButton}
                                onClick={handleSurprise}
                                disabled={isLoading}
                                title={intl.formatMessage(messages.surprise)}
                            >
                                <img
                                    className={styles.surpriseIcon}
                                    src={iconSurprise}
                                    alt={intl.formatMessage(messages.surprise)}
                                />
                            </button>
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
