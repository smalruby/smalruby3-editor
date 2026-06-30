/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
// eslint-disable-next-line import/first
import { KoshienTestModal } from '../../../src/components/koshien-test-modal/koshien-test-modal.jsx';

// Avoid react-modal portal/store complexity: render the modal body inline.
jest.mock('../../../src/containers/modal.jsx', () => {
    const FakeModal = ({ children, headerActions }) => (
        <div data-testid="koshien-test-modal">
            {headerActions}
            {children}
        </div>
    );
    return FakeModal;
});

// generatePreviewCode is driven per-test via this mock so we can simulate a
// short AI (URL path) vs. a large AI (download fallback).
const mockGeneratePreviewCode = jest.fn();
jest.mock('../../../src/lib/ruby-script-preview', () => ({
    generatePreviewCode: (...args) => mockGeneratePreviewCode(...args),
}));

const mockDownloadBlob = jest.fn();
jest.mock('../../../src/lib/download-blob', () => ({
    __esModule: true,
    default: (...args) => mockDownloadBlob(...args),
}));

const renderModal = (props) =>
    render(
        <IntlProvider locale="en">
            <KoshienTestModal
                intl={{ formatMessage: (m) => m.defaultMessage }}
                onRequestClose={jest.fn()}
                vm={{ editingTarget: { getName: () => 'Sprite1' } }}
                rubyVersion="2"
                {...props}
            />
        </IntlProvider>,
    );

describe('KoshienTestModal', () => {
    beforeEach(() => {
        mockGeneratePreviewCode.mockReset();
        mockDownloadBlob.mockReset();
    });

    test('renders the viewer iframe with a short AI in the URL and no fallback banner', () => {
        mockGeneratePreviewCode.mockReturnValue('koshien.move_to("1:1")\n');
        const { getByTitle, queryByTestId } = renderModal();
        const iframe = getByTitle('Test AI');
        expect(iframe.getAttribute('src')).toContain('player1=');
        expect(queryByTestId('koshien-test-too-long-banner')).toBeNull();
    });

    test('a large AI shows the download fallback banner and loads the viewer without the AI', () => {
        mockGeneratePreviewCode.mockReturnValue('koshien.move_to("1:1")\n'.repeat(600));
        const { getByTitle, getByTestId } = renderModal();
        const iframe = getByTitle('Test AI');
        expect(iframe.getAttribute('src')).not.toContain('player1=');
        expect(getByTestId('koshien-test-too-long-banner')).toBeInTheDocument();
    });

    test('the download button writes the AI as a .rb file named after the sprite', () => {
        const bigCode = 'koshien.move_to("1:1")\n'.repeat(600);
        mockGeneratePreviewCode.mockReturnValue(bigCode);
        const { getByTestId } = renderModal();
        fireEvent.click(getByTestId('koshien-test-download-ai'));
        expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
        const [filename, blob] = mockDownloadBlob.mock.calls[0];
        expect(filename).toBe('Sprite1.rb');
        expect(blob).toBeInstanceOf(Blob);
    });
});
