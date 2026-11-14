// メッシュの練習相手のパネル（チャレンジに `partner` があるときだけ出す）。相手の名前と、押すと相手が
// メッシュで変数を変えた・合図を送ったのと同じことが起きるボタン（2〜3 個）。閉じると本物のメッシュ
// （ペア）で同じチャレンジができ、小さな「練習相手」のボタンでもう一度出せる。本物のメッシュで
// つながっているあいだは、どちらも出さない（コンテナが決める）。
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import styles from './lesson-practice-partner.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessonPracticePartner.title',
        description: 'Title of the panel of the mesh practice partner in a lesson ({name} = the partner name)',
        defaultMessage: 'Practice partner: {name}',
    },
    note: {
        id: 'gui.lessonPracticePartner.note',
        description:
            'Note in the practice partner panel: with a pair, close it and connect with the real mesh instead',
        defaultMessage: 'With a partner, close this and connect with Mesh.',
    },
    close: {
        id: 'gui.lessonPracticePartner.close',
        description: 'Accessible name of the button that closes the practice partner panel',
        defaultMessage: 'Close the practice partner',
    },
    open: {
        id: 'gui.lessonPracticePartner.open',
        description: 'Button that shows the practice partner panel again after it was closed',
        defaultMessage: 'Practice partner',
    },
});

const LessonPracticePartner = ({ buttons, name, onClose, onOpen, onPress, open, position }) => {
    const intl = useIntl();
    if (!open) {
        return (
            <button
                className={styles.open}
                data-testid="lesson-practice-partner-open"
                onClick={onOpen}
                style={position}
                type="button"
            >
                {intl.formatMessage(messages.open)}
            </button>
        );
    }
    const title = intl.formatMessage(messages.title, { name });
    return (
        <section aria-label={title} className={styles.panel} data-testid="lesson-practice-partner" style={position}>
            <div className={styles.header}>
                <span className={styles.title} data-testid="lesson-practice-partner-name" title={title}>
                    {title}
                </span>
                <button
                    aria-label={intl.formatMessage(messages.close)}
                    className={styles.close}
                    data-testid="lesson-practice-partner-close"
                    onClick={onClose}
                    title={intl.formatMessage(messages.close)}
                    type="button"
                >
                    {'×'}
                </button>
            </div>
            <div className={styles.body}>
                {buttons.map((button, index) => (
                    <button
                        className={styles.button}
                        data-index={index}
                        data-testid="lesson-practice-partner-button"
                        key={index}
                        // eslint-disable-next-line react/jsx-no-bind
                        onClick={() => onPress(index)}
                        type="button"
                    >
                        {button.label}
                    </button>
                ))}
                <p className={styles.note} data-testid="lesson-practice-partner-note">
                    {intl.formatMessage(messages.note)}
                </p>
            </div>
        </section>
    );
};

LessonPracticePartner.propTypes = {
    buttons: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired })).isRequired,
    name: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    onOpen: PropTypes.func.isRequired,
    onPress: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired,
    // 置く場所（fixed の top / right。コンテナがステージの列から測る）
    position: PropTypes.shape({ top: PropTypes.number, right: PropTypes.number }),
};

export default LessonPracticePartner;
