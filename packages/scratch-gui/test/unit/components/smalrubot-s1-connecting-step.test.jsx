import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent } from '@testing-library/react';
import SmalrubotS1ConnectingStep from '../../../src/components/connection-modal/smalrubot-s1-connecting-step.jsx';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

const defaultProps = (overrides = {}) => ({
    onBackToInitial: jest.fn(),
    ...overrides,
});

describe('SmalrubotS1ConnectingStep component', () => {
    test('renders connecting indicator', () => {
        const { container } = renderWithIntl(<SmalrubotS1ConnectingStep {...defaultProps()} />);
        expect(container.textContent.toLowerCase()).toContain('connecting');
    });

    test('calls onBackToInitial when back button is clicked', () => {
        const onBackToInitial = jest.fn();
        const { getByTestId } = renderWithIntl(
            <SmalrubotS1ConnectingStep {...defaultProps({ onBackToInitial })} />,
        );
        fireEvent.click(getByTestId('smalrubot-s1-connecting-back'));
        expect(onBackToInitial).toHaveBeenCalledTimes(1);
    });
});
