import { ApiError } from '../http/errors.js'

export class PurchaseError extends ApiError {}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PurchaseError('INVALID_INPUT')
  return value as Record<string, unknown>
}
export function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max || /[\u0000\uD800-\uDFFF]/u.test(value)) throw new PurchaseError('INVALID_INPUT')
  return value.trim()
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
