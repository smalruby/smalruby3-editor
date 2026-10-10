import {
  googleApiErrorResponse,
  buildGoogleClassroomLinkedBy,
  readGoogleClassroomLinkedBy,
  isGoogleClassroomLinker,
  classifyCourseTeacherFailure,
} from '../handler';

describe('googleApiErrorResponse with operation context', () => {
  const parse = (res: { statusCode: number; body: string }) => JSON.parse(res.body);

  test('404 while posting course work means the caller is not a teacher of the course', () => {
    const res = googleApiErrorResponse(404, 'NOT_FOUND', 'Requested entity was not found.', 'postCourseWork');
    expect(res.statusCode).toBe(404);
    const body = parse(res);
    expect(body.reason).toBe('googleNotCourseTeacher');
    expect(body.googleStatus).toBe('NOT_FOUND');
  });

  test('403 while posting course work keeps the permission reason', () => {
    const res = googleApiErrorResponse(403, 'PERMISSION_DENIED', 'nope', 'postCourseWork');
    expect(parse(res).reason).toBe('googlePermissionDenied');
  });

  test('404 without an operation stays the generic course-not-found reason', () => {
    expect(parse(googleApiErrorResponse(404, 'NOT_FOUND', '')).reason).toBe('googleCourseNotFound');
  });

  test('an unrelated operation does not hijack the 404 reason', () => {
    expect(parse(googleApiErrorResponse(404, 'NOT_FOUND', '', 'listCourses')).reason).toBe(
      'googleCourseNotFound',
    );
  });

  // The teacher who linked the course *is* a teacher of it, so their 404 means
  // the course is gone — "ask the teacher who linked it" would send them to
  // themselves (issue #1184).
  test('404 while the linking teacher posts means the course is gone, not a wrong teacher', () => {
    const res = googleApiErrorResponse(404, 'NOT_FOUND', '', 'postCourseWorkAsLinker');
    expect(parse(res).reason).toBe('googleCourseNotFound');
  });
});

describe('isGoogleClassroomLinker', () => {
  const identity = { sub: 'linker-sub', email: 'linker@example.com' };

  test('recognizes the recorded linker', () => {
    const item = { teacherSub: 'owner-sub', googleClassroomLinkedBy: { sub: 'linker-sub', email: null } };
    expect(isGoogleClassroomLinker(identity, item)).toBe(true);
  });

  test('a co-teacher who did not link it is not the linker', () => {
    const item = { teacherSub: 'owner-sub', googleClassroomLinkedBy: { sub: 'someone-else', email: null } };
    expect(isGoogleClassroomLinker(identity, item)).toBe(false);
  });

  // Classes linked before the attribution existed fall back to the owner —
  // the only teacher who could have linked them under the old flow.
  test('falls back to the class owner for rows written before the field existed', () => {
    expect(isGoogleClassroomLinker(identity, { teacherSub: 'linker-sub' })).toBe(true);
    expect(isGoogleClassroomLinker(identity, { teacherSub: 'owner-sub' })).toBe(false);
  });

  test('nothing to attribute the link to is not a match', () => {
    expect(isGoogleClassroomLinker(identity, {})).toBe(false);
    expect(isGoogleClassroomLinker(identity, undefined)).toBe(false);
  });
});

describe('buildGoogleClassroomLinkedBy', () => {
  test('records who linked the course so the UI can name them later', () => {
    expect(buildGoogleClassroomLinkedBy({ sub: 'sub-1', email: 'teacher@example.com' })).toEqual({
      sub: 'sub-1',
      email: 'teacher@example.com',
    });
  });

  test('normalizes the email so it matches the co-teacher list', () => {
    expect(buildGoogleClassroomLinkedBy({ sub: 'sub-1', email: ' Teacher@Example.COM ' })).toEqual({
      sub: 'sub-1',
      email: 'teacher@example.com',
    });
  });

  test('tolerates a provider that supplies no email', () => {
    expect(buildGoogleClassroomLinkedBy({ sub: 'sub-1', email: null })).toEqual({
      sub: 'sub-1',
      email: null,
    });
  });
});

describe('readGoogleClassroomLinkedBy', () => {
  test('returns the stored linker', () => {
    const item = {
      teacherSub: 'owner-sub',
      googleClassroomLinkedBy: { sub: 'linker-sub', email: 'linker@example.com' },
    };
    expect(readGoogleClassroomLinkedBy(item)).toEqual({ sub: 'linker-sub', email: 'linker@example.com' });
  });

  test('falls back to the class owner for rows written before the field existed', () => {
    expect(readGoogleClassroomLinkedBy({ teacherSub: 'owner-sub' })).toEqual({
      sub: 'owner-sub',
      email: null,
    });
  });

  test('ignores a malformed stored value', () => {
    expect(readGoogleClassroomLinkedBy({ teacherSub: 'owner-sub', googleClassroomLinkedBy: 'nope' })).toEqual({
      sub: 'owner-sub',
      email: null,
    });
  });

  test('returns null when there is nothing to attribute the link to', () => {
    expect(readGoogleClassroomLinkedBy({})).toBeNull();
    expect(readGoogleClassroomLinkedBy(undefined)).toBeNull();
  });
});

describe('classifyCourseTeacherFailure', () => {
  // Google hides courses the caller is not in behind a 404, so that is the only
  // status that proves "not a teacher". Everything else (expired token, missing
  // scope, Google outage) is inconclusive and must not disable the button.
  test('404 means the caller is not a teacher of the course', () => {
    expect(classifyCourseTeacherFailure(404)).toBe('notTeacher');
  });

  test.each([401, 403, 429, 500, 502])('%i is inconclusive', (status) => {
    expect(classifyCourseTeacherFailure(status)).toBe('unknown');
  });
});
