import type { ShipmentCarrier, ShipmentTrackingResponse, TrackingResult } from '@vada/contracts'
import type { DeliveryLookup, Parcel } from './provider.js'

const CACHE_MS = 600_000
const CACHE_MAX = 1000
// 택배사 공개 조회 화면. 서버는 호출하지 않고 사람에게 가는 길만 준다(DEC-74).
const TRACKING_PAGES: Record<ShipmentCarrier, string> = {
  'kr.coupangls': 'https://www.coupangls.com/',
  'kr.cjlogistics': 'https://www.cjlogistics.com/ko/tool/parcel/tracking',
  'kr.hanjin': 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038',
  'kr.lotte': 'https://www.lotteglogis.com/home/reservation/tracking/index',
  'kr.epost': 'https://service.epost.go.kr/iservice/usr/trace/usrtrc001k01.jsp',
  'kr.logen': 'https://www.ilogen.com/web/personal/trace',
}
export const trackingUrlOf = (carrier: ShipmentCarrier) => TRACKING_PAGES[carrier]
// 성공만 보관한다. 인증·학생회 확인 뒤에만 캐시를 읽는다.
export function createTracking({
  lookup,
  clock = () => new Date(),
}: {
  lookup?: DeliveryLookup | undefined
  clock?: () => Date
}) {
  const cache = new Map<string, { expires: number; result: TrackingResult }>()
  const pending = new Map<string, Promise<TrackingResult>>()
  async function fetchResult(parcel: Parcel): Promise<TrackingResult> {
    if (!lookup) return { lastEvent: null, reason: 'not_configured' }
    try {
      return await lookup(parcel)
    } catch {
      return { lastEvent: null, reason: 'provider_failed' }
    }
  }
  async function lookupCached(parcel: Parcel) {
    const key = `${parcel.carrierId}:${parcel.trackingNumber}`
    const now = clock().getTime()
    for (const [id, entry] of cache) if (entry.expires <= now) cache.delete(id)
    const saved = cache.get(key)
    if (saved) return saved.result
    const ongoing = pending.get(key)
    if (ongoing) return ongoing
    const job = fetchResult(parcel)
    pending.set(key, job)
    try {
      const result = await job
      if (result.reason === null) {
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
        cache.set(key, { expires: clock().getTime() + CACHE_MS, result })
      }
      return result
    } finally {
      pending.delete(key)
    }
  }
  return async (parcel: Parcel): Promise<ShipmentTrackingResponse> => ({
    ...(await lookupCached(parcel)),
    trackingUrl: trackingUrlOf(parcel.carrierId),
  })
}
