// はじめての人向けの吹き出し。メニューバーの「レッスン」のボタンの下に出して、
// レッスン表へ案内する（一度レッスン表を開いたら出さない: reducers/tutorial-onboarding）。
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styles from './lessons-tooltip.css';

const LessonsTooltip = ({ onClick }) => (
    <div className={styles.tooltipContainer} data-testid="lessons-tooltip" onClick={onClick}>
        <div className={styles.tooltip}>
            <div className={styles.arrow} />
            <div className={styles.content}>
                <FormattedMessage
                    defaultMessage="Start a lesson!"
                    description="Balloon under the Lessons button inviting first-time users to open the lessons library"
                    id="gui.menuBar.lessonsTooltip"
                />
            </div>
        </div>
    </div>
);

LessonsTooltip.propTypes = {
    onClick: PropTypes.func.isRequired,
};

export default LessonsTooltip;
