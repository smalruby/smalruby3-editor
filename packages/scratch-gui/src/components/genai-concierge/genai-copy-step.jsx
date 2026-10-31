// Step 2: the student copies the question into the generative AI the class uses.
// What to do is a checklist; the text of the question is folded away (#1293 G2)
// and opens to be read or edited. A question too long for the AI is split into parts.
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { DEV_GENAI_SERVICES, copyChecklist } from '../../lib/genai-concierge-state.js';
import { splitPrompt } from '../../lib/genai-prompt.js';
import styles from './genai-concierge.css';
import messages from './messages.js';

// Only with ?features=genai outside a class: the class normally decides the AI.
const DevServicePicker = ({ onChoose }) => {
    const intl = useIntl();
    const [customUrl, setCustomUrl] = useState('');
    const handleServiceClick = useCallback((e) => onChoose(e.currentTarget.dataset.service), [onChoose]);
    const handleCustomUrlChange = useCallback((e) => setCustomUrl(e.target.value), []);
    const handleCustom = useCallback(() => onChoose(customUrl), [onChoose, customUrl]);
    return (
        <div className={styles.service}>
            <p className={styles.label}>
                <FormattedMessage {...messages.serviceQuestion} />
            </p>
            <div className={styles.row}>
                {DEV_GENAI_SERVICES.map((s) => (
                    <button
                        key={s.id}
                        data-testid={`genai-service-${s.id}`}
                        data-service={s.id}
                        onClick={handleServiceClick}
                    >
                        {s.label}
                    </button>
                ))}
            </div>
            <div className={styles.row}>
                <input
                    className={styles.url}
                    data-testid="genai-service-url"
                    placeholder={intl.formatMessage(messages.serviceUrlPlaceholder)}
                    value={customUrl}
                    onChange={handleCustomUrlChange}
                />
                <button disabled={!customUrl.startsWith('https://')} onClick={handleCustom}>
                    <FormattedMessage {...messages.serviceUse} />
                </button>
            </div>
        </div>
    );
};

DevServicePicker.propTypes = {
    onChoose: PropTypes.func.isRequired,
};

const CHECK_MESSAGES = [messages.checkCopy, messages.checkPaste, messages.checkNext];

const GenaiCopyStep = ({
    serviceName,
    canChangeService,
    prompt,
    parts,
    copied,
    notice,
    aiOpened,
    promptOpen,
    onChooseService,
    onChangeService,
    onPromptChange,
    onTogglePrompt,
    onCopy,
    onReopen,
    onSplit,
    onBack,
    onNext,
}) => {
    const partList = splitPrompt(prompt, parts);
    const copiedCount = partList.filter((part, i) => copied[i]).length;
    const checks = copyChecklist({ copied: copiedCount > 0 });
    // One primary button at a time (#1293 P1): the next copy, then "next".
    const nextPart = partList.findIndex((part, i) => !copied[i]);
    const allCopied = nextPart === -1;

    const handlePromptChange = useCallback((e) => onPromptChange(e.target.value), [onPromptChange]);
    const handleCopyPrompt = useCallback(() => onCopy(prompt, 0), [onCopy, prompt]);
    const handleCopyPart = useCallback(
        (e) => {
            const index = Number(e.currentTarget.dataset.index);
            onCopy(splitPrompt(prompt, parts)[index], index);
        },
        [onCopy, prompt, parts],
    );
    const handleChangeService = useCallback(
        (e) => {
            e.preventDefault();
            onChangeService();
        },
        [onChangeService],
    );
    const handleSplit = useCallback(
        (e) => {
            e.preventDefault();
            onSplit();
        },
        [onSplit],
    );
    const handleReopen = useCallback(
        (e) => {
            e.preventDefault();
            onReopen();
        },
        [onReopen],
    );
    const handleTogglePrompt = useCallback(
        (e) => {
            e.preventDefault();
            onTogglePrompt();
        },
        [onTogglePrompt],
    );

    if (!serviceName) {
        return (
            <>
                <div className={styles.stepBody}>
                    <DevServicePicker onChoose={onChooseService} />
                </div>
                <div className={styles.footer}>
                    <button onClick={onBack}>
                        <FormattedMessage {...messages.back} />
                    </button>
                </div>
            </>
        );
    }

    const name = serviceName;
    return (
        <>
            <div className={styles.stepBody}>
                <p className={styles.question}>
                    <FormattedMessage {...messages.copyReady} values={{ name }} />
                </p>
                {/* Split, the list of parts is what to do: copy and send them one at a time. */}
                {parts === 1 && (
                    <ol className={styles.checklist} data-testid="genai-checklist">
                        {CHECK_MESSAGES.map((message, i) => (
                            <li key={message.id} className={styles[`check-${checks[i]}`]} data-status={checks[i]}>
                                <span className={styles.checkMark} aria-hidden="true">
                                    {checks[i] === 'done' ? '✓' : i + 1}
                                </span>
                                <FormattedMessage {...message} values={{ name }} />
                            </li>
                        ))}
                    </ol>
                )}
                {parts === 1 ? (
                    <div className={styles.row}>
                        <button
                            className={allCopied ? '' : styles.primary}
                            data-testid="genai-copy-open"
                            onClick={handleCopyPrompt}
                        >
                            {aiOpened ? (
                                <FormattedMessage {...messages.copyOnly} />
                            ) : (
                                <FormattedMessage {...messages.copyOpen} values={{ name }} />
                            )}
                        </button>
                    </div>
                ) : (
                    <>
                        <p className={styles.small}>
                            <FormattedMessage {...messages.partsLabel} values={{ count: parts }} />
                        </p>
                        <div className={styles.parts}>
                            {partList.map((part, i) => (
                                <div key={i} className={styles.partRow}>
                                    <button
                                        className={i === nextPart ? styles.primary : ''}
                                        data-testid={`genai-copy-part-${i + 1}`}
                                        data-index={i}
                                        onClick={handleCopyPart}
                                    >
                                        {copied[i] ? '✓ ' : ''}
                                        <FormattedMessage {...messages.copyPart} values={{ number: i + 1 }} />
                                    </button>
                                    <span className={styles.small}>
                                        <FormattedMessage {...messages.charCount} values={{ count: part.length }} />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                {notice && (
                    <p className={styles.notice} data-testid="genai-notice">
                        {notice}
                    </p>
                )}
                <p className={styles.small}>
                    <FormattedMessage {...messages.promptCount} values={{ count: prompt.length }} />{' '}
                    <a href="#" data-testid="genai-prompt-toggle" onClick={handleTogglePrompt}>
                        <FormattedMessage {...(promptOpen ? messages.promptHide : messages.promptShow)} />
                    </a>{' '}
                    <a href="#" data-testid="genai-split" onClick={handleSplit}>
                        <FormattedMessage {...messages.split} />
                    </a>
                </p>
                {promptOpen && (
                    <textarea
                        className={styles.prompt}
                        data-testid="genai-prompt"
                        value={prompt}
                        onChange={handlePromptChange}
                    />
                )}
                {(aiOpened || canChangeService) && (
                    <p className={styles.small}>
                        {aiOpened && (
                            <a href="#" data-testid="genai-reopen" onClick={handleReopen}>
                                <FormattedMessage {...messages.reopen} values={{ name }} />
                            </a>
                        )}{' '}
                        {canChangeService && (
                            <a href="#" data-testid="genai-service-change" onClick={handleChangeService}>
                                <FormattedMessage {...messages.serviceChange} />
                            </a>
                        )}
                    </p>
                )}
            </div>
            <div className={styles.footer}>
                <button onClick={onBack}>
                    <FormattedMessage {...messages.back} />
                </button>
                <button className={allCopied ? styles.primary : ''} data-testid="genai-to-paste" onClick={onNext}>
                    <FormattedMessage {...messages.toPaste} />
                </button>
            </div>
        </>
    );
};

GenaiCopyStep.propTypes = {
    serviceName: PropTypes.string,
    canChangeService: PropTypes.bool,
    prompt: PropTypes.string.isRequired,
    parts: PropTypes.number.isRequired,
    copied: PropTypes.objectOf(PropTypes.bool).isRequired,
    notice: PropTypes.string,
    aiOpened: PropTypes.bool,
    promptOpen: PropTypes.bool,
    onChooseService: PropTypes.func.isRequired,
    onChangeService: PropTypes.func.isRequired,
    onPromptChange: PropTypes.func.isRequired,
    onTogglePrompt: PropTypes.func.isRequired,
    onCopy: PropTypes.func.isRequired,
    onReopen: PropTypes.func.isRequired,
    onSplit: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
};

export default GenaiCopyStep;
