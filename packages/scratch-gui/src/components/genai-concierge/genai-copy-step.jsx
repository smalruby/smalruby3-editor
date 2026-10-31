// Step 2: the student reads (and may edit) the question, then copies it into the
// generative AI the class uses. A question too long for the AI is split into parts.
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { DEV_GENAI_SERVICES } from '../../lib/genai-concierge-state.js';
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

const GenaiCopyStep = ({
    serviceName,
    canChangeService,
    prompt,
    parts,
    copied,
    notice,
    aiOpened,
    onChooseService,
    onChangeService,
    onPromptChange,
    onCopy,
    onReopen,
    onSplit,
    onBack,
    onNext,
}) => {
    const partList = splitPrompt(prompt, parts);
    const ready = Boolean(serviceName);

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

    return (
        <>
            {!serviceName && <DevServicePicker onChoose={onChooseService} />}
            {serviceName && (
                <p className={styles.small} data-testid="genai-service-name">
                    <FormattedMessage {...messages.serviceCurrent} values={{ name: serviceName }} />{' '}
                    {canChangeService && (
                        <a href="#" data-testid="genai-service-change" onClick={handleChangeService}>
                            <FormattedMessage {...messages.serviceChange} />
                        </a>
                    )}
                </p>
            )}
            {parts === 1 ? (
                <>
                    <p className={styles.label}>
                        <FormattedMessage {...messages.promptLabel} />
                    </p>
                    <textarea
                        className={styles.prompt}
                        data-testid="genai-prompt"
                        value={prompt}
                        onChange={handlePromptChange}
                    />
                    <div className={styles.row}>
                        <button
                            className={styles.primary}
                            data-testid="genai-copy-open"
                            disabled={!ready}
                            onClick={handleCopyPrompt}
                        >
                            <FormattedMessage {...(aiOpened ? messages.copyOnly : messages.copyOpen)} />
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className={styles.label}>
                        <FormattedMessage {...messages.partsLabel} values={{ count: parts }} />
                    </p>
                    {partList.map((part, i) => (
                        <div key={i} className={styles.partRow}>
                            <button
                                className={copied[i] ? '' : styles.primary}
                                data-testid={`genai-copy-part-${i + 1}`}
                                disabled={!ready}
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
                </>
            )}
            <p className={styles.small}>
                <FormattedMessage {...messages.charCount} values={{ count: prompt.length }} />{' '}
                <a href="#" data-testid="genai-split" onClick={handleSplit}>
                    <FormattedMessage {...messages.split} />
                </a>
            </p>
            {notice && (
                <p className={styles.notice} data-testid="genai-notice">
                    {notice}
                </p>
            )}
            {aiOpened && (
                <p className={styles.small}>
                    <a href="#" data-testid="genai-reopen" onClick={handleReopen}>
                        <FormattedMessage {...messages.reopen} />
                    </a>
                </p>
            )}
            <div className={styles.row}>
                <button onClick={onBack}>
                    <FormattedMessage {...messages.back} />
                </button>
                <button className={styles.primary} data-testid="genai-to-paste" onClick={onNext}>
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
    onChooseService: PropTypes.func.isRequired,
    onChangeService: PropTypes.func.isRequired,
    onPromptChange: PropTypes.func.isRequired,
    onCopy: PropTypes.func.isRequired,
    onReopen: PropTypes.func.isRequired,
    onSplit: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
};

export default GenaiCopyStep;
