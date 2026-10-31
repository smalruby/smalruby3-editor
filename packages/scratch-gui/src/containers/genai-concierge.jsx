// "生成AI に相談" (issue #1279): the face at the bottom left of the script area.
// Shown to students of a class that uses a generative AI (and with
// ?features=genai for development). The student describes the trouble, copies
// a question with the whole project as Ruby into the class's generative AI, and
// pastes the answer back to turn it into blocks.
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import GenaiAnswerSteps from '../components/genai-concierge/genai-answer-steps.jsx';
import styles from '../components/genai-concierge/genai-concierge.css';
import GenaiCopyStep from '../components/genai-concierge/genai-copy-step.jsx';
import GenaiNudge from '../components/genai-concierge/genai-nudge.jsx';
import GenaiTroubleStep from '../components/genai-concierge/genai-trouble-step.jsx';
import messages from '../components/genai-concierge/messages.js';
import rubyteeIcon from '../components/ruby-toolbar/icon--rubytee.svg';
import { AlertLevels } from '../lib/alerts/index.jsx';
import {
    NUDGE_GAP_MS,
    NUDGE_IDLE_SECONDS,
    isGenaiAvailable,
    isNudgeOffToday,
    localDateKey,
    resolveGenaiTarget,
    shouldNudge,
} from '../lib/genai-concierge-state.js';
import { PROBLEM_KINDS, buildGenaiPrompt } from '../lib/genai-prompt.js';
import RubyGenerator from '../lib/ruby-generator';
import { getUrlParams } from '../lib/url-params.js';

// The date the student chose 「今日は出さない」 (YYYY-MM-DD).
const NUDGE_OFF_KEY = 'smalruby:genaiNudgeOff';
// Development only: the generative AI chosen outside a class.
const DEV_SERVICE_KEY = 'smalruby:genaiService';
// One tab for the generative AI, reused by every copy.
const AI_WINDOW_NAME = 'smalruby-genai';

const readStorage = (key) => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
    } catch {
        return null;
    }
};

const writeStorage = (key, value) => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value);
    } catch {
        // private mode etc.: works without remembering
    }
};

// The left edge of the script area right of the block palette, so the face does not cover blocks.
const measureLeft = (root) => {
    const flyout = document.querySelector('.blocklyFlyout');
    const parent = root && root.offsetParent;
    if (!flyout || !parent) return 12;
    const right = flyout.getBoundingClientRect().right - parent.getBoundingClientRect().left;
    return Math.max(12, Math.round(right + 12));
};

const GenaiConcierge = ({ vm, rubyVersion, assignmentName, available, classGenai, quiet }) => {
    const intl = useIntl();
    const [left, setLeft] = useState(12);
    const [nudge, setNudge] = useState(false);
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState('trouble');
    const [kindId, setKindId] = useState(null);
    const [text, setText] = useState('');
    const [prompt, setPrompt] = useState('');
    const [parts, setParts] = useState(1);
    const [copied, setCopied] = useState({});
    const [devChoice, setDevChoice] = useState(() => readStorage(DEV_SERVICE_KEY));
    const [notice, setNotice] = useState('');
    // Bumped by 「もう一度相談する」 so the answer steps start empty.
    const [answerKey, setAnswerKey] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const drag = useRef(null);
    const aiWindow = useRef(null);
    const rootRef = useRef(null);
    const lastActivity = useRef(Date.now());
    const lastNudge = useRef(0);
    const quietRef = useRef(quiet);
    quietRef.current = quiet;

    const target = resolveGenaiTarget({ classGenai, devChoice });

    useEffect(() => {
        if (!available) return;
        const update = () => setLeft(measureLeft(rootRef.current));
        update();
        const timer = setInterval(update, 1000);
        window.addEventListener('resize', update);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', update);
        };
    }, [available]);

    // Count from when the face appears (e.g. on joining a class), not from the page load:
    // input before that is not watched, so an old start would offer help right away.
    useEffect(() => {
        if (available) lastActivity.current = Date.now();
    }, [available]);

    // Offer help after the student has done nothing for a while.
    useEffect(() => {
        if (!available) return;
        const touch = () => {
            lastActivity.current = Date.now();
        };
        const events = ['pointerdown', 'keydown', 'wheel'];
        events.forEach((name) => window.addEventListener(name, touch, true));
        vm.on('PROJECT_CHANGED', touch);
        // Watching the program run or reading an error is not being stuck: start counting afresh.
        vm.on('PROJECT_RUN_START', touch);
        vm.on('PROJECT_RUN_STOP', touch);
        const idleSeconds = getUrlParams().genaiIdle || NUDGE_IDLE_SECONDS;
        const idleMs = idleSeconds * 1000;
        const gapMs = Math.min(NUDGE_GAP_MS, idleMs * 4);
        const timer = setInterval(() => {
            const now = Date.now();
            if (quietRef.current) lastActivity.current = now;
            const show = shouldNudge({
                now,
                lastActivity: lastActivity.current,
                lastNudge: lastNudge.current,
                idleMs,
                gapMs,
                busy: open || nudge || quietRef.current || document.hidden,
                offToday: isNudgeOffToday(readStorage(NUDGE_OFF_KEY), now),
            });
            if (!show) return;
            lastNudge.current = now;
            setNudge(true);
        }, 1000);
        return () => {
            events.forEach((name) => window.removeEventListener(name, touch, true));
            vm.removeListener('PROJECT_CHANGED', touch);
            vm.removeListener('PROJECT_RUN_START', touch);
            vm.removeListener('PROJECT_RUN_STOP', touch);
            clearInterval(timer);
        };
    }, [vm, available, open, nudge]);

    const handleOpen = useCallback(() => {
        setNudge(false);
        setOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setOpen(false);
        lastActivity.current = Date.now();
    }, []);

    const handleReset = useCallback(() => {
        setStep('trouble');
        setKindId(null);
        setText('');
        setPrompt('');
        setParts(1);
        setCopied({});
        setNotice('');
        setAnswerKey((k) => k + 1);
    }, []);

    const handleKindChange = useCallback((id, starter) => {
        setKindId(id);
        if (starter !== null) setText(starter);
    }, []);

    const handleMakePrompt = useCallback(() => {
        const editing = vm.editingTarget;
        const kind = PROBLEM_KINDS.find((k) => k.id === kindId);
        const programs = vm.runtime.targets
            .filter((t) => t.isOriginal)
            .map((t) => ({
                name: t.isStage ? 'ステージ' : t.getName(),
                code: RubyGenerator.targetToCode(t, { version: rubyVersion }),
                sounds: t.getSounds().map((sound) => sound.name),
                costumes: t.getCostumes().map((costume) => costume.name),
            }))
            .filter((p) => (p.code && p.code.trim()) || p.name === (editing && editing.getName()));
        setPrompt(
            buildGenaiPrompt({
                // The question to the AI stays in Japanese whatever the editor language (#1279).
                kindLabel: kind.label,
                text,
                programs,
                editingName: editing && !editing.isStage ? editing.getName() : null,
                assignmentName,
            }),
        );
        setParts(1);
        setCopied({});
        setNotice('');
        setStep('copy');
    }, [vm, rubyVersion, kindId, text, assignmentName]);

    // Copy first (the click is the user gesture the clipboard needs), then reuse one AI tab.
    const copyAndOpen = useCallback(
        async (content, key) => {
            try {
                await navigator.clipboard.writeText(content);
                setCopied((c) => ({ ...c, [key]: true }));
                setNotice(intl.formatMessage(messages.copied));
            } catch {
                setNotice(intl.formatMessage(messages.copyFailed));
            }
            if (!target) return;
            if (aiWindow.current && !aiWindow.current.closed) {
                aiWindow.current.focus();
            } else {
                aiWindow.current = window.open(target.url, AI_WINDOW_NAME);
            }
        },
        [intl, target],
    );

    const handleChooseService = useCallback((choice) => {
        setDevChoice(choice);
        writeStorage(DEV_SERVICE_KEY, choice);
    }, []);
    const handleChangeService = useCallback(() => setDevChoice(null), []);

    const handleDragStart = useCallback(
        (e) => {
            if (e.target.closest('button')) return;
            drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
            const move = (ev) => {
                if (!drag.current) return;
                setOffset({ x: ev.clientX - drag.current.x, y: ev.clientY - drag.current.y });
            };
            const up = () => {
                drag.current = null;
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
            e.preventDefault();
        },
        [offset],
    );

    const handleNudgeLater = useCallback(() => setNudge(false), []);
    const handleNudgeOff = useCallback(() => {
        writeStorage(NUDGE_OFF_KEY, localDateKey(Date.now()));
        setNudge(false);
    }, []);
    const handleSplit = useCallback(() => {
        setParts((p) => Math.min(p + 1, 4));
        setCopied({});
    }, []);
    const handleToTrouble = useCallback(() => setStep('trouble'), []);
    const handleToPaste = useCallback(() => {
        setNotice('');
        setStep('paste');
    }, []);

    if (!available) return null;

    const title = intl.formatMessage(messages.title);
    return (
        <div className={styles.root} ref={rootRef} style={{ left }}>
            {nudge && !open && <GenaiNudge onOpen={handleOpen} onLater={handleNudgeLater} onOff={handleNudgeOff} />}
            {open && (
                <div
                    className={styles.panel}
                    data-testid="genai-panel"
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
                >
                    <div className={styles.header} data-testid="genai-drag-handle" onPointerDown={handleDragStart}>
                        <span>{title}</span>
                        <button
                            className={styles.close}
                            data-testid="genai-close"
                            onClick={handleClose}
                            aria-label={intl.formatMessage(messages.close)}
                        >
                            ×
                        </button>
                    </div>
                    <ol className={styles.steps}>
                        <li className={step === 'trouble' ? styles.current : ''}>
                            {intl.formatMessage(messages.stepTrouble)}
                        </li>
                        <li className={step === 'copy' ? styles.current : ''}>
                            {intl.formatMessage(messages.stepCopy)}
                        </li>
                        <li className={step === 'paste' || step === 'done' ? styles.current : ''}>
                            {intl.formatMessage(messages.stepPaste)}
                        </li>
                    </ol>
                    <div className={styles.body}>
                        {step === 'trouble' && (
                            <GenaiTroubleStep
                                kindId={kindId}
                                text={text}
                                onKindChange={handleKindChange}
                                onTextChange={setText}
                                onMakePrompt={handleMakePrompt}
                            />
                        )}
                        {step === 'copy' && (
                            <GenaiCopyStep
                                serviceName={target ? target.name : null}
                                canChangeService={Boolean(target) && !target.fromClass}
                                prompt={prompt}
                                parts={parts}
                                copied={copied}
                                notice={notice}
                                onChooseService={handleChooseService}
                                onChangeService={handleChangeService}
                                onPromptChange={setPrompt}
                                onCopy={copyAndOpen}
                                onSplit={handleSplit}
                                onBack={handleToTrouble}
                                onNext={handleToPaste}
                            />
                        )}
                        <GenaiAnswerSteps
                            key={answerKey}
                            vm={vm}
                            rubyVersion={rubyVersion}
                            step={step}
                            notice={notice}
                            onStep={setStep}
                            onCopy={copyAndOpen}
                            onClose={handleClose}
                            onReset={handleReset}
                        />
                    </div>
                </div>
            )}
            <button
                className={styles.face}
                data-testid="genai-face"
                onClick={open ? handleClose : handleOpen}
                title={title}
            >
                <img src={rubyteeIcon} alt={title} />
            </button>
        </div>
    );
};

GenaiConcierge.propTypes = {
    vm: PropTypes.shape({
        editingTarget: PropTypes.object,
        runtime: PropTypes.object,
        on: PropTypes.func,
        removeListener: PropTypes.func,
    }).isRequired,
    rubyVersion: PropTypes.string,
    assignmentName: PropTypes.string,
    available: PropTypes.bool.isRequired,
    classGenai: PropTypes.shape({
        enabled: PropTypes.bool,
        service: PropTypes.string,
        url: PropTypes.string,
    }),
    // An error alert is shown or the program is running: don't offer help now.
    quiet: PropTypes.bool,
};

const mapStateToProps = (state) => {
    const { classroom } = state.scratchGui;
    const alerts = (state.scratchGui.alerts && state.scratchGui.alerts.alertsList) || [];
    return {
        rubyVersion: state.scratchGui.settings.rubyVersion,
        assignmentName: classroom.assignmentName,
        classGenai: classroom.studentGenai,
        available: isGenaiAvailable({
            role: classroom.role,
            sessionToken: classroom.sessionToken,
            classGenai: classroom.studentGenai,
            devFlag: getUrlParams().features.includes('genai'),
        }),
        quiet:
            Boolean(state.scratchGui.vmStatus && state.scratchGui.vmStatus.running) ||
            alerts.some((alert) => alert.level === AlertLevels.WARN),
    };
};

export default connect(mapStateToProps)(GenaiConcierge);
