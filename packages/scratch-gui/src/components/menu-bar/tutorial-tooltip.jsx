import PropTypes from 'prop-types'
import React from 'react'
import { FormattedMessage } from 'react-intl'
import styles from './tutorial-tooltip.css'

const TutorialTooltip = ({ onClick }) => (
  <div className={styles.tooltipContainer} onClick={onClick}>
    <div className={styles.tooltip}>
      <div className={styles.arrow} />
      <div className={styles.content}>
        <FormattedMessage
          defaultMessage="Try Ruby!"
          description="Tooltip prompting users to try Ruby mode"
          id="gui.menuBar.tutorialTooltip"
        />
      </div>
    </div>
  </div>
)

TutorialTooltip.propTypes = {
  onClick: PropTypes.func.isRequired,
}

export default TutorialTooltip
