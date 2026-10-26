// 품목 링크의 판매처: 주소의 호스트에서 'www.'·'m.'을 뺀 것(022 정한 것 21). 저장하지 않고 링크로 센다.
// 사람이 적은 링크라 주소가 아니면 판매처가 없다.
const PREFIX = /^(?:www|m)\./

export function sellerOf(link: string) {
  try {
    const host = new URL(link).hostname
    return host === '' ? null : host.replace(PREFIX, '')
  } catch {
    return null
  }
}
