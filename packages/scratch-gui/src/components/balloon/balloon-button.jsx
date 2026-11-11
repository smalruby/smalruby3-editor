// 吹き出しの中のボタン（もどる / 進める / OK）。primary は塗り、そうでなければ枠だけ。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styles from './balloon.css';

const BalloonButton = ({ children, className, primary = false, ...rest }) => (
    <button
        type="button"
        className={classNames(styles.button, { [styles.primary]: primary }, className)}
        data-balloon-primary={primary ? 'true' : 'false'}
        {...rest}
    >
        {children}
    </button>
);

BalloonButton.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    primary: PropTypes.bool,
};

export default BalloonButton;
