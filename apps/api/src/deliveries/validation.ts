import { ApiError } from '../http/errors.js'

export class DeliveryError extends ApiError {}
export function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value)) throw new DeliveryError('INVALID_INPUT')
  return value.trim()
}
