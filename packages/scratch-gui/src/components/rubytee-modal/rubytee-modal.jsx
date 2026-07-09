import React, {useRef, useEffect, useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import {defineMessages, useIntl} from 'react-intl';
import {marked} from 'marked';
import hljs from 'highlight.js/lib/core';
import rubyLang from 'highlight.js/lib/languages/ruby';
import styles from './rubytee-modal.css';

import closeIcon from '../debug-modal/icons/icon--close.svg';
import iconRubytee from '../ruby-toolbar/icon--rubytee.svg';
import iconSurprise from '../action-menu/icon--surprise.svg';

// Register only Ruby language for highlight.js (keep bundle small)
hljs.registerLanguage('ruby', rubyLang);

const MAX_USER_MESSAGE_LENGTH = parseInt(process.env.MAX_USER_MESSAGE_LENGTH || '250', 10);
const MIN_USER_MESSAGE_LENGTH = parseInt(process.env.MIN_USER_MESSAGE_LENGTH || '10', 10);

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
        id: 'gui.rubyteeModal.title',
        defaultMessage: 'Smalruby Teacher (Rubytee)',
        description: 'Title for the Rubytee AI assistant modal'
    },
    clearHistory: {
        id: 'gui.rubyteeModal.clearHistory',
        defaultMessage: 'Clear history',
        description: 'Clear chat history button label'
    },
    resetConsent: {
        id: 'gui.rubyteeModal.resetConsent',
        defaultMessage: 'Reset consent',
        description: 'Button to reset the consent agreement and close the modal'
    },
    inputPlaceholder: {
        id: 'gui.rubyteeModal.inputPlaceholder',
        defaultMessage: 'Tell me what you want to create (between {min} and {max} characters)...',
        description: 'Placeholder text for message input'
    },
    send: {
        id: 'gui.rubyteeModal.send',
        defaultMessage: 'Send',
        description: 'Send button label'
    },
    cancel: {
        id: 'gui.rubyteeModal.cancel',
        defaultMessage: 'Cancel',
        description: 'Cancel button label shown while Rubytee is generating'
    },
    thinking: {
        id: 'gui.rubyteeModal.thinking',
        defaultMessage: 'Rubytee is thinking... ({seconds}s)',
        description: 'Loading indicator text with elapsed seconds'
    },
    applyCode: {
        id: 'gui.rubyteeModal.applyCode',
        defaultMessage: 'Insert This Code',
        description: 'Button to apply generated code to editor'
    },
    applyCodeNote: {
        id: 'gui.rubyteeModal.applyCodeNote',
         
        defaultMessage: 'AI-generated programs may not always work correctly. When that happens, enjoy debugging — finding and fixing problems in your program!',
        description: 'Disclaimer note shown below the apply code button'
    },
    emptyHistory: {
        id: 'gui.rubyteeModal.emptyHistory',
        defaultMessage: "Let's have fun programming together with Smalruby Teacher! Tell me what you want to create!",
        description: 'Placeholder shown when chat history is empty'
    },
    you: {
        id: 'gui.rubyteeModal.you',
        defaultMessage: 'You',
        description: 'Label for user messages'
    },
    rubytee: {
        id: 'gui.rubyteeModal.rubytee',
        defaultMessage: 'Smalruby Teacher',
        description: 'Label for Rubytee messages'
    },
    surprise: {
        id: 'gui.rubyteeModal.surprise',
        defaultMessage: 'Surprise me!',
        description: 'Tooltip for surprise prompt button'
    }
});

// Configure marked: disable HTML embedding and external links
const markedOptions = {
    breaks: true,
    gfm: true
};

// Shared renderer for non-code markdown (no code block renderer needed)
const markdownRenderer = new marked.Renderer();
markdownRenderer.link = (_href, _title, linkText) => linkText;
markdownRenderer.html = () => '';
// Suppress fenced code blocks in non-code segments (they shouldn't appear)
markdownRenderer.code = (code, language) => {
    const lang = language && hljs.getLanguage(language) ? language : null;
    const highlighted = lang ?
        hljs.highlight(code, {language: lang}).value :
        hljs.highlightAuto(code).value;
    return `<pre class="hljs-pre"><code class="hljs">${highlighted}</code></pre>`;
};
marked.use({renderer: markdownRenderer, ...markedOptions});

/**
 * Render plain Markdown text (no code blocks) as safe HTML.
 * @param {string} text - Markdown text (without fenced code blocks)
 * @returns {string} Safe HTML string
 */
const renderMarkdownText = text => marked.parse(text);

/**
 * Split a Rubytee response into alternating text/code segments.
 * Returns an array like: [{type:'text', content:'...'}, {type:'code', content:'...'}, ...]
 * @param {string} text - Raw markdown text from Rubytee
 * @returns {Array<{type:string, content:string}>} Segments
 */
const splitIntoSegments = text => {
    const segments = [];
    // Match ```ruby ... ``` or ``` ... ```
    const pattern = /```(?:ruby)?[ \t]*\r?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match = pattern.exec(text);
    while (match !== null) {
        // Text before this code block
        if (match.index > lastIndex) {
            const textContent = text.slice(lastIndex, match.index);
            if (textContent.trim()) {
                segments.push({type: 'text', content: textContent});
            }
        }
        // Code block
        segments.push({type: 'code', content: match[1].trim()});
        lastIndex = match.index + match[0].length;
        match = pattern.exec(text);
    }
    // Remaining text after last code block
    if (lastIndex < text.length) {
        const textContent = text.slice(lastIndex);
        if (textContent.trim()) {
            segments.push({type: 'text', content: textContent});
        }
    }
    return segments;
};

/**
 * Renders one model (Rubytee) response bubble with per-code-block apply buttons.
 * @param {object} props - Component props
 * @param {string} props.text - Raw markdown text from Rubytee
 * @param {boolean} props.isLast - Whether this is the last model message
 * @param {boolean} props.isLoading - Whether a request is in progress
 * @param {string[]} props.latestCodes - Code blocks extracted from the last response
 * @param {Function} props.onApplyCode - Click handler for apply button (reads data-index)
 * @param {string} props.applyLabel - Translated label for the apply button
 * @param {string} props.applyNoteLabel - Translated disclaimer note text
 */
const ModelMessageContent = ({text, isLast, isLoading, latestCodes, onApplyCode, applyLabel, applyNoteLabel}) => {
    const segments = splitIntoSegments(text);
    let codeIndex = 0;
    return segments.map((seg, segIdx) => {
        if (seg.type === 'text') {
            return (
                <div
                    key={segIdx}
                    className={styles.markdownContent}
                    /* eslint-disable-next-line react/no-danger */
                    dangerouslySetInnerHTML={{__html: renderMarkdownText(seg.content)}}
                />
            );
        }
        // Code segment
        const highlighted = hljs.highlight(seg.content, {language: 'ruby'}).value;
        const currentCodeIndex = codeIndex;
        codeIndex++;
        const showButton = isLast && !isLoading && latestCodes[currentCodeIndex] === seg.content;
        return (
            <div key={segIdx}>
                {/* eslint-disable react/no-danger */}
                <pre className={styles.codeBlock}>
                    <code
                        className="hljs"
                        dangerouslySetInnerHTML={{__html: highlighted}}
                    />
                </pre>
                {/* eslint-enable react/no-danger */}
                {showButton && (
                    <div className={styles.applyButtonContainer}>
                        <button
                            className={styles.applyButton}
                            data-index={currentCodeIndex}
                            data-testid="rubytee-modal-apply-code"
                            onClick={onApplyCode}
                        >
                            {applyLabel}
                        </button>
                        <p className={styles.applyCodeNote}>{applyNoteLabel}</p>
                    </div>
                )}
            </div>
        );
    });
};

ModelMessageContent.propTypes = {
    text: PropTypes.string.isRequired,
    isLast: PropTypes.bool.isRequired,
    isLoading: PropTypes.bool.isRequired,
    latestCodes: PropTypes.arrayOf(PropTypes.string).isRequired,
    onApplyCode: PropTypes.func.isRequired,
    applyLabel: PropTypes.string.isRequired,
    applyNoteLabel: PropTypes.string.isRequired
};

const RubyteeModal = ({
    isVisible,
    history,
    isLoading,
    loadingSeconds,
    error,
    latestCodes,
    inputValue,
    onClose,
    onSend,
    onCancel,
    onApplyCode,
    onClearHistory,
    onInputChange,
    onInputKeyDown,
    onResetConsent
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

    // No auto-scroll: user reads from top, so don't jump to bottom on new messages

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

    // Apply code button: read code index from data-index attribute to avoid arrow function in JSX
    const handleApplyCodeClick = useCallback(e => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        onApplyCode(idx);
    }, [onApplyCode]);

    if (!isVisible) return null;

    const inputLen = inputValue.length;
    const isLengthValid = inputLen >= MIN_USER_MESSAGE_LENGTH && inputLen <= MAX_USER_MESSAGE_LENGTH;

    return (
        <div className={styles.overlay}>
            <Draggable
                defaultPosition={defaultPosition}
                handle={`.${styles.modalHeader}`}
                bounds="parent"
            >
                <div
                    className={styles.modalContainer}
                    data-testid="rubytee-modal"
                >
                    {/* Header - drag handle, matches debug-modal style */}
                    <div className={styles.modalHeader}>
                        <div className={styles.headerTitle}>
                            <img
                                className={styles.aiIcon}
                                src={iconRubytee}
                                alt=""
                            />
                            {intl.formatMessage(messages.title)}
                        </div>
                        <button
                            className={styles.closeButton}
                            data-testid="rubytee-modal-close"
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
                            data-testid="rubytee-modal-history"
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
                                            data-testid={msg.role === 'user' ?
                                                'rubytee-modal-message-user' :
                                                'rubytee-modal-message-model'}
                                        >
                                            <span className={styles.chatLabel}>
                                                {msg.role === 'user' ?
                                                    intl.formatMessage(messages.you) : (
                                                        <React.Fragment>
                                                            <img
                                                                className={styles.chatLabelIcon}
                                                                src={iconRubytee}
                                                                alt=""
                                                            />
                                                            {intl.formatMessage(messages.rubytee)}
                                                        </React.Fragment>
                                                    )
                                                }
                                            </span>
                                            {msg.role === 'user' ? (
                                                <div className={styles.chatBubbleUser}>
                                                    {msg.text}
                                                </div>
                                            ) : (
                                                <div className={styles.chatBubbleModel}>
                                                    <ModelMessageContent
                                                        text={msg.text}
                                                        isLast={isLastModel}
                                                        isLoading={isLoading}
                                                        latestCodes={latestCodes}
                                                        onApplyCode={handleApplyCodeClick}
                                                        applyLabel={intl.formatMessage(messages.applyCode)}
                                                        applyNoteLabel={intl.formatMessage(messages.applyCodeNote)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                            {isLoading && (
                                <div
                                    className={styles.loadingIndicator}
                                    data-testid="rubytee-modal-loading"
                                >
                                    <span className={styles.loadingSpinner} />
                                    {intl.formatMessage(messages.thinking, {seconds: loadingSeconds})}
                                </div>
                            )}
                        </div>

                        {/* Error message */}
                        {error && (
                            <div
                                className={styles.errorMessage}
                                data-testid="rubytee-modal-error"
                            >
                                {error}
                            </div>
                        )}

                        {/* Input area */}
                        <div className={styles.inputArea}>
                            <button
                                className={styles.surpriseButton}
                                data-testid="rubytee-modal-surprise"
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
                                data-testid="rubytee-modal-input"
                                placeholder={intl.formatMessage(messages.inputPlaceholder, {
                                    min: MIN_USER_MESSAGE_LENGTH,
                                    max: MAX_USER_MESSAGE_LENGTH
                                })}
                                value={inputValue}
                                onChange={onInputChange}
                                onKeyDown={onInputKeyDown}
                                rows={2}
                            />
                            <div className={styles.sendArea}>
                                {isLoading ? (
                                    <button
                                        className={styles.sendButton}
                                        data-testid="rubytee-modal-cancel"
                                        onClick={onCancel}
                                    >
                                        {intl.formatMessage(messages.cancel)}
                                    </button>
                                ) : (
                                    <button
                                        className={styles.sendButton}
                                        data-testid="rubytee-modal-send"
                                        onClick={onSend}
                                        disabled={!isLengthValid}
                                    >
                                        {intl.formatMessage(messages.send)}
                                    </button>
                                )}
                                <span
                                    className={`${styles.charCounter} ${
                                        isLengthValid ? styles.charCounterValid : styles.charCounterInvalid
                                    }`}
                                    data-testid="rubytee-modal-char-counter"
                                >
                                    {inputLen} / {MAX_USER_MESSAGE_LENGTH}
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={styles.footer}>
                            <div className={styles.footerLeft}>
                                {onResetConsent && (
                                    <a
                                        className={styles.resetConsentLink}
                                        data-testid="rubytee-modal-reset-consent"
                                        onClick={onResetConsent}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {intl.formatMessage(messages.resetConsent)}
                                    </a>
                                )}
                            </div>
                            <button
                                className={styles.clearButton}
                                data-testid="rubytee-modal-clear-history"
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

RubyteeModal.propTypes = {
    isVisible: PropTypes.bool.isRequired,
    history: PropTypes.arrayOf(PropTypes.shape({
        role: PropTypes.oneOf(['user', 'model']).isRequired,
        text: PropTypes.string.isRequired
    })).isRequired,
    isLoading: PropTypes.bool.isRequired,
    loadingSeconds: PropTypes.number,
    error: PropTypes.string,
    latestCodes: PropTypes.arrayOf(PropTypes.string),
    inputValue: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    onSend: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onApplyCode: PropTypes.func.isRequired,
    onClearHistory: PropTypes.func.isRequired,
    onInputChange: PropTypes.func.isRequired,
    onInputKeyDown: PropTypes.func.isRequired,
    onResetConsent: PropTypes.func
};

RubyteeModal.defaultProps = {
    loadingSeconds: 0,
    error: null,
    latestCodes: []
};

export default RubyteeModal;
