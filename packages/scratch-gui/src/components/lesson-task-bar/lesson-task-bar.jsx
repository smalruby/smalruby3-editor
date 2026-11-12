// レッスンモードでメニューバーの下に画面の幅いっぱいで出す課題バー（1 行）。
// 「何個め / 全部で何個」・課題の 1 行・ヒント・ほかのチャレンジへ。見た目の高さは 40px に収め、
// 1300×600 の授業のパソコンでコードエリアを圧迫しない。
// 課題の全文（チャレンジの定義の改行つき・画像があれば画像も）は、バーにマウスを乗せているあいだ
// バーの下に大きめの字で出す（先生がプロジェクターに映して説明する場面のため。課題が短くても出す。
// 横切っただけでちらつかないよう、乗せてから少し待って出す）。
// タッチ（SP）では課題の文のタップで開き、もう一度のタップで閉じる。パネルは absolute なので、
// エディタの列・ステージの列の幅も高さも変えない。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import styles from './lesson-task-bar.css';

const messages = defineMessages({
    ariaLabel: {
        id: 'gui.lessonTaskBar.ariaLabel',
        description: 'Accessible name of the bar that shows the current lesson task',
        defaultMessage: 'Lesson task',
    },
    position: {
        id: 'gui.lessonTaskBar.position',
        description: 'Which challenge this is out of how many in the lesson',
        defaultMessage: '{number} of {count}',
    },
    hint: {
        id: 'gui.lessonTaskBar.hint',
        description: 'Button that shows a hint for the current challenge',
        defaultMessage: 'Hint',
    },
    another: {
        id: 'gui.lessonTaskBar.another',
        description: 'Button that ends the current challenge and opens the lessons library to choose another one',
        defaultMessage: 'Try another challenge',
    },
});

const FULL_TEXT_ID = 'lesson-task-bar-full-text';

// マウスを乗せてから全文を出すまでの間（ms）。バーはタブとコードエリアのあいだにあるので、
// タブへ動かす途中にバーを横切っただけで大きなパネルがちらつかないようにする。離したらすぐ消す
export const HOVER_DELAY_MS = 300;

// 改行の前後が両方とも半角（英語など）なら空白でつなぎ、それ以外（日本語）は空白を入れずにつなぐ
const HALF_WIDTH = /[\x21-\x7e]/;
const toOneLine = (text) =>
    text.replace(/[ \t]*\n+[ \t]*/g, (match, offset, whole) =>
        HALF_WIDTH.test(whole.charAt(offset - 1)) && HALF_WIDTH.test(whole.charAt(offset + match.length)) ? ' ' : '',
    );

const LessonTaskBar = ({
    challenge,
    challengeCount,
    hintAvailable,
    hintVisible,
    menuOpen,
    onHint,
    onOpenFullText,
    onQuit,
    toastVisible,
}) => {
    const intl = useIntl();
    // 課題の 1 行が無いチャレンジ（中身がまだのもの）は名前を出す
    const task = intl.formatMessage(challenge.task || challenge.name);
    const image = challenge.image || null;
    const wrapperRef = useRef(null);
    // マウスを乗せているあいだだけ開く（hovered）と、タップ・キーボードで開いたまま（pinned）
    const [hovered, setHovered] = useState(false);
    const [pinned, setPinned] = useState(false);
    const hoverTimerRef = useRef(null);
    const clearHoverTimer = useCallback(() => {
        if (hoverTimerRef.current !== null) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
    }, []);
    useEffect(() => clearHoverTimer, [clearHoverTimer]);
    // 直前に課題の文を押したポインタの種類（マウスの click では開いたままにしない）
    const pointerTypeRef = useRef(null);
    // マウスで乗せて出す全文は、ヒントの吹き出しが出ていても出す（チャレンジを始めるとヒントが
    // 自動で開くので、止めると吹き出しを閉じるまで課題が読めない）。乗せているあいだだけの一時的な
    // ものなので、吹き出しの状態（ページ・ドラッグした位置）は変えずに上へ重ねる（CSS の z-index）。
    // 「できた！」の toast が出ているあいだは出さない。メニューバーのメニューが開いているあいだも出さない
    // （パネルはメニューバーと同じ z-index で DOM では後ろにあるので、重なるとメニューの項目を隠す）
    const hoverOpen = hovered && !toastVisible && !menuOpen;
    // タップで開いたままにするパネルは、吹き出し・toast と重ねない（開くときは onOpenFullText で閉じる）
    const pinCovered = Boolean(hintVisible || toastVisible);
    const pinOpen = pinned && !pinCovered;
    const open = pinOpen || hoverOpen;

    useEffect(() => {
        if (pinCovered) setPinned(false);
    }, [pinCovered]);
    // バーの「ヒント」を押して吹き出しを出したときは、乗せたままでもホバーのパネルを引っ込める
    // （出したばかりの吹き出しを隠さない）。もう一度乗せ直せば出る
    const prevHintVisibleRef = useRef(Boolean(hintVisible));
    useEffect(() => {
        if (hintVisible && !prevHintVisibleRef.current) {
            clearHoverTimer();
            setHovered(false);
        }
        prevHintVisibleRef.current = Boolean(hintVisible);
    }, [hintVisible, clearHoverTimer]);
    useEffect(() => setPinned(false), [task]);

    // タップで開いているあいだ、外を押す・Esc で閉じる
    useEffect(() => {
        if (!pinned) return () => {};
        const handlePointer = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setPinned(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setPinned(false);
        };
        // mousedown ではなく pointerdown（capture）で見る。Blockly のコードエリアは pointerdown を
        // preventDefault するので、互換の mousedown が来ず、コードエリアを押しても閉じなかった。
        // pointerdown はタッチも含む
        document.addEventListener('pointerdown', handlePointer, true);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('pointerdown', handlePointer, true);
            document.removeEventListener('keydown', handleKey);
        };
    }, [pinned]);

    // タッチでも pointerover が来るので、マウスのときだけ見る
    const handlePointerEnter = useCallback(
        (e) => {
            if (e.pointerType !== 'mouse') return;
            clearHoverTimer();
            hoverTimerRef.current = setTimeout(() => {
                hoverTimerRef.current = null;
                setHovered(true);
            }, HOVER_DELAY_MS);
        },
        [clearHoverTimer],
    );
    const handlePointerLeave = useCallback(
        (e) => {
            if (e.pointerType !== 'mouse') return;
            clearHoverTimer();
            setHovered(false);
        },
        [clearHoverTimer],
    );

    const handleTaskPointerDown = useCallback((e) => {
        pointerTypeRef.current = e.pointerType || null;
    }, []);
    // タップ（とキーボード）で開閉する。マウスは乗せれば出ているので、押しても変えない
    const handleTaskClick = useCallback(() => {
        const pointerType = pointerTypeRef.current;
        pointerTypeRef.current = null;
        if (pointerType === 'mouse') return;
        if (!pinned && onOpenFullText) onOpenFullText();
        setPinned(!pinned);
    }, [pinned, onOpenFullText]);

    return (
        <div className={styles.wrapper} ref={wrapperRef}>
            <div
                className={styles.bar}
                data-testid="lesson-task-bar"
                role="region"
                aria-label={intl.formatMessage(messages.ariaLabel)}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
            >
                <span className={styles.position} data-testid="lesson-task-bar-position">
                    {intl.formatMessage(messages.position, { number: challenge.number, count: challengeCount })}
                </span>
                <button
                    type="button"
                    className={styles.task}
                    data-testid="lesson-task-bar-task"
                    aria-expanded={open}
                    aria-controls={FULL_TEXT_ID}
                    onPointerDown={handleTaskPointerDown}
                    onClick={handleTaskClick}
                >
                    {toOneLine(task)}
                </button>
                <button
                    type="button"
                    className={styles.button}
                    data-testid="lesson-task-bar-hint"
                    disabled={!hintAvailable}
                    onClick={onHint}
                >
                    {intl.formatMessage(messages.hint)}
                </button>
                <button type="button" className={styles.button} data-testid="lesson-task-bar-quit" onClick={onQuit}>
                    {intl.formatMessage(messages.another)}
                </button>
            </div>
            {open && (
                <div
                    className={pinOpen ? styles.fullTextPinned : styles.fullText}
                    data-testid="lesson-task-bar-full-text"
                    id={FULL_TEXT_ID}
                >
                    <p className={styles.fullTextText} data-testid="lesson-task-bar-full-text-text">
                        {task}
                    </p>
                    {image && (
                        <img
                            className={styles.fullTextImage}
                            data-testid="lesson-task-bar-full-text-image"
                            src={image.src}
                            alt={image.alt ? intl.formatMessage(image.alt) : ''}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

LessonTaskBar.propTypes = {
    // courses.js の defineChallenge が返す形（number / name / task / image）
    challenge: PropTypes.shape({
        number: PropTypes.number.isRequired,
        name: PropTypes.object.isRequired,
        task: PropTypes.object,
        image: PropTypes.shape({
            src: PropTypes.string.isRequired,
            alt: PropTypes.object,
        }),
    }).isRequired,
    challengeCount: PropTypes.number.isRequired,
    hintAvailable: PropTypes.bool,
    // ヒントの吹き出しが出ているか（出ているあいだはタップで全文を開いたままにしない。ホバーでは出す）
    hintVisible: PropTypes.bool,
    // メニューバーのメニュー（ファイル・編集など）が開いているか（開いているあいだはホバーで全文を出さない）
    menuOpen: PropTypes.bool,
    onHint: PropTypes.func.isRequired,
    // タップで全文のパネルを開くとき（ヒントの吹き出し・「できた！」を閉じる）
    onOpenFullText: PropTypes.func,
    // ほかのチャレンジへ（いまのチャレンジを終えてレッスン表を開く）
    onQuit: PropTypes.func.isRequired,
    // 「できた！」の toast が出ているか（出ているあいだは全文のパネルを出さない。ホバーでも）
    toastVisible: PropTypes.bool,
};

export default LessonTaskBar;
