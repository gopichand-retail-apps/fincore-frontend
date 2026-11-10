import { describe, expect, it } from 'vitest'
import {
  contentModelSchema,
  dataKeys,
  dataString,
  dataStringAt,
  dataStringFrom,
  dataStringRecord,
  errorMessage,
  ledgerEntryDescription,
  type Translate,
} from './content-schema'
import fincoreModel from '../public/fincore-model.json'

const model = contentModelSchema.parse(fincoreModel)
const translate: Translate = (key) => model.messages[key] ?? key

describe('content model accessors', () => {
  it('reads string, record, and nested record values', () => {
    expect(dataString(model, 'currency.code')).toBe('USD')
    expect(dataStringRecord(model, 'accountTypes').CHECKING).toBeTruthy()
    expect(dataStringFrom(model, 'accountNames', 'account-avery-checking')).toBeTruthy()
    expect(dataStringAt(model, 'demoProfiles', 'customer-avery', 'role')).toBe('CUSTOMER')
    expect(dataKeys(model, 'accountNames')).toContain('account-avery-checking')
  })

  it('rejects malformed or missing presentation data at every access boundary', () => {
    expect(() => dataString(model, 'accountNames')).toThrow('CONTENT_DATA_INVALID:accountNames')
    expect(() => dataString(model, 'missing')).toThrow('CONTENT_DATA_INVALID:missing')

    expect(() => dataStringRecord({ ...model, data: { ...model.data, broken: { entry: 1 } } }, 'broken')).toThrow(
      'CONTENT_DATA_INVALID:broken',
    )
    expect(() => dataStringFrom(model, 'accountNames', 'missing-account')).toThrow(
      'CONTENT_DATA_INVALID:accountNames.missing-account',
    )
    expect(() =>
      dataStringFrom({ ...model, data: { ...model.data, broken: 'not a record' } }, 'broken', 'key'),
    ).toThrow('CONTENT_DATA_INVALID:broken.key')
    expect(() => dataStringAt(model, 'demoProfiles', 'customer-avery', 'missing')).toThrow(
      'CONTENT_DATA_INVALID:demoProfiles.customer-avery.missing',
    )
    expect(() =>
      dataStringAt({ ...model, data: { ...model.data, broken: 'not a record' } }, 'broken', 'id', 'name'),
    ).toThrow('CONTENT_DATA_INVALID:broken.id.name')
    expect(() => dataKeys({ ...model, data: { ...model.data, broken: 'not a record' } }, 'broken')).toThrow(
      'CONTENT_DATA_INVALID:broken',
    )
  })

  it('maps transfer direction and ordinary ledger descriptions to presentation copy', () => {
    expect(
      ledgerEntryDescription(model, translate, {
        description: 'Monthly pay',
        amountMinor: 10_000,
      }),
    ).toBe(dataStringFrom(model, 'ledgerDescriptions', 'Monthly pay'))
    expect(
      ledgerEntryDescription(model, translate, {
        description: 'ignored',
        transferId: 'transfer-demo-001',
        amountMinor: -100,
      }),
    ).toBe(translate('ledger.transferSent'))
    expect(
      ledgerEntryDescription(model, translate, {
        description: 'ignored',
        transferId: 'transfer-demo-001',
        amountMinor: 0,
      }),
    ).toBe(translate('ledger.transferReceived'))
  })

  it('resolves known API errors and safely falls back for unknown errors', () => {
    expect(errorMessage(model, translate, { code: 'API_UNAVAILABLE' })).toBe(translate('errors.API_UNAVAILABLE'))
    expect(errorMessage(model, translate, { code: 'NOT_IN_MODEL' })).toBe(translate('errors.requestFailed'))
    expect(errorMessage(model, translate, new Error('private server detail'))).toBe(translate('errors.requestFailed'))
    expect(errorMessage(model, translate, { code: 10 })).toBe(translate('errors.requestFailed'))
  })
})
