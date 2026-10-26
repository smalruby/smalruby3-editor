/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import StudentPeerViewButton from '../../../src/components/classroom-modal/student-peer-view-button.jsx';
import classroomReducer, {
    openClassroomModal,
    setStudentPeerView,
    setSubmissionStatus,
} from '../../../src/reducers/classroom.js';

const renderButton = ({ peerView, submitted }) => {
    const store = createStore(combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer }) }));
    store.dispatch(openClassroomModal());
    if (peerView) store.dispatch(setStudentPeerView(peerView));
    if (submitted) store.dispatch(setSubmissionStatus('submitted', '2026-10-26T00:00:00Z'));
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <StudentPeerViewButton />
            </IntlProvider>
        </Provider>,
    );
    return store;
};

describe('StudentPeerViewButton (#1210)', () => {
    test('should not be shown when peer view is off', () => {
        renderButton({ peerView: 'none', submitted: true });
        expect(screen.queryByTestId('classroom-peer-view-button')).toBeNull();
        expect(screen.queryByTestId('classroom-peer-view-locked')).toBeNull();
    });

    test('should say "submit to see" with after-submit and no submission', () => {
        renderButton({ peerView: 'afterSubmit', submitted: false });
        expect(screen.getByTestId('classroom-peer-view-locked')).toBeInTheDocument();
        expect(screen.queryByTestId('classroom-peer-view-button')).toBeNull();
    });

    test('should open the panel and close the class screen', () => {
        const store = renderButton({ peerView: 'afterSubmit', submitted: true });
        fireEvent.click(screen.getByTestId('classroom-peer-view-button'));
        const state = store.getState().scratchGui.classroom;
        expect(state.studentPeerPanelOpen).toBe(true);
        expect(state.modalVisible).toBe(false);
    });

    test('should be offered while the setting is not known yet', () => {
        renderButton({ peerView: null, submitted: false });
        expect(screen.getByTestId('classroom-peer-view-button')).toBeInTheDocument();
    });
});
