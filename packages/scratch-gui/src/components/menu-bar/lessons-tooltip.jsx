// はじめての人向けの吹き出し。メニューバーの「レッスン」のボタンの下に出して、
// レッスン表へ案内する（一度レッスン表を開いたら出さない: reducers/tutorial-onboarding）。
// 見た目は共通の吹き出し（components/balloon）の緑の callout。
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import Balloon, { BALLOON_COLORS } from '../balloon/balloon.jsx';
import styles from './lessons-tooltip.css';

const LessonsTooltip = ({ onClick }) => (
    <div className={styles.tooltipContainer} data-testid="lessons-tooltip" onClick={onClick}>
        <Balloon className={styles.tooltip} color={BALLOON_COLORS.GREEN} arrowSide="bottom">
            <div className={styles.content}>
                <FormattedMessage
                    defaultMessage="Start a lesson!"
                    description="Balloon under the Lessons button inviting first-time users to open the lessons library"
                    id="gui.menuBar.lessonsTooltip"
                />
            </div>
        </Balloon>
    </div>
);

LessonsTooltip.propTypes = {
    onClick: PropTypes.func.isRequired,
};

export default LessonsTooltip;
