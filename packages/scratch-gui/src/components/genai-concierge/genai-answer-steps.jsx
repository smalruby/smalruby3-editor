// Step 3 of "生成AI に相談" (#1280): paste the AI's answer back, check that it turns
// into blocks, put it in and switch between the two versions. Once checked, the
// answer folds away and the result takes its place (#1293 G7).
// Always mounted while the panel has been opened (also while it is closed) so going
// back a step or closing the panel keeps the answer and the two versions.
// The blocks the AI's version adds or changes are listed in the words of the blocks,
// and marked in the editor while that version is in (#1281).
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { checkAnswer, liveSnapshots, problemToJapanese, switchSnapshots } from '../../lib/genai-answer.js';
import { describeChanges, diffBlocks } from '../../lib/genai-block-diff.js';
import { afterBlocksRender, canOfferTakeover } from '../../lib/genai-concierge-state.js';
import { buildRewritePrompt } from '../../lib/genai-prompt.js';
import RubyGenerator from '../../lib/ruby-generator';
import { targetCodeToBlocks } from '../../lib/ruby-to-blocks-converter';
import styles from './genai-concierge.css';
import messages from './messages.js';

// The stage is called 「ステージ」 in the question to the AI.
const nameOf = (target) => (target.isStage ? 'ステージ' : target.getName());

const quoteNames = (names) => names.map((name) => `「${name}」`).join('');

// The classes the marks in the editor get (styled in genai-concierge.css).
const MARK_CLASSES = { added: 'genaiMarkAdded', changed: 'genaiMarkChanged' };
// Lines of the list shown before 「ほかに N か所」.
const MAX_CHANGES = 6;

// A copy of a target's blocks that deleting them (on putting other blocks in) leaves
// intact: deleteBlock changes the block objects themselves.
const copyBlocks = (target) => {
    const copy = {};
    Object.keys(target.blocks._blocks).forEach((id) => {
        copy[id] = { ...target.blocks._blocks[id] };
    });
    return copy;
};

const changesOf = (before, after, scratchBlocks) =>
    describeChanges(diffBlocks(before, after), before, after, scratchBlocks ? scratchBlocks.Blocks : null);

// Add or remove the marks of the sprite shown in the editor.
const paintMarks = (workspace, changes, on) => {
    changes.forEach((change) => {
        const className = MARK_CLASSES[change.kind];
        const block = className && workspace.getBlockById(change.id);
        if (!block || typeof block.addClass !== 'function') return;
        if (on) block.addClass(className);
        else block.removeClass(className);
    });
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

const GenaiAnswerSteps = ({
    vm,
    rubyVersion,
    serviceName,
    step,
    notice,
    rubyteeAvailable,
    scratchBlocks,
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

    // Mark the blocks of the sprite in the editor, again each time the editor shows
    // another sprite (or the same one afresh), and take the marks away afterwards.
    // The marks are only there while the panel is open: closing it with × takes them
    // away and opening it again puts them back (#1281 FYI3). The new blocks of a
    // workspace update are marked once Blockly has drawn them, not after a fixed
    // time that a slow PC can overrun (#1281 Q1).
    useEffect(() => {
        const workspace = scratchBlocks && scratchBlocks.getMainWorkspace && scratchBlocks.getMainWorkspace();
        if (!marks || !workspace || !open) return;
        let painted = [];
        let active = true;
        const paint = () => {
            if (!active) return;
            if (painted.length > 0) paintMarks(workspace, painted, false);
            const shown = marks.find((mark) => mark.target === vm.editingTarget);
            painted = shown ? shown.changes : [];
            paintMarks(workspace, painted, true);
        };
        const later = () => {
            afterBlocksRender(scratchBlocks).then(paint);
        };
        paint();
        later();
        vm.on('workspaceUpdate', later);
        return () => {
            active = false;
            vm.removeListener('workspaceUpdate', later);
            paintMarks(workspace, painted, false);
        };
    }, [marks, open, vm, scratchBlocks]);

    const convertAnswer = useCallback(async () => {
        const targets = {};
        vm.runtime.targets
            .filter((t) => t.isOriginal)
            .forEach((t) => {
                targets[nameOf(t)] = t;
            });
        const result = await checkAnswer({
            answer,
            sprites: Object.keys(targets).map((name) => ({
                name,
                sounds: targets[name].getSounds().map((sound) => sound.name),
                costumes: targets[name].getCostumes().map((costume) => costume.name),
            })),
            editingName: nameOf(vm.editingTarget),
            convert: (name, code) => targetCodeToBlocks(vm, targets[name], code, intl, { version: rubyVersion }),
        });
        result.parts.forEach((part) => {
            part.target = targets[part.name];
            part.changes =
                result.ok && part.converter
                    ? changesOf(copyBlocks(part.target), part.converter.blocks, scratchBlocks)
                    : [];
        });
        setConverted(result);
        if (!result.ok) setFailures((f) => f + 1);
    }, [answer, vm, intl, rubyVersion, scratchBlocks]);

    const handleConvert = useCallback(async () => {
        setConverted(null);
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

    // Resolves to what the blocks put in add or change.
    const loadCode = useCallback(
        async (target, code) => {
            const converter = await targetCodeToBlocks(vm, target, code || '', intl, { version: rubyVersion });
            if (!converter.result) return [];
            const before = copyBlocks(target);
            await converter.apply();
            return changesOf(before, target.blocks._blocks, scratchBlocks);
        },
        [vm, intl, rubyVersion, scratchBlocks],
    );

    // Bring the marked blocks into view: those of the sprite in the editor first.
    const showMarks = useCallback(
        (next) => {
            const marked = next.filter((mark) => mark.changes.some((change) => change.kind !== 'removed'));
            const mark = marked.find((m) => m.target === vm.editingTarget) || marked[0];
            onShowBlocks(
                mark ? mark.target : null,
                mark ? mark.changes.filter((change) => change.kind !== 'removed').map((change) => change.id) : [],
            );
        },
        [vm, onShowBlocks],
    );

    // busy is reset in finally: an exception from apply() must not leave the buttons disabled (#1280 Q1).
    const handleApply = useCallback(async () => {
        setBusy(true);
        try {
            const taken = converted.parts.map((part) => ({
                target: part.target,
                name: part.name,
                before: RubyGenerator.targetToCode(part.target, { version: rubyVersion }),
                after: part.code,
            }));
            const next = [];
            for (const part of converted.parts) {
                const before = copyBlocks(part.target);
                await part.converter.apply();
                next.push({
                    target: part.target,
                    name: part.name,
                    changes: changesOf(before, part.target.blocks._blocks, scratchBlocks),
                });
            }
            setSnapshots(taken);
            setApplied(true);
            setMarks(next);
            onStep('done');
            showMarks(next);
        } finally {
            setBusy(false);
        }
    }, [rubyVersion, converted, scratchBlocks, onStep, showMarks]);

    // Switch between the original and the AI's version (switchSnapshots keeps the
    // student's changes on the side being left). A sprite deleted meanwhile drops out.
    const handleSwitch = useCallback(
        async (e) => {
            const toAfter = e.currentTarget.dataset.side === 'after';
            if (toAfter === applied || busy) return;
            setBusy(true);
            try {
                const live = liveSnapshots(snapshots, vm.runtime.targets);
                const next = switchSnapshots(
                    live,
                    toAfter,
                    live.map((snap) => RubyGenerator.targetToCode(snap.target, { version: rubyVersion })),
                );
                const nextMarks = [];
                for (const snap of next) {
                    const changes = await loadCode(snap.target, toAfter ? snap.after : snap.before);
                    nextMarks.push({ target: snap.target, name: snap.name, changes });
                }
                setSnapshots(next);
                setApplied(toAfter);
                // The original program has no marks: what it lacks is in the AI's version.
                setMarks(toAfter ? nextMarks : null);
                if (toAfter) showMarks(nextMarks);
            } finally {
                setBusy(false);
            }
        },
        [applied, busy, snapshots, vm, rubyVersion, loadCode, showMarks],
    );

    const handleReflectionChange = useCallback((e) => setReflection(e.target.value), []);
    const handleAnswerChange = useCallback((e) => {
        setAnswer(e.target.value);
        setConverted(null);
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
    const handleCopyRewrite = useCallback(
        () =>
            onCopy(
                buildRewritePrompt({ code: converted.code, problems: converted.problems.map(problemToJapanese) }),
                'rewrite',
            ),
        [onCopy, converted],
    );

    if (step === 'paste') {
        // No program was found in what was pasted: the only thing to do is to paste again,
        // so the answer stays open (folding it would leave no button to go on with).
        const canFold = Boolean(converted && converted.code);
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
                            onChange={handleAnswerChange}
                        />
                    )}
                    {checking && (
                        <div className={styles.checking} data-testid="genai-checking">
                            <span className={styles.spinner} />
                            <FormattedMessage {...messages.checking} />
                        </div>
                    )}
                    {converted && converted.ok && (
                        <div className={styles.ok} data-testid="genai-convert-ok">
                            <p className={styles.verdict}>
                                <span className={styles.markOk}>✔</span>
                                <FormattedMessage {...messages.convertOk} />
                            </p>
                            {converted.fixes.length > 0 && <FixList fixes={converted.fixes} />}
                            <ChangeList parts={converted.parts} several={converted.parts.length > 1} />
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
                                    {...messages.applyReplaces}
                                    values={{ names: quoteNames(converted.parts.map((part) => part.name)) }}
                                />
                            </p>
                        </div>
                    )}
                    {converted && !converted.ok && (
                        <div className={styles.ng} data-testid="genai-convert-ng">
                            <p className={styles.verdict}>
                                <span className={styles.markNg}>✗</span>
                                <FormattedMessage {...messages.convertNg} />
                            </p>
                            {converted.fixes.length > 0 && <FixList fixes={converted.fixes} />}
                            <ProblemList problems={converted.problems} />
                            {notice && (
                                <p className={styles.notice} data-testid="genai-notice">
                                    {notice}
                                </p>
                            )}
                        </div>
                    )}
                </div>
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
                                <FormattedMessage {...messages.self} />
                            </button>
                            <button
                                className={styles.primary}
                                data-testid="genai-apply"
                                disabled={reflection.trim().length < 5 || busy}
                                onClick={handleApply}
                            >
                                <FormattedMessage {...messages.apply} />
                            </button>
                        </>
                    )}
                    {converted && !converted.ok && canOfferTakeover({ failures, rubyteeAvailable }) && (
                        <button data-testid="genai-takeover" onClick={onTakeover}>
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
                    {marks && (
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
    vm: PropTypes.shape({
        editingTarget: PropTypes.object,
        runtime: PropTypes.object,
        on: PropTypes.func,
        removeListener: PropTypes.func,
    }).isRequired,
    rubyVersion: PropTypes.string,
    serviceName: PropTypes.string,
    step: PropTypes.string.isRequired,
    notice: PropTypes.string,
    // The student's class uses Rubytee: 「ルビティーにまかせる」 can be offered.
    rubyteeAvailable: PropTypes.bool,
    // ScratchBlocks: the words of the blocks and the editor to mark them in.
    scratchBlocks: PropTypes.shape({
        Blocks: PropTypes.object,
        getMainWorkspace: PropTypes.func,
        renderManagement: PropTypes.object,
    }),
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
    onTakeover: PropTypes.func.isRequired,
};

export default GenaiAnswerSteps;
