import React from 'react';
import '@testing-library/jest-dom';
import ConnectedStep from '../../../src/components/connection-modal/connected-step.jsx';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

const defaultProps = (overrides = {}) => ({
    connectionIconURL: 'icon.png',
    onCancel: jest.fn(),
    onDisconnect: jest.fn(),
    ...overrides,
});

describe('ConnectedStep component', () => {
    test('shows default "Connected" message when connectedMessage prop is not provided', () => {
        const { container } = renderWithIntl(<ConnectedStep {...defaultProps()} />);
        expect(container.textContent).toContain('Connected');
    });

    test('shows custom connectedMessage when prop is provided', () => {
        const { container } = renderWithIntl(
            <ConnectedStep {...defaultProps()} connectedMessage="Registered Host Mesh [ABC]" />,
        );
        expect(container.textContent).toContain('Registered Host Mesh [ABC]');
        expect(container.textContent).not.toContain('Connected');
    });

    test('shows default "Connected" message when connectedMessage is empty string', () => {
        const { container } = renderWithIntl(<ConnectedStep {...defaultProps()} connectedMessage="" />);
        expect(container.textContent).toContain('Connected');
    });
});
