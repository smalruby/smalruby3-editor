/**
 * Class settings: generative AI and Rubytee (issue #1277). The teacher picks a
 * generative AI in 3 steps — 1 use it? → 2 which? → 3 check the conditions —
 * and the parent settings form saves it together with the other fields.
 * Collapsed by default so the settings form still fits the 1300×600 class PC.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { GENAI_DEFAULT_URLS, validateGenaiUrl } from '../../lib/classroom-genai-settings.js';

import styles from './class-ai-settings.css';

// The condition lines follow each service's terms (checked for #1277; sources
// are listed in the PR). Claude is shown only to explain why it can't be chosen.
const messages = defineMessages({
    gemini: {
        defaultMessage: 'Gemini (Google)',
        description: 'Name of the Gemini generative AI in the class settings',
        id: 'gui.classroom.classAi.service.gemini',
    },
    geminiCondition: {
        defaultMessage:
            "Used with the school's Google account. The school (or local board of education) must allow students to use it.",
        description: 'Conditions for using Gemini in a class',
        id: 'gui.classroom.classAi.service.geminiCondition',
    },
    chatgpt: {
        defaultMessage: 'ChatGPT (OpenAI)',
        description: 'Name of the ChatGPT generative AI in the class settings',
        id: 'gui.classroom.classAi.service.chatgpt',
    },
    chatgptCondition: {
        defaultMessage: "Ages 13 and up. Students under 18 need a parent's or guardian's permission.",
        description: 'Conditions for using ChatGPT in a class',
        id: 'gui.classroom.classAi.service.chatgptCondition',
    },
    other: {
        defaultMessage: 'Another generative AI chosen by the school',
        description: 'Name of the free-URL generative AI option in the class settings',
        id: 'gui.classroom.classAi.service.other',
    },
    otherCondition: {
        defaultMessage: 'Enter its URL. Check its terms of use at your school.',
        description: 'Conditions for using another generative AI in a class',
        id: 'gui.classroom.classAi.service.otherCondition',
    },
    claude: {
        defaultMessage: 'Claude (Anthropic)',
        description: 'Name of the Claude generative AI, which cannot be chosen',
        id: 'gui.classroom.classAi.service.claude',
    },
    claudeCondition: {
        defaultMessage: "Can't be chosen: it is only for ages 18 and up.",
        description: 'Why Claude cannot be chosen for a class',
        id: 'gui.classroom.classAi.service.claudeCondition',
    },
    urlRequired: {
        defaultMessage: 'Enter the URL.',
        description: 'Error when the generative AI URL is empty',
        id: 'gui.classroom.classAi.urlError.required',
    },
    urlHttps: {
        defaultMessage: 'Enter a URL that starts with https://.',
        description: 'Error when the generative AI URL is not https',
        id: 'gui.classroom.classAi.urlError.https',
    },
    urlAdultOnly: {
        defaultMessage: "This service is only for ages 18 and up, so it can't be used.",
        description: 'Error when the generative AI URL points to an 18+ service',
        id: 'gui.classroom.classAi.urlError.adultOnly',
    },
});

const SERVICES = [
    { key: 'gemini', name: messages.gemini, condition: messages.geminiCondition },
    { key: 'chatgpt', name: messages.chatgpt, condition: messages.chatgptCondition },
    { key: 'other', name: messages.other, condition: messages.otherCondition },
    { key: 'claude', name: messages.claude, condition: messages.claudeCondition, disabled: true },
];

const serviceOf = (key) => SERVICES.find((s) => s.key === key);

const URL_ERRORS = {
    required: messages.urlRequired,
    https: messages.urlHttps,
    adultOnly: messages.urlAdultOnly,
};

const STEP_USE = 1;
const STEP_SERVICE = 2;
const STEP_CONFIRM = 3;

const RubyteeOption = ({ checked, isLoading, onToggle }) => (
    <label className={styles.rubytee}>
        <input
            checked={checked}
            className={styles.checkbox}
            data-testid="classroom-class-ai-rubytee"
            disabled={isLoading}
            type="checkbox"
            onChange={onToggle}
        />
        <span>
            <FormattedMessage
                defaultMessage="Also use Rubytee (Smalruby's generative AI)"
                description="Checkbox that enables Rubytee for a class"
                id="gui.classroom.classAi.rubytee"
            />
            <span className={styles.note}>
                <FormattedMessage
                    defaultMessage="When off, students can't use the AI button in the Ruby tab either."
                    description="Explains what turning Rubytee off means for students"
                    id="gui.classroom.classAi.rubyteeNote"
                />
            </span>
        </span>
    </label>
);

RubyteeOption.propTypes = {
    checked: PropTypes.bool.isRequired,
    isLoading: PropTypes.bool,
    onToggle: PropTypes.func.isRequired,
};

const ClassAiSettings = ({ draft, isLoading, onChange }) => {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(draft.use && draft.service ? STEP_CONFIRM : STEP_USE);

    const update = useCallback((changes) => onChange({ ...draft, ...changes }), [draft, onChange]);

    const handleToggleOpen = useCallback(() => setOpen((prev) => !prev), []);
    const handleStepTab = useCallback((e) => setStep(Number(e.currentTarget.dataset.step)), []);
    const handleUseNo = useCallback(() => update({ use: false }), [update]);
    const handleUseYes = useCallback(() => {
        update({ use: true });
        setStep(draft.service ? STEP_CONFIRM : STEP_SERVICE);
    }, [update, draft.service]);
    const handleService = useCallback(
        (e) => {
            const service = e.currentTarget.dataset.service;
            if (service === draft.service) {
                update({ use: true });
            } else {
                // The confirmation was about the previous service's terms.
                update({ use: true, service, url: GENAI_DEFAULT_URLS[service], confirmed: false });
            }
            setStep(STEP_CONFIRM);
        },
        [update, draft.service],
    );
    const handleConfirm = useCallback((e) => update({ confirmed: e.target.checked }), [update]);
    const handleUrl = useCallback((e) => update({ url: e.target.value }), [update]);
    const handleRubytee = useCallback((e) => update({ rubytee: e.target.checked }), [update]);

    const selected = draft.use ? serviceOf(draft.service) : null;
    const urlError = validateGenaiUrl(draft.url);
    const canReach = {
        [STEP_USE]: true,
        [STEP_SERVICE]: draft.use,
        [STEP_CONFIRM]: draft.use && Boolean(draft.service),
    };

    const summary = (
        <span className={styles.summary} data-testid="classroom-class-ai-summary">
            {selected ? (
                <FormattedMessage
                    defaultMessage="Generative AI: {service}"
                    description="Class settings summary when a generative AI is used"
                    id="gui.classroom.classAi.summaryUsed"
                    values={{ service: intl.formatMessage(selected.name) }}
                />
            ) : (
                <FormattedMessage
                    defaultMessage="Generative AI: Not used"
                    description="Class settings summary when no generative AI is used"
                    id="gui.classroom.classAi.summaryNotUsed"
                />
            )}
            {' / '}
            {draft.rubytee ? (
                <FormattedMessage
                    defaultMessage="Rubytee: On"
                    description="Class settings summary when Rubytee is on"
                    id="gui.classroom.classAi.summaryRubyteeOn"
                />
            ) : (
                <FormattedMessage
                    defaultMessage="Rubytee: Off"
                    description="Class settings summary when Rubytee is off"
                    id="gui.classroom.classAi.summaryRubyteeOff"
                />
            )}
        </span>
    );

    const stepTabs = [
        {
            step: STEP_USE,
            key: 'use',
            label: (
                <FormattedMessage
                    defaultMessage="1 Use it?"
                    description="Step 1 of the generative AI settings"
                    id="gui.classroom.classAi.stepUse"
                />
            ),
        },
        {
            step: STEP_SERVICE,
            key: 'service',
            label: (
                <FormattedMessage
                    defaultMessage="2 Which?"
                    description="Step 2 of the generative AI settings"
                    id="gui.classroom.classAi.stepService"
                />
            ),
        },
        {
            step: STEP_CONFIRM,
            key: 'confirm',
            label: (
                <FormattedMessage
                    defaultMessage="3 Check"
                    description="Step 3 of the generative AI settings"
                    id="gui.classroom.classAi.stepConfirm"
                />
            ),
        },
    ];

    return (
        <div className={styles.section} data-testid="classroom-class-ai-settings">
            <div className={styles.header}>
                {summary}
                <button
                    className={styles.linkButton}
                    data-testid="classroom-class-ai-edit"
                    disabled={isLoading}
                    type="button"
                    onClick={handleToggleOpen}
                >
                    {open ? (
                        <FormattedMessage
                            defaultMessage="Close"
                            description="Button that collapses the generative AI settings"
                            id="gui.classroom.classAi.close"
                        />
                    ) : (
                        <FormattedMessage
                            defaultMessage="Change"
                            description="Button that opens the generative AI settings"
                            id="gui.classroom.classAi.edit"
                        />
                    )}
                </button>
            </div>
            {open ? (
                <div className={styles.body}>
                    <div className={styles.steps}>
                        {stepTabs.map((tab) => (
                            <button
                                key={tab.key}
                                className={tab.step === step ? styles.stepActive : styles.step}
                                data-step={tab.step}
                                data-testid={`classroom-class-ai-step-tab-${tab.key}`}
                                disabled={isLoading || !canReach[tab.step]}
                                type="button"
                                onClick={handleStepTab}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {step === STEP_USE ? (
                        <div data-testid="classroom-class-ai-step-use">
                            <p className={styles.question}>
                                <FormattedMessage
                                    defaultMessage="Let students consult a generative AI in this class?"
                                    description="Question of step 1 of the generative AI settings"
                                    id="gui.classroom.classAi.useQuestion"
                                />
                            </p>
                            <div className={styles.choices}>
                                <button
                                    className={draft.use ? styles.choice : styles.choiceSelected}
                                    data-testid="classroom-class-ai-use-no"
                                    disabled={isLoading}
                                    type="button"
                                    onClick={handleUseNo}
                                >
                                    <FormattedMessage
                                        defaultMessage="Don't use"
                                        description="Choice to not use a generative AI in the class"
                                        id="gui.classroom.classAi.useNo"
                                    />
                                </button>
                                <button
                                    className={draft.use ? styles.choiceSelected : styles.choice}
                                    data-testid="classroom-class-ai-use-yes"
                                    disabled={isLoading}
                                    type="button"
                                    onClick={handleUseYes}
                                >
                                    <FormattedMessage
                                        defaultMessage="Use"
                                        description="Choice to use a generative AI in the class"
                                        id="gui.classroom.classAi.useYes"
                                    />
                                </button>
                            </div>
                            {draft.use ? null : (
                                <RubyteeOption
                                    checked={draft.rubytee}
                                    isLoading={isLoading}
                                    onToggle={handleRubytee}
                                />
                            )}
                        </div>
                    ) : null}

                    {step === STEP_SERVICE ? (
                        <div className={styles.services} data-testid="classroom-class-ai-step-service">
                            {SERVICES.map((service) => (
                                <button
                                    key={service.key}
                                    className={
                                        draft.service === service.key ? styles.serviceSelected : styles.service
                                    }
                                    data-service={service.key}
                                    data-testid={`classroom-class-ai-service-${service.key}`}
                                    disabled={isLoading || service.disabled}
                                    type="button"
                                    onClick={handleService}
                                >
                                    <span className={styles.serviceName}>{intl.formatMessage(service.name)}</span>
                                    <span className={styles.note}>{intl.formatMessage(service.condition)}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {step === STEP_CONFIRM && selected ? (
                        <div data-testid="classroom-class-ai-step-confirm">
                            <p className={styles.question}>
                                <FormattedMessage
                                    defaultMessage="Conditions for {service}"
                                    description="Heading of step 3 of the generative AI settings"
                                    id="gui.classroom.classAi.confirmHeading"
                                    values={{ service: intl.formatMessage(selected.name) }}
                                />
                            </p>
                            <p className={styles.condition}>{intl.formatMessage(selected.condition)}</p>
                            <label className={styles.confirm}>
                                <input
                                    checked={draft.confirmed}
                                    className={styles.checkbox}
                                    data-testid="classroom-class-ai-confirm"
                                    disabled={isLoading}
                                    type="checkbox"
                                    onChange={handleConfirm}
                                />
                                <FormattedMessage
                                    defaultMessage="This class meets the conditions above (required)"
                                    description="Required checkbox confirming the class meets the AI's terms"
                                    id="gui.classroom.classAi.confirm"
                                />
                            </label>
                            {draft.confirmed ? null : (
                                <p className={styles.warning} data-testid="classroom-class-ai-not-confirmed">
                                    <FormattedMessage
                                        defaultMessage="Check the box to turn on generative AI."
                                        description="Hint that the conditions checkbox is required"
                                        id="gui.classroom.classAi.notConfirmed"
                                    />
                                </p>
                            )}
                            <label className={styles.urlLabel}>
                                <span>
                                    <FormattedMessage
                                        defaultMessage="Page students open"
                                        description="Label of the generative AI URL input"
                                        id="gui.classroom.classAi.urlLabel"
                                    />
                                    {draft.service === 'other' ? null : (
                                        <span className={styles.note}>
                                            <FormattedMessage
                                                defaultMessage="(you can leave it as is)"
                                                description="Hint that the default generative AI URL is fine"
                                                id="gui.classroom.classAi.urlDefaultNote"
                                            />
                                        </span>
                                    )}
                                </span>
                                <span className={styles.urlRow}>
                                    <input
                                        className={styles.urlInput}
                                        data-testid="classroom-class-ai-url"
                                        disabled={isLoading}
                                        maxLength={2048}
                                        placeholder="https://"
                                        type="url"
                                        value={draft.url}
                                        onChange={handleUrl}
                                    />
                                    {urlError ? null : (
                                        <a
                                            className={styles.tryLink}
                                            data-testid="classroom-class-ai-try"
                                            href={draft.url.trim()}
                                            rel="noopener noreferrer"
                                            target="_blank"
                                        >
                                            <FormattedMessage
                                                defaultMessage="Try (new tab)"
                                                description="Link that opens the generative AI page in a new tab"
                                                id="gui.classroom.classAi.try"
                                            />
                                        </a>
                                    )}
                                </span>
                            </label>
                            {urlError ? (
                                <p className={styles.warning} data-testid="classroom-class-ai-url-error">
                                    {intl.formatMessage(URL_ERRORS[urlError])}
                                </p>
                            ) : null}
                            <RubyteeOption checked={draft.rubytee} isLoading={isLoading} onToggle={handleRubytee} />
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

ClassAiSettings.propTypes = {
    draft: PropTypes.shape({
        use: PropTypes.bool.isRequired,
        service: PropTypes.string,
        url: PropTypes.string.isRequired,
        confirmed: PropTypes.bool.isRequired,
        rubytee: PropTypes.bool.isRequired,
    }).isRequired,
    isLoading: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
};

export default ClassAiSettings;
