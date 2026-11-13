// 本人の確認（#1600・docs/lessons/design.md の「本人の確認」）。共用のパソコンで、端末に残っている
// レッスンの記録が前に使った人のものかもしれないので、その課題ではじめて送る前に一度だけ聞く。
//   - step="ask": 「あなたがやった記録ですか？」（記録の一覧付き）［ちがう（記録を消す）］［わたしの記録です］
//   - step="confirmClear": 決め方を伝えてもう一度確かめる ［戻る］［消す］
// 答えの保存と送信は containers/lesson-progress-sync.jsx。
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';
import styles from './lesson-progress-confirm.css';

export const CONFIRM_STEPS = Object.freeze({
    ASK: 'ask',
    CONFIRM_CLEAR: 'confirmClear',
});

const messages = defineMessages({
    title: {
        id: 'gui.lessons.progressConfirm.title',
        defaultMessage: 'Lesson records on this computer',
        description: 'Title of the dialog asking whether the lesson records on a shared computer are the student’s',
    },
    question: {
        id: 'gui.lessons.progressConfirm.question',
        defaultMessage: 'Are these your records?',
        description: 'Question of the dialog asking whether the lesson records on this computer are the student’s',
    },
    found: {
        id: 'gui.lessons.progressConfirm.found',
        defaultMessage:
            'This computer has {count, plural, one {# challenge} other {# challenges}} of this assignment ' +
            'recorded as done.',
        description:
            'How many challenges of the lesson assignment this computer has recorded as done, shown before ' +
            'sending them to the class. {count} is the number',
    },
    mine: {
        id: 'gui.lessons.progressConfirm.mine',
        defaultMessage: 'These are my records',
        description: 'Button: the lesson records on this computer are the student’s; send them to the class',
    },
    notMine: {
        id: 'gui.lessons.progressConfirm.notMine',
        defaultMessage: 'Not mine (clear the records)',
        description: 'Button: the lesson records on this computer are not the student’s; go on to clearing them',
    },
    clearQuestion: {
        id: 'gui.lessons.progressConfirm.clearQuestion',
        defaultMessage: 'Clear the lesson records?',
        description: 'Question of the second step before clearing the lesson records on this computer',
    },
    clearHint: {
        id: 'gui.lessons.progressConfirm.clearHint',
        defaultMessage:
            "If this is your own computer, don't clear them: go back and choose “These are my records”. " +
            'If everyone uses this computer, clear them.',
        description: 'Tells the student how to decide whether to clear the lesson records on this computer',
    },
    clearNote: {
        id: 'gui.lessons.progressConfirm.clearNote',
        defaultMessage: 'Cleared records cannot be brought back.',
        description: 'Note under the second step: clearing the lesson records cannot be undone',
    },
    back: {
        id: 'gui.lessons.progressConfirm.back',
        defaultMessage: 'Back',
        description: 'Button: go back to the first question without clearing the lesson records',
    },
    clear: {
        id: 'gui.lessons.progressConfirm.clear',
        defaultMessage: 'Clear',
        description: 'Button: clear the lesson records on this computer (they are not sent to the class)',
    },
});

const LessonProgressConfirm = ({ items, step, onBack, onClear, onClose, onMine, onNotMine }) => {
    const intl = useIntl();
    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            id="lessonProgressConfirm"
            onRequestClose={onClose}
        >
            <Box className={styles.body} data-testid="lesson-progress-confirm">
                {step === CONFIRM_STEPS.CONFIRM_CLEAR ? (
                    <React.Fragment>
                        <p className={styles.question}>{intl.formatMessage(messages.clearQuestion)}</p>
                        <p className={styles.hint}>{intl.formatMessage(messages.clearHint)}</p>
                        <p className={styles.text}>{intl.formatMessage(messages.clearNote)}</p>
                        <div className={styles.buttons}>
                            <button
                                className={styles.secondaryButton}
                                data-testid="lesson-progress-confirm-back"
                                onClick={onBack}
                                type="button"
                            >
                                {intl.formatMessage(messages.back)}
                            </button>
                            <button
                                className={styles.dangerButton}
                                data-testid="lesson-progress-confirm-clear"
                                onClick={onClear}
                                type="button"
                            >
                                {intl.formatMessage(messages.clear)}
                            </button>
                        </div>
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <p className={styles.text}>{intl.formatMessage(messages.found, { count: items.length })}</p>
                        <ul className={styles.list} data-testid="lesson-progress-confirm-list">
                            {items.map((item) => (
                                <li className={styles.item} key={item.id}>
                                    <span className={styles.itemName}>{intl.formatMessage(item.name)}</span>
                                    <span className={styles.itemDate}>
                                        {intl.formatDate(item.completedAt, { month: 'numeric', day: 'numeric' })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className={styles.question}>{intl.formatMessage(messages.question)}</p>
                        <div className={styles.buttons}>
                            <button
                                className={styles.secondaryButton}
                                data-testid="lesson-progress-confirm-not-mine"
                                onClick={onNotMine}
                                type="button"
                            >
                                {intl.formatMessage(messages.notMine)}
                            </button>
                            <button
                                className={styles.primaryButton}
                                data-testid="lesson-progress-confirm-mine"
                                onClick={onMine}
                                type="button"
                            >
                                {intl.formatMessage(messages.mine)}
                            </button>
                        </div>
                    </React.Fragment>
                )}
            </Box>
        </Modal>
    );
};

LessonProgressConfirm.propTypes = {
    items: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.shape({ id: PropTypes.string }).isRequired,
            completedAt: PropTypes.string.isRequired,
        }),
    ).isRequired,
    step: PropTypes.oneOf(Object.values(CONFIRM_STEPS)).isRequired,
    onBack: PropTypes.func.isRequired,
    onClear: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onMine: PropTypes.func.isRequired,
    onNotMine: PropTypes.func.isRequired,
};

export default LessonProgressConfirm;
