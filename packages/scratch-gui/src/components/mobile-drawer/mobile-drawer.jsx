import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { compose } from 'redux';

import SB3Downloader from '../../containers/sb3-downloader.jsx';
import TurboMode from '../../containers/turbo-mode.jsx';
import { isClassroomConfigured } from '../../lib/classroom-api';
import GoogleDriveLoaderHOC from '../../containers/google-drive-loader-hoc.jsx';
import GoogleDriveSaverHOC from '../../containers/google-drive-saver-hoc.jsx';
import intlShape from '../../lib/intlShape';
import SBFileUploaderHOC from '../../lib/sb-file-uploader-hoc.jsx';
import {
    messages as rubyVersionMessages,
    rubyVersionMap,
    VERSION_1,
} from '../../lib/settings/ruby-version/index.js';
import { persistRubyVersion } from '../../lib/settings/ruby-version/persistence.js';
import { DISPLAY_MODE_DESKTOP } from '../../lib/settings/display-mode/index.js';
import { persistDisplayMode } from '../../lib/settings/display-mode/persistence.js';
import sharedMessages from '../../lib/shared-messages';
import { isBugReportConfigured } from '../../lib/bug-report-api.js';
import { openBugReportModal } from '../../reducers/bug-report.js';
import { openClassroomModal, openTeacherModal } from '../../reducers/classroom.js';
import { setConnectionModalExtensionId } from '../../reducers/connection-modal.js';
import { selectLocale } from '../../reducers/locales.js';
import { openConnectionModal, openUrlLoaderModal, openWelcomeModal } from '../../reducers/modals.js';
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
    sectionEdit: {
        defaultMessage: 'Edit',
        description: 'Section header for edit operations in mobile drawer',
        id: 'gui.mobile.drawer.section.edit',
    },
    sectionSettings: {
        defaultMessage: 'Settings',
        description: 'Section header for the settings group (language / ruby / class management) in mobile drawer',
        id: 'gui.mobile.drawer.section.settings',
    },
    closeAriaLabel: {
        defaultMessage: 'Close menu',
        description: 'Aria label for the mobile drawer close button',
        id: 'gui.mobile.drawer.close',
    },
    fileNew: {
        defaultMessage: 'New...',
        description: 'Mobile drawer item to create a new project',
        id: 'gui.mobile.drawer.file.new',
    },
    fileOpenFrom: {
        defaultMessage: 'Open from',
        description: 'Mobile drawer parent item that expands to a list of project sources (Google Drive / Device / Scratch)',
        id: 'gui.mobile.drawer.file.openFrom',
    },
    fileOpenFromGoogleDrive: {
        defaultMessage: 'Google Drive',
        description: 'Mobile drawer item to load a project from Google Drive',
        id: 'gui.mobile.drawer.file.openFrom.googleDrive',
    },
    fileOpenFromDevice: {
        defaultMessage: 'Device',
        description: 'Mobile drawer item to load a project from the local device',
        id: 'gui.mobile.drawer.file.openFrom.device',
    },
    fileOpenFromScratch: {
        defaultMessage: 'Scratch',
        description: 'Mobile drawer item to load a project from Scratch by URL / project id',
        id: 'gui.mobile.drawer.file.openFrom.scratch',
    },
    fileSave: {
        defaultMessage: 'Save',
        description: 'Mobile drawer item to save the current project (context-sensitive: Google Drive or device)',
        id: 'gui.mobile.drawer.file.save',
    },
    fileSaveAs: {
        defaultMessage: 'Save As...',
        description: 'Mobile drawer item to save the current project under a new name (context-sensitive)',
        id: 'gui.mobile.drawer.file.saveAs',
    },
    editTurboMode: {
        defaultMessage: 'Turbo Mode',
        description: 'Mobile drawer toggle for turbo mode',
        id: 'gui.mobile.drawer.edit.turboMode',
    },
    classroom: {
        defaultMessage: 'Class',
        description: 'Mobile drawer item that opens the student-facing classroom modal (join / status)',
        id: 'gui.mobile.drawer.classroom',
    },
    mesh: {
        defaultMessage: 'Mesh',
        description: 'Mobile drawer item that opens the Mesh v2 connection modal (only when meshV2 extension is loaded)',
        id: 'gui.mobile.drawer.mesh',
    },
    settingsLanguage: {
        defaultMessage: 'Language',
        description: 'Settings sub-menu header for language switcher in mobile drawer',
        id: 'gui.mobile.drawer.settings.language',
    },
    settingsRuby: {
        defaultMessage: 'Ruby',
        description: 'Settings sub-menu header for Ruby version switcher in mobile drawer',
        id: 'gui.mobile.drawer.settings.ruby',
    },
    settingsClassManagement: {
        defaultMessage: 'Class Management...',
        description: 'Settings sub-menu item that opens teacher-facing class management modal',
        id: 'gui.menuBar.classroomManagement',
    },
    rubyV1: {
        defaultMessage: 'Version 1',
        description: 'Mobile drawer label for Ruby version 1',
        id: 'gui.mobile.drawer.settings.ruby.v1',
    },
    rubyV2: {
        defaultMessage: 'Version 2',
        description: 'Mobile drawer label for Ruby version 2',
        id: 'gui.mobile.drawer.settings.ruby.v2',
    },
    sectionHelp: {
        defaultMessage: 'Help',
        description: 'Section header for help / about Smalruby in mobile drawer',
        id: 'gui.mobile.drawer.section.help',
    },
    helpAbout: {
        defaultMessage: 'About Smalruby',
        description: 'Mobile drawer item that opens the Smalruby about page in a new tab',
        id: 'gui.menuBar.aboutSmalruby',
    },
    helpShowWelcome: {
        defaultMessage: 'Show welcome again',
        description: 'Mobile drawer item that re-opens the first-visit welcome modal',
        id: 'gui.mobile.drawer.help.showWelcome',
    },
    helpReportBug: {
        defaultMessage: 'Report a bug',
        description: 'Mobile drawer item that opens the program bug report modal',
        id: 'gui.smalruby3.gui.bugReport',
    },
    switchToDesktop: {
        defaultMessage: 'Switch to PC mode',
        description:
            'Mobile drawer item that switches from the smartphone layout to the PC (desktop) layout and remembers it',
        id: 'gui.mobile.drawer.switchToDesktop',
    },
});

/**
 * Smalruby のモバイルで表示する 3 言語のみ。upstream の LanguageMenu は
 * scratch-l10n の 50+ ロケールをすべて出すが、Smalruby が翻訳を持つのは
 * en / ja / ja-Hira のみ。
 */
const SUPPORTED_LOCALES = [
    { code: 'ja', label: '日本語' },
    { code: 'ja-Hira', label: 'にほんご' },
    { code: 'en', label: 'English' },
];

const RUBY_VERSION_LABELS = { 1: messages.rubyV1, 2: messages.rubyV2 };
const RUBY_VERSIONS = Object.keys(rubyVersionMap);

/**
 * 開閉できるサブメニュー (accordion) のキー。
 */
const SUBMENU_FILE_OPEN = 'file-open';
const SUBMENU_SETTINGS = 'settings';
const SUBMENU_SETTINGS_LANGUAGE = 'settings-language';
const SUBMENU_SETTINGS_RUBY = 'settings-ruby';
const SUBMENU_HELP = 'help';

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
 * Mobile 用ドロワー (ハンバーガーメニュー本体)。
 *
 * MobileSideRail の ☰ から開閉する。Desktop メニューバーと同等の主要機能を
 * 折りたたみ可能なツリー形式で提供する:
 *
 *   ファイル
 *     ├ 新規作成...
 *     ├ 次から開く ▾ (Googleドライブ / デバイス / Scratch)
 *     ├ 保存                         (context-sensitive: Drive or device)
 *     └ 名前をつけて保存...           (context-sensitive)
 *   編集
 *     └ ターボモード (toggle)
 *   チュートリアル
 *   クラス                           (classroom configured 時)
 *   メッシュ                         (meshV2 extension loaded 時)
 *   設定 ▾
 *     ├ 言語 ▾ (日本語 / にほんご / English)
 *     ├ ルビー ▾ (バージョン1 / バージョン2)
 *     └ クラス管理...                (classroom configured 時)
 *
 * createPortal で document.body 直下に出すため、`<GUI>` の overflow に
 * クリップされない。SSR 時は document が無いので null を返す。
 * @param {object} props - props
 * @param {boolean} props.open - ドロワーが開いているか
 * @param {Function} props.onClose - ドロワーを閉じる
 * @param {string} [props.currentLocale] - 現在の locale (Redux)
 * @param {string} [props.activeRubyVersion] - 現在の Ruby version (Redux)
 * @param {boolean} [props.isGoogleDriveFile] - Drive 経由ロード中か (Redux)
 * @param {object} [props.vm] - scratch-vm (Redux)
 * @param {Function} props.onClickNew - 新しいプロジェクト
 * @param {Function} props.onSelectLocale - 言語切替
 * @param {Function} props.onChangeRubyVersion - Ruby version 切替
 * @param {Function} props.onOpenClassroomModal - 生徒向けクラスモーダル
 * @param {Function} props.onOpenTeacherModal - 教師向けクラス管理モーダル
 * @param {Function} props.onOpenMeshModal - メッシュ接続モーダル
 * @param {Function} props.onStartSelectingFileUpload - SBFileUploaderHOC 注入
 * @param {Function} props.onStartSelectingGoogleDrive - GoogleDriveLoaderHOC 注入
 * @param {Function} props.onSaveDirectlyToGoogleDrive - GoogleDriveSaverHOC 注入
 * @param {Function} props.onStartSavingToGoogleDrive - GoogleDriveSaverHOC 注入
 * @param {Function} props.onStartSelectingUrlLoad - Scratch URL ローダーモーダル
 * @param {Function} props.onOpenWelcomeModal - ウェルカムモーダルを開く (#658)
 * @param {Function} props.onReportBug - プログラム不具合報告モーダルを開く (#731)
 * @param {object} props.intl - react-intl
 * @returns {JSX.Element|null} portal 経由で body 直下にレンダリング
 */
const MobileDrawerComponent = ({
    open,
    onClose,
    currentLocale,
    activeRubyVersion,
    isGoogleDriveFile,
    vm,
    onClickNew,
    onSelectLocale,
    onChangeRubyVersion,
    onOpenClassroomModal,
    onOpenTeacherModal,
    onOpenMeshModal,
    onStartSelectingFileUpload,
    onStartSelectingGoogleDrive,
    onSaveDirectlyToGoogleDrive,
    onStartSavingToGoogleDrive,
    onStartSelectingUrlLoad,
    onOpenWelcomeModal,
    onReportBug,
    intl,
}) => {
    const [expandedSet, setExpandedSet] = useState(() => new Set());
    const isExpanded = key => expandedSet.has(key);
    const toggleExpanded = useCallback(
        key =>
            setExpandedSet(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            }),
        [],
    );
    const handleToggleSubmenu = useCallback(
        event => {
            const key = event.currentTarget.dataset.submenu;
            if (key) toggleExpanded(key);
        },
        [toggleExpanded],
    );

    const handleClickNew = useCallback(() => {
        onClickNew();
        onClose();
    }, [onClickNew, onClose]);

    const handleClickLoadFromDevice = useCallback(() => {
        onStartSelectingFileUpload();
        onClose();
    }, [onStartSelectingFileUpload, onClose]);

    const handleClickLoadFromGoogleDrive = useCallback(() => {
        onStartSelectingGoogleDrive();
        onClose();
    }, [onStartSelectingGoogleDrive, onClose]);

    const handleClickLoadFromScratch = useCallback(() => {
        onStartSelectingUrlLoad();
        onClose();
    }, [onStartSelectingUrlLoad, onClose]);

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

    const handleClickClassroom = useCallback(() => {
        onOpenClassroomModal();
        onClose();
    }, [onOpenClassroomModal, onClose]);

    const handleClickMesh = useCallback(() => {
        onOpenMeshModal('meshV2');
        onClose();
    }, [onOpenMeshModal, onClose]);

    const handleClickClassroomManagement = useCallback(() => {
        onOpenTeacherModal();
        onClose();
    }, [onOpenTeacherModal, onClose]);

    const handleClickAbout = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.open('about.html', '_blank', 'noopener,noreferrer');
        }
        onClose();
    }, [onClose]);

    const handleClickShowWelcome = useCallback(() => {
        onOpenWelcomeModal();
        onClose();
    }, [onOpenWelcomeModal, onClose]);

    const handleClickReportBug = useCallback(() => {
        onReportBug();
        onClose();
    }, [onReportBug, onClose]);

    // PC モードへ切り替える (Issue #865)。localStorage に desktop 固定を保存し、
    // ResponsiveGui がイベントを受けて desktop GUI に切り替える。このマシンでは
    // 以後ずっと PC モード (設定メニューからいつでも変更可能)。
    const handleClickSwitchToDesktop = useCallback(() => {
        persistDisplayMode(DISPLAY_MODE_DESKTOP);
        onClose();
    }, [onClose]);

    if (typeof document === 'undefined') {
        return null;
    }

    const classroomEnabled = isClassroomConfigured();
    // メッシュ extension の有効化チェック。Redux state の変化 (drawer 開閉や
    // 接続状態変化) によって drawer が再レンダリングされるたびに評価される。
    const meshLoaded = Boolean(vm?.extensionManager?.isExtensionLoaded?.('meshV2'));

    /*
     * ナビゲーションボタンの共通スタイル + 折りたたみ chevron の表示。
     * `level` は indent 用 (0=トップ、1=サブ、2=サブサブ)。
     */
    const renderToggle = (label, key, level = 0) => (
        <button
            type="button"
            className={classNames(styles.menuItem, styles.toggleItem, {
                [styles.indented]: level > 0,
                [styles.indented2]: level > 1,
            })}
            onClick={handleToggleSubmenu}
            data-submenu={key}
            data-expanded={isExpanded(key) ? 'true' : 'false'}
            data-testid={`mobile-drawer-toggle-${key}`}
            aria-expanded={isExpanded(key)}
        >
            <span className={styles.toggleLabel}>{label}</span>
            <span className={styles.toggleChevron} aria-hidden="true">
                {isExpanded(key) ? '▾' : '▸'}
            </span>
        </button>
    );

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
                    {/* ===== ファイル ===== */}
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
                            <FormattedMessage {...messages.fileNew} />
                        </button>
                    </li>
                    <li>
                        {renderToggle(<FormattedMessage {...messages.fileOpenFrom} />, SUBMENU_FILE_OPEN)}
                    </li>
                    {isExpanded(SUBMENU_FILE_OPEN) && (
                        <>
                            <li>
                                <button
                                    type="button"
                                    className={classNames(styles.menuItem, styles.indented)}
                                    onClick={handleClickLoadFromGoogleDrive}
                                    data-testid="mobile-drawer-open-google-drive"
                                >
                                    <FormattedMessage {...messages.fileOpenFromGoogleDrive} />
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className={classNames(styles.menuItem, styles.indented)}
                                    onClick={handleClickLoadFromDevice}
                                    data-testid="mobile-drawer-open-device"
                                >
                                    <FormattedMessage {...messages.fileOpenFromDevice} />
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className={classNames(styles.menuItem, styles.indented)}
                                    onClick={handleClickLoadFromScratch}
                                    data-testid="mobile-drawer-open-scratch"
                                >
                                    <FormattedMessage {...messages.fileOpenFromScratch} />
                                </button>
                            </li>
                        </>
                    )}
                    {/*
                     * 保存: Google Drive 経由で読み込んでいる場合は Drive に直接保存、
                     * そうでなければ PC ローカル保存。SB3Downloader の callback を
                     * 介する必要があるので render-prop でラップする。
                     */}
                    <li>
                        <SB3Downloader>
                            {(_className, downloadProjectCallback) => (
                                <button
                                    type="button"
                                    className={styles.menuItem}
                                    // eslint-disable-next-line react/jsx-no-bind
                                    onClick={() => {
                                        if (isGoogleDriveFile) {
                                            onSaveDirectlyToGoogleDrive(true);
                                        } else {
                                            downloadProjectCallback();
                                        }
                                        onClose();
                                    }}
                                    data-testid="mobile-drawer-save"
                                >
                                    <FormattedMessage {...messages.fileSave} />
                                </button>
                            )}
                        </SB3Downloader>
                    </li>
                    {/*
                     * 名前をつけて保存: Drive 経由なら「コピーを Drive に保存」、
                     * そうでなければ PC ローカルに保存 (= Save と同じだが Save As の
                     * 体験として分けるために別エントリーにしておく)。
                     */}
                    <li>
                        <SB3Downloader>
                            {(_className, downloadProjectCallback) => (
                                <button
                                    type="button"
                                    className={styles.menuItem}
                                    // eslint-disable-next-line react/jsx-no-bind
                                    onClick={() => {
                                        if (isGoogleDriveFile) {
                                            onStartSavingToGoogleDrive();
                                        } else {
                                            downloadProjectCallback();
                                        }
                                        onClose();
                                    }}
                                    data-testid="mobile-drawer-save-as"
                                >
                                    <FormattedMessage {...messages.fileSaveAs} />
                                </button>
                            )}
                        </SB3Downloader>
                    </li>

                    {/* ===== 編集 ===== */}
                    <li className={styles.sectionTitle}>
                        <FormattedMessage {...messages.sectionEdit} />
                    </li>
                    <li>
                        <TurboMode>
                            {(toggleTurboMode, { turboMode }) => (
                                <button
                                    type="button"
                                    className={classNames(styles.menuItem, {
                                        [styles.toggleOn]: turboMode,
                                    })}
                                    // eslint-disable-next-line react/jsx-no-bind
                                    onClick={() => {
                                        toggleTurboMode();
                                        // ターボモードはトグルなのでドロワーは閉じない
                                        // (連続切替を許容)。upstream も同じ挙動。
                                    }}
                                    data-testid="mobile-drawer-turbo-mode"
                                    data-turbo-mode={turboMode ? 'on' : 'off'}
                                    aria-pressed={turboMode}
                                >
                                    <span className={styles.localeCheck} aria-hidden="true">
                                        {turboMode ? '✓' : ''}
                                    </span>
                                    <FormattedMessage {...messages.editTurboMode} />
                                </button>
                            )}
                        </TurboMode>
                    </li>

                    {/* ===== 表示モード (PC モードへ切り替え, Issue #865) ===== */}
                    {/*
                     * Chromebook 等で意図せずスマホモードに入ってしまったユーザーが
                     * PC モードへ抜け出すための単独項目。切り替えると localStorage に
                     * 保存され、そのマシンでは以後ずっと PC モードになる (設定メニュー
                     * からいつでも戻せる)。
                     */}
                    <li>
                        <button
                            type="button"
                            className={classNames(styles.menuItem, styles.switchToDesktop)}
                            onClick={handleClickSwitchToDesktop}
                            data-testid="mobile-drawer-switch-to-desktop"
                        >
                            <FormattedMessage {...messages.switchToDesktop} />
                        </button>
                    </li>

                    {/* ===== クラス / メッシュ (単独項目) ===== */}
                    {/*
                     * これらは「セクション」ではなく単独のトップレベル項目なので、
                     * sectionTitle は付けず menuItem だけ並べる。
                     *
                     * チュートリアル (Tips Library) は SP 非対応:
                     * cards.jsx が固定幅・複数列・画像中心で SP レイアウトに合わない。
                     */}
                    {classroomEnabled && (
                        <li>
                            <button
                                type="button"
                                className={styles.menuItem}
                                onClick={handleClickClassroom}
                                data-testid="mobile-drawer-classroom"
                            >
                                <FormattedMessage {...messages.classroom} />
                            </button>
                        </li>
                    )}
                    {meshLoaded && (
                        <li>
                            <button
                                type="button"
                                className={styles.menuItem}
                                onClick={handleClickMesh}
                                data-testid="mobile-drawer-mesh"
                            >
                                <FormattedMessage {...messages.mesh} />
                            </button>
                        </li>
                    )}

                    {/* ===== 設定 (accordion トグル単独 — sectionTitle を兼ねる) ===== */}
                    <li>{renderToggle(<FormattedMessage {...messages.sectionSettings} />, SUBMENU_SETTINGS)}</li>
                    {isExpanded(SUBMENU_SETTINGS) && (
                        <>
                            {/* 言語 */}
                            <li>
                                {renderToggle(
                                    <FormattedMessage {...messages.settingsLanguage} />,
                                    SUBMENU_SETTINGS_LANGUAGE,
                                    1,
                                )}
                            </li>
                            {isExpanded(SUBMENU_SETTINGS_LANGUAGE) &&
                                SUPPORTED_LOCALES.map(({ code, label }) => (
                                    <li key={`locale-${code}`}>
                                        <button
                                            type="button"
                                            className={classNames(styles.localeItem, styles.indented2, {
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
                            {/* ルビー */}
                            <li>
                                {renderToggle(
                                    <FormattedMessage {...messages.settingsRuby} />,
                                    SUBMENU_SETTINGS_RUBY,
                                    1,
                                )}
                            </li>
                            {isExpanded(SUBMENU_SETTINGS_RUBY) &&
                                RUBY_VERSIONS.map(version => (
                                    <li key={`ruby-${version}`}>
                                        <button
                                            type="button"
                                            className={classNames(styles.localeItem, styles.indented2, {
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
                                            <FormattedMessage {...RUBY_VERSION_LABELS[version]} />
                                        </button>
                                    </li>
                                ))}
                            {/* クラス管理 */}
                            {classroomEnabled && (
                                <li>
                                    <button
                                        type="button"
                                        className={classNames(styles.menuItem, styles.indented)}
                                        onClick={handleClickClassroomManagement}
                                        data-testid="mobile-drawer-classroom-management"
                                    >
                                        <FormattedMessage {...messages.settingsClassManagement} />
                                    </button>
                                </li>
                            )}
                        </>
                    )}

                    {/* ===== ヘルプ (accordion トグル) ===== */}
                    <li>{renderToggle(<FormattedMessage {...messages.sectionHelp} />, SUBMENU_HELP)}</li>
                    {isExpanded(SUBMENU_HELP) && (
                        <>
                            <li>
                                <button
                                    type="button"
                                    className={classNames(styles.menuItem, styles.indented)}
                                    onClick={handleClickAbout}
                                    data-testid="mobile-drawer-help-about"
                                >
                                    <FormattedMessage {...messages.helpAbout} />
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className={classNames(styles.menuItem, styles.indented)}
                                    onClick={handleClickShowWelcome}
                                    data-testid="mobile-drawer-help-show-welcome"
                                >
                                    <FormattedMessage {...messages.helpShowWelcome} />
                                </button>
                            </li>
                            {isBugReportConfigured() && (
                                <li>
                                    <button
                                        type="button"
                                        className={classNames(styles.menuItem, styles.indented)}
                                        onClick={handleClickReportBug}
                                        data-testid="mobile-drawer-help-report-bug"
                                    >
                                        <FormattedMessage {...messages.helpReportBug} />
                                    </button>
                                </li>
                            )}
                        </>
                    )}
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
    isGoogleDriveFile: PropTypes.bool,
    vm: PropTypes.object,
    onClickNew: PropTypes.func.isRequired,
    onSelectLocale: PropTypes.func.isRequired,
    onChangeRubyVersion: PropTypes.func.isRequired,
    onOpenClassroomModal: PropTypes.func.isRequired,
    onOpenTeacherModal: PropTypes.func.isRequired,
    onOpenMeshModal: PropTypes.func.isRequired,
    onStartSelectingFileUpload: PropTypes.func.isRequired,
    onStartSelectingGoogleDrive: PropTypes.func.isRequired,
    onSaveDirectlyToGoogleDrive: PropTypes.func.isRequired,
    onStartSavingToGoogleDrive: PropTypes.func.isRequired,
    onStartSelectingUrlLoad: PropTypes.func.isRequired,
    onOpenWelcomeModal: PropTypes.func.isRequired,
    onReportBug: PropTypes.func.isRequired,
    intl: intlShape.isRequired,
};

const mapStateToProps = state => ({
    currentLocale: state.locales.locale,
    activeRubyVersion: state.scratchGui.settings.rubyVersion,
    isGoogleDriveFile: Boolean(state.scratchGui.googleDriveFile?.id),
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = dispatch => ({
    onClickNew: () => dispatch(requestNewProject(false)),
    onSelectLocale: locale => dispatch(selectLocale(locale)),
    onChangeRubyVersion: rubyVersion => {
        dispatch(setRubyVersion(rubyVersion));
        persistRubyVersion(rubyVersion);
    },
    onOpenClassroomModal: () => dispatch(openClassroomModal()),
    onOpenTeacherModal: () => dispatch(openTeacherModal()),
    onOpenMeshModal: extensionId => {
        dispatch(setConnectionModalExtensionId(extensionId));
        dispatch(openConnectionModal());
    },
    onStartSelectingUrlLoad: () => dispatch(openUrlLoaderModal()),
    onOpenWelcomeModal: () => dispatch(openWelcomeModal()),
    onReportBug: () => dispatch(openBugReportModal()),
});

const MobileDrawer = compose(
    injectIntl,
    SBFileUploaderHOC,
    GoogleDriveLoaderHOC,
    GoogleDriveSaverHOC,
    connect(mapStateToProps, mapDispatchToProps),
)(MobileDrawerComponent);

export default MobileDrawer;
export { MobileDrawerComponent };
