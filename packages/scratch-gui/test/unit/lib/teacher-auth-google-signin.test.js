import { cancelGoogleLogin, loginWithGoogle, silentReauthGoogle } from '../../../src/lib/teacher-auth.js';

/**
 * Regression tests for the Google sign-in fallback UI lifecycle (#1149).
 *
 * The fallback "Sign in with Google" button used to be appended to
 * `document.body` as a fixed, centered overlay that was only removed when the
 * credential callback fired — so it stayed on screen (and accumulated) whenever
 * the login was abandoned. These tests pin the new contract:
 * render into a caller-supplied container, never leak, never accumulate, and
 * always settle the promise.
 */
jest.mock('../../../src/lib/google-script-loader.js', () => ({
    loadGoogleIdentity: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../src/lib/microsoft-auth.js', () => ({
    requestMicrosoftIdToken: jest.fn(),
    refreshMicrosoftIdToken: jest.fn(),
    isMicrosoftAuthAvailable: jest.fn(() => false),
    clearMicrosoftAuth: jest.fn(),
}));

/** Track the config/callbacks the module hands to GIS. */
let gis;

const setupGoogleStub = () => {
    gis = {
        initializeConfig: null,
        promptCallback: null,
        renderedInto: [],
        cancelCount: 0,
    };
    global.google = {
        accounts: {
            id: {
                initialize: (config) => {
                    gis.initializeConfig = config;
                },
                prompt: (callback) => {
                    gis.promptCallback = callback || null;
                },
                renderButton: (element) => {
                    gis.renderedInto.push(element);
                    // GIS injects its own markup into the given element.
                    element.appendChild(document.createElement('iframe'));
                },
                cancel: () => {
                    gis.cancelCount += 1;
                },
            },
        },
    };
};

/** Count leftover sign-in overlays directly under <body>. */
const bodyOverlayCount = () => document.querySelectorAll('body > div').length;

describe('teacher-auth Google sign-in fallback UI (#1149)', () => {
    let container;

    beforeEach(() => {
        setupGoogleStub();
        document.body.innerHTML = '';
        container = document.createElement('div');
        // The real container lives inside the modal, not directly under body.
        const modal = document.createElement('div');
        modal.appendChild(container);
        document.body.appendChild(modal);
    });

    afterEach(() => {
        cancelGoogleLogin();
        delete global.google;
    });

    test('renders the fallback button into the given container, not into body', async () => {
        const pending = loginWithGoogle({ container });
        pending.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();

        expect(gis.renderedInto).toHaveLength(1);
        expect(container.contains(gis.renderedInto[0])).toBe(true);
        // Only the modal wrapper created in beforeEach lives under <body>.
        expect(bodyOverlayCount()).toBe(1);
    });

    test('cancelGoogleLogin removes the button, cancels One Tap and settles the promise', async () => {
        const pending = loginWithGoogle({ container });
        await Promise.resolve();
        await Promise.resolve();
        expect(container.childElementCount).toBe(1);

        cancelGoogleLogin();

        await expect(pending).rejects.toThrow();
        expect(container.childElementCount).toBe(0);
        expect(gis.cancelCount).toBeGreaterThan(0);
    });

    test('starting login repeatedly does not accumulate DOM', async () => {
        const first = loginWithGoogle({ container });
        first.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();
        const second = loginWithGoogle({ container });
        second.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();
        const third = loginWithGoogle({ container });
        third.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();

        expect(container.childElementCount).toBe(1);
        expect(bodyOverlayCount()).toBe(1);
        // The superseded attempts must settle so callers do not hang.
        await expect(first).rejects.toThrow();
        await expect(second).rejects.toThrow();
        cancelGoogleLogin();
        await expect(third).rejects.toThrow();
    });

    test('a successful credential resolves and removes the button', async () => {
        const pending = loginWithGoogle({ container });
        await Promise.resolve();
        await Promise.resolve();

        gis.initializeConfig.callback({ credential: 'id-token' });

        await expect(pending).resolves.toBe('id-token');
        expect(container.childElementCount).toBe(0);
    });

    test('a credential-less callback rejects and removes the button', async () => {
        const pending = loginWithGoogle({ container });
        await Promise.resolve();
        await Promise.resolve();

        gis.initializeConfig.callback({});

        await expect(pending).rejects.toThrow();
        expect(container.childElementCount).toBe(0);
    });

    test('does not depend on FedCM-incompatible prompt moment methods', async () => {
        const pending = loginWithGoogle({ container });
        pending.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();

        expect(gis.initializeConfig.use_fedcm_for_prompt).toBe(true);

        // The moment listener may only read isDismissedMoment(): the others
        // stop working once FedCM is mandatory.
        const deprecated = {
            isNotDisplayed: jest.fn(() => true),
            isSkippedMoment: jest.fn(() => true),
            isDisplayMoment: jest.fn(() => true),
        };
        gis.promptCallback({
            ...deprecated,
            isDismissedMoment: () => false,
        });

        expect(deprecated.isNotDisplayed).not.toHaveBeenCalled();
        expect(deprecated.isSkippedMoment).not.toHaveBeenCalled();
        expect(deprecated.isDisplayMoment).not.toHaveBeenCalled();
    });
});

/**
 * The in-modal button is a fallback: while the browser's own Google prompt is
 * up, a second "Sign in as ..." button beside our own login button only
 * confuses people. It stays hidden until that prompt is known not to help.
 */
describe('teacher-auth Google fallback button reveal (#1149)', () => {
    let container;

    beforeEach(() => {
        jest.useFakeTimers();
        setupGoogleStub();
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        cancelGoogleLogin();
        jest.useRealTimers();
        delete global.google;
    });

    /**
     * Start a login and let the awaited script loader settle. The pending
     * promise is wrapped so awaiting this helper cannot accidentally await the
     * login itself (which only settles on success or cancellation).
     */
    const start = async (onFallbackVisible) => {
        const pending = loginWithGoogle({ container, onFallbackVisible });
        pending.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();
        return { pending };
    };

    const button = () => container.querySelector('[data-testid="google-signin-button"]');

    test('is hidden while the browser prompt has a chance to sign the user in', async () => {
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        expect(button().hidden).toBe(true);
        expect(onFallbackVisible).not.toHaveBeenCalled();
    });

    test('is revealed once the prompt produced nothing in time', async () => {
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        jest.advanceTimersByTime(4000);

        expect(button().hidden).toBe(false);
        expect(onFallbackVisible).toHaveBeenCalledTimes(1);
    });

    test('is revealed as soon as the user dismisses the prompt', async () => {
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        gis.promptCallback({
            isDismissedMoment: () => true,
            getDismissedReason: () => 'cancel_called',
        });

        expect(button().hidden).toBe(false);
        expect(onFallbackVisible).toHaveBeenCalledTimes(1);
    });

    test('stays hidden when the prompt closed because it returned a credential', async () => {
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        gis.promptCallback({
            isDismissedMoment: () => true,
            getDismissedReason: () => 'credential_returned',
        });

        expect(button().hidden).toBe(true);
        expect(onFallbackVisible).not.toHaveBeenCalled();
    });

    test('does not reveal after the login was cancelled', async () => {
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        cancelGoogleLogin();
        jest.advanceTimersByTime(10000);

        expect(onFallbackVisible).not.toHaveBeenCalled();
    });
});

describe('silentReauthGoogle FedCM compatibility (#1149)', () => {
    beforeEach(() => {
        setupGoogleStub();
    });

    afterEach(() => {
        delete global.google;
    });

    test('resolves with the credential without using deprecated moment methods', async () => {
        const deprecated = {
            isNotDisplayed: jest.fn(() => true),
            isSkippedMoment: jest.fn(() => true),
            isDisplayMoment: jest.fn(() => true),
        };
        const pending = silentReauthGoogle();
        await Promise.resolve();
        await Promise.resolve();

        if (gis.promptCallback) {
            gis.promptCallback({
                ...deprecated,
                isDismissedMoment: () => false,
                getMomentType: () => 'display',
            });
        }
        gis.initializeConfig.callback({ credential: 'fresh-token' });

        await expect(pending).resolves.toBe('fresh-token');
        expect(deprecated.isNotDisplayed).not.toHaveBeenCalled();
        expect(deprecated.isSkippedMoment).not.toHaveBeenCalled();
        expect(deprecated.isDisplayMoment).not.toHaveBeenCalled();
    });

    test('returns null when the prompt is dismissed without a credential', async () => {
        const pending = silentReauthGoogle();
        await Promise.resolve();
        await Promise.resolve();

        gis.promptCallback({
            isDismissedMoment: () => true,
            getDismissedReason: () => 'cancel_called',
            getMomentType: () => 'dismissed',
        });

        await expect(pending).resolves.toBeNull();
    });
});
