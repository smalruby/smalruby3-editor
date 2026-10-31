// Step 3 of "生成AI に相談" (#1280): paste the AI's answer back, check that it turns
// into blocks, put it in and switch between the two versions. Once checked, the
// answer folds away and the result takes its place (#1293 G7).
// Always mounted while the panel has been opened (also while it is closed) so going
// back a step or closing the panel keeps the answer and the two versions.
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { checkAnswer, liveSnapshots, problemToJapanese, switchSnapshots } from '../../lib/genai-answer.js';
import { canOfferTakeover } from '../../lib/genai-concierge-state.js';
import { buildRewritePrompt } from '../../lib/genai-prompt.js';
import RubyGenerator from '../../lib/ruby-generator';
import { targetCodeToBlocks } from '../../lib/ruby-to-blocks-converter';
import styles from './genai-concierge.css';
import messages from './messages.js';

// The stage is called 「ステージ」 in the question to the AI.
const nameOf = (target) => (target.isStage ? 'ステージ' : target.getName());

const quoteNames = (names) => names.map((name) => `「${name}」`).join('');

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

const GenaiAnswerSteps = ({
    vm,
    rubyVersion,
    serviceName,
    step,
    notice,
    rubyteeAvailable,
    onStep,
    onCopy,
    onApplied,
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
        });
        setConverted(result);
        if (!result.ok) setFailures((f) => f + 1);
    }, [answer, vm, intl, rubyVersion]);

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

    const loadCode = useCallback(
        async (target, code) => {
            const converter = await targetCodeToBlocks(vm, target, code || '', intl, { version: rubyVersion });
            if (converter.result) await converter.apply();
        },
        [vm, intl, rubyVersion],
    );

    const handleApply = useCallback(async () => {
        setBusy(true);
        const taken = converted.parts.map((part) => ({
            target: part.target,
            name: part.name,
            before: RubyGenerator.targetToCode(part.target, { version: rubyVersion }),
            after: part.code,
        }));
        for (const part of converted.parts) {
            await part.converter.apply();
        }
        setSnapshots(taken);
        setApplied(true);
        setBusy(false);
        onStep('done');
        onApplied();
    }, [rubyVersion, converted, onStep, onApplied]);

    // Switch between the original and the AI's version (switchSnapshots keeps the
    // student's changes on the side being left). A sprite deleted meanwhile drops out.
    const handleSwitch = useCallback(
        async (e) => {
            const toAfter = e.currentTarget.dataset.side === 'after';
            if (toAfter === applied || busy) return;
            setBusy(true);
            const live = liveSnapshots(snapshots, vm.runtime.targets);
            const next = switchSnapshots(
                live,
                toAfter,
                live.map((snap) => RubyGenerator.targetToCode(snap.target, { version: rubyVersion })),
            );
            for (const snap of next) {
                await loadCode(snap.target, toAfter ? snap.after : snap.before);
            }
            setSnapshots(next);
            setApplied(toAfter);
            setBusy(false);
        },
        [applied, busy, snapshots, vm, rubyVersion, loadCode],
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
    }).isRequired,
    rubyVersion: PropTypes.string,
    serviceName: PropTypes.string,
    step: PropTypes.string.isRequired,
    notice: PropTypes.string,
    // The student's class uses Rubytee: 「ルビティーにまかせる」 can be offered.
    rubyteeAvailable: PropTypes.bool,
    onStep: PropTypes.func.isRequired,
    onCopy: PropTypes.func.isRequired,
    onApplied: PropTypes.func.isRequired,
    onClearNotice: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    // 「これで閉じる」: keep the version shown now and start afresh next time.
    onFinish: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    onTakeover: PropTypes.func.isRequired,
};

export default GenaiAnswerSteps;
