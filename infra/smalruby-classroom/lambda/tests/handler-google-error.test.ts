import { parseGoogleApiErrorBody, googleApiErrorResponse } from '../handler';

describe('parseGoogleApiErrorBody', () => {
  test('extracts status and message from a Google error envelope', () => {
    const raw = JSON.stringify({
      error: {
        code: 404,
        message: 'Requested entity was not found.',
        status: 'NOT_FOUND',
      },
    });
    expect(parseGoogleApiErrorBody(raw)).toEqual({
      googleStatus: 'NOT_FOUND',
      googleMessage: 'Requested entity was not found.',
    });
  });

  test('returns empty fields for a non-JSON body', () => {
    expect(parseGoogleApiErrorBody('<html>502 Bad Gateway</html>')).toEqual({
      googleStatus: '',
      googleMessage: '',
    });
  });

  test('returns empty fields for an empty body', () => {
    expect(parseGoogleApiErrorBody('')).toEqual({ googleStatus: '', googleMessage: '' });
  });

  test('tolerates a JSON body without the error envelope', () => {
    expect(parseGoogleApiErrorBody(JSON.stringify({ foo: 'bar' }))).toEqual({
      googleStatus: '',
      googleMessage: '',
    });
  });

  test('ignores non-string status / message fields', () => {
    const raw = JSON.stringify({ error: { status: 42, message: { nested: true } } });
    expect(parseGoogleApiErrorBody(raw)).toEqual({ googleStatus: '', googleMessage: '' });
  });

  test('truncates an overly long message', () => {
    const raw = JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'あ'.repeat(600) } });
    const parsed = parseGoogleApiErrorBody(raw);
    expect(parsed.googleStatus).toBe('INVALID_ARGUMENT');
    expect(parsed.googleMessage.length).toBeLessThanOrEqual(300);
  });
});

describe('googleApiErrorResponse', () => {
  const parse = (res: { statusCode: number; body: string }) => JSON.parse(res.body);

  test('401 keeps the re-authorization hint and flags googleTokenExpired', () => {
    const res = googleApiErrorResponse(401, 'UNAUTHENTICATED', 'Invalid Credentials');
    expect(res.statusCode).toBe(401);
    expect(parse(res).reason).toBe('googleTokenExpired');
  });

  test('403 flags googlePermissionDenied', () => {
    const res = googleApiErrorResponse(403, 'PERMISSION_DENIED', 'The caller does not have permission');
    expect(res.statusCode).toBe(403);
    expect(parse(res).reason).toBe('googlePermissionDenied');
  });

  test('404 is surfaced as 404 googleCourseNotFound, not a generic 502', () => {
    const res = googleApiErrorResponse(404, 'NOT_FOUND', 'Requested entity was not found.');
    expect(res.statusCode).toBe(404);
    const body = parse(res);
    expect(body.reason).toBe('googleCourseNotFound');
    expect(body.googleStatus).toBe('NOT_FOUND');
    expect(body.googleMessage).toBe('Requested entity was not found.');
  });

  test('400 is surfaced as 400 googleInvalidRequest with Google detail', () => {
    const res = googleApiErrorResponse(400, 'INVALID_ARGUMENT', 'Request contains an invalid argument.');
    expect(res.statusCode).toBe(400);
    const body = parse(res);
    expect(body.reason).toBe('googleInvalidRequest');
    expect(body.googleMessage).toBe('Request contains an invalid argument.');
  });

  test('FAILED_PRECONDITION (e.g. an archived course) is surfaced as 400', () => {
    const res = googleApiErrorResponse(400, 'FAILED_PRECONDITION', 'CourseNotModifiable');
    expect(res.statusCode).toBe(400);
    expect(parse(res).googleStatus).toBe('FAILED_PRECONDITION');
  });

  test('other statuses stay a 502 but still carry the Google detail', () => {
    const res = googleApiErrorResponse(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded');
    expect(res.statusCode).toBe(502);
    const body = parse(res);
    expect(body.reason).toBe('googleApiError');
    expect(body.googleStatus).toBe('RESOURCE_EXHAUSTED');
    expect(body.googleMessage).toBe('Quota exceeded');
  });

  test('omits empty Google detail fields', () => {
    const body = parse(googleApiErrorResponse(500, '', ''));
    expect(body.googleStatus).toBeUndefined();
    expect(body.googleMessage).toBeUndefined();
    expect(body.reason).toBe('googleApiError');
  });
});
