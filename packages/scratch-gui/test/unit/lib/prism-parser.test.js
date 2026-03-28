import { loadPrism } from '../../../src/lib/prism-parser'

describe('PrismParser', () => {
  test('it should parse ruby code', async () => {
    const prism = await loadPrism()
    const parseResult = prism.parse('move(10)')
    expect(parseResult).toBeDefined()
    expect(parseResult.errors).toHaveLength(0)
    expect(parseResult.value).toBeDefined()
    expect(parseResult.value.constructor.name).toBe('ProgramNode')
  })

  test('it should return errors for invalid ruby code', async () => {
    const prism = await loadPrism()
    const parseResult = prism.parse('move(')
    expect(parseResult.errors).not.toHaveLength(0)
  })
})
