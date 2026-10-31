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
import GenaiStepper from '../components/genai-concierge/genai-stepper.jsx';
import GenaiTroubleStep from '../components/genai-concierge/genai-trouble-step.jsx';
import messages from '../components/genai-concierge/messages.js';
import rubyteeIcon from '../components/ruby-toolbar/icon--rubytee.svg';
import {
    NUDGE_GAP_MS,
    NUDGE_IDLE_SECONDS,
    isGenaiAvailable,
    isNudgeOffToday,
    localDateKey,
    panelPlacement,
    resolveGenaiTarget,
    scrollToShowBlocks,
    shouldNudge,
} from '../lib/genai-concierge-state.js';
import { PROBLEM_KINDS, buildGenaiPrompt } from '../lib/genai-prompt.js';
import RubyGenerator from '../lib/ruby-generator';
import { getUrlParams } from '../lib/url-params.js';
import useStudentClassSettingsRefresh from './use-student-class-settings-refresh.js';

// The date the student chose 「今日は出さない」 (YYYY-MM-DD).
const NUDGE_OFF_KEY = 'smalruby:genaiNudgeOff';
// Development only: the generative AI chosen outside a class.
const DEV_SERVICE_KEY = 'smalruby:genaiService';

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

// Width of the panel (also in genai-concierge.css) and of the face, for placing the panel.
const PANEL_WIDTH = 340;
const FACE_WIDTH = 52;
// Margin kept above the panel inside the script area.
const PANEL_TOP_MARGIN = 12;
// Wait for the workspace to show the blocks just put in before scrolling to them.
const SCROLL_DELAY_MS = 200;

// Where the face goes (the left edge of the script area right of the block palette, so
// it does not cover blocks) and the size of the script area the panel has to fit in.
const measureArea = (root) => {
    const flyout = document.querySelector('.blocklyFlyout');
    const parent = root && root.offsetParent;
    if (!parent) return { left: 12, width: 0, height: 0 };
    const left = flyout ? flyout.getBoundingClientRect().right - parent.getBoundingClientRect().left : 0;
    return {
        left: Math.max(12, Math.round(left + 12)),
        width: parent.clientWidth,
        height: parent.clientHeight,
    };
};

const GenaiConcierge = ({
    vm,
    rubyVersion,
    assignmentName,
    available,
    classGenai,
    running,
    role,
    sessionToken,
    scratchBlocks,
    dispatch,
}) => {
    const intl = useIntl();
    // The teacher may have turned the generative AI off since the page was last open.
    useStudentClassSettingsRefresh({ role, sessionToken, dispatch });
    const [area, setArea] = useState({ left: 12, width: 0, height: 0 });
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
    // The text of the question is folded away until the student opens it (#1293 G2).
    const [promptOpen, setPromptOpen] = useState(false);
    // Bumped by 「もう一度相談する」 so the answer steps start empty.
    const [answerKey, setAnswerKey] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const drag = useRef(null);
    // Whether this panel already opened the generative AI. Gemini and ChatGPT send
    // Cross-Origin-Opener-Policy, which cuts the opened tab off from Smalruby: it can't be
    // found by name, focused or reused. So the AI is opened once, and later copies only
    // ask the student to go back to its tab (with a link to open it again if it was closed).
    const [aiOpened, setAiOpened] = useState(false);
    const rootRef = useRef(null);
    const lastActivity = useRef(Date.now());
    const lastNudge = useRef(0);
    const runningRef = useRef(running);
    runningRef.current = running;

    const target = resolveGenaiTarget({ classGenai, devChoice });

    useEffect(() => {
        if (!available) return;
        const update = () => {
            const next = measureArea(rootRef.current);
            setArea((prev) =>
                prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next,
            );
        };
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
        // Watching the program run is not being stuck: start counting afresh.
        vm.on('PROJECT_RUN_START', touch);
        vm.on('PROJECT_RUN_STOP', touch);
        const idleSeconds = getUrlParams().genaiIdle || NUDGE_IDLE_SECONDS;
        const idleMs = idleSeconds * 1000;
        const gapMs = Math.min(NUDGE_GAP_MS, idleMs * 4);
        const timer = setInterval(() => {
            const now = Date.now();
            if (runningRef.current) lastActivity.current = now;
            const show = shouldNudge({
                now,
                lastActivity: lastActivity.current,
                lastNudge: lastNudge.current,
                idleMs,
                gapMs,
                busy: open || nudge || runningRef.current || document.hidden,
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

    // Each step change leaves the notice of the last one behind (#1293 G4).
    const goTo = useCallback((next) => {
        setNotice('');
        setStep(next);
    }, []);

    const handleReset = useCallback(() => {
        setStep('trouble');
        setPromptOpen(false);
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
        setPromptOpen(false);
        goTo('copy');
    }, [vm, rubyVersion, kindId, text, assignmentName, goTo]);

    // noopener: the opened page gets no reference back to Smalruby (it could otherwise
    // move this tab elsewhere), and the reference could not be used anyway (see aiOpened).
    const openAi = useCallback(() => {
        if (!target) return;
        window.open(target.url, '_blank', 'noopener,noreferrer');
        setAiOpened(true);
    }, [target]);

    // Copy first (the click is the user gesture the clipboard needs), then open the AI once.
    const copyAndOpen = useCallback(
        async (content, key) => {
            try {
                await navigator.clipboard.writeText(content);
                setCopied((c) => ({ ...c, [key]: true }));
                // Step 2's checklist already says what to do after the first copy (#1293 P1).
                // Later copies go to the AI's tab opened before; a rewrite request has no checklist.
                if (aiOpened) setNotice(intl.formatMessage(messages.copiedGoBack));
                else setNotice(key === 'rewrite' ? intl.formatMessage(messages.copied) : '');
            } catch {
                setNotice(intl.formatMessage(messages.copyFailed));
                // The student copies it by hand from the text.
                setPromptOpen(true);
            }
            if (!aiOpened) openAi();
        },
        [intl, aiOpened, openAi],
    );

    // Another AI (the development picker) is a new tab to open.
    const targetUrl = target ? target.url : null;
    useEffect(() => setAiOpened(false), [targetUrl]);

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
        // 「コピーしました」 was about the whole question, not the parts (#1293 G4).
        setNotice('');
    }, []);
    const handleToTrouble = useCallback(() => goTo('trouble'), [goTo]);
    const handleToPaste = useCallback(() => goTo('paste'), [goTo]);
    const handleTogglePrompt = useCallback(() => setPromptOpen((v) => !v), []);
    const handleClearNotice = useCallback(() => setNotice(''), []);

    // Bring the blocks just put in into view, away from the panel at the right (#1293 G8).
    const handleApplied = useCallback(() => {
        setTimeout(() => {
            const workspace = scratchBlocks && scratchBlocks.getMainWorkspace();
            if (!workspace) return;
            const box = workspace.getBlocksBoundingBox();
            const empty = !box || (box.right === box.left && box.bottom === box.top);
            const to = scrollToShowBlocks({ bbox: empty ? null : box, scale: workspace.scale });
            if (to) workspace.scroll(to.x, to.y);
        }, SCROLL_DELAY_MS);
    }, [scratchBlocks]);

    if (!available) return null;

    const title = intl.formatMessage(messages.title);
    const place = panelPlacement({
        areaWidth: area.width,
        rootLeft: area.left,
        panelWidth: PANEL_WIDTH,
        faceWidth: FACE_WIDTH,
    });
    const panelStyle = {
        left: place.left,
        bottom: place.bottom,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
    };
    // The panel never scrolls the page: it fits in the script area above its bottom edge (#1293 P5).
    if (area.height) panelStyle.maxHeight = area.height - 12 - place.bottom - PANEL_TOP_MARGIN;
    return (
        <div className={styles.root} ref={rootRef} style={{ left: area.left }}>
            {nudge && !open && <GenaiNudge onOpen={handleOpen} onLater={handleNudgeLater} onOff={handleNudgeOff} />}
            {open && (
                <div className={styles.panel} data-testid="genai-panel" style={panelStyle}>
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
                    <GenaiStepper step={step} onStep={goTo} />
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
                                promptOpen={promptOpen}
                                onTogglePrompt={handleTogglePrompt}
                                onChooseService={handleChooseService}
                                onChangeService={handleChangeService}
                                onPromptChange={setPrompt}
                                aiOpened={aiOpened}
                                onCopy={copyAndOpen}
                                onReopen={openAi}
                                onSplit={handleSplit}
                                onBack={handleToTrouble}
                                onNext={handleToPaste}
                            />
                        )}
                        <GenaiAnswerSteps
                            key={answerKey}
                            vm={vm}
                            rubyVersion={rubyVersion}
                            serviceName={target ? target.name : null}
                            step={step}
                            notice={notice}
                            onStep={goTo}
                            onCopy={copyAndOpen}
                            onApplied={handleApplied}
                            onClearNotice={handleClearNotice}
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
    // The program is running: don't offer help now. Alerts (e.g. a lost mesh
    // connection) don't count: the code tab has no errors to read.
    running: PropTypes.bool,
    role: PropTypes.string,
    sessionToken: PropTypes.string,
    scratchBlocks: PropTypes.shape({ getMainWorkspace: PropTypes.func }),
    dispatch: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
    const { classroom } = state.scratchGui;
    return {
        rubyVersion: state.scratchGui.settings.rubyVersion,
        role: classroom.role,
        sessionToken: classroom.sessionToken,
        scratchBlocks: state.scratchGui.blockDisplay && state.scratchGui.blockDisplay.scratchBlocks,
        assignmentName: classroom.assignmentName,
        classGenai: classroom.studentGenai,
        available: isGenaiAvailable({
            role: classroom.role,
            sessionToken: classroom.sessionToken,
            classGenai: classroom.studentGenai,
            devFlag: getUrlParams().features.includes('genai'),
        }),
        running: Boolean(state.scratchGui.vmStatus && state.scratchGui.vmStatus.running),
    };
};

export default connect(mapStateToProps)(GenaiConcierge);
