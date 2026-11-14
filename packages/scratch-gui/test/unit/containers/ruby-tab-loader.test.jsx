import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import RubyTabLoader from '../../../src/containers/ruby-tab-loader.jsx';

const mockSeen = [];
const MockRubyTab = ({ isVisible }) => {
    mockSeen.push(isVisible);
    return <div data-testid="mock-ruby-tab">{isVisible ? 'visible' : 'hidden'}</div>;
};

const mockState = { bundle: null, load: null, idle: [] };
jest.mock('../../../src/lib/ruby-bundle', () => ({
    getRubyBundle: () => mockState.bundle,
    loadRubyBundle: () => mockState.load(),
    whenIdle: (callback) => mockState.idle.push(callback),
}));

const bundle = () => ({ RubyTab: MockRubyTab, loadPrism: jest.fn(() => Promise.resolve()) });

const renderLoader = (props) =>
    render(
        <IntlProvider locale="en">
            <RubyTabLoader {...props} />
        </IntlProvider>,
    );

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

describe('RubyTabLoader', () => {
    beforeEach(() => {
        mockSeen.length = 0;
        mockState.bundle = null;
        mockState.idle = [];
        mockState.load = jest.fn();
    });

    test('should read the bundle in the idle time while the tab is hidden', async () => {
        const loaded = bundle();
        mockState.load.mockResolvedValue(loaded);
        const { container } = renderLoader({ isVisible: false });
        expect(container).toBeEmptyDOMElement();
        expect(mockState.load).not.toHaveBeenCalled();

        await act(async () => {
            mockState.idle.shift()();
        });
        await flush();
        expect(mockState.load).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('mock-ruby-tab')).toHaveTextContent('hidden');
        // prism.wasm is read in the next idle moment
        mockState.idle.forEach((callback) => callback());
        expect(loaded.loadPrism).toHaveBeenCalled();
    });

    test('should draw the tab hidden first and then visible when it was opened before the bundle', async () => {
        mockState.load.mockResolvedValue(bundle());
        renderLoader({ isVisible: true });
        // opened first: read at once, not in the idle time
        expect(mockState.load).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('ruby-tab-loader-loading')).toBeInTheDocument();
        await flush();
        expect(screen.getByTestId('mock-ruby-tab')).toHaveTextContent('visible');
        expect(mockSeen[0]).toBe(false);
        expect(mockSeen[mockSeen.length - 1]).toBe(true);
    });

    test('should show the error with retry and reload when the bundle could not be read', async () => {
        const reloadPage = jest.fn();
        mockState.load.mockRejectedValueOnce(new Error('ChunkLoadError')).mockResolvedValueOnce(bundle());
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            renderLoader({ isVisible: true, reloadPage });
            await flush();
            expect(screen.getByTestId('ruby-tab-loader-error')).toBeInTheDocument();

            fireEvent.click(screen.getByTestId('ruby-tab-loader-reload'));
            expect(reloadPage).toHaveBeenCalled();

            fireEvent.click(screen.getByTestId('ruby-tab-loader-retry'));
            await flush();
            expect(mockState.load).toHaveBeenCalledTimes(2);
            expect(screen.getByTestId('mock-ruby-tab')).toHaveTextContent('visible');
        } finally {
            error.mockRestore();
        }
    });

    test('should draw the tab at once when the bundle is already read', async () => {
        mockState.bundle = bundle();
        renderLoader({ isVisible: false });
        expect(screen.getByTestId('mock-ruby-tab')).toHaveTextContent('hidden');
        expect(mockState.load).not.toHaveBeenCalled();
    });
});
