/**
 * The ✕ at the top right of a floating panel of the assignment editor
 * (レッスン欄・詳しい設定, #1770). It looks like the ✕ of the shared modal
 * header (`CloseButton` large) so teachers recognise it, but is a real
 * `<button>` with a translated name and a testid (the shared one is a div
 * labelled "Close").
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import closeStyles from '../close-button/close-button.css';
import closeIcon from '../close-button/icon--close.svg';
import styles from './classroom-modal.css';

const messages = defineMessages({
    close: {
        defaultMessage: 'Close',
        description: 'Assignment editor: accessible name of the ✕ that closes the lesson / advanced settings panel',
        id: 'gui.classroom.assignmentEditor.panelClose',
    },
});

const PanelCloseButton = ({ onClick, testId }) => {
    const intl = useIntl();
    const label = intl.formatMessage(messages.close);
    return (
        <button
            aria-label={label}
            className={classNames(closeStyles.closeButton, closeStyles.large, styles.panelCloseButton)}
            data-testid={testId}
            title={label}
            type="button"
            onClick={onClick}
        >
            <img alt="" className={closeStyles.closeIcon} draggable={false} src={closeIcon} />
        </button>
    );
};

PanelCloseButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    testId: PropTypes.string.isRequired,
};

export default PanelCloseButton;
