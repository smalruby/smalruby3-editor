import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import StudentMainButton from './student-main-button.jsx';
import styles from './student-screen-parts.css';

/**
 * 提出できました (#1795)。提出が終わったら大きく「提出できました ✓」を出し、主ボタンは
 * 「つづける」（モーダルを閉じる）。メニューバーのボタンは緑の「提出済み ✓」に変わる。
 * @param {object} props - component props
 * @param {Function} props.onContinue - 「つづける」を押したとき
 * @returns {React.ReactElement} the screen
 */
const StudentSubmitDone = ({ onContinue }) => (
    <div className={styles.submitDone} data-testid="classroom-phase-submit-done">
        <div className={styles.submitDoneTitle} data-testid="classroom-submit-done-title" role="status">
            <FormattedMessage
                defaultMessage="Your project is submitted ✓"
                description="Big message shown right after the student submitted the project"
                id="gui.classroom.submitDone.title"
            />
        </div>
        <StudentMainButton dataTestId="classroom-submit-done-continue" onClick={onContinue}>
            <FormattedMessage
                defaultMessage="Continue"
                description="Main button after submitting: closes the classroom screen to keep working"
                id="gui.classroom.submitDone.continue"
            />
        </StudentMainButton>
    </div>
);

StudentSubmitDone.propTypes = {
    onContinue: PropTypes.func.isRequired,
};

export default StudentSubmitDone;
