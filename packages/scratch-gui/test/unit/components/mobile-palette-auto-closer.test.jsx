/* eslint-env jest */
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { MobilePaletteAutoCloserComponent } from '../../../src/components/mobile-palette-auto-closer/mobile-palette-auto-closer.jsx';

describe('MobilePaletteAutoCloser', () => {
    test('calls onHide on mount', () => {
        const onHide = jest.fn();
        render(<MobilePaletteAutoCloserComponent onHide={onHide} />);
        expect(onHide).toHaveBeenCalledTimes(1);
    });

    test('calls onHide only once even on re-render', () => {
        const onHide = jest.fn();
        const { rerender } = render(<MobilePaletteAutoCloserComponent onHide={onHide} />);
        rerender(<MobilePaletteAutoCloserComponent onHide={onHide} />);
        expect(onHide).toHaveBeenCalledTimes(1);
    });
});
