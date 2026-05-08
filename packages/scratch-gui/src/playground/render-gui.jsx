import React from 'react';
import ReactDomClient from 'react-dom/client';
import {FormattedMessage} from 'react-intl';
import {compose} from 'redux';

import AppStateHOC from '../lib/app-state-hoc.jsx';
import GUI from '../containers/gui.jsx';
import HashParserHOC from '../lib/hash-parser-hoc.jsx';
import log from '../lib/log.js';
import {PLATFORM} from '../lib/platform.js';
// === Smalruby: Start of URL params for Playwright ===
import {getUrlParams} from '../lib/url-params.js';
// === Smalruby: End of URL params for Playwright ===
// === Smalruby: Start of MobileGui dispatcher ===
import ResponsiveGui from '../lib/responsive-gui.jsx';
// === Smalruby: End of MobileGui dispatcher ===
// === Smalruby: Start of storage worker timeout HOC ===
import StorageWorkerTimeoutHOC from '../lib/storage-worker-timeout-hoc.jsx';
// === Smalruby: End of storage worker timeout HOC ===

const onClickLogo = () => {
    window.location = 'https://smalruby.jp';
};

// === Smalruby: Start of about menu ===
const aboutMenuItems = [
    {
        title: (
            <FormattedMessage
                defaultMessage="About Smalruby"
                description="Menu item that opens the Smalruby introduction page (/about.html)"
                id="gui.menuBar.aboutSmalruby"
            />
        ),
        onClick: () => {
            window.open('about.html', '_blank', 'noopener,noreferrer');
        }
    },
    {
        title: (
            <FormattedMessage
                defaultMessage="Show welcome again"
                description="Menu item that re-opens the first-visit welcome modal"
                id="gui.menuBar.showWelcomeAgain"
            />
        ),
        onClick: () => {
            window.dispatchEvent(new Event('smalruby:show-welcome-modal'));
        }
    }
];
// === Smalruby: End of about menu ===

const handleTelemetryModalCancel = () => {
    log('User canceled telemetry modal');
};

const handleTelemetryModalOptIn = () => {
    log('User opted into telemetry');
};

const handleTelemetryModalOptOut = () => {
    log('User opted out of telemetry');
};

/*
 * Render the GUI playground. This is a separate function because importing anything
 * that instantiates the VM causes unsupported browsers to crash
 * {object} appTarget - the DOM element to render to
 */
export default appTarget => {
    GUI.setAppElement(appTarget);

    // note that redux's 'compose' function is just being used as a general utility to make
    // the hierarchy of HOC constructor calls clearer here; it has nothing to do with redux's
    // ability to compose reducers.
    const WrappedGui = compose(
        AppStateHOC,
        HashParserHOC,
        // === Smalruby: Start of storage worker timeout HOC ===
        // VM がセットアップされたら scratch-storage の FetchWorkerTool に
        // 5s タイムアウトを当て、ハング時に FetchTool フォールバックを発動させる。
        // サブディレクトリ deploy + iOS Safari で Worker 内 fetch がハングする
        // 問題への対策 (詳細は storage-worker-timeout.js)。
        StorageWorkerTimeoutHOC,
        // === Smalruby: End of storage worker timeout HOC ===
        // === Smalruby: Start of MobileGui dispatcher ===
        // ResponsiveGui forwards all HOC-injected props and switches between
        // <GUI> and <MobileGui> based on viewport width (useIsNarrowScreen).
        // === Smalruby: End of MobileGui dispatcher ===
    )(ResponsiveGui);

    // TODO a hack for testing the backpack, allow backpack host to be set by url param
    const backpackHostMatches = window.location.href.match(/[?&]backpack_host=([^&]*)&?/);
    const backpackHost = backpackHostMatches ? backpackHostMatches[1] : 'localStorage';

    const scratchDesktopMatches = window.location.href.match(/[?&]isScratchDesktop=([^&]+)/);
    let simulateScratchDesktop;
    if (scratchDesktopMatches) {
        try {
            // parse 'true' into `true`, 'false' into `false`, etc.
            simulateScratchDesktop = JSON.parse(scratchDesktopMatches[1]);
        } catch {
            // it's not JSON so just use the string
            // note that a typo like "falsy" will be treated as true
            simulateScratchDesktop = scratchDesktopMatches[1];
        }
    }

    // === Smalruby: Start of no_beforeunload URL param ===
    if (process.env.NODE_ENV === 'production' && typeof window === 'object' &&
        !getUrlParams().noBeforeUnload) {
        // Warn before navigating away
        window.onbeforeunload = () => true;
    }
    // === Smalruby: End of no_beforeunload URL param ===

    const root = ReactDomClient.createRoot(appTarget);

    root.render(
        // important: this is checking whether `simulateScratchDesktop` is truthy, not just defined!
        simulateScratchDesktop ?
            <WrappedGui
                canEditTitle
                platform={PLATFORM.DESKTOP}
                showTelemetryModal
                canSave={false}
                onTelemetryModalCancel={handleTelemetryModalCancel}
                onTelemetryModalOptIn={handleTelemetryModalOptIn}
                onTelemetryModalOptOut={handleTelemetryModalOptOut}
            /> :
            <WrappedGui
                canEditTitle
                backpackVisible
                showComingSoon={false}
                backpackHost={backpackHost}
                canSave={false}
                onClickLogo={onClickLogo}
                // === Smalruby: Start of about menu ===
                onClickAbout={aboutMenuItems}
                // === Smalruby: End of about menu ===
            />
    );
};
