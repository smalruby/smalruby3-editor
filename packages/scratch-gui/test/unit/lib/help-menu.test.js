import { HELP_MENU_SECTIONS, arrangeHelpMenu, shortVersion } from '../../../src/lib/help-menu';

const item = (id) => ({ id, title: id, onClick: () => {} });

describe('HELP_MENU_SECTIONS', () => {
    test('puts help first, then the bug report, then the things about Smalruby', () => {
        expect(HELP_MENU_SECTIONS).toEqual([['tutorials', 'debug'], ['bugReport'], ['welcome', 'about', 'version']]);
    });
});

describe('arrangeHelpMenu', () => {
    test('orders the items by the sections, whatever order they come in', () => {
        const items = ['version', 'about', 'welcome', 'bugReport', 'debug', 'tutorials'].map(item);
        const sections = arrangeHelpMenu(items);
        expect(sections.map((section) => section.map((i) => i.id))).toEqual([
            ['tutorials', 'debug'],
            ['bugReport'],
            ['welcome', 'about', 'version'],
        ]);
    });

    test('drops a section when none of its items are available', () => {
        const items = ['tutorials', 'debug', 'about', 'version'].map(item);
        expect(arrangeHelpMenu(items).map((section) => section.map((i) => i.id))).toEqual([
            ['tutorials', 'debug'],
            ['about', 'version'],
        ]);
    });

    test('keeps items without a known id at the end, in their own section', () => {
        const extra = { title: 'From the embedder', onClick: () => {} };
        const sections = arrangeHelpMenu([item('about'), extra, item('tutorials')]);
        expect(sections.map((section) => section.map((i) => i.id || i.title))).toEqual([
            ['tutorials'],
            ['about'],
            ['From the embedder'],
        ]);
    });

    test('accepts another order so the menu is easy to rearrange', () => {
        const items = ['tutorials', 'debug', 'about'].map(item);
        const sections = arrangeHelpMenu(items, [['about'], ['debug', 'tutorials']]);
        expect(sections.map((section) => section.map((i) => i.id))).toEqual([['about'], ['debug', 'tutorials']]);
    });
});

describe('shortVersion', () => {
    test('shortens a commit sha to 7 characters', () => {
        expect(shortVersion('0123456789abcdef0123456789abcdef01234567')).toBe('0123456');
    });

    test('returns null when there is no commit sha (local builds)', () => {
        expect(shortVersion('')).toBeNull();
        expect(shortVersion(undefined)).toBeNull();
        expect(shortVersion('not a sha')).toBeNull();
    });
});
