import type { DeliveryLookupRequest, RegisterShipmentRequest, UnlinkShipmentRequest } from '@vada/contracts'

export class DeliveryError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 409 | 429 | 502 | 503 = 400) { super(code) }
}
export function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value)) throw new DeliveryError('INVALID_INPUT')
  return value.trim()
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new DeliveryError('INVALID_INPUT')
  return value as Record<string, unknown>
}
function shipment(value: Record<string, unknown>): DeliveryLookupRequest {
  const carrierId = text(value.carrierId, 100)
  const trackingNumber = text(value.trackingNumber, 100)
  // 자릿수로 택배사를 추정하거나 송장번호를 숫자로 변환하지 않는다.
  if (!/^[a-zA-Z0-9._-]+$/.test(carrierId) || !/^[a-zA-Z0-9-]+$/.test(trackingNumber)) throw new DeliveryError('INVALID_INPUT')
  return { carrierId, trackingNumber }
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 50) throw new DeliveryError('INVALID_INPUT')
  const result = value.map(id => text(id))
  if (new Set(result).size !== result.length) throw new DeliveryError('INVALID_INPUT')
  return result.sort()
}
export function parseLookup(value: unknown): DeliveryLookupRequest { return shipment(object(value, ['carrierId', 'trackingNumber'])) }
export function parseRegister(value: unknown): RegisterShipmentRequest {
  const body = object(value, ['carrierId', 'trackingNumber', 'purchaseItemIds', 'idempotencyKey'])
  return { ...shipment(body), purchaseItemIds: ids(body.purchaseItemIds), idempotencyKey: text(body.idempotencyKey, 128) }
}
export function parseUnlink(value: unknown): UnlinkShipmentRequest { return { linkIds: ids(object(value, ['linkIds']).linkIds) } }
