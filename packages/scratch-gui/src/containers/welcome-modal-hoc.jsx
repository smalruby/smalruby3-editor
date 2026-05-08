import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import WelcomeModal from '../components/welcome-modal/welcome-modal.jsx';
import { getUrlParams } from '../lib/url-params.js';
import useIsNarrowScreen from '../lib/use-is-narrow-screen.js';
import { openTipsLibrary } from '../reducers/modals.js';

export const WELCOME_MODAL_SHOW_EVENT = 'smalruby:show-welcome-modal';

// 自動表示は当面オフ。メニューや MobileDrawer のヘルプから明示的に選んだ
// ときだけ smalruby:show-welcome-modal イベントで開く運用 (#658)。
// 動作確認用に ?welcome=1 を付けたときだけ初回ロードで開く。
const shouldShowOnLoad = () => getUrlParams().showWelcome;

const isPortrait = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(orientation: portrait)').matches;
};

const usePortrait = () => {
    const [portrait, setPortrait] = useState(isPortrait);
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

const WelcomeModalContainer = ({ onOpenTipsLibrary }) => {
    const [visible, setVisible] = useState(shouldShowOnLoad);
    const isNarrow = useIsNarrowScreen();
    const portrait = usePortrait();

    // Re-show on demand (e.g. from the mobile drawer "Show welcome again" item).
    useEffect(() => {
        if (typeof window === 'undefined') return () => {};
        const handler = () => {
            setVisible(true);
        };
        window.addEventListener(WELCOME_MODAL_SHOW_EVENT, handler);
        return () => window.removeEventListener(WELCOME_MODAL_SHOW_EVENT, handler);
    }, []);

    const handleStartTutorial = useCallback(() => {
        setVisible(false);
        onOpenTipsLibrary();
    }, [onOpenTipsLibrary]);

    const handleLearnMore = useCallback(() => {
        // SP では Primary CTA。閉じてから about.html を新規タブで開き、
        // タブを切り替えて戻ってきたときにエディタが見えている状態にする。
        setVisible(false);
        if (typeof window !== 'undefined') {
            window.open('about.html', '_blank', 'noopener,noreferrer');
        }
    }, []);

    const handleLater = useCallback(() => {
        setVisible(false);
    }, []);

    if (!visible) return null;

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
    onOpenTipsLibrary: PropTypes.func.isRequired,
};

const mapDispatchToProps = (dispatch) => ({
    onOpenTipsLibrary: () => dispatch(openTipsLibrary()),
});

export default connect(null, mapDispatchToProps)(WelcomeModalContainer);
