// The classic "ホストになる / グループに参加" buttons on the first mesh screen of a
// student in a class. In class the seat-number entry above is the way to connect,
// so these are folded away (closed every time the modal opens) and say when to use them.
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import styles from './mesh-v2-seat-connect.css';
import createGroupImage from './mesh_v2_create_group.png';
import joinGroupImage from './mesh_v2_join_group.png';

const messages = defineMessages({
    toggle: {
        defaultMessage: 'Connect the classic way (Become host / Join group)',
        description: 'Button that shows the classic mesh connect buttons for a student in a class',
        id: 'gui.connection.meshV2Seat.classicToggle',
    },
    open: {
        defaultMessage: '▾ Open',
        description: 'Shown on the classic methods button while it is closed',
        id: 'gui.connection.meshV2Seat.classicOpen',
    },
    close: {
        defaultMessage: '▴ Close',
        description: 'Shown on the classic methods button while it is open',
        id: 'gui.connection.meshV2Seat.classicClose',
    },
    note: {
        defaultMessage: 'Only outside a class, or when your teacher says so.',
        description: 'Explains when to use the classic mesh connect buttons',
        id: 'gui.connection.meshV2Seat.classicNote',
    },
    createGroup: {
        defaultMessage: 'Become Mesh Host',
        description: 'Button to create a mesh group',
        id: 'gui.connection.meshV2Initial.createGroup',
    },
    createGroupDescription: {
        defaultMessage: 'Create Group',
        description: 'Description for creating a mesh group',
        id: 'gui.connection.meshV2Initial.createGroupDescription',
    },
    joinGroup: {
        defaultMessage: 'Join Mesh',
        description: 'Button to join an existing mesh group',
        id: 'gui.connection.meshV2Initial.joinGroup',
    },
    joinGroupDescription: {
        defaultMessage: 'Join Group',
        description: 'Description for joining a mesh group',
        id: 'gui.connection.meshV2Initial.joinGroupDescription',
    },
});

const MeshV2ClassicMethods = ({ onCreateGroup, onJoinGroup }) => {
    const [open, setOpen] = React.useState(false);
    const handleToggle = React.useCallback(() => setOpen((value) => !value), []);
    return (
        <div className={styles.classicArea}>
            <button
                aria-expanded={open}
                className={styles.classicToggle}
                data-testid="meshV2-classic-toggle"
                onClick={handleToggle}
            >
                <span>
                    <FormattedMessage {...messages.toggle} />
                </span>
                <span className={styles.classicToggleState}>
                    <FormattedMessage {...(open ? messages.close : messages.open)} />
                </span>
            </button>
            {open && (
                <div className={styles.classicPanel}>
                    <div className={styles.classicNote}>
                        <FormattedMessage {...messages.note} />
                    </div>
                    <div className={styles.classicButtons}>
                        <button
                            className={styles.classicButton}
                            data-testid="meshV2-create-group"
                            onClick={onCreateGroup}
                        >
                            <img className={styles.classicImage} src={createGroupImage} alt="" />
                            <span className={styles.classicText}>
                                <span className={styles.classicTitle}>
                                    <FormattedMessage {...messages.createGroup} />
                                </span>
                                <span className={styles.classicDescription}>
                                    <FormattedMessage {...messages.createGroupDescription} />
                                </span>
                            </span>
                        </button>
                        <button
                            className={styles.classicButton}
                            data-testid="meshV2-join-group"
                            onClick={onJoinGroup}
                        >
                            <img className={styles.classicImage} src={joinGroupImage} alt="" />
                            <span className={styles.classicText}>
                                <span className={styles.classicTitle}>
                                    <FormattedMessage {...messages.joinGroup} />
                                </span>
                                <span className={styles.classicDescription}>
                                    <FormattedMessage {...messages.joinGroupDescription} />
                                </span>
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

MeshV2ClassicMethods.propTypes = {
    onCreateGroup: PropTypes.func.isRequired,
    onJoinGroup: PropTypes.func.isRequired,
};

export default MeshV2ClassicMethods;
