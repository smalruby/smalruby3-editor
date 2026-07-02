/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import React from 'react';
import useIsNarrowScreen, { NARROW_SCREEN_QUERY } from '../../../src/lib/use-is-narrow-screen.js';

const setMatchMedia = (matches) => {
    const listeners = new Set();
    const mql = {
        matches,
        media: '',
        onchange: null,
        addEventListener: (_event, listener) => listeners.add(listener),
        removeEventListener: (_event, listener) => listeners.delete(listener),
        addListener: (listener) => listeners.add(listener),
        removeListener: (listener) => listeners.delete(listener),
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

describe('NARROW_SCREEN_QUERY', () => {
    // Issue #865: the bare `(max-height: 500px)` clause wrongly caught wide but
    // short screens (e.g. a zoomed Chromebook at 1380x480), forcing mobile mode.
    // The height clause must be bounded by a phone-ish max-width so wide screens
    // stay in desktop mode.
    test('narrow-width clause stays at 743px', () => {
        expect(NARROW_SCREEN_QUERY).toContain('(max-width: 743px)');
    });

    test('height clause is bounded by a phone-ish max-width (no bare max-height)', () => {
        expect(NARROW_SCREEN_QUERY).toContain('(max-width: 950px) and (max-height: 500px)');
        // guard against regressing to an unbounded height clause
        expect(NARROW_SCREEN_QUERY).not.toMatch(/,\s*\(max-height: 500px\)/);
    });
});

describe('useIsNarrowScreen', () => {
    test('returns true when matchMedia matches', () => {
        setMatchMedia(true);
        let observed = null;
        render(<ProbeComponent onValue={(v) => (observed = v)} />);
        expect(observed).toBe(true);
    });

    test('returns false when matchMedia does not match', () => {
        setMatchMedia(false);
        let observed = null;
        render(<ProbeComponent onValue={(v) => (observed = v)} />);
        expect(observed).toBe(false);
    });

    test('updates when viewport changes', () => {
        const { listeners } = setMatchMedia(false);
        const observations = [];
        render(<ProbeComponent onValue={(v) => observations.push(v)} />);
        expect(observations[observations.length - 1]).toBe(false);
        act(() => {
            listeners.forEach((listener) => listener({ matches: true }));
        });
        expect(observations[observations.length - 1]).toBe(true);
    });
});
