/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import React from 'react';
import ResponsiveGui from '../../../src/lib/responsive-gui.jsx';

// Mock GUI / MobileGui as cheap stand-ins so we don't need the full Redux + VM tree.
jest.mock('../../../src/containers/gui.jsx', () => {
    const MockGui = (props) => <div data-testid="mock-gui" data-prop={props.marker || ''} />;
    return MockGui;
});
jest.mock('../../../src/components/mobile-gui/mobile-gui.jsx', () => {
    const MockMobileGui = (props) => <div data-testid="mock-mobile-gui" data-prop={props.marker || ''} />;
    return MockMobileGui;
});

// Mock the matchMedia hook so we control narrow-screen state without resetting modules.
const mockUseIsNarrowScreen = jest.fn();
jest.mock('../../../src/lib/use-is-narrow-screen.js', () => ({
    __esModule: true,
    default: () => mockUseIsNarrowScreen(),
}));

beforeEach(() => {
    mockUseIsNarrowScreen.mockReset();
});

describe('ResponsiveGui', () => {
    test('renders <GUI> on a wide viewport', () => {
        mockUseIsNarrowScreen.mockReturnValue(false);
        const { queryByTestId } = render(<ResponsiveGui marker="X" />);
        expect(queryByTestId('mock-gui')).toBeInTheDocument();
        expect(queryByTestId('mock-mobile-gui')).not.toBeInTheDocument();
    });

    test('renders <MobileGui> on a narrow viewport', () => {
        mockUseIsNarrowScreen.mockReturnValue(true);
        const { queryByTestId } = render(<ResponsiveGui marker="X" />);
        expect(queryByTestId('mock-mobile-gui')).toBeInTheDocument();
        expect(queryByTestId('mock-gui')).not.toBeInTheDocument();
    });

    test('forwards props to the chosen child (narrow)', () => {
        mockUseIsNarrowScreen.mockReturnValue(true);
        const { getByTestId } = render(<ResponsiveGui marker="passed-through" />);
        expect(getByTestId('mock-mobile-gui')).toHaveAttribute('data-prop', 'passed-through');
    });

    test('forwards props to the chosen child (wide)', () => {
        mockUseIsNarrowScreen.mockReturnValue(false);
        const { getByTestId } = render(<ResponsiveGui marker="passed-through" />);
        expect(getByTestId('mock-gui')).toHaveAttribute('data-prop', 'passed-through');
    });

    test('does not dispatch a resize event on the initial render', () => {
        mockUseIsNarrowScreen.mockReturnValue(true);
        const resizeSpy = jest.fn();
        window.addEventListener('resize', resizeSpy);
        try {
            render(<ResponsiveGui marker="X" />);
            expect(resizeSpy).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener('resize', resizeSpy);
        }
    });

    test('dispatches a resize event when toggling between narrow and wide viewports', () => {
        mockUseIsNarrowScreen.mockReturnValue(true);
        const resizeSpy = jest.fn();
        window.addEventListener('resize', resizeSpy);
        try {
            const { rerender } = render(<ResponsiveGui marker="X" />);
            // initial mount should not trigger resize
            expect(resizeSpy).not.toHaveBeenCalled();
            // switch to wide → MobileGui unmounts, GUI mounts
            mockUseIsNarrowScreen.mockReturnValue(false);
            act(() => {
                rerender(<ResponsiveGui marker="X" />);
            });
            expect(resizeSpy).toHaveBeenCalledTimes(1);
            // switch back to narrow
            mockUseIsNarrowScreen.mockReturnValue(true);
            act(() => {
                rerender(<ResponsiveGui marker="X" />);
            });
            expect(resizeSpy).toHaveBeenCalledTimes(2);
        } finally {
            window.removeEventListener('resize', resizeSpy);
        }
    });
});
