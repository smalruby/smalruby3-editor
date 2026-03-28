/* eslint-env jest */
import React from 'react'
import '@testing-library/jest-dom'
import { render, fireEvent } from '@testing-library/react'
import PaletteToggle from '../../../src/components/palette-toggle/palette-toggle.jsx'

describe('PaletteToggle', () => {
  test('renders ◀ when paletteVisible is true', () => {
    const { container } = render(<PaletteToggle paletteVisible onClick={() => {}} />)
    expect(container.querySelector('button').textContent).toBe('◀')
  })

  test('renders ▶ when paletteVisible is false', () => {
    const { container } = render(<PaletteToggle paletteVisible={false} onClick={() => {}} />)
    expect(container.querySelector('button').textContent).toBe('▶')
  })

  test('calls onClick when button is clicked', () => {
    const handleClick = jest.fn()
    const { container } = render(<PaletteToggle paletteVisible onClick={handleClick} />)
    fireEvent.click(container.querySelector('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('has correct title when paletteVisible is true', () => {
    const { container } = render(<PaletteToggle paletteVisible onClick={() => {}} />)
    expect(container.querySelector('button').title).toBe('ブロックパレットを隠す')
  })

  test('has correct title when paletteVisible is false', () => {
    const { container } = render(<PaletteToggle paletteVisible={false} onClick={() => {}} />)
    expect(container.querySelector('button').title).toBe('ブロックパレットを表示する')
  })
})
