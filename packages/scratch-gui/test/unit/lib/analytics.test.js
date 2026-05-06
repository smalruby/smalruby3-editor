/* eslint-env jest */
import analytics from '../../../src/lib/analytics';

describe('analytics (GA4 dataLayer wrapper)', () => {
    let originalDataLayer;

    beforeEach(() => {
        originalDataLayer = window.dataLayer;
        delete window.dataLayer;
    });

    afterEach(() => {
        if (typeof originalDataLayer === 'undefined') {
            delete window.dataLayer;
        } else {
            window.dataLayer = originalDataLayer;
        }
    });

    test('initializes window.dataLayer when missing', () => {
        expect(window.dataLayer).toBeUndefined();
        analytics.event({ category: 'cat', action: 'act', label: 'lab' });
        expect(Array.isArray(window.dataLayer)).toBe(true);
    });

    test('pushes an entry shaped {event, action, label}', () => {
        analytics.event({ category: 'mode_switch', action: 'change', label: 'ruby' });
        expect(window.dataLayer).toEqual([{ event: 'mode_switch', action: 'change', label: 'ruby' }]);
    });

    test('appends to existing dataLayer rather than overwriting', () => {
        window.dataLayer = [{ event: 'page_view' }];
        analytics.event({ category: 'block_run', action: 'green_flag', label: 'normal' });
        expect(window.dataLayer).toHaveLength(2);
        expect(window.dataLayer[0]).toEqual({ event: 'page_view' });
        expect(window.dataLayer[1]).toEqual({
            event: 'block_run',
            action: 'green_flag',
            label: 'normal',
        });
    });

    test('records label as undefined when not supplied', () => {
        analytics.event({ category: 'mesh_v2', action: 'disconnect' });
        expect(window.dataLayer).toEqual([{ event: 'mesh_v2', action: 'disconnect', label: undefined }]);
    });

    test('Phase 1 GA event categories are stable identifiers', () => {
        // This test pins the public contract used by the GA4 dashboard so that
        // accidental category renames break a unit test rather than silently
        // splitting historical data into a new category.
        const categories = ['block_run', 'mesh_v2', 'mode_switch', 'furigana_toggle', 'smalrubot_s1'];
        for (const category of categories) {
            analytics.event({ category, action: 'noop' });
        }
        expect(window.dataLayer.map((entry) => entry.event)).toEqual(categories);
    });

    test('Phase 2 GA event categories are stable identifiers', () => {
        const categories = ['ruby_tab', 'rubytee', 'classroom', 'google_drive'];
        for (const category of categories) {
            analytics.event({ category, action: 'noop' });
        }
        expect(window.dataLayer.map((entry) => entry.event)).toEqual(categories);
    });

    test('Phase 2 expected (action, label) pairs', () => {
        const cases = [
            { category: 'ruby_tab', action: 'open', label: 'ruby' },
            { category: 'ruby_tab', action: 'open', label: 'furigana' },
            { category: 'ruby_tab', action: 'open', label: 'dncl' },
            { category: 'rubytee', action: 'use', label: 'with_code' },
            { category: 'rubytee', action: 'use', label: 'no_code' },
            { category: 'classroom', action: 'join', label: 'with_assignment' },
            { category: 'classroom', action: 'join', label: 'no_assignment' },
            { category: 'classroom', action: 'submit', label: 'with_screenshots' },
            { category: 'classroom', action: 'submit', label: 'no_screenshots' },
            { category: 'google_drive', action: 'save', label: 'overwrite' },
            { category: 'google_drive', action: 'save', label: 'new_file' },
        ];
        for (const c of cases) {
            analytics.event(c);
        }
        expect(window.dataLayer).toEqual(cases.map((c) => ({ event: c.category, action: c.action, label: c.label })));
    });
});
