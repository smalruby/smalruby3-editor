/**
 * 先生からのコメント (#1963)。返却の画面（おかえりなさい）・参加した直後の「前回の先生からのコメント」・
 * もう一度の提出の確認で、同じ形で出す。
 *
 * 以前は黄色い枠に「先生からのコメント」とだけ書いた箱で、事務的で警告にも見えた。先生のアイコンと
 * 吹き出しにして、「先生から」届いたことが一目で分かるようにする（黄色・アラートの形は使わない）。
 */
import PropTypes from 'prop-types';
import React, { useId } from 'react';
import { FormattedMessage } from 'react-intl';
import styles from './student-screen-parts.css';

/**
 * 先生のアイコン（人の形と吹き出し）。飾りなので読み上げない。
 * @returns {React.ReactElement} the icon
 */
const TeacherIcon = () => (
    <svg aria-hidden="true" focusable="false" height="20" viewBox="0 0 20 20" width="20">
        <circle cx="8" cy="6" fill="currentColor" r="3.2" />
        <path d="M2 17.5c0-3.6 2.7-6 6-6s6 2.4 6 6z" fill="currentColor" />
        <path
            d="M13 1.5h5.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-2.5l-2 1.6v-1.6h-1a1 1 0 0 1-1-1v-3.5a1 1 0 0 1 1-1z"
            fill="currentColor"
        />
    </svg>
);

/**
 * @param {object} props - component props
 * @param {boolean} [props.compact] - 本文を 3 行半で止める（作品の画像と並ぶ、もう一度の提出の確認）
 * @param {React.ReactNode} [props.context] - 「先生から」の右に添える小さな字（前回の課題名など）
 * @param {string} props.dataTestId - 外枠の data-testid
 * @param {string} props.text - 先生のコメント
 * @param {string} [props.textTestId] - コメントの本文の data-testid
 * @returns {React.ReactElement} the note
 */
const StudentTeacherNote = ({ compact = false, context = null, dataTestId, text, textTestId }) => {
    const fromId = useId();
    return (
        <div className={styles.teacherNote} data-testid={dataTestId}>
            <span className={styles.teacherNoteAvatar}>
                <TeacherIcon />
            </span>
            <div className={styles.teacherNoteBubble}>
                <div className={styles.teacherNoteHead}>
                    <span className={styles.teacherNoteFrom} id={fromId}>
                        <FormattedMessage
                            defaultMessage="From your teacher"
                            description="Heading of the bubble that shows a comment the teacher returned to the student"
                            id="gui.classroom.studentStatus.teacherComment"
                        />
                    </span>
                    {context && <span className={styles.teacherNoteContext}>{context}</span>}
                </div>
                {/* A long comment scrolls inside the bubble (6.5 lines), so it can be
                    reached with the keyboard too. */}
                <div
                    aria-labelledby={fromId}
                    className={
                        compact
                            ? `${styles.teacherNoteText} ${styles.teacherNoteTextCompact}`
                            : styles.teacherNoteText
                    }
                    data-testid={textTestId}
                    role="region"
                    tabIndex={0}
                >
                    {text}
                </div>
            </div>
        </div>
    );
};

StudentTeacherNote.propTypes = {
    compact: PropTypes.bool,
    context: PropTypes.node,
    dataTestId: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    textTestId: PropTypes.string,
};

export default StudentTeacherNote;
