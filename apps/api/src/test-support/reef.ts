// 가짜 ReefAPI. 시험은 실제 네트워크에 닿지 않고, 서버가 보낸 요청(주소, 머리, 본문)을 그대로 남긴다.
type Respond = (signal: AbortSignal) => Response | Promise<Response>
interface ReefCall {
  url: string
  method: string
  headers: Headers
  body: string
}

export function fakeReef(respond: Respond) {
  const calls: ReefCall[] = []
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({
      url: input instanceof Request ? input.url : String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : '',
    })
    return respond(init?.signal ?? new AbortController().signal)
  }
  return { fetch: fetcher, calls }
}

type ReefItem = Record<string, unknown>
// 문서(reefapi.com/docs/coupang)의 검색 응답과 같은 칸 이름의 판매 단위 하나
export const reefItem = (values: ReefItem = {}): ReefItem => ({
  item_id: '11',
  product_id: '100',
  vendor_item_id: '91',
  name: '펜',
  price: 1000,
  price_display: '1,000',
  currency: 'KRW',
  list_price: null,
  discount_percent: null,
  in_stock: true,
  shipping: '무료배송',
  is_rocket: true,
  delivery_eta: '내일(토) 도착 보장',
  ...values,
})

// { ok, data, meta, error } 봉투. item·items를 주지 않으면 판매 단위 하나짜리 상품이다.
export function reefProduct({
  item = reefItem(),
  items = [item],
  shipping,
}: { item?: ReefItem | undefined; items?: ReefItem[]; shipping?: string } = {}) {
  const withShipping = (row: ReefItem) => (shipping ? { ...row, shipping } : row)
  return {
    ok: true,
    data: { item: withShipping(item), items: items.map(withShipping) },
    meta: { charged_credits: 2, latency_ms: 5000 },
    error: null,
  }
}
