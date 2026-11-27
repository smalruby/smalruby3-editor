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
        promptCalled: false,
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
                    gis.promptCalled = true;
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

    test('a login that lost its container while loading never renders', async () => {
        container.remove();

        await expect(loginWithGoogle({ container })).rejects.toThrow();
        expect(gis.renderedInto).toHaveLength(0);
    });
});

/**
 * Google's own button is the entry point from the start. Chrome stops showing
 * the One Tap prompt for a while after it was closed once, without telling the
 * page, so asking for the prompt made the first press do nothing.
 */
describe('teacher-auth Google button entry point', () => {
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
    });

    const start = async (onButtonVisible) => {
        const pending = loginWithGoogle({ container, onButtonVisible });
        pending.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();
        return { pending };
    };

    test('never asks for the One Tap prompt', async () => {
        await start();

        expect(gis.promptCallback).toBeNull();
        expect(gis.promptCalled).toBe(false);
    });

    test("uses the FedCM button mode for Google's button", async () => {
        await start();

        expect(gis.initializeConfig.use_fedcm_for_button).toBe(true);
    });

    test('tells the caller once the button is on screen', async () => {
        const onButtonVisible = jest.fn();
        await start(onButtonVisible);

        expect(onButtonVisible).toHaveBeenCalledTimes(1);
        expect(container.childElementCount).toBe(1);
    });
});
