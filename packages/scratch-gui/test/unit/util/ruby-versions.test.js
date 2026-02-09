import {VERSION_1, VERSION_2} from '../../../src/lib/settings/ruby-version';
import {detectRubyVersion, persistRubyVersion} from '../../../src/lib/settings/ruby-version/persistence';

describe('ruby versions', () => {
    const originalDate = global.Date;

    beforeEach(() => {
        window.localStorage.clear();
    });

    afterAll(() => {
        global.Date = originalDate;
    });

    describe('persistence', () => {
        test('returns the version stored in localStorage', () => {
            window.localStorage.setItem('smalruby:rubyVersion', '2');
            const version = detectRubyVersion();
            expect(version).toEqual(VERSION_2);
        });

        test('returns v1 before 2026-04-01 when no preference', () => {
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

        test('returns v2 after 2026-04-01 when no preference', () => {
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

        test('persists version to localStorage', () => {
            persistRubyVersion(VERSION_2);
            expect(window.localStorage.getItem('smalruby:rubyVersion')).toEqual('2');
            expect(detectRubyVersion()).toEqual(VERSION_2);
        });

        test('throws error for invalid version', () => {
            expect(() => persistRubyVersion('3')).toThrow('Invalid ruby version: 3');
        });
    });
});