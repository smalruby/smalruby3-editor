/**
 * クラス管理画面の共通ボタン (#1125)。
 *
 * 画面ごとに `styles.primaryButton` / `styles.secondaryButton` を直接書いていたため、
 * 新しい画面を足すたびに枠線・角丸・並び順がずれていた (#1121 / #1122)。ボタンは
 * この 1 コンポーネントに集約し、見た目のバリエーションは variant だけで表す。
 *
 * 新しい画面でも `<ClassroomButton variant="primary">` / `variant="secondary"` /
 * `variant="text"` を使えば自動的にスタイルがそろう（形は Scratch のボタン・高さ 36px・#1956 Q6。
 * 決まりは docs/design-system/components/buttons.md の「クラス管理のボタン」）。並び (セカンダリ左・プライマリ右) は
 * `TeacherScreen` / `TeacherSubView` の footer スロットが担当する。
 *
 * AI を使うボタン（押すと AI を呼ぶ）は `ai` を付ける (#2518)。枠が虹色になってゆっくりめぐり、
 * 文字の左にキラキラのアイコンが付く。アイコンはこの部品が出すので、呼ぶ側で SVG を書かない。
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
    text: 'textButton',
};

/** `ai` のときに variant のクラスへ足す classroom-modal.css のクラスキー (#2518)。 */
export const AI_BUTTON_STYLE_KEY = 'aiButton';

/* 3 つの星のキラキラ（同意したモックアップの形）。色は文字の色（currentColor）に合わせる */
const AiSparkleIcon = () => (
    <svg
        aria-hidden="true"
        className={styles.aiButtonIcon}
        data-testid="classroom-button-ai-icon"
        focusable="false"
        viewBox="0 0 24 24"
    >
        <path
            d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8L2.5 17.5l1.8-.7z"
            fill="currentColor"
        />
    </svg>
);

const ClassroomButton = ({
    ai = false,
    ariaBusy,
    ariaCurrent,
    ariaExpanded,
    ariaHasPopup,
    ariaLabel,
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
        aria-busy={ariaBusy}
        aria-current={ariaCurrent}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHasPopup}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className={classNames(
            styles[BUTTON_VARIANT_STYLE_KEYS[variant]],
            ai && styles[AI_BUTTON_STYLE_KEY],
            className,
        )}
        data-testid={dataTestId}
        disabled={disabled}
        title={title}
        type={type}
        onClick={onClick}
    >
        {ai && <AiSparkleIcon />}
        {children}
    </button>
);

ClassroomButton.propTypes = {
    /** 押すと AI を呼ぶボタン。虹色の枠とキラキラのアイコンを付ける (#2518)。 */
    ai: PropTypes.bool,
    /** 押したあと、応答を待っている (採点の手順のボタン #2419)。 */
    ariaBusy: PropTypes.bool,
    /** 手順のうち、いまの手順 (`"step"`) を示す (採点の画面 #1304)。 */
    ariaCurrent: PropTypes.string,
    /** メニューを開くボタンの開閉状態。 */
    ariaExpanded: PropTypes.bool,
    ariaHasPopup: PropTypes.string,
    /** 見える文字が記号だけのとき（‹ ›）の名前。 */
    ariaLabel: PropTypes.string,
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
