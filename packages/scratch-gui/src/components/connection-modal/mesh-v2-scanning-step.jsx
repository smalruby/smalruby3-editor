// === Smalruby: This file is Smalruby-specific (meshV2 scanning step with name search) ===
import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import Box from '../box/box.jsx';
import PeripheralTile from './peripheral-tile.jsx';
import Dots from './dots.jsx';

import radarIcon from './icons/searching.png';
import refreshIcon from './icons/refresh.svg';
import warningIcon from './icons/warning.svg';

import styles from './connection-modal.css';

const MESH_V2_NAME_LABEL = 'メッシュに参加する';

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
                id="gui.connection.meshV2Scanning.nameSearchLabel"
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
                        nameLabel={MESH_V2_NAME_LABEL}
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

const MeshV2ScanningStep = props => (
    <Box className={styles.body}>
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
                                defaultMessage="Looking for hosts"
                                description="Text shown while scanning for mesh hosts"
                                id="gui.connection.meshV2Scanning.lookingForHosts"
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
                                nameLabel={MESH_V2_NAME_LABEL}
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
                        defaultMessage="No hosts found"
                        description="Text shown when no mesh hosts could be found"
                        id="gui.connection.meshV2Scanning.noHostsFound"
                    />
                </Box>
            )}
        </Box>
        <Box className={classNames(styles.bottomAreaItem, styles.instructions)}>
            {(props.scanning || props.peripheralList.length > 0) && (
                <FormattedMessage
                    defaultMessage="Select a host in the list above."
                    description="Prompt for choosing a mesh host to connect to"
                    id="gui.connection.meshV2Scanning.instructions"
                />
            )}
        </Box>
        <HiraganaNameSearch
            connectionSmallIconURL={props.connectionSmallIconURL}
            hiraganaInput={props.hiraganaInput}
            nameSearchResults={props.nameSearchResults}
            nameSearching={props.nameSearching}
            onConnecting={props.onConnecting}
            onHiraganaClear={props.onHiraganaClear}
            onHiraganaInput={props.onHiraganaInput}
        />
        <Box className={styles.bottomArea}>
            <Dots
                className={styles.bottomAreaItem}
                counter={0}
                total={3}
            />
            <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
                {props.onBack && (
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
            </Box>
        </Box>
    </Box>
);

MeshV2ScanningStep.propTypes = {
    connectionSmallIconURL: PropTypes.string,
    hiraganaInput: PropTypes.string.isRequired,
    nameSearchResults: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        rssi: PropTypes.number,
        peripheralId: PropTypes.string
    })),
    nameSearching: PropTypes.bool.isRequired,
    onBack: PropTypes.func,
    onConnecting: PropTypes.func,
    onHiraganaClear: PropTypes.func.isRequired,
    onHiraganaInput: PropTypes.func.isRequired,
    onRefresh: PropTypes.func,
    peripheralList: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        rssi: PropTypes.number,
        peripheralId: PropTypes.string
    })),
    scanning: PropTypes.bool.isRequired
};

MeshV2ScanningStep.defaultProps = {
    peripheralList: [],
    scanning: true,
    hiraganaInput: '',
    nameSearching: false,
    nameSearchResults: []
};

export default MeshV2ScanningStep;
