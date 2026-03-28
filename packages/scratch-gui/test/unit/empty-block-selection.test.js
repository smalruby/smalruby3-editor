/**
 * @file Test for empty block selection filtering behavior
 */
import makeToolboxXML from '../../src/lib/make-toolbox-xml'
import { defaultColors } from '../../src/lib/settings/color-mode'

describe('Empty block selection filtering', () => {
  test('should show no blocks when empty allowed patterns are provided', () => {
    const targetId = 'testSprite'

    const xml = makeToolboxXML(false, false, targetId, [], '', '', '', defaultColors, '', true)

    // When no blocks are selected, no core category blocks should be present
    expect(xml).not.toContain('type="motion_movesteps"')
    expect(xml).not.toContain('type="looks_say"')
    expect(xml).not.toContain('type="sound_play"')
    expect(xml).not.toContain('type="event_whenflagclicked"')
    expect(xml).not.toContain('type="control_wait"')
    expect(xml).not.toContain('type="sensing_touchingobject"')
    expect(xml).not.toContain('type="operator_add"')

    // Core categories should be completely hidden (not just empty)
    expect(xml).not.toContain('BKY_CATEGORY_MOTION')
    expect(xml).not.toContain('BKY_CATEGORY_LOOKS')
    expect(xml).not.toContain('BKY_CATEGORY_SOUND')
    expect(xml).not.toContain('BKY_CATEGORY_EVENTS')
    expect(xml).not.toContain('BKY_CATEGORY_CONTROL')
    expect(xml).not.toContain('BKY_CATEGORY_SENSING')
    expect(xml).not.toContain('BKY_CATEGORY_OPERATORS')

    // Variables and myBlocks categories should still be present (always visible)
    expect(xml).toContain('CATEGORY_VARIABLES')
    expect(xml).toContain('CATEGORY_MYBLOCKS')
  })

  test('should show all blocks when no only_blocks parameter is provided (null)', () => {
    const noPatterns = null
    const targetId = 'testSprite'

    const xml = makeToolboxXML(false, false, targetId, [], '', '', '', defaultColors, noPatterns, false)

    // When no only_blocks parameter is provided, all blocks should be present
    expect(xml).toContain('type="motion_movesteps"')
    expect(xml).toContain('type="looks_say"')
    expect(xml).toContain('type="sound_play"')
    expect(xml).toContain('type="event_whenflagclicked"')
    expect(xml).toContain('type="control_wait"')
    expect(xml).toContain('type="sensing_touchingobject"')
    expect(xml).toContain('type="operator_add"')
  })
})
