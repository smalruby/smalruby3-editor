import {
  getCorsHeaders,
  normalizeEmail,
  verifyIdToken,
  verifyMicrosoftIdToken,
  isBootstrapAdmin,
  validateDescription,
  validateProjectName,
  validateScreenshotCount,
  validateUserAgent,
  validateAppContext,
  validateStatus,
  validateDeveloperReply,
  validateAdminEmail,
} from '../handler';

describe('getCorsHeaders', () => {
  test('echoes an allowed origin', () => {
    // CORS_ALLOWED_ORIGINS defaults to '' (split → ['']) in unit env, so set it.
    process.env.CORS_ALLOWED_ORIGINS = 'https://smalruby.app,http://localhost:8601';
    jest.resetModules();
    const { getCorsHeaders: fresh } = require('../handler');
    const headers = fresh('http://localhost:8601');
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:8601');
  });

  test('falls back to the first allowed origin for an unknown origin', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://smalruby.app,http://localhost:8601';
    jest.resetModules();
    const { getCorsHeaders: fresh } = require('../handler');
    const headers = fresh('https://evil.example.com');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://smalruby.app');
  });

  test('does not advertise the X-Google-Access-Token header', () => {
    const headers = getCorsHeaders();
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization');
  });
});

describe('normalizeEmail', () => {
  test('trims and lowercases', () => {
    expect(normalizeEmail('  Foo@Example.COM ')).toBe('foo@example.com');
  });
});

describe('validateDescription', () => {
  test('accepts a normal description', () => {
    expect(validateDescription('  ブロックが消える ')).toBe('ブロックが消える');
  });

  test('rejects empty / whitespace / non-string', () => {
    expect(() => validateDescription('')).toThrow('description is required');
    expect(() => validateDescription('   ')).toThrow('description is required');
    expect(() => validateDescription(123)).toThrow('description is required');
  });

  test('rejects too-long description', () => {
    expect(() => validateDescription('a'.repeat(2001))).toThrow('2000 characters or less');
  });
});

describe('validateProjectName', () => {
  test('defaults blank to empty string', () => {
    expect(validateProjectName(undefined)).toBe('');
    expect(validateProjectName('')).toBe('');
  });

  test('rejects too-long name', () => {
    expect(() => validateProjectName('a'.repeat(101))).toThrow('100 characters or less');
  });
});

describe('validateScreenshotCount', () => {
  test('accepts 0..20', () => {
    expect(validateScreenshotCount(0)).toBe(0);
    expect(validateScreenshotCount(20)).toBe(20);
    expect(validateScreenshotCount(undefined)).toBe(0);
  });

  test('rejects out of range', () => {
    expect(() => validateScreenshotCount(-1)).toThrow('between 0 and 20');
    expect(() => validateScreenshotCount(21)).toThrow('between 0 and 20');
  });
});

describe('validateUserAgent', () => {
  test('truncates to 500 chars', () => {
    expect(validateUserAgent('x'.repeat(600))).toHaveLength(500);
  });
  test('blank → empty', () => {
    expect(validateUserAgent(undefined)).toBe('');
  });
});

describe('validateAppContext', () => {
  test('accepts a small object', () => {
    expect(validateAppContext({ rubyVersion: 2, mode: 'ruby' })).toEqual({ rubyVersion: 2, mode: 'ruby' });
  });
  test('undefined passes through', () => {
    expect(validateAppContext(undefined)).toBeUndefined();
  });
  test('rejects arrays and oversized objects', () => {
    expect(() => validateAppContext([1, 2])).toThrow('must be an object');
    expect(() => validateAppContext({ big: 'a'.repeat(2001) })).toThrow('too large');
  });
});

describe('validateStatus', () => {
  test('accepts the four valid statuses', () => {
    ['open', 'in_progress', 'resolved', 'wont_fix'].forEach(s => expect(validateStatus(s)).toBe(s));
  });
  test('rejects unknown status', () => {
    expect(() => validateStatus('closed')).toThrow('status must be one of');
  });
});

describe('validateDeveloperReply', () => {
  test('blank → empty', () => {
    expect(validateDeveloperReply(undefined)).toBe('');
  });
  test('rejects too long', () => {
    expect(() => validateDeveloperReply('a'.repeat(2001))).toThrow('2000 characters or less');
  });
});

describe('validateAdminEmail', () => {
  test('normalizes a valid email', () => {
    expect(validateAdminEmail('Teacher@Example.com')).toBe('teacher@example.com');
  });
  test('rejects malformed', () => {
    expect(() => validateAdminEmail('not-an-email')).toThrow('valid email');
    expect(() => validateAdminEmail(123)).toThrow('email is required');
  });
});

describe('isBootstrapAdmin', () => {
  beforeEach(() => {
    process.env.BOOTSTRAP_ADMIN_EMAILS = 'boss@example.com, owner@example.com';
    jest.resetModules();
  });
  test('matches a normalized bootstrap email', () => {
    const { isBootstrapAdmin: fresh } = require('../handler');
    expect(fresh('boss@example.com')).toBe(true);
    expect(fresh('owner@example.com')).toBe(true);
  });
  test('rejects non-bootstrap email and null', () => {
    const { isBootstrapAdmin: fresh } = require('../handler');
    expect(fresh('stranger@example.com')).toBe(false);
    expect(fresh(null)).toBe(false);
  });
});

describe('verifyIdToken (dev bypass)', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_TOKEN = 'dev-bypass';
    process.env.STAGE = 'stg';
    jest.resetModules();
  });

  test('dev bypass returns a synthetic identity in non-prod', async () => {
    const { verifyIdToken: fresh } = require('../handler');
    const id = await fresh('dev-bypass');
    expect(id).toEqual({ sub: 'dev-test-user', email: 'dev-test-user@example.com', provider: 'dev' });
  });

  test('dev bypass is ignored in prod', async () => {
    process.env.STAGE = 'prod';
    jest.resetModules();
    const { verifyIdToken: fresh } = require('../handler');
    // Falls through to Google verification of a non-JWT → AuthError.
    await expect(fresh('dev-bypass')).rejects.toThrow();
  });

  test('routes Microsoft issuer tokens to Microsoft verification', async () => {
    process.env.MICROSOFT_CLIENT_ID = 'ms-client';
    jest.resetModules();
    // After resetModules, jose is a fresh mock instance — configure THAT one,
    // since the re-required handler will import the same fresh instance.
    const jose = require('jose');
    jose.jwtVerify.mockResolvedValueOnce({
      payload: { iss: 'https://login.microsoftonline.com/common/v2.0', oid: 'ms-oid-1', email: 'ms@example.com' },
    });
    const mod = require('../handler');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: 'https://login.microsoftonline.com/common/v2.0' })).toString('base64url');
    const fakeMsToken = `${header}.${payload}.sig`;
    const id = await mod.verifyIdToken(fakeMsToken);
    expect(id.provider).toBe('microsoft');
    expect(id.sub).toBe('ms-oid-1');
  });
});

describe('verifyMicrosoftIdToken', () => {
  test('rejects a token with a non-Microsoft issuer', async () => {
    process.env.MICROSOFT_CLIENT_ID = 'ms-client';
    jest.resetModules();
    const jose = require('jose');
    jose.jwtVerify.mockResolvedValueOnce({ payload: { iss: 'https://accounts.google.com', oid: 'x' } });
    const { verifyMicrosoftIdToken: fresh } = require('../handler');
    await expect(fresh('whatever')).rejects.toThrow();
  });
});
