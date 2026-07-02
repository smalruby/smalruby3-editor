/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import React from 'react';
import {
    DISPLAY_MODE_AUTO,
    DISPLAY_MODE_DESKTOP,
    DISPLAY_MODE_MOBILE,
} from '../../../src/lib/settings/display-mode/index.js';
import { persistDisplayMode } from '../../../src/lib/settings/display-mode/persistence.js';
import useDisplayMode from '../../../src/lib/use-display-mode.js';

const Probe = ({ onValue }) => {
    onValue(useDisplayMode());
    return null;
};

describe('useDisplayMode', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('returns auto when nothing is stored', () => {
        let observed = null;
        render(<Probe onValue={(v) => (observed = v)} />);
        expect(observed).toBe(DISPLAY_MODE_AUTO);
    });

    test('reflects the initial stored value', () => {
        persistDisplayMode(DISPLAY_MODE_DESKTOP);
        let observed = null;
        render(<Probe onValue={(v) => (observed = v)} />);
        expect(observed).toBe(DISPLAY_MODE_DESKTOP);
    });

    test('updates live when the mode changes', () => {
        const observations = [];
        render(<Probe onValue={(v) => observations.push(v)} />);
        expect(observations[observations.length - 1]).toBe(DISPLAY_MODE_AUTO);
        act(() => {
            persistDisplayMode(DISPLAY_MODE_MOBILE);
        });
        expect(observations[observations.length - 1]).toBe(DISPLAY_MODE_MOBILE);
    });
});
