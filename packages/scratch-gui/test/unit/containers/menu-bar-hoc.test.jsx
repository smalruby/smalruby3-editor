import React from 'react';
import configureStore from 'redux-mock-store';
import MenuBarHOC from '../../../src/containers/menu-bar-hoc.jsx';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom';
import {tutorialOnboardingInitialState} from '../../../src/reducers/tutorial-onboarding';
import {lessonModeInitialState} from '../../../src/reducers/lesson-mode';

// TODO rewrite this test to use react-testing-library

describe('Menu Bar HOC', () => {
    const mockStore = configureStore();
    let store;
    let Component;

    beforeEach(() => {
        store = mockStore({
            scratchGui: {
                projectChanged: true,
                tutorialOnboarding: tutorialOnboardingInitialState,
                lessonMode: lessonModeInitialState
            }
        });

        Component = jest.fn(
            ({confirmReadyToReplaceProject, shouldSaveBeforeTransition}) => (
                <>
                    <div id="confirmReadyToReplaceProject">
                        {`${confirmReadyToReplaceProject()}`}
                    </div>
                    <div id="shouldSaveBeforeTransition">
                        {`${shouldSaveBeforeTransition()}`}
                    </div>
                </>
            )
        );
    });

    test('Logged in user who IS owner and HAS changed project will NOT be prompted to save', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                canCreateNew
                canSave
                projectChanged
                // assume the user will click "cancel" on the confirm dialog
                confirmWithMessage={() => (false)} // eslint-disable-line react/jsx-no-bind
                store={store}
            />
        );

        const element = container.querySelector('#confirmReadyToReplaceProject');
        expect(element).toHaveTextContent(/true/i);
    });

    test('Logged in user who IS owner and has NOT changed project will NOT be prompted to save', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                canCreateNew
                canSave
                confirmWithMessage={() => (false)} // eslint-disable-line react/jsx-no-bind
                projectChanged={false}
                store={store}
            />
        );

        const element = container.querySelector('#confirmReadyToReplaceProject');
        expect(element).toHaveTextContent(/true/i);
    });

    test('Logged in user who is NOT owner and HAS changed project will NOT be prompted to save', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                canCreateNew
                projectChanged
                canSave={false}
                confirmWithMessage={() => (false)} // eslint-disable-line react/jsx-no-bind
                store={store}
            />
        );

        const element = container.querySelector('#confirmReadyToReplaceProject');
        expect(element).toHaveTextContent(/true/i);
    });

    test('Logged OUT user who HAS changed project WILL be prompted to save', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                projectChanged
                canCreateNew={false}
                canSave={false}
                confirmWithMessage={() => (false)} // eslint-disable-line react/jsx-no-bind
                store={store}
            />
        );

        const element = container.querySelector('#confirmReadyToReplaceProject');
        expect(element).toHaveTextContent(/false/i);
    });

    test('Logged OUT user who has NOT changed project WILL NOT be prompted to save', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                canCreateNew={false}
                canSave={false}
                confirmWithMessage={() => (false)} // eslint-disable-line react/jsx-no-bind
                projectChanged={false}
                store={store}
            />
        );
        const element = container.querySelector('#confirmReadyToReplaceProject');
        expect(element).toHaveTextContent(/true/i);
    });

    test('Logged in user who IS owner and HAS changed project SHOULD save before transition to project page', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                canSave
                projectChanged
                store={store}
            />
        );

        const element = container.querySelector('#shouldSaveBeforeTransition');
        expect(element).toHaveTextContent(/true/i);
    });

    test('Logged in user who IS owner and has NOT changed project should NOT save before transition', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                canSave
                projectChanged={false}
                store={store}
            />
        );

        const element = container.querySelector('#shouldSaveBeforeTransition');
        expect(element).toHaveTextContent(/false/i);
    });

    test('Logged in user who is NOT owner and HAS changed project should NOT save before transition', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                projectChanged
                canSave={false}
                store={store}
            />
        );

        const element = container.querySelector('#shouldSaveBeforeTransition');
        expect(element).toHaveTextContent(/false/i);
    });

    test('Logged in user who is NOT owner and has NOT changed project should NOT save before transition', () => {
        const WrappedComponent = MenuBarHOC(Component);
        const {container} = render(
            <WrappedComponent
                canSave={false}
                projectChanged={false}
                store={store}
            />
        );

        const element = container.querySelector('#shouldSaveBeforeTransition');
        expect(element).toHaveTextContent(/false/i);
    });


    // === Smalruby: Start of lessons button ===
    // Issue #1498: the welcome balloon overlaps the lesson task bar, so the menu
    // bar is told whether a challenge is open (it comes back once it is closed).
    describe('first-time balloons and lesson mode', () => {
        const renderWith = lessonMode => {
            const PropsProbe = jest.fn(() => null);
            const WrappedComponent = MenuBarHOC(PropsProbe);
            render(
                <WrappedComponent
                    store={mockStore({
                        scratchGui: {
                            projectChanged: false,
                            tutorialOnboarding: tutorialOnboardingInitialState,
                            lessonMode
                        }
                    })}
                />
            );
            return PropsProbe.mock.calls[PropsProbe.mock.calls.length - 1][0];
        };

        test('reports that lesson mode is off outside a challenge', () => {
            const props = renderWith(lessonModeInitialState);
            expect(props.lessonModeActive).toBe(false);
        });

        test('reports that lesson mode is on while a challenge is open', () => {
            const props = renderWith({...lessonModeInitialState, challengeId: 'blocks-l1-if'});
            expect(props.lessonModeActive).toBe(true);
        });

        // Issue #1512: the "Start a lesson!" balloon is gone, so the HOC no longer supplies it
        test('does not supply a lessons balloon flag', () => {
            const props = renderWith(lessonModeInitialState);
            expect(props).not.toHaveProperty('showLessonsTooltip');
        });
    });
    // === Smalruby: End of lessons button ===
});
