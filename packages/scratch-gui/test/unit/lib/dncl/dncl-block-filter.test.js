import {
  isDnclAllowedBlock,
  isDnclHiddenCategory,
} from '../../../../src/lib/dncl/dncl-block-filter'

describe('isDnclAllowedBlock', () => {
  test('allows event_whenflagclicked', () => {
    expect(isDnclAllowedBlock('event_whenflagclicked')).toBe(true)
  })

  test('rejects event_whenkeypressed', () => {
    expect(isDnclAllowedBlock('event_whenkeypressed')).toBe(false)
  })

  test('allows all operator blocks via prefix', () => {
    expect(isDnclAllowedBlock('operator_add')).toBe(true)
    expect(isDnclAllowedBlock('operator_equals')).toBe(true)
    expect(isDnclAllowedBlock('operator_random')).toBe(true)
  })

  test('allows control_if but not control_forever', () => {
    expect(isDnclAllowedBlock('control_if')).toBe(true)
    expect(isDnclAllowedBlock('control_if_else')).toBe(true)
    expect(isDnclAllowedBlock('control_forever')).toBe(false)
  })

  test('allows looks_say but not looks_show', () => {
    expect(isDnclAllowedBlock('looks_say')).toBe(true)
    expect(isDnclAllowedBlock('looks_sayforsecs')).toBe(true)
    expect(isDnclAllowedBlock('looks_show')).toBe(false)
  })

  test('allows sensing_askandwait but not sensing_touchingobject', () => {
    expect(isDnclAllowedBlock('sensing_askandwait')).toBe(true)
    expect(isDnclAllowedBlock('sensing_answer')).toBe(true)
    expect(isDnclAllowedBlock('sensing_touchingobject')).toBe(false)
  })

  test('allows all data blocks', () => {
    expect(isDnclAllowedBlock('data_setvariableto')).toBe(true)
    expect(isDnclAllowedBlock('data_addtolist')).toBe(true)
    expect(isDnclAllowedBlock('data_lengthoflist')).toBe(true)
  })

  test('rejects all motion blocks', () => {
    expect(isDnclAllowedBlock('motion_movesteps')).toBe(false)
    expect(isDnclAllowedBlock('motion_turnright')).toBe(false)
  })

  test('rejects all sound blocks', () => {
    expect(isDnclAllowedBlock('sound_play')).toBe(false)
  })

  test('allows procedure blocks', () => {
    expect(isDnclAllowedBlock('procedures_definition')).toBe(true)
    expect(isDnclAllowedBlock('procedures_call')).toBe(true)
  })
})

describe('isDnclHiddenCategory', () => {
  test('hides motion category', () => {
    expect(isDnclHiddenCategory('motion')).toBe(true)
  })

  test('hides sound category', () => {
    expect(isDnclHiddenCategory('sound')).toBe(true)
  })

  test('does not hide control', () => {
    expect(isDnclHiddenCategory('control')).toBe(false)
  })

  test('does not hide operators', () => {
    expect(isDnclHiddenCategory('operators')).toBe(false)
  })
})
