import path from 'path'
import webdriver from 'selenium-webdriver'
import RubyHelper from '../helpers/ruby-helper'
import SeleniumHelper from '../helpers/selenium-helper'

const { until } = webdriver

const seleniumHelper = new SeleniumHelper()
const {
  /* eslint-disable no-unused-vars */
  clickText,
  clickButton,
  clickXpath,
  findByText,
  findByXpath,
  getDriver,
  getLogs,
  loadUri,
  waitForLoadingFinished,
  notExistsByXpath,
  rightClickText,
  scope,
  /* eslint-enable no-unused-vars */
} = seleniumHelper
const rubyHelper = new RubyHelper(seleniumHelper)
const { fillInRubyProgram, currentRubyProgram } = rubyHelper

const v2Uri = `${path.resolve(__dirname, '../../build/index.html')}?ruby_version=2`
const v1Uri = `${path.resolve(__dirname, '../../build/index.html')}?ruby_version=1`

const V1_CODE = 'self.when(:flag_clicked) do\\n  move(10)\\nend'
const V2_CODE = 'self.when_flag_clicked do\\n  move(10)\\nend'

let driver

describe('v1 code detection prompt', () => {
  beforeAll(() => {
    driver = getDriver()
  })

  afterAll(async () => {
    await driver.quit()
  })

  test('v2 mode + v1 code shows confirm dialog', async () => {
    await loadUri(v2Uri)
    await clickText('Ruby', '*[@role="tab"]')
    await fillInRubyProgram(V1_CODE)

    await clickText('Code', '*[@role="tab"]')

    // The confirm dialog should appear
    await driver.wait(until.alertIsPresent(), 5000)
    const alert = await driver.switchTo().alert()
    const text = await alert.getText()
    expect(text).toContain('v1')
    await alert.accept()
  })

  test('v1 mode + v1 code does NOT show confirm dialog', async () => {
    await loadUri(v1Uri)
    await clickText('Ruby', '*[@role="tab"]')
    await fillInRubyProgram(V1_CODE)

    await clickText('Code', '*[@role="tab"]')

    // No confirm dialog should appear; the code tab should become active
    await driver.sleep(1000)
    let alertPresent = false
    try {
      await driver.switchTo().alert()
      alertPresent = true
    } catch (_e) {
      // Expected: no alert
    }
    expect(alertPresent).toBe(false)
  })

  test('v2 mode + v2 code does NOT show confirm dialog', async () => {
    await loadUri(v2Uri)
    await clickText('Ruby', '*[@role="tab"]')
    await fillInRubyProgram(V2_CODE)

    await clickText('Code', '*[@role="tab"]')

    // No confirm dialog should appear
    await driver.sleep(1000)
    let alertPresent = false
    try {
      await driver.switchTo().alert()
      alertPresent = true
    } catch (_e) {
      // Expected: no alert
    }
    expect(alertPresent).toBe(false)
  })

  test('after dismiss, confirm is NOT shown again', async () => {
    await loadUri(v2Uri)
    await clickText('Ruby', '*[@role="tab"]')
    await fillInRubyProgram(V1_CODE)

    // First: click Code tab to trigger confirm, then dismiss it
    await clickText('Code', '*[@role="tab"]')
    await driver.wait(until.alertIsPresent(), 5000)
    const alert = await driver.switchTo().alert()
    await alert.dismiss()

    // Now enter v1 code again and switch to Code
    await fillInRubyProgram(V1_CODE)
    await clickText('Code', '*[@role="tab"]')

    // No confirm should appear this time (dismissed flag is on)
    await driver.sleep(1000)
    let alertPresent = false
    try {
      await driver.switchTo().alert()
      alertPresent = true
    } catch (_e) {
      // Expected: no alert
    }
    expect(alertPresent).toBe(false)
  })
})
