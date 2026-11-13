import PropTypes from 'prop-types';
import React from 'react';
import styles from './student-screen-parts.css';

/**
 * 生徒の画面の主ボタン (#1792)。大きい青のボタンで、下に説明の小さい字を添えられる。
 * 主ボタンは画面に 1 つだけ置く（docs/classroom/ui-ux.md の「生徒の画面の決まり」）。
 * @param {object} props - component props
 * @param {React.ReactNode} props.children - ボタンの文字
 * @param {string} props.dataTestId - data-testid（説明の行は `<dataTestId>-note`）
 * @param {boolean} [props.disabled] - 押せないとき
 * @param {React.ReactNode} [props.note] - 説明の小さい字（例:「10/25 に出したもの」）
 * @param {string} [props.type] - button の type
 * @param {Function} [props.onClick] - 押したとき
 * @returns {React.ReactElement} the button
 */
const StudentMainButton = ({ children, dataTestId, disabled = false, note = null, type = 'button', onClick }) => (
    <button className={styles.mainButton} data-testid={dataTestId} disabled={disabled} type={type} onClick={onClick}>
        {children}
        {note && (
            <small className={styles.mainButtonNote} data-testid={`${dataTestId}-note`}>
                {note}
            </small>
        )}
    </button>
);

StudentMainButton.propTypes = {
    children: PropTypes.node.isRequired,
    dataTestId: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    note: PropTypes.node,
    type: PropTypes.oneOf(['button', 'submit']),
    onClick: PropTypes.func,
};

export default StudentMainButton;
