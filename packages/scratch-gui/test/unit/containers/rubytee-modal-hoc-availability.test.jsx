import VM from '@smalruby/scratch-vm';
import { fireEvent, render, screen } from '@testing-library/react';
import PropTypes from 'prop-types';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import RubyteeModalHOC from '../../../src/containers/rubytee-modal-hoc.jsx';
import { classroomInitialState } from '../../../src/reducers/classroom';

// Stand-in for the Ruby tab: shows the AI button only when it gets a handler,
// as the Ruby toolbar does.
const Tab = ({ onOpenRubyteeModal }) =>
    onOpenRubyteeModal ? (
        <button data-testid="ruby-toolbar-rubytee" onClick={onOpenRubyteeModal}>
            {'AI'}
        </button>
    ) : (
        <div data-testid="no-rubytee" />
    );
Tab.propTypes = { onOpenRubyteeModal: PropTypes.func };

const Wrapped = RubyteeModalHOC(Tab);
const mockStore = configureStore();

const renderWith = (classroom) => {
    const store = mockStore({ scratchGui: { classroom: { ...classroomInitialState, ...classroom } } });
    return render(
        <Provider store={store}>
            <IntlProvider locale="en" messages={{}}>
                <Wrapped vm={new VM()} />
            </IntlProvider>
        </Provider>,
    );
};

const student = { role: 'student', classroomId: 'class-123', seatNumber: 5, sessionToken: 'token-abc' };

describe('RubyteeModalHOC availability (#1278)', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('does not show the AI button outside a class', () => {
        renderWith({});
        expect(screen.queryByTestId('ruby-toolbar-rubytee')).toBeNull();
    });

    test('does not show the AI button in a class that has Rubytee off', () => {
        renderWith({ ...student, rubyteeEnabled: false });
        expect(screen.queryByTestId('ruby-toolbar-rubytee')).toBeNull();
    });

    test('does not show the AI button to a teacher who has a class open', () => {
        renderWith({ teacherSelection: { classroomId: 'class-123', joinCode: 'ABC234' }, rubyteeEnabled: true });
        expect(screen.queryByTestId('ruby-toolbar-rubytee')).toBeNull();
    });

    test('shows the AI button in a class that has Rubytee on, and it opens Rubytee', () => {
        renderWith({ ...student, rubyteeEnabled: true });
        const button = screen.getByTestId('ruby-toolbar-rubytee');
        fireEvent.click(button);
        // No consent yet, so the consent dialog comes first.
        expect(screen.getByText(/Before using Rubytee/)).toBeTruthy();
    });
});
