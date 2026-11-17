// 「なまえ」の札（#2133）。画面の部分（タブ・パレット・コードエリア・ステージ・旗と止める・スプライトリスト・背景・
// 課題バー・ヒント）を枠で囲み、名前の札を重ねて出す。部分の探し方と札の置き方は lib/lessons/part-names.js。
// 札も枠も pointer-events を通すので、出したままでもドラッグやクリックを邪魔しない（レッスン 0 は最初から出す）。
// 課題バーの「なまえ」で出したときは、数秒たつか、どこかを押すか、Esc で消す（押した操作はそのまま下に届く）。
// document.body への portal で出し、部分の場所が変わる（タブを切りかえる・画面の大きさが変わる）のに合わせて置き直す。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    PART_NAMES,
    PART_NAMES_DURATION_MS,
    computePartNameLayout,
    findPartNameRects,
} from '../../lib/lessons/part-names';
import styles from './lesson-part-names.css';

const messages = defineMessages({
    taskBar: {
        id: 'gui.lessonPartNames.taskBar',
        description: 'Name tag on the lesson task bar (the bar that shows the challenge)',
        defaultMessage: 'Task bar',
    },
    hint: {
        id: 'gui.lessonPartNames.hint',
        description: 'Name tag on the Hint button of the lesson task bar',
        defaultMessage: 'Hint',
    },
    codeTab: {
        id: 'gui.lessonPartNames.codeTab',
        description: 'Name tag on the Code tab',
        defaultMessage: 'Code tab',
    },
    costumesTab: {
        id: 'gui.lessonPartNames.costumesTab',
        description: 'Name tag on the Costumes tab',
        defaultMessage: 'Costumes tab',
    },
    soundsTab: {
        id: 'gui.lessonPartNames.soundsTab',
        description: 'Name tag on the Sounds tab',
        defaultMessage: 'Sounds tab',
    },
    greenFlag: {
        id: 'gui.lessonPartNames.greenFlag',
        description: 'Name tag on the green flag button',
        defaultMessage: 'Green flag',
    },
    stop: {
        id: 'gui.lessonPartNames.stop',
        description: 'Name tag on the stop button',
        defaultMessage: 'Stop',
    },
    palette: {
        id: 'gui.lessonPartNames.palette',
        description: 'Name tag on the block palette',
        defaultMessage: 'Palette',
    },
    codeArea: {
        id: 'gui.lessonPartNames.codeArea',
        description: 'Name tag on the code area (the block workspace)',
        defaultMessage: 'Code area',
    },
    stage: {
        id: 'gui.lessonPartNames.stage',
        description: 'Name tag on the stage',
        defaultMessage: 'Stage',
    },
    spriteList: {
        id: 'gui.lessonPartNames.spriteList',
        description: 'Name tag on the sprite list',
        defaultMessage: 'Sprite list',
    },
    backdrop: {
        id: 'gui.lessonPartNames.backdrop',
        description: 'Name tag on the backdrop (stage) selector',
        defaultMessage: 'Backdrop',
    },
});

// 部分の場所を測り直す間（ms）。タブの切りかえ・パレットの開閉は知らせが無いので、出ているあいだだけ見る
const RELAYOUT_MS = 500;
// 札でかぶせないもの（ヒントの吹き出し・小さくしたヒントの札・練習相手のパネル）。名前の札はヒントの吹き出しより
// 下の層に描くが、文字を隠さないよう置き場所でもよける（小さくしたヒントの札は名前の札より下の層なので、よけないと隠れる）
const AVOID_SELECTORS = [
    '[data-testid="lesson-hint"]',
    '[data-testid="lesson-hint-minimized"]',
    '[data-testid="lesson-practice-partner"]',
];
// 押しても札を消さない場所（「なまえ」のボタン。押すと出し入れが切りかわる）
const TOGGLE_SELECTOR = '[data-testid="lesson-task-bar-part-names"]';

const sameLayout = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const LessonPartNames = ({ onClose, timed }) => {
    const intl = useIntl();
    const labelRefs = useRef({});
    const [layout, setLayout] = useState({ frames: [], labels: [] });

    const relayout = useCallback(() => {
        if (typeof document === 'undefined') return;
        const parts = findPartNameRects(document);
        const sizes = {};
        parts.forEach((part) => {
            const el = labelRefs.current[part.label];
            if (el) sizes[part.label] = { width: el.offsetWidth, height: el.offsetHeight };
        });
        const avoid = AVOID_SELECTORS.flatMap((s) => Array.from(document.querySelectorAll(s)))
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.height > 0)
            .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
        const next = {
            frames: parts.map((part) => ({ label: part.label, rect: part.rect })),
            labels: computePartNameLayout({
                parts,
                sizes,
                viewport: { width: window.innerWidth, height: window.innerHeight },
                avoid,
            }),
        };
        setLayout((prev) => (sameLayout(prev, next) ? prev : next));
    }, []);

    useLayoutEffect(() => {
        relayout();
    }, [relayout]);
    useEffect(() => {
        const timer = setInterval(relayout, RELAYOUT_MS);
        window.addEventListener('resize', relayout);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', relayout);
        };
    }, [relayout]);

    // 「なまえ」で出したときは、数秒で・どこかを押すと・Esc で消す。押した操作はそのまま下の部品に届く（capture で見るだけ）
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        if (!timed) return () => {};
        const close = () => onCloseRef.current();
        const timer = setTimeout(close, PART_NAMES_DURATION_MS);
        const handlePointer = (e) => {
            if (e.target && e.target.closest && e.target.closest(TOGGLE_SELECTOR)) return;
            close();
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('pointerdown', handlePointer, true);
        document.addEventListener('keydown', handleKey);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('pointerdown', handlePointer, true);
            document.removeEventListener('keydown', handleKey);
        };
    }, [timed]);

    if (typeof document === 'undefined') return null;
    const placed = new Map(layout.labels.map((l) => [l.label, l]));
    return createPortal(
        <div className={styles.overlay} data-testid="lesson-part-names" aria-hidden="true">
            {layout.frames.map(({ label, rect }) => (
                <div
                    key={`frame-${label}`}
                    className={styles.frame}
                    data-testid={`lesson-part-names-frame-${label}`}
                    style={{
                        left: rect.left,
                        top: rect.top,
                        width: rect.right - rect.left,
                        height: rect.bottom - rect.top,
                    }}
                />
            ))}
            {/* 札は全部描いて大きさを測り、見つかった部分の札だけを置く（置くまでは見せない） */}
            {PART_NAMES.map(({ label }) => {
                const at = placed.get(label);
                return (
                    <span
                        key={label}
                        ref={(el) => {
                            labelRefs.current[label] = el;
                        }}
                        className={styles.label}
                        data-testid={`lesson-part-names-label-${label}`}
                        data-placed={at ? 'true' : 'false'}
                        style={at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: 'hidden' }}
                    >
                        {intl.formatMessage(messages[label])}
                    </span>
                );
            })}
        </div>,
        document.body,
    );
};

LessonPartNames.propTypes = {
    // 消す（数秒たった・どこかを押した・Esc）
    onClose: PropTypes.func.isRequired,
    // 「なまえ」で出した（数秒で消す）か。false ならレッスンの設定で出しっぱなし（自分では消さない）
    timed: PropTypes.bool,
};

export default LessonPartNames;
