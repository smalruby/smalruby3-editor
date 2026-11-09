/**
 * Class settings: the AI used in the class (issue #1277, redesigned in #1290).
 * Two independent settings — the school's generative AI and Rubytee — each
 * saying what it changes on the students' screen (the settings form shows a
 * preview of that screen beside it). The parent form saves it together with
 * the other fields.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import {
    displayGenaiUrl,
    draftWithRubytee,
    draftWithService,
    validateGenaiUrl,
} from '../../lib/classroom-genai-settings.js';

import styles from './class-ai-settings.css';

// The condition lines follow each service's terms (checked for #1277; sources
// are listed in the PR). Claude is not offered: its terms are 18+.
const messages = defineMessages({
    none: {
        defaultMessage: "Don't use",
        description: 'Choice to not use a generative AI in the class',
        id: 'gui.classroom.classAi.service.none',
    },
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
        defaultMessage: 'Other',
        description: 'Name of the free-URL generative AI option (one the school chooses) in the class settings',
        id: 'gui.classroom.classAi.service.other',
    },
    otherCondition: {
        defaultMessage: 'Enter its URL. Check its terms of use at your school.',
        description: 'Conditions for using another generative AI in a class',
        id: 'gui.classroom.classAi.service.otherCondition',
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
    rubyteeWrong: {
        defaultMessage: "Rubytee is an AI (Anthropic's Claude). Its answers may be wrong.",
        description: 'Condition the teacher checks before turning on Rubytee: AI answers may be wrong',
        id: 'gui.classroom.classAi.rubyteeCondition.wrong',
    },
    rubyteePersonal: {
        defaultMessage: 'Teach students not to enter personal information such as their name or address.',
        description: 'Condition the teacher checks before turning on Rubytee: no personal information',
        id: 'gui.classroom.classAi.rubyteeCondition.personal',
    },
    rubyteeSummary: {
        defaultMessage: "Conditions: wrong answers, personal information, and a parent's permission for under 18s.",
        description: 'One-line summary of the conditions the teacher checks before turning on Rubytee',
        id: 'gui.classroom.classAi.rubyteeConditionsSummary',
    },
    rubyteeAge: {
        defaultMessage: "Students under 18 need a parent's or guardian's permission, which the school has checked.",
        description: 'Condition the teacher checks before turning on Rubytee: parental permission under 18',
        id: 'gui.classroom.classAi.rubyteeCondition.age',
    },
});

const SERVICES = [
    { key: 'none', service: null, name: messages.none },
    { key: 'gemini', service: 'gemini', name: messages.gemini, condition: messages.geminiCondition },
    { key: 'chatgpt', service: 'chatgpt', name: messages.chatgpt, condition: messages.chatgptCondition },
    { key: 'other', service: 'other', name: messages.other, condition: messages.otherCondition },
];

const URL_ERRORS = {
    required: messages.urlRequired,
    https: messages.urlHttps,
    adultOnly: messages.urlAdultOnly,
};

const UnsavedMark = ({ testId }) => (
    <span className={styles.unsaved} data-testid={testId}>
        <FormattedMessage
            defaultMessage="Not saved"
            description="Small mark on a class AI setting that was changed and not saved yet"
            id="gui.classroom.classAi.unsaved"
        />
    </span>
);

UnsavedMark.propTypes = {
    testId: PropTypes.string.isRequired,
};

// What the students' consent screen used to say (removed in #1412), now
// checked by the teacher when turning Rubytee on for the class (#1413).
const RUBYTEE_CONDITIONS = [
    { key: 'wrong', message: messages.rubyteeWrong },
    { key: 'personal', message: messages.rubyteePersonal },
    { key: 'age', message: messages.rubyteeAge },
];

const ClassAiSettings = ({ changed, draft, isLoading, onChange, rubyteeUnconfirmed }) => {
    const intl = useIntl();
    // The URL rarely needs changing, so its input stays folded until asked for.
    const [urlOpen, setUrlOpen] = useState(false);
    // Rubytee's conditions fold into a one-line summary (R3) so the form fits 1300x600 (#1427).
    const [conditionsOpen, setConditionsOpen] = useState(false);

    const update = useCallback((changes) => onChange({ ...draft, ...changes }), [draft, onChange]);

    const handleService = useCallback(
        (e) => {
            const key = e.currentTarget.dataset.service;
            const next = draftWithService(draft, key === 'none' ? null : key);
            if (next === draft) return;
            // A different service has its own URL: fold the input again.
            setUrlOpen(false);
            onChange(next);
        },
        [draft, onChange],
    );
    const handleConfirm = useCallback((e) => update({ confirmed: e.target.checked }), [update]);
    const handleUrl = useCallback((e) => update({ url: e.target.value }), [update]);
    const handleOpenUrl = useCallback(() => setUrlOpen(true), []);
    const handleToggleConditions = useCallback(() => setConditionsOpen((open) => !open), []);
    const handleRubytee = useCallback((e) => onChange(draftWithRubytee(draft, e.target.checked)), [draft, onChange]);
    const handleRubyteeConfirm = useCallback((e) => update({ rubyteeConfirmed: e.target.checked }), [update]);

    const selected = draft.use ? SERVICES.find((s) => s.service === draft.service) : null;
    const urlError = selected ? validateGenaiUrl(draft.url) : null;
    // "Other" has no default URL; a broken URL must stay visible to be fixed.
    const showUrlInput = Boolean(selected) && (draft.service === 'other' || urlOpen || urlError !== null);
    // Next to the URL: what is wrong with it, or a link to try it. Never both, so they share the spot.
    const urlAside = urlError ? (
        <span className={styles.urlError} data-testid="classroom-class-ai-url-error">
            {intl.formatMessage(URL_ERRORS[urlError])}
        </span>
    ) : (
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
    );

    return (
        <div className={styles.section} data-testid="classroom-class-ai-settings">
            <div className={styles.settings}>
                <p className={styles.heading}>
                    <FormattedMessage
                        defaultMessage="AI used in this class"
                        description="Heading of the class AI settings (generative AI and Rubytee)"
                        id="gui.classroom.classAi.heading"
                    />
                </p>

                <div className={styles.row} data-testid="classroom-class-ai-genai">
                    <div className={styles.rowHead}>
                        <span className={styles.rowLabel}>
                            <FormattedMessage
                                defaultMessage="Consult the school's generative AI"
                                description="Label of the class setting that lets students consult the school's generative AI"
                                id="gui.classroom.classAi.genaiLabel"
                            />
                        </span>
                        {changed.genai ? <UnsavedMark testId="classroom-class-ai-genai-unsaved" /> : null}
                        {/* The choices sit beside the label to keep both AIs' checks within 1300x600 (#1439). */}
                        <div className={styles.services} role="group">
                            {SERVICES.map((s) => {
                                const isSelected = selected ? selected.key === s.key : s.key === 'none';
                                return (
                                    <button
                                        key={s.key}
                                        aria-pressed={isSelected}
                                        className={isSelected ? styles.serviceSelected : styles.service}
                                        data-service={s.key}
                                        data-testid={`classroom-class-ai-service-${s.key}`}
                                        disabled={isLoading}
                                        type="button"
                                        onClick={handleService}
                                    >
                                        {intl.formatMessage(s.name)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <p className={styles.note}>
                        <FormattedMessage
                            defaultMessage="An “Ask AI” face appears in both the Code tab and the Ruby tab. Students paste their work into the AI themselves, so Smalruby sends nothing."
                            description="What turning on the school's generative AI does on the students' screen"
                            id="gui.classroom.classAi.genaiNote"
                        />
                    </p>

                    {selected ? (
                        <div className={styles.confirmPanel} data-testid="classroom-class-ai-confirm-panel">
                            <p className={styles.condition}>{intl.formatMessage(selected.condition)}</p>
                            {/* The folded URL shares the check's row, like Rubytee's links, so both fit 1300x600 (#1439). */}
                            <div className={styles.confirmRow}>
                                <label className={styles.confirm}>
                                    <input
                                        checked={draft.confirmed}
                                        className={styles.checkbox}
                                        data-testid="classroom-class-ai-confirm"
                                        disabled={isLoading}
                                        name="genaiConfirmed"
                                        type="checkbox"
                                        onChange={handleConfirm}
                                    />
                                    <span className={styles.confirmLabel}>
                                        <FormattedMessage
                                            defaultMessage="This class meets the conditions (required)"
                                            description="Required checkbox confirming the class meets the AI's terms"
                                            id="gui.classroom.classAi.confirm"
                                        />
                                    </span>
                                </label>
                                {showUrlInput ? null : (
                                    <span className={styles.urlFolded}>
                                        <button
                                            className={styles.linkButton}
                                            data-testid="classroom-class-ai-url-change"
                                            disabled={isLoading}
                                            type="button"
                                            onClick={handleOpenUrl}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Change the page students open (now {url})"
                                                description="Opens the input for the page students open in the generative AI"
                                                id="gui.classroom.classAi.urlChange"
                                                values={{ url: displayGenaiUrl(draft.url) }}
                                            />
                                        </button>
                                        {urlAside}
                                    </span>
                                )}
                            </div>
                            {showUrlInput ? (
                                <label className={styles.urlLabel}>
                                    <FormattedMessage
                                        defaultMessage="Page students open"
                                        description="Label of the generative AI URL input"
                                        id="gui.classroom.classAi.urlLabel"
                                    />
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
                                        {urlAside}
                                    </span>
                                </label>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className={styles.row} data-testid="classroom-class-ai-rubytee-row">
                    <div className={styles.rowHead}>
                        <label className={styles.toggle}>
                            <input
                                checked={draft.rubytee}
                                className={styles.toggleInput}
                                data-testid="classroom-class-ai-rubytee"
                                disabled={isLoading}
                                role="switch"
                                type="checkbox"
                                onChange={handleRubytee}
                            />
                            <span aria-hidden className={styles.toggleTrack} />
                            <span className={styles.rowLabel}>
                                <FormattedMessage
                                    defaultMessage="Rubytee"
                                    description="Label of the toggle that turns on Rubytee (Smalruby's AI) for a class"
                                    id="gui.classroom.classAi.rubytee"
                                />
                            </span>
                        </label>
                        {changed.rubytee ? <UnsavedMark testId="classroom-class-ai-rubytee-unsaved" /> : null}
                        <span className={styles.inlineNote}>
                            <FormattedMessage
                                defaultMessage="When the generative AI's answer doesn't work, “Leave it to Rubytee” lets Smalruby's AI (Claude) fix it. No sign-up needed."
                                description="What turning on Rubytee does on the students' screen"
                                id="gui.classroom.classAi.rubyteeNote"
                            />
                        </span>
                    </div>

                    {draft.rubytee ? (
                        <div className={styles.confirmPanel} data-testid="classroom-class-ai-rubytee-confirm-panel">
                            {rubyteeUnconfirmed && !draft.rubyteeConfirmed ? (
                                <p
                                    className={styles.unconfirmed}
                                    data-testid="classroom-class-ai-rubytee-unconfirmed"
                                >
                                    <FormattedMessage
                                        defaultMessage="Not confirmed yet. Rubytee keeps working; check the box below when you next save."
                                        description="Shown for a class that turned Rubytee on before the teacher's confirmation existed"
                                        id="gui.classroom.classAi.rubyteeUnconfirmed"
                                    />
                                </p>
                            ) : null}
                            <p className={styles.condition}>
                                <span data-testid="classroom-class-ai-rubytee-conditions-summary">
                                    {intl.formatMessage(messages.rubyteeSummary)}
                                </span>{' '}
                                <button
                                    aria-expanded={conditionsOpen}
                                    className={styles.linkButton}
                                    data-testid="classroom-class-ai-rubytee-conditions-toggle"
                                    type="button"
                                    onClick={handleToggleConditions}
                                >
                                    {conditionsOpen ? (
                                        <FormattedMessage
                                            defaultMessage="Hide details"
                                            description="Folds the details of Rubytee's conditions"
                                            id="gui.classroom.classAi.rubyteeConditionsHide"
                                        />
                                    ) : (
                                        <FormattedMessage
                                            defaultMessage="Details"
                                            description="Opens the details of Rubytee's conditions"
                                            id="gui.classroom.classAi.rubyteeConditionsShow"
                                        />
                                    )}
                                </button>
                            </p>
                            {conditionsOpen ? (
                                <ul className={styles.conditions} data-testid="classroom-class-ai-rubytee-conditions">
                                    {RUBYTEE_CONDITIONS.map((c) => (
                                        <li key={c.key}>{intl.formatMessage(c.message)}</li>
                                    ))}
                                </ul>
                            ) : null}
                            <div className={styles.confirmRow}>
                                <label className={styles.confirm}>
                                    <input
                                        checked={draft.rubyteeConfirmed}
                                        className={styles.checkbox}
                                        data-testid="classroom-class-ai-rubytee-confirm"
                                        disabled={isLoading}
                                        name="rubyteeConfirmed"
                                        type="checkbox"
                                        onChange={handleRubyteeConfirm}
                                    />
                                    <span className={styles.confirmLabel}>
                                        <FormattedMessage
                                            defaultMessage="This class meets the conditions above (required)"
                                            description="Required checkbox confirming the class meets Rubytee's conditions"
                                            id="gui.classroom.classAi.rubyteeConfirm"
                                        />
                                    </span>
                                </label>
                                <span className={styles.links}>
                                    <a
                                        data-testid="classroom-class-ai-rubytee-terms"
                                        href="/terms-of-service.html"
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >
                                        <FormattedMessage
                                            defaultMessage="Terms of Service"
                                            description="Link to Smalruby's terms of service, next to the Rubytee confirmation"
                                            id="gui.classroom.classAi.rubyteeTerms"
                                        />
                                    </a>
                                    {' / '}
                                    <a
                                        data-testid="classroom-class-ai-rubytee-privacy"
                                        href="/privacy-policy.html"
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >
                                        <FormattedMessage
                                            defaultMessage="Privacy Policy"
                                            description="Link to Smalruby's privacy policy, next to the Rubytee confirmation"
                                            id="gui.classroom.classAi.rubyteePrivacy"
                                        />
                                    </a>
                                </span>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

ClassAiSettings.propTypes = {
    changed: PropTypes.shape({
        genai: PropTypes.bool.isRequired,
        rubytee: PropTypes.bool.isRequired,
    }).isRequired,
    draft: PropTypes.shape({
        use: PropTypes.bool.isRequired,
        service: PropTypes.string,
        url: PropTypes.string.isRequired,
        confirmed: PropTypes.bool.isRequired,
        rubytee: PropTypes.bool.isRequired,
        rubyteeConfirmed: PropTypes.bool.isRequired,
    }).isRequired,
    isLoading: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    /** The stored class has Rubytee on without the teacher's confirmation (see isRubyteeUnconfirmed). */
    rubyteeUnconfirmed: PropTypes.bool,
};

export default ClassAiSettings;
