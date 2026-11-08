// Step 3 of "生成AI に相談" (#1280): paste the AI's answer back, check that it turns
// into blocks, put it in and switch between the two versions. Once checked, the
// answer folds away and the result takes its place (#1293 G7).
// Always mounted while the panel has been opened (also while it is closed) so going
// back a step or closing the panel keeps the answer and the two versions.
// The blocks the AI's version adds or changes are listed in the words of the blocks,
// and marked in the editor while that version is in (#1281).
// After two failed checks, 「ルビティーにまかせる」 has Rubytee rewrite the program and
// checks its answers here in the browser (#1282).
// What depends on the tab (checking, putting in, switching, marking) is the adapter's (#1397).
// The Ruby tab shows what changes in lines: Monaco's diff before, counts and marks after (#1399).
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { problemToJapanese } from '../../lib/genai-answer.js';
import { canOfferTakeover, marksToShow } from '../../lib/genai-concierge-state.js';
import { buildRewritePrompt } from '../../lib/genai-prompt.js';
import {
    MAX_TAKEOVER_TRIES,
    buildTakeoverMessage,
    requestTakeover,
    runTakeover,
    takeoverExplanation,
} from '../../lib/genai-takeover.js';
import styles from './genai-concierge.css';
import messages from './messages.js';

const quoteNames = (names) => names.map((name) => `「${name}」`).join('');

// Lines of the list shown before 「ほかに N か所」.
const MAX_CHANGES = 6;

// What went wrong with the takeover, in the student's language.
const takeoverErrorMessage = (intl, takeover) => {
    switch (takeover.code) {
        case 'RATE_LIMIT_EXCEEDED':
            return intl.formatMessage(messages.takeoverErrorRate, {
                minutes: Math.max(1, Math.ceil((takeover.resetAfterSeconds || 60) / 60)),
            });
        case 'TOO_LONG':
        case 'INPUT_TOO_LONG':
        case 'HISTORY_TOO_LONG':
            return intl.formatMessage(messages.takeoverErrorTooLong);
        case 'INVALID_INPUT':
        case 'INVALID_STATE_CONTEXT':
            return intl.formatMessage(messages.takeoverErrorInput);
        default:
            return intl.formatMessage(messages.takeoverError);
    }
};

// Where a fix or a problem is: the sprite (when the answer has several) and the line.
const placeOf = (intl, sprite, line) => {
    if (line) {
        return sprite
            ? intl.formatMessage(messages.spriteLineOf, { sprite, line })
            : intl.formatMessage(messages.lineOf, { line });
    }
    return sprite ? intl.formatMessage(messages.spriteOf, { sprite }) : null;
};

// A problem from checkAnswer in the student's language.
const describeProblem = (intl, problem) => {
    switch (problem.type) {
        case 'noProgram':
            return { place: null, text: intl.formatMessage(messages.problemNoProgram) };
        case 'missing': {
            const sound = problem.kind === 'sound';
            const none = problem.names.length === 0;
            const message = sound
                ? none
                    ? messages.problemMissingSoundNone
                    : messages.problemMissingSound
                : none
                  ? messages.problemMissingCostumeNone
                  : messages.problemMissingCostume;
            return {
                place: placeOf(intl, problem.sprite, problem.line),
                text: intl.formatMessage(message, { name: problem.name, names: quoteNames(problem.names) }),
            };
        }
        case 'classDef':
            return {
                place: placeOf(intl, problem.sprite, problem.line),
                text: intl.formatMessage(messages.problemClassDef, { source: problem.source }),
            };
        case 'otherSprite':
            return {
                place: null,
                text: intl.formatMessage(messages.problemOtherSprite, { sprite: problem.sprite, only: problem.only }),
            };
        case 'raw':
            return {
                place: placeOf(intl, problem.sprite, null),
                text: intl.formatMessage(messages.problemRaw, { count: problem.count }),
            };
        case 'error':
            return {
                place: placeOf(intl, problem.sprite, problem.row === null ? null : problem.row + 1),
                text: problem.text,
            };
        default:
            return { place: placeOf(intl, problem.sprite, null), text: problem.text };
    }
};

const FixList = ({ fixes }) => {
    const intl = useIntl();
    return (
        <div className={styles.fixes} data-testid="genai-fixes">
            <p className={styles.small}>
                <FormattedMessage {...messages.fixesTitle} />
            </p>
            <ul>
                {fixes.map((fix, i) => (
                    <li key={i}>
                        {placeOf(intl, fix.name, fix.line)} <code>{fix.from}</code> → <code>{fix.to}</code>
                    </li>
                ))}
            </ul>
        </div>
    );
};

FixList.propTypes = {
    fixes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

const ProblemList = ({ problems }) => {
    const intl = useIntl();
    return (
        <ul data-testid="genai-problems">
            {problems.slice(0, 5).map((problem, i) => {
                const { place, text } = describeProblem(intl, problem);
                return <li key={i}>{place ? `${place}: ${text}` : text}</li>;
            })}
        </ul>
    );
};

ProblemList.propTypes = {
    problems: PropTypes.arrayOf(PropTypes.object).isRequired,
};

const changeMessage = (intl, change) => {
    switch (change.kind) {
        case 'added':
            return change.scriptText
                ? intl.formatMessage(messages.changeAddedIn, { block: change.text, script: change.scriptText })
                : intl.formatMessage(messages.changeAdded, { block: change.text });
        case 'changed':
            return intl.formatMessage(messages.changeChanged, { block: change.text, before: change.beforeText });
        default:
            return intl.formatMessage(messages.changeRemoved, { block: change.text });
    }
};

// The blocks the AI's version adds or changes, sprite by sprite. With onShow, a line of a
// block in the editor brings it into view (it may be under the panel or in another sprite).
const ChangeList = ({ parts, several, onShow }) => {
    const intl = useIntl();
    const lines = parts.flatMap((part) => part.changes.map((change) => ({ part, change })));
    const handleClick = useCallback(
        (e) => {
            e.preventDefault();
            const line = lines[Number(e.currentTarget.dataset.index)];
            onShow(line.part.target, [line.change.id]);
        },
        [lines, onShow],
    );
    return (
        <div className={styles.changes} data-testid="genai-changes">
            <p className={styles.changesTitle}>
                <FormattedMessage {...messages.changesTitle} />
            </p>
            {lines.length === 0 ? (
                <p className={styles.small}>
                    <FormattedMessage {...messages.changesNone} />
                </p>
            ) : (
                <ul>
                    {lines.slice(0, MAX_CHANGES).map(({ part, change }, i) => {
                        const text = changeMessage(intl, change);
                        const place = several ? `${intl.formatMessage(messages.spriteOf, { sprite: part.name })}: ` : '';
                        const showable = onShow && change.kind !== 'removed';
                        return (
                            <li
                                key={i}
                                className={styles[`change-${change.kind}`]}
                                data-kind={change.kind}
                                data-testid="genai-change"
                            >
                                {place}
                                {showable ? (
                                    <a href="#" data-index={i} onClick={handleClick}>
                                        {text}
                                    </a>
                                ) : (
                                    text
                                )}
                            </li>
                        );
                    })}
                    {lines.length > MAX_CHANGES && (
                        <li className={styles.small}>
                            <FormattedMessage {...messages.changesMore} values={{ count: lines.length - MAX_CHANGES }} />
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

ChangeList.propTypes = {
    parts: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string,
            target: PropTypes.object,
            changes: PropTypes.arrayOf(PropTypes.object),
        }),
    ).isRequired,
    several: PropTypes.bool,
    onShow: PropTypes.func,
};

// The lines the AI's code adds, changes and removes from the code in the editor: the
// counts, and the adapter's inline diff (Monaco's in the Ruby tab).
const LineDiff = ({ adapter, part }) => {
    const ref = useRef(null);
    useEffect(() => adapter.mountDiff(ref.current, part), [adapter, part]);
    const { added, changed, removed } = part.lines;
    return (
        <div className={styles.changes} data-testid="genai-lines">
            <p className={styles.changesTitle}>
                <FormattedMessage {...messages.linesTitle} />
            </p>
            <p className={styles.small} data-testid="genai-lines-count">
                {added + changed + removed === 0 ? (
                    <FormattedMessage {...messages.linesNone} />
                ) : (
                    <FormattedMessage {...messages.linesCount} values={{ added, changed, removed }} />
                )}
            </p>
            <div className={styles.lineDiff} data-testid="genai-line-diff" ref={ref} />
        </div>
    );
};

LineDiff.propTypes = {
    adapter: PropTypes.shape({ mountDiff: PropTypes.func.isRequired }).isRequired,
    part: PropTypes.shape({
        lines: PropTypes.shape({ added: PropTypes.number, changed: PropTypes.number, removed: PropTypes.number }),
    }).isRequired,
};

const GenaiAnswerSteps = ({
    vm,
    adapter,
    serviceName,
    prompt,
    troubleKind,
    troubleText,
    sessionToken,
    step,
    notice,
    rubyteeAvailable,
    open,
    onStep,
    onCopy,
    onShowBlocks,
    onClearNotice,
    onClose,
    onFinish,
    onReset,
    onTakeover,
}) => {
    const intl = useIntl();
    // The Ruby tab puts code in the editor, not blocks (#1398).
    const putsCode = adapter.puts === 'code';
    const [answer, setAnswer] = useState('');
    const [converted, setConverted] = useState(null);
    const [failures, setFailures] = useState(0);
    const [showRuby, setShowRuby] = useState(false);
    const [reflection, setReflection] = useState('');
    // [{target, name, before, after}]: the student switches between the two as often as they like.
    const [snapshots, setSnapshots] = useState(null);
    const [applied, setApplied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [checking, setChecking] = useState(false);
    // The pasted answer opened again after it was checked.
    const [answerOpen, setAnswerOpen] = useState(false);
    // [{target, name, changes}] while the AI's version is in: marked in the editor (#1281).
    const [marks, setMarks] = useState(null);
    // The answers that failed, oldest first: [{answer, problems (in Japanese), rewrite}].
    // 「ルビティーにまかせる」 sends them with the questions to the AI (#1282).
    const [tries, setTries] = useState([]);
    // null | {state: 'running', tries} | {state: 'failed', tries} | {state: 'error', code, resetAfterSeconds}
    const [takeover, setTakeover] = useState(null);
    // Rubytee's explanation when the answer checked is Rubytee's (null for the student's).
    const [byRubytee, setByRubytee] = useState(null);
    const abortRef = useRef(null);

    // The panel steps start afresh with a new key (もう一度相談する / another project).
    useEffect(
        () => () => {
            if (abortRef.current) abortRef.current.abort();
        },
        [],
    );

    // Mark what the AI's version adds or changes in the editor, and take the marks away
    // afterwards. The marks are only there while the panel is open: closing it with ×
    // takes them away and opening it again puts them back (#1281 FYI3).
    useEffect(() => {
        if (!marks || !open) return;
        return adapter.watchMarks(marks);
    }, [marks, open, adapter]);

    // Check a text as an answer, with what it adds or changes (does not set state).
    const checkText = useCallback((text) => adapter.check(text), [adapter]);

    const convertAnswer = useCallback(async () => {
        const result = await checkText(answer);
        setConverted(result);
        if (!result.ok) {
            setFailures((f) => f + 1);
            setTries((list) => [...list, { answer, problems: result.problems.map(problemToJapanese), rewrite: null }]);
        }
    }, [answer, checkText]);

    const handleConvert = useCallback(async () => {
        setConverted(null);
        setByRubytee(null);
        setTakeover(null);
        setAnswerOpen(false);
        // The notice of the last check (e.g. the rewrite request copied) is not about this one (#1293 P6).
        onClearNotice();
        setChecking(true);
        // Let the spinner paint before the (synchronous-heavy) conversion starts.
        await new Promise((resolve) => setTimeout(resolve, 50));
        try {
            await convertAnswer();
        } finally {
            setChecking(false);
        }
    }, [convertAnswer, onClearNotice]);

    // Bring the marked changes into view: those of the sprite in the editor first.
    const showMarks = useCallback(
        (next) => {
            const { owner, ids } = marksToShow(next, vm.editingTarget);
            onShowBlocks(owner, ids);
        },
        [vm, onShowBlocks],
    );

    // busy is reset in finally: an exception from apply() must not leave the buttons disabled (#1280 Q1).
    const handleApply = useCallback(async () => {
        setBusy(true);
        try {
            const next = await adapter.apply(converted.parts);
            setSnapshots(next.snapshots);
            setApplied(true);
            setMarks(next.marks);
            onStep('done');
            showMarks(next.marks);
        } finally {
            setBusy(false);
        }
    }, [adapter, converted, onStep, showMarks]);

    // Switch between the original and the AI's version (switchSnapshots keeps the
    // student's changes on the side being left). A sprite deleted meanwhile drops out.
    const handleSwitch = useCallback(
        async (e) => {
            const toAfter = e.currentTarget.dataset.side === 'after';
            if (toAfter === applied || busy) return;
            setBusy(true);
            try {
                const next = await adapter.switchSides(snapshots, toAfter);
                setSnapshots(next.snapshots);
                setApplied(toAfter);
                // The original program has no marks: what it lacks is in the AI's version.
                setMarks(toAfter ? next.marks : null);
                if (toAfter) showMarks(next.marks);
            } finally {
                setBusy(false);
            }
        },
        [applied, busy, snapshots, adapter, showMarks],
    );

    const handleReflectionChange = useCallback((e) => setReflection(e.target.value), []);
    const handleAnswerChange = useCallback((e) => {
        setAnswer(e.target.value);
        setConverted(null);
        setByRubytee(null);
    }, []);
    const handleToCopy = useCallback(() => onStep('copy'), [onStep]);
    const handleToggleAnswer = useCallback((e) => {
        e.preventDefault();
        setAnswerOpen((v) => !v);
    }, []);
    const handleToggleRuby = useCallback((e) => {
        e.preventDefault();
        setShowRuby((v) => !v);
    }, []);
    // The request goes to the AI, so it stays in Japanese whatever the editor language.
    // The request is kept for 「ルビティーにまかせる」 as the question of the next answer.
    const handleCopyRewrite = useCallback(() => {
        const request = buildRewritePrompt({
            code: converted.code,
            problems: converted.problems.map(problemToJapanese),
        });
        setTries((list) =>
            list.length === 0 ? list : [...list.slice(0, -1), { ...list[list.length - 1], rewrite: request }],
        );
        onCopy(request, 'rewrite');
    }, [onCopy, converted]);

    // Rubytee rewrites the program from the whole consultation; each answer is checked
    // here and, if it fails, sent back with the reasons (at most MAX_TAKEOVER_TRIES times).
    // Only an answer that turns into blocks is shown as one to put in (#1282).
    const startTakeover = useCallback(async () => {
        const first = buildTakeoverMessage({
            kindLabel: troubleKind,
            text: troubleText,
            programs: adapter.programs(),
            editingName: adapter.editingName(),
            exchanges: tries.map((t, i) => ({
                question: i === 0 ? prompt : tries[i - 1].rewrite,
                answer: t.answer,
                problems: t.problems,
            })),
        });
        onClearNotice();
        if (!first) {
            setTakeover({ state: 'error', code: 'TOO_LONG' });
            return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        const stateContext = adapter.takeoverState();
        setTakeover({ state: 'running', tries: 1 });
        try {
            const out = await runTakeover({
                first,
                send: (userMessage, history) =>
                    requestTakeover({ userMessage, history, stateContext, sessionToken }, { signal: controller.signal }),
                check: checkText,
                toJapanese: problemToJapanese,
                onTry: (n) => setTakeover({ state: 'running', tries: n }),
                signal: controller.signal,
            });
            setAnswer(out.text);
            setAnswerOpen(false);
            setConverted(out.result);
            setByRubytee(out.ok ? takeoverExplanation(out.text) : null);
            setTakeover(out.ok ? null : { state: 'failed', tries: out.tries });
        } catch (e) {
            setTakeover(
                e.code === 'CANCELLED'
                    ? null
                    : { state: 'error', code: e.code, resetAfterSeconds: e.resetAfterSeconds || null },
            );
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
        }
    }, [adapter, troubleKind, troubleText, prompt, tries, sessionToken, checkText, onClearNotice]);

    // The consent to Rubytee (that it is an AI) comes first, as in the Ruby tab.
    const handleTakeover = useCallback(() => onTakeover(startTakeover), [onTakeover, startTakeover]);
    const handleCancelTakeover = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
        setTakeover(null);
    }, []);

    if (step === 'paste') {
        // No program was found in what was pasted: the only thing to do is to paste again,
        // so the answer stays open (folding it would leave no button to go on with).
        const canFold = Boolean(converted && converted.code);
        const running = Boolean(takeover && takeover.state === 'running');
        const answerShown = !canFold || answerOpen;
        return (
            <>
                <div className={styles.stepBody}>
                    <p className={styles.question}>
                        <FormattedMessage {...messages.pasteQuestion} values={{ name: serviceName || '' }} />
                    </p>
                    {canFold && (
                        <p className={styles.small}>
                            <a href="#" data-testid="genai-answer-toggle" onClick={handleToggleAnswer}>
                                <FormattedMessage {...(answerOpen ? messages.answerHide : messages.answerShow)} />
                            </a>
                        </p>
                    )}
                    {answerShown && (
                        <textarea
                            className={styles.prompt}
                            data-testid="genai-answer"
                            value={answer}
                            // Rubytee's answer takes its place when it comes.
                            readOnly={running}
                            onChange={handleAnswerChange}
                        />
                    )}
                    {checking && (
                        <div className={styles.checking} data-testid="genai-checking">
                            <span className={styles.spinner} />
                            <FormattedMessage {...messages.checking} />
                        </div>
                    )}
                    {running && (
                        <div className={styles.checking} data-testid="genai-takeover-running">
                            <span className={styles.spinner} />
                            <FormattedMessage
                                {...messages.takeoverRunning}
                                values={{ count: takeover.tries, max: MAX_TAKEOVER_TRIES }}
                            />
                        </div>
                    )}
                    {converted && converted.ok && !running && (
                        <div className={styles.ok} data-testid="genai-convert-ok">
                            <p className={styles.verdict}>
                                <span className={styles.markOk}>✔</span>
                                <FormattedMessage {...messages.convertOk} />
                            </p>
                            {byRubytee !== null && (
                                <div className={styles.byRubytee} data-testid="genai-takeover-by">
                                    <p>
                                        <FormattedMessage {...messages.takeoverBy} />
                                    </p>
                                    {byRubytee && <p data-testid="genai-takeover-explanation">{byRubytee}</p>}
                                </div>
                            )}
                            {converted.fixes.length > 0 && <FixList fixes={converted.fixes} />}
                            {adapter.mountDiff ? (
                                converted.parts.map((part) => <LineDiff key={part.name} adapter={adapter} part={part} />)
                            ) : (
                                <ChangeList parts={converted.parts} several={converted.parts.length > 1} />
                            )}
                            <a href="#" data-testid="genai-ruby-toggle" onClick={handleToggleRuby}>
                                <FormattedMessage {...(showRuby ? messages.rubyHide : messages.rubyShow)} />
                            </a>
                            {showRuby && <pre className={styles.code}>{converted.code}</pre>}
                            <p className={styles.label}>
                                <FormattedMessage {...messages.reflectionLabel} />
                            </p>
                            <input
                                className={styles.url}
                                data-testid="genai-reflection"
                                value={reflection}
                                onChange={handleReflectionChange}
                            />
                            <p className={styles.small}>
                                <FormattedMessage
                                    {...(putsCode ? messages.applyReplacesCode : messages.applyReplaces)}
                                    values={{ names: quoteNames(converted.parts.map((part) => part.name)) }}
                                />
                            </p>
                        </div>
                    )}
                    {converted && !converted.ok && !running && (
                        <div className={styles.ng} data-testid="genai-convert-ng">
                            <p className={styles.verdict}>
                                <span className={styles.markNg}>✗</span>
                                <FormattedMessage {...messages.convertNg} />
                            </p>
                            {converted.fixes.length > 0 && <FixList fixes={converted.fixes} />}
                            <ProblemList problems={converted.problems} />
                            {takeover && takeover.state === 'failed' && (
                                <p className={styles.notice} data-testid="genai-takeover-failed">
                                    <FormattedMessage {...messages.takeoverFailed} values={{ count: takeover.tries }} />
                                </p>
                            )}
                            {takeover && takeover.state === 'error' && (
                                <p className={styles.notice} data-testid="genai-takeover-error">
                                    {takeoverErrorMessage(intl, takeover)}
                                </p>
                            )}
                            {notice && (
                                <p className={styles.notice} data-testid="genai-notice">
                                    {notice}
                                </p>
                            )}
                        </div>
                    )}
                </div>
                {running ? (
                <div className={styles.footer}>
                    <button data-testid="genai-takeover-cancel" onClick={handleCancelTakeover}>
                        <FormattedMessage {...messages.takeoverCancel} />
                    </button>
                </div>
                ) : (
                <div className={styles.footer}>
                    <button onClick={handleToCopy}>
                        <FormattedMessage {...messages.back} />
                    </button>
                    {!converted && (
                        <button
                            className={styles.primary}
                            data-testid="genai-convert"
                            disabled={!answer.trim() || checking}
                            onClick={handleConvert}
                        >
                            <FormattedMessage {...messages.convert} />
                        </button>
                    )}
                    {converted && converted.ok && (
                        <>
                            <button data-testid="genai-self" onClick={onClose}>
                                <FormattedMessage {...(putsCode ? messages.selfCode : messages.self)} />
                            </button>
                            <button
                                className={styles.primary}
                                data-testid="genai-apply"
                                disabled={reflection.trim().length < 5 || busy}
                                onClick={handleApply}
                            >
                                <FormattedMessage {...(putsCode ? messages.applyCode : messages.apply)} />
                            </button>
                        </>
                    )}
                    {converted && !converted.ok && canOfferTakeover({ failures, rubyteeAvailable }) && (
                        <button data-testid="genai-takeover" onClick={handleTakeover}>
                            <FormattedMessage {...messages.takeover} />
                        </button>
                    )}
                    {converted && !converted.ok && converted.code && (
                        <button
                            className={styles.primary}
                            data-testid="genai-copy-rewrite"
                            onClick={handleCopyRewrite}
                        >
                            <FormattedMessage {...messages.copyRewrite} />
                        </button>
                    )}
                </div>
                )}
            </>
        );
    }

    if (step === 'done' && snapshots) {
        const side = intl.formatMessage(applied ? messages.switchAfter : messages.switchBefore);
        return (
            <>
                <div className={styles.stepBody}>
                    <div className={styles.switch} role="group">
                        <button
                            className={applied ? '' : styles.switchOn}
                            data-side="before"
                            data-testid="genai-switch-before"
                            disabled={busy}
                            onClick={handleSwitch}
                        >
                            <FormattedMessage {...messages.switchBefore} />
                        </button>
                        <button
                            className={applied ? styles.switchOn : ''}
                            data-side="after"
                            data-testid="genai-switch-after"
                            disabled={busy}
                            onClick={handleSwitch}
                        >
                            <FormattedMessage {...messages.switchAfter} />
                        </button>
                    </div>
                    <p className={styles.switchState} data-testid="genai-switch-state">
                        <FormattedMessage
                            {...messages.switchState}
                            values={{
                                side: <strong>{side}</strong>,
                                names: quoteNames(snapshots.map((snap) => snap.name)),
                            }}
                        />
                    </p>
                    {putsCode &&
                        marks &&
                        marks.map((mark) => (
                            <p className={styles.small} data-testid="genai-lines-done" key={mark.name}>
                                <FormattedMessage {...messages.linesDone} values={mark.lines} />{' '}
                                <FormattedMessage {...messages.linesLegend} />
                            </p>
                        ))}
                    {!putsCode && marks && marks.length > 0 && (
                        <>
                            <ChangeList parts={marks} several={marks.length > 1} onShow={onShowBlocks} />
                            <p className={styles.small}>
                                <FormattedMessage {...messages.changesLegend} />
                            </p>
                        </>
                    )}
                    <p className={styles.small}>
                        <FormattedMessage {...messages.switchKeep} />{' '}
                        <FormattedMessage {...messages.memo} values={{ text: reflection }} />
                    </p>
                </div>
                <div className={styles.footer}>
                    <button data-testid="genai-again" onClick={onReset}>
                        <FormattedMessage {...messages.again} />
                    </button>
                    <button data-testid="genai-finish" onClick={onFinish}>
                        <FormattedMessage {...messages.finish} />
                    </button>
                </div>
            </>
        );
    }

    return null;
};

GenaiAnswerSteps.propTypes = {
    // Only the sprite in the editor is read here: the rest is the adapter's.
    vm: PropTypes.shape({
        editingTarget: PropTypes.object,
    }).isRequired,
    // What depends on the tab the panel is in (src/lib/genai-code-adapter.js describes it).
    adapter: PropTypes.shape({
        programs: PropTypes.func.isRequired,
        editingName: PropTypes.func.isRequired,
        takeoverState: PropTypes.func.isRequired,
        check: PropTypes.func.isRequired,
        apply: PropTypes.func.isRequired,
        switchSides: PropTypes.func.isRequired,
        watchMarks: PropTypes.func.isRequired,
        // 'code' when the answer goes into a code editor (the Ruby tab); blocks otherwise.
        puts: PropTypes.string,
        // Shows the line diff of a checked part in an element; returns the function taking it away.
        mountDiff: PropTypes.func,
    }).isRequired,
    serviceName: PropTypes.string,
    // The question copied to the AI first, and the trouble it was about: sent to Rubytee (#1282).
    prompt: PropTypes.string,
    troubleKind: PropTypes.string,
    troubleText: PropTypes.string,
    // The student's session in the class: the relay counts the takeover by seat with it.
    sessionToken: PropTypes.string,
    step: PropTypes.string.isRequired,
    notice: PropTypes.string,
    // The student's class uses Rubytee: 「ルビティーにまかせる」 can be offered.
    rubyteeAvailable: PropTypes.bool,
    // The panel is shown: the marks are only in the editor while it is (#1281).
    open: PropTypes.bool,
    onStep: PropTypes.func.isRequired,
    onCopy: PropTypes.func.isRequired,
    // Brings blocks of a sprite into view (and that sprite into the editor): (target, ids).
    onShowBlocks: PropTypes.func.isRequired,
    onClearNotice: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    // 「これで閉じる」: keep the version shown now and start afresh next time.
    onFinish: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    // 「ルビティーにまかせる」: called with the function starting it, once the consent is given.
    onTakeover: PropTypes.func.isRequired,
};

export default GenaiAnswerSteps;
