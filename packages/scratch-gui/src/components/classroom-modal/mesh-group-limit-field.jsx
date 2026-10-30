/**
 * Mesh group size limit setting of an assignment (#1257).
 *
 * Shared by the create screen and the assignment editor. The value is
 * 6 ("up to 6", the default for new assignments) or 0 ("no limit").
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { normalizeMeshGroupLimit } from '../../lib/classroom-assignment-utils.js';

import styles from './classroom-modal.css';

const messages = defineMessages({
    upToSix: {
        defaultMessage: 'Up to 6',
        description: 'Assignment setting: mesh group size option — at most 6 students per group',
        id: 'gui.classroom.assignmentEditor.meshGroupLimitSix',
    },
    noLimit: {
        defaultMessage: 'No limit',
        description: 'Assignment setting: mesh group size option — no limit on the group size',
        id: 'gui.classroom.assignmentEditor.meshGroupLimitNone',
    },
});

const MeshGroupLimitField = ({ disabled, testId, value, onChange }) => {
    const intl = useIntl();
    const handleChange = useCallback(
        (e) => onChange && onChange(normalizeMeshGroupLimit(e.target.value)),
        [onChange],
    );

    return (
        <div className={styles.assignmentPeerView}>
            <label className={styles.assignmentPeerViewRow}>
                <span className={styles.assignmentStartFromPreviousLabel}>
                    <FormattedMessage
                        defaultMessage="Mesh group size"
                        description="Assignment setting: label of the mesh group size limit"
                        id="gui.classroom.assignmentEditor.meshGroupLimit"
                    />
                </span>
                <select
                    className={styles.assignmentPeerViewSelect}
                    data-testid={testId}
                    disabled={disabled}
                    value={String(normalizeMeshGroupLimit(value))}
                    onChange={handleChange}
                >
                    <option value="6">{intl.formatMessage(messages.upToSix)}</option>
                    <option value="0">{intl.formatMessage(messages.noLimit)}</option>
                </select>
            </label>
            <span className={styles.assignmentStartFromPreviousHint}>
                <FormattedMessage
                    defaultMessage={'With "No limit" the whole class can be one group: when you press "Become host", it becomes the teacher\'s group, and students join it with one tap.'}
                    description="Assignment setting: explanation of the no-limit mesh group size"
                    id="gui.classroom.assignmentEditor.meshGroupLimitHint"
                />
            </span>
        </div>
    );
};

MeshGroupLimitField.propTypes = {
    disabled: PropTypes.bool,
    testId: PropTypes.string.isRequired,
    value: PropTypes.number,
    onChange: PropTypes.func,
};

export default MeshGroupLimitField;
