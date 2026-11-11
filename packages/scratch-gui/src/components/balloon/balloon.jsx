// 吹き出し・ツールチップの見た目の土台（枠・角丸・影・しっぽ・色・文字）。
// いつ出すか・どこに置くか・中身は使う側（レッスンのヒント、メニューバーの案内など）が持つ。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styles from './balloon.css';

const BALLOON_VARIANTS = Object.freeze({
    // 色で塗った小さな案内
    CALLOUT: 'callout',
    // 白地に色の枠の、中に操作を持つ吹き出し
    PANEL: 'panel',
});

const BALLOON_COLORS = Object.freeze({
    BLUE: 'blue',
    GREEN: 'green',
});

// 吹き出しが指す場所のどちら側にあるか（しっぽはその反対の辺に付く）
const ARROW_SIDES = ['top', 'bottom', 'left', 'right'];

const Balloon = React.forwardRef(
    (
        { arrowSide = null, arrowStyle, children, className, color = BALLOON_COLORS.BLUE, variant = BALLOON_VARIANTS.CALLOUT, ...rest },
        ref,
    ) => (
        <div
            ref={ref}
            className={classNames(styles.balloon, styles[variant], styles[color], className)}
            data-balloon-variant={variant}
            data-balloon-color={color}
            {...rest}
        >
            {ARROW_SIDES.includes(arrowSide) ? (
                <div
                    className={classNames(styles.arrow, styles[`arrow-${arrowSide}`])}
                    data-balloon-arrow={arrowSide}
                    style={arrowStyle}
                />
            ) : null}
            {children}
        </div>
    ),
);

Balloon.displayName = 'Balloon';

Balloon.propTypes = {
    arrowSide: PropTypes.oneOf([...ARROW_SIDES, null]),
    // しっぽの辺に沿った位置（{left} か {top}）。無ければ辺の真ん中
    arrowStyle: PropTypes.object,
    children: PropTypes.node,
    className: PropTypes.string,
    color: PropTypes.oneOf(Object.values(BALLOON_COLORS)),
    variant: PropTypes.oneOf(Object.values(BALLOON_VARIANTS)),
};

export default Balloon;
export { ARROW_SIDES, BALLOON_COLORS, BALLOON_VARIANTS };
