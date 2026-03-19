import React from 'react';
import {render, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom';
import {IntlProvider} from 'react-intl';
import ScanningStep from '../../../src/components/connection-modal/scanning-step.jsx';

const renderWithIntl = (ui, locale = 'en') => render(
    <IntlProvider locale={locale}>
        {ui}
    </IntlProvider>
);

const HIRAGANA_CHARS = ['い', 'し', 'か', 'た', 'う', 'ん', 'て', 'と',
    'の', 'つ', 'は', 'こ', 'に', 'な', 'く', 'き'];

describe('ScanningStep hiragana name search', () => {
    const defaultProps = {
        scanning: true,
        peripheralList: [],
        extensionId: 'meshV2',
        hiraganaInput: '',
        nameSearching: false,
        nameSearchResults: [],
        onHiraganaInput: jest.fn(),
        onHiraganaClear: jest.fn(),
        onConnecting: jest.fn(),
        onRefresh: jest.fn()
    };

    test('renders 16 hiragana buttons for meshV2 extension', () => {
        const {getAllByRole} = renderWithIntl(
            <ScanningStep {...defaultProps} />
        );

        // All 16 hiragana buttons + Refresh button + (no Back because onBack not provided)
        const allButtons = getAllByRole('button');
        const hiraganaButtons = allButtons.filter(btn =>
            HIRAGANA_CHARS.includes(btn.textContent)
        );
        expect(hiraganaButtons.length).toBe(16);
    });

    test('does not render hiragana buttons for non-meshV2 extension', () => {
        const {getAllByRole} = renderWithIntl(
            <ScanningStep
                {...defaultProps}
                extensionId="microbit"
                onHiraganaInput={undefined}
            />
        );

        const allButtons = getAllByRole('button');
        const hiraganaButtons = allButtons.filter(btn =>
            HIRAGANA_CHARS.includes(btn.textContent)
        );
        expect(hiraganaButtons.length).toBe(0);
    });

    test('calls onHiraganaInput with correct character when button is clicked', () => {
        const onHiraganaInput = jest.fn();
        const {getAllByRole} = renderWithIntl(
            <ScanningStep
                {...defaultProps}
                onHiraganaInput={onHiraganaInput}
            />
        );

        const allButtons = getAllByRole('button');
        const shiButton = allButtons.find(btn => btn.textContent === 'し');
        fireEvent.click(shiButton);
        expect(onHiraganaInput).toHaveBeenCalledWith('し');
    });

    test('disables hiragana buttons when 6 characters are entered', () => {
        const {getAllByRole} = renderWithIntl(
            <ScanningStep
                {...defaultProps}
                hiraganaInput={'しかたうんて'}
            />
        );

        const allButtons = getAllByRole('button');
        const hiraganaButtons = allButtons.filter(btn =>
            HIRAGANA_CHARS.includes(btn.textContent)
        );
        hiraganaButtons.forEach(button => {
            expect(button).toBeDisabled();
        });
    });

    test('shows entered hiragana text when input is not empty', () => {
        const {getByText} = renderWithIntl(
            <ScanningStep
                {...defaultProps}
                hiraganaInput={'しか'}
            />
        );

        expect(getByText('しか')).toBeInTheDocument();
    });

    test('shows clear button and calls onHiraganaClear when clicked', () => {
        const onHiraganaClear = jest.fn();
        const {getByText} = renderWithIntl(
            <ScanningStep
                {...defaultProps}
                hiraganaInput={'しか'}
                onHiraganaClear={onHiraganaClear}
            />
        );

        const clearButton = getByText('✕');
        fireEvent.click(clearButton);
        expect(onHiraganaClear).toHaveBeenCalled();
    });

    test('shows no results message when search returns empty after 6 chars', () => {
        const {getByText} = renderWithIntl(
            <ScanningStep
                {...defaultProps}
                hiraganaInput={'しかたうんて'}
                nameSearchResults={[]}
            />
        );

        expect(getByText('No groups found')).toBeInTheDocument();
    });
});
