import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { compose } from 'redux';

import SB3Downloader from '../../containers/sb3-downloader.jsx';
import intlShape from '../../lib/intlShape';
import SBFileUploaderHOC from '../../lib/sb-file-uploader-hoc.jsx';
import sharedMessages from '../../lib/shared-messages';
import { selectLocale } from '../../reducers/locales.js';
import { requestNewProject } from '../../reducers/project-state.js';
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

/**
 * Mobile 用ドロワー (ハンバーガーメニュー本体, issue #572 Phase 2-E)。
 *
 * MobileTopBar の ☰ から開閉し、最低限の File 操作と言語切替を提供する。
 * - 新しいプロジェクト
 * - パソコンから開く (upstream <SBFileUploaderHOC> の機能を再利用)
 * - パソコンに保存する (upstream <SB3Downloader> を render-prop で利用)
 * - 言語切替 (en / ja / ja-Hira の 3 つに固定)
 *
 * クラスルーム / ルビティー / mesh / Google Drive など Smalruby 固有の機能は、
 * モバイルでは画面が狭すぎて操作しにくいため Phase 2-E では搭載しない (要望:
 * 「画面がさますぎて動作しないくらいなら表示しない」)。
 *
 * createPortal で document.body 直下に出すため、`<GUI>` の overflow に
 * クリップされない。SSR 時は document が無いので null を返す。
 * @param {object} props - props
 * @param {boolean} props.open - ドロワーが開いているか
 * @param {Function} props.onClose - ドロワーを閉じるコールバック
 * @param {string} props.currentLocale - 現在の locale コード
 * @param {Function} props.onClickNew - 新しいプロジェクト
 * @param {Function} props.onSelectLocale - 言語切替
 * @param {Function} props.onStartSelectingFileUpload - SBFileUploaderHOC からの注入
 * @param {object} props.intl - react-intl
 * @returns {JSX.Element|null} portal 経由で body 直下にレンダリング
 */
const MobileDrawerComponent = ({
    open,
    onClose,
    currentLocale,
    onClickNew,
    onSelectLocale,
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

    if (typeof document === 'undefined') {
        return null;
    }

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
    onClickNew: PropTypes.func.isRequired,
    onSelectLocale: PropTypes.func.isRequired,
    onStartSelectingFileUpload: PropTypes.func,
    intl: intlShape.isRequired,
};

const mapStateToProps = state => ({
    currentLocale: state.locales.locale,
});

const mapDispatchToProps = dispatch => ({
    onClickNew: () => dispatch(requestNewProject(false)),
    onSelectLocale: locale => dispatch(selectLocale(locale)),
});

const MobileDrawer = compose(
    injectIntl,
    SBFileUploaderHOC,
    connect(mapStateToProps, mapDispatchToProps),
)(MobileDrawerComponent);

export default MobileDrawer;
export { MobileDrawerComponent };
