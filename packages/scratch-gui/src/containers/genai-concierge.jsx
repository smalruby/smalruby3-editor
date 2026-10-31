// Prototype of "生成AI に相談" for block programming (?features=genai): the
// student copies a prompt into the school's generative AI chat, then pastes
// the answer back and turns the Ruby in it into blocks. Japanese only for now.
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import rubyteeIcon from '../components/ruby-toolbar/icon--rubytee.svg';
import {
    PROBLEM_KINDS,
    buildGenaiPrompt,
    buildRewritePrompt,
    extractRuby,
    splitPrompt,
} from '../lib/genai-prompt.js';
import { repairRuby, splitBySprite } from '../lib/genai-repair.js';
import RubyGenerator from '../lib/ruby-generator';
import { targetCodeToBlocks } from '../lib/ruby-to-blocks-converter';
import { getUrlParams } from '../lib/url-params.js';
import styles from './genai-concierge.css';

const NUDGE_OFF_KEY = 'smalruby:genaiNudgeOff';
const SERVICE_KEY = 'smalruby:genaiService';
const NUDGE_GAP_MS = 10 * 60 * 1000;

const SERVICES = [
    { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app' },
    { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
];

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
        // private mode etc.: the prototype works without remembering
    }
};

const idleSeconds = () => getUrlParams().genaiIdle || 150;

// The left edge of the script area right of the block palette, so the face does not cover blocks.
const measureLeft = (root) => {
    const flyout = document.querySelector('.blocklyFlyout');
    const parent = root && root.offsetParent;
    if (!flyout || !parent) return 12;
    const right = flyout.getBoundingClientRect().right - parent.getBoundingClientRect().left;
    return Math.max(12, Math.round(right + 12));
};

const errorText = (error) => {
    if (typeof error === 'string') return error;
    const where = error.row || error.row === 0 ? `${error.row + 1} 行目: ` : '';
    const text = error.text || error.message || JSON.stringify(error);
    return `${where}${text}`;
};

const GenaiConcierge = ({ vm, rubyVersion, assignmentName }) => {
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
    const [service, setService] = useState(() => readStorage(SERVICE_KEY));
    const [customUrl, setCustomUrl] = useState('');
    const [answer, setAnswer] = useState('');
    const [converted, setConverted] = useState(null);
    const [failures, setFailures] = useState(0);
    const [showRuby, setShowRuby] = useState(false);
    const [reflection, setReflection] = useState('');
    const [undoCode, setUndoCode] = useState(null); // [{target, code}] before applying
    const [notice, setNotice] = useState('');
    const aiWindow = useRef(null);
    const rootRef = useRef(null);
    const lastActivity = useRef(Date.now());
    const lastNudge = useRef(0);

    useEffect(() => {
        const update = () => setLeft(measureLeft(rootRef.current));
        update();
        const timer = setInterval(update, 1000);
        window.addEventListener('resize', update);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', update);
        };
    }, []);

    // Offer help after the student has done nothing for a while.
    useEffect(() => {
        const touch = () => {
            lastActivity.current = Date.now();
        };
        const events = ['pointerdown', 'keydown', 'wheel'];
        events.forEach((name) => window.addEventListener(name, touch, true));
        vm.on('PROJECT_CHANGED', touch);
        const idleMs = idleSeconds() * 1000;
        const timer = setInterval(() => {
            if (open || nudge || readStorage(NUDGE_OFF_KEY) === 'true') return;
            const now = Date.now();
            if (now - lastActivity.current < idleMs) return;
            if (lastNudge.current && now - lastNudge.current < Math.min(NUDGE_GAP_MS, idleMs * 4)) return;
            lastNudge.current = now;
            setNudge(true);
        }, 1000);
        return () => {
            events.forEach((name) => window.removeEventListener(name, touch, true));
            vm.removeListener('PROJECT_CHANGED', touch);
            clearInterval(timer);
        };
    }, [vm, open, nudge]);

    const kind = PROBLEM_KINDS.find((k) => k.id === kindId);

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
        setAnswer('');
        setConverted(null);
        setFailures(0);
        setReflection('');
        setNotice('');
    }, []);

    const handleKind = useCallback(
        (k) => {
            setKindId(k.id);
            if (!text.trim()) setText(k.starter);
        },
        [text],
    );

    const handleMakePrompt = useCallback(() => {
        const editing = vm.editingTarget;
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
                kindLabel: kind.label,
                text,
                programs,
                editingName: editing && !editing.isStage ? editing.getName() : null,
                assignmentName,
            }),
        );
        setParts(1);
        setCopied({});
        setStep('copy');
    }, [vm, rubyVersion, kind, text, assignmentName]);

    // Copy first (the click is the user gesture the clipboard needs), then reuse one AI tab.
    const copyAndOpen = useCallback(
        async (content, key) => {
            try {
                await navigator.clipboard.writeText(content);
                setCopied((c) => ({ ...c, [key]: true }));
                setNotice('コピーしました。生成AI の入力らんに貼りつけて（Ctrl+V）送ってね。');
            } catch {
                setNotice('コピーできませんでした。下の文を全部えらんで、Ctrl+C でコピーしてね。');
            }
            const known = SERVICES.find((s) => s.id === service);
            const url = known ? known.url : service && service.startsWith('https://') ? service : null;
            if (!url) return;
            if (aiWindow.current && !aiWindow.current.closed) {
                aiWindow.current.focus();
            } else {
                aiWindow.current = window.open(url, 'smalruby-genai');
            }
        },
        [service],
    );

    const chooseService = (id) => {
        setService(id);
        writeStorage(SERVICE_KEY, id);
    };

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

    const handleConvert = useCallback(async () => {
        setNotice('');
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

    const handleApply = useCallback(async () => {
        const before = converted.parts.map((part) => ({
            target: part.target,
            code: RubyGenerator.targetToCode(part.target, { version: rubyVersion }),
        }));
        for (const part of converted.parts) {
            await part.converter.apply();
        }
        setUndoCode(before);
        setStep('done');
    }, [rubyVersion, converted]);

    const handleUndo = useCallback(async () => {
        for (const entry of undoCode) {
            const converter = await targetCodeToBlocks(vm, entry.target, entry.code || '', intl, {
                version: rubyVersion,
            });
            if (converter.result) await converter.apply();
        }
        setUndoCode(null);
        setNotice('元のブロックにもどしました。');
    }, [vm, undoCode, intl, rubyVersion]);

    const handleNudgeLater = useCallback(() => setNudge(false), []);
    const handleNudgeOff = useCallback(() => {
        writeStorage(NUDGE_OFF_KEY, 'true');
        setNudge(false);
    }, []);
    const handleKindClick = useCallback(
        (e) => handleKind(PROBLEM_KINDS.find((k) => k.id === e.currentTarget.dataset.kind)),
        [handleKind],
    );
    const handleTextChange = useCallback((e) => setText(e.target.value), []);
    const handlePromptChange = useCallback((e) => setPrompt(e.target.value), []);
    const handleCustomUrlChange = useCallback((e) => setCustomUrl(e.target.value), []);
    const handleReflectionChange = useCallback((e) => setReflection(e.target.value), []);
    const handleAnswerChange = useCallback((e) => {
        setAnswer(e.target.value);
        setConverted(null);
    }, []);
    const handleServiceClick = useCallback((e) => chooseService(e.currentTarget.dataset.service), []);
    const handleCustomService = useCallback(() => chooseService(customUrl), [customUrl]);
    const handleChangeService = useCallback((e) => {
        e.preventDefault();
        setService(null);
    }, []);
    const handleSplit = useCallback((e) => {
        e.preventDefault();
        setParts((p) => Math.min(p + 1, 4));
        setCopied({});
    }, []);
    const handleToTrouble = useCallback(() => setStep('trouble'), []);
    const handleToCopy = useCallback(() => setStep('copy'), []);
    const handleToPaste = useCallback(() => {
        setNotice('');
        setStep('paste');
    }, []);
    const handleToggleRuby = useCallback((e) => {
        e.preventDefault();
        setShowRuby((v) => !v);
    }, []);

    const partList = splitPrompt(prompt, parts);
    const handleCopyPrompt = useCallback(() => copyAndOpen(prompt, 0), [copyAndOpen, prompt]);
    const handleCopyPart = useCallback(
        (e) => {
            const index = Number(e.currentTarget.dataset.index);
            copyAndOpen(splitPrompt(prompt, parts)[index], index);
        },
        [copyAndOpen, prompt, parts],
    );
    const handleCopyRewrite = useCallback(
        () => copyAndOpen(buildRewritePrompt({ code: converted.code, problems: converted.problems }), 'rewrite'),
        [copyAndOpen, converted],
    );

    return (
        <div className={styles.root} ref={rootRef} style={{ left }}>
            {nudge && !open && (
                <div className={styles.bubble} data-testid="genai-nudge">
                    <p>手が止まっているみたい。生成AI に相談してみる？</p>
                    <div className={styles.row}>
                        <button className={styles.primary} data-testid="genai-nudge-open" onClick={handleOpen}>
                            相談する
                        </button>
                        <button data-testid="genai-nudge-later" onClick={handleNudgeLater}>
                            あとで
                        </button>
                        <button data-testid="genai-nudge-off" onClick={handleNudgeOff}>
                            今日は出さない
                        </button>
                    </div>
                </div>
            )}
            {open && (
                <div className={styles.panel} data-testid="genai-panel">
                    <div className={styles.header}>
                        <span>生成AI に相談（プロトタイプ）</span>
                        <button
                            className={styles.close}
                            data-testid="genai-close"
                            onClick={handleClose}
                            aria-label="閉じる"
                        >
                            ×
                        </button>
                    </div>
                    <ol className={styles.steps}>
                        <li className={step === 'trouble' ? styles.current : ''}>1 困りごと</li>
                        <li className={step === 'copy' ? styles.current : ''}>2 コピーして相談</li>
                        <li className={step === 'paste' || step === 'done' ? styles.current : ''}>3 貼りもどす</li>
                    </ol>
                    <div className={styles.body}>
                        {step === 'trouble' && (
                            <>
                                <p className={styles.label}>どんなことで困っている？</p>
                                <div className={styles.chips}>
                                    {PROBLEM_KINDS.map((k) => (
                                        <button
                                            key={k.id}
                                            className={k.id === kindId ? styles.chipOn : styles.chip}
                                            data-testid={`genai-kind-${k.id}`}
                                            data-kind={k.id}
                                            onClick={handleKindClick}
                                        >
                                            {k.label}
                                        </button>
                                    ))}
                                </div>
                                <p className={styles.label}>自分のことばで書こう（必須）</p>
                                <textarea
                                    className={styles.text}
                                    data-testid="genai-trouble-text"
                                    rows={3}
                                    value={text}
                                    onChange={handleTextChange}
                                />
                                <div className={styles.row}>
                                    <button
                                        className={styles.primary}
                                        data-testid="genai-make-prompt"
                                        disabled={!kind || !text.trim() || (kind && text.trim() === kind.starter)}
                                        onClick={handleMakePrompt}
                                    >
                                        相談文をつくる
                                    </button>
                                </div>
                            </>
                        )}
                        {step === 'copy' && (
                            <>
                                {!service && (
                                    <div className={styles.service}>
                                        <p className={styles.label}>学校で使っている生成AI はどれ？</p>
                                        <div className={styles.row}>
                                            {SERVICES.map((s) => (
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
                                                placeholder="ほかの生成AI の URL（https://…）"
                                                value={customUrl}
                                                onChange={handleCustomUrlChange}
                                            />
                                            <button
                                                disabled={!customUrl.startsWith('https://')}
                                                onClick={handleCustomService}
                                            >
                                                これにする
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {service && (
                                    <p className={styles.small}>
                                        相談先: {(SERVICES.find((s) => s.id === service) || {}).label || service}{' '}
                                        <a href="#" data-testid="genai-service-change" onClick={handleChangeService}>
                                            かえる
                                        </a>
                                    </p>
                                )}
                                {parts === 1 ? (
                                    <>
                                        <p className={styles.label}>生成AI に送る相談文（直してもいいよ）</p>
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
                                                disabled={!service}
                                                onClick={handleCopyPrompt}
                                            >
                                                コピーして生成AI を開く
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className={styles.label}>
                                            {parts} つに分けたよ。1 つずつ順番に貼りつけて送ってね。
                                        </p>
                                        {partList.map((part, i) => (
                                            <div key={i} className={styles.partRow}>
                                                <button
                                                    className={copied[i] ? '' : styles.primary}
                                                    data-testid={`genai-copy-part-${i + 1}`}
                                                    disabled={!service}
                                                    data-index={i}
                                                    onClick={handleCopyPart}
                                                >
                                                    {copied[i] ? '✓ ' : ''}
                                                    {i + 1} つ目をコピー
                                                </button>
                                                <span className={styles.small}>{part.length} 文字</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                                <p className={styles.small}>
                                    {prompt.length} 文字{' '}
                                    <a href="#" data-testid="genai-split" onClick={handleSplit}>
                                        生成AI に貼れなかった・長すぎると言われた
                                    </a>
                                </p>
                                {notice && <p className={styles.notice}>{notice}</p>}
                                <div className={styles.row}>
                                    <button onClick={handleToTrouble}>もどる</button>
                                    <button
                                        className={styles.primary}
                                        data-testid="genai-to-paste"
                                        onClick={handleToPaste}
                                    >
                                        答えをもらったら次へ
                                    </button>
                                </div>
                            </>
                        )}
                        {step === 'paste' && (
                            <>
                                <p className={styles.label}>
                                    生成AI の答えの中の、説明を読んでから使おう。
                                    <br />
                                    プログラムをもらったら、「▼▼」から「▲▲」までをコピーして貼りつけてね。
                                </p>
                                <textarea
                                    className={styles.prompt}
                                    data-testid="genai-answer"
                                    value={answer}
                                    onChange={handleAnswerChange}
                                />
                                <div className={styles.row}>
                                    <button onClick={handleToCopy}>もどる</button>
                                    <button
                                        className={styles.primary}
                                        data-testid="genai-convert"
                                        disabled={!answer.trim()}
                                        onClick={handleConvert}
                                    >
                                        ブロックにできるか調べる
                                    </button>
                                </div>
                                {converted && converted.ok && (
                                    <div className={styles.ok} data-testid="genai-convert-ok">
                                        <p>ブロックにできました。</p>
                                        {converted.fixes && converted.fixes.length > 0 && (
                                            <div className={styles.fixes} data-testid="genai-fixes">
                                                <p className={styles.small}>スモウルビーが直したところ:</p>
                                                <ul>
                                                    {converted.fixes.map((fix, i) => (
                                                        <li key={i}>
                                                            {fix.name ? `「${fix.name}」` : ''}
                                                            {fix.line} 行目 <code>{fix.from}</code> →{' '}
                                                            <code>{fix.to}</code>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

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
                                        <p className={styles.label}>
                                            どこが変わるのか、自分のことばで 1 行書こう（必須）
                                        </p>
                                        <input
                                            className={styles.url}
                                            data-testid="genai-reflection"
                                            value={reflection}
                                            onChange={handleReflectionChange}
                                        />
                                        <div className={styles.row}>
                                            <button
                                                className={styles.primary}
                                                data-testid="genai-apply"
                                                disabled={reflection.trim().length < 5}
                                                onClick={handleApply}
                                            >
                                                このブロックを入れる
                                            </button>
                                            <button data-testid="genai-self" onClick={handleClose}>
                                                自分で組む
                                            </button>
                                        </div>
                                        <p className={styles.small}>
                                            入れると、{converted.parts.map((part) => `「${part.name}」`).join('')}
                                            のブロックが置きかわります。
                                        </p>
                                    </div>
                                )}
                                {converted && !converted.ok && (
                                    <div className={styles.ng} data-testid="genai-convert-ng">
                                        <p>ブロックにできないところがありました。</p>
                                        {converted.fixes && converted.fixes.length > 0 && (
                                            <div className={styles.fixes} data-testid="genai-fixes">
                                                <p className={styles.small}>スモウルビーが直したところ:</p>
                                                <ul>
                                                    {converted.fixes.map((fix, i) => (
                                                        <li key={i}>
                                                            {fix.name ? `「${fix.name}」` : ''}
                                                            {fix.line} 行目 <code>{fix.from}</code> →{' '}
                                                            <code>{fix.to}</code>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <ul>
                                            {converted.problems.slice(0, 5).map((p, i) => (
                                                <li key={i}>{p}</li>
                                            ))}
                                        </ul>
                                        {converted.code && (
                                            <button
                                                className={styles.primary}
                                                data-testid="genai-copy-rewrite"
                                                onClick={handleCopyRewrite}
                                            >
                                                書き直しのお願いをコピー
                                            </button>
                                        )}
                                        {failures >= 2 && (
                                            <p className={styles.small}>
                                                （本番では、ここで「ルビティーにまかせる」が出る予定です）
                                            </p>
                                        )}
                                        {notice && <p className={styles.notice}>{notice}</p>}
                                    </div>
                                )}
                            </>
                        )}
                        {step === 'done' && (
                            <>
                                <p>ブロックを入れました。旗をおして動かしてみよう。</p>
                                <p className={styles.small}>あなたのメモ: {reflection}</p>
                                {notice && <p className={styles.notice}>{notice}</p>}
                                <div className={styles.row}>
                                    {undoCode && (
                                        <button data-testid="genai-undo" onClick={handleUndo}>
                                            元にもどす
                                        </button>
                                    )}
                                    <button
                                        className={styles.primary}
                                        data-testid="genai-again"
                                        onClick={handleReset}
                                    >
                                        もう一度相談する
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            <button
                className={styles.face}
                data-testid="genai-face"
                onClick={open ? handleClose : handleOpen}
                title="生成AI に相談"
            >
                <img src={rubyteeIcon} alt="生成AI に相談" />
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
};

const mapStateToProps = (state) => ({
    rubyVersion: state.scratchGui.settings.rubyVersion,
    assignmentName: state.scratchGui.classroom.assignmentName,
});

export default connect(mapStateToProps)(GenaiConcierge);
