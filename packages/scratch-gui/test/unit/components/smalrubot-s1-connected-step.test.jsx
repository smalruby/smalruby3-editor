import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent } from '@testing-library/react';
import SmalrubotS1ConnectedStep from '../../../src/components/connection-modal/smalrubot-s1-connected-step.jsx';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

const defaultProps = (overrides = {}) => ({
    onClose: jest.fn(),
    onDisconnect: jest.fn(),
    ...overrides,
});

describe('SmalrubotS1ConnectedStep component', () => {
    test('renders connected message', () => {
        const { container } = renderWithIntl(<SmalrubotS1ConnectedStep {...defaultProps()} />);
        expect(container.textContent.toLowerCase()).toContain('connected');
    });

    test('calls onClose when explicit close button is clicked', () => {
        const onClose = jest.fn();
        const { getByTestId } = renderWithIntl(
            <SmalrubotS1ConnectedStep {...defaultProps({ onClose })} />,
        );
        fireEvent.click(getByTestId('smalrubot-s1-connected-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('calls onDisconnect when disconnect button is clicked', () => {
        const onDisconnect = jest.fn();
        const { getByTestId } = renderWithIntl(
            <SmalrubotS1ConnectedStep {...defaultProps({ onDisconnect })} />,
        );
        fireEvent.click(getByTestId('smalrubot-s1-connected-disconnect'));
        expect(onDisconnect).toHaveBeenCalledTimes(1);
    });
});
