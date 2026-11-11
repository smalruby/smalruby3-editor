// レッスンモードでエディタの上に出す課題バー（1 行）。
// 「何個め / 全部で何個」・課題の 1 行・ヒント・やめる。見た目の高さは 40px に収め、
// 1300×600 の授業のパソコンでコードエリアを圧迫しない。
// 課題の文が入りきらず … で切れているときだけ、文を押す（または「全文」ボタン）と
// バーの下に全文を折り返して出すパネルを開く。title 属性はタッチ端末や子どもには
// 気づきにくいため。パネルは absolute なので、エディタの列の幅も高さも変えない。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import classNames from 'classnames';
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
    fullText: {
        id: 'gui.lessonTaskBar.fullText',
        description: 'Button that shows the whole task when the task line is cut off',
        defaultMessage: 'Read all',
    },
    fullTextLabel: {
        id: 'gui.lessonTaskBar.fullTextLabel',
        description: 'Accessible name of the button that shows the whole task',
        defaultMessage: 'Read all of the task',
    },
    quit: {
        id: 'gui.lessonTaskBar.quit',
        description: 'Button that leaves lesson mode',
        defaultMessage: 'Quit',
    },
});

const FULL_TEXT_ID = 'lesson-task-bar-full-text';

// 課題の文が … で切れているか（scrollWidth が見えている幅より広い）
const isCutOff = (el) => Boolean(el) && el.scrollWidth > el.clientWidth;

const LessonTaskBar = ({ challenge, challengeCount, hintAvailable, hintVisible, onHint, onOpenFullText, onQuit, toastVisible }) => {
    const intl = useIntl();
    // 課題の 1 行が無いチャレンジ（中身がまだのもの）は名前を出す
    const task = intl.formatMessage(challenge.task || challenge.name);
    const wrapperRef = useRef(null);
    const taskRef = useRef(null);
    const [truncated, setTruncated] = useState(false);
    const [open, setOpen] = useState(false);

    // 切れているかを測る。窓の大きさのほか、ステージの大きさの切り替えなどで
    // エディタの列だけが変わることもあるので、ResizeObserver があればそれでも測り直す
    const measure = useCallback(() => setTruncated(isCutOff(taskRef.current)), []);
    useLayoutEffect(measure, [measure, task]);
    useEffect(() => {
        window.addEventListener('resize', measure);
        let observer = null;
        if (typeof ResizeObserver !== 'undefined' && taskRef.current) {
            observer = new ResizeObserver(measure);
            observer.observe(taskRef.current);
        }
        return () => {
            window.removeEventListener('resize', measure);
            if (observer) observer.disconnect();
        };
    }, [measure]);

    // 全部入るようになった・チャレンジが変わった・「できた！」やヒントの吹き出しが出たら閉じる
    // （どちらもバーの下に出るので、パネルと重ねない）
    useEffect(() => {
        if (!truncated || toastVisible || hintVisible) setOpen(false);
    }, [truncated, toastVisible, hintVisible]);
    useEffect(() => setOpen(false), [task]);

    // 開いているあいだ、外を押す・Esc で閉じる
    useEffect(() => {
        if (!open) return () => {};
        const handlePointer = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
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
    }, [open]);

    // 開くときは、ヒントの吹き出しと「できた！」を閉じてもらう（同じ場所に重ねない）
    const toggle = useCallback(() => {
        if (!truncated) return;
        if (!open && onOpenFullText) onOpenFullText();
        setOpen(!open);
    }, [truncated, open, onOpenFullText]);

    return (
        <div className={styles.wrapper} ref={wrapperRef}>
            <div
                className={styles.bar}
                data-testid="lesson-task-bar"
                role="region"
                aria-label={intl.formatMessage(messages.ariaLabel)}
            >
                <span className={styles.position} data-testid="lesson-task-bar-position">
                    {intl.formatMessage(messages.position, { number: challenge.number, count: challengeCount })}
                </span>
                {/* キーボードでは隣の「全文」ボタンで開く（文そのものはマウス・タッチ用の近道） */}
                <span
                    className={classNames(styles.task, { [styles.taskCutOff]: truncated })}
                    data-testid="lesson-task-bar-task"
                    data-truncated={truncated ? 'true' : 'false'}
                    ref={taskRef}
                    title={task}
                    onClick={toggle}
                >
                    {task}
                </span>
                {truncated && (
                    <button
                        type="button"
                        className={classNames(styles.button, { [styles.buttonActive]: open })}
                        data-testid="lesson-task-bar-full-text-toggle"
                        aria-expanded={open}
                        aria-controls={FULL_TEXT_ID}
                        aria-label={intl.formatMessage(messages.fullTextLabel)}
                        onClick={toggle}
                    >
                        {intl.formatMessage(messages.fullText)}
                    </button>
                )}
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
                    {intl.formatMessage(messages.quit)}
                </button>
            </div>
            {open && (
                <div className={styles.fullText} data-testid="lesson-task-bar-full-text" id={FULL_TEXT_ID}>
                    {task}
                </div>
            )}
        </div>
    );
};

LessonTaskBar.propTypes = {
    // courses.js の defineChallenge が返す形（number / name / task）
    challenge: PropTypes.shape({
        number: PropTypes.number.isRequired,
        name: PropTypes.object.isRequired,
        task: PropTypes.object,
    }).isRequired,
    challengeCount: PropTypes.number.isRequired,
    hintAvailable: PropTypes.bool,
    // ヒントの吹き出しが出ているか（出たら全文のパネルを閉じる）
    hintVisible: PropTypes.bool,
    onHint: PropTypes.func.isRequired,
    // 全文のパネルを開くとき（ヒントの吹き出し・「できた！」を閉じる）
    onOpenFullText: PropTypes.func,
    onQuit: PropTypes.func.isRequired,
    // 「できた！」の toast が出ているか（出たら全文のパネルを閉じる）
    toastVisible: PropTypes.bool,
};

export default LessonTaskBar;
