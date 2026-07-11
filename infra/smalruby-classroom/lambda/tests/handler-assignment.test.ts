import {
  validateAssignmentPages,
  hasAssignmentContent,
  getCorsHeaders,
} from '../handler';

const CLASSROOM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('validateAssignmentPages', () => {
  test('returns [] for undefined / null', () => {
    expect(validateAssignmentPages(undefined, CLASSROOM_ID)).toEqual([]);
    expect(validateAssignmentPages(null, CLASSROOM_ID)).toEqual([]);
  });

  test('accepts text-only pages and preserves line breaks', () => {
    const pages = validateAssignmentPages(
      [{ text: 'ねこを動かそう\n1. 旗をクリック' }, { text: '' }],
      CLASSROOM_ID,
    );
    expect(pages).toEqual([{ text: 'ねこを動かそう\n1. 旗をクリック' }, { text: '' }]);
  });

  test('rejects non-array pages', () => {
    expect(() => validateAssignmentPages('text', CLASSROOM_ID)).toThrow('pages must be an array');
    expect(() => validateAssignmentPages({}, CLASSROOM_ID)).toThrow('pages must be an array');
  });

  test('rejects more than 10 pages', () => {
    const pages = Array.from({ length: 11 }, () => ({ text: 'p' }));
    expect(() => validateAssignmentPages(pages, CLASSROOM_ID)).toThrow('at most 10 pages');
  });

  test('accepts exactly 10 pages', () => {
    const pages = Array.from({ length: 10 }, () => ({ text: 'p' }));
    expect(validateAssignmentPages(pages, CLASSROOM_ID)).toHaveLength(10);
  });

  test('rejects a non-object page', () => {
    expect(() => validateAssignmentPages(['text'], CLASSROOM_ID)).toThrow('pages[0] must be an object');
    expect(() => validateAssignmentPages([null], CLASSROOM_ID)).toThrow('pages[0] must be an object');
    expect(() => validateAssignmentPages([[]], CLASSROOM_ID)).toThrow('pages[0] must be an object');
  });

  test('rejects a page without text', () => {
    expect(() => validateAssignmentPages([{}], CLASSROOM_ID)).toThrow('pages[0].text is required');
    expect(() => validateAssignmentPages([{ text: 42 }], CLASSROOM_ID)).toThrow('pages[0].text is required');
  });

  test('rejects text over 500 characters', () => {
    const text = 'あ'.repeat(501);
    expect(() => validateAssignmentPages([{ text }], CLASSROOM_ID)).toThrow('500 characters or less');
  });

  test('accepts text of exactly 500 characters', () => {
    const text = 'a'.repeat(500);
    expect(validateAssignmentPages([{ text }], CLASSROOM_ID)).toEqual([{ text }]);
  });

  test('accepts an existing imageKey under this classroom assignment prefix', () => {
    const imageKey = `${CLASSROOM_ID}/assignment/image-1234.png`;
    expect(validateAssignmentPages([{ text: 'p', imageKey }], CLASSROOM_ID)).toEqual([
      { text: 'p', imageKey },
    ]);
  });

  test('rejects an imageKey pointing outside this classroom', () => {
    expect(() =>
      validateAssignmentPages(
        [{ text: 'p', imageKey: 'other-classroom/assignment/image.png' }],
        CLASSROOM_ID,
      ),
    ).toThrow('does not belong to this classroom');
    // A submission object of the same classroom must be rejected too.
    expect(() =>
      validateAssignmentPages(
        [{ text: 'p', imageKey: `${CLASSROOM_ID}/some-submission/project.sb3` }],
        CLASSROOM_ID,
      ),
    ).toThrow('does not belong to this classroom');
  });

  test('accepts newImage with an allowed content type', () => {
    expect(validateAssignmentPages([{ text: 'p', newImage: 'image/png' }], CLASSROOM_ID)).toEqual([
      { text: 'p', newImage: 'image/png' },
    ]);
    expect(validateAssignmentPages([{ text: 'p', newImage: 'image/jpeg' }], CLASSROOM_ID)).toEqual([
      { text: 'p', newImage: 'image/jpeg' },
    ]);
  });

  test('rejects newImage with a disallowed content type', () => {
    expect(() =>
      validateAssignmentPages([{ text: 'p', newImage: 'image/svg+xml' }], CLASSROOM_ID),
    ).toThrow('newImage must be one of');
    expect(() =>
      validateAssignmentPages([{ text: 'p', newImage: 'application/octet-stream' }], CLASSROOM_ID),
    ).toThrow('newImage must be one of');
  });

  test('rejects a page carrying both imageKey and newImage', () => {
    expect(() =>
      validateAssignmentPages(
        [{ text: 'p', imageKey: `${CLASSROOM_ID}/assignment/a.png`, newImage: 'image/png' }],
        CLASSROOM_ID,
      ),
    ).toThrow('cannot have both');
  });
});

describe('hasAssignmentContent', () => {
  test('false for missing item or missing assignment', () => {
    expect(hasAssignmentContent(undefined)).toBe(false);
    expect(hasAssignmentContent({})).toBe(false);
  });

  test('false for an assignment with no pages and no starter', () => {
    expect(hasAssignmentContent({ assignment: {} })).toBe(false);
    expect(hasAssignmentContent({ assignment: { pages: [] } })).toBe(false);
  });

  test('true when pages exist', () => {
    expect(hasAssignmentContent({ assignment: { pages: [{ text: 'p' }] } })).toBe(true);
  });

  test('true when only a starter exists', () => {
    expect(hasAssignmentContent({ assignment: { starterKey: 'cid/assignment/starter-x.sb3' } })).toBe(true);
  });
});

describe('getCorsHeaders (assignment routes)', () => {
  test('allows PUT for the assignment endpoint', () => {
    const headers = getCorsHeaders('https://smalruby.app');
    expect(headers['Access-Control-Allow-Methods']).toContain('PUT');
  });
});
