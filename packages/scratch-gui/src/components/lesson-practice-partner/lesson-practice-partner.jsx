// メッシュの練習相手のパネル（チャレンジに `partner` があるときだけ出す）。枠と見出しで 2 つに分ける（pp1）:
//   - 「<相手>から送る」: 押すと相手がメッシュで変数を変えた・合図を送ったのと同じことが起きるボタン（2〜3 個）。
//   - 「<相手>に届いた」: 生徒の作品から相手に届いたもの。新しいものを上に 3 行（古いものは薄く）。同じものが続けて
//     届いても 1 行ずつ足し、新しい行は 1 秒ほど光らせる（pp2・pp3）。変数は値を大きく・名前を小さく、合図は名前だけ（pp4）。閉じると本物のメッシュ
// （ペア）で同じチャレンジができ、小さな「練習相手」のボタンでもう一度出せる。本物のメッシュで
// つながっているあいだは、どちらも出さない（コンテナが決める）。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useEffect, useId, useRef } from 'react';
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
    sendHeading: {
        id: 'gui.lessonPracticePartner.sendHeading',
        description:
            'Heading of the group of buttons in the practice partner panel: pressing one makes the partner send ' +
            '({name} = the partner name)',
        defaultMessage: 'Send as {name}',
    },
    receivedHeading: {
        id: 'gui.lessonPracticePartner.receivedHeading',
        description:
            'Heading of the group in the practice partner panel that lists what reached the partner from the ' +
            'student project ({name} = the partner name)',
        defaultMessage: 'Reached {name}',
    },
    variableName: {
        id: 'gui.lessonPracticePartner.variableName',
        description:
            'Small line under a value that reached the practice partner: the name of the variable it came in ' +
            '({name} = the variable name)',
        defaultMessage: '← {name}',
    },
    received: {
        id: 'gui.lessonPracticePartner.received',
        description:
            'Read aloud when a message reached the practice partner ({name} = the partner name, ' +
            '{what} = a message name, or "variable = value")',
        defaultMessage: 'Reached {name}: {what}',
    },
    nothingReceived: {
        id: 'gui.lessonPracticePartner.nothingReceived',
        description: 'Shown in the practice partner panel before anything reached the partner',
        defaultMessage: '(nothing yet)',
    },
    missingVariable: {
        id: 'gui.lessonPracticePartner.missingVariable',
        description:
            'Shown in the practice partner panel when a button needs a value the student has not entered yet ' +
            '(e.g. "DM to you" needs the student name). {name} = the variable name',
        defaultMessage: '"{name}" is still empty. Click the flag and enter it first.',
    },
    open: {
        id: 'gui.lessonPracticePartner.open',
        description: 'Button that shows the practice partner panel again after it was closed',
        defaultMessage: 'Practice partner',
    },
});

const LessonPracticePartner = ({
    announcement = '',
    arrivals = [],
    buttons,
    flashId = null,
    missingVariable = null,
    name,
    onClose,
    onOpen,
    onPress,
    open,
    position,
}) => {
    const intl = useIntl();
    const sendHeadingId = useId();
    const receivedHeadingId = useId();
    // 閉じたら「練習相手」のボタンへ、開いたら最初のボタン（無ければ ×）へフォーカスを移す。押したボタンが
    // 消えてフォーカスが body に落ちると、キーボードで操作している人がどこにいるか分からなくなるため。
    // チャレンジを開いたとき（最初の描画）は動かさない（作業中のフォーカスを奪わない）
    const openButtonRef = useRef(null);
    const panelRef = useRef(null);
    const wasOpenRef = useRef(open);
    useEffect(() => {
        if (wasOpenRef.current === open) return;
        wasOpenRef.current = open;
        if (!open) {
            if (openButtonRef.current) openButtonRef.current.focus();
            return;
        }
        const panel = panelRef.current;
        const first =
            panel &&
            (panel.querySelector('[data-testid="lesson-practice-partner-button"]') || panel.querySelector('button'));
        if (first) first.focus();
    }, [open]);
    if (!open) {
        return (
            <button
                className={styles.open}
                data-testid="lesson-practice-partner-open"
                onClick={onOpen}
                ref={openButtonRef}
                style={position}
                type="button"
            >
                {intl.formatMessage(messages.open)}
            </button>
        );
    }
    const title = intl.formatMessage(messages.title, { name });
    return (
        <section
            aria-label={title}
            className={styles.panel}
            data-testid="lesson-practice-partner"
            ref={panelRef}
            style={position}
        >
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
                <div aria-labelledby={sendHeadingId} data-testid="lesson-practice-partner-send" role="group">
                    <h3 className={styles.heading} id={sendHeadingId}>
                        {intl.formatMessage(messages.sendHeading, { name })}
                    </h3>
                    <div className={classNames(styles.group, styles.send)}>
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
                    </div>
                    {/* 押したのに、相手が使う変数（4-5 の「なまえ」）がまだ空で何もしなかったとき */}
                    {missingVariable ? (
                        <p className={styles.note} data-testid="lesson-practice-partner-missing" role="status">
                            {intl.formatMessage(messages.missingVariable, { name: missingVariable })}
                        </p>
                    ) : null}
                </div>
                <div
                    aria-labelledby={receivedHeadingId}
                    data-testid="lesson-practice-partner-received-group"
                    role="group"
                >
                    <h3 className={styles.heading} id={receivedHeadingId}>
                        {intl.formatMessage(messages.receivedHeading, { name })}
                    </h3>
                    {/* 高さは 3 行ぶんで固定（届くたびにパネルの高さが動かないように）。値は文字として出す */}
                    <ol
                        className={classNames(styles.group, styles.received)}
                        data-testid="lesson-practice-partner-received"
                    >
                        {arrivals.length === 0 ? (
                            <li className={styles.empty}>{intl.formatMessage(messages.nothingReceived)}</li>
                        ) : (
                            arrivals.map((arrival, index) => {
                                const hasValue = arrival.value !== null;
                                const flash = arrival.id === flashId;
                                const old = index > 0;
                                return (
                                    <li
                                        className={classNames(styles.item, {
                                            [styles.old]: old,
                                            [styles.flash]: flash,
                                        })}
                                        data-flash={String(flash)}
                                        data-kind={arrival.kind}
                                        data-old={String(old)}
                                        data-testid="lesson-practice-partner-received-item"
                                        key={arrival.id}
                                        title={hasValue ? `${arrival.name} = ${arrival.value}` : arrival.name}
                                    >
                                        <span
                                            className={styles.value}
                                            data-testid="lesson-practice-partner-received-value"
                                        >
                                            {hasValue ? arrival.value : arrival.name}
                                        </span>
                                        {hasValue && (
                                            <span
                                                className={styles.variableName}
                                                data-testid="lesson-practice-partner-received-name"
                                            >
                                                {intl.formatMessage(messages.variableName, { name: arrival.name })}
                                            </span>
                                        )}
                                    </li>
                                );
                            })
                        )}
                    </ol>
                </div>
                {/* 読み上げは合図が届いたときだけ（変数が変わるたびに読み上げない） */}
                <span
                    aria-live="polite"
                    className={styles.visuallyHidden}
                    data-testid="lesson-practice-partner-announcement"
                >
                    {announcement ? intl.formatMessage(messages.received, { name, what: announcement }) : ''}
                </span>
                <p className={styles.note} data-testid="lesson-practice-partner-note">
                    {intl.formatMessage(messages.note)}
                </p>
            </div>
        </section>
    );
};

LessonPracticePartner.propTypes = {
    // 相手に届いたもの（新しいものが先・3 行まで）。`value` が null なら合図の名前だけを出す
    arrivals: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            kind: PropTypes.oneOf(['message', 'variable']).isRequired,
            name: PropTypes.string.isRequired,
            value: PropTypes.string,
        }),
    ),
    buttons: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired })).isRequired,
    // いま光らせている行の id（届いてから 1 秒ほど）
    flashId: PropTypes.number,
    // 押したのに、まだ空で何もしなかった生徒の変数の名前（出すと「先に入れよう」の短い文になる）
    missingVariable: PropTypes.string,
    name: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    onOpen: PropTypes.func.isRequired,
    onPress: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired,
    // 置く場所（fixed の top / right。コンテナがステージの列から測る）
    position: PropTypes.shape({ top: PropTypes.number, right: PropTypes.number }),
    // 読み上げる文（合図が届いて変わったときだけ変わる）
    announcement: PropTypes.string,
};

export default LessonPracticePartner;
