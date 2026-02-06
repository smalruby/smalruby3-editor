// === Smalruby: MeshV2 initial connection step ===
// This component shows initial connection options for meshV2 extension
// with two main actions: create group (become host) or join group.

import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';

import Box from '../box/box.jsx';

import createGroupImage from './mesh_v2_create_group.png';
import joinGroupImage from './mesh_v2_join_group.png';

import styles from './connection-modal.css';
import initialStepStyles from './mesh-v2-initial-step.css';

const MeshV2InitialStep = props => {
    const [domain, setDomain] = React.useState(props.domain || '');
    const [error, setError] = React.useState(null);

    const validate = React.useCallback(domainValue => {
        if (!domainValue) return null;

        if (domainValue.length > 256) {
            return 'tooLong';
        }

        // Allow alphanumeric, hyphen, underscore, dot.
        const validPattern = /^[a-zA-Z0-9-._]+$/;
        if (!validPattern.test(domainValue)) {
            return 'invalid';
        }

        return null;
    }, []);

    const handleDomainChange = React.useCallback(event => {
        const newDomain = event.target.value;
        const validationError = validate(newDomain);
        setDomain(newDomain);
        setError(validationError);

        // Only notify parent if valid
        if (!validationError) {
            props.onDomainChange(newDomain);
        }
    }, [validate, props]);

    return (
        <Box className={styles.body}>
            <Box className={styles.bottomArea}>
                <Box className={classNames(styles.bottomAreaItem, initialStepStyles.buttonContainer)}>
                    <button
                        className={initialStepStyles.actionButton}
                        onClick={props.onCreateGroup}
                    >
                        <img
                            className={initialStepStyles.buttonImage}
                            src={createGroupImage}
                            alt=""
                        />
                        <div className={initialStepStyles.buttonTextContainer}>
                            <div className={initialStepStyles.buttonTitle}>
                                <FormattedMessage
                                    defaultMessage="Become Mesh Host"
                                    description="Button to create a mesh group"
                                    id="gui.connection.meshV2Initial.createGroup"
                                />
                            </div>
                            <div className={initialStepStyles.buttonDescription}>
                                <FormattedMessage
                                    defaultMessage="Create Group"
                                    description="Description for creating a mesh group"
                                    id="gui.connection.meshV2Initial.createGroupDescription"
                                />
                            </div>
                        </div>
                    </button>
                    <button
                        className={initialStepStyles.actionButton}
                        onClick={props.onJoinGroup}
                    >
                        <img
                            className={initialStepStyles.buttonImage}
                            src={joinGroupImage}
                            alt=""
                        />
                        <div className={initialStepStyles.buttonTextContainer}>
                            <div className={initialStepStyles.buttonTitle}>
                                <FormattedMessage
                                    defaultMessage="Join Mesh"
                                    description="Button to join an existing mesh group"
                                    id="gui.connection.meshV2Initial.joinGroup"
                                />
                            </div>
                            <div className={initialStepStyles.buttonDescription}>
                                <FormattedMessage
                                    defaultMessage="Join Group"
                                    description="Description for joining a mesh group"
                                    id="gui.connection.meshV2Initial.joinGroupDescription"
                                />
                            </div>
                        </div>
                    </button>
                </Box>

                <Box className={classNames(styles.bottomAreaItem, initialStepStyles.domainSection)}>
                    <label className={initialStepStyles.domainLabel}>
                        <FormattedMessage
                            defaultMessage="Domain"
                            description="Label for domain input field"
                            id="gui.connection.meshV2Initial.domainLabel"
                        />
                    </label>
                    <input
                        className={classNames(initialStepStyles.domainInput, {
                            [initialStepStyles.inputError]: error
                        })}
                        type="text"
                        value={domain}
                        placeholder="100-0014"
                        onChange={handleDomainChange}
                    />
                    {error === 'tooLong' && (
                        <div className={initialStepStyles.errorMessage}>
                            <FormattedMessage
                                defaultMessage="Domain name is too long (max 256 characters)."
                                description="Error message for domain name exceeding 256 characters"
                                id="gui.connection.meshV2Initial.domainTooLongError"
                            />
                        </div>
                    )}
                    {error === 'invalid' && (
                        <div className={initialStepStyles.errorMessage}>
                            <FormattedMessage
                                defaultMessage="Domain name contains invalid characters."
                                description="Error message for invalid characters in domain name"
                                id="gui.connection.meshV2Initial.domainInvalidError"
                            />
                        </div>
                    )}
                    <div className={initialStepStyles.domainHelp}>
                        <FormattedMessage
                            defaultMessage={
                                'If groups are not displayed in the list, please set a domain. ' +
                                'A postal code for your school or facility is recommended.'
                            }
                            description="Help text for domain input"
                            id="gui.connection.meshV2Initial.domainHelp"
                        />
                    </div>
                </Box>
            </Box>
        </Box>
    );
};

MeshV2InitialStep.propTypes = {
    domain: PropTypes.string,
    onCreateGroup: PropTypes.func.isRequired,
    onDomainChange: PropTypes.func.isRequired,
    onJoinGroup: PropTypes.func.isRequired
};

export default MeshV2InitialStep;

// === Smalruby: End of MeshV2 initial connection step ===
