/**
 * Integration tests against a DEPLOYED stg endpoint.
 *
 * Requires BUG_REPORT_API_ENDPOINT (set in .env.stg after the first deploy) and
 * DEV_BYPASS_TOKEN. They self-skip when the endpoint is not configured so CI /
 * credential-free runs stay green. Purpose: prove the authorization matrix
 * (401 / 403 / 200) and the privacy guarantee end-to-end on real infrastructure.
 *
 * Run: npm run test:integration
 */

const ENDPOINT = (process.env.BUG_REPORT_API_ENDPOINT || '').replace(/\/$/, '');
const DEV_TOKEN = process.env.DEV_BYPASS_TOKEN || '';
const ORIGIN = 'https://smalruby.app';

const describeIf = ENDPOINT && DEV_TOKEN ? describe : describe.skip;

const req = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json: json as Record<string, unknown> | null };
};

describeIf('bug-report API (stg)', () => {
  test('POST /bug-reports without a token is 401', async () => {
    const { status } = await req('POST', '/bug-reports', { body: { description: 'x' } });
    expect(status).toBe(401);
  });

  test('GET /admin/bug-reports without a token is 401', async () => {
    const { status } = await req('GET', '/admin/bug-reports');
    expect(status).toBe(401);
  });

  let createdReportId: string | undefined;

  test('POST /bug-reports with dev token creates a report and returns upload URLs', async () => {
    const { status, json } = await req('POST', '/bug-reports', {
      token: DEV_TOKEN,
      body: { description: 'integration test report', screenshotCount: 1, appContext: { rubyVersion: 2 } },
    });
    expect(status).toBe(201);
    expect(json?.reportId).toBeTruthy();
    expect(String(json?.uploadUrl)).toContain('project.sb3');
    expect(Array.isArray(json?.screenshotUploadUrls)).toBe(true);
    createdReportId = json?.reportId as string;
  });

  test('GET /bug-reports returns my reports without S3 keys/URLs', async () => {
    const { status, json } = await req('GET', '/bug-reports', { token: DEV_TOKEN });
    expect(status).toBe(200);
    const raw = JSON.stringify(json);
    expect(raw).not.toContain('s3Key');
    expect(raw).not.toContain('project.sb3');
    expect(raw).not.toContain('X-Amz-Signature');
  });

  test('dev-bypass identity is a bootstrap admin in stg → admin list works', async () => {
    // .env.stg includes dev-test-user@example.com in BOOTSTRAP_ADMIN_EMAILS.
    const { status, json } = await req('GET', '/admin/bug-reports', { token: DEV_TOKEN });
    expect(status).toBe(200);
    expect(Array.isArray(json?.reports)).toBe(true);
  });

  test('admin can fetch a report detail with a project download URL', async () => {
    if (!createdReportId) return;
    const { status, json } = await req('GET', `/admin/bug-reports/${createdReportId}`, { token: DEV_TOKEN });
    expect(status).toBe(200);
    expect(String(json?.projectUrl)).toContain('X-Amz-Signature');
  });

  test('owner can hide their report; it drops from the list but the admin still sees it', async () => {
    if (!createdReportId) return;
    // hide
    const hide = await req('PATCH', `/bug-reports/${createdReportId}`, { token: DEV_TOKEN, body: { hidden: true } });
    expect(hide.status).toBe(200);
    expect(hide.json?.hiddenByOwner).toBe(true);

    // gone from the reporter's list
    const mine = await req('GET', '/bug-reports', { token: DEV_TOKEN });
    const visibleIds = ((mine.json?.reports as Array<{ reportId: string }>) || []).map(r => r.reportId);
    expect(visibleIds).not.toContain(createdReportId);

    // still present for admins, flagged hiddenByOwner
    const admin = await req('GET', '/admin/bug-reports', { token: DEV_TOKEN });
    const adminRow = ((admin.json?.reports as Array<{ reportId: string; hiddenByOwner: boolean }>) || [])
      .find(r => r.reportId === createdReportId);
    expect(adminRow?.hiddenByOwner).toBe(true);

    // unhide → back in the list
    const unhide = await req('PATCH', `/bug-reports/${createdReportId}`, { token: DEV_TOKEN, body: { hidden: false } });
    expect(unhide.status).toBe(200);
    const mine2 = await req('GET', '/bug-reports', { token: DEV_TOKEN });
    const visibleIds2 = ((mine2.json?.reports as Array<{ reportId: string }>) || []).map(r => r.reportId);
    expect(visibleIds2).toContain(createdReportId);
  });
});
