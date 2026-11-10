export function formatMoney(amountMinor: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 100)
}

export function formatDate(value: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}

export function formatDateTime(value: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatMonth(value: string, locale = 'en-US'): string {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new RangeError('INVALID_MONTH')
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`))
}

export function parseMoneyToMinor(value: string, locale = 'en-US'): number | null {
  const parts = value
    .trim()
    .split(new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.')
  if (parts.length > 2 || !/^(0|[1-9]\d{0,8})$/.test(parts[0])) return null
  if (parts[1] !== undefined && !/^\d{0,2}$/.test(parts[1])) return null
  const whole = BigInt(parts[0])
  const fraction = BigInt((parts[1] ?? '').padEnd(2, '0'))
  const minor = whole * 100n + fraction
  if (minor < 1n || minor > 25_000_000n) return null
  return Number(minor)
}

export function csvCell(value: string | number): string {
  const rawValue = String(value)
  const safeValue = typeof value === 'string' ? protectSpreadsheetFormula(rawValue) : rawValue
  const normalized = safeValue.replaceAll('"', '""')
  return `"${normalized}"`
}

function protectSpreadsheetFormula(value: string): string {
  const trimmed = value.trimStart()
  const formulaPrefix = /^[=+@]/.test(trimmed)
  const negativeExpression = trimmed.startsWith('-') && !/^-?\d+(?:\.\d+)?$/.test(trimmed)
  return formulaPrefix || negativeExpression ? `'${value}` : value
}
