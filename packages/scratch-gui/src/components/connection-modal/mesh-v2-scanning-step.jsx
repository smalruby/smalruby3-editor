// === Smalruby: This file is Smalruby-specific (meshV2 scanning step with name search) ===
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import Box from '../box/box.jsx';
import styles from './connection-modal.css';
import Dots from './dots.jsx';
import refreshIcon from './icons/refresh.svg';
import radarIcon from './icons/searching.png';
import warningIcon from './icons/warning.svg';
import PeripheralTile from './peripheral-tile.jsx';

const MESH_V2_NAME_LABEL = 'メッシュに参加する';

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

const MeshV2ScanningStep = (props) => (
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
                                name={peripheral.name}
                                nameLabel={MESH_V2_NAME_LABEL}
                                peripheralId={peripheral.peripheralId}
                                rssi={peripheral.rssi}
                                onConnecting={props.onConnecting}
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

MeshV2ScanningStep.propTypes = {
    connectionSmallIconURL: PropTypes.string,
    hiraganaInput: PropTypes.string.isRequired,
    onBack: PropTypes.func,
    onConnecting: PropTypes.func,
    onHiraganaClear: PropTypes.func.isRequired,
    onHiraganaInput: PropTypes.func.isRequired,
    onRefresh: PropTypes.func,
    peripheralList: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string,
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
