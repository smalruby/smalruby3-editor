/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import MeshSelfSensorNotice from '../../../src/components/mesh-self-sensor-notice/mesh-self-sensor-notice.jsx';

const renderNotice = (props) =>
    render(
        <IntlProvider locale="en">
            <MeshSelfSensorNotice onDismiss={jest.fn()} visible {...props} />
        </IntlProvider>,
    );

describe('MeshSelfSensorNotice', () => {
    test('renders the banner with learn-more and dismiss when visible', () => {
        const { getByTestId } = renderNotice();
        expect(getByTestId('mesh-self-sensor-notice')).toBeInTheDocument();
        expect(getByTestId('mesh-self-sensor-notice-learn-more')).toBeInTheDocument();
        expect(getByTestId('mesh-self-sensor-notice-dismiss')).toBeInTheDocument();
    });

    test('renders nothing when not visible', () => {
        const { queryByTestId } = renderNotice({ visible: false });
        expect(queryByTestId('mesh-self-sensor-notice')).not.toBeInTheDocument();
    });

    test('dismiss button invokes onDismiss', () => {
        const onDismiss = jest.fn();
        const { getByTestId } = renderNotice({ onDismiss });
        fireEvent.click(getByTestId('mesh-self-sensor-notice-dismiss'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    test('learn-more opens the explanation page and invokes onLearnMore', () => {
        const onLearnMore = jest.fn();
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        const { getByTestId } = renderNotice({ onLearnMore });
        fireEvent.click(getByTestId('mesh-self-sensor-notice-learn-more'));
        expect(open).toHaveBeenCalledWith('mesh-self-sensor.html', '_blank', 'noopener,noreferrer');
        expect(onLearnMore).toHaveBeenCalledTimes(1);
        open.mockRestore();
    });
});
