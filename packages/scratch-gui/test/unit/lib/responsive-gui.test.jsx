/* eslint-env jest */
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import ResponsiveGui from '../../../src/lib/responsive-gui.jsx';

// Mock GUI / MobileGui as cheap stand-ins so we don't need the full Redux + VM tree.
jest.mock('../../../src/containers/gui.jsx', () => {
    const MockGui = props => <div data-testid="mock-gui" data-prop={props.marker || ''} />;
    return MockGui;
});
jest.mock('../../../src/components/mobile-gui/mobile-gui.jsx', () => {
    const MockMobileGui = props => <div data-testid="mock-mobile-gui" data-prop={props.marker || ''} />;
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
});
