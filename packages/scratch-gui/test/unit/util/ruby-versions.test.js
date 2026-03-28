import { VERSION_1, VERSION_2 } from '../../../src/lib/settings/ruby-version'
import { detectRubyVersion, persistRubyVersion } from '../../../src/lib/settings/ruby-version/persistence'

const VERSION_KEY = 'smalruby:rubyVersion'
const MIGRATION_KEY = 'smalruby:rubyVersionMigratedToV2'

describe('ruby versions', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('persistence', () => {
    test('persists version to localStorage', () => {
      persistRubyVersion(VERSION_2)
      expect(window.localStorage.getItem(VERSION_KEY)).toEqual('2')
      expect(detectRubyVersion()).toEqual(VERSION_2)
    })

    test('throws error for invalid version', () => {
      expect(() => persistRubyVersion('3')).toThrow('Invalid ruby version: 3')
    })
  })

  describe('migration to v2', () => {
    test('new user (no localStorage) defaults to v2', () => {
      const version = detectRubyVersion()
      expect(version).toEqual(VERSION_2)
    })

    test('new user gets migration flag set', () => {
      detectRubyVersion()
      expect(window.localStorage.getItem(MIGRATION_KEY)).toEqual('true')
    })

    test('existing v1 user is migrated to v2', () => {
      window.localStorage.setItem(VERSION_KEY, '1')
      const version = detectRubyVersion()
      expect(version).toEqual(VERSION_2)
    })

    test('existing v1 user gets version persisted as v2', () => {
      window.localStorage.setItem(VERSION_KEY, '1')
      detectRubyVersion()
      expect(window.localStorage.getItem(VERSION_KEY)).toEqual('2')
    })

    test('existing v1 user gets migration flag set', () => {
      window.localStorage.setItem(VERSION_KEY, '1')
      detectRubyVersion()
      expect(window.localStorage.getItem(MIGRATION_KEY)).toEqual('true')
    })

    test('existing v2 user stays on v2', () => {
      window.localStorage.setItem(VERSION_KEY, '2')
      const version = detectRubyVersion()
      expect(version).toEqual(VERSION_2)
    })

    test('existing v2 user gets migration flag set', () => {
      window.localStorage.setItem(VERSION_KEY, '2')
      detectRubyVersion()
      expect(window.localStorage.getItem(MIGRATION_KEY)).toEqual('true')
    })

    test('already migrated user with v1 stays on v1 (no re-migration)', () => {
      window.localStorage.setItem(MIGRATION_KEY, 'true')
      window.localStorage.setItem(VERSION_KEY, '1')
      const version = detectRubyVersion()
      expect(version).toEqual(VERSION_1)
    })

    test('already migrated user with v2 stays on v2', () => {
      window.localStorage.setItem(MIGRATION_KEY, 'true')
      window.localStorage.setItem(VERSION_KEY, '2')
      const version = detectRubyVersion()
      expect(version).toEqual(VERSION_2)
    })

    test('already migrated user with no version defaults to v2', () => {
      window.localStorage.setItem(MIGRATION_KEY, 'true')
      const version = detectRubyVersion()
      expect(version).toEqual(VERSION_2)
    })
  })
})
