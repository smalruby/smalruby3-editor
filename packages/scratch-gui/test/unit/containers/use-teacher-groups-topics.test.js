import { appendReusedTopic } from '../../../src/containers/use-teacher-groups.js';

describe('appendReusedTopic', () => {
    test('appends a topic the target class does not list yet', () => {
        const group = { groupId: 'g1', topics: ['ループ'] };
        expect(appendReusedTopic(group, '条件分岐')).toEqual({
            groupId: 'g1',
            topics: ['ループ', '条件分岐'],
        });
    });

    test('is a no-op when the topic is already listed', () => {
        const group = { groupId: 'g1', topics: ['ループ'] };
        // Same reference back so React skips a needless re-render.
        expect(appendReusedTopic(group, 'ループ')).toBe(group);
    });

    test('starts the topics list when the class has none', () => {
        expect(appendReusedTopic({ groupId: 'g1' }, 'ループ')).toEqual({
            groupId: 'g1',
            topics: ['ループ'],
        });
    });

    test('returns the group unchanged for an empty / missing topic', () => {
        const group = { groupId: 'g1', topics: ['ループ'] };
        expect(appendReusedTopic(group, '')).toBe(group);
        expect(appendReusedTopic(group, null)).toBe(group);
        expect(appendReusedTopic(group, undefined)).toBe(group);
    });

    test('returns null/undefined groups untouched', () => {
        expect(appendReusedTopic(null, 'ループ')).toBeNull();
        expect(appendReusedTopic(undefined, 'ループ')).toBeUndefined();
    });

    test('does not mutate the input group', () => {
        const group = { groupId: 'g1', topics: ['ループ'] };
        appendReusedTopic(group, '条件分岐');
        expect(group.topics).toEqual(['ループ']);
    });
});
