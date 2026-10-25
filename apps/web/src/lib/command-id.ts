// 명령 번호(UUID v4, DEC-84). crypto.randomUUID는 안전하지 않은 출처(http LAN 주소)에는 없어서, 없으면 getRandomValues로 만든다.
const GROUPS = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/
const BYTES = 16
const HEX = 16
const BYTE_DIGITS = 2
const VERSION_MASK = 0x0f
const VERSION_4 = 0x40
const VARIANT_MASK = 0x3f
const VARIANT_RFC = 0x80

export function newCommandId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES))
  bytes[6] = ((bytes[6] ?? 0) & VERSION_MASK) | VERSION_4
  bytes[8] = ((bytes[8] ?? 0) & VARIANT_MASK) | VARIANT_RFC
  const hex = Array.from(bytes, byte => byte.toString(HEX).padStart(BYTE_DIGITS, '0')).join('')
  return hex.replace(GROUPS, '$1-$2-$3-$4-$5')
}
