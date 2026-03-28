import RubyGenerator from '../../../src/lib/ruby-generator'
import {
  makeSpriteTarget,
  makeStageTarget,
  makeConverter,
  setupRubyGenerator,
} from '../helpers/ruby-roundtrip-helper'

/**
 * Round trip: Ruby → Blocks → apply → Ruby (version 2, class syntax)
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

describe('Ruby Roundtrip: class superclass preservation', () => {
  describe('sprite classes', () => {
    let target, runtime, converter

    beforeEach(() => {
      ;({ target, runtime } = makeSpriteTarget())
      target.sprite = { name: 'Sprite1', costumes: [], sounds: [] }
      runtime.targets = [runtime.getTargetForStage(), target]
      setupRubyGenerator()
      converter = makeConverter(target, runtime, { version: '2' })
    })

    test('class Sprite1 < ::Smalruby3::Sprite round trip', async () => {
      const input = [
        'class Sprite1 < ::Smalruby3::Sprite',
        '  self.when(:flag_clicked) do',
        '    move(10)',
        '  end',
        'end',
      ].join('\n')
      const expected = [
        'class Sprite1 < ::Smalruby3::Sprite',
        '  when_flag_clicked do',
        '    move(10)',
        '  end',
        'end',
      ].join('\n')
      const result = await classRoundTrip(converter, target, input)
      expect(result).toBe(expected)
    })

    test('class Sprite1 < Smalruby3::Sprite round trip', async () => {
      const input = [
        'class Sprite1 < Smalruby3::Sprite',
        '  self.when(:flag_clicked) do',
        '    move(10)',
        '  end',
        'end',
      ].join('\n')
      const expected = [
        'class Sprite1 < Smalruby3::Sprite',
        '  when_flag_clicked do',
        '    move(10)',
        '  end',
        'end',
      ].join('\n')
      const result = await classRoundTrip(converter, target, input)
      expect(result).toBe(expected)
    })

    test('class Sprite1 < Foo round trip', async () => {
      const input = ['class Sprite1 < Foo', '  self.when(:flag_clicked) do', '    move(10)', '  end', 'end'].join(
        '\n',
      )
      const expected = ['class Sprite1 < Foo', '  when_flag_clicked do', '    move(10)', '  end', 'end'].join('\n')
      const result = await classRoundTrip(converter, target, input)
      expect(result).toBe(expected)
    })

    test('class Sprite1 < Sprite round trip', async () => {
      const input = ['class Sprite1 < Sprite', '  self.when(:flag_clicked) do', '    move(10)', '  end', 'end'].join(
        '\n',
      )
      const expected = ['class Sprite1 < Sprite', '  when_flag_clicked do', '    move(10)', '  end', 'end'].join('\n')
      const result = await classRoundTrip(converter, target, input)
      expect(result).toBe(expected)
    })

    test('class Sprite1 (no superclass) round trip', async () => {
      const input = ['class Sprite1', '  self.when(:flag_clicked) do', '    move(10)', '  end', 'end'].join('\n')
      const expected = ['class Sprite1', '  when_flag_clicked do', '    move(10)', '  end', 'end'].join('\n')
      const result = await classRoundTrip(converter, target, input)
      expect(result).toBe(expected)
    })

    test('class Cat < Foo with name= round trip', async () => {
      const input = ['class Cat < Foo', '  self.when(:flag_clicked) do', '    move(10)', '  end', 'end'].join('\n')
      target.sprite.name = 'Cat'
      const expected = ['class Cat < Foo', '  when_flag_clicked do', '    move(10)', '  end', 'end'].join('\n')
      const result = await classRoundTrip(converter, target, input)
      expect(result).toBe(expected)
    })
  })

  describe('stage classes', () => {
    let target, runtime, converter

    beforeEach(() => {
      ;({ target, runtime } = makeStageTarget())
      target.sprite = { name: 'Stage', costumes: [], sounds: [] }
      runtime.targets = [target]
      setupRubyGenerator()
      converter = makeConverter(target, runtime, { version: '2' })
    })

    test('class Stage < ::Smalruby3::Stage round trip (superclass stripped)', async () => {
      const input = [
        'class Stage < ::Smalruby3::Stage',
        '  self.when(:flag_clicked) do',
        '    switch_backdrop("Arctic")',
        '  end',
        'end',
      ].join('\n')
      // Stage superclass is not preserved in comment — always outputs without it
      const expected = [
        'class Stage',
        '  when_flag_clicked do',
        '    switch_backdrop("Arctic")',
        '  end',
        'end',
      ].join('\n')
      const result = await classRoundTrip(converter, target, input)
      expect(result).toBe(expected)
    })

    test('class Stage < Smalruby3::Stage round trip (superclass stripped)', async () => {
      const input = [
        'class Stage < Smalruby3::Stage',
        '  self.when(:flag_clicked) do',
        '    switch_backdrop("Arctic")',
        '  end',
        'end',
      ].join('\n')
      const expected = [
        'class Stage',
        '  when_flag_clicked do',
        '    switch_backdrop("Arctic")',
        '  end',
        'end',
      ].join('\n')
      const result = await classRoundTrip(converter, target, input)
      expect(result).toBe(expected)
    })

    test('class Stage < Foo is rejected', async () => {
      const input = [
        'class Stage < Foo',
        '  self.when(:flag_clicked) do',
        '    switch_backdrop("Arctic")',
        '  end',
        'end',
      ].join('\n')
      const result = await converter.targetCodeToBlocks(target, input)
      expect(result).toBe(false)
      expect(converter.errors.length).toBeGreaterThan(0)
    })
  })
})
