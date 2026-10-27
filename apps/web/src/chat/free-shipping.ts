// ReefAPI는 배송비를 숫자나 무료 여부 칸으로 주지 않고 쿠팡이 보인 배송 문구(shipping) 하나만 준다
// (delivery_badges·is_rocket은 속도라 배송비와 무관). 그래서 문구로 가르되, 틀리게 0원을 채우는 것보다 비워 두는 편이 낫다.
// 무료: '·' 같은 구분자로 나눈 조각 하나가 정확히 '무료배송'·'배송비 무료'이고, 나머지 조각이 모두 배송비와 무관한
// 아는 문구(출발·도착 때, 무료반품)일 때만. '와우는', '일부 지역 제외', '2만원부터'처럼 모르는 조각이 하나라도 있으면 조건일 수 있어 무료로 보지 않는다.
// 로켓배송·로켓프레시는 와우가 아니면 최소 주문 금액이 있어 아는 문구에 넣지 않는다.
const SEPARATOR = /[·∙•・|,]/
const FREE = new Set(['무료배송', '배송비무료'])
const DAY = String.raw`(오늘|내일|모레|\d{1,2}/\d{1,2})(\([월화수목금토일]\))?`
const HARMLESS = [
  new RegExp(String.raw`^${DAY}출발$`),
  new RegExp(String.raw`^(${DAY})?(새벽)?도착(예정|보장)?$`),
  /^무료반품$/,
]

export function freeForEveryone(shipping: string | null) {
  const parts = (shipping ?? '').split(SEPARATOR).map(part => part.replace(/\s+/g, ''))
  const free = parts.filter(part => FREE.has(part))
  const rest = parts.filter(part => !FREE.has(part) && part !== '')
  return free.length > 0 && rest.every(part => HARMLESS.some(pattern => pattern.test(part)))
}
