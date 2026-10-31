import VM from '@smalruby/scratch-vm';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const tree = (classroom, vm) => (
    <Provider store={mockStore({ scratchGui: { classroom: { ...classroomInitialState, ...classroom } } })}>
        <IntlProvider locale="en" messages={{}}>
            <Wrapped vm={vm} />
        </IntlProvider>
    </Provider>
);

const renderWith = (classroom) => render(tree(classroom, new VM()));

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

    test("forgets the previous student's chat when another student joins in the same tab", async () => {
        window.localStorage.setItem('smalruby:rubyteeConsent', 'true');
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ text: 'move(10)', outputTokens: 1 }),
        });
        const vm = new VM();
        const { rerender } = render(tree({ ...student, rubyteeEnabled: true }, vm));
        fireEvent.click(screen.getByTestId('ruby-toolbar-rubytee'));
        fireEvent.change(screen.getByTestId('rubytee-modal-input'), { target: { value: 'make the cat move' } });
        fireEvent.click(screen.getByTestId('rubytee-modal-send'));
        await waitFor(() => expect(screen.getAllByTestId('rubytee-modal-message-model')).toHaveLength(1));

        await act(async () => {
            rerender(tree({ ...student, seatNumber: 6, sessionToken: 'token-def', rubyteeEnabled: true }, vm));
        });
        expect(screen.queryAllByTestId('rubytee-modal-message-user')).toHaveLength(0);

        fireEvent.change(screen.getByTestId('rubytee-modal-input'), { target: { value: 'make the cat jump' } });
        fireEvent.click(screen.getByTestId('rubytee-modal-send'));
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
        const body = JSON.parse(global.fetch.mock.calls[1][1].body);
        expect(body.history).toEqual([]);
        expect(body.seat).toBe('6');
    });
});
