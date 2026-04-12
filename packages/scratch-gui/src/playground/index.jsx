// Polyfills
import 'es6-object-assign/auto';
import 'core-js/fn/array/includes';
import 'core-js/fn/promise/finally';
import 'intl'; // For Safari 9

import '../lib/log-suppression';

import React from 'react';
import ReactDomClient from 'react-dom/client';

import AppStateHOC from '../lib/app-state-hoc.jsx';
import BrowserModalComponent from '../components/browser-modal/browser-modal.jsx';
import supportedBrowser from '../lib/supported-browser';

import styles from './index.css';

const appTarget = document.createElement('div');
appTarget.className = styles.app;
document.body.appendChild(appTarget);

if (supportedBrowser()) {
    // === Smalruby: Start of Microsoft auth popup handler ===
    // Detect if this page is loaded inside an MSAL popup after Microsoft auth.
    // When the popup redirects back, the URL hash contains auth response params
    // (code=...&state=...). In this case, do NOT render the app — just let MSAL
    // handle the redirect, send the result to the parent window, and close the popup.
    const {isMsalPopupRedirect, handleMsalPopupRedirect} = require('../lib/microsoft-auth.js');
    if (isMsalPopupRedirect()) {
        handleMsalPopupRedirect();
    } else {
    // === Smalruby: End of Microsoft auth popup handler ===

        // require needed here to avoid importing unsupported browser-crashing code
        // at the top level
        require('./render-gui.jsx').default(appTarget);
    }

} else {
    BrowserModalComponent.setAppElement(appTarget);
    const WrappedBrowserModalComponent = AppStateHOC(BrowserModalComponent, true /* localesOnly */);
    const handleBack = () => {};
    const root = ReactDomClient.createRoot(appTarget);
    // eslint-disable-next-line react/jsx-no-bind
    root.render(<WrappedBrowserModalComponent onBack={handleBack} />);
}
