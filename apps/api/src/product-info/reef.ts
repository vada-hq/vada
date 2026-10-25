import { z } from 'zod'
import type { ProductInfo } from '@vada/contracts'
import type { CoupangProduct } from './coupang-url.js'

// ReefAPI 쿠팡 상품 하나 보기(reefapi.com/docs/coupang, 한 번에 2 credits, 실패는 무료).
const PRODUCT_ENDPOINT = 'https://api.reefapi.com/coupang/v1/product'
// 사람이 기다릴 수 있는 한계(NN/g 10초). ReefAPI가 출구를 바꿔 다시 시도하므로 서버는 다시 부르지 않는다.
const TIMEOUT_MS = 10_000
// 문서 예시의 검색 응답이 2.5MB라 상품 응답도 넉넉히 잡고, 넘으면 읽다가 끊는다.
const BODY_MAX_BYTES = 5_242_880 // 5 MiB

// 결과 종류. 로그(성공률)와 화면의 까닭이 이것으로 갈린다. 원문 오류는 남기지 않는다.
export type LookupOutcome = 'ok' | 'not_found' | 'blocked' | 'timeout' | 'quota' | 'auth' | 'other'
export type LookupResult =
  { outcome: 'ok'; product: ProductInfo } | { outcome: Exclude<LookupOutcome, 'ok'> }
export type ProductLookup = (product: CoupangProduct) => Promise<LookupResult>

// 문서의 오류 코드(reefapi.com/docs#errors). 목록에 없는 코드는 other다.
const OUTCOME_OF_ERROR = new Map<string, Exclude<LookupOutcome, 'ok'>>([
  ['NOT_FOUND', 'not_found'],
  ['TARGET_BLOCKED', 'blocked'],
  ['UPSTREAM_TIMEOUT', 'timeout'],
  ['QUOTA_EXCEEDED', 'quota'],
  ['AUTH_FAILED', 'auth'],
])

// 문서가 상품 응답의 칸 이름을 검색 응답과 같다고만 적어서, 쓰는 칸만 보고 나머지는 버린다. 쓰는 칸의 모양이 다르면 other다.
const reefId = z.union([z.string().min(1), z.number().int().nonnegative()]).transform(String)
const won = z.number().int().nonnegative().nullish()
const ReefItem = z.object({
  item_id: reefId,
  vendor_item_id: reefId.nullish(),
  name: z.string().trim().min(1),
  price: won,
  list_price: won,
  shipping: z.string().nullish(),
  delivery_eta: z.string().nullish(),
  is_rocket: z.boolean().nullish(),
})
type ReefItem = z.infer<typeof ReefItem>
const ReefEnvelope = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: z.object({ item: ReefItem.nullish(), items: z.array(ReefItem).default([]) }),
  }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string() }) }),
])

// 서버 환경 변수의 키. 없으면 불러오기만 꺼지고 서버는 시작한다(휴대폰 알림 열쇠와 같은 선택 값).
export function reefKeyFrom(env: NodeJS.ProcessEnv) {
  return env.REEF_API_KEY?.trim() || null
}

// 본문을 상한까지만 읽는다. 넘으면 null이다.
async function bodyOf(response: Response) {
  if (Number(response.headers.get('content-length')) > BODY_MAX_BYTES) {
    await response.body?.cancel()
    return null
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.byteLength
    if (size > BODY_MAX_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(read.value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

const parsedJson = (body: string): unknown => {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

// 고른 판매 단위: 주소의 itemId(없으면 vendorItemId)와 같은 줄, 없으면 쿠팡이 맨 앞에 둔 것(기능 022 정한 것 14).
function selectedOf(rows: ReefItem[], first: ReefItem | null | undefined, wanted: CoupangProduct) {
  const matched = wanted.itemId
    ? rows.find(row => row.item_id === wanted.itemId)
    : wanted.vendorItemId
      ? rows.find(row => row.vendor_item_id === wanted.vendorItemId)
      : undefined
  return matched ?? first ?? rows[0]
}

function productOf(
  data: { item?: ReefItem | null | undefined; items: ReefItem[] },
  wanted: CoupangProduct,
): ProductInfo | null {
  const rows = data.items.length ? data.items : data.item ? [data.item] : []
  const selected = selectedOf(rows, data.item, wanted)
  if (!selected) return null
  return {
    name: selected.name,
    items: rows.map(row => ({
      itemId: row.item_id,
      name: row.name,
      price: row.price ?? null,
      listPrice: row.list_price ?? null,
    })),
    selectedItemId: selected.item_id,
    shipping: selected.shipping ?? null,
    deliveryEta: selected.delivery_eta ?? null,
    rocket: selected.is_rocket ?? false,
  }
}

async function resultOf(response: Response, wanted: CoupangProduct): Promise<LookupResult> {
  const body = await bodyOf(response)
  const envelope = ReefEnvelope.safeParse(body === null ? null : parsedJson(body))
  if (!envelope.success) return { outcome: 'other' }
  if (!envelope.data.ok)
    return { outcome: OUTCOME_OF_ERROR.get(envelope.data.error.code) ?? 'other' }
  const product = response.ok ? productOf(envelope.data.data, wanted) : null
  return product ? { outcome: 'ok', product } : { outcome: 'other' }
}

// ReefAPI에는 정규화한 상품 주소만 보낸다. 사람·학생회·메시지는 보내지 않는다(DEC-89).
export function createReefLookup({
  apiKey,
  fetcher = fetch,
  timeoutMs = TIMEOUT_MS,
}: {
  apiKey: string
  fetcher?: typeof fetch
  timeoutMs?: number
}): ProductLookup {
  return async product => {
    try {
      const response = await fetcher(PRODUCT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ product_id: product.url }),
        // 본문 읽기까지 같은 신호로 끊는다. 다른 곳으로 넘기면 키가 따라가지 않게 따라가지 않는다.
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      })
      return await resultOf(response, product)
    } catch (error) {
      return {
        outcome: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'other',
      }
    }
  }
}
