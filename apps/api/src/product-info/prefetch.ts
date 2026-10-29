import {
  bodyParts,
  coupangProductOf,
  coupangShortLinkOf,
  PURCHASE_ITEMS_MAX,
} from '@vada/contracts'
import type { createProductInfo } from './service.js'

export type ProductPrefetch = (body: string | null) => Promise<void>

// 앱 공유 단축 링크는 코드만 남긴 주소로 올리고, 푸는 것은 조회(service.ts)가 한다.
const prefetchLinkOf = (text: string) => coupangProductOf(text)?.url ?? coupangShortLinkOf(text)

// 메시지 전송 응답을 늦추지 않고 구매 양식이 쓸 상품을 준비한다. 외부 조회는 한 번에 하나만,
// 대기는 구매 요청의 품목 상한까지만 둔다. 밀린 링크는 사람이 열 때 기존 조회로 읽는다.
export function createProductPrefetch(
  productInfo: ReturnType<typeof createProductInfo>,
): ProductPrefetch {
  const queued = new Set<string>()
  let active: string | null = null
  let running: Promise<void> | null = null
  const drain = async () => {
    // 첫 await 뒤에만 작업을 시작해 running을 먼저 잡고, 큐를 비울 때 같은 실행에서 푼다.
    await Promise.resolve()
    for (const url of queued) {
      queued.delete(url)
      active = url
      try {
        await productInfo(url)
      } catch {
        // 조회 오류가 채팅 성공을 뒤집거나 처리되지 않은 거절이 되지 않게 한다.
      } finally {
        active = null
      }
    }
    running = null
  }
  return body => {
    for (const part of bodyParts(body ?? '')) {
      if (part.kind !== 'link') continue
      const link = prefetchLinkOf(part.text)
      if (link && link !== active && queued.size < PURCHASE_ITEMS_MAX) queued.add(link)
    }
    if (queued.size && !running) running = drain()
    return running ?? Promise.resolve()
  }
}
