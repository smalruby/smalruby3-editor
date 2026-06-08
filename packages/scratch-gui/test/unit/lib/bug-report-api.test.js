/**
 * Unit tests for BugReportAPI (the client used by the bug report modal).
 * Focused on request shaping, auth header, 429 backoff, and error-body
 * propagation. fetch is mocked.
 */

global.fetch = jest.fn();

describe('BugReportAPI', () => {
    let api;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        api = require('../../../src/lib/bug-report-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const okJson = (data, status = 200) => ({
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(data),
    });

    test('createReport POSTs to /bug-reports with the Bearer token and body', async () => {
        global.fetch.mockResolvedValue(okJson({ reportId: 'r1', uploadUrl: 'u' }, 201));
        const res = await api.createReport('id-token', { description: 'broke', screenshotCount: 2 });
        expect(res.reportId).toBe('r1');

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('/bug-reports');
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe('Bearer id-token');
        expect(JSON.parse(options.body)).toEqual({ description: 'broke', screenshotCount: 2 });
    });

    test('listMyReports GETs /bug-reports with no body', async () => {
        global.fetch.mockResolvedValue(okJson({ reports: [] }));
        await api.listMyReports('id-token');
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toMatch(/\/bug-reports$/);
        expect(options.method).toBe('GET');
        expect(options.body).toBeUndefined();
    });

    test('listReports includes the status query when provided', async () => {
        global.fetch.mockResolvedValue(okJson({ reports: [] }));
        await api.listReports('admin-token', 'open');
        expect(global.fetch.mock.calls[0][0]).toContain('/admin/bug-reports?status=open');
    });

    test('updateReport PATCHes the admin report path', async () => {
        global.fetch.mockResolvedValue(okJson({ reportId: 'r1' }));
        await api.updateReport('admin-token', 'r1', { status: 'resolved', developerReply: 'fixed' });
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('/admin/bug-reports/r1');
        expect(options.method).toBe('PATCH');
        expect(JSON.parse(options.body)).toEqual({ status: 'resolved', developerReply: 'fixed' });
    });

    test('removeAdmin URL-encodes the email', async () => {
        global.fetch.mockResolvedValue(okJson({ email: 'a@b.com' }));
        await api.removeAdmin('admin-token', 'a+test@b.com');
        expect(global.fetch.mock.calls[0][0]).toContain('/admin/admins/a%2Btest%40b.com');
    });

    test('uploadToPresignedUrl PUTs the body with the content type', async () => {
        global.fetch.mockResolvedValue({ ok: true, status: 200 });
        const buf = new ArrayBuffer(8);
        await api.uploadToPresignedUrl('https://signed', buf, 'application/octet-stream');
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://signed');
        expect(options.method).toBe('PUT');
        expect(options.headers['Content-Type']).toBe('application/octet-stream');
        expect(options.body).toBe(buf);
    });

    test('uploadToPresignedUrl throws on a failed upload', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 403 });
        await expect(api.uploadToPresignedUrl('https://signed', 'x', 'image/png')).rejects.toThrow(
            'Upload failed: 403',
        );
    });

    test('attaches HTTP status and body to thrown errors', async () => {
        global.fetch.mockResolvedValue(okJson({ error: 'Administrator privileges are required' }, 403));
        await expect(api.listReports('not-admin')).rejects.toMatchObject({
            status: 403,
            message: 'Administrator privileges are required',
        });
    });

    test('retries on 429 then succeeds', async () => {
        global.fetch
            .mockResolvedValueOnce({ ok: false, status: 429, json: jest.fn().mockResolvedValue({}) })
            .mockResolvedValueOnce(okJson({ reports: [] }));
        const res = await api.listMyReports('id-token');
        expect(res).toEqual({ reports: [] });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
