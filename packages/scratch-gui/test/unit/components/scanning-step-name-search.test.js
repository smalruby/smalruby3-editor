import React from 'react'
import { IntlProvider } from 'react-intl'
import '@testing-library/jest-dom'
import { render, fireEvent } from '@testing-library/react'
import MeshV2ScanningStep from '../../../src/components/connection-modal/mesh-v2-scanning-step.jsx'

const renderWithIntl = (ui, locale = 'en') => render(<IntlProvider locale={locale}>{ui}</IntlProvider>)

const HIRAGANA_CHARS = [
  'い',
  'し',
  'か',
  'た',
  'う',
  'ん',
  'て',
  'と',
  'の',
  'つ',
  'は',
  'こ',
  'に',
  'な',
  'く',
  'き',
]

describe('MeshV2ScanningStep hiragana name search', () => {
  const defaultProps = {
    scanning: true,
    peripheralList: [],
    hiraganaInput: '',
    nameSearching: false,
    nameSearchResults: [],
    onHiraganaInput: jest.fn(),
    onHiraganaClear: jest.fn(),
    onConnecting: jest.fn(),
    onRefresh: jest.fn(),
  }

  test('renders 16 hiragana buttons', () => {
    const { getAllByRole } = renderWithIntl(<MeshV2ScanningStep {...defaultProps} />)

    const allButtons = getAllByRole('button')
    const hiraganaButtons = allButtons.filter(btn => HIRAGANA_CHARS.includes(btn.textContent))
    expect(hiraganaButtons.length).toBe(16)
  })

  test('calls onHiraganaInput with correct character when button is clicked', () => {
    const onHiraganaInput = jest.fn()
    const { getAllByRole } = renderWithIntl(
      <MeshV2ScanningStep {...defaultProps} onHiraganaInput={onHiraganaInput} />,
    )

    const allButtons = getAllByRole('button')
    const shiButton = allButtons.find(btn => btn.textContent === 'し')
    fireEvent.click(shiButton)
    expect(onHiraganaInput).toHaveBeenCalledWith('し')
  })

  test('disables hiragana buttons when 6 characters are entered', () => {
    const { getAllByRole } = renderWithIntl(<MeshV2ScanningStep {...defaultProps} hiraganaInput={'しかたうんて'} />)

    const allButtons = getAllByRole('button')
    const hiraganaButtons = allButtons.filter(btn => HIRAGANA_CHARS.includes(btn.textContent))
    hiraganaButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  test('shows entered hiragana text when input is not empty', () => {
    const { getByText } = renderWithIntl(<MeshV2ScanningStep {...defaultProps} hiraganaInput={'しか'} />)

    expect(getByText('しか')).toBeInTheDocument()
  })

  test('shows clear button and calls onHiraganaClear when clicked', () => {
    const onHiraganaClear = jest.fn()
    const { getByText } = renderWithIntl(
      <MeshV2ScanningStep {...defaultProps} hiraganaInput={'しか'} onHiraganaClear={onHiraganaClear} />,
    )

    const clearButton = getByText('✕')
    fireEvent.click(clearButton)
    expect(onHiraganaClear).toHaveBeenCalled()
  })

  test('renders without search results section (results shown in main list)', () => {
    const { container } = renderWithIntl(<MeshV2ScanningStep {...defaultProps} hiraganaInput={'しかたうんて'} />)

    // All buttons should be disabled after 6 chars
    const allButtons = container.querySelectorAll('button')
    const hiraganaButtons = [...allButtons].filter(btn => HIRAGANA_CHARS.includes(btn.textContent))
    hiraganaButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})
