import { createDraftGenerator } from '../src/purchases/generation.js'
import { createReefFetcher, lookupFor } from '../src/purchases/products.js'

// 명시적으로 실행할 때만 외부 유료 API를 호출한다. DB·실제 사용자 대화는 사용하지 않는다.
async function main() {
  if (['OPENAI_API_KEY', 'OPENAI_MODEL', 'REEF_API_KEY'].some(key => !process.env[key]?.trim())) {
    console.error('LIVE_CHECK: 설정 누락. OPENAI_API_KEY, OPENAI_MODEL, REEF_API_KEY를 확인하세요.')
    process.exitCode = 1
    return
  }
  const fetcher: typeof fetch = async (url, init) => {
    const response = await fetch(url, init)
    console.log(JSON.stringify({ provider: String(url).includes('reefapi.com') ? 'reef' : 'openai', status: response.status }))
    return response
  }
  const link = { productId: '7746622155', itemId: '20782129073', vendorItemId: '91657444188' }
  const fetched = await createReefFetcher(process.env.REEF_API_KEY, fetcher)(link.productId)
  const product = fetched.ok ? { status: 'ready' as const, items: fetched.items, fetchedAt: new Date(), errorCode: null }
    : { status: 'failed' as const, items: [], fetchedAt: null, errorCode: fetched.code }
  const generate = createDraftGenerator({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }, fetcher)
  const draft = await generate({
    eventName: '구매 초안 연결 검증',
    links: [`https://www.coupang.com/vp/products/${link.productId}?itemId=${link.itemId}&vendorItemId=${link.vendorItemId}`],
    products: [lookupFor(product, link)],
    messages: [{ id: 'live-check-message', createdAt: '2026-09-29T00:00:00.000Z',
      content: '2026년 10월 10일 학생회 행사 접수용으로 오브민 접이식 베드테이블 무광화이트 640 x 320 x 250mm 2개를 구매하자. 2026년 10월 9일까지 필요해.' }],
  })
  const item = draft.items[0]
  const checks = {
    productFetched: !!item?.productSnapshot,
    priceFromProduct: typeof item?.estimatedUnitPrice === 'number' && item.estimatedUnitPrice === item.productSnapshot?.price,
    quantity: item?.quantity === 2,
    option: !!item?.selectedOption?.includes('무광화이트'),
    // 용도·받을 날짜·근거는 품목마다 붙는다.
    neededBy: item?.neededBy === '2026-10-09',
    note: !!item?.note?.includes('접수'),
    source: !!item?.sourceMessageIds.includes('live-check-message'),
  }
  console.log(JSON.stringify({ checks, item: { name: item?.productName, option: item?.selectedOption, quantity: item?.quantity,
    price: item?.estimatedUnitPrice, note: item?.note, neededBy: item?.neededBy }, warnings: item?.warnings }))
  if (Object.values(checks).some(ok => !ok)) process.exitCode = 1
}

main().catch(error => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  console.error('LIVE_CHECK_FAILED', /^[A-Z_]+$/.test(code) ? code : 'UNEXPECTED')
  process.exitCode = 1
})
