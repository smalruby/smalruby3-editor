/* eslint-env jest */
import React from 'react';
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import useIsNarrowScreen from '../../../src/lib/use-is-narrow-screen.js';

const setMatchMedia = matches => {
    const listeners = new Set();
    const mql = {
        matches,
        media: '',
        onchange: null,
        addEventListener: (_event, listener) => listeners.add(listener),
        removeEventListener: (_event, listener) => listeners.delete(listener),
        addListener: listener => listeners.add(listener),
        removeListener: listener => listeners.delete(listener),
        dispatchEvent: () => false,
    };
    window.matchMedia = jest.fn(() => mql);
    return { mql, listeners };
};

const ProbeComponent = ({ onValue }) => {
    const value = useIsNarrowScreen();
    onValue(value);
    return null;
};

describe('useIsNarrowScreen', () => {
    test('returns true when matchMedia matches', () => {
        setMatchMedia(true);
        let observed = null;
        render(<ProbeComponent onValue={v => (observed = v)} />);
        expect(observed).toBe(true);
    });

    test('returns false when matchMedia does not match', () => {
        setMatchMedia(false);
        let observed = null;
        render(<ProbeComponent onValue={v => (observed = v)} />);
        expect(observed).toBe(false);
    });

    test('updates when viewport changes', () => {
        const { listeners } = setMatchMedia(false);
        const observations = [];
        render(<ProbeComponent onValue={v => observations.push(v)} />);
        expect(observations[observations.length - 1]).toBe(false);
        act(() => {
            listeners.forEach(listener => listener({ matches: true }));
        });
        expect(observations[observations.length - 1]).toBe(true);
    });
});
