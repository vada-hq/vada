import type { ProductCatalog } from './catalog.js'

type Options = { concurrency?: number; onFailure?: () => void }

// 대화에 쿠팡 링크가 올라오면 뒤에서 상품을 조회한다. 서버 한 대에서 동시에 concurrency개까지만 부른다(ReefAPI 키당 초당 약 5회).
export function createLookupRunner(catalog: Pick<ProductCatalog, 'claim' | 'process'>,
  { concurrency = 2, onFailure = () => console.error('PRODUCT_LOOKUP_RUNNER_FAILED') }: Options = {}) {
  let running: Promise<void> | null = null
  let again = false
  async function drain() {
    do {
      again = false
      for (let batch = await catalog.claim(concurrency); batch.length; batch = await catalog.claim(concurrency)) {
        await Promise.all(batch.map(product => catalog.process(product)))
      }
    } while (again)
  }
  // 이미 비우는 중이면 그 실행을 돌려주고, 끝난 뒤 한 번 더 확인하게 한다.
  function kick(): Promise<void> {
    if (running) { again = true; return running }
    running = drain().catch(() => onFailure()).finally(() => { running = null })
    return running
  }
  return {
    kick,
    // 재시도할 때가 된 상품을 주기적으로 확인한다. 서버가 잠들면 멈췄다가 깨어나면 이어서 한다.
    start(intervalMs = 60_000) {
      void kick()
      const timer = setInterval(() => { void kick() }, intervalMs)
      timer.unref?.()
      return () => clearInterval(timer)
    },
  }
}
