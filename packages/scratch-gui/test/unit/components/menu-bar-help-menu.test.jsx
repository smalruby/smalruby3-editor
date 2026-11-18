import VM from '@smalruby/scratch-vm';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import MenuBar from '../../../src/components/menu-bar/menu-bar';
import { PLATFORM } from '../../../src/lib/platform';
import { DEFAULT_MODE } from '../../../src/lib/settings/color-mode';
import { lessonModeInitialState } from '../../../src/reducers/lesson-mode';
import { menuInitialState } from '../../../src/reducers/menus';
import { openDebugModal, openTipsLibrary } from '../../../src/reducers/modals';
import { LoadingState } from '../../../src/reducers/project-state';
import { tutorialOnboardingInitialState } from '../../../src/reducers/tutorial-onboarding';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

jest.mock('../../../src/lib/classroom-api', () => ({
    __esModule: true,
    default: {},
    isClassroomConfigured: () => false,
}));

const buildStore = ({ aboutMenuOpen = false } = {}) =>
    configureStore()({
        locales: { isRtl: false, locale: 'en-US' },
        scratchGui: {
            menus: { ...menuInitialState, aboutMenu: aboutMenuOpen },
            projectState: { loadingState: LoadingState.NOT_LOADED },
            settings: { colorMode: DEFAULT_MODE },
            timeTravel: { year: 'NOW' },
            vm: new VM(),
            platform: { platform: PLATFORM.WEB },
            targets: { editingTarget: 'target-id' },
            rubyCode: { target: null, code: '', modified: false, errors: [], markers: [], fontSize: 16 },
            koshienFile: { extensionLoadCounter: 0, aiSaveStatus: {} },
            googleDriveFile: { isGoogleDriveFile: false },
            meshV2: { domain: null },
            cards: { visible: false, activeDeckId: null, step: 0 },
            tutorialOnboarding: tutorialOnboardingInitialState,
            lessonMode: lessonModeInitialState,
            classroom: { className: null, seatNumber: null, teacherLoggedIn: false },
            projectChanged: false,
            projectTitle: 'Untitled',
        },
        session: {
            session: { user: { username: 'test-user', membership_avatar_badge: null, thumbnailUrl: '' } },
            permissions: { educator: false, student: false },
        },
    });

// gui.jsx passes the "?" menu as an array of {id, title, onClick}; mirror that here.
const aboutItems = [{ id: 'about', title: 'About Smalruby', onClick: () => {} }];
const allAboutItems = [
    { id: 'about', title: 'About Smalruby', onClick: () => {} },
    { id: 'welcome', title: 'Show welcome again', onClick: () => {} },
    { id: 'bugReport', title: 'Report a bug', onClick: () => {} },
];

const renderMenuBar = (storeOptions, props = {}) => {
    const store = buildStore(storeOptions);
    const rendered = renderWithIntl(
        <Provider store={store}>
            <MenuBar onClickAbout={aboutItems} {...props} />
        </Provider>,
    );
    return { store, ...rendered };
};

describe('MenuBar help ("?") menu', () => {
    test('does not render the Tutorials and Debug buttons in the menu bar', () => {
        const { container } = renderMenuBar();
        expect(container.querySelector('[aria-label="Tutorials"]')).toBeFalsy();
        expect(container.querySelector('[aria-label="Debug"]')).toBeFalsy();
    });

    test('does not render the first-time "Try Ruby!" tooltip', () => {
        const { queryByText } = renderMenuBar();
        expect(queryByText('Try Ruby!')).toBeNull();
    });

    test('lists Tutorials and Debug in the "?" menu when it is open', () => {
        const { container } = renderMenuBar({ aboutMenuOpen: true });
        expect(container.querySelector('[data-testid="menu-bar-help-tutorials"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="menu-bar-help-debug"]')).toBeTruthy();
    });

    test('hides the help items while the "?" menu is closed', () => {
        const { container } = renderMenuBar({ aboutMenuOpen: false });
        expect(container.querySelector('[data-testid="menu-bar-help-tutorials"]')).toBeFalsy();
        expect(container.querySelector('[data-testid="menu-bar-help-debug"]')).toBeFalsy();
    });

    test('opens the tutorial library when Tutorials is clicked', () => {
        const { container, store } = renderMenuBar({ aboutMenuOpen: true });
        container.querySelector('[data-testid="menu-bar-help-tutorials"]').click();
        expect(store.getActions()).toContainEqual(openTipsLibrary());
    });

    test('opens the debug modal when Debug is clicked', () => {
        const { container, store } = renderMenuBar({ aboutMenuOpen: true });
        container.querySelector('[data-testid="menu-bar-help-debug"]').click();
        expect(store.getActions()).toContainEqual(openDebugModal());
    });

    test('orders the items as help, bug report, then about Smalruby with the version last', () => {
        const { container } = renderMenuBar({ aboutMenuOpen: true }, { onClickAbout: allAboutItems });
        const items = [...container.querySelectorAll('[data-testid="menu-bar-about"] li')];
        const texts = items.map((li) => li.textContent);
        expect(texts.slice(0, 5)).toEqual([
            'Tutorials',
            'Debug',
            'Report a bug',
            'Show welcome again',
            'About Smalruby',
        ]);
        expect(texts[5]).toMatch(/^Version/);
        // the sections (and their dividers) come from HELP_MENU_SECTIONS (test/unit/lib/help-menu.test.js)
        expect(texts).toHaveLength(6);
    });

    test('shows that a local build has no version', () => {
        const { container } = renderMenuBar({ aboutMenuOpen: true });
        expect(container.querySelector('[data-testid="menu-bar-help-version"]').textContent).toBe(
            'Version: development build',
        );
    });

    describe('with a commit sha in the build', () => {
        const savedSha = process.env.COMMIT_SHA;
        const savedFetch = global.fetch;
        beforeEach(() => {
            process.env.COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
            global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
        });
        afterEach(() => {
            if (typeof savedSha === 'undefined') delete process.env.COMMIT_SHA;
            else process.env.COMMIT_SHA = savedSha;
            global.fetch = savedFetch;
        });

        test('shows the short commit sha as the version', () => {
            const { container } = renderMenuBar({ aboutMenuOpen: true });
            expect(container.querySelector('[data-testid="menu-bar-help-version"]').textContent).toBe(
                'Version: 0123456',
            );
        });

        test('checks for a newer version when the version is clicked', () => {
            const { container } = renderMenuBar({ aboutMenuOpen: true });
            container.querySelector('[data-testid="menu-bar-help-version"]').click();
            expect(global.fetch).toHaveBeenCalledWith('./version.json', { cache: 'no-store' });
        });
    });
});
