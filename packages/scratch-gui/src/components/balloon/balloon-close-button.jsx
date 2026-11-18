// 吹き出しの閉じる（×）ボタン。色の帯や塗りの吹き出しの上に置く半透明の丸。
// `icon` で × 以外の印にできる（ヒントの吹き出しは閉じずに小さくするので「－」）。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styles from './balloon.css';

const BalloonCloseButton = ({ className, icon = '×', label, onClick, testId, title }) => (
    <button
        type="button"
        className={classNames(styles.closeButton, className)}
        data-testid={testId}
        aria-label={label}
        title={title}
        onClick={onClick}
    >
        {icon}
    </button>
);

BalloonCloseButton.propTypes = {
    className: PropTypes.string,
    // ボタンの印（無ければ ×）
    icon: PropTypes.node,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    testId: PropTypes.string,
    // マウスを乗せたときの説明。翻訳した文言があるときだけ渡す（aria-label だけの部品もある）
    title: PropTypes.string,
};

export default BalloonCloseButton;
