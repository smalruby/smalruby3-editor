import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import WelcomeModal from '../components/welcome-modal/welcome-modal.jsx';
import analytics from '../lib/analytics';
import { getUrlParams } from '../lib/url-params.js';
import useIsNarrowScreen from '../lib/use-is-narrow-screen.js';
import { closeWelcomeModal, openTipsLibrary, openWelcomeModal } from '../reducers/modals.js';

const sendModalEvent = (action, label) => {
    try {
        analytics.event({ category: 'welcome', action, label });
    } catch (_e) {
        // Swallow analytics failures so the editor never breaks.
    }
};

const PORTRAIT_QUERY = '(orientation: portrait)';

const usePortraitMatch = () => {
    const [portrait, setPortrait] = useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia(PORTRAIT_QUERY).matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return () => {};
        }
        const mql = window.matchMedia(PORTRAIT_QUERY);
        const handler = (e) => setPortrait(e.matches);
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        }
        mql.addListener(handler);
        return () => mql.removeListener(handler);
    }, []);
    return portrait;
};

const WelcomeModalContainer = ({ isOpen, onCloseWelcomeModal, onOpenTipsLibrary, onOpenWelcomeModal }) => {
    const isNarrow = useIsNarrowScreen();
    const portrait = usePortraitMatch();

    // Open once on mount when ?welcome=1 was given. The ref keeps the effect
    // dep list empty without triggering eslint's exhaustive-deps complaint.
    const onOpenRef = useRef(onOpenWelcomeModal);
    onOpenRef.current = onOpenWelcomeModal;
    useEffect(() => {
        if (getUrlParams().showWelcome) {
            onOpenRef.current();
        }
    }, []);

    useEffect(() => {
        if (isOpen) sendModalEvent('modal_shown', 'modal');
    }, [isOpen]);

    const handleStartTutorial = useCallback(() => {
        sendModalEvent('modal_action', 'start_tutorial');
        onCloseWelcomeModal();
        onOpenTipsLibrary();
    }, [onCloseWelcomeModal, onOpenTipsLibrary]);

    const handleLearnMore = useCallback(() => {
        sendModalEvent('modal_action', 'learn_more');
        onCloseWelcomeModal();
        if (typeof window !== 'undefined') {
            window.open('about.html', '_blank', 'noopener,noreferrer');
        }
    }, [onCloseWelcomeModal]);

    const handleLater = useCallback(() => {
        sendModalEvent('modal_action', 'later');
        onCloseWelcomeModal();
    }, [onCloseWelcomeModal]);

    if (!isOpen) return null;

    // Defer to MobileOrientationGate while the phone is in portrait — the gate
    // covers the screen and any modal underneath would be invisible anyway.
    if (isNarrow && portrait) return null;

    return (
        <WelcomeModal
            isNarrow={isNarrow}
            onLater={handleLater}
            onLearnMore={handleLearnMore}
            onStartTutorial={handleStartTutorial}
        />
    );
};

WelcomeModalContainer.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onCloseWelcomeModal: PropTypes.func.isRequired,
    onOpenTipsLibrary: PropTypes.func.isRequired,
    onOpenWelcomeModal: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => ({
    isOpen: Boolean(state.scratchGui.modals.welcomeModal),
});

const mapDispatchToProps = (dispatch) => ({
    onOpenWelcomeModal: () => dispatch(openWelcomeModal()),
    onCloseWelcomeModal: () => dispatch(closeWelcomeModal()),
    onOpenTipsLibrary: () => dispatch(openTipsLibrary()),
});

export default connect(mapStateToProps, mapDispatchToProps)(WelcomeModalContainer);
