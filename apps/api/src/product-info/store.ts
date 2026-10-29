import { eq, sql } from 'drizzle-orm'
import type { ProductInfo, ProductInfoResponse } from '@vada/contracts'
import { productInfo } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 저장하는 결과. unavailable(일시 실패)은 두지 않는다(0029).
type Stored = Extract<ProductInfoResponse, { product: ProductInfo } | { reason: 'not_found' }>

// 한 행의 상한. 실제 상품은 판매 단위 41개에 수 KB라 넉넉하다. 넘으면 고른 판매 단위를 먼저 두고 들어가는 만큼만 둔다.
// 저장하지 못하면 읽을 때마다 다시 불러 크레딧을 쓰므로, 버리지 않고 줄여서라도 둔다.
// DB의 CHECK(65,536바이트)는 jsonb 글자가 쉼표·쌍점 뒤에 띄어 쓰는 몫까지 잡은 마지막 막이다.
const PRODUCT_JSON_MAX_BYTES = 32_768
// 글 하나의 상한(상품명·배송 문구 등). 쿠팡 상품명은 100자 안팎이다. 이 상한이 있어 고른 판매 단위 하나는 늘 32KB 안에 든다.
const TEXT_MAX = 1000
const URL_MAX = 2048
// jsonb는 NUL과 홀로 쓰인 서러게이트를 받지 않는다. 저장이 실패하지 않게 NUL은 지우고 서러게이트는 U+FFFD로 바꾼다.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

const NUL = String.fromCharCode(0)
// U+FFFD REPLACEMENT CHARACTER
const REPLACEMENT_CODE = 0xfffd
const REPLACEMENT = String.fromCharCode(REPLACEMENT_CODE)

const cleanText = (value: string) =>
  value.replaceAll(NUL, '').slice(0, TEXT_MAX).replace(LONE_SURROGATE, REPLACEMENT)
const bytesOf = (value: unknown) => Buffer.byteLength(JSON.stringify(value))

function cleaned(product: ProductInfo): ProductInfo {
  return JSON.parse(
    JSON.stringify(product, (_key, value: unknown) =>
      typeof value === 'string' ? cleanText(value) : value,
    ),
  ) as ProductInfo
}

// 응답과 저장에 같이 쓰는 모양. 첫 응답과 저장값이 같도록 불러온 직후에 다듬는다.
export function storableProduct(product: ProductInfo): ProductInfo {
  const clean = cleaned(product)
  if (bytesOf(clean) <= PRODUCT_JSON_MAX_BYTES) return clean
  const items = clean.items.filter(item => item.itemId === clean.selectedItemId)
  const others = clean.items.filter(item => item.itemId !== clean.selectedItemId)
  let size = bytesOf({ ...clean, items })
  for (const item of others) {
    // 판매 단위 하나와 그 앞의 쉼표
    size += bytesOf(item) + 1
    if (size > PRODUCT_JSON_MAX_BYTES) break
    items.push(item)
  }
  return { ...clean, items }
}

const isStorable = (response: ProductInfoResponse): response is Stored =>
  response.product !== null || response.reason === 'not_found'

// 저장한 값을 응답 모양으로 준다. 가져온 시각은 저장한 시각이다.
export async function readStoredProduct(db: Db, url: string): Promise<ProductInfoResponse | null> {
  const [row] = await db
    .select({ product: productInfo.product, fetchedAt: productInfo.fetchedAt })
    .from(productInfo)
    .where(eq(productInfo.url, url))
  if (!row) return null
  if (row.product === null) return { product: null, reason: 'not_found' }
  const product = row.product as ProductInfo
  return { product: { ...product, fetchedAt: row.fetchedAt.toISOString() }, reason: null }
}

// 불러온 결과를 둔다. 둘 것이 아니면 'skip', 상한을 넘으면 'too_large'다(storableProduct를 거친 값은 넘지 않는다).
// 같은 상품을 더 늦게 불러온 값이 이미 있으면 덮지 않는다(늦게 끝난 앞 조회가 새로고침을 되돌리지 않게).
export async function saveStoredProduct(
  db: Db,
  url: string,
  response: ProductInfoResponse,
  fetchedAt: Date,
): Promise<'saved' | 'skip' | 'too_large'> {
  if (!isStorable(response)) return 'skip'
  const product = response.product ? withoutFetchedAt(response.product) : null
  if (url.length > URL_MAX) return 'too_large'
  if (product && bytesOf(product) > PRODUCT_JSON_MAX_BYTES) return 'too_large'
  const values = { outcome: product ? 'ok' : 'not_found', product, fetchedAt }
  await db
    .insert(productInfo)
    .values({ url, ...values })
    .onConflictDoUpdate({
      target: productInfo.url,
      set: values,
      setWhere: sql`${productInfo.fetchedAt} <= excluded.fetched_at`,
    })
  return 'saved'
}

function withoutFetchedAt(product: ProductInfo): ProductInfo {
  const { fetchedAt: _ignored, ...rest } = product
  return rest
}
