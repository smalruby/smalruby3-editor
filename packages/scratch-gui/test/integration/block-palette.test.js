/**
 * Integration tests for block palette features.
 * Consolidated from palette-toggle.test.js and only-blocks-filter.test.js
 * to reduce cold-start overhead.
 */
import path from 'path'
import SeleniumHelper from '../helpers/selenium-helper'

const {
  clickBlocksCategory,
  clickText,
  clickXpath,
  findByText,
  findByXpath,
  getDriver,
  getLogs,
  loadUri,
  scope,
  textExists,
} = new SeleniumHelper()

const uri = path.resolve(__dirname, '../../build/index.html')

let driver

describe('Block palette', () => {
  beforeAll(() => {
    driver = getDriver()
  })

  afterAll(async () => {
    await driver.quit()
  })

  describe('Palette toggle', () => {
    test('◀ button is visible when palette is open', async () => {
      await loadUri(uri)
      await clickText('Code')
      await findByXpath('//button[@title="ブロックパレットを隠す"]')
      const logs = await getLogs()
      expect(logs).toEqual([])
    })

    test('clicking ◀ hides the palette and shows ▶', async () => {
      await loadUri(uri)
      await clickText('Code')
      await clickXpath('//button[@title="ブロックパレットを隠す"]')
      await findByXpath('//button[@title="ブロックパレットを表示する"]')
      const toolboxVisible = await driver.executeScript(
        'const el = document.querySelector(".blocklyToolboxDiv"); return el ? el.style.display !== "none" : true;',
      )
      expect(toolboxVisible).toBe(false)
      const extensionButtonVisible = await driver.executeScript(
        'const el = document.querySelector(\'[class*="extension-button_extension-button-container"]\'); return el ? el.style.display !== "none" : false;',
      )
      expect(extensionButtonVisible).toBe(false)
      const logs = await getLogs()
      expect(logs).toEqual([])
    })

    test('clicking ▶ shows the palette again', async () => {
      await loadUri(uri)
      await clickText('Code')
      await clickXpath('//button[@title="ブロックパレットを隠す"]')
      await findByXpath('//button[@title="ブロックパレットを表示する"]')
      await clickXpath('//button[@title="ブロックパレットを表示する"]')
      await findByXpath('//button[@title="ブロックパレットを隠す"]')
      const toolboxVisible = await driver.executeScript(
        'const el = document.querySelector(".blocklyToolboxDiv"); return el ? el.style.display !== "none" : true;',
      )
      expect(toolboxVisible).toBe(true)
      const logs = await getLogs()
      expect(logs).toEqual([])
    })

    test('palette toggle works after switching sprite', async () => {
      await loadUri(uri)
      await clickText('Code')
      await clickXpath('//button[@title="ブロックパレットを隠す"]')
      await findByXpath('//button[@title="ブロックパレットを表示する"]')
      await clickText('Backdrops')
      await clickText('Code')
      await findByXpath('//button[@title="ブロックパレットを表示する"]')
      await clickXpath('//button[@title="ブロックパレットを表示する"]')
      await findByXpath('//button[@title="ブロックパレットを隠す"]')
      const logs = await getLogs()
      expect(logs).toEqual([])
    })
  })

  describe('only_blocks URL parameter filtering', () => {
    test('Shows all blocks when only_blocks parameter is not specified', async () => {
      await loadUri(uri)
      await clickText('Code')

      await clickBlocksCategory('Operators')
      await findByText('join', scope.blocksTab)

      const logs = await getLogs()
      expect(logs).toEqual([])
    })

    test('Shows only motion blocks when only_blocks=motion_', async () => {
      const testUri = `${uri}?only_blocks=motion_`
      await loadUri(testUri)
      await clickText('Code')

      await clickBlocksCategory('Motion')
      await findByText('10', scope.blocksTab)

      expect(await textExists('Variables', scope.blocksTab)).toBeTruthy()
      expect(await textExists('My Blocks', scope.blocksTab)).toBeTruthy()

      const logs = await getLogs()
      expect(logs).toEqual([])
    })

    test('Variables category is always visible regardless of filter', async () => {
      const testUri = `${uri}?only_blocks=motion_`
      await loadUri(testUri)
      await clickText('Code')

      await clickBlocksCategory('Variables')
      await findByText('my\u00A0variable', scope.blocksTab)

      const logs = await getLogs()
      expect(logs).toEqual([])
    })
  })
})
