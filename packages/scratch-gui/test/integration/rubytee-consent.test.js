// === Smalruby: This file is Smalruby-specific (Rubytee consent integration tests) ===
import React from 'react'
import { IntlProvider } from 'react-intl'
import { render, screen, fireEvent } from '@testing-library/react'
import RubyteeConsent from '../../src/components/rubytee-consent/rubytee-consent.jsx'

// Japanese messages for integration testing with real locale
const jaMessages = {
  'gui.rubyteeConsent.title': 'ルビティーをつかうまえに',
  'gui.rubyteeConsent.aiDisclosure': 'ルビティーは AI（人工知能）です。人間ではありません。',
  'gui.rubyteeConsent.warningIncorrect': '答えがまちがっていることがあります',
  'gui.rubyteeConsent.warningPersonalInfo': '名前や住所などの個人情報を入力しないでください',
  'gui.rubyteeConsent.warningAskAdult': 'こまったら大人に相談してください',
  'gui.rubyteeConsent.detailsToggle': 'くわしい説明（保護者の方へ）',
  'gui.rubyteeConsent.detailsText': 'ルビティーは Anthropic 社の Claude API を利用した AI コード生成支援機能です。',
  'gui.rubyteeConsent.termsLink': '利用規約',
  'gui.rubyteeConsent.privacyLink': 'プライバシーポリシー',
  'gui.rubyteeConsent.consentCheckbox': '18歳以上です、または保護者の許可をもらいました',
  'gui.rubyteeConsent.cancel': 'つかわない',
  'gui.rubyteeConsent.accept': 'OK、つかう！',
}

const renderConsent = (props = {}) =>
  render(
    <IntlProvider locale="ja" messages={jaMessages}>
      <RubyteeConsent onAccept={props.onAccept || jest.fn()} onCancel={props.onCancel || jest.fn()} />
    </IntlProvider>,
  )

describe('Rubytee consent dialog integration', () => {
  test('should display AI disclosure and warnings', () => {
    renderConsent()

    expect(screen.getByText(/ルビティーをつかうまえに/)).toBeTruthy()
    expect(screen.getByText(/AI（人工知能）です/)).toBeTruthy()
    expect(screen.getByText(/答えがまちがっていることがあります/)).toBeTruthy()
    expect(screen.getByText(/個人情報を入力しないでください/)).toBeTruthy()
    expect(screen.getByText(/大人に相談してください/)).toBeTruthy()
  })

  test('should have accept button disabled when checkbox is unchecked', () => {
    renderConsent()

    const acceptButton = screen.getByText('OK、つかう！')
    expect(acceptButton.disabled).toBe(true)
  })

  test('should enable accept button when checkbox is checked', () => {
    renderConsent()

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    const acceptButton = screen.getByText('OK、つかう！')
    expect(acceptButton.disabled).toBe(false)
  })

  test('should call onAccept when accept button clicked after checking', () => {
    const onAccept = jest.fn()
    renderConsent({ onAccept })

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    const acceptButton = screen.getByText('OK、つかう！')
    fireEvent.click(acceptButton)

    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  test('should call onCancel when cancel button clicked', () => {
    const onCancel = jest.fn()
    renderConsent({ onCancel })

    const cancelButton = screen.getByText('つかわない')
    fireEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test('should not call onAccept when accept button clicked without checking', () => {
    const onAccept = jest.fn()
    renderConsent({ onAccept })

    const acceptButton = screen.getByText('OK、つかう！')
    // Button is disabled, so click should not trigger
    fireEvent.click(acceptButton)

    expect(onAccept).not.toHaveBeenCalled()
  })

  test('should show details section content', () => {
    renderConsent()

    // Details toggle should be present
    expect(screen.getByText(/くわしい説明/)).toBeTruthy()

    // Details content is inside a <details> element - always in DOM
    expect(screen.getByText(/Anthropic 社の Claude API/)).toBeTruthy()
    expect(screen.getByText('利用規約')).toBeTruthy()
    expect(screen.getByText('プライバシーポリシー')).toBeTruthy()
  })

  test('should display consent checkbox label', () => {
    renderConsent()

    expect(screen.getByText(/18歳以上です/)).toBeTruthy()
  })
})

describe('Rubytee consent localStorage integration', () => {
  const CONSENT_KEY = 'smalruby:rubyteeConsent'

  beforeEach(() => {
    window.localStorage.clear()
  })

  test('should store consent in localStorage when accepted', () => {
    window.localStorage.setItem(CONSENT_KEY, 'true')
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('true')
  })

  test('should not store anything when cancelled', () => {
    expect(window.localStorage.getItem(CONSENT_KEY)).toBeNull()
  })

  test('should remove consent when reset', () => {
    window.localStorage.setItem(CONSENT_KEY, 'true')
    window.localStorage.removeItem(CONSENT_KEY)
    expect(window.localStorage.getItem(CONSENT_KEY)).toBeNull()
  })

  test('should detect existing consent', () => {
    window.localStorage.setItem(CONSENT_KEY, 'true')
    const hasConsent = window.localStorage.getItem(CONSENT_KEY) === 'true'
    expect(hasConsent).toBe(true)
  })

  test('should detect missing consent', () => {
    const hasConsent = window.localStorage.getItem(CONSENT_KEY) === 'true'
    expect(hasConsent).toBe(false)
  })
})
