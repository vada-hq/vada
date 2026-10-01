import type { DeliveryStatus } from '@vada/contracts'

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  unknown: '확인 불가', pending: '배송 예정', in_transit: '배송 중', delivered: '배송 완료', exception: '배송 문제',
}
// 택배사 목록 조회는 재정부 전용이다. 다른 구성원에게는 자주 쓰는 택배사만 이름으로 보여 주고 나머지는 ID를 그대로 표시한다.
const knownCarriers: Record<string, string> = {
  'kr.cjlogistics': 'CJ대한통운', 'kr.coupangls': '쿠팡 로지스틱스 서비스', 'kr.epost': '우체국택배',
  'kr.hanjin': '한진택배', 'kr.logen': '로젠택배', 'kr.lotte': '롯데택배',
}
export function carrierName(id: string, loaded: { id: string; name: string }[] = []) {
  return loaded.find(carrier => carrier.id === id)?.name ?? knownCarriers[id] ?? id
}
export const validTrackingNumber = (value: string) => /^[a-zA-Z0-9-]{1,100}$/.test(value)
