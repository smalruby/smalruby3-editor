/* eslint-env jest */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import { MobilePaletteToggleComponent } from '../../../src/components/mobile-palette-toggle/mobile-palette-toggle.jsx';

const baseProps = {
    paletteVisible: true,
    activeTabIndex: 0, // BLOCKS
    isFullScreen: false,
    onToggle: () => {},
    onAutoHide: () => {},
};

describe('MobilePaletteToggle', () => {
    test('renders the handle on the Code tab when not fullscreen', () => {
        const { getByTestId } = render(<MobilePaletteToggleComponent {...baseProps} />);
        expect(getByTestId('mobile-palette-toggle')).toBeInTheDocument();
    });

    test('renders nothing when not on the Code tab', () => {
        const { queryByTestId } = render(<MobilePaletteToggleComponent {...baseProps} activeTabIndex={3} />);
        expect(queryByTestId('mobile-palette-toggle')).not.toBeInTheDocument();
    });

    test('renders nothing in fullscreen mode', () => {
        const { queryByTestId } = render(<MobilePaletteToggleComponent {...baseProps} isFullScreen={true} />);
        expect(queryByTestId('mobile-palette-toggle')).not.toBeInTheDocument();
    });

    test('shows ◀ when palette is visible', () => {
        const { getByTestId } = render(<MobilePaletteToggleComponent {...baseProps} />);
        const btn = getByTestId('mobile-palette-toggle');
        expect(btn).toHaveAttribute('data-palette-visible', 'true');
        expect(btn.textContent).toBe('◀');
    });

    test('shows ▶ when palette is hidden', () => {
        const { getByTestId } = render(<MobilePaletteToggleComponent {...baseProps} paletteVisible={false} />);
        const btn = getByTestId('mobile-palette-toggle');
        expect(btn).toHaveAttribute('data-palette-visible', 'false');
        expect(btn.textContent).toBe('▶');
    });

    test('clicking the handle dispatches onToggle', () => {
        const onToggle = jest.fn();
        const { getByTestId } = render(<MobilePaletteToggleComponent {...baseProps} onToggle={onToggle} />);
        fireEvent.click(getByTestId('mobile-palette-toggle'));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    test('calls onAutoHide once on mount when visible (Code tab + not fullscreen)', () => {
        const onAutoHide = jest.fn();
        render(<MobilePaletteToggleComponent {...baseProps} onAutoHide={onAutoHide} />);
        expect(onAutoHide).toHaveBeenCalledTimes(1);
    });

    test('does NOT call onAutoHide on mount when not visible (e.g. Ruby tab)', () => {
        const onAutoHide = jest.fn();
        render(<MobilePaletteToggleComponent {...baseProps} activeTabIndex={3} onAutoHide={onAutoHide} />);
        expect(onAutoHide).not.toHaveBeenCalled();
    });
});
