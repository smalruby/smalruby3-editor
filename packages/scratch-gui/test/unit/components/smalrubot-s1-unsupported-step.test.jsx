import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent } from '@testing-library/react';
import SmalrubotS1UnsupportedStep from '../../../src/components/connection-modal/smalrubot-s1-unsupported-step.jsx';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

const defaultProps = (overrides = {}) => ({
    onHelp: jest.fn(),
    ...overrides,
});

describe('SmalrubotS1UnsupportedStep component', () => {
    test('renders the unsupported message', () => {
        const { container } = renderWithIntl(<SmalrubotS1UnsupportedStep {...defaultProps()} />);
        // The exact wording is in the locale files; we verify a key fragment is rendered
        expect(container.textContent.toLowerCase()).toContain('webserial');
    });

    test('calls onHelp when help button is clicked', () => {
        const onHelp = jest.fn();
        const { getByTestId } = renderWithIntl(<SmalrubotS1UnsupportedStep {...defaultProps({ onHelp })} />);
        fireEvent.click(getByTestId('smalrubot-s1-unsupported-help'));
        expect(onHelp).toHaveBeenCalledTimes(1);
    });

    test('does not render help button when onHelp is not provided', () => {
        const { queryByTestId } = renderWithIntl(<SmalrubotS1UnsupportedStep onHelp={undefined} />);
        expect(queryByTestId('smalrubot-s1-unsupported-help')).toBeNull();
    });
});
