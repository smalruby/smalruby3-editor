import { detectSharedAuthorProfile, persistSharedAuthorProfile } from '../../../src/lib/shared-author-profile.js';

const KEY = 'smalruby:sharedAuthorProfile';

describe('shared author profile persistence (D6)', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('round-trips the profile through localStorage', () => {
        persistSharedAuthorProfile({ authorName: 'すもう るびお', authorAffiliation: '島根県' });
        expect(detectSharedAuthorProfile()).toEqual({
            authorName: 'すもう るびお',
            authorAffiliation: '島根県',
        });
        expect(JSON.parse(window.localStorage.getItem(KEY)).authorName).toBe('すもう るびお');
    });

    test('returns empty strings when nothing is stored', () => {
        expect(detectSharedAuthorProfile()).toEqual({ authorName: '', authorAffiliation: '' });
    });

    test('survives corrupted storage', () => {
        window.localStorage.setItem(KEY, '{broken json');
        expect(detectSharedAuthorProfile()).toEqual({ authorName: '', authorAffiliation: '' });
    });

    test('normalizes missing affiliation to an empty string', () => {
        persistSharedAuthorProfile({ authorName: 'A' });
        expect(detectSharedAuthorProfile()).toEqual({ authorName: 'A', authorAffiliation: '' });
    });
});
