import VM from '@smalruby/scratch-vm';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import MenuBar from '../../../src/components/menu-bar/menu-bar';
import { PLATFORM } from '../../../src/lib/platform';
import { DEFAULT_MODE } from '../../../src/lib/settings/color-mode';
import { menuInitialState } from '../../../src/reducers/menus';
import { LoadingState } from '../../../src/reducers/project-state';
import { tutorialOnboardingInitialState } from '../../../src/reducers/tutorial-onboarding';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

jest.mock('../../../src/lib/classroom-api', () => ({
    __esModule: true,
    default: {},
    isClassroomConfigured: () => true,
}));

// The real container restores the login on mount. Stub it so the test only
// checks what the menu bar renders.
jest.mock('../../../src/containers/classroom-teacher-menu.jsx', () => {
    const { useSelector } = require('react-redux');
    const Stub = () => {
        const loggedIn = useSelector((state) => state.scratchGui.classroom.teacherLoggedIn);
        return loggedIn ? <div data-testid="classroom-teacher-menu-button" /> : null;
    };
    return { __esModule: true, default: Stub };
});

const buildStore = (classroom) =>
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
            tutorialOnboarding: tutorialOnboardingInitialState,
            classroom: { className: null, seatNumber: null, ...classroom },
            projectChanged: false,
            projectTitle: 'Untitled',
        },
        session: {
            session: { user: { username: 'test-user', membership_avatar_badge: null, thumbnailUrl: '' } },
            permissions: { educator: false, student: false },
        },
    });

const renderMenuBar = (classroom) =>
    renderWithIntl(
        <Provider store={buildStore(classroom)}>
            <MenuBar />
        </Provider>,
    );

describe('MenuBar classroom entries (#1199)', () => {
    test('shows only the student button when no teacher is logged in', () => {
        const { container } = renderMenuBar({ teacherLoggedIn: false });
        expect(container.querySelector('[data-testid="classroom-menu-button"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="classroom-teacher-menu-button"]')).toBeFalsy();
    });

    // A teacher also joins a class to show students how it works, so the
    // student button must stay next to the teacher menu.
    test('shows the student button next to the teacher menu while a teacher is logged in', () => {
        const { container } = renderMenuBar({ teacherLoggedIn: true });
        expect(container.querySelector('[data-testid="classroom-teacher-menu-button"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="classroom-menu-button"]')).toBeTruthy();
    });
});
