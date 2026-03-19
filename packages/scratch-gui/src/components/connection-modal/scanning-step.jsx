import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import BalancedFormattedMessage from '../../containers/balanced-formatted-message.jsx';
import Box from '../box/box.jsx';
import PeripheralTile from './peripheral-tile.jsx';
import Dots from './dots.jsx';

import enterUpdateIcon from './icons/enter-update.svg';
import radarIcon from './icons/searching.png';
import refreshIcon from './icons/refresh.svg';
import warningIcon from './icons/warning.svg';

import styles from './connection-modal.css';

// === Smalruby: Start of meshV2 name search ===
const HIRAGANA_BUTTONS_ROW1 = ['い', 'し', 'か', 'た', 'う', 'ん', 'て', 'と'];
const HIRAGANA_BUTTONS_ROW2 = ['の', 'つ', 'は', 'こ', 'に', 'な', 'く', 'き'];

const HiraganaButton = ({char, disabled, onInput}) => {
    const handleClick = React.useCallback(() => onInput(char), [char, onInput]);
    return (
        <button
            className={styles.hiraganaButton}
            disabled={disabled}
            onClick={handleClick}
        >
            {char}
        </button>
    );
};

HiraganaButton.propTypes = {
    char: PropTypes.string.isRequired,
    disabled: PropTypes.bool.isRequired,
    onInput: PropTypes.func.isRequired
};

const HiraganaNameSearch = props => (
    <div className={styles.nameSearchSection}>
        <div className={styles.nameSearchLabel}>
            <FormattedMessage
                defaultMessage="Search by name"
                description="Label for hiragana name search section in mesh v2"
                id="gui.connection.scanning.nameSearchLabel"
            />
        </div>
        <div className={styles.hiraganaButtonGrid}>
            {[HIRAGANA_BUTTONS_ROW1, HIRAGANA_BUTTONS_ROW2].map((row, rowIdx) => (
                <div
                    className={styles.hiraganaButtonRow}
                    key={rowIdx}
                >
                    {row.map(char => (
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
                <span className={styles.hiraganaInputText}>
                    {props.hiraganaInput}
                </span>
                <button
                    className={styles.hiraganaClearButton}
                    onClick={props.onHiraganaClear}
                >
                    {'✕'}
                </button>
            </div>
        )}
        {props.nameSearching && (
            <div className={styles.nameSearchStatus}>
                <img
                    className={classNames(styles.radarSmall, styles.radarSpin)}
                    src={radarIcon}
                />
                <FormattedMessage
                    defaultMessage="Searching..."
                    description="Text shown while searching by name"
                    id="gui.connection.scanning.nameSearching"
                />
            </div>
        )}
        {!props.nameSearching && props.hiraganaInput.length >= 6 &&
            props.nameSearchResults.length > 0 && (
            <div className={styles.peripheralTilePane}>
                {props.nameSearchResults.map(peripheral => (
                    <PeripheralTile
                        connectionSmallIconURL={props.connectionSmallIconURL}
                        key={peripheral.peripheralId}
                        name={peripheral.name}
                        peripheralId={peripheral.peripheralId}
                        rssi={peripheral.rssi}
                        onConnecting={props.onConnecting}
                    />
                ))}
            </div>
        )}
        {!props.nameSearching && props.hiraganaInput.length >= 6 &&
            props.nameSearchResults.length === 0 && (
            <div className={styles.nameSearchStatus}>
                <FormattedMessage
                    defaultMessage="No groups found"
                    description="Text shown when name search returns no results"
                    id="gui.connection.scanning.nameSearchNoResults"
                />
            </div>
        )}
    </div>
);

HiraganaNameSearch.propTypes = {
    connectionSmallIconURL: PropTypes.string,
    hiraganaInput: PropTypes.string.isRequired,
    nameSearchResults: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        rssi: PropTypes.number,
        peripheralId: PropTypes.string
    })),
    nameSearching: PropTypes.bool.isRequired,
    onConnecting: PropTypes.func,
    onHiraganaClear: PropTypes.func.isRequired,
    onHiraganaInput: PropTypes.func.isRequired
};
// === Smalruby: End of meshV2 name search ===

const ScanningStep = props => {
    const showUpdate = !!(props.onUpdatePeripheral && !props.scanning);
    return (<Box className={styles.body}>
        <Box className={styles.activityArea}>
            {props.scanning ? (
                props.peripheralList.length === 0 ? (
                    <div className={styles.activityAreaInfo}>
                        <div className={styles.centeredRow}>
                            <img
                                className={classNames(styles.radarSmall, styles.radarSpin)}
                                src={radarIcon}
                            />
                            <FormattedMessage
                                defaultMessage="Looking for devices"
                                description="Text shown while scanning for devices"
                                id="gui.connection.scanning.lookingforperipherals"
                            />
                        </div>
                    </div>
                ) : (
                    <div className={styles.peripheralTilePane}>
                        {props.peripheralList.map(peripheral =>
                            (<PeripheralTile
                                connectionSmallIconURL={props.connectionSmallIconURL}
                                key={peripheral.peripheralId}
                                name={peripheral.name}
                                peripheralId={peripheral.peripheralId}
                                rssi={peripheral.rssi}
                                onConnecting={props.onConnecting}
                            />)
                        )}
                    </div>
                )
            ) : (
                <Box className={styles.centeredRow}>
                    <img
                        className={styles.helpStepImage}
                        src={warningIcon}
                    />
                    <FormattedMessage
                        className={styles.helpStepText}
                        defaultMessage="No devices found"
                        description="Text shown when no devices could be found"
                        id="gui.connection.scanning.noPeripheralsFound"
                    />
                </Box>
            )}
        </Box>
        {/* === Smalruby: Start of meshV2 name search === */}
        {props.extensionId === 'meshV2' && props.onHiraganaInput && (
            <HiraganaNameSearch
                connectionSmallIconURL={props.connectionSmallIconURL}
                hiraganaInput={props.hiraganaInput}
                nameSearchResults={props.nameSearchResults}
                nameSearching={props.nameSearching}
                onConnecting={props.onConnecting}
                onHiraganaClear={props.onHiraganaClear}
                onHiraganaInput={props.onHiraganaInput}
            />
        )}
        {/* === Smalruby: End of meshV2 name search === */}
        <Box className={styles.bottomArea}>
            <Box className={classNames(styles.bottomAreaItem, styles.instructions)}>
                {(props.scanning || props.peripheralList.length > 0) && (
                    // Show this message if we're still scanning OR if we've found devices
                    <FormattedMessage
                        defaultMessage="Select your device in the list above."
                        description="Prompt for choosing a device to connect to"
                        id="gui.connection.scanning.instructions"
                    />
                )}
                {showUpdate && (
                    // Show this message if we're done scanning AND we can update
                    // Note that it's possible the list includes devices but does not include the desired device,
                    // so don't limit this message to the (props.peripheralList.length === 0) case
                    <BalancedFormattedMessage
                        defaultMessage="If you don't see your device, you may need to update it to work with Scratch."
                        description="Prompt for updating a peripheral device"
                        id="gui.connection.scanning.updatePeripheralPrompt"
                    />
                )}
            </Box>
            <Dots
                className={styles.bottomAreaItem}
                counter={0}
                total={3}
            />
            <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
                {/* === Smalruby: Start of back button for meshV2 === */}
                {props.extensionId === 'meshV2' && props.onBack && (
                    <button
                        className={styles.connectionButton}
                        onClick={props.onBack}
                    >
                        <FormattedMessage
                            defaultMessage="Back"
                            description="Button to go back to initial step"
                            id="gui.connection.scanning.backButton"
                        />
                    </button>
                )}
                {/* === Smalruby: End of back button for meshV2 === */}
                <button
                    className={styles.connectionButton}
                    onClick={props.onRefresh}
                >
                    <FormattedMessage
                        defaultMessage="Refresh"
                        description="Button in prompt for starting a search"
                        id="gui.connection.search"
                    />
                    <img
                        className={styles.buttonIconRight}
                        src={refreshIcon}
                    />
                </button>
                {showUpdate && (
                    <button
                        className={styles.connectionButton}
                        onClick={props.onUpdatePeripheral}
                    >
                        <FormattedMessage
                            defaultMessage="Update my Device"
                            description="Button to enter the peripheral update mode"
                            id="gui.connection.scanning.updatePeripheralButton"
                        />
                        <img
                            className={styles.buttonIconRight}
                            src={enterUpdateIcon}
                        />
                    </button>
                )}
            </Box>
        </Box>
    </Box>);
};

ScanningStep.propTypes = {
    connectionSmallIconURL: PropTypes.string,
    extensionId: PropTypes.string,
    // === Smalruby: Start of meshV2 name search ===
    hiraganaInput: PropTypes.string,
    // === Smalruby: End of meshV2 name search ===
    onBack: PropTypes.func,
    onConnecting: PropTypes.func,
    // === Smalruby: Start of meshV2 name search ===
    onHiraganaClear: PropTypes.func,
    onHiraganaInput: PropTypes.func,
    // === Smalruby: End of meshV2 name search ===
    onRefresh: PropTypes.func,
    onUpdatePeripheral: PropTypes.func,
    // === Smalruby: Start of meshV2 name search ===
    nameSearchResults: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        rssi: PropTypes.number,
        peripheralId: PropTypes.string
    })),
    nameSearching: PropTypes.bool,
    // === Smalruby: End of meshV2 name search ===
    peripheralList: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        rssi: PropTypes.number,
        peripheralId: PropTypes.string
    })),
    scanning: PropTypes.bool.isRequired
};

ScanningStep.defaultProps = {
    peripheralList: [],
    scanning: true,
    // === Smalruby: Start of meshV2 name search ===
    hiraganaInput: '',
    nameSearching: false,
    nameSearchResults: []
    // === Smalruby: End of meshV2 name search ===
};

export default ScanningStep;
