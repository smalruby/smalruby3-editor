import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent } from '@testing-library/react';
import SmalrubotS1ErrorStep from '../../../src/components/connection-modal/smalrubot-s1-error-step.jsx';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

const defaultProps = (overrides = {}) => ({
    onRetry: jest.fn(),
    onBackToInitial: jest.fn(),
    ...overrides,
});

describe('SmalrubotS1ErrorStep component', () => {
    test('renders error message', () => {
        const { container } = renderWithIntl(<SmalrubotS1ErrorStep {...defaultProps()} />);
        // Should mention error/connection failure
        const text = container.textContent.toLowerCase();
        expect(text.includes('error') || text.includes('failed') || text.includes('try')).toBe(true);
    });

    test('calls onRetry when retry button is clicked', () => {
        const onRetry = jest.fn();
        const { getByTestId } = renderWithIntl(
            <SmalrubotS1ErrorStep {...defaultProps({ onRetry })} />,
        );
        fireEvent.click(getByTestId('smalrubot-s1-error-retry'));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test('calls onBackToInitial when back button is clicked', () => {
        const onBackToInitial = jest.fn();
        const { getByTestId } = renderWithIntl(
            <SmalrubotS1ErrorStep {...defaultProps({ onBackToInitial })} />,
        );
        fireEvent.click(getByTestId('smalrubot-s1-error-back'));
        expect(onBackToInitial).toHaveBeenCalledTimes(1);
    });
});
