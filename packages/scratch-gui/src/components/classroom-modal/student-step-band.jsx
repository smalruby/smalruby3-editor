import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { studentStepStates } from '../../lib/classroom-student-steps.js';
import styles from './student-screen-parts.css';

const messages = defineMessages({
    label: {
        defaultMessage: 'Steps',
        description: 'Accessible label of the student progress band (join → seat → start → make → submit)',
        id: 'gui.classroom.stepBand.label',
    },
    join: {
        defaultMessage: '① Join',
        description: 'Student progress band step 1: enter the join code',
        id: 'gui.classroom.stepBand.join',
    },
    seat: {
        defaultMessage: '② Seat',
        description: 'Student progress band step 2: choose the seat number',
        id: 'gui.classroom.stepBand.seat',
    },
    start: {
        defaultMessage: '③ Start',
        description: 'Student progress band step 3: start the assignment',
        id: 'gui.classroom.stepBand.start',
    },
    make: {
        defaultMessage: '④ Make',
        description: 'Student progress band step 4: make the project',
        id: 'gui.classroom.stepBand.make',
    },
    submit: {
        defaultMessage: '⑤ Submit',
        description: 'Student progress band step 5: submit the project',
        id: 'gui.classroom.stepBand.submit',
    },
});

/**
 * 進む順の帯「① 参加 → ② 番号 → ③ はじめる → ④ つくる → ⑤ 提出」(#1792)。
 * すんだ段は薄い緑、いまの段は青、まだの段は灰色。全部すんだら全部緑で ⑤ に ✓。
 * 札は押せない（行き先を選ばせないため）。
 * @param {object} props - component props（studentStepStates の入力）
 * @param {string} props.phase - クラスの画面のフェーズ
 * @param {?string} [props.submissionStatus] - この課題の提出状況
 * @param {boolean} [props.assignmentReopened] - 課題パネルを「課題を見る」から開き直した
 * @param {?object} [props.lesson] - レッスンの課題の `{submitWork, cleared}`
 * @returns {?React.ReactElement} the band (null when not a student screen)
 */
const StudentStepBand = ({ phase, submissionStatus = null, assignmentReopened = false, lesson = null }) => {
    const intl = useIntl();
    const band = studentStepStates({ phase, submissionStatus, assignmentReopened, lesson });
    if (!band) return null;
    return (
        <ol
            aria-label={intl.formatMessage(messages.label)}
            className={styles.stepBand}
            data-complete={String(band.complete)}
            data-testid="classroom-step-band"
        >
            {band.steps.map(({ step, state }, index) => (
                <li className={styles.stepBandItem} key={step}>
                    {index > 0 && (
                        <span aria-hidden="true" className={styles.stepBandArrow}>
                            →
                        </span>
                    )}
                    <span
                        aria-current={state === 'now' ? 'step' : null}
                        className={styles.stepBandStep}
                        data-state={state}
                        data-testid={`classroom-step-band-${step}`}
                    >
                        {intl.formatMessage(messages[step])}
                        {band.complete && step === 'submit' && ' ✓'}
                    </span>
                </li>
            ))}
        </ol>
    );
};

StudentStepBand.propTypes = {
    assignmentReopened: PropTypes.bool,
    lesson: PropTypes.shape({ submitWork: PropTypes.bool, cleared: PropTypes.bool }),
    phase: PropTypes.string.isRequired,
    submissionStatus: PropTypes.string,
};

export default StudentStepBand;
