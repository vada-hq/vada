import { z } from 'zod'
import { productImageUrlOf, type ProductInfo } from '@vada/contracts'
import type { CoupangProduct } from './coupang-url.js'

// ReefAPI 쿠팡 상품 하나 보기(reefapi.com/docs/coupang, 한 번에 2 credits, 실패는 무료).
const PRODUCT_ENDPOINT = 'https://api.reefapi.com/coupang/v1/product'
// 사람이 기다릴 수 있는 한계(NN/g 10초) 안에서 일시 오류는 한 번 다시 부른다. 실패한 호출은 무료다.
const TIMEOUT_MS = 10_000
const RETRY_MIN_MS = 3_000
const RETRY_ATTEMPT = 2
// 문서 예시의 검색 응답이 2.5MB라 상품 응답도 넉넉히 잡고, 넘으면 읽다가 끊는다.
const BODY_MAX_BYTES = 5_242_880 // 5 MiB

// 결과 종류. 로그(성공률)와 화면의 까닭이 이것으로 갈린다. 원문 오류는 남기지 않는다.
export type LookupOutcome = 'ok' | 'not_found' | 'blocked' | 'timeout' | 'quota' | 'auth' | 'other'
type LookupValue =
  { outcome: 'ok'; product: ProductInfo } | { outcome: Exclude<LookupOutcome, 'ok'> }
type LookupDiag = { code?: string; status: number | null; attempts: number }
export type LookupResult = LookupValue & { diag?: LookupDiag }
// spentMs: 같은 요청에서 앞서 쓴 시간(단축 링크 풀기). 10초 예산에서 뺀다.
export type ProductLookup = (product: CoupangProduct, spentMs?: number) => Promise<LookupResult>
type AttemptResult = { result: LookupResult; retryable?: boolean }

// RATE_LIMITED·DISABLED는 곧 풀리는 일시 실패라 quota/auth 경고와 구분해 other로 두고 진단 코드로 가른다.
const OUTCOME_OF_ERROR = new Map<string, Exclude<LookupOutcome, 'ok'>>([
  ['NOT_FOUND', 'not_found'],
  ['TARGET_BLOCKED', 'blocked'],
  ['UPSTREAM_TIMEOUT', 'timeout'],
  ['QUOTA_EXCEEDED', 'quota'],
  ['AUTH_FAILED', 'auth'],
])
const RETRY_ERRORS = new Set(['UPSTREAM_HTTP', 'TARGET_BLOCKED', 'INTERNAL', 'PARSE_ERROR'])
const SAFE_ERROR_CODE = /^[A-Z_]{1,32}$/

// 쓰는 칸만 보고 나머지는 버린다(2026-10-25 실제 키로 칸 이름 확인). 판매 단위는 줄마다 따로 보아, 모양이 틀린 줄만 버린다.
// 한 상품에 판매 단위가 41개인 것도 있어 한 줄 때문에 전체를 못 불러오면 안 된다. 쓸 줄이 하나도 없으면 other다.
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
  image: z.unknown().optional(),
  in_stock: z.boolean().nullish().catch(null),
})
type ReefItem = z.infer<typeof ReefItem>
const ReefEnvelope = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: z.object({ item: z.unknown(), items: z.array(z.unknown()).default([]) }),
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({ code: z.string(), retryable: z.boolean().optional().catch(undefined) }),
  }),
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
    return undefined
  }
}

const itemOf = (value: unknown) => {
  const parsed = ReefItem.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

// 고른 판매 단위: 주소의 itemId(없으면 vendorItemId)와 같은 줄, 없으면 쿠팡이 맨 앞에 둔 것(기능 022 정한 것 14).
// 늘 목록 안의 줄을 돌려준다. 화면이 selectedItemId로 목록의 줄을 찾는다.
function selectedOf(rows: ReefItem[], first: ReefItem | undefined, wanted: CoupangProduct) {
  const matched = wanted.itemId
    ? rows.find(row => row.item_id === wanted.itemId)
    : wanted.vendorItemId
      ? rows.find(row => row.vendor_item_id === wanted.vendorItemId)
      : undefined
  return matched ?? rows.find(row => row.item_id === first?.item_id) ?? rows[0]
}

function productOf(
  data: { item: unknown; items: unknown[] },
  wanted: CoupangProduct,
): ProductInfo | null {
  const first = itemOf(data.item)
  const parsed = data.items.map(itemOf).filter(row => row !== undefined)
  const rows = parsed.length ? parsed : first ? [first] : []
  const selected = selectedOf(rows, first, wanted)
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
    imageUrl: productImageUrlOf(selected.image),
    inStock: selected.in_stock ?? null,
  }
}

function failureOf(
  diag: LookupDiag,
  code: string,
  outcome: Exclude<LookupOutcome, 'ok'> = 'other',
): LookupResult {
  return { outcome, diag: { ...diag, code } }
}

function errorOf(
  { code, retryable }: Extract<z.infer<typeof ReefEnvelope>, { ok: false }>['error'],
  diag: LookupDiag,
): AttemptResult {
  return {
    result: failureOf(
      diag,
      SAFE_ERROR_CODE.test(code) ? code : 'unknown',
      OUTCOME_OF_ERROR.get(code) ?? 'other',
    ),
    retryable: code !== 'RATE_LIMITED' && (retryable === true || RETRY_ERRORS.has(code)),
  }
}

async function resultOf(
  response: Response,
  wanted: CoupangProduct,
  diag: LookupDiag,
): Promise<AttemptResult> {
  const body = await bodyOf(response)
  if (body === null) return { result: failureOf(diag, 'too_large') }
  const json = parsedJson(body)
  if (json === undefined) return { result: failureOf(diag, 'non_json') }
  const envelope = ReefEnvelope.safeParse(json)
  if (!envelope.success) return { result: failureOf(diag, 'bad_shape') }
  if (!envelope.data.ok) return errorOf(envelope.data.error, diag)
  if (!response.ok) return { result: failureOf(diag, 'http_error') }
  const product = productOf(envelope.data.data, wanted)
  return { result: product ? { outcome: 'ok', product, diag } : failureOf(diag, 'no_rows') }
}

async function attemptOf(
  fetcher: typeof fetch,
  request: RequestInit,
  wanted: CoupangProduct,
  attempts: number,
): Promise<AttemptResult> {
  const diag: LookupDiag = { status: null, attempts }
  try {
    const response = await fetcher(PRODUCT_ENDPOINT, request)
    diag.status = response.status
    return await resultOf(response, wanted, diag)
  } catch (error) {
    const timedOut =
      request.signal?.aborted || (error instanceof Error && error.name === 'TimeoutError')
    return {
      result: failureOf(diag, timedOut ? 'timeout' : 'network', timedOut ? 'timeout' : 'other'),
    }
  }
}

// ReefAPI에는 정규화한 상품 주소만 보낸다. 사람·학생회·메시지는 보내지 않는다(DEC-89).
export function createReefLookup({
  apiKey,
  fetcher = fetch,
  timeoutMs = TIMEOUT_MS,
  now = Date.now,
}: {
  apiKey: string
  fetcher?: typeof fetch
  timeoutMs?: number
  now?: () => number
}): ProductLookup {
  return async (product, spentMs = 0) => {
    const budgetMs = Math.max(timeoutMs - spentMs, 0)
    const deadline = now() + budgetMs
    const signal = AbortSignal.timeout(budgetMs)
    const request: RequestInit = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ product_id: product.url }),
      // 두 시도와 본문 읽기를 같은 신호로 끊고, 다른 곳으로 넘길 때 키가 따라가지 않게 한다.
      signal,
      redirect: 'error',
    }
    const first = await attemptOf(fetcher, request, product, 1)
    if (!first.retryable || signal.aborted || deadline - now() < RETRY_MIN_MS) return first.result
    return (await attemptOf(fetcher, request, product, RETRY_ATTEMPT)).result
  }
}
