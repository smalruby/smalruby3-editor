import {
  generateJoinCode,
  generateSessionToken,
  validateClassName,
  validateStudentCount,
  validateSeatNumber,
  validateNickname,
  validateJoinCode,
  validateProjectName,
  validateTeacherComment,
  validateScreenshotCount,
  getCorsHeaders,
} from '../handler';

describe('generateJoinCode', () => {
  test('should generate a 6-character code', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  test('should generate lowercase codes', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateJoinCode();
      expect(code).toBe(code.toLowerCase());
    }
  });

  test('should only contain allowed characters (no i, o, 0, 1)', () => {
    const forbidden = /[io01IO]/;
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      expect(code).not.toMatch(forbidden);
    }
  });

  test('should generate different codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateJoinCode());
    }
    // With 6-char codes from 30 chars, collision in 50 attempts is extremely unlikely
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe('generateSessionToken', () => {
  test('should generate a valid UUID', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('should generate unique tokens', () => {
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    expect(t1).not.toBe(t2);
  });
});

describe('validateClassName', () => {
  test('should accept valid class name', () => {
    expect(validateClassName('2年A組')).toBe('2年A組');
  });

  test('should trim whitespace', () => {
    expect(validateClassName('  2年A組  ')).toBe('2年A組');
  });

  test('should reject empty string', () => {
    expect(() => validateClassName('')).toThrow('Class name is required');
  });

  test('should reject whitespace-only string', () => {
    expect(() => validateClassName('   ')).toThrow('Class name is required');
  });

  test('should reject non-string', () => {
    expect(() => validateClassName(123)).toThrow('Class name is required');
  });

  test('should reject too long name', () => {
    const longName = 'a'.repeat(51);
    expect(() => validateClassName(longName)).toThrow('50 characters or less');
  });

  test('should accept name at max length', () => {
    const maxName = 'a'.repeat(50);
    expect(validateClassName(maxName)).toBe(maxName);
  });
});

describe('validateStudentCount', () => {
  test('should accept valid count', () => {
    expect(validateStudentCount(35)).toBe(35);
  });

  test('should accept string number', () => {
    expect(validateStudentCount('35')).toBe(35);
  });

  test('should accept 1', () => {
    expect(validateStudentCount(1)).toBe(1);
  });

  test('should accept 50', () => {
    expect(validateStudentCount(50)).toBe(50);
  });

  test('should reject 0', () => {
    expect(() => validateStudentCount(0)).toThrow('between 1 and 50');
  });

  test('should reject 51', () => {
    expect(() => validateStudentCount(51)).toThrow('between 1 and 50');
  });

  test('should reject negative', () => {
    expect(() => validateStudentCount(-1)).toThrow('between 1 and 50');
  });

  test('should reject NaN', () => {
    expect(() => validateStudentCount('abc')).toThrow('between 1 and 50');
  });
});

describe('validateSeatNumber', () => {
  test('should accept valid seat', () => {
    expect(validateSeatNumber(1, 35)).toBe(1);
    expect(validateSeatNumber(35, 35)).toBe(35);
  });

  test('should accept string number', () => {
    expect(validateSeatNumber('10', 35)).toBe(10);
  });

  test('should reject 0', () => {
    expect(() => validateSeatNumber(0, 35)).toThrow('between 1 and 35');
  });

  test('should reject over max', () => {
    expect(() => validateSeatNumber(36, 35)).toThrow('between 1 and 35');
  });
});

describe('validateNickname', () => {
  test('should accept valid nickname', () => {
    expect(validateNickname('たろう')).toBe('たろう');
  });

  test('should return undefined for empty', () => {
    expect(validateNickname('')).toBeUndefined();
    expect(validateNickname(undefined)).toBeUndefined();
    expect(validateNickname(null)).toBeUndefined();
  });

  test('should trim whitespace', () => {
    expect(validateNickname('  たろう  ')).toBe('たろう');
  });

  test('should reject too long nickname', () => {
    expect(() => validateNickname('a'.repeat(21))).toThrow('20 characters or less');
  });

  test('should reject non-string', () => {
    expect(() => validateNickname(123)).toThrow('Nickname must be a string');
  });
});

describe('validateJoinCode', () => {
  test('should accept valid 6-char lowercase code', () => {
    expect(validateJoinCode('abc234')).toBe('abc234');
  });

  test('should lowercase uppercase input', () => {
    expect(validateJoinCode('ABC234')).toBe('abc234');
  });

  test('should lowercase mixed case input', () => {
    expect(validateJoinCode('AbC234')).toBe('abc234');
  });

  test('should trim whitespace', () => {
    expect(validateJoinCode(' abc234 ')).toBe('abc234');
  });

  test('should reject wrong length', () => {
    expect(() => validateJoinCode('abc')).toThrow('6 characters');
    expect(() => validateJoinCode('abcdefg')).toThrow('6 characters');
  });

  test('should reject non-string', () => {
    expect(() => validateJoinCode(123456)).toThrow('6 characters');
  });

  test('should reject codes with invalid characters (0, 1, i, o)', () => {
    expect(() => validateJoinCode('abc001')).toThrow('invalid characters');
    expect(() => validateJoinCode('abcioo')).toThrow('invalid characters');
  });
});

describe('getCorsHeaders', () => {
  // CORS_ALLOWED_ORIGINS is captured at module load time,
  // so we test with the default value (empty string → '*' fallback)
  test('should return a valid origin header', () => {
    const headers = getCorsHeaders('http://localhost:8601');
    expect(headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  test('should not return attacker origin', () => {
    const headers = getCorsHeaders('https://evil.com');
    expect(headers['Access-Control-Allow-Origin']).not.toBe('https://evil.com');
  });

  test('should include Authorization in allowed headers', () => {
    const headers = getCorsHeaders('http://localhost:8601');
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  test('should include required methods', () => {
    const headers = getCorsHeaders();
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers['Access-Control-Allow-Methods']).toContain('DELETE');
  });
});

describe('validateProjectName', () => {
  test('should accept valid project name', () => {
    expect(validateProjectName('My Project')).toBe('My Project');
  });

  test('should trim whitespace', () => {
    expect(validateProjectName('  My Project  ')).toBe('My Project');
  });

  test('should reject empty string', () => {
    expect(() => validateProjectName('')).toThrow('Project name is required');
  });

  test('should reject non-string', () => {
    expect(() => validateProjectName(123)).toThrow('Project name is required');
  });

  test('should reject too long name', () => {
    expect(() => validateProjectName('a'.repeat(101))).toThrow('100 characters or less');
  });

  test('should accept name at max length', () => {
    const maxName = 'a'.repeat(100);
    expect(validateProjectName(maxName)).toBe(maxName);
  });
});

describe('validateTeacherComment', () => {
  test('should accept valid comment', () => {
    expect(validateTeacherComment('Good work!')).toBe('Good work!');
  });

  test('should trim whitespace', () => {
    expect(validateTeacherComment('  nice  ')).toBe('nice');
  });

  test('should accept empty string', () => {
    expect(validateTeacherComment('')).toBe('');
  });

  test('should return empty for null/undefined', () => {
    expect(validateTeacherComment(null)).toBe('');
    expect(validateTeacherComment(undefined)).toBe('');
  });

  test('should reject non-string', () => {
    expect(() => validateTeacherComment(123)).toThrow('Comment must be a string');
  });

  test('should reject too-long comment', () => {
    const long = 'a'.repeat(501);
    expect(() => validateTeacherComment(long)).toThrow('500 characters or less');
  });

  test('should accept comment at max length', () => {
    const maxComment = 'a'.repeat(500);
    expect(validateTeacherComment(maxComment)).toBe(maxComment);
  });
});

describe('validateScreenshotCount', () => {
  test('should accept valid count', () => {
    expect(validateScreenshotCount(5)).toBe(5);
  });

  test('should return 0 for undefined/null', () => {
    expect(validateScreenshotCount(undefined)).toBe(0);
    expect(validateScreenshotCount(null)).toBe(0);
  });

  test('should return 0 for negative', () => {
    expect(validateScreenshotCount(-1)).toBe(0);
  });

  test('should parse string number', () => {
    expect(validateScreenshotCount('3')).toBe(3);
  });

  test('should reject count over max', () => {
    expect(() => validateScreenshotCount(21)).toThrow('20 or less');
  });

  test('should accept max count', () => {
    expect(validateScreenshotCount(20)).toBe(20);
  });
});
