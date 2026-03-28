/**
 * Unit tests for rubytee-context.js
 *
 * Note: buildSystemInstruction was moved to infra/smalruby-rubytee-relay.
 * This file tests only buildStateSection, which builds the sprite/stage/vm
 * state JSON passed to the relay as stateContext.
 */
import { buildStateSection } from '../../../src/lib/rubytee-context'

describe('rubytee-context', () => {
  describe('buildStateSection', () => {
    test('should return empty string when all args are undefined', () => {
      const section = buildStateSection(undefined, undefined, undefined)
      expect(section).toBe('')
    })

    test('should include sprite section when sprite is provided', () => {
      const sprite = { name: 'Cat', x: 50, y: -30 }
      const section = buildStateSection(sprite, undefined, undefined)
      expect(section).toContain('現在編集中のスプライト')
      expect(section).toContain('Cat')
    })

    test('should include stage section when stage is provided', () => {
      const stage = { costumes: [], sounds: [] }
      const section = buildStateSection(undefined, stage, undefined)
      expect(section).toContain('ステージ')
    })

    test('should include vm extensions when extensions exist', () => {
      const vm = { extensions: ['music', 'pen'] }
      const section = buildStateSection(undefined, undefined, vm)
      expect(section).toContain('music')
      expect(section).toContain('pen')
    })

    test('should not include extensions when empty', () => {
      const vm = { extensions: [] }
      const section = buildStateSection(undefined, undefined, vm)
      expect(section).not.toContain('有効な拡張機能')
    })

    test('should format sprite state in markdown', () => {
      const sprite = { name: 'TestSprite', x: 10 }
      const section = buildStateSection(sprite, undefined, undefined)
      expect(section).toContain('### 現在編集中のスプライト: "TestSprite"')
    })

    test('should list costume names', () => {
      const sprite = { name: 'Cat', x: 0, y: 0, costumes: [{ name: 'コスチューム1' }, { name: 'コスチューム2' }] }
      const section = buildStateSection(sprite, undefined, undefined)
      expect(section).toContain('コスチューム1')
      expect(section).toContain('コスチューム2')
    })

    test('should show no-sound warning when sound list is empty', () => {
      const sprite = { name: 'Cat', x: 0, y: 0, sounds: [] }
      const section = buildStateSection(sprite, undefined, undefined)
      expect(section).toContain('play()')
    })

    test('should include current code when provided', () => {
      const sprite = { name: 'Cat', x: 0, y: 0, currentCode: 'when_flag_clicked do\n  move(10)\nend' }
      const section = buildStateSection(sprite, undefined, undefined)
      expect(section).toContain('when_flag_clicked')
    })
  })
})
