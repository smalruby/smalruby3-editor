/**
 * Unit test replacing test/integration/removed-trademarks.test.js
 *
 * Verifies that Scratch trademark names are not present in the
 * sprite and costume library data files.
 */
import costumeLibraryContent from '../../../src/lib/libraries/costumes.json'
import spriteLibraryContent from '../../../src/lib/libraries/sprites.json'

const trademarkNames = ['Cat', 'Cat-Flying', 'Gobo', 'Pico', 'Pico Walking', 'Nano', 'Tera', 'Giga', 'Giga Walking']

describe('Removed trademarks (ex: Scratch Cat)', () => {
  test('Removed trademark sprites', () => {
    const spriteNames = spriteLibraryContent.map(sprite => sprite.name)
    for (const name of trademarkNames) {
      expect(spriteNames).not.toContain(name)
    }
  })

  test('Removed trademark costumes', () => {
    const costumeNames = costumeLibraryContent.map(costume => costume.name)
    for (const name of trademarkNames) {
      const matchingCostumes = costumeNames.filter(costumeName => costumeName.startsWith(`${name}-`))
      expect(matchingCostumes).toEqual([])
    }
  })
})
