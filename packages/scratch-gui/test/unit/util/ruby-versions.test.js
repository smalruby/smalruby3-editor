import {VERSION_1, VERSION_2} from '../../../src/lib/settings/ruby-version';
import {detectRubyVersion, persistRubyVersion} from '../../../src/lib/settings/ruby-version/persistence';

describe('ruby versions', () => {
    const originalCookie = window.document.cookie;
    const originalDate = global.Date;

    beforeEach(() => {
        // Clear cookies
        const cookies = window.document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            window.document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
    });

    afterAll(() => {
        window.document.cookie = originalCookie;
        global.Date = originalDate;
    });

    describe('persistence', () => {
        test('returns the version stored in a cookie', () => {
            window.document.cookie = 'smalruby:rubyVersion=2';
            const version = detectRubyVersion();
            expect(version).toEqual(VERSION_2);
        });

        test('returns v1 before 2026-04-01 when no cookie', () => {
            const mockDate = new Date('2026-03-31T23:59:59Z');
            global.Date = class extends Date {
                constructor (arg) {
                    if (arg) return new originalDate(arg);
                    return mockDate;
                }
                static now () {
                    return mockDate.getTime();
                }
            };

            const version = detectRubyVersion();
            expect(version).toEqual(VERSION_1);
        });

        test('returns v2 after 2026-04-01 when no cookie', () => {
            const mockDate = new Date('2026-04-01T00:00:01Z');
            global.Date = class extends Date {
                constructor (arg) {
                    if (arg) return new originalDate(arg);
                    return mockDate;
                }
                static now () {
                    return mockDate.getTime();
                }
            };

            const version = detectRubyVersion();
            expect(version).toEqual(VERSION_2);
        });

        test('persists version to cookie', () => {
            persistRubyVersion(VERSION_2);
            // jsdom's document.cookie might not behave exactly like a real browser
            // but detectRubyVersion should be able to read what persistRubyVersion wrote.
            expect(detectRubyVersion()).toEqual(VERSION_2);
        });

        test('throws error for invalid version', () => {
            expect(() => persistRubyVersion(3)).toThrow('Invalid ruby version: 3');
        });
    });
});
