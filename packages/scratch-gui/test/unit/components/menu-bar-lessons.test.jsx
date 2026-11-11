/* eslint-env jest */
import VM from '@smalruby/scratch-vm';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import MenuBar from '../../../src/components/menu-bar/menu-bar';
import { PLATFORM } from '../../../src/lib/platform';
import { DEFAULT_MODE } from '../../../src/lib/settings/color-mode';
import { lessonModeInitialState } from '../../../src/reducers/lesson-mode';
import { menuInitialState } from '../../../src/reducers/menus';
import { openLessonsLibrary } from '../../../src/reducers/modals';
import { LoadingState } from '../../../src/reducers/project-state';
import { markTutorialSeen } from '../../../src/reducers/tutorial-onboarding';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

jest.mock('../../../src/lib/classroom-api', () => ({
    __esModule: true,
    default: {},
    isClassroomConfigured: () => false,
}));

const buildStore = ({ tooltipDismissed = false, challengeId = null } = {}) =>
    configureStore()({
        locales: { isRtl: false, locale: 'en-US' },
        scratchGui: {
            menus: menuInitialState,
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
            tutorialOnboarding: { tutorialSeen: tooltipDismissed, rubyTabUsed: false, tooltipDismissed },
            lessonMode: { ...lessonModeInitialState, challengeId },
            classroom: { className: null, seatNumber: null, teacherLoggedIn: false },
            projectChanged: false,
            projectTitle: 'Untitled',
        },
        session: {
            session: { user: { username: 'test-user', membership_avatar_badge: null, thumbnailUrl: '' } },
            permissions: { educator: false, student: false },
        },
    });

const aboutItems = [{ title: 'About Smalruby', onClick: () => {} }];

const renderMenuBar = (storeOptions) => {
    const store = buildStore(storeOptions);
    const rendered = renderWithIntl(
        <Provider store={store}>
            <MenuBar onClickAbout={aboutItems} />
        </Provider>,
    );
    return { store, ...rendered };
};

describe('MenuBar Lessons button', () => {
    test('renders the Lessons button in the menu bar', () => {
        const { container } = renderMenuBar();
        const button = container.querySelector('[data-testid="menu-bar-lessons"]');
        expect(button).toBeTruthy();
        expect(button.getAttribute('aria-label')).toBe('Lessons');
    });

    test('opens the lessons library and marks the onboarding as seen when clicked', () => {
        const { container, store } = renderMenuBar();
        container.querySelector('[data-testid="menu-bar-lessons"]').click();
        expect(store.getActions()).toContainEqual(markTutorialSeen());
        expect(store.getActions()).toContainEqual(openLessonsLibrary());
    });

    // Issue #1512: 「レッスンをはじめよう！」の吹き出しはどの端末にも出さない（はじめての人でも）
    test('does not show a first-time balloon under the Lessons button', () => {
        const { container } = renderMenuBar({ tooltipDismissed: false });
        expect(container.querySelector('[data-testid="lessons-tooltip"]')).toBeFalsy();
    });

    // Issue #1498: レッスンモードでは課題バーに重なるので、ウェルカムバルーンを出さない
    test('hides the welcome balloon while a challenge is open', () => {
        const { container } = renderMenuBar({ challengeId: 'blocks-l1-if' });
        expect(container.querySelector('[data-testid="welcome-tooltip"]')).toBeFalsy();
    });

    test('shows the welcome balloon outside lesson mode', () => {
        const { container } = renderMenuBar();
        expect(container.querySelector('[data-testid="welcome-tooltip"]')).toBeTruthy();
    });
});
