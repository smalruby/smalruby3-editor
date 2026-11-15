import {
    DEFAULT_MESH_GROUP_LIMIT,
    MAX_ASSIGNMENT_PAGES,
    MESH_GROUP_LIMIT_VALUES,
    MAX_ASSIGNMENT_PAGE_TEXT_LENGTH,
    PEER_VIEW_VALUES,
    buildAssignmentPayload,
    normalizeMeshGroupLimit,
    normalizePeerView,
    isEmptyAssignment,
    summarizeAssignmentRow,
    moveItem,
    validateEditorPages,
} from '../../../src/lib/classroom-assignment-utils';

describe('buildAssignmentPayload', () => {
    test('never sends the removed startFromPrevious setting (#1825; the server keeps the stored value)', () => {
        expect(buildAssignmentPayload([{ text: 'p' }], 'keep')).toEqual({
            pages: [{ text: 'p' }],
            keepStarter: true,
        });
    });

    test('includes peerView only when given (#1208)', () => {
        expect(buildAssignmentPayload([{ text: 'p' }], 'none', 'afterSubmit')).toEqual({
            pages: [{ text: 'p' }],
            peerView: 'afterSubmit',
        });
        expect(buildAssignmentPayload([{ text: 'p' }], 'none')).not.toHaveProperty('peerView');
    });

    test('maps text-only pages', () => {
        const payload = buildAssignmentPayload([{ text: 'ねこを動かそう' }, { text: '' }], 'none');
        expect(payload).toEqual({ pages: [{ text: 'ねこを動かそう' }, { text: '' }] });
    });

    test('maps a newly attached image to newImage with its MIME type', () => {
        const payload = buildAssignmentPayload(
            [{ text: 'p', newImageBlob: {}, newImageType: 'image/png', previewUrl: 'blob:x' }],
            'none',
        );
        expect(payload.pages).toEqual([{ text: 'p', newImage: 'image/png' }]);
    });

    test('maps an existing image to imageKey', () => {
        const payload = buildAssignmentPayload(
            [{ text: 'p', imageKey: 'cid/assignment/image-1.png', imageUrl: 'https://example.com/x' }],
            'none',
        );
        expect(payload.pages).toEqual([{ text: 'p', imageKey: 'cid/assignment/image-1.png' }]);
    });

    test('prefers newImage over a stale imageKey on the same page', () => {
        const payload = buildAssignmentPayload(
            [{ text: 'p', imageKey: 'cid/assignment/old.png', newImageType: 'image/jpeg' }],
            'none',
        );
        expect(payload.pages).toEqual([{ text: 'p', newImage: 'image/jpeg' }]);
    });

    test('sets newStarter for starterMode new', () => {
        expect(buildAssignmentPayload([], 'new')).toEqual({ pages: [], newStarter: true });
    });

    test('sets keepStarter for starterMode keep', () => {
        expect(buildAssignmentPayload([], 'keep')).toEqual({ pages: [], keepStarter: true });
    });

    test('sets neither flag for starterMode none', () => {
        expect(buildAssignmentPayload([], 'none')).toEqual({ pages: [] });
    });

    test('handles null editorPages', () => {
        expect(buildAssignmentPayload(null, 'none')).toEqual({ pages: [] });
    });
});

describe('validateEditorPages', () => {
    test('accepts empty and normal pages', () => {
        expect(validateEditorPages([])).toBeNull();
        expect(validateEditorPages([{ text: 'こんにちは' }])).toBeNull();
        expect(validateEditorPages(null)).toBeNull();
    });

    test('rejects more than the max page count', () => {
        const pages = Array.from({ length: MAX_ASSIGNMENT_PAGES + 1 }, () => ({ text: 'p' }));
        expect(validateEditorPages(pages)).toEqual({ error: 'tooManyPages' });
    });

    test('accepts exactly the max page count', () => {
        const pages = Array.from({ length: MAX_ASSIGNMENT_PAGES }, () => ({ text: 'p' }));
        expect(validateEditorPages(pages)).toBeNull();
    });

    test('rejects text over the limit with the page index', () => {
        const pages = [{ text: 'ok' }, { text: 'あ'.repeat(MAX_ASSIGNMENT_PAGE_TEXT_LENGTH + 1) }];
        expect(validateEditorPages(pages)).toEqual({ error: 'textTooLong', pageIndex: 1 });
    });

    test('accepts text of exactly the limit', () => {
        expect(validateEditorPages([{ text: 'a'.repeat(MAX_ASSIGNMENT_PAGE_TEXT_LENGTH) }])).toBeNull();
    });

    test('rejects unsupported image types with the page index', () => {
        const pages = [{ text: 'p', newImageType: 'image/gif' }];
        expect(validateEditorPages(pages)).toEqual({ error: 'badImageType', pageIndex: 0 });
    });

    test('treats missing text as empty', () => {
        expect(validateEditorPages([{}])).toBeNull();
    });
});

describe('isEmptyAssignment', () => {
    test('true only when there are no pages and no starter', () => {
        expect(isEmptyAssignment([], 'none')).toBe(true);
        expect(isEmptyAssignment(null, 'none')).toBe(true);
        expect(isEmptyAssignment([{ text: '' }], 'none')).toBe(false);
        expect(isEmptyAssignment([], 'keep')).toBe(false);
        expect(isEmptyAssignment([], 'new')).toBe(false);
    });
});

describe('moveItem', () => {
    test('moves an item down', () => {
        expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    });

    test('moves an item up', () => {
        expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    });

    test('returns the same array for out-of-range moves', () => {
        const items = ['a', 'b'];
        expect(moveItem(items, 0, -1)).toBe(items);
        expect(moveItem(items, 1, 2)).toBe(items);
        expect(moveItem(items, 1, 1)).toBe(items);
    });

    test('does not mutate the source array', () => {
        const items = ['a', 'b', 'c'];
        moveItem(items, 0, 2);
        expect(items).toEqual(['a', 'b', 'c']);
    });
});

describe('normalizePeerView (#1208)', () => {
    test('keeps the three known values and falls back to none', () => {
        expect(PEER_VIEW_VALUES).toEqual(['none', 'always', 'afterSubmit']);
        expect(normalizePeerView('always')).toBe('always');
        expect(normalizePeerView('afterSubmit')).toBe('afterSubmit');
        expect(normalizePeerView(undefined)).toBe('none');
        expect(normalizePeerView('bogus')).toBe('none');
    });
});

describe('normalizeMeshGroupLimit (#1257)', () => {
    test('新規作成の既定は 6（6人まで）', () => {
        expect(DEFAULT_MESH_GROUP_LIMIT).toBe(6);
        expect(MESH_GROUP_LIMIT_VALUES).toEqual([6, 0]);
    });

    test('6 / 0 はそのまま、値が無い（この機能より前の課題）・不正値は 0（制限なし）', () => {
        expect(normalizeMeshGroupLimit(6)).toBe(6);
        expect(normalizeMeshGroupLimit(0)).toBe(0);
        expect(normalizeMeshGroupLimit('6')).toBe(6);
        expect(normalizeMeshGroupLimit(undefined)).toBe(0);
        expect(normalizeMeshGroupLimit(null)).toBe(0);
        expect(normalizeMeshGroupLimit(3)).toBe(0);
    });
});

describe('summarizeAssignmentRow (#1301: counts of an opened board row)', () => {
    test('counts joined (not left) members and their submissions against the seats', () => {
        const members = [
            { memberId: 'seat-01', hasSubmission: true },
            { memberId: 'seat-02', hasSubmission: false },
            { memberId: 'seat-03', hasSubmission: true, left: true },
        ];
        expect(summarizeAssignmentRow({ members, studentCount: 30, assignment: null })).toEqual({
            submitted: 1,
            joined: 2,
            capacity: 30,
            descriptionLine: '',
        });
    });

    test('the description is the first non-empty line of the first page', () => {
        const assignment = { pages: [{ text: '\n  ねこを動かそう  \n2行目' }, { text: '次のページ' }] };
        expect(summarizeAssignmentRow({ members: [], studentCount: 0, assignment }).descriptionLine).toBe(
            'ねこを動かそう',
        );
    });

    test('missing data gives zeros and an empty description', () => {
        expect(summarizeAssignmentRow({})).toEqual({ submitted: 0, joined: 0, capacity: 0, descriptionLine: '' });
    });
});
