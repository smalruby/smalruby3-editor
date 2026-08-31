import {
    cancelGoogleLogin,
    loginWithGoogle,
    revealGoogleSignInButton,
    silentReauthGoogle,
} from '../../../src/lib/teacher-auth.js';

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
        // Default to a browser that shows the Google prompt itself.
        global.window.IdentityCredential = function IdentityCredential() {};
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
        delete global.window.IdentityCredential;
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
 * There is only ever one Google entry point on screen: our own login button,
 * or Google's rendered button in its place — never both. These pin when the
 * handover happens (#1149).
 */
describe('teacher-auth Google button handover (#1149)', () => {
    let container;

    beforeEach(() => {
        setupGoogleStub();
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        cancelGoogleLogin();
        delete global.google;
        delete global.window.IdentityCredential;
    });

    /** Pretend the browser does (not) mediate the Google prompt itself. */
    const setBrowserPrompt = (supported) => {
        if (supported) {
            global.window.IdentityCredential = function IdentityCredential() {};
        } else {
            delete global.window.IdentityCredential;
        }
    };

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

    test('waits for the browser prompt when the browser has one', async () => {
        setBrowserPrompt(true);
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        expect(onFallbackVisible).not.toHaveBeenCalled();
        expect(gis.promptCallback).toBeInstanceOf(Function);
    });

    test('hands over as soon as the user dismisses the prompt', async () => {
        setBrowserPrompt(true);
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        gis.promptCallback({
            isDismissedMoment: () => true,
            getDismissedReason: () => 'cancel_called',
        });

        expect(onFallbackVisible).toHaveBeenCalledWith('dismissed');
    });

    test('does not hand over when the prompt closed because it signed the user in', async () => {
        setBrowserPrompt(true);
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        gis.promptCallback({
            isDismissedMoment: () => true,
            getDismissedReason: () => 'credential_returned',
        });

        expect(onFallbackVisible).not.toHaveBeenCalled();
    });

    test('hands over immediately, without prompting, when the browser has no prompt', async () => {
        setBrowserPrompt(false);
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        expect(onFallbackVisible).toHaveBeenCalledWith('unsupported');
        // Asking would only have produced a prompt nobody can see.
        expect(gis.promptCallback).toBeNull();
    });

    // GIS does not always report that the prompt closed, so the user pressing
    // our button again has to be enough to get Google's button on screen.
    test('hands over when the login is asked for a second time', async () => {
        setBrowserPrompt(true);
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        revealGoogleSignInButton();

        expect(onFallbackVisible).toHaveBeenCalledWith('retry');
    });

    test('hands over at most once', async () => {
        setBrowserPrompt(true);
        const onFallbackVisible = jest.fn();
        await start(onFallbackVisible);

        const dismissal = {
            isDismissedMoment: () => true,
            getDismissedReason: () => 'cancel_called',
        };
        gis.promptCallback(dismissal);
        gis.promptCallback(dismissal);

        expect(onFallbackVisible).toHaveBeenCalledTimes(1);
    });
});
