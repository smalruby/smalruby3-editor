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

// Mock getUrlParams so tests can swap the mobile_gui flag without resetting modules
// (which would create duplicate React instances and break hooks).
const mockGetUrlParams = jest.fn();
jest.mock('../../../src/lib/url-params.js', () => ({
    __esModule: true,
    default: () => mockGetUrlParams(),
    getUrlParams: () => mockGetUrlParams(),
    clearClasscode: jest.fn(),
}));

// Mock the matchMedia hook similarly so we control narrow-screen state.
const mockUseIsNarrowScreen = jest.fn();
jest.mock('../../../src/lib/use-is-narrow-screen.js', () => ({
    __esModule: true,
    default: () => mockUseIsNarrowScreen(),
}));

const setEnv = ({ flag, narrow }) => {
    mockGetUrlParams.mockReturnValue({ mobileGui: flag });
    mockUseIsNarrowScreen.mockReturnValue(narrow);
};

beforeEach(() => {
    mockGetUrlParams.mockReset();
    mockUseIsNarrowScreen.mockReset();
});

describe('ResponsiveGui', () => {
    test('renders <GUI> by default (no flag, wide viewport)', () => {
        setEnv({ flag: false, narrow: false });
        const { queryByTestId } = render(<ResponsiveGui marker="X" />);
        expect(queryByTestId('mock-gui')).toBeInTheDocument();
        expect(queryByTestId('mock-mobile-gui')).not.toBeInTheDocument();
    });

    test('renders <GUI> when flag is set but viewport is wide', () => {
        setEnv({ flag: true, narrow: false });
        const { queryByTestId } = render(<ResponsiveGui marker="X" />);
        expect(queryByTestId('mock-gui')).toBeInTheDocument();
        expect(queryByTestId('mock-mobile-gui')).not.toBeInTheDocument();
    });

    test('renders <GUI> when viewport is narrow but flag is missing', () => {
        setEnv({ flag: false, narrow: true });
        const { queryByTestId } = render(<ResponsiveGui marker="X" />);
        expect(queryByTestId('mock-gui')).toBeInTheDocument();
        expect(queryByTestId('mock-mobile-gui')).not.toBeInTheDocument();
    });

    test('renders <MobileGui> only when flag + narrow viewport both apply', () => {
        setEnv({ flag: true, narrow: true });
        const { queryByTestId } = render(<ResponsiveGui marker="X" />);
        expect(queryByTestId('mock-mobile-gui')).toBeInTheDocument();
        expect(queryByTestId('mock-gui')).not.toBeInTheDocument();
    });

    test('forwards props to the chosen child', () => {
        setEnv({ flag: true, narrow: true });
        const { getByTestId } = render(<ResponsiveGui marker="passed-through" />);
        expect(getByTestId('mock-mobile-gui')).toHaveAttribute('data-prop', 'passed-through');
    });
});
