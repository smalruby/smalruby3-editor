// Step 3 of "生成AI に相談": paste the AI's answer back, check that it turns
// into blocks, put it in and switch between the two versions. Once checked, the
// answer folds away and the result takes its place (#1293 G7). The details of
// the result and the switch still keep the prototype's Japanese.
// Always mounted while the panel is open so going back a step keeps the answer.
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { buildRewritePrompt, extractRuby } from '../../lib/genai-prompt.js';
import { repairRuby, splitBySprite } from '../../lib/genai-repair.js';
import RubyGenerator from '../../lib/ruby-generator';
import { targetCodeToBlocks } from '../../lib/ruby-to-blocks-converter';
import styles from './genai-concierge.css';
import messages from './messages.js';

const errorText = (error) => {
    if (typeof error === 'string') return error;
    const where = error.row || error.row === 0 ? `${error.row + 1} 行目: ` : '';
    const text = error.text || error.message || JSON.stringify(error);
    return `${where}${text}`;
};

const FixList = ({ fixes }) => (
    <div className={styles.fixes} data-testid="genai-fixes">
        <p className={styles.small}>スモウルビーが直したところ:</p>
        <ul>
            {fixes.map((fix, i) => (
                <li key={i}>
                    {fix.name ? `「${fix.name}」` : ''}
                    {fix.line} 行目 <code>{fix.from}</code> → <code>{fix.to}</code>
                </li>
            ))}
        </ul>
    </div>
);

FixList.propTypes = {
    fixes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

const GenaiAnswerSteps = ({
    vm,
    rubyVersion,
    serviceName,
    step,
    notice,
    onStep,
    onCopy,
    onApplied,
    onClose,
    onReset,
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

    // Sprite name → target; the stage is called 「ステージ」 in the prompt.
    const targetsByName = useCallback(() => {
        const map = {};
        vm.runtime.targets
            .filter((t) => t.isOriginal)
            .forEach((t) => {
                map[t.isStage ? 'ステージ' : t.getName()] = t;
            });
        return map;
    }, [vm]);

    const convertAnswer = useCallback(async () => {
        const code = extractRuby(answer);
        if (!code) {
            setConverted({ ok: false, code: '', problems: ['貼りつけた文にプログラムが見つかりませんでした'] });
            setFailures((f) => f + 1);
            return;
        }
        const targets = targetsByName();
        const editing = vm.editingTarget;
        const editingName = editing.isStage ? 'ステージ' : editing.getName();
        const sections = splitBySprite(code, Object.keys(targets)) || [{ name: editingName, code }];
        const results = [];
        const problems = [];
        let rawCount = 0;
        for (const section of sections) {
            const target = targets[section.name];
            const repaired = repairRuby(section.code, {
                sounds: target.getSounds().map((sound) => sound.name),
                costumes: target.getCostumes().map((costume) => costume.name),
            });
            const prefix = sections.length > 1 ? `「${section.name}」の ` : '';
            try {
                const converter = await targetCodeToBlocks(vm, target, repaired.code, intl, {
                    version: rubyVersion,
                });
                if (converter.result) {
                    // Lines the converter could not map stay as "Ruby のまま" blocks; tell the student.
                    rawCount += Object.values(converter.blocks || {}).filter(
                        (b) => b.opcode === 'ruby_statement' || b.opcode === 'ruby_expression',
                    ).length;
                } else {
                    converter.errors.forEach((error) => problems.push(`${prefix}${errorText(error)}`));
                }
                results.push({ name: section.name, target, code: repaired.code, fixes: repaired.fixes, converter });
            } catch (e) {
                problems.push(`${prefix}${e.message || String(e)}`);
                results.push({ name: section.name, target, code: repaired.code, fixes: repaired.fixes });
            }
        }
        const repairedCode =
            sections.length > 1
                ? results.map((part) => `# 「${part.name}」\n${part.code}`).join('\n')
                : results[0].code;
        const fixes = results.flatMap((part) =>
            part.fixes.map((fix) => ({ ...fix, name: sections.length > 1 ? part.name : null })),
        );
        if (problems.length === 0) {
            setConverted({ ok: true, code: repairedCode, parts: results, rawCount, fixes });
        } else {
            setConverted({ ok: false, code: repairedCode, problems, fixes });
            setFailures((f) => f + 1);
        }
    }, [answer, vm, intl, rubyVersion, targetsByName]);

    const handleConvert = useCallback(async () => {
        setConverted(null);
        setAnswerOpen(false);
        setChecking(true);
        // Let the spinner paint before the (synchronous-heavy) conversion starts.
        await new Promise((resolve) => setTimeout(resolve, 50));
        try {
            await convertAnswer();
        } finally {
            setChecking(false);
        }
    }, [convertAnswer]);

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

    // Switch between the original and the AI's version. The side being left keeps whatever
    // the student changed meanwhile, so trying things out never throws their edits away.
    const handleSwitch = useCallback(
        async (e) => {
            const toAfter = e.currentTarget.dataset.side === 'after';
            if (toAfter === applied || busy) return;
            setBusy(true);
            const next = snapshots.map((snap) => {
                const current = RubyGenerator.targetToCode(snap.target, { version: rubyVersion });
                return toAfter ? { ...snap, before: current } : { ...snap, after: current };
            });
            for (const snap of next) {
                await loadCode(snap.target, toAfter ? snap.after : snap.before);
            }
            setSnapshots(next);
            setApplied(toAfter);
            setBusy(false);
        },
        [applied, busy, snapshots, rubyVersion, loadCode],
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
    const handleCopyRewrite = useCallback(
        () => onCopy(buildRewritePrompt({ code: converted.code, problems: converted.problems }), 'rewrite'),
        [onCopy, converted],
    );

    if (step === 'paste') {
        const answerShown = !converted || answerOpen;
        return (
            <>
                <div className={styles.stepBody}>
                    <p className={styles.question}>
                        <FormattedMessage {...messages.pasteQuestion} values={{ name: serviceName || '' }} />
                    </p>
                    {converted && (
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
                            ブロックにできるか調べています…
                        </div>
                    )}
                    {converted && converted.ok && (
                        <div className={styles.ok} data-testid="genai-convert-ok">
                            <p className={styles.verdict}>
                                <span className={styles.markOk}>✔</span>
                                ブロックにできます
                            </p>
                            {converted.fixes && converted.fixes.length > 0 && <FixList fixes={converted.fixes} />}
                            {converted.rawCount > 0 && (
                                <p className={styles.small} data-testid="genai-raw-count">
                                    ※ {converted.rawCount} か所は、ふつうのブロックにならず「Ruby
                                    のまま」のブロックになります。
                                </p>
                            )}
                            <a href="#" onClick={handleToggleRuby}>
                                {showRuby ? 'Ruby をかくす' : 'Ruby を見る'}
                            </a>
                            {showRuby && <pre className={styles.code}>{converted.code}</pre>}
                            <p className={styles.label}>どこが変わるのか、自分のことばで 1 行書こう（必須）</p>
                            <input
                                className={styles.url}
                                data-testid="genai-reflection"
                                value={reflection}
                                onChange={handleReflectionChange}
                            />
                            <p className={styles.small}>
                                入れると、{converted.parts.map((part) => `「${part.name}」`).join('')}
                                のブロックが置きかわります。
                            </p>
                        </div>
                    )}
                    {converted && !converted.ok && (
                        <div className={styles.ng} data-testid="genai-convert-ng">
                            <p className={styles.verdict}>
                                <span className={styles.markNg}>✗</span>
                                このままではブロックにできません
                            </p>
                            {converted.fixes && converted.fixes.length > 0 && <FixList fixes={converted.fixes} />}
                            <ul>
                                {converted.problems.slice(0, 5).map((p, i) => (
                                    <li key={i}>{p}</li>
                                ))}
                            </ul>
                            {failures >= 2 && (
                                <p className={styles.small}>
                                    （本番では、ここで「ルビティーにまかせる」が出る予定です）
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
                                自分で組む
                            </button>
                            <button
                                className={styles.primary}
                                data-testid="genai-apply"
                                disabled={reflection.trim().length < 5 || busy}
                                onClick={handleApply}
                            >
                                このブロックを入れる
                            </button>
                        </>
                    )}
                    {converted && !converted.ok && converted.code && (
                        <button
                            className={styles.primary}
                            data-testid="genai-copy-rewrite"
                            onClick={handleCopyRewrite}
                        >
                            書き直しのお願いをコピー
                        </button>
                    )}
                </div>
            </>
        );
    }

    if (step === 'done' && snapshots) {
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
                            元のプログラム
                        </button>
                        <button
                            className={applied ? styles.switchOn : ''}
                            data-side="after"
                            data-testid="genai-switch-after"
                            disabled={busy}
                            onClick={handleSwitch}
                        >
                            生成AI の案
                        </button>
                    </div>
                    <p className={styles.switchState} data-testid="genai-switch-state">
                        いまは<strong>{applied ? '生成AI の案' : '元のプログラム'}</strong>
                        が入っています（{snapshots.map((snap) => `「${snap.name}」`).join('')}
                        ）。旗をおして、動きを比べてみよう。
                    </p>
                    <p className={styles.small}>
                        切りかえても、それぞれで自分が変えたところは残ります。 あなたのメモ: {reflection}
                    </p>
                </div>
                <div className={styles.footer}>
                    <button data-testid="genai-again" onClick={onReset}>
                        もう一度相談する
                    </button>
                    <button data-testid="genai-finish" onClick={onClose}>
                        これで閉じる
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
    onStep: PropTypes.func.isRequired,
    onCopy: PropTypes.func.isRequired,
    onApplied: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
};

export default GenaiAnswerSteps;
