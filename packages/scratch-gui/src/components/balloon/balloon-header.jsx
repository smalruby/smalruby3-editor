// panel の吹き出しのヘッダー（色の帯 + 見出し + 閉じる）。
// 残りの props（data-testid・title・onPointerDown など）は帯の要素に渡す（ヒントの吹き出しはここをドラッグの取っ手にする）。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import BalloonCloseButton from './balloon-close-button.jsx';
import styles from './balloon.css';

const BalloonHeader = ({ children, className, closeIcon, closeLabel, closeTestId, onClose, ...rest }) => (
    <div className={classNames(styles.header, className)} {...rest}>
        <span className={styles.headerTitle}>{children}</span>
        {onClose ? (
            <BalloonCloseButton
                icon={closeIcon}
                label={closeLabel || ''}
                title={closeLabel}
                testId={closeTestId}
                onClick={onClose}
            />
        ) : null}
    </div>
);

BalloonHeader.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    // 閉じるボタンの印（無ければ ×）
    closeIcon: PropTypes.node,
    closeLabel: PropTypes.string,
    closeTestId: PropTypes.string,
    onClose: PropTypes.func,
};

export default BalloonHeader;
