import PropTypes from 'prop-types';
import React from 'react';
import styles from './student-screen-parts.css';

/**
 * 生徒の画面の小さな文字のリンク (#1792)。主ボタン以外の操作に使い、主ボタンと同じ重さに
 * 見せない（白地のボタンを主ボタンと並べない）。見た目はリンクだが、画面の中の操作なので button。
 * @param {object} props - component props
 * @param {React.ReactNode} props.children - リンクの文字
 * @param {string} props.dataTestId - data-testid
 * @param {boolean} [props.disabled] - 押せないとき
 * @param {Function} props.onClick - 押したとき
 * @returns {React.ReactElement} the link
 */
const StudentTextLink = ({ children, dataTestId, disabled = false, onClick }) => (
    <button className={styles.textLink} data-testid={dataTestId} disabled={disabled} type="button" onClick={onClick}>
        {children}
    </button>
);

StudentTextLink.propTypes = {
    children: PropTypes.node.isRequired,
    dataTestId: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
};

export default StudentTextLink;
