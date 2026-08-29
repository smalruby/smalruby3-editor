/**
 * クラス管理画面の共通ボタン (#1125)。
 *
 * 画面ごとに `styles.primaryButton` / `styles.secondaryButton` を直接書いていたため、
 * 新しい画面を足すたびに枠線・角丸・並び順がずれていた (#1121 / #1122)。ボタンは
 * この 1 コンポーネントに集約し、見た目のバリエーションは variant だけで表す。
 *
 * 新しい画面でも `<ClassroomButton variant="primary">` / `variant="secondary"` を
 * 使えば自動的にスタイルがそろう。並び (セカンダリ左・プライマリ右) は
 * `TeacherScreen` / `TeacherSubView` の footer スロットが担当する。
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import styles from './classroom-modal.css';

/**
 * variant → classroom-modal.css のクラスキー。CSS Modules は jest では空オブジェクトに
 * なりクラス文字列を検証できないため、対応表そのものを export してテストで pin する。
 */
export const BUTTON_VARIANT_STYLE_KEYS = {
    danger: 'dangerButton',
    primary: 'primaryButton',
    secondary: 'secondaryButton',
};

const ClassroomButton = ({
    autoFocus,
    children,
    className,
    dataTestId,
    disabled,
    title,
    type = 'button',
    variant = 'secondary',
    onClick,
}) => (
    <button
        autoFocus={autoFocus}
        className={classNames(styles[BUTTON_VARIANT_STYLE_KEYS[variant]], className)}
        data-testid={dataTestId}
        disabled={disabled}
        title={title}
        type={type}
        onClick={onClick}
    >
        {children}
    </button>
);

ClassroomButton.propTypes = {
    autoFocus: PropTypes.bool,
    children: PropTypes.node,
    /** 画面固有の微調整クラス (例: 左寄せ) を足したいときだけ使う。 */
    className: PropTypes.string,
    dataTestId: PropTypes.string,
    disabled: PropTypes.bool,
    title: PropTypes.string,
    type: PropTypes.oneOf(['button', 'submit']),
    variant: PropTypes.oneOf(Object.keys(BUTTON_VARIANT_STYLE_KEYS)),
    onClick: PropTypes.func,
};

export default ClassroomButton;
