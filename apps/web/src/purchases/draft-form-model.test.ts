import { expect, test } from 'vitest'
import { draft } from './purchase-test-fixtures'
import { createDraftValues, analyzeDraft, serializeDraft } from './draft-form-model'

test('unknown costs stay unknown while zero shipping is valid', () => {
  const values = createDraftValues(draft())
  expect(analyzeDraft(values).total).toBeNull()
  values.shipping = '0'
  expect(analyzeDraft(values)).toEqual({ invalid: false, missing: [], total: 23180 })
  values.items[0]!.estimatedUnitPrice = ''
  expect(analyzeDraft(values).total).toBeNull()
})

test.each(['-1', '0', '1.5', '2147483648', 'NaN'])('rejects invalid quantity %s', quantity => {
  const values = createDraftValues(draft())
  values.items[0]!.quantity = quantity
  expect(analyzeDraft(values).invalid).toBe(true)
})

test('checks required fields and option requirements independently of costs', () => {
  const values = createDraftValues(draft())
  values.purpose = ' '
  values.neededBy = ''
  values.items[0]!.optionRequired = null
  expect(analyzeDraft(values).missing).toEqual(['구매 목적', '필요한 날짜', '물품 1 옵션 필요 여부'])
  values.items[0]!.optionRequired = true
  values.items[0]!.selectedOption = ''
  expect(analyzeDraft(values).missing).toContain('물품 1 선택 옵션')
})

test('accepts numeric boundaries but does not report an unsafe total', () => {
  const values = createDraftValues(draft())
  values.shipping = '0'
  values.items[0]!.quantity = '2147483647'
  values.items[0]!.estimatedUnitPrice = '2147483647'
  expect(analyzeDraft(values).invalid).toBe(false)
  expect(analyzeDraft(values).total).toBeNull()
  values.shipping = '-1'
  expect(analyzeDraft(values).invalid).toBe(true)
})

test('serializes only editable fields and does not mutate the server response', () => {
  const request = draft(), values = createDraftValues(request)
  values.purpose = '  새 목적  '
  values.items[0]!.quantity = ''
  const result = serializeDraft(values, 3)
  expect(result.purpose).toBe('새 목적')
  expect(result.version).toBe(3)
  expect(result.estimatedShippingCost).toBeNull()
  expect(result.items?.[0]?.quantity).toBeNull()
  expect(Object.keys(result.items![0]!)).toEqual(['id', 'productName', 'selectedOption', 'optionRequired', 'quantity', 'packagingUnit', 'estimatedUnitPrice'])
  expect(request.items[0]!.quantity).toBe(2)
})
