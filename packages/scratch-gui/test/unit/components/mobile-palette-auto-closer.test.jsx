/* eslint-env jest */
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { MobilePaletteAutoCloserComponent } from '../../../src/components/mobile-palette-auto-closer/mobile-palette-auto-closer.jsx';

describe('MobilePaletteAutoCloser', () => {
    test('does NOT call onHide on mount (palette stays visible at startup)', () => {
        const onHide = jest.fn();
        render(<MobilePaletteAutoCloserComponent onHide={onHide} />);
        expect(onHide).not.toHaveBeenCalled();
    });

    test('renders nothing (no DOM output)', () => {
        const { container } = render(<MobilePaletteAutoCloserComponent onHide={() => {}} />);
        expect(container.firstChild).toBeNull();
    });
});
