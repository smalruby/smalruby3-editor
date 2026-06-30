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

// generateProjectCode is driven per-test via this mock so we can simulate a
// short AI (URL path) vs. a large AI (download fallback). It generates the
// whole project (all targets), not just the editing target.
const mockGenerateProjectCode = jest.fn();
jest.mock('../../../src/lib/ruby-script-preview', () => ({
    generateProjectCode: (...args) => mockGenerateProjectCode(...args),
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
                vm={{ runtime: { targets: [] }, editingTarget: { getName: () => 'Sprite1' } }}
                rubyVersion="2"
                stage={{ id: 'stage' }}
                sprites={{ sprite1: { id: 'sprite1', order: 0 } }}
                rubyCode={{ modified: false, code: '', target: { id: 'sprite1' } }}
                {...props}
            />
        </IntlProvider>,
    );

describe('KoshienTestModal', () => {
    beforeEach(() => {
        mockGenerateProjectCode.mockReset();
        mockDownloadBlob.mockReset();
    });

    test('generates the whole-project AI code (all targets), not just the editing target', () => {
        mockGenerateProjectCode.mockReturnValue('koshien.move_to("1:1")\n');
        renderModal();
        expect(mockGenerateProjectCode).toHaveBeenCalledTimes(1);
        const [vmArg, params] = mockGenerateProjectCode.mock.calls[0];
        expect(vmArg).toHaveProperty('runtime');
        expect(params).toMatchObject({
            stage: { id: 'stage' },
            sprites: { sprite1: { id: 'sprite1', order: 0 } },
            version: '2',
        });
    });

    test('renders the viewer iframe with a short AI in the URL and no fallback banner', () => {
        mockGenerateProjectCode.mockReturnValue('koshien.move_to("1:1")\n');
        const { getByTitle, queryByTestId } = renderModal();
        const iframe = getByTitle('Test AI');
        expect(iframe.getAttribute('src')).toContain('player1=');
        expect(queryByTestId('koshien-test-too-long-banner')).toBeNull();
    });

    test('a large AI shows the download fallback banner and loads the viewer without the AI', () => {
        mockGenerateProjectCode.mockReturnValue('koshien.move_to("1:1")\n'.repeat(600));
        const { getByTitle, getByTestId } = renderModal();
        const iframe = getByTitle('Test AI');
        expect(iframe.getAttribute('src')).not.toContain('player1=');
        expect(getByTestId('koshien-test-too-long-banner')).toBeInTheDocument();
    });

    test('the download button writes the AI as a .rb file named after the sprite', () => {
        const bigCode = 'koshien.move_to("1:1")\n'.repeat(600);
        mockGenerateProjectCode.mockReturnValue(bigCode);
        const { getByTestId } = renderModal();
        fireEvent.click(getByTestId('koshien-test-download-ai'));
        expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
        const [filename, blob] = mockDownloadBlob.mock.calls[0];
        expect(filename).toBe('Sprite1.rb');
        expect(blob).toBeInstanceOf(Blob);
    });

    test('falls back to the default AI (no banner) when generation throws', () => {
        mockGenerateProjectCode.mockImplementation(() => {
            throw new Error('boom');
        });
        const { getByTitle, queryByTestId } = renderModal();
        const iframe = getByTitle('Test AI');
        expect(iframe.getAttribute('src')).not.toContain('player1=');
        expect(queryByTestId('koshien-test-too-long-banner')).toBeNull();
    });
});
