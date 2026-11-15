import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import Box from '../box/box.jsx';
import Label from '../forms/label.jsx';
import Input from '../forms/input.jsx';
import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import DirectionPicker from '../../containers/direction-picker.jsx';

import {injectIntl, defineMessages, FormattedMessage} from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import {STAGE_DISPLAY_SIZES} from '../../lib/layout-constants.js';
import {isWideLocale} from '../../lib/locale-utils.js';

import styles from './sprite-info.css';

import xIcon from './icon--x.svg';
import yIcon from './icon--y.svg';
import showIcon from './icon--show.svg';
import hideIcon from './icon--hide.svg';
import ToggleButtons from '../toggle-buttons/toggle-buttons.jsx';
// === Smalruby: Start of compact middle sprite info ===
import sizeIcon from './icon--size.svg';
import directionIcon from '../direction-picker/icon--all-around.svg';
// === Smalruby: End of compact middle sprite info ===

const BufferedInput = BufferedInputHOC(Input);

const messages = defineMessages({
    spritePlaceholder: {
        id: 'gui.SpriteInfo.spritePlaceholder',
        defaultMessage: 'Name',
        description: 'Placeholder text for sprite name'
    },
    showSpriteAction: {
        id: 'gui.SpriteInfo.showSpriteAction',
        defaultMessage: 'Show sprite',
        description: 'Tooltip for show sprite button'
    },
    hideSpriteAction: {
        id: 'gui.SpriteInfo.hideSpriteAction',
        defaultMessage: 'Hide sprite',
        description: 'Tooltip for hide sprite button'
    },
    // === Smalruby: Start of compact middle sprite info ===
    sizeIcon: {
        id: 'gui.smalruby3.SpriteInfo.sizeIcon',
        defaultMessage: 'Size (%)',
        description: 'Tooltip for the size icon shown next to the size input on the middle stage'
    },
    directionIcon: {
        id: 'gui.smalruby3.SpriteInfo.directionIcon',
        defaultMessage: 'Direction (degrees)',
        description: 'Tooltip for the direction icon shown next to the direction input on the middle stage'
    }
    // === Smalruby: End of compact middle sprite info ===
});

class SpriteInfo extends React.Component {
    shouldComponentUpdate (nextProps) {
        return (
            this.props.rotationStyle !== nextProps.rotationStyle ||
            this.props.disabled !== nextProps.disabled ||
            this.props.name !== nextProps.name ||
            this.props.stageSize !== nextProps.stageSize ||
            this.props.visible !== nextProps.visible ||
            // Only update these if rounded value has changed
            Math.round(this.props.direction) !== Math.round(nextProps.direction) ||
            Math.round(this.props.size) !== Math.round(nextProps.size) ||
            Math.round(this.props.x) !== Math.round(nextProps.x) ||
            Math.round(this.props.y) !== Math.round(nextProps.y)
        );
    }
    render () {
        const {
            stageSize
        } = this.props;

        const sprite = (
            <FormattedMessage
                defaultMessage="Sprite"
                description="Sprite info label"
                id="gui.SpriteInfo.sprite"
            />
        );
        const showLabel = (
            <FormattedMessage
                defaultMessage="Show"
                description="Sprite info show label"
                id="gui.SpriteInfo.show"
            />
        );
        const sizeLabel = (
            <FormattedMessage
                defaultMessage="Size"
                description="Sprite info size label"
                id="gui.SpriteInfo.size"
            />
        );

        const labelAbove = isWideLocale(this.props.intl.locale);

        const spriteNameInput = (
            <BufferedInput
                className={classNames(
                    styles.spriteInput,
                    {
                        [styles.columnInput]: labelAbove
                    }
                )}
                disabled={this.props.disabled}
                placeholder={this.props.intl.formatMessage(messages.spritePlaceholder)}
                tabIndex="0"
                type="text"
                value={this.props.disabled ? '' : this.props.name}
                onSubmit={this.props.onChangeName}
            />
        );

        const xPosition = (
            <div className={styles.group}>
                {
                    (stageSize === STAGE_DISPLAY_SIZES.large) ?
                        <div className={styles.iconWrapper}>
                            <img
                                aria-hidden="true"
                                className={classNames(styles.xIcon, styles.icon)}
                                src={xIcon}
                            />
                        </div> :
                        null
                }
                <Label
                    text="x"
                    // === Smalruby: Start of compact middle sprite info ===
                    above={stageSize === STAGE_DISPLAY_SIZES.middle}
                    // === Smalruby: End of compact middle sprite info ===
                >
                    <BufferedInput
                        small
                        disabled={this.props.disabled}
                        placeholder="x"
                        tabIndex="0"
                        type="text"
                        value={this.props.disabled ? '' : Math.round(this.props.x)}
                        onSubmit={this.props.onChangeX}
                    />
                </Label>
            </div>
        );

        const yPosition = (
            <div className={styles.group}>
                {
                    (stageSize === STAGE_DISPLAY_SIZES.large) ?
                        <div className={styles.iconWrapper}>
                            <img
                                aria-hidden="true"
                                className={classNames(styles.yIcon, styles.icon)}
                                src={yIcon}
                            />
                        </div> :
                        null
                }
                <Label
                    text="y"
                    // === Smalruby: Start of compact middle sprite info ===
                    above={stageSize === STAGE_DISPLAY_SIZES.middle}
                    // === Smalruby: End of compact middle sprite info ===
                >
                    <BufferedInput
                        small
                        disabled={this.props.disabled}
                        placeholder="y"
                        tabIndex="0"
                        type="text"
                        value={this.props.disabled ? '' : Math.round(this.props.y)}
                        onSubmit={this.props.onChangeY}
                    />
                </Label>
            </div>
        );

        // === Smalruby: Start of compact middle sprite info ===
        // 中サイズのステージ（Smalruby 独自）では、ラベルを詰めてスプライトの一覧の高さを増やす:
        // 「スプライト」の字は出さず、x / y は入力欄の左隣、大きさ / 向きはアイコンにして左隣に置く。
        if (stageSize === STAGE_DISPLAY_SIZES.middle) {
            const labelIcon = (icon, message, testId) => {
                const text = this.props.intl.formatMessage(message);
                return (
                    <img
                        alt={text}
                        aria-label={text}
                        className={styles.labelIcon}
                        data-testid={testId}
                        draggable={false}
                        src={icon}
                        title={text}
                    />
                );
            };
            return (
                <Box
                    className={classNames(styles.spriteInfo, styles.compact)}
                    data-testid="sprite-info-compact"
                >
                    <div className={classNames(styles.row, styles.rowPrimary)}>
                        <div className={classNames(styles.group, styles.compactName)}>
                            {spriteNameInput}
                        </div>
                        <div className={styles.group}>
                            <Label text="x">
                                <BufferedInput
                                    small
                                    disabled={this.props.disabled}
                                    placeholder="x"
                                    tabIndex="0"
                                    type="text"
                                    value={this.props.disabled ? '' : Math.round(this.props.x)}
                                    onSubmit={this.props.onChangeX}
                                />
                            </Label>
                        </div>
                        <div className={styles.group}>
                            <Label text="y">
                                <BufferedInput
                                    small
                                    disabled={this.props.disabled}
                                    placeholder="y"
                                    tabIndex="0"
                                    type="text"
                                    value={this.props.disabled ? '' : Math.round(this.props.y)}
                                    onSubmit={this.props.onChangeY}
                                />
                            </Label>
                        </div>
                    </div>
                    <div className={classNames(styles.row, styles.rowSecondary)}>
                        <div className={styles.group}>
                            <ToggleButtons
                                buttons={[
                                    {
                                        handleClick: this.props.onClickVisible,
                                        icon: showIcon,
                                        isSelected: this.props.visible && !this.props.disabled,
                                        title: this.props.intl.formatMessage(messages.showSpriteAction)
                                    },
                                    {
                                        handleClick: this.props.onClickNotVisible,
                                        icon: hideIcon,
                                        isSelected: !this.props.visible && !this.props.disabled,
                                        title: this.props.intl.formatMessage(messages.hideSpriteAction)
                                    }
                                ]}
                                disabled={this.props.disabled}
                            />
                        </div>
                        <div className={classNames(styles.group, styles.largerInput)}>
                            <Label
                                secondary
                                text={labelIcon(sizeIcon, messages.sizeIcon, 'sprite-info-size-icon')}
                            >
                                <BufferedInput
                                    small
                                    disabled={this.props.disabled}
                                    label={sizeLabel}
                                    tabIndex="0"
                                    type="text"
                                    value={this.props.disabled ? '' : Math.round(this.props.size)}
                                    onSubmit={this.props.onChangeSize}
                                />
                            </Label>
                        </div>
                        <div className={classNames(styles.group, styles.largerInput)}>
                            <DirectionPicker
                                direction={Math.round(this.props.direction)}
                                disabled={this.props.disabled}
                                labelIcon={labelIcon(
                                    directionIcon,
                                    messages.directionIcon,
                                    'sprite-info-direction-icon'
                                )}
                                rotationStyle={this.props.rotationStyle}
                                onChangeDirection={this.props.onChangeDirection}
                                onChangeRotationStyle={this.props.onChangeRotationStyle}
                            />
                        </div>
                    </div>
                </Box>
            );
        }
        // === Smalruby: End of compact middle sprite info ===

        if (stageSize === STAGE_DISPLAY_SIZES.small) {
            return (
                <Box className={styles.spriteInfo}>
                    <div className={classNames(styles.row, styles.rowPrimary)}>
                        <div className={styles.group}>
                            {spriteNameInput}
                        </div>
                    </div>
                    <div className={classNames(styles.row, styles.rowSecondary)}>
                        {xPosition}
                        {yPosition}
                    </div>
                </Box>
            );
        }

        return (
            <Box className={styles.spriteInfo}>
                <div className={classNames(styles.row, styles.rowPrimary)}>
                    <div className={styles.group}>
                        <Label
                            above={labelAbove}
                            text={sprite}
                        >
                            {spriteNameInput}
                        </Label>
                    </div>
                    {xPosition}
                    {yPosition}
                </div>
                <div className={classNames(styles.row, styles.rowSecondary)}>
                    <div className={labelAbove ? styles.column : styles.group}>
                        {
                            stageSize === STAGE_DISPLAY_SIZES.large ?
                                <Label
                                    secondary
                                    text={showLabel}
                                /> :
                                null
                        }
                        <ToggleButtons
                            buttons={[
                                {
                                    handleClick: this.props.onClickVisible,
                                    icon: showIcon,
                                    isSelected: this.props.visible && !this.props.disabled,
                                    title: this.props.intl.formatMessage(messages.showSpriteAction)
                                },
                                {
                                    handleClick: this.props.onClickNotVisible,
                                    icon: hideIcon,
                                    isSelected: !this.props.visible && !this.props.disabled,
                                    title: this.props.intl.formatMessage(messages.hideSpriteAction)
                                }
                            ]}
                            disabled={this.props.disabled}
                        />
                    </div>
                    <div className={classNames(styles.group, styles.largerInput)}>
                        <Label
                            secondary
                            above={labelAbove}
                            text={sizeLabel}
                        >
                            <BufferedInput
                                small
                                disabled={this.props.disabled}
                                label={sizeLabel}
                                tabIndex="0"
                                type="text"
                                value={this.props.disabled ? '' : Math.round(this.props.size)}
                                onSubmit={this.props.onChangeSize}
                            />
                        </Label>
                    </div>
                    <div className={classNames(styles.group, styles.largerInput)}>
                        <DirectionPicker
                            direction={Math.round(this.props.direction)}
                            disabled={this.props.disabled}
                            labelAbove={labelAbove}
                            rotationStyle={this.props.rotationStyle}
                            onChangeDirection={this.props.onChangeDirection}
                            onChangeRotationStyle={this.props.onChangeRotationStyle}
                        />
                    </div>
                </div>
            </Box>
        );
    }
}

SpriteInfo.propTypes = {
    direction: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    disabled: PropTypes.bool,
    intl: intlShape,
    name: PropTypes.string,
    onChangeDirection: PropTypes.func,
    onChangeName: PropTypes.func,
    onChangeRotationStyle: PropTypes.func,
    onChangeSize: PropTypes.func,
    onChangeX: PropTypes.func,
    onChangeY: PropTypes.func,
    onClickNotVisible: PropTypes.func,
    onClickVisible: PropTypes.func,
    rotationStyle: PropTypes.string,
    size: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    visible: PropTypes.bool,
    x: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    y: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ])
};

export default injectIntl(SpriteInfo);
