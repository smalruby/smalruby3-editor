import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { compose } from 'redux';

import SB3Downloader from '../../containers/sb3-downloader.jsx';
import { isClassroomConfigured } from '../../lib/classroom-api';
import intlShape from '../../lib/intlShape';
import SBFileUploaderHOC from '../../lib/sb-file-uploader-hoc.jsx';
import {
    messages as rubyVersionMessages,
    rubyVersionMap,
    VERSION_1,
} from '../../lib/settings/ruby-version/index.js';
import { persistRubyVersion } from '../../lib/settings/ruby-version/persistence.js';
import sharedMessages from '../../lib/shared-messages';
import { openBlockDisplayModal } from '../../reducers/block-display.js';
import { openTeacherModal } from '../../reducers/classroom.js';
import { selectLocale } from '../../reducers/locales.js';
import { requestNewProject } from '../../reducers/project-state.js';
import { setRubyVersion } from '../../reducers/settings.js';
import closeIcon from './icon--close.svg';
import styles from './mobile-drawer.css';

const messages = defineMessages({
    drawerTitle: {
        defaultMessage: 'Menu',
        description: 'Title of the mobile drawer (hamburger menu)',
        id: 'gui.mobile.drawer.title',
    },
    sectionFile: {
        defaultMessage: 'File',
        description: 'Section header for file operations in mobile drawer',
        id: 'gui.mobile.drawer.section.file',
    },
    sectionTools: {
        defaultMessage: 'Tools',
        description: 'Section header for Smalruby-specific tools (block display, classroom) in mobile drawer',
        id: 'gui.mobile.drawer.section.tools',
    },
    sectionRubyVersion: {
        defaultMessage: 'Ruby Version',
        description: 'Section header for Ruby version selector in mobile drawer',
        id: 'gui.mobile.drawer.section.rubyVersion',
    },
    sectionLanguage: {
        defaultMessage: 'Language',
        description: 'Section header for language switcher in mobile drawer',
        id: 'gui.mobile.drawer.section.language',
    },
    closeAriaLabel: {
        defaultMessage: 'Close menu',
        description: 'Aria label for the mobile drawer close button',
        id: 'gui.mobile.drawer.close',
    },
    reload: {
        defaultMessage: 'Reload',
        description: 'Mobile drawer item to force a page reload',
        id: 'gui.mobile.drawer.reload',
    },
});

/**
 * Smalruby のモバイルで表示する 3 言語のみ。upstream の LanguageMenu は
 * scratch-l10n の 50+ ロケールをすべて出すが、Smalruby が翻訳を持つのは
 * en / ja / ja-Hira のみで、モバイル UI ではリストが長すぎても扱いに困るため
 * 短いリストに固定する。
 */
const SUPPORTED_LOCALES = [
    { code: 'ja', label: '日本語' },
    { code: 'ja-Hira', label: 'にほんご' },
    { code: 'en', label: 'English' },
];

const RUBY_VERSIONS = Object.keys(rubyVersionMap);

/**
 * v1 への切替で v2 専用機能 (module / class) が使われていないかチェックする
 * (settings-menu.jsx の handleChangeRubyVersion と同じロジック)。
 * @param {object} vm - scratch-vm インスタンス
 * @returns {boolean} v2 機能が使われていれば true
 */
const hasV2Features = vm => {
    if (!vm?.runtime?.targets) return false;
    return vm.runtime.targets.some(target => {
        if (!target.comments) return false;
        return Object.values(target.comments).some(
            comment =>
                comment.text &&
                (comment.text.startsWith('@ruby:module_source:') ||
                    comment.text === '@ruby:class' ||
                    comment.text.startsWith('@ruby:class:')),
        );
    });
};

/**
 * Mobile 用ドロワー (ハンバーガーメニュー本体, issue #572 Phase 2-E + Phase 3-A)。
 *
 * MobileSideRail の ☰ から開閉する。提供する機能:
 * - File: 新規 / パソコンから開く / パソコンに保存 / リロード
 * - Tools (Smalruby 固有): ブロック表示モーダル / クラスルーム管理 (configured 時のみ)
 * - Ruby Version: v1 / v2 切替
 * - Language: en / ja / ja-Hira
 *
 * createPortal で document.body 直下に出すため、`<GUI>` の overflow に
 * クリップされない。SSR 時は document が無いので null を返す。
 * @param {object} props - props
 * @param {boolean} props.open - ドロワーが開いているか
 * @param {Function} props.onClose - ドロワーを閉じるコールバック
 * @param {string} props.currentLocale - 現在の locale コード
 * @param {string} props.activeRubyVersion - 現在の Ruby version
 * @param {object} props.vm - scratch-vm (Ruby version 切替時の v2 機能チェック用)
 * @param {Function} props.onClickNew - 新しいプロジェクト
 * @param {Function} props.onSelectLocale - 言語切替
 * @param {Function} props.onChangeRubyVersion - Ruby version 切替
 * @param {Function} props.onOpenBlockDisplayModal - ブロック表示モーダル
 * @param {Function} props.onOpenTeacherModal - クラスルーム管理モーダル
 * @param {Function} props.onStartSelectingFileUpload - SBFileUploaderHOC からの注入
 * @param {object} props.intl - react-intl
 * @returns {JSX.Element|null} portal 経由で body 直下にレンダリング
 */
const MobileDrawerComponent = ({
    open,
    onClose,
    currentLocale,
    activeRubyVersion,
    vm,
    onClickNew,
    onSelectLocale,
    onChangeRubyVersion,
    onOpenBlockDisplayModal,
    onOpenTeacherModal,
    onStartSelectingFileUpload,
    intl,
}) => {
    const handleClickNew = useCallback(() => {
        onClickNew();
        onClose();
    }, [onClickNew, onClose]);

    const handleClickLoad = useCallback(() => {
        onStartSelectingFileUpload();
        onClose();
    }, [onStartSelectingFileUpload, onClose]);

    const handleClickLocale = useCallback(
        event => {
            const code = event.currentTarget.dataset.localeCode;
            if (code) {
                onSelectLocale(code);
                onClose();
            }
        },
        [onSelectLocale, onClose],
    );

    const handleClickRubyVersion = useCallback(
        event => {
            const version = event.currentTarget.dataset.rubyVersion;
            if (!version || version === activeRubyVersion) {
                onClose();
                return;
            }
            // v1 へ切替時は v2 機能が使われていないか確認する。
            // koshien 拡張のチェックは settings-menu 側でやっているので、
            // モバイルでもそちらのフローを尊重したいが、現状 vm.extensionManager の
            // 直接アクセスができるためここでも同じ guard を入れる。
            if (version === '2' && vm?.extensionManager?.isExtensionLoaded?.('koshien')) {
                // eslint-disable-next-line no-alert
                alert(intl.formatMessage(rubyVersionMessages.koshienCannotChangeRubyVersion));
                return;
            }
            if (version === VERSION_1 && hasV2Features(vm)) {
                // eslint-disable-next-line no-alert
                alert(intl.formatMessage(rubyVersionMessages.cannotSwitchToV1));
                return;
            }
            onChangeRubyVersion(version);
            onClose();
        },
        [activeRubyVersion, vm, onChangeRubyVersion, onClose, intl],
    );

    const handleClickBlockDisplay = useCallback(() => {
        onOpenBlockDisplayModal();
        onClose();
    }, [onOpenBlockDisplayModal, onClose]);

    const handleClickClassroom = useCallback(() => {
        onOpenTeacherModal();
        onClose();
    }, [onOpenTeacherModal, onClose]);

    const handleClickReload = useCallback(() => {
        if (typeof window !== 'undefined' && window.location) {
            window.location.reload();
        }
        onClose();
    }, [onClose]);

    if (typeof document === 'undefined') {
        return null;
    }

    const classroomEnabled = isClassroomConfigured();

    return createPortal(
        <>
            <div
                className={classNames(styles.backdrop, { [styles.open]: open })}
                onClick={onClose}
                data-testid="mobile-drawer-backdrop"
                data-state={open ? 'open' : 'closed'}
                aria-hidden="true"
            />
            <aside
                className={classNames(styles.drawer, { [styles.open]: open })}
                role="dialog"
                aria-modal="true"
                aria-label={intl.formatMessage(messages.drawerTitle)}
                data-testid="mobile-drawer"
                data-state={open ? 'open' : 'closed'}
            >
                <header className={styles.header}>
                    <span className={styles.headerTitle}>
                        <FormattedMessage {...messages.drawerTitle} />
                    </span>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label={intl.formatMessage(messages.closeAriaLabel)}
                        data-testid="mobile-drawer-close"
                    >
                        <img className={styles.closeIcon} src={closeIcon} alt="" aria-hidden="true" />
                    </button>
                </header>
                <ul className={styles.menuList}>
                    <li className={styles.sectionTitle}>
                        <FormattedMessage {...messages.sectionFile} />
                    </li>
                    <li>
                        <button
                            type="button"
                            className={styles.menuItem}
                            onClick={handleClickNew}
                            data-testid="mobile-drawer-new"
                        >
                            <FormattedMessage
                                defaultMessage="New"
                                description="Menu bar item for creating a new project"
                                id="gui.menuBar.new"
                            />
                        </button>
                    </li>
                    <li>
                        <button
                            type="button"
                            className={styles.menuItem}
                            onClick={handleClickLoad}
                            data-testid="mobile-drawer-load"
                        >
                            <FormattedMessage {...sharedMessages.loadFromComputerTitle} />
                        </button>
                    </li>
                    <li>
                        <SB3Downloader>
                            {(_className, downloadProjectCallback) => (
                                <button
                                    type="button"
                                    className={styles.menuItem}
                                    // eslint-disable-next-line react/jsx-no-bind
                                    onClick={() => {
                                        downloadProjectCallback();
                                        onClose();
                                    }}
                                    data-testid="mobile-drawer-save"
                                >
                                    <FormattedMessage
                                        defaultMessage="Save to your computer"
                                        description="Menu bar item for downloading a project to your computer"
                                        id="gui.menuBar.downloadToComputer"
                                    />
                                </button>
                            )}
                        </SB3Downloader>
                    </li>
                    <li>
                        {/*
                         * 「下にひっぱってリロード」を mobile-mode で無効化したので、
                         * 代わりにここから手動でページをリロードできるようにする。
                         */}
                        <button
                            type="button"
                            className={styles.menuItem}
                            onClick={handleClickReload}
                            data-testid="mobile-drawer-reload"
                        >
                            <FormattedMessage {...messages.reload} />
                        </button>
                    </li>
                    <li className={styles.sectionTitle}>
                        <FormattedMessage {...messages.sectionTools} />
                    </li>
                    <li>
                        <button
                            type="button"
                            className={styles.menuItem}
                            onClick={handleClickBlockDisplay}
                            data-testid="mobile-drawer-block-display"
                        >
                            <FormattedMessage
                                defaultMessage="Block Display..."
                                description="Block display settings menu item"
                                id="gui.menuBar.blockDisplay"
                            />
                        </button>
                    </li>
                    {classroomEnabled && (
                        <li>
                            <button
                                type="button"
                                className={styles.menuItem}
                                onClick={handleClickClassroom}
                                data-testid="mobile-drawer-classroom"
                            >
                                <FormattedMessage
                                    defaultMessage="Class Management..."
                                    description="Class management menu item"
                                    id="gui.menuBar.classroomManagement"
                                />
                            </button>
                        </li>
                    )}
                    <li className={styles.sectionTitle}>
                        <FormattedMessage {...messages.sectionRubyVersion} />
                    </li>
                    {RUBY_VERSIONS.map(version => (
                        <li key={version}>
                            <button
                                type="button"
                                className={classNames(styles.localeItem, {
                                    [styles.selected]: activeRubyVersion === version,
                                })}
                                onClick={handleClickRubyVersion}
                                data-ruby-version={version}
                                data-selected={activeRubyVersion === version ? 'true' : 'false'}
                                data-testid={`mobile-drawer-ruby-version-${version}`}
                            >
                                <span className={styles.localeCheck} aria-hidden="true">
                                    {activeRubyVersion === version ? '✓' : ''}
                                </span>
                                <FormattedMessage {...rubyVersionMap[version].label} />
                            </button>
                        </li>
                    ))}
                    <li className={styles.sectionTitle}>
                        <FormattedMessage {...messages.sectionLanguage} />
                    </li>
                    {SUPPORTED_LOCALES.map(({ code, label }) => (
                        <li key={code}>
                            <button
                                type="button"
                                className={classNames(styles.localeItem, {
                                    [styles.selected]: currentLocale === code,
                                })}
                                onClick={handleClickLocale}
                                data-locale-code={code}
                                data-selected={currentLocale === code ? 'true' : 'false'}
                                data-testid={`mobile-drawer-locale-${code}`}
                            >
                                <span className={styles.localeCheck} aria-hidden="true">
                                    {currentLocale === code ? '✓' : ''}
                                </span>
                                {label}
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>
        </>,
        document.body,
    );
};

MobileDrawerComponent.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    currentLocale: PropTypes.string,
    activeRubyVersion: PropTypes.string,
    vm: PropTypes.object,
    onClickNew: PropTypes.func.isRequired,
    onSelectLocale: PropTypes.func.isRequired,
    onChangeRubyVersion: PropTypes.func.isRequired,
    onOpenBlockDisplayModal: PropTypes.func.isRequired,
    onOpenTeacherModal: PropTypes.func.isRequired,
    onStartSelectingFileUpload: PropTypes.func,
    intl: intlShape.isRequired,
};

const mapStateToProps = state => ({
    currentLocale: state.locales.locale,
    activeRubyVersion: state.scratchGui.settings.rubyVersion,
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = dispatch => ({
    onClickNew: () => dispatch(requestNewProject(false)),
    onSelectLocale: locale => dispatch(selectLocale(locale)),
    onChangeRubyVersion: rubyVersion => {
        dispatch(setRubyVersion(rubyVersion));
        persistRubyVersion(rubyVersion);
    },
    onOpenBlockDisplayModal: () => dispatch(openBlockDisplayModal()),
    onOpenTeacherModal: () => dispatch(openTeacherModal()),
});

const MobileDrawer = compose(
    injectIntl,
    SBFileUploaderHOC,
    connect(mapStateToProps, mapDispatchToProps),
)(MobileDrawerComponent);

export default MobileDrawer;
export { MobileDrawerComponent };
