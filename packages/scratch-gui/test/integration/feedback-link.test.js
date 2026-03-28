import path from 'path'
import SeleniumHelper from '../helpers/selenium-helper'

const { findByText, getDriver, loadUri } = new SeleniumHelper()

const uri = path.resolve(__dirname, '../../build/index.html')

let driver

describe('Feedback link', () => {
  beforeAll(() => {
    driver = getDriver()
  })

  afterAll(async () => {
    await driver.quit()
  })

  test('Feedback link should be displayed', async () => {
    await loadUri(uri)
    const el = await findByText('Send feedback')
    expect(await el.isDisplayed()).toBe(true)
  })
})
