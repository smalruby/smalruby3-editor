import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import styles from './classroom-modal.css';
import { getSubmissionStatus, statusIconMessages } from './classroom-status-icon.jsx';
import { lessonSeatMessages } from './lesson-seat-tile.jsx';

/**
 * 座席の色の意味（#1926・案 A）。生徒の番号選び・先生のメンバータブ・状況のパネル・
 * レッスンの座席で同じ意味にそろえる: 空いている席は白地に点線の枠、人が来た席は
 * 色が付き、進むほど濃くなる。色だけに頼らないよう、提出済み・返却済み・クリアには
 * 印（✓ / ↩ / ★）を添える。
 */
const SEAT_COLOR_KINDS = ['empty', 'joined', 'submitted', 'returned', 'notStarted', 'inProgress', 'cleared'];

// 色だけで区別しないための印（凡例の色見本と座席の中に同じ印を出す）
const SEAT_COLOR_MARKS = {
    submitted: '✓',
    returned: '↩',
    cleared: '★',
};

const SWATCH_CLASSES = {
    empty: 'seatSwatchEmpty',
    joined: 'seatSwatchJoined',
    submitted: 'seatSwatchSubmitted',
    returned: 'seatSwatchReturned',
    notStarted: 'seatSwatchNotStarted',
    inProgress: 'seatSwatchJoined',
    cleared: 'seatSwatchSubmitted',
};

const messages = defineMessages({
    joined: {
        defaultMessage: 'Joined',
        description: 'Seat color legend: a pale blue seat is a student who joined',
        id: 'gui.classroom.teacherDetail.seatColorJoined',
    },
    notJoined: {
        defaultMessage: 'Empty',
        description: 'Seat color legend: a white seat with a dotted border has no student yet (#1956 Q12: 空席)',
        id: 'gui.classroom.teacherDetail.seatColorNotJoined',
    },
});

/**
 * ふつうの課題の凡例（#1926・C6）: 空席 → 参加済み → 提出済み ✓ → 返却済み ↩ の順。
 * 空席の文言は、メンバータブ・映す画面・状況のパネルとも「空席」（#1956 Q12）。
 * @param {object} emptyMessage - 空席の文言（react-intl の message descriptor）
 * @returns {Array<{kind: string, message: object}>} 凡例の項目
 */
const seatColorItems = (emptyMessage) => [
    { kind: 'empty', message: emptyMessage },
    { kind: 'joined', message: messages.joined },
    { kind: 'submitted', message: statusIconMessages.submitted },
    { kind: 'returned', message: statusIconMessages.returned },
];

const MEMBER_SEAT_COLOR_ITEMS = seatColorItems(messages.notJoined);
const PANEL_SEAT_COLOR_ITEMS = MEMBER_SEAT_COLOR_ITEMS;

// レッスンの課題の凡例: 空席 → 始めていない → 途中 → クリア ★ の順。
const LESSON_SEAT_COLOR_ITEMS = [
    { kind: 'empty', message: lessonSeatMessages.notJoined },
    { kind: 'notStarted', message: lessonSeatMessages.notStarted },
    { kind: 'inProgress', message: lessonSeatMessages.inProgress },
    { kind: 'cleared', message: lessonSeatMessages.cleared },
];

/**
 * その席に生徒が参加しているか。退室した（left）席は空席として出す。全画面でこの判定にそろえる
 * （状況のパネルの `getPresenceStatus` も同じ条件で 'notJoined' を返す）。
 * @param {?object} member - メンバーの記録（空席は null）
 * @returns {boolean} 参加しているなら true
 */
const isSeatJoined = (member) => !!member && !member.left;

/**
 * ふつうの課題の座席の色（メンバータブ・状況のパネル）。
 * @param {boolean} joined - その席に生徒が参加しているか（`isSeatJoined`）
 * @param {?string} submission - 'submitted' | 'returned' | 'notSubmitted' | null
 * @returns {string} 'empty' | 'joined' | 'submitted' | 'returned'
 */
const seatColorKind = (joined, submission) => {
    if (!joined) return 'empty';
    if (submission === 'returned') return 'returned';
    if (submission === 'submitted') return 'submitted';
    return 'joined';
};

/**
 * メンバーの記録からの座席の色。
 * @param {?object} member - メンバーの記録（空席は null）
 * @returns {string} 'empty' | 'joined' | 'submitted' | 'returned'
 */
const memberSeatColorKind = (member) => seatColorKind(isSeatJoined(member), getSubmissionStatus(member));

const SEAT_COLOR_CLASS_SUFFIXES = {
    empty: 'Empty',
    joined: 'Joined',
    submitted: 'Submitted',
    returned: 'Returned',
};

/**
 * 座席の色のクラス。メンバータブ（`memberCellJoined` など）と状況のパネル（`seatJoined` など）で
 * 接頭辞だけが違うので、色の種類からの対応はここ 1 つにする。
 * @param {object} cssModule - その画面の CSS モジュール
 * @param {string} prefix - クラス名の接頭辞（'memberCell' / 'seat'）
 * @param {string} kind - `seatColorKind` の値
 * @returns {string} クラス名
 */
const seatColorClass = (cssModule, prefix, kind) => cssModule[`${prefix}${SEAT_COLOR_CLASS_SUFFIXES[kind]}`];

/**
 * 座席の色の凡例。色見本は座席と同じ色・同じ印を使う。
 * @param {object} props - component props
 * @param {Array<{kind: string, message: object}>} props.items - 出す色（順番どおり）と文言
 * @param {boolean} props.small - 状況のパネルのような小さな座席の凡例（枠が 1px）
 * @param {string} props.className - wrapper の追加クラス
 * @param {string} props.testId - wrapper の data-testid
 * @param {React.ReactNode} props.children - 色のあとに続ける凡例（「!」など）
 * @returns {React.ReactElement} the legend
 */
const SeatColorLegend = ({ items, small, className, testId, children }) => {
    const intl = useIntl();
    return (
        <div
            className={classNames(styles.seatColorLegend, small && styles.seatColorLegendSmall, className)}
            data-testid={testId}
        >
            {items.map(({ kind, message }) => (
                <span className={styles.statusLegendItem} data-testid={`${testId}-${kind}`} key={kind}>
                    <span
                        aria-hidden="true"
                        className={classNames(
                            styles.seatSwatch,
                            styles[SWATCH_CLASSES[kind]],
                            small && styles.seatSwatchSmall,
                        )}
                    >
                        {SEAT_COLOR_MARKS[kind] || null}
                    </span>
                    {intl.formatMessage(message)}
                    {/* 小さな凡例は色見本の中の印だけ（1 行に収める） */}
                    {SEAT_COLOR_MARKS[kind] && !small ? ` ${SEAT_COLOR_MARKS[kind]}` : null}
                </span>
            ))}
            {children}
        </div>
    );
};

SeatColorLegend.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    items: PropTypes.arrayOf(
        PropTypes.shape({
            kind: PropTypes.oneOf(SEAT_COLOR_KINDS).isRequired,
            message: PropTypes.object.isRequired,
        }),
    ).isRequired,
    small: PropTypes.bool,
    testId: PropTypes.string.isRequired,
};

export {
    LESSON_SEAT_COLOR_ITEMS,
    MEMBER_SEAT_COLOR_ITEMS,
    PANEL_SEAT_COLOR_ITEMS,
    SEAT_COLOR_KINDS,
    SEAT_COLOR_MARKS,
    isSeatJoined,
    memberSeatColorKind,
    seatColorClass,
    seatColorKind,
};
export default SeatColorLegend;
