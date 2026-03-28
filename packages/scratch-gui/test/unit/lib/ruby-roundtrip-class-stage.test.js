import RubyGenerator from '../../../src/lib/ruby-generator'
import { makeStageTarget, makeConverter, setupRubyGenerator } from '../helpers/ruby-roundtrip-helper'

/**
 * Round trip: Ruby → Blocks → apply → Ruby (version 2, class Stage syntax)
 */
const classRoundTrip = async (converter, target, code, options = {}) => {
  const result = await converter.targetCodeToBlocks(target, code)
  if (!result) {
    throw new Error(`Failed to convert Ruby to blocks.\nErrors: ${JSON.stringify(converter.errors)}\nCode:\n${code}`)
  }
  await converter.applyTargetBlocks(target)
  RubyGenerator.currentTarget = target
  return RubyGenerator.targetToCode(target, { version: '2', ...options }).trim()
}

describe('Ruby Roundtrip: class Stage set_xxx', () => {
  let target, runtime, converter

  beforeEach(() => {
    ;({ target, runtime } = makeStageTarget())
    target.sprite = { name: 'Stage', costumes: [], sounds: [] }
    runtime.targets = [target]
    setupRubyGenerator()
    converter = makeConverter(target, runtime, { version: '2' })
  })

  test('set_current_backdrop round trip', async () => {
    const input = [
      'class Stage',
      '  set_current_backdrop 2',
      '',
      '  self.when(:flag_clicked) do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const expected = [
      'class Stage',
      '  set_current_backdrop 2',
      '',
      '  when_flag_clicked do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const generated = await classRoundTrip(converter, target, input)
    expect(generated).toBe(expected)
  })

  test('set_backdrops round trip', async () => {
    const input = [
      'class Stage',
      '  set_backdrops ["Arctic", "Baseball 1"]',
      '',
      '  self.when(:flag_clicked) do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const expected = [
      'class Stage',
      '  set_backdrops ["Arctic", "Baseball 1"]',
      '',
      '  when_flag_clicked do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const generated = await classRoundTrip(converter, target, input)
    expect(generated).toBe(expected)
  })

  test('set_sounds round trip', async () => {
    const input = [
      'class Stage',
      '  set_sounds ["Dog1", "Dog2"]',
      '',
      '  self.when(:flag_clicked) do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const expected = [
      'class Stage',
      '  set_sounds ["Dog1", "Dog2"]',
      '',
      '  when_flag_clicked do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const generated = await classRoundTrip(converter, target, input)
    expect(generated).toBe(expected)
  })

  test('set_backdrops and set_sounds round trip', async () => {
    const input = [
      'class Stage',
      '  set_backdrops ["Arctic", "Baseball 1"]',
      '  set_sounds ["Dog1", "Dog2"]',
      '',
      '  self.when(:flag_clicked) do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const expected = [
      'class Stage',
      '  set_backdrops ["Arctic", "Baseball 1"]',
      '  set_sounds ["Dog1", "Dog2"]',
      '',
      '  when_flag_clicked do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const generated = await classRoundTrip(converter, target, input)
    expect(generated).toBe(expected)
  })

  test('set_name round trip', async () => {
    const input = [
      'class Stage',
      '  set_name "ステージ"',
      '',
      '  self.when(:flag_clicked) do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const expected = [
      'class Stage',
      '  set_name "ステージ"',
      '',
      '  when_flag_clicked do',
      '    broadcast("message1")',
      '  end',
      'end',
    ].join('\n')
    const generated = await classRoundTrip(converter, target, input)
    expect(generated).toBe(expected)
  })

  test('version 1 uses Stage.new format', async () => {
    const input = ['self.when(:flag_clicked) do', '  broadcast("message1")', 'end'].join('\n')

    const result = await converter.targetCodeToBlocks(target, input)
    expect(result).toBeTruthy()
    await converter.applyTargetBlocks(target)
    RubyGenerator.currentTarget = target

    const generated = RubyGenerator.targetToCode(target, { version: '1', withSpriteNew: true }).trim()

    expect(generated).toMatch(/^Stage\.new/)
  })
})
