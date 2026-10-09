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
