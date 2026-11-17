// 「どこでしょう？」のクイズ（#2134）。画面の部分の名前（Scratch Wiki の名前）で「パレットはどこ？」と聞き、
// 生徒が画面をクリックして答える。クイズのあいだは画面全体に透明な受け皿を重ねてクリックを受け、下の部品（ブロック・
// タブ・旗など）は動かさない。課題バー・ヒントの吹き出し・小さくしたヒントの札・「できた！」は受け皿より上の層なので
// 押せる。まちがえたら「ちがうよ。もう一度」と出し、正しい場所を数秒光らせる。全部答えたら受け皿を外す。
// 判定（クリックした点が部分の中か）は lib/lessons/part-quiz.js、正しく答えた数は Redux（lesson-mode の
// partQuizSolved）に持ち、goal の `partQuiz` が「できた」を決める。document.body への portal で出す。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { HINT_TARGETS, findHintTargetRect } from '../../lib/lessons/hint-targets';
import { PART_QUIZ_REVEAL_MS, isPartQuizAnswer, partQuizTarget } from '../../lib/lessons/part-quiz';
import styles from './lesson-part-quiz.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessonPartQuiz.title',
        description: 'Title of the "where is it?" quiz in lesson 0, with the question number and the count',
        defaultMessage: 'Where is it? {number} / {count}',
    },
    question: {
        id: 'gui.lessonPartQuiz.question',
        description: 'Question of the quiz: asks to click the named part of the screen',
        defaultMessage: 'Where is the "{name}"? Click it.',
    },
    correct: {
        id: 'gui.lessonPartQuiz.correct',
        description: 'Shown when the student clicked the right part',
        defaultMessage: 'Correct!',
    },
    wrong: {
        id: 'gui.lessonPartQuiz.wrong',
        description: 'Shown when the student clicked another part (the right part glows)',
        defaultMessage: 'Not there. Look at the glowing part and try again.',
    },
    done: {
        id: 'gui.lessonPartQuiz.done',
        description: 'Shown when all the questions are answered',
        defaultMessage: 'All {count} correct!',
    },
});

// 問いの部分の名前（Scratch Wiki「Scratchユーザーインターフェース (3.0)」の名前・#2134）。label は lib/lessons/part-names.js の
// PART_NAMES の label。「なまえ」の札の文言（gui.lessonPartNames.*）とは別に持つ（札の名前は別に直す）
const partNameMessages = defineMessages({
    taskBar: {
        id: 'gui.lessonPartQuiz.part.taskBar',
        description: 'Name of the lesson task bar in the "where is it?" quiz',
        defaultMessage: 'Task bar',
    },
    hint: {
        id: 'gui.lessonPartQuiz.part.hint',
        description: 'Name of the Hint button of the task bar in the "where is it?" quiz',
        defaultMessage: 'Hint',
    },
    codeTab: {
        id: 'gui.lessonPartQuiz.part.codeTab',
        description: 'Name of the Code tab in the "where is it?" quiz',
        defaultMessage: 'Code tab',
    },
    costumesTab: {
        id: 'gui.lessonPartQuiz.part.costumesTab',
        description: 'Name of the Costumes tab (the Paint tab) in the "where is it?" quiz',
        defaultMessage: 'Costumes tab',
    },
    soundsTab: {
        id: 'gui.lessonPartQuiz.part.soundsTab',
        description: 'Name of the Sounds tab in the "where is it?" quiz',
        defaultMessage: 'Sounds tab',
    },
    greenFlag: {
        id: 'gui.lessonPartQuiz.part.greenFlag',
        description: 'Name of the green flag button in the "where is it?" quiz',
        defaultMessage: 'Green Flag',
    },
    stop: {
        id: 'gui.lessonPartQuiz.part.stop',
        description: 'Name of the stop button in the "where is it?" quiz',
        defaultMessage: 'Stop Button',
    },
    palette: {
        id: 'gui.lessonPartQuiz.part.palette',
        description: 'Name of the block palette in the "where is it?" quiz',
        defaultMessage: 'Block Palette',
    },
    codeArea: {
        id: 'gui.lessonPartQuiz.part.codeArea',
        description: 'Name of the code area (script area) in the "where is it?" quiz',
        defaultMessage: 'Code Area',
    },
    stage: {
        id: 'gui.lessonPartQuiz.part.stage',
        description: 'Name of the stage in the "where is it?" quiz',
        defaultMessage: 'Stage',
    },
    spriteList: {
        id: 'gui.lessonPartQuiz.part.spriteList',
        description: 'Name of the sprite pane in the "where is it?" quiz',
        defaultMessage: 'Sprite Pane',
    },
    backdrop: {
        id: 'gui.lessonPartQuiz.part.backdrop',
        description: 'Name of the backdrop (stage) selector in the "where is it?" quiz',
        defaultMessage: 'Backdrop',
    },
});

const LessonPartQuiz = ({ questions, solved, onSolve }) => {
    const intl = useIntl();
    const [feedback, setFeedback] = useState(null);
    const [reveal, setReveal] = useState(null);
    const revealTimerRef = useRef(null);
    const finished = solved >= questions.length;
    const label = finished ? null : questions[solved];

    useEffect(
        () => () => {
            if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
        },
        [],
    );

    // 問いはコードエリアの下のほう（真ん中）に出す。パレット・タブ・旗・スプライトリストを隠さないため。
    // コードエリアが見つからないときは CSS の既定（画面の下の真ん中）
    const [place, setPlace] = useState(null);
    useEffect(() => {
        const update = () => {
            const rect = findHintTargetRect(HINT_TARGETS.CODE_AREA, document);
            setPlace(
                rect ? { left: (rect.left + rect.right) / 2, bottom: window.innerHeight - rect.bottom + 16 } : null,
            );
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const handlePointerDown = useCallback(
        (event) => {
            // 下の部品へ届けない（ドラッグ・フォーカスも始めない）
            event.preventDefault();
            event.stopPropagation();
            if (label === null) return;
            if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
            setReveal(null);
            if (isPartQuizAnswer(label, { x: event.clientX, y: event.clientY }, document)) {
                setFeedback('correct');
                onSolve(solved);
                return;
            }
            setFeedback('wrong');
            const rect = findHintTargetRect(partQuizTarget(label), document);
            if (rect) {
                setReveal(rect);
                revealTimerRef.current = setTimeout(() => setReveal(null), PART_QUIZ_REVEAL_MS);
            }
        },
        [label, onSolve, solved],
    );
    // クリック・右クリックのメニューも下の部品へ届けない
    const swallow = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    if (typeof document === 'undefined') return null;
    const panel = (
        <div
            className={styles.panel}
            data-testid="lesson-part-quiz-panel"
            role="status"
            aria-live="polite"
            style={place ? { left: place.left, bottom: place.bottom } : null}
        >
            <div className={styles.title} data-testid="lesson-part-quiz-title">
                {intl.formatMessage(messages.title, {
                    number: Math.min(solved + 1, questions.length),
                    count: questions.length,
                })}
            </div>
            {finished ? (
                <div className={styles.question} data-testid="lesson-part-quiz-done">
                    {intl.formatMessage(messages.done, { count: questions.length })}
                </div>
            ) : (
                <div className={styles.question} data-testid="lesson-part-quiz-question" data-part={label}>
                    {intl.formatMessage(messages.question, { name: intl.formatMessage(partNameMessages[label]) })}
                </div>
            )}
            {feedback && !finished ? (
                <div
                    className={feedback === 'correct' ? styles.correct : styles.wrong}
                    data-testid="lesson-part-quiz-feedback"
                    data-result={feedback}
                >
                    {intl.formatMessage(feedback === 'correct' ? messages.correct : messages.wrong)}
                </div>
            ) : null}
        </div>
    );
    return createPortal(
        <div className={styles.root} data-testid="lesson-part-quiz">
            {finished ? null : (
                <div
                    className={styles.catcher}
                    data-testid="lesson-part-quiz-catcher"
                    onPointerDown={handlePointerDown}
                    onMouseDown={swallow}
                    onClick={swallow}
                    onContextMenu={swallow}
                />
            )}
            {reveal ? (
                <div
                    className={styles.reveal}
                    data-testid="lesson-part-quiz-reveal"
                    style={{
                        left: reveal.left,
                        top: reveal.top,
                        width: reveal.right - reveal.left,
                        height: reveal.bottom - reveal.top,
                    }}
                />
            ) : null}
            {panel}
        </div>,
        document.body,
    );
};

LessonPartQuiz.propTypes = {
    // 問いの部分の名前（lib/lessons/part-names.js の PART_NAMES の label）。並び順に聞く
    questions: PropTypes.arrayOf(PropTypes.string).isRequired,
    // 正しく答えた数（いまの問いの番号）
    solved: PropTypes.number.isRequired,
    // `index` 番めの問いに正しく答えた
    onSolve: PropTypes.func.isRequired,
};

export default LessonPartQuiz;
