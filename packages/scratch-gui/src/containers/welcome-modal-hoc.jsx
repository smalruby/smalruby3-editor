import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import WelcomeModal from '../components/welcome-modal/welcome-modal.jsx';
import { getUrlParams } from '../lib/url-params.js';
import useIsNarrowScreen from '../lib/use-is-narrow-screen.js';
import { closeWelcomeModal, openTipsLibrary, openWelcomeModal } from '../reducers/modals.js';

/*
 * 自動表示は当面オフ。メニューや MobileDrawer のヘルプから明示的に選んだ
 * ときだけ Redux の `welcomeModal` を open に切り替える運用 (#658)。
 * 動作確認用に ?welcome=1 を付けたときだけ初回ロードで開く。
 */

const usePortraitMatch = () => {
    const [portrait, setPortrait] = React.useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia('(orientation: portrait)').matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return () => {};
        }
        const mql = window.matchMedia('(orientation: portrait)');
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

    // ?welcome=1 のときだけ初回ロードで dispatch して開く。
    // 初回マウント時のみ判定。再表示はメニューからの dispatch で行う。
    const onOpenRef = React.useRef(onOpenWelcomeModal);
    onOpenRef.current = onOpenWelcomeModal;
    useEffect(() => {
        if (getUrlParams().showWelcome) {
            onOpenRef.current();
        }
    }, []);

    const handleStartTutorial = React.useCallback(() => {
        onCloseWelcomeModal();
        onOpenTipsLibrary();
    }, [onCloseWelcomeModal, onOpenTipsLibrary]);

    const handleLearnMore = React.useCallback(() => {
        onCloseWelcomeModal();
        if (typeof window !== 'undefined') {
            window.open('about.html', '_blank', 'noopener,noreferrer');
        }
    }, [onCloseWelcomeModal]);

    const handleLater = React.useCallback(() => {
        onCloseWelcomeModal();
    }, [onCloseWelcomeModal]);

    if (!isOpen) return null;

    // 縦持ちのスマホでは MobileOrientationGate が全画面で「横向きにしてください」を
    // 表示しているため、その上に WelcomeModal を重ねない。横向きに回転して
    // gate が消えたタイミングで自動的に再描画され WelcomeModal が現れる。
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
