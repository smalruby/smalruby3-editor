/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomTutorial from '../../../src/components/classroom-tutorial/classroom-tutorial.jsx';
import { markClassroomTutorialSeen } from '../../../src/reducers/classroom-tutorial.js';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

const mockStore = configureStore();
const storeWith = (seen) => mockStore({ scratchGui: { classroomTutorial: { seen } } });

describe('ClassroomTutorial', () => {
    test('shows the card with an OK button while the tutorial is not seen', () => {
        const store = storeWith({ classCreation: false });
        const { getByTestId } = renderWithIntl(
            <Provider store={store}>
                <ClassroomTutorial name="classCreation">hello</ClassroomTutorial>
            </Provider>,
        );
        expect(getByTestId('classroom-tutorial-classCreation')).toHaveTextContent('hello');
        const ok = getByTestId('classroom-tutorial-dismiss-classCreation');
        expect(ok).toHaveAttribute('type', 'button');
        expect(ok).toHaveTextContent('OK');
        // OK は吹き出しの共通の塗りのボタン（components/balloon）
        expect(ok).toHaveAttribute('data-balloon-primary', 'true');
    });

    test('marks the tutorial as seen when OK is pressed', () => {
        const store = storeWith({ classCreation: false });
        const { getByTestId } = renderWithIntl(
            <Provider store={store}>
                <ClassroomTutorial name="classCreation">hello</ClassroomTutorial>
            </Provider>,
        );
        fireEvent.click(getByTestId('classroom-tutorial-dismiss-classCreation'));
        expect(store.getActions()).toEqual([markClassroomTutorialSeen('classCreation')]);
    });

    test('renders nothing once the tutorial is seen', () => {
        const store = storeWith({ classCreation: true });
        const { queryByTestId } = renderWithIntl(
            <Provider store={store}>
                <ClassroomTutorial name="classCreation">hello</ClassroomTutorial>
            </Provider>,
        );
        expect(queryByTestId('classroom-tutorial-classCreation')).toBeNull();
    });
});
