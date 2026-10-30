// === Smalruby: This file is Smalruby-specific (meshV2 scanning step with name search) ===
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { describeSeatGroup, needsSeatJoinConfirm } from '../../lib/mesh-v2-seat-label.js';
import Box from '../box/box.jsx';
import styles from './connection-modal.css';
import Dots from './dots.jsx';
import refreshIcon from './icons/refresh.svg';
import radarIcon from './icons/searching.png';
import warningIcon from './icons/warning.svg';
import PeripheralTile from './peripheral-tile.jsx';

const MESH_V2_NAME_LABEL = 'メッシュに参加する';

const messages = defineMessages({
    seatsGroup: {
        defaultMessage: 'Group for seats {seats} ({label})',
        description: 'Mesh group created for some seat numbers in a classroom',
        id: 'gui.connection.meshV2Scanning.seatsGroup',
    },
    hostSeatGroup: {
        defaultMessage: 'Group hosted by seat {host} ({label})',
        description: 'Mesh group hosted by a student (seat number) in a classroom',
        id: 'gui.connection.meshV2Scanning.hostSeatGroup',
    },
    teacherGroup: {
        defaultMessage: "Teacher's group ({label})",
        description: 'Mesh group hosted by the teacher of the classroom',
        id: 'gui.connection.meshV2Scanning.teacherGroup',
    },
    notChosenConfirm: {
        defaultMessage:
            'This group is for seats {seats}. You (seat {mySeat}) are not one of them. Do you still want to join?',
        description: 'Confirm before a student joins a mesh group made for other seat numbers',
        id: 'gui.connection.meshV2Scanning.notChosenConfirm',
    },
});

/**
 * Name of a group in the list. Seat numbers are shown only inside a classroom;
 * other groups keep the plain 【label】 name.
 * @param {object} intl - react-intl object.
 * @param {object} peripheral - meshV2 peripheral (`seatInfo` / `meshIdLabel` from the VM).
 * @param {?object} mySeat - own seat, or null outside a classroom.
 * @returns {string} the name to show.
 */
const groupDisplayName = (intl, peripheral, mySeat) => {
    const seatGroup = mySeat ? describeSeatGroup(peripheral.seatInfo) : null;
    if (!seatGroup) return peripheral.name;
    const label = peripheral.meshIdLabel;
    if (seatGroup.kind === 'seats') return intl.formatMessage(messages.seatsGroup, { seats: seatGroup.seats, label });
    if (seatGroup.kind === 'teacher') return intl.formatMessage(messages.teacherGroup, { label });
    return intl.formatMessage(messages.hostSeatGroup, { host: seatGroup.host, label });
};

const HIRAGANA_BUTTONS_ROW1 = ['い', 'し', 'か', 'た', 'う', 'ん', 'て', 'と'];
const HIRAGANA_BUTTONS_ROW2 = ['の', 'つ', 'は', 'こ', 'に', 'な', 'く', 'き'];

const HiraganaButton = ({ char, disabled, onInput }) => {
    const handleClick = React.useCallback(() => onInput(char), [char, onInput]);
    return (
        <button className={styles.hiraganaButton} disabled={disabled} onClick={handleClick}>
            {char}
        </button>
    );
};

HiraganaButton.propTypes = {
    char: PropTypes.string.isRequired,
    disabled: PropTypes.bool.isRequired,
    onInput: PropTypes.func.isRequired,
};

const HiraganaNameSearch = (props) => (
    <div className={styles.nameSearchSection}>
        <div className={styles.hiraganaButtonGrid}>
            {[HIRAGANA_BUTTONS_ROW1, HIRAGANA_BUTTONS_ROW2].map((row, rowIdx) => (
                <div className={styles.hiraganaButtonRow} key={rowIdx}>
                    {row.map((char) => (
                        <HiraganaButton
                            char={char}
                            disabled={props.hiraganaInput.length >= 6}
                            key={char}
                            onInput={props.onHiraganaInput}
                        />
                    ))}
                </div>
            ))}
        </div>
        {props.hiraganaInput.length > 0 && (
            <div className={styles.hiraganaInputDisplay}>
                <span className={styles.hiraganaInputText}>{props.hiraganaInput}</span>
                <button className={styles.hiraganaClearButton} onClick={props.onHiraganaClear}>
                    {'✕'}
                </button>
            </div>
        )}
    </div>
);

HiraganaNameSearch.propTypes = {
    hiraganaInput: PropTypes.string.isRequired,
    onHiraganaClear: PropTypes.func.isRequired,
    onHiraganaInput: PropTypes.func.isRequired,
};

const MeshV2ScanningStep = (props) => {
    const intl = useIntl();
    const { mySeat, onConnecting, peripheralList } = props;
    const handleConnecting = React.useCallback(
        (peripheralId) => {
            const peripheral = peripheralList.find((p) => p.peripheralId === peripheralId);
            if (peripheral && needsSeatJoinConfirm(peripheral.seatInfo, mySeat)) {
                const message = intl.formatMessage(messages.notChosenConfirm, {
                    seats: describeSeatGroup(peripheral.seatInfo).seats,
                    mySeat: mySeat.seat,
                });
                if (!window.confirm(message)) return; // eslint-disable-line no-alert
            }
            if (onConnecting) onConnecting(peripheralId);
        },
        [intl, mySeat, onConnecting, peripheralList],
    );
    return (
        <Box className={styles.body}>
            <Box className={styles.activityArea}>
                {props.scanning ? (
                    props.peripheralList.length === 0 ? (
                        <div className={styles.activityAreaInfo}>
                            <div className={styles.centeredRow}>
                                <img className={classNames(styles.radarSmall, styles.radarSpin)} src={radarIcon} />
                                <FormattedMessage
                                    defaultMessage="Looking for hosts"
                                    description="Text shown while scanning for mesh hosts"
                                    id="gui.connection.meshV2Scanning.lookingForHosts"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className={styles.peripheralTilePane}>
                            {props.peripheralList.map((peripheral) => (
                                <PeripheralTile
                                    connectionSmallIconURL={props.connectionSmallIconURL}
                                    key={peripheral.peripheralId}
                                    name={groupDisplayName(intl, peripheral, mySeat)}
                                    nameLabel={MESH_V2_NAME_LABEL}
                                    peripheralId={peripheral.peripheralId}
                                    rssi={peripheral.rssi}
                                    onConnecting={handleConnecting}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <Box className={styles.centeredRow}>
                        <img className={styles.helpStepImage} src={warningIcon} />
                        <FormattedMessage
                            className={styles.helpStepText}
                            defaultMessage="No hosts found"
                            description="Text shown when no mesh hosts could be found"
                            id="gui.connection.meshV2Scanning.noHostsFound"
                        />
                    </Box>
                )}
            </Box>
            <HiraganaNameSearch
                hiraganaInput={props.hiraganaInput}
                onHiraganaClear={props.onHiraganaClear}
                onHiraganaInput={props.onHiraganaInput}
            />
            <Box className={styles.bottomArea}>
                <Dots className={styles.bottomAreaItem} counter={0} total={3} />
                <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
                    {props.onBack && (
                        <button className={styles.connectionButton} onClick={props.onBack}>
                            <FormattedMessage
                                defaultMessage="Back"
                                description="Button to go back to initial step"
                                id="gui.connection.scanning.backButton"
                            />
                        </button>
                    )}
                    <button className={styles.connectionButton} onClick={props.onRefresh}>
                        <FormattedMessage
                            defaultMessage="Refresh"
                            description="Button in prompt for starting a search"
                            id="gui.connection.search"
                        />
                        <img className={styles.buttonIconRight} src={refreshIcon} />
                    </button>
                </Box>
            </Box>
        </Box>
    );
};

MeshV2ScanningStep.propTypes = {
    connectionSmallIconURL: PropTypes.string,
    hiraganaInput: PropTypes.string.isRequired,
    mySeat: PropTypes.shape({
        seat: PropTypes.number,
        teacher: PropTypes.bool,
    }),
    onBack: PropTypes.func,
    onConnecting: PropTypes.func,
    onHiraganaClear: PropTypes.func.isRequired,
    onHiraganaInput: PropTypes.func.isRequired,
    onRefresh: PropTypes.func,
    peripheralList: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string,
            meshIdLabel: PropTypes.string,
            seatInfo: PropTypes.shape({
                seats: PropTypes.arrayOf(PropTypes.number),
                host: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
            }),
            rssi: PropTypes.number,
            peripheralId: PropTypes.string,
        }),
    ),
    scanning: PropTypes.bool.isRequired,
};

MeshV2ScanningStep.defaultProps = {
    peripheralList: [],
    scanning: true,
    hiraganaInput: '',
};

export default MeshV2ScanningStep;
