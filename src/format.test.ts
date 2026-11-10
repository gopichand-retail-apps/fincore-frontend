import { describe, expect, it } from 'vitest'
import { csvCell, formatDate, formatDateTime, formatMoney, formatMonth, parseMoneyToMinor } from './format'

describe('financial display helpers', () => {
  it('parses valid dollar input into exact integer minor units', () => {
    expect(parseMoneyToMinor('18')).toBe(1800)
    expect(parseMoneyToMinor('18.5')).toBe(1850)
    expect(parseMoneyToMinor('18,5', 'de-DE')).toBe(1850)
    expect(parseMoneyToMinor('0.01')).toBe(1)
    expect(parseMoneyToMinor('250000.00')).toBe(25_000_000)
  })

  it('rejects zero, malformed precision, and values beyond the transfer limit', () => {
    expect(parseMoneyToMinor('0')).toBeNull()
    expect(parseMoneyToMinor('-1.00')).toBeNull()
    expect(parseMoneyToMinor('12.345')).toBeNull()
    expect(parseMoneyToMinor('1.2.3')).toBeNull()
    expect(parseMoneyToMinor('250000.01')).toBeNull()
    expect(parseMoneyToMinor('$12.00')).toBeNull()
  })

  it('formats minor units as USD and escapes quotes in CSV cells', () => {
    expect(formatMoney(12345)).toBe('$123.45')
    expect(formatMoney(12345, 'CAD')).toContain('123.45')
    expect(csvCell('A "quoted" memo')).toBe('"A ""quoted"" memo"')
    expect(csvCell(123)).toBe('"123"')
  })

  it('neutralizes spreadsheet formulas without changing negative numeric cells', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"')
    expect(csvCell('+SUM(1,2)')).toBe('"\'+SUM(1,2)"')
    expect(csvCell('  @SUM(1,2)')).toBe('"\'  @SUM(1,2)"')
    expect(csvCell('-1+1')).toBe('"\'-1+1"')
    expect(csvCell('-12.34')).toBe('"-12.34"')
  })

  it('formats dates and money using the selected locale', () => {
    const timestamp = '2026-01-02T12:00:00.000Z'
    expect(formatDate(timestamp)).toContain('Jan 2, 2026')
    expect(formatDateTime(timestamp)).toContain('Jan 2, 2026')
    expect(formatDate(timestamp, 'de-DE')).not.toBe(formatDate(timestamp, 'en-US'))
    expect(formatMonth('2026-01', 'de-DE')).not.toBe(formatMonth('2026-01', 'en-US'))
    expect(formatMoney(12345, 'EUR', 'de-DE')).toContain('123,45')
    expect(() => formatMonth('2026/01')).toThrow('INVALID_MONTH')
  })
})
