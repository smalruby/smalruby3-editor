// === Smalruby: This file is Smalruby-specific (reads the Ruby tab from the Ruby bundle) ===
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { getRubyBundle, loadRubyBundle, whenIdle } from '../lib/ruby-bundle';
import styles from './ruby-tab-loader.css';

const messages = defineMessages({
    loading: {
        id: 'gui.rubyTabLoader.loading',
        defaultMessage: 'Loading the Ruby tab...',
        description: 'Shown in the Ruby tab while its program is being downloaded',
    },
    failed: {
        id: 'gui.rubyTabLoader.failed',
        defaultMessage:
            'The Ruby tab could not be loaded. Check the internet connection and press "Try again". ' +
            'If it still fails, reload the page.',
        description: 'Shown in the Ruby tab when its program could not be downloaded',
    },
    retry: {
        id: 'gui.rubyTabLoader.retry',
        defaultMessage: 'Try again',
        description: 'Button to download the Ruby tab again',
    },
    reload: {
        id: 'gui.rubyTabLoader.reload',
        defaultMessage: 'Reload the page',
        description: 'Button to reload the page when the Ruby tab could not be downloaded',
    },
});

/**
 * The Ruby tab, read from the Ruby bundle (`lib/ruby-bundle.js`). The bundle is read in the idle
 * time after the start, or at once when the tab is opened first. The tab is first drawn hidden
 * and then shown, as it was when it was in the main bundle: RubyTab generates the code and
 * focuses the editor when it sees itself become visible.
 * @param {object} props - the props of RubyTab (`isVisible`, `vm`, ...)
 * @returns {React.ReactElement} the Ruby tab or its placeholder
 */
const RubyTabLoader = (props) => {
    const { isVisible, reloadPage = () => window.location.reload(), ...rubyTabProps } = props;
    const [bundle, setBundle] = useState(getRubyBundle);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [drawn, setDrawn] = useState(false);
    const handleRetry = useCallback(() => setAttempt((n) => n + 1), []);

    useEffect(() => {
        let alive = !bundle;
        if (!alive) return;
        const load = () => {
            if (!alive) return;
            setFailed(false);
            loadRubyBundle().then(
                (loaded) => {
                    if (alive) setBundle(loaded);
                },
                (error) => {
                    // eslint-disable-next-line no-console
                    console.error('Failed to load the Ruby bundle:', error);
                    if (alive) setFailed(true);
                },
            );
        };
        if (isVisible || attempt > 0) load();
        else whenIdle(load);
        return () => {
            alive = false;
        };
    }, [bundle, isVisible, attempt]);

    // prism.wasm next, so the first conversion does not wait for it either.
    useEffect(() => {
        if (!bundle) return;
        whenIdle(() => {
            Promise.resolve(bundle.loadPrism()).catch((error) => {
                // The converter reads it again when it needs it.
                // eslint-disable-next-line no-console
                console.warn('Failed to preload prism.wasm:', error);
            });
        });
    }, [bundle]);

    useEffect(() => {
        if (bundle && !drawn) setDrawn(true);
    }, [bundle, drawn]);

    if (bundle) {
        const { RubyTab } = bundle;
        return <RubyTab {...rubyTabProps} isVisible={drawn && isVisible} />;
    }
    if (!isVisible) return null;
    if (failed) {
        return (
            <div className={styles.placeholder} data-testid="ruby-tab-loader-error" role="alert">
                <FormattedMessage {...messages.failed} />
                <div className={styles.buttons}>
                    <button
                        className={`${styles.button} ${styles.primary}`}
                        data-testid="ruby-tab-loader-retry"
                        type="button"
                        onClick={handleRetry}
                    >
                        <FormattedMessage {...messages.retry} />
                    </button>
                    <button
                        className={`${styles.button} ${styles.secondary}`}
                        data-testid="ruby-tab-loader-reload"
                        type="button"
                        onClick={reloadPage}
                    >
                        <FormattedMessage {...messages.reload} />
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className={styles.placeholder} data-testid="ruby-tab-loader-loading" role="status">
            <FormattedMessage {...messages.loading} />
        </div>
    );
};

RubyTabLoader.propTypes = {
    isVisible: PropTypes.bool,
    reloadPage: PropTypes.func,
};

export default RubyTabLoader;
