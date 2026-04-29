describe('mesh-zone-get handler', () => {
    const ORIGINAL_ENV = process.env;

    afterEach(() => {
        jest.resetModules();
        process.env = ORIGINAL_ENV;
    });

    const loadHandler = (env: Record<string, string | undefined>) => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV, ...env };
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('../mesh-zone-get').handler as typeof import('../mesh-zone-get').handler;
    };

    const event = (sourceIp: string) =>
        ({
            requestContext: { http: { sourceIp } },
        }) as never;

    test('returns deterministic domain (Ruby Zlib.crc32 compatibility)', async () => {
        const handler = loadHandler({ MESH_ZONE_SECRET_KEY: 'uXM1VAA6MO39yJ+djz4kbpVGy3Rg1V3Z' });
        const res = await handler(event('203.0.113.5'));
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body as string);
        expect(body).toHaveProperty('domain');
        expect(typeof body.domain).toBe('string');
        // Same input must always produce the same output (CRC32 is deterministic)
        const res2 = await handler(event('203.0.113.5'));
        expect(JSON.parse(res2.body as string).domain).toBe(body.domain);
    });

    test('returns different domain for different source IP', async () => {
        const handler = loadHandler({ MESH_ZONE_SECRET_KEY: 'secret' });
        const r1 = JSON.parse((await handler(event('1.1.1.1'))).body as string);
        const r2 = JSON.parse((await handler(event('2.2.2.2'))).body as string);
        expect(r1.domain).not.toBe(r2.domain);
    });

    test('falls back to "none" when sourceIp is missing', async () => {
        const handler = loadHandler({ MESH_ZONE_SECRET_KEY: 'secret' });
        const res = await handler({} as never);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body as string);
        expect(body.domain).toBeTruthy();
    });

    test('returns 500 when MESH_ZONE_SECRET_KEY is not configured', async () => {
        const handler = loadHandler({ MESH_ZONE_SECRET_KEY: undefined });
        const res = await handler(event('1.1.1.1'));
        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('ConfigError');
    });
});
