import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {connect} from 'react-redux';

import LanguageMenu from './language-menu.jsx';
import MenuBarMenu from './menu-bar-menu.jsx';
import {MenuSection, MenuItem} from '../menu/menu.jsx';
import PreferenceMenu from './preference-menu.jsx';
// === Smalruby: Start of display mode menu ===
import useDisplayMode from '../../lib/use-display-mode.js';
import {displayModeMap, messages as displayModeMessages} from '../../lib/settings/display-mode/index.js';
import {persistDisplayMode} from '../../lib/settings/display-mode/persistence.js';
import displayModeIcon from './icon--display-mode.svg';
// === Smalruby: End of display mode menu ===

import {DEFAULT_MODE, HIGH_CONTRAST_MODE, colorModeMap} from '../../lib/settings/color-mode/index.js';
import {themeMap} from '../../lib/settings/theme/index.js';
import {rubyVersionMap, messages as rubyVersionMessages} from '../../lib/settings/ruby-version/index.js';
import {persistColorMode} from '../../lib/settings/color-mode/persistence.js';
import {persistTheme} from '../../lib/settings/theme/persistence.js';
import {persistRubyVersion} from '../../lib/settings/ruby-version/persistence.js';
import {setColorMode, setTheme, setRubyVersion} from '../../reducers/settings.js';

import menuBarStyles from './menu-bar.css';
import styles from './settings-menu.css';

import dropdownCaret from './dropdown-caret.svg';
import settingsIcon from './icon--settings.svg';
import themeIcon from '../../lib/assets/icon--theme.svg';
import rubyIcon from '../../containers/ruby-tab/icon--ruby.svg';
import blockDisplayIcon from './block-display-icon.png';
// === Smalruby: Start of classroom management menu ===
import {isClassroomConfigured} from '../../lib/classroom-api';
import {openTeacherModal} from '../../reducers/classroom';
import googleClassroomIcon from '../classroom-teacher-modal/google-classroom-icon.png';
// === Smalruby: End of classroom management menu ===
import {
    colorModeMenuOpen,
    themeMenuOpen,
    rubyVersionMenuOpen,
    openColorModeMenu,
    openThemeMenu,
    openRubyVersionMenu,
    // === Smalruby: Start of display mode menu ===
    displayModeMenuOpen,
    openDisplayModeMenu
    // === Smalruby: End of display mode menu ===
} from '../../reducers/menus.js';

const enabledColorModes = [DEFAULT_MODE, HIGH_CONTRAST_MODE];

const SettingsMenu = ({
    vm,
    canChangeLanguage,
    canChangeColorMode,
    canChangeTheme,
    hasActiveMembership,
    isRtl,
    isColorModeMenuOpen,
    isThemeMenuOpen,
    isRubyVersionMenuOpen,
    isDisplayModeMenuOpen,
    activeColorMode,
    activeRubyVersion,
    onChangeColorMode,
    onChangeRubyVersion,
    onRequestOpenColorMode,
    onRequestOpenTheme,
    onRequestOpenRubyVersion,
    onRequestOpenDisplayMode,
    onOpenBlockDisplayModal,
    onOpenTeacherModal,
    activeTheme,
    onChangeTheme,
    onRequestClose,
    onRequestOpen,
    settingsMenuOpen
}) => {
    const intl = useIntl();
    // === Smalruby: Start of display mode menu ===
    // 表示モード (auto / PC / スマホ) の現在値と切替ハンドラ (Issue #865)。
    // 他の設定メニュー (テーマ / Ruby バージョン) と同じ PreferenceMenu の
    // サブメニューとして出す。表示モードは Redux ではなく localStorage 駆動
    // (useDisplayMode で購読) なので、選択時は persistDisplayMode するだけ。
    const activeDisplayMode = useDisplayMode();
    const handleChangeDisplayMode = useCallback(mode => {
        persistDisplayMode(mode);
        onRequestClose();
    }, [onRequestClose]);
    // === Smalruby: End of display mode menu ===
    const enabledColorModesMap = useMemo(() => Object.keys(colorModeMap).reduce((acc, colorMode) => {
        if (enabledColorModes.includes(colorMode)) {
            acc[colorMode] = colorModeMap[colorMode];
        }
        return acc;
    }, {}), []);
    const availableThemesMap = useMemo(() => Object.keys(themeMap).reduce((acc, themeKey) => {
        const theme = themeMap[themeKey];
        if (theme.isAvailable?.({hasActiveMembership})) {
            acc[themeKey] = theme;
        }
        return acc;
    }, {}), [hasActiveMembership]);
    const availableThemesLength = useMemo(() => Object.keys(availableThemesMap).length, [availableThemesMap]);

    const handleChangeRubyVersion = useCallback(rubyVersion => {
        // === Smalruby: Start of v1 switch prevention ===
        // Prevent switching to v1 when v2 features (module/class) are in use
        if (rubyVersion === '1' && vm.runtime) { // eslint-disable-line react/prop-types
            const hasV2Features = vm.runtime.targets.some(target => { // eslint-disable-line react/prop-types
                if (!target.comments) return false;
                return Object.values(target.comments).some(comment =>
                    comment.text && (
                        comment.text.startsWith('@ruby:module_source:') ||
                        comment.text === '@ruby:class' ||
                        comment.text.startsWith('@ruby:class:')
                    )
                );
            });
            if (hasV2Features) {
                // eslint-disable-next-line no-alert
                alert(intl.formatMessage(rubyVersionMessages.cannotSwitchToV1));
                return;
            }
        }
        // === Smalruby: End of v1 switch prevention ===
        onChangeRubyVersion(rubyVersion);
    }, [intl, vm, onChangeRubyVersion]);

    return (
        <div
            className={classNames(menuBarStyles.menuBarItem, menuBarStyles.hoverable, menuBarStyles.colorModeMenu, {
                [menuBarStyles.active]: settingsMenuOpen
            })}
            data-testid="settings-menu"
            onClick={onRequestOpen}
        >
            <img
                src={settingsIcon}
            />
            <span className={styles.dropdownLabel}>
                <FormattedMessage
                    defaultMessage="Settings"
                    description="Settings menu"
                    id="gui.menuBar.settings"
                />
            </span>
            <img src={dropdownCaret} />
            <MenuBarMenu
                className={menuBarStyles.menuBarMenu}
                open={settingsMenuOpen}
                place={isRtl ? 'left' : 'right'}
                onRequestClose={onRequestClose}
            >
                <MenuSection>
                    {canChangeLanguage && <LanguageMenu onRequestCloseSettings={onRequestClose} />}
                    {canChangeTheme &&
                        // TODO: Consider always showing the theme menu, even if there is a single available theme
                        availableThemesLength > 1 &&
                        <PreferenceMenu
                            open={isThemeMenuOpen}
                            itemsMap={availableThemesMap}
                            onChange={onChangeTheme}
                            defaultMenuIconSrc={themeIcon}
                            submenuLabel={{
                                defaultMessage: 'Theme',
                                description: 'Theme sub-menu',
                                id: 'gui.menuBar.theme'
                            }}
                            selectedItemKey={activeTheme}
                            isRtl={isRtl}
                            onRequestCloseSettings={onRequestClose}
                            onRequestOpen={onRequestOpenTheme}
                        />}
                    {canChangeColorMode && <PreferenceMenu
                        open={isColorModeMenuOpen}
                        itemsMap={enabledColorModesMap}
                        onChange={onChangeColorMode}
                        submenuLabel={{
                            defaultMessage: 'Color Mode',
                            description: 'Color mode sub-menu',
                            id: 'gui.menuBar.colorMode'
                        }}
                        selectedItemKey={activeColorMode}
                        isRtl={isRtl}
                        onRequestCloseSettings={onRequestClose}
                        onRequestOpen={onRequestOpenColorMode}
                    />}
                    <PreferenceMenu
                        open={isRubyVersionMenuOpen}
                        itemsMap={rubyVersionMap}
                        onChange={handleChangeRubyVersion}
                        defaultMenuIconSrc={rubyIcon}
                        submenuLabel={rubyVersionMessages.rubyMenu}
                        selectedItemKey={activeRubyVersion}
                        isRtl={isRtl}
                        onRequestCloseSettings={onRequestClose}
                        onRequestOpen={onRequestOpenRubyVersion}
                    />
                    {/* === Smalruby: Start of display mode menu === */}
                    {/*
                     * 表示モード切替 (Issue #865)。auto / PC / スマホ を選べる。
                     * テーマ / Ruby バージョンと同じ PreferenceMenu サブメニュー形式。
                     * Chromebook 等で意図せずスマホモードに入ったユーザーが、ここから
                     * いつでも PC モードへ固定できる (localStorage に保存)。
                     */}
                    <PreferenceMenu
                        open={isDisplayModeMenuOpen}
                        itemsMap={displayModeMap}
                        onChange={handleChangeDisplayMode}
                        defaultMenuIconSrc={displayModeIcon}
                        submenuLabel={displayModeMessages.displayModeMenu}
                        selectedItemKey={activeDisplayMode}
                        isRtl={isRtl}
                        onRequestCloseSettings={onRequestClose}
                        onRequestOpen={onRequestOpenDisplayMode}
                    />
                    {/* === Smalruby: End of display mode menu === */}
                    <MenuItem onClick={onOpenBlockDisplayModal}>
                        <div className={styles.option}>
                            <img
                                className={styles.icon}
                                src={blockDisplayIcon}
                            />
                            <FormattedMessage
                                defaultMessage="Block Display..."
                                description="Block display settings menu item"
                                id="gui.menuBar.blockDisplay"
                            />
                        </div>
                    </MenuItem>
                    {/* === Smalruby: Start of classroom management menu === */}
                    {isClassroomConfigured() && (
                        <MenuItem onClick={onOpenTeacherModal}>
                            <div
                                className={styles.option}
                                data-testid="settings-classroom-management"
                            >
                                <img
                                    className={styles.icon}
                                    src={googleClassroomIcon}
                                />
                                <FormattedMessage
                                    defaultMessage="Class Management..."
                                    description="Class management menu item"
                                    id="gui.menuBar.classroomManagement"
                                />
                            </div>
                        </MenuItem>
                    )}
                    {/* === Smalruby: End of classroom management menu === */}
                </MenuSection>
            </MenuBarMenu>
        </div>
    );
};

SettingsMenu.propTypes = {
    vm: PropTypes.shape({
        extensionManager: PropTypes.shape({
            isExtensionLoaded: PropTypes.func
        })
    }),
    canChangeLanguage: PropTypes.bool,
    canChangeColorMode: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    hasActiveMembership: PropTypes.bool,
    isRtl: PropTypes.bool,
    activeColorMode: PropTypes.string,
    onChangeColorMode: PropTypes.func,
    onRequestOpenColorMode: PropTypes.func,
    isColorModeMenuOpen: PropTypes.bool,
    isRubyVersionMenuOpen: PropTypes.bool,
    isDisplayModeMenuOpen: PropTypes.bool,
    onRequestOpenDisplayMode: PropTypes.func,
    onOpenBlockDisplayModal: PropTypes.func,
    onOpenTeacherModal: PropTypes.func,
    activeTheme: PropTypes.string,
    activeRubyVersion: PropTypes.string,
    onChangeTheme: PropTypes.func,
    onChangeRubyVersion: PropTypes.func,
    onRequestOpenTheme: PropTypes.func,
    onRequestOpenRubyVersion: PropTypes.func,
    isThemeMenuOpen: PropTypes.bool,
    onRequestClose: PropTypes.func,
    onRequestOpen: PropTypes.func,
    settingsMenuOpen: PropTypes.bool
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm,
    activeColorMode: state.scratchGui.settings.colorMode,
    activeTheme: state.scratchGui.settings.theme,
    activeRubyVersion: state.scratchGui.settings.rubyVersion,
    isColorModeMenuOpen: colorModeMenuOpen(state),
    isThemeMenuOpen: themeMenuOpen(state),
    isRubyVersionMenuOpen: rubyVersionMenuOpen(state),
    // === Smalruby: Start of display mode menu ===
    isDisplayModeMenuOpen: displayModeMenuOpen(state)
    // === Smalruby: End of display mode menu ===
});

const mapDispatchToProps = (dispatch, ownProps) => ({
    onRequestOpenColorMode: () => {
        dispatch(openColorModeMenu());
    },
    onRequestOpenTheme: () => {
        dispatch(openThemeMenu());
    },
    onRequestOpenRubyVersion: () => {
        dispatch(openRubyVersionMenu());
    },
    // === Smalruby: Start of display mode menu ===
    onRequestOpenDisplayMode: () => {
        dispatch(openDisplayModeMenu());
    },
    // === Smalruby: End of display mode menu ===
    onOpenBlockDisplayModal: () => {
        ownProps.onOpenBlockDisplayModal();
    },
    // === Smalruby: Start of classroom management menu ===
    onOpenTeacherModal: () => {
        dispatch(openTeacherModal());
        ownProps.onRequestClose();
    },
    // === Smalruby: End of classroom management menu ===
    onChangeColorMode: colorMode => {
        dispatch(setColorMode(colorMode));
        ownProps.onRequestClose();
        persistColorMode(colorMode);
    },
    onChangeTheme: theme => {
        dispatch(setTheme(theme));
        ownProps.onRequestClose();
        persistTheme(theme);
    },
    onChangeRubyVersion: rubyVersion => {
        dispatch(setRubyVersion(rubyVersion));
        ownProps.onRequestClose();
        persistRubyVersion(rubyVersion);
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SettingsMenu);
