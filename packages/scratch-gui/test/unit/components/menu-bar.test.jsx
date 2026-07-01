import React from 'react';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import MenuBar from '../../../src/components/menu-bar/menu-bar';
import {menuInitialState} from '../../../src/reducers/menus';
import {LoadingState} from '../../../src/reducers/project-state';
import {DEFAULT_MODE} from '../../../src/lib/settings/color-mode';
import {fireEvent} from '@testing-library/react';

import {PLATFORM} from '../../../src/lib/platform';
import {tutorialOnboardingInitialState} from '../../../src/reducers/tutorial-onboarding';

import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import VM from '@smalruby/scratch-vm';

import {openKoshienTestModal} from '../../../src/reducers/modals';
import {setAiSaveStatus} from '../../../src/reducers/koshien-file';

describe('MenuBar Component', () => {
    const store = configureStore()({
        locales: {
            isRtl: false,
            locale: 'en-US'
        },
        scratchGui: {
            menus: menuInitialState,
            projectState: {
                loadingState: LoadingState.NOT_LOADED
            },
            settings: {
                colorMode: DEFAULT_MODE
            },
            timeTravel: {
                year: 'NOW'
            },
            vm: new VM(),
            platform: {
                platform: PLATFORM.WEB
            },
            targets: {
                editingTarget: 'target-id'
            },
            rubyCode: {
                target: null,
                code: '',
                modified: false,
                errors: [],
                markers: [],
                fontSize: 16
            },
            koshienFile: {
                extensionLoadCounter: 0,
                aiSaveStatus: {}
            },
            googleDriveFile: {
                isGoogleDriveFile: false
            },
            meshV2: {
                domain: null
            },
            cards: {
                visible: false,
                activeDeckId: null,
                step: 0
            },
            tutorialOnboarding: tutorialOnboardingInitialState,
            projectChanged: false,
            projectTitle: 'Untitled'
        },
        session: {
            session: {
                user: {
                    username: 'test-user',
                    membership_avatar_badge: null,
                    thumbnailUrl: ''
                }
            },
            permissions: {
                educator: false,
                student: false
            }
        }
    });

    const getComponent = function (props = {}) {
        return <Provider store={store}><MenuBar {...props} /></Provider>;
    };

    test('menu bar with no About handler has no About button', () => {
        const {container} = renderWithIntl(getComponent());
        const button = container.querySelector('button');
        expect(button).toBeFalsy();
    });

    test('menu bar with an About handler has an About button', () => {
        const onClickAbout = jest.fn();
        const {container} = renderWithIntl(getComponent({onClickAbout}));
        const button = container.querySelector('button');
        expect(button).toBeTruthy();
    });

    describe('Koshien "Test AI" menu item', () => {
        // Build a store where the koshien menu is open and the koshien
        // extension is loaded, so the koshien menu items render.
        const buildKoshienStore = () => {
            const vm = new VM();
            vm.extensionManager = vm.extensionManager || {};
            vm.extensionManager.isExtensionLoaded = extensionId => extensionId === 'koshien';
            return configureStore()({
                locales: {
                    isRtl: false,
                    locale: 'en-US'
                },
                scratchGui: {
                    menus: {
                        ...menuInitialState,
                        koshienMenu: true
                    },
                    projectState: {
                        loadingState: LoadingState.NOT_LOADED
                    },
                    settings: {
                        colorMode: DEFAULT_MODE
                    },
                    timeTravel: {
                        year: 'NOW'
                    },
                    vm,
                    platform: {
                        platform: PLATFORM.WEB
                    },
                    targets: {
                        editingTarget: 'target-id'
                    },
                    rubyCode: {
                        target: null,
                        code: '',
                        modified: false,
                        errors: [],
                        markers: [],
                        fontSize: 16
                    },
                    koshienFile: {
                        extensionLoadCounter: 0,
                        aiSaveStatus: {}
                    },
                    googleDriveFile: {
                        isGoogleDriveFile: false
                    },
                    meshV2: {
                        domain: null
                    },
                    cards: {
                        visible: false,
                        activeDeckId: null,
                        step: 0
                    },
                    tutorialOnboarding: tutorialOnboardingInitialState,
                    projectChanged: false,
                    projectTitle: 'Untitled'
                },
                session: {
                    session: {
                        user: {
                            username: 'test-user',
                            membership_avatar_badge: null,
                            thumbnailUrl: ''
                        }
                    },
                    permissions: {
                        educator: false,
                        student: false
                    }
                }
            });
        };

        const renderKoshienMenu = koshienStore =>
            renderWithIntl(
                <Provider store={koshienStore}>
                    <MenuBar onClickAbout={jest.fn()} />
                </Provider>
            );

        test('clicking "Test AI" opens the test modal', () => {
            const koshienStore = buildKoshienStore();
            const {getByText} = renderKoshienMenu(koshienStore);

            fireEvent.click(getByText('Test AI'));

            expect(koshienStore.getActions()).toContainEqual(openKoshienTestModal());
        });

        test('clicking "Test AI" does not trigger a save', () => {
            const koshienStore = buildKoshienStore();
            const {getByText} = renderKoshienMenu(koshienStore);

            fireEvent.click(getByText('Test AI'));

            // Saving the AI sets the save status to 'saving'. "Test AI" must
            // not save, so this action must never be dispatched.
            expect(koshienStore.getActions()).not.toContainEqual(setAiSaveStatus('saving'));
        });
    });

    describe('triggering About button handler', () => {
        test('clicking on About button calls the handler', () => {
            const onClickAbout = jest.fn();
            const {container} = renderWithIntl(getComponent({onClickAbout}));
            const button = container.querySelector('button');
    
            fireEvent.click(button);
            expect(onClickAbout).toHaveBeenCalledTimes(1);
        });
    
        test('not clicking on About button does not call the handler', () => {
            const onClickAbout = jest.fn();
            renderWithIntl(getComponent({onClickAbout}));
    
            expect(onClickAbout).toHaveBeenCalledTimes(0);
        });
    });
});
