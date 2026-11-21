// じゅんびチェック（#2299）の問いのパネル。コードエリアの上に、問いのブロックの絵（ヒントの吹き出しと同じ描き方・
// LessonHintBlocks）と 3 択（ふりかえりのクイズの部品・LessonCompletedQuiz の `oneTry`）を 1 問ずつ出す。1 回めに
// 選んだものだけを数え、まちがえたらその場で正しい答えと解説を出す。答えたら「次の問いへ」（最後は「結果を見る」）で進み、
// 全部の問いを進めたらパネルを閉じる（goal の `readinessCheck` を満たして「できた！」に結果が出る）。
// 選んだもの・進んだ数は Redux（reducers/lesson-mode.js の readinessChoice / readinessAnswered）に持つ。
// document.body への portal で出す（クリックは止めない。パネルの外の画面はふつうに使える）。
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { HINT_TARGETS, findHintTargetRect } from '../../lib/lessons/hint-targets';
import LessonCompletedQuiz from '../lesson-completed-toast/lesson-completed-quiz.jsx';
import LessonHintBlocks from '../lesson-hint/lesson-hint-blocks.jsx';
import styles from './lesson-readiness-check.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessons.readiness.title',
        defaultMessage: 'Readiness check {number} / {count}',
        description: 'Heading of a readiness check question, with the question number and the count',
    },
    next: {
        id: 'gui.lessons.readiness.next',
        defaultMessage: 'Next question',
        description: 'Button of the readiness check after answering a question: goes to the next question',
    },
    finish: {
        id: 'gui.lessons.readiness.finish',
        defaultMessage: 'See the result',
        description: 'Button of the readiness check after answering the last question: shows the result',
    },
});

// パネルを出す場所: コードエリアの上のほう（真ん中）。コードエリアが見つからないときは CSS の既定
const placeOf = () => {
    if (typeof document === 'undefined') return null;
    const rect = findHintTargetRect(HINT_TARGETS.CODE_AREA, document);
    return rect
        ? { left: (rect.left + rect.right) / 2, top: rect.top + 12, maxHeight: rect.bottom - rect.top - 24 }
        : null;
};

const LessonReadinessCheck = ({
    blocksXmls = [],
    choice = null,
    colorMode,
    index,
    mediaPath,
    onChoose,
    onNext,
    questions,
    scratchBlocks = null,
}) => {
    const intl = useIntl();
    const [place, setPlace] = useState(null);
    useEffect(() => {
        const update = () => setPlace(placeOf());
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    if (typeof document === 'undefined' || index >= questions.length) return null;
    const question = questions[index];
    const last = index === questions.length - 1;
    const title = intl.formatMessage(messages.title, { number: index + 1, count: questions.length });
    return createPortal(
        <div
            className={styles.panel}
            data-testid="lesson-readiness-check"
            data-index={index}
            data-base-challenge-id={question.baseChallengeId}
            style={place ? { left: place.left, top: place.top, maxHeight: place.maxHeight } : null}
        >
            {/* 問いのブロックの絵（スクリプトが 2 つなら左と右に並べる。変換できなかったときは文だけ） */}
            <div className={styles.blocks} data-testid="lesson-readiness-check-blocks">
                {scratchBlocks
                    ? blocksXmls.map((xml, i) => (
                          <div
                              // スクリプトの並びは問いごとに決まっている
                              key={i}
                              className={styles.script}
                          >
                              <LessonHintBlocks
                                  colorMode={colorMode}
                                  mediaPath={mediaPath}
                                  scratchBlocks={scratchBlocks}
                                  xml={xml}
                              />
                          </div>
                      ))
                    : null}
            </div>
            {/* 問いが変わったら選んだものを作りなおす（key） */}
            <LessonCompletedQuiz
                key={question.baseChallengeId}
                label={title}
                oneTry
                quiz={question}
                selected={choice}
                onChoose={onChoose}
                action={
                    choice === null ? null : (
                        <button
                            type="button"
                            className={styles.next}
                            onClick={onNext}
                            data-testid="lesson-readiness-check-next"
                            data-last={last ? 'true' : 'false'}
                        >
                            {intl.formatMessage(last ? messages.finish : messages.next)}
                        </button>
                    )
                }
            />
        </div>,
        document.body,
    );
};

const messageShape = PropTypes.shape({ id: PropTypes.string.isRequired });

LessonReadinessCheck.propTypes = {
    // いまの問いのブロックの絵の XML（スクリプトごと・lib/lessons/hint-blocks.js の rubyToBlocksXml）。空なら絵を出さない
    blocksXmls: PropTypes.arrayOf(PropTypes.string),
    // いまの問いで選んだ選択肢（0 から）。まだなら null
    choice: PropTypes.number,
    colorMode: PropTypes.string.isRequired,
    // いまの問いの番号（答えて進んだ数・0 から）。問いの数以上ならパネルを出さない
    index: PropTypes.number.isRequired,
    mediaPath: PropTypes.string.isRequired,
    // 選んだ（選択肢の番号を渡す）
    onChoose: PropTypes.func.isRequired,
    // 「次の問いへ」「結果を見る」
    onNext: PropTypes.func.isRequired,
    // チャレンジの `readinessCheck.questions`（courses.js の readinessQuestion）
    questions: PropTypes.arrayOf(
        PropTypes.shape({
            baseChallengeId: PropTypes.string.isRequired,
            question: messageShape.isRequired,
            choices: PropTypes.arrayOf(messageShape).isRequired,
            answer: PropTypes.number.isRequired,
            explanation: messageShape.isRequired,
        }),
    ).isRequired,
    scratchBlocks: PropTypes.object,
};

export { messages };
export default LessonReadinessCheck;
