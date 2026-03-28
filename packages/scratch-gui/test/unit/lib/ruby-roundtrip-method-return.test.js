import Blocks from '@smalruby/scratch-vm/src/engine/blocks'
import Variable from '@smalruby/scratch-vm/src/engine/variable'
import RubyGenerator from '../../../src/lib/ruby-generator'
import ColourBlocks from '../../../src/lib/ruby-generator/colour.js'
import ControlBlocks from '../../../src/lib/ruby-generator/control.js'
import DataBlocks from '../../../src/lib/ruby-generator/data.js'
import EventBlocks from '../../../src/lib/ruby-generator/event.js'
import LooksBlocks from '../../../src/lib/ruby-generator/looks.js'
// Import all block generators
import MathBlocks from '../../../src/lib/ruby-generator/math.js'
import MotionBlocks from '../../../src/lib/ruby-generator/motion.js'
import OperatorsBlocks from '../../../src/lib/ruby-generator/operators.js'
import ProcedureBlocks from '../../../src/lib/ruby-generator/procedure.js'
import RubyBlocks from '../../../src/lib/ruby-generator/ruby.js'
import SensingBlocks from '../../../src/lib/ruby-generator/sensing.js'
import SoundBlocks from '../../../src/lib/ruby-generator/sound.js'
import TextBlocks from '../../../src/lib/ruby-generator/text.js'
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter'

describe('Ruby Roundtrip/Method Return', () => {
  let converter
  let target
  let runtime
  let vm

  beforeEach(() => {
    runtime = {
      emitProjectChanged: () => {},
      getTargetForStage: () => target,
    }
    target = {
      blocks: new Blocks(runtime),
      variables: {},
      lists: {},
      broadcastMsgs: {},
      comments: {},
      isStage: false,
      id: 'sprite1',
      createVariable: function (id, name, type) {
        this.variables[id] = new Variable(id, name, type)
      },
      lookupVariableByNameAndType: function (name, type) {
        for (const varId in this.variables) {
          const currVar = this.variables[varId]
          if (currVar.name === name && currVar.type === type) {
            return currVar
          }
        }
        return null
      },
      createComment: function (id, blockId, text, x, y, width, height, minimized) {
        this.comments[id] = {
          id,
          blockId,
          text,
          x,
          y,
          width,
          height,
          minimized,
        }
      },
    }
    vm = {
      runtime: runtime,
      emitWorkspaceUpdate: () => {},
    }
    converter = new RubyToBlocksConverter(vm)
    converter._context.target = target

    // Reset RubyGenerator state
    RubyGenerator.cache_ = {
      comments: {},
      targetCommentTexts: [],
    }
    RubyGenerator.definitions_ = {}
    RubyGenerator.functionNames_ = {}

    // Register all block generators
    MathBlocks(RubyGenerator)
    TextBlocks(RubyGenerator)
    ColourBlocks(RubyGenerator)
    MotionBlocks(RubyGenerator)
    LooksBlocks(RubyGenerator)
    SoundBlocks(RubyGenerator)
    EventBlocks(RubyGenerator)
    ControlBlocks(RubyGenerator)
    SensingBlocks(RubyGenerator)
    OperatorsBlocks(RubyGenerator)
    DataBlocks(RubyGenerator)
    ProcedureBlocks(RubyGenerator)
    RubyBlocks(RubyGenerator)
  })

  const rubyToBlocksToRuby = async code => {
    // Ruby -> Blocks
    const result = await converter.targetCodeToBlocks(target, code)

    if (!result) {
      throw new Error(`Failed to convert Ruby to blocks. Errors: ${JSON.stringify(converter.errors)}`)
    }

    // Apply the blocks to the target (async operation)
    await converter.applyTargetBlocks(target)

    // Blocks -> Ruby
    RubyGenerator.currentTarget = target
    const generatedCode = RubyGenerator.targetToCode(target)

    return generatedCode
  }

  describe('Test Cases from memo.md', () => {
    test('simple method with return value (from memo.md)', async () => {
      const inputCode = `def self.add(a, b)
  a + b
end

when_flag_clicked do
  say(add(1, 5))
end
`
      const outputCode = await rubyToBlocksToRuby(inputCode)

      // The output should preserve the method structure
      expect(outputCode).toContain('def self.add')
      expect(outputCode).toContain('a + b')
      expect(outputCode).toContain('say(add(1, 5))')
    })

    test('explicit return variable assignment (degression case from memo.md)', async () => {
      const inputCode = `def self.add(a, b)
  @_return_add = a + b
end

when_flag_clicked do
  add(1, 5)
  say(@_return_add)
end
`
      const outputCode = await rubyToBlocksToRuby(inputCode)

      // The method body should NOT be stripped
      expect(outputCode).toContain('def self.add')
      expect(outputCode).toContain('@_return_add = a + b')
      expect(outputCode).toContain('add(1, 5)')
      expect(outputCode).toContain('say(@_return_add)')

      // Should NOT result in an empty method body
      expect(outputCode).not.toMatch(/def self\.add\([^)]*\)\s*end/)
    })

    test('method with multiple statements and return value', async () => {
      const inputCode = `def self.calculate(x)
  say("Calculating...")
  x * 2
end

when_flag_clicked do
  say(calculate(5))
end
`
      const outputCode = await rubyToBlocksToRuby(inputCode)

      expect(outputCode).toContain('def self.calculate')
      expect(outputCode).toContain('say("Calculating...")')
      expect(outputCode).toContain('x * 2')
      expect(outputCode).toContain('say(calculate(5))')
    })

    test('method without return value', async () => {
      const inputCode = `def self.greet(name)
  say("Hello")
end

when_flag_clicked do
  greet("World")
end
`
      const outputCode = await rubyToBlocksToRuby(inputCode)

      expect(outputCode).toContain('def self.greet')
      expect(outputCode).toContain('say("Hello")')
      expect(outputCode).toContain('greet("World")')
    })

    test('def foo (without self) support', async () => {
      const inputCode = `def add(a, b)
  a + b
end

when_flag_clicked do
  say(add(1, 2))
end
`
      const outputCode = await rubyToBlocksToRuby(inputCode)

      // Output should be def self.add (existing behavior)
      expect(outputCode).toContain('def self.add')
      expect(outputCode).toContain('a + b')
      expect(outputCode).toContain('say(add(1, 2))')
    })
  })
})
