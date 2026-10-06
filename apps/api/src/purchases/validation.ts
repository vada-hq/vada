import type { CreatePurchaseDraftRequest, DecidePurchaseRequest, PurchaseItemFields, UpdatePurchaseDraftRequest } from '@vada/contracts'

import { ApiError } from '../http/errors.js'

export class PurchaseError extends ApiError {}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PurchaseError('INVALID_INPUT')
  return value as Record<string, unknown>
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new PurchaseError('INVALID_INPUT')
}
export function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max || /[\u0000\uD800-\uDFFF]/u.test(value)) throw new PurchaseError('INVALID_INPUT')
  return value.trim()
}
function nullableText(value: unknown) { return value === null || value === '' ? null : text(value) }
export function integer(value: unknown, min: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > 2147483647) throw new PurchaseError('INVALID_INPUT')
  return value
}
export function date(value: unknown): string | null {
  if (value === null) return null
  const result = text(value, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || result.startsWith('0000') || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) throw new PurchaseError('INVALID_INPUT')
  return result
}
export function productUrl(value: unknown): string {
  let url: URL
  try { url = new URL(text(value, 4096)) } catch { throw new PurchaseError('INVALID_PRODUCT_LINK') }
  if (url.protocol !== 'https:' || !['www.coupang.com', 'coupang.com'].includes(url.hostname) || url.port || url.username || url.password || !/^\/vp\/products\/\d+\/?$/.test(url.pathname)) throw new PurchaseError('INVALID_PRODUCT_LINK')
  const result = new URL(`https://www.coupang.com${url.pathname.replace(/\/$/, '')}`)
  for (const key of ['itemId', 'vendorItemId']) {
    const values = url.searchParams.getAll(key)
    if (values.length > 1 || (values[0] !== undefined && !/^\d+$/.test(values[0]))) throw new PurchaseError('INVALID_PRODUCT_LINK')
    if (values[0]) result.searchParams.set(key, values[0])
  }
  return result.href
}
export function parseCreate(value: unknown): CreatePurchaseDraftRequest {
  const body = object(value)
  keys(body, ['idempotencyKey', 'links'])
  const idempotencyKey = text(body.idempotencyKey, 128)
  if (!Array.isArray(body.links) || body.links.length < 1 || body.links.length > 5) throw new PurchaseError('INVALID_INPUT')
  const links = body.links.map(productUrl)
  if (new Set(links).size !== links.length) throw new PurchaseError('DUPLICATE_LINK')
  return { idempotencyKey, links }
}
const itemKeys = ['productName', 'selectedOption', 'optionRequired', 'quantity', 'packagingUnit', 'estimatedUnitPrice']
export function parseItemFields(value: unknown, partial = false): Partial<PurchaseItemFields> {
  const body = object(value)
  keys(body, itemKeys)
  if (!partial && itemKeys.some(key => !(key in body))) throw new PurchaseError('INVALID_INPUT')
  const result: Partial<PurchaseItemFields> = {}
  for (const key of ['productName', 'selectedOption', 'packagingUnit'] as const) if (key in body) result[key] = nullableText(body[key])
  for (const key of ['quantity', 'estimatedUnitPrice'] as const) if (key in body) result[key] = body[key] === null ? null : integer(body[key], key === 'quantity' ? 1 : 0)
  if ('optionRequired' in body) {
    if (body.optionRequired !== null && typeof body.optionRequired !== 'boolean') throw new PurchaseError('INVALID_INPUT')
    result.optionRequired = body.optionRequired
  }
  return result
}
export function parseUpdate(value: unknown): UpdatePurchaseDraftRequest {
  const body = object(value)
  keys(body, ['version', 'purpose', 'neededBy', 'estimatedShippingCost', 'items'])
  const result: UpdatePurchaseDraftRequest = { version: integer(body.version, 1) }
  if ('purpose' in body) result.purpose = nullableText(body.purpose)
  if ('neededBy' in body) result.neededBy = date(body.neededBy)
  if ('estimatedShippingCost' in body) result.estimatedShippingCost = body.estimatedShippingCost === null ? null : integer(body.estimatedShippingCost, 0)
  if ('items' in body) {
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 5) throw new PurchaseError('INVALID_INPUT')
    result.items = body.items.map(value => {
      const { id, ...rest } = object(value)
      if (Object.keys(rest).length === 0) throw new PurchaseError('INVALID_INPUT')
      return { id: text(id, 200), ...parseItemFields(rest, true) }
    })
    if (new Set(result.items.map(item => item.id)).size !== result.items.length) throw new PurchaseError('INVALID_INPUT')
  }
  if (Object.keys(result).length === 1) throw new PurchaseError('INVALID_INPUT')
  return result
}
export function parseVersion(value: unknown): number {
  const body = object(value); keys(body, ['version'])
  return integer(body.version, 1)
}
export function parseDecision(value: unknown): DecidePurchaseRequest {
  const body = object(value)
  keys(body, body.decision === 'rejected' ? ['version', 'decision', 'reason'] : ['version', 'decision'])
  const version = integer(body.version, 1)
  if (body.decision === 'approved') return { version, decision: 'approved' }
  if (body.decision !== 'rejected') throw new PurchaseError('INVALID_INPUT')
  try { return { version, decision: 'rejected', reason: text(body.reason) } }
  catch { throw new PurchaseError('INVALID_REJECTION_REASON') }
}
