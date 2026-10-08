# 채팅 링크 후보 목록 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 행사 대화에 올라온 쿠팡 링크를 후보로 모아 골라 담게 하고, 상품 정보는 뒤에서 상품 단위로 조회해 저장하며, 제출할 때 오래된 가격만 다시 조회한다.

**Architecture:** 링크 해석은 contracts 공용 함수 하나로 서버·화면이 같이 쓴다. 대화 저장 트랜잭션이 링크를 후보·공유로 기록하고, 웹 서버 안의 조회 실행기가 DB 대기열(`coupang_products`)을 비운다. 담기는 후보 ID를 받아 저장된 상품 정보와 끼룩이 생성을 합치고, 제출은 트랜잭션 밖에서 오래된 가격을 다시 조회한 뒤 잠금·버전 검사 안에서 반영한다.

**Tech Stack:** Hono, drizzle-orm 0.45.3 + drizzle-kit 0.31, PGlite(테스트), zod 4.6.5, React 19.3, Vite 8, vitest 5 + jsdom, Tailwind 4, Radix

**Spec:** `docs/superpowers/specs/2026-10-09-purchase-candidates-design.md`

## Global Constraints

- 요청 본문 스키마는 `packages/contracts`의 `z.strictObject`다. 문자열은 `text(max)` 또는 `token(max)`만 쓰고 모든 문자열·배열·숫자에 상한을 둔다.
- 라우트는 `json(Schema)`를 인증(`auth`, `member`)보다 앞에 두고 `c.req.valid('json')`만 읽는다. 변경 라우트는 `/api/organizations/` 아래다.
- 실패는 `PurchaseError(code, status)`로 던진다. 로그·응답에 요청 본문, 오류 원문, DB 값, 키를 넣지 않는다. 실행기 로그는 `PRODUCT_LOOKUP_FAILED`만 남긴다.
- 길이 제한이 있는 칸은 DB CHECK에도 같은 값을 둔다. `.sql`은 LF다.
- 0014는 새 표·새 칸만 더한다. 두 DB에 먼저 적용하고 코드를 배포한다. DB 적용은 승인을 받는다.
- ReefAPI는 `POST https://api.reefapi.com/coupang/v1/product`에 `{ product_id }`만 보낸다. 사용자 URL을 직접 부르지 않는다. 키는 `REEF_API_KEY`만 쓴다. 제한 시간은 뒤에서 하는 조회 15초, 제출 때 다시 조회 8초다.
- 동시 실행: 뒤에서 하는 조회 2개, 담기·제출 때의 바로 조회 4개.
- 재시도: 시간 초과·`RATE_LIMITED`·일시 오류는 1분·5분·30분 뒤, 네 번째 실패에서 `failed`. `NOT_FOUND`는 바로 `failed`.
- 화면은 `components/ui` 부품만 쓴다(체크박스만 `size-4 accent-blue-600`). Tailwind 스케일·팔레트만 쓰고, 긴 글에는 `wrap-anywhere`를 준다. 새 변형(Sheet 오른쪽)은 `src/ui-gallery`에 더한다. 버튼 활성화는 같은 스키마의 `safeParse`로 정한다.
- 서버 문구(정확히):
  - 판매자 경고: `링크의 판매자가 바뀌었을 수 있어요. 쿠팡에서 가격과 판매자를 확인해 주세요.`
  - 다른 사람 요청 경고: `다른 구성원이 이미 요청한 상품이에요. 같은 물건을 두 번 사지 않는지 확인해 주세요.`
  - 옵션 정보 없음: `링크에 판매 옵션 정보가 없어요. 쿠팡에서 옵션을 고른 뒤 주소창의 링크를 다시 올려 주세요.`
  - 옵션 불일치: `링크와 일치하는 판매 옵션을 확인하지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.`
  - 조회 실패: `상품 정보를 가져오지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.`
  - 조회 설정 없음: `상품 조회 서비스가 설정되지 않았어요. 관리자에게 알려 주세요.`
  - 가격 없음: `상품 가격을 확인하지 못했어요. 상품 링크에서 확인해 주세요.`
- 화면 문구(정확히):
  - 보기: `후보` `내 품목` `행사 전체`(묶음 이름 `구매 보기`)
  - 후보 불러오기: `후보 불러오는 중…`, 실패 `후보를 불러오지 못했어요.` + `다시 시도`
  - 이름 자리: 조회 중 `상품 정보를 불러오는 중…`, 실패 `상품 정보를 가져오지 못했어요. 쿠팡에서 확인해 주세요.`
  - 가격 줄: `예상 9,800원 · 10/9 기준`, 가격 모름 `금액 확인 필요 · 10/9 기준`
  - 칩: `옵션 미정` `품절` `요청됨 · 박해랑 · 2개`(수량 모르면 `요청됨 · 박해랑`) `내가 담음`
  - 공유: `기획 · 10월 9일 오후 2:12에 공유`, 여러 번이면 뒤에 ` · 외 2번`, 펼치기 `공유 3번`
  - 숨김: `숨기기`, 알림 `후보를 숨겼어요.` + `되돌리기`, 목록 `숨긴 후보 1`, 줄 `기획 · 10월 9일에 숨김`, 버튼 `다시 보이기`
  - 담기: `선택한 2개 담기`, 담는 중 `담는 중… 최대 약 75초 걸릴 수 있어요. 끝날 때까지 기다려 주세요.`, 끝 `2개를 담았어요. 확인하고 제출해 주세요.`
  - 빈 후보: 제목 `아직 올라온 쿠팡 링크가 없어요`, 설명 `대화에 쿠팡 상품 링크를 올리면 여기에 모여요.`
  - 잘림: `최근 300개만 보여요.`
  - 빈 내 품목 설명: `후보에서 골라 담아 보세요.`
  - 가격 바뀜: `가격이 바뀐 품목이 있어 새 가격으로 제출했어요.` + 줄마다 `유성매직 4,900원 → 5,200원`(이전 가격이 없으면 `금액 확인 필요 → 5,200원`), 3개 넘으면 `외 2개`
  - 패널: 닫기 `패널 닫기`, `쿠팡에서 보기`, `도착 예정: …`, 정가 줄 `정가 12,000원 · 18% 할인`. 가격 줄은 후보 카드와 같다(`예상 9,800원 · 10/9 기준`).
  - 대화: `메시지를 찾지 못했어요.`
  - 이동 경고: `끼룩이가 품목을 담는 중이에요. 이동해도 담는 중인 품목은 서버에서 계속 만들어질 수 있어요. 이동할까요?`
- 검사: API `npm test --workspace @vada/api`(파일 하나는 `apps/api`에서 `npx tsx --test <파일>`), 계약 `npm test --workspace @vada/contracts`, 화면 `npm test --workspace @vada/web`(파일은 `apps/web`에서 `npx vitest run --no-file-parallelism <경로>`), 타입 `npm run typecheck`.

## Review Focus

1. **같은 링크를 거의 동시에 둘이 올린다:** 후보는 하나, 공유는 둘이어야 한다. `NULLS NOT DISTINCT` 고유 제약과 `ON CONFLICT`가 동시 저장에서도 맞는지. → Task 4 동시 저장 테스트
2. **ReefAPI가 이상한 값을 준다:** 가격이 문자열·음수, 이미지가 다른 호스트·`http`, 이름에 NUL, 옵션 수백 개. 저장 값은 검사·제한되고 화면에 그대로 나가지 않는다. → Task 3 테스트
3. **담는 사이 후보가 숨겨지거나 조회가 실패한다:** 담기는 막히지 않고, 조회 실패는 품목의 확인 사항으로 남는다. → Task 6 테스트
4. **요청자가 가격을 직접 고친 뒤 제출한다:** 다시 조회가 고친 가격을 덮어쓰지 않는다. 가격 없는 조회 결과도 원래 가격을 지우지 않는다. → Task 7 테스트
5. **휴대폰 폭의 긴 글:** 긴 상품명, 쿼리가 많은 긴 쿠팡 주소, 긴 이름이 후보 카드·대화 링크·패널 밖으로 넘치지 않는다. → Task 9·10의 `wrap-anywhere` 테스트와 Task 13의 390px 확인

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `packages/contracts/src/coupang.ts` (새) | 쿠팡 링크 찾기·정규화. 서버·화면 공용 |
| `packages/contracts/src/purchases.ts` | 담기 스키마(후보 ID), 숨김 스키마, 후보 응답 타입 |
| `apps/api/src/db/schema.ts`, `migrations/0014_*.sql` | `coupang_products`, `purchase_candidates`, `purchase_candidate_shares`, `purchase_items.candidate_id` |
| `apps/api/src/purchases/products.ts` | ReefAPI 조회(상품 단위), 응답 검사, 옵션 맞추기, 품목에 넣을 값 |
| `apps/api/src/purchases/catalog.ts` (새) | 상품 행 저장·대기열 가져오기·바로 조회 |
| `apps/api/src/purchases/lookup-runner.ts` (새) | 웹 서버 안의 조회 실행기 |
| `apps/api/src/purchases/candidates.ts` (새) | 대화 링크 기록, 후보 목록, 숨김 |
| `apps/api/src/purchases/service.ts`, `generation.ts`, `purchases.ts` | 후보로 담기, 제출 때 가격 다시 확인, 라우트 |
| `apps/api/src/chat/chat.ts`, `serve.ts` | 링크 기록 연결, 실행기 시작 |
| `apps/web/src/purchases/useCandidates.ts`, `PurchaseCandidates.tsx`, `CandidateCard.tsx`, `ProductPanel.tsx` (새) | 후보 화면, 링크 패널 |
| `apps/web/src/chat/MessageText.tsx` (새), `Chat.tsx`, `useChat.ts` | 링크 버튼, 메시지로 이동 |
| `apps/web/src/purchases/EventPurchases.tsx`, `useEventPurchases.ts`, `workspace/EventWorkspace.tsx` | 보기 세 개, 담기 입구, 가격 바뀜 안내 |
| `apps/web/src/components/ui/sheet.tsx`, `ui-gallery/Gallery.tsx` | Sheet 오른쪽 변형 |
| 지움: `purchases/LinkDialog*`, `purchases/pre-cleanup.test.ts` | 붙여 넣기 창, 지난 배포 구간 테스트 |

---

### Task 1: 쿠팡 링크 해석과 후보 계약

**Files:**
- Create: `packages/contracts/src/coupang.ts`, `packages/contracts/src/coupang.test.ts`
- Modify: `packages/contracts/src/purchases.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/input.test.ts`, `packages/contracts/package.json`

**Interfaces:**
- Produces:
  - `COUPANG_LINKS_PER_MESSAGE_MAX = 10`, `interface CoupangLink { url; productId; itemId: string | null; vendorItemId: string | null; start; end }`
  - `readCoupangUrl(raw: string): Omit<CoupangLink, 'start' | 'end'> | null`, `normalizeCoupangUrl(productId, itemId, vendorItemId): string`, `parseCoupangLinks(text: string): CoupangLink[]`
  - `PURCHASE_CANDIDATES_MAX = 10`(PURCHASE_LINKS_MAX 대신), `CreatePurchaseDraftsSchema { idempotencyKey: token(128), candidateIds: token(64)[] 1..10 중복 없음 }`, `PurchaseCandidateHiddenSchema { hidden: boolean }`
  - 타입 `ProductLookupStatus`, `PurchaseCandidateProduct`, `PurchaseCandidateShare`, `PurchaseCandidateRequest`, `PurchaseCandidate`(아래 코드), `PurchaseCandidatesResponse { candidates; truncated }`, `PurchaseCandidateResponse { candidate }`, `PurchaseCandidateHiddenRequest`

- [ ] **Step 1: 실패하는 링크 해석 테스트 작성**

`packages/contracts/src/coupang.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COUPANG_LINKS_PER_MESSAGE_MAX, normalizeCoupangUrl, parseCoupangLinks, readCoupangUrl } from './coupang.js'

const url = (n: number) => `https://www.coupang.com/vp/products/${n}?itemId=${n + 1}&vendorItemId=${n + 2}`

test('쿠팡 상품 주소를 www 상품 주소로 정규화하고 itemId·vendorItemId만 남긴다', () => {
  for (const raw of ['https://www.coupang.com/vp/products/10?itemId=11&vendorItemId=12',
    'https://coupang.com/vp/products/10/?vendorItemId=12&itemId=11&src=1032&q=x',
    'https://m.coupang.com/vm/products/10?itemId=11&vendorItemId=12&isAddedCart=']) {
    assert.deepEqual(readCoupangUrl(raw), { url: url(10), productId: '10', itemId: '11', vendorItemId: '12' }, raw)
  }
  assert.equal(normalizeCoupangUrl('5', null, '7'), 'https://www.coupang.com/vp/products/5?vendorItemId=7')
  assert.deepEqual(readCoupangUrl('https://www.coupang.com/vp/products/5'),
    { url: 'https://www.coupang.com/vp/products/5', productId: '5', itemId: null, vendorItemId: null })
})

test('옵션 값이 숫자가 아니거나 두 번 있으면 버리고, 상품 주소가 아니면 링크로 보지 않는다', () => {
  assert.deepEqual(readCoupangUrl('https://www.coupang.com/vp/products/5?itemId=a&vendorItemId=1&vendorItemId=2'),
    { url: 'https://www.coupang.com/vp/products/5', productId: '5', itemId: null, vendorItemId: null })
  for (const raw of ['http://www.coupang.com/vp/products/5', 'https://link.coupang.com/a/bVaRjX', 'https://example.com/vp/products/5',
    'https://www.coupang.com/vp/products/abc', `https://www.coupang.com/vp/products/${'1'.repeat(21)}`,
    'https://www.coupang.com:8443/vp/products/5', 'https://m.coupang.com/vp/products/5', 'https://www.coupang.com/vm/products/5',
    'https://user@www.coupang.com/vp/products/5', 'not a url']) {
    assert.equal(readCoupangUrl(raw), null, raw)
  }
})

test('메시지에서 링크를 순서대로 찾고, 끝 문장 부호와 이어 쓴 한글을 떼며, 10개까지만 받는다', () => {
  const text = `이거 어때? (${url(1)}). 그리고 ${url(4)}이거도\nhttps://link.coupang.com/a/x https://example.com`
  const links = parseCoupangLinks(text)
  assert.deepEqual(links.map(link => link.productId), ['1', '4'])
  for (const link of links) assert.equal(text.slice(link.start, link.end), link.url)
  const many = Array.from({ length: COUPANG_LINKS_PER_MESSAGE_MAX + 2 }, (_, index) => url(index * 10 + 10)).join(' ')
  assert.equal(parseCoupangLinks(many).length, COUPANG_LINKS_PER_MESSAGE_MAX)
  assert.deepEqual(parseCoupangLinks('링크 없음'), [])
})
```

`packages/contracts/package.json`의 `"test"`를 바꾼다:

```json
"test": "tsx --test src/input.test.ts src/coupang.test.ts"
```

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/contracts`
Expected: FAIL — `Cannot find module './coupang.js'`

- [ ] **Step 3: 링크 해석 구현**

`packages/contracts/src/coupang.ts`:

```ts
// 쿠팡 상품 링크를 찾고 정규화한다. 서버(후보 기록)와 화면(대화 링크 버튼)이 같은 규칙을 쓴다.
export const COUPANG_LINKS_PER_MESSAGE_MAX = 10

export interface CoupangLink {
  // https://www.coupang.com/vp/products/{productId}?itemId=..&vendorItemId=.. 로 정규화한 주소
  url: string
  productId: string
  itemId: string | null
  vendorItemId: string | null
  // 원문에서 링크가 차지하는 위치. 화면이 링크 버튼을 그릴 때 쓴다.
  start: number
  end: number
}

const digits = /^\d{1,20}$/
// URL에 쓸 수 있는 ASCII 문자까지만 링크로 본다. 이어 쓴 한글은 링크가 아니다.
const candidate = /https:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g
// 문장 끝에 붙은 부호는 링크에서 뗀다.
const trailing = /[.,!?;:'")\]}]+$/

export function normalizeCoupangUrl(productId: string, itemId: string | null, vendorItemId: string | null) {
  const url = new URL(`https://www.coupang.com/vp/products/${productId}`)
  if (itemId) url.searchParams.set('itemId', itemId)
  if (vendorItemId) url.searchParams.set('vendorItemId', vendorItemId)
  return url.href
}

export function readCoupangUrl(raw: string): Omit<CoupangLink, 'start' | 'end'> | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null
  const pattern = ['www.coupang.com', 'coupang.com'].includes(url.hostname) ? /^\/vp\/products\/(\d{1,20})\/?$/
    : url.hostname === 'm.coupang.com' ? /^\/vm\/products\/(\d{1,20})\/?$/ : null
  const match = pattern?.exec(url.pathname)
  if (!match) return null
  // 값이 숫자 하나일 때만 쓴다. 이상하면 옵션을 모르는 링크로 본다.
  const param = (key: string) => {
    const values = url.searchParams.getAll(key)
    return values.length === 1 && digits.test(values[0]!) ? values[0]! : null
  }
  const productId = match[1]!
  const itemId = param('itemId')
  const vendorItemId = param('vendorItemId')
  return { url: normalizeCoupangUrl(productId, itemId, vendorItemId), productId, itemId, vendorItemId }
}

export function parseCoupangLinks(text: string): CoupangLink[] {
  const links: CoupangLink[] = []
  for (const found of text.matchAll(candidate)) {
    if (links.length >= COUPANG_LINKS_PER_MESSAGE_MAX) break
    const raw = found[0].replace(trailing, '')
    const parsed = readCoupangUrl(raw)
    if (parsed) links.push({ ...parsed, start: found.index, end: found.index + raw.length })
  }
  return links
}
```

- [ ] **Step 4: 링크 해석 테스트 통과 확인**

Run: `cd packages/contracts && npx tsx --test src/coupang.test.ts`
Expected: PASS 3/3

- [ ] **Step 5: 실패하는 담기·숨김 스키마 테스트로 바꾸기**

`packages/contracts/src/input.test.ts`에서 import의 `PURCHASE_LINKS_MAX`를 `PURCHASE_CANDIDATES_MAX`로, `PurchaseCandidateHiddenSchema`를 더한다:

```ts
import { PURCHASE_BATCH_MAX, PURCHASE_CANDIDATES_MAX, PURCHASE_INTEGER_MAX, PURCHASE_NOTE_MAX, PURCHASE_OPTION_MAX, PURCHASE_PACKAGING_MAX,
  PURCHASE_PRODUCT_NAME_MAX, PURCHASE_REASON_MAX, ChangeNeededBySchema, CreatePurchaseDraftsSchema, DecidePurchaseItemsSchema,
  GeneratedPurchaseItemSchema, PurchaseCandidateHiddenSchema, PurchaseItemVersionSchema, PurchasePurchasedSchema, PurchaseReceivedSchema,
  SubmitPurchaseItemsSchema, UpdatePurchaseItemSchema } from './purchases.js'
```

`test('구매 담기: 키와 링크 1~5개만 받고, ...')` 전체를 바꾼다:

```ts
test('구매 담기: 키와 후보 1~10개만 받고, 같은 후보 두 번·모르는 키·제어 문자는 거부한다', () => {
  assert.deepEqual(CreatePurchaseDraftsSchema.parse({ idempotencyKey: ' k ', candidateIds: [' c1 ', 'c2'] }),
    { idempotencyKey: 'k', candidateIds: ['c1', 'c2'] })
  for (const body of [{}, { idempotencyKey: 'k' }, { candidateIds: ['c'] }, { idempotencyKey: ' ', candidateIds: ['c'] },
    { idempotencyKey: 'k'.repeat(129), candidateIds: ['c'] }, { idempotencyKey: 'k', candidateIds: [] },
    { idempotencyKey: 'k', candidateIds: Array.from({ length: PURCHASE_CANDIDATES_MAX + 1 }, (_, index) => `c${index}`) },
    { idempotencyKey: 'k', candidateIds: ['c', ' c '] }, { idempotencyKey: 'k', candidateIds: ['c\u0000'] },
    { idempotencyKey: 'k', candidateIds: ['c'.repeat(65)] }, { idempotencyKey: 'k', candidateIds: ['c'], links: ['x'] }]) {
    assert.equal(CreatePurchaseDraftsSchema.safeParse(body).success, false, JSON.stringify(body))
  }
  assert.equal(PurchaseCandidateHiddenSchema.safeParse({ hidden: true }).success, true)
  for (const body of [{}, { hidden: 'true' }, { hidden: null }, { hidden: false, by: 'x' }]) {
    assert.equal(PurchaseCandidateHiddenSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})
```

마지막 테스트의 스키마 목록에 `PurchaseCandidateHiddenSchema`를 더한다:

```ts
  for (const schema of [CreatePurchaseDraftsSchema, UpdatePurchaseItemSchema, PurchaseItemVersionSchema, SubmitPurchaseItemsSchema,
    ChangeNeededBySchema, PurchaseReceivedSchema, PurchasePurchasedSchema, DecidePurchaseItemsSchema, PurchaseCandidateHiddenSchema]) assert.equal(isStrictObject(schema), true)
```

- [ ] **Step 6: 실패 확인**

Run: `npm test --workspace @vada/contracts`
Expected: FAIL — `PURCHASE_CANDIDATES_MAX`, `PurchaseCandidateHiddenSchema`가 없다(타입·런타임 오류)

- [ ] **Step 7: 계약 구현**

`packages/contracts/src/purchases.ts`:
- `export const PURCHASE_LINKS_MAX = 5`를 지우고 `export const PURCHASE_CANDIDATES_MAX = 10`을 둔다.
- `CreatePurchaseDraftsSchema`를 바꾼다:

```ts
export const CreatePurchaseDraftsSchema = z.strictObject({
  idempotencyKey: token(128),
  // 행사의 후보에서 고른다. 같은 후보를 두 번 보내지 않는다.
  candidateIds: z.array(id).min(1).max(PURCHASE_CANDIDATES_MAX).refine(ids => new Set(ids).size === ids.length),
})
```

- `PurchaseReceivedSchema` 아래에 숨김 스키마를 더한다:

```ts
export const PurchaseCandidateHiddenSchema = z.strictObject({ hidden: z.boolean() })
```

- 타입 묶음(`export type CreatePurchaseDraftsRequest …`) 아래에 더한다:

```ts
export type PurchaseCandidateHiddenRequest = z.infer<typeof PurchaseCandidateHiddenSchema>
```

- 파일 끝에 후보 타입을 더한다:

```ts
export type ProductLookupStatus = 'pending' | 'ready' | 'failed'
export interface PurchaseCandidateProduct {
  name: string
  // 옵션을 모르면 가격·정가·할인율·재고·도착 예정은 null이다.
  price: number | null
  listPrice: number | null
  discountPercent: number | null
  inStock: boolean | null
  deliveryEta: string | null
  imageUrl: string | null
}
export interface PurchaseCandidateShare { messageId: string; author: PurchasePerson; sharedAt: string }
export interface PurchaseCandidateRequest { requester: PurchasePerson; quantity: number | null; status: 'pending' | 'approved' }
export interface PurchaseCandidate {
  id: string
  url: string
  productId: string
  itemId: string | null
  vendorItemId: string | null
  lookup: ProductLookupStatus
  fetchedAt: string | null
  // 링크의 옵션을 조회 결과에서 찾았는지. 못 찾으면 "옵션 미정"이다.
  optionKnown: boolean
  product: PurchaseCandidateProduct | null
  // 링크의 판매자가 바뀌었을 수 있을 때의 안내. 없으면 null이다.
  warning: string | null
  shareCount: number
  // 최근 공유 20개. 최신이 앞이다.
  shares: PurchaseCandidateShare[]
  hidden: { by: PurchasePerson; at: string } | null
  // 제출된(대기·승인) 품목. 학생회 누구나 본다.
  requests: PurchaseCandidateRequest[]
  // 보는 사람의 작성 중 품목이 있는지. 다른 사람에게는 알리지 않는다.
  draftedByMe: boolean
}
export interface PurchaseCandidatesResponse { candidates: PurchaseCandidate[]; truncated: boolean }
export interface PurchaseCandidateResponse { candidate: PurchaseCandidate }
```

`packages/contracts/src/index.ts`:
- 첫 줄 아래에 더한다:

```ts
export { COUPANG_LINKS_PER_MESSAGE_MAX, normalizeCoupangUrl, parseCoupangLinks, readCoupangUrl, type CoupangLink } from './coupang.js'
```

- 구매 export에서 `PURCHASE_LINKS_MAX`를 `PURCHASE_CANDIDATES_MAX`로 바꾸고 `PurchaseCandidateHiddenSchema`를 더한다. 타입 export에 `PurchaseCandidateHiddenRequest, ProductLookupStatus, PurchaseCandidateProduct, PurchaseCandidateShare, PurchaseCandidateRequest, PurchaseCandidate, PurchaseCandidatesResponse, PurchaseCandidateResponse`를 더한다.

- [ ] **Step 8: 계약 테스트 통과 확인**

Run: `npm test --workspace @vada/contracts`
Expected: PASS (기존 17 + 새 3 = 20)

- [ ] **Step 9: 커밋**

```bash
git add packages/contracts
git commit -m "쿠팡 링크 해석과 후보 계약 추가"
```

---

### Task 2: 후보·상품 표와 0014 마이그레이션

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/src/db/migrations.test.ts`, `apps/api/src/db/purchases.test.ts`, `apps/api/package.json`
- Create: `apps/api/migrations/0014_purchase_candidates.sql`(drizzle 생성), `apps/api/migrations/meta/0014_snapshot.json`
- Delete: `apps/api/src/purchases/pre-cleanup.test.ts` — 0013 배포 구간(2026-10-09에 두 DB 적용)을 지키던 테스트다. 이 Task부터 코드가 0014 칸을 읽으므로 0012 DB에서는 돌 수 없다.

**Interfaces:**
- Produces: `CoupangItem`(아래 코드), 표 `coupangProducts`, `purchaseCandidates`, `purchaseCandidateShares`, 칸 `purchaseItems.candidateId`. 제약 이름은 테스트에 적힌 그대로다.

- [ ] **Step 1: 실패하는 스키마·마이그레이션 테스트 작성**

`apps/api/src/db/purchases.test.ts` 첫 테스트의 표 목록을 바꾼다:

```ts
  for (const name of ['purchaseItems', 'purchaseSubmissions', 'purchaseGenerations', 'purchaseItemEvents', 'purchaseItemSources',
    'coupangProducts', 'purchaseCandidates', 'purchaseCandidateShares']) {
    assert.ok(name in schema, `Missing table: ${name}`)
  }
```

`apps/api/src/db/migrations.test.ts` 끝에 더한다:

```ts
test('0014 adds candidates and product lookups without touching existing items', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0014_purchase_candidates')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','기획','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u'),('e2','o2','남의 행사','u');
      INSERT INTO chat_rooms (id,organization_id,event_id) VALUES ('room','o','e');
      INSERT INTO messages (id,chat_room_id,author_id,content) VALUES ('m','room','u','링크');
      INSERT INTO purchase_items (id,organization_id,event_id,requester_id,product_url) VALUES ('i','o','e','u','https://www.coupang.com/vp/products/1');
    `)
    const before = (await pg.query<Record<string, unknown>>('SELECT * FROM purchase_items')).rows
    await migrate(db, { migrationsFolder })

    await t.test('existing items keep their values and have no candidate', async () => {
      const after = (await pg.query<Record<string, unknown>>('SELECT * FROM purchase_items')).rows
      assert.deepEqual(after.map(row => Object.fromEntries(Object.keys(before[0]!).map(key => [key, row[key]]))), before)
      assert.equal(after[0]!.candidate_id, null)
    })
    await t.test('product rows keep a digit id, a known status and a bounded option list', async () => {
      await pg.exec("INSERT INTO coupang_products (id) VALUES ('1')")
      assert.deepEqual((await pg.query("SELECT status, items, attempts, error_code FROM coupang_products WHERE id = '1'")).rows,
        [{ status: 'pending', items: [], attempts: 0, error_code: null }])
      const cases: [string, string][] = [
        ["INSERT INTO coupang_products (id) VALUES ('12a')", 'coupang_products_id_digits'],
        ["INSERT INTO coupang_products (id, status) VALUES ('2','done')", 'coupang_products_status_valid'],
        ["INSERT INTO coupang_products (id, status) VALUES ('3','ready')", 'coupang_products_ready_fetched'],
        ["INSERT INTO coupang_products (id, items) VALUES ('4','{}')", 'coupang_products_items_array'],
        [`INSERT INTO coupang_products (id, items) VALUES ('5','[${Array(101).fill('{}').join(',')}]')`, 'coupang_products_items_array'],
        ["INSERT INTO coupang_products (id, error_code) VALUES ('6','boom')", 'coupang_products_error_code'],
        ["INSERT INTO coupang_products (id, attempts) VALUES ('7',-1)", 'coupang_products_attempts_nonnegative'],
      ]
      for (const [statement, constraint] of cases) await assert.rejects(pg.exec(statement), { constraint }, constraint)
    })
    await t.test('a product option appears once per event, and an unknown option once per product', async () => {
      const candidate = (id: string, vendor: string | null, event = 'e', org = 'o') => pg.query(
        "INSERT INTO purchase_candidates (id,organization_id,event_id,product_id,vendor_item_id,url) VALUES ($1,$2,$3,'1',$4,'https://www.coupang.com/vp/products/1')",
        [id, org, event, vendor])
      await candidate('c1', '9'); await candidate('c2', null); await candidate('c3', '8')
      await assert.rejects(candidate('dup', '9'), { constraint: 'purchase_candidates_event_product_vendor_unique' })
      await assert.rejects(candidate('dup2', null), { constraint: 'purchase_candidates_event_product_vendor_unique' })
      await candidate('other', null, 'e2', 'o2')
      await assert.rejects(candidate('cross', null, 'e2', 'o'), { constraint: 'purchase_candidates_event_same_organization' })
      const cases: [string, string][] = [
        ["UPDATE purchase_candidates SET hidden_at = now() WHERE id = 'c1'", 'purchase_candidates_hidden_pair'],
        ["UPDATE purchase_candidates SET url = 'https://evil.test/x' WHERE id = 'c1'", 'purchase_candidates_url'],
        ["UPDATE purchase_candidates SET vendor_item_id = 'x' WHERE id = 'c1'", 'purchase_candidates_vendor_digits'],
        ["UPDATE purchase_candidates SET item_id = '1a' WHERE id = 'c1'", 'purchase_candidates_item_digits'],
      ]
      for (const [statement, constraint] of cases) await assert.rejects(pg.exec(statement), { constraint }, constraint)
    })
    await t.test('shares keep message order and items point to a candidate of the same council', async () => {
      const share = (position: number, candidate = 'c1', org = 'o') => pg.query(
        'INSERT INTO purchase_candidate_shares (organization_id,candidate_id,message_id,position) VALUES ($1,$2,$3,$4)', [org, candidate, 'm', position])
      await share(0); await share(1, 'c2')
      await assert.rejects(share(0, 'c3'), { code: '23505' })
      await assert.rejects(share(10, 'c3'), { constraint: 'purchase_candidate_shares_position' })
      await assert.rejects(share(2, 'other'), { constraint: 'purchase_candidate_shares_candidate_same_organization' })
      await pg.exec("UPDATE purchase_items SET candidate_id = 'c1' WHERE id = 'i'")
      await assert.rejects(pg.exec("UPDATE purchase_items SET candidate_id = 'other' WHERE id = 'i'"), { constraint: 'purchase_items_candidate_same_organization' })
      await assert.rejects(pg.exec("DELETE FROM purchase_candidates WHERE id = 'c1'"), { code: '23001' })
    })
  } finally {
    await pg.close()
    previous.remove()
  }
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && npx tsx --test src/db/migrations.test.ts src/db/purchases.test.ts`
Expected: FAIL — `Migration not found: 0014_purchase_candidates`, `Missing table: coupangProducts`

- [ ] **Step 3: 스키마 작성**

`apps/api/src/db/schema.ts`에서 `purchaseSubmissions` 정의 바로 아래(=`purchaseItems` 위)에 더한다:

```ts
// coupang_products.items의 한 옵션. 조회 응답에서 검사를 통과한 값만 저장한다.
export interface CoupangItem {
  itemId: string | null
  vendorItemId: string | null
  name: string
  price: number | null
  listPrice: number | null
  discountPercent: number | null
  inStock: boolean | null
  deliveryEta: string | null
  imageUrl: string | null
}

// 쿠팡 상품 정보. 학생회와 무관한 공개 정보라 학생회끼리 같이 쓴다. 상품 ID 하나에 옵션 전체를 저장한다.
// pending은 조회 대기열이다. 실행기가 locked_until로 잠그고 가져가며, 실패하면 next_attempt_at에 다시 시도한다.
export const coupangProducts = pgTable('coupang_products', {
  id: text('id').primaryKey(),
  status: text('status', { enum: ['pending', 'ready', 'failed'] }).notNull().default('pending'),
  items: jsonb('items').$type<CoupangItem[]>().notNull().default([]),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  errorCode: text('error_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  check('coupang_products_id_digits', sql`${table.id} ~ '^[0-9]{1,20}$'`),
  check('coupang_products_status_valid', sql`${table.status} IN ('pending','ready','failed')`),
  check('coupang_products_items_array', sql`jsonb_typeof(${table.items}) = 'array' AND jsonb_array_length(${table.items}) <= 100`),
  check('coupang_products_ready_fetched', sql`${table.status} <> 'ready' OR ${table.fetchedAt} IS NOT NULL`),
  check('coupang_products_attempts_nonnegative', sql`${table.attempts} >= 0`),
  check('coupang_products_error_code', sql`${table.errorCode} ~ '^[A-Z_]{1,40}$'`),
  index('coupang_products_due_idx').on(table.nextAttemptAt).where(sql`${table.status} = 'pending'`),
])

// 행사 대화에 올라온 쿠팡 링크. 같은 상품·판매 옵션은 행사에 하나다. vendor_item_id가 없으면 상품마다 "옵션 미정" 하나다.
export const purchaseCandidates = pgTable('purchase_candidates', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  eventId: text('event_id').notNull(),
  productId: text('product_id').notNull().references(() => coupangProducts.id, { onDelete: 'restrict' }),
  itemId: text('item_id'),
  vendorItemId: text('vendor_item_id'),
  url: text('url').notNull(),
  hiddenBy: text('hidden_by').references(() => users.id, { onDelete: 'restrict' }),
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'purchase_candidates_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  unique('purchase_candidates_organization_id_unique').on(table.organizationId, table.id),
  unique('purchase_candidates_event_product_vendor_unique').on(table.eventId, table.productId, table.vendorItemId).nullsNotDistinct(),
  check('purchase_candidates_item_digits', sql`${table.itemId} ~ '^[0-9]{1,20}$'`),
  check('purchase_candidates_vendor_digits', sql`${table.vendorItemId} ~ '^[0-9]{1,20}$'`),
  check('purchase_candidates_url', sql`${table.url} LIKE 'https://www.coupang.com/vp/products/%' AND char_length(${table.url}) <= 200`),
  check('purchase_candidates_hidden_pair', sql`(${table.hiddenAt} IS NULL) = (${table.hiddenBy} IS NULL)`),
])
```

`purchaseItems`의 `submissionId: text('submission_id'),` 아래에 칸을 더한다:

```ts
  // 후보에서 담은 품목만 있다. 다시 담기로 만든 품목도 원래 후보를 이어 받는다.
  candidateId: text('candidate_id'),
```

`purchaseItems` 제약 목록의 `purchase_items_submission_same_organization` FK 아래에 더한다:

```ts
  foreignKey({
    name: 'purchase_items_candidate_same_organization',
    columns: [table.organizationId, table.candidateId],
    foreignColumns: [purchaseCandidates.organizationId, purchaseCandidates.id],
  }).onDelete('restrict'),
```

같은 목록의 색인 줄 끝에 더한다:

```ts
  index('purchase_items_candidate_idx').on(table.organizationId, table.candidateId),
```

`purchaseItemSources` 정의 아래에 더한다:

```ts
// 후보를 공유한 메시지. 한 메시지의 링크 순서(0~9)마다 한 줄이다. 같은 행사방인지는 대화 저장이 보장한다.
export const purchaseCandidateShares = pgTable('purchase_candidate_shares', {
  organizationId: text('organization_id').notNull(),
  candidateId: text('candidate_id').notNull(),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'restrict' }),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.messageId, table.position] }),
  foreignKey({
    name: 'purchase_candidate_shares_candidate_same_organization',
    columns: [table.organizationId, table.candidateId],
    foreignColumns: [purchaseCandidates.organizationId, purchaseCandidates.id],
  }).onDelete('restrict'),
  check('purchase_candidate_shares_position', sql`${table.position} >= 0 AND ${table.position} < 10`),
  index('purchase_candidate_shares_candidate_idx').on(table.candidateId, table.createdAt),
])
```

- [ ] **Step 4: 마이그레이션 생성과 검토**

Run: `cd apps/api && npm run db:generate -- --name purchase_candidates`
Expected: `migrations/0014_purchase_candidates.sql` 생성. 열어서 확인한다.
- 새 표 셋의 `CREATE TABLE`, `purchase_items`에 `ADD COLUMN "candidate_id" text`(NULL 허용), FK·CHECK·색인만 있어야 한다.
- 기존 칸·제약을 바꾸거나 지우는 문장, `CASCADE`가 있으면 안 된다.
- 고유 제약에 `NULLS NOT DISTINCT`가 있어야 한다.
- `git ls-files --eol`로 LF인지 본다(커밋 뒤 `i/lf w/lf`).

- [ ] **Step 5: 지난 배포 구간 테스트 지우기**

`apps/api/src/purchases/pre-cleanup.test.ts`를 지우고 `apps/api/package.json`의 `"test"`에서 ` src/purchases/pre-cleanup.test.ts`를 뺀다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd apps/api && npx tsx --test src/db/migrations.test.ts src/db/purchases.test.ts src/db/schema.test.ts src/db/deliveries.test.ts`
Expected: PASS(0014 테스트 포함). 이어서 `npm test --workspace @vada/api`도 통과해야 한다(칸 하나와 표만 더했으므로 기존 동작은 그대로).

- [ ] **Step 7: 커밋**

```bash
git add apps/api/src/db apps/api/migrations apps/api/package.json apps/api/src/purchases/pre-cleanup.test.ts
git commit -m "후보·상품 조회 표와 0014 마이그레이션 추가"
```

---

### Task 3: 상품 단위 조회, 저장, 실행기

**Files:**
- Modify: `apps/api/src/purchases/products.ts`(전부 바꿈)
- Create: `apps/api/src/purchases/products.test.ts`, `apps/api/src/purchases/catalog.ts`, `apps/api/src/purchases/catalog.test.ts`, `apps/api/src/purchases/lookup-runner.ts`
- Modify: `apps/api/package.json`(테스트 목록에 `src/purchases/products.test.ts src/purchases/catalog.test.ts`)

**Interfaces:**
- Consumes: `CoupangItem`, `coupangProducts`(Task 2)
- Produces:
  - `products.ts`: `type LookupFailure`, `type FetchResult`, `type ProductFetcher = (productId: string, timeoutMs?: number) => Promise<FetchResult>`, `interface ProductLookup { name; price; snapshot; fetchedAt; warning }`, `interface LinkIdentity { productId; itemId; vendorItemId }`, `type StoredProduct`, `SELLER_WARNING`, `lookupWarnings`, `readItem(raw, productId)`, `createReefFetcher(apiKey, fetcher?)`, `matchItem(items, link)`, `lookupFor(product, link)`
  - `catalog.ts`: `createProductCatalog(db, fetchProduct?)` → `{ read(ids), claim(limit), process(row), refresh(ids, timeoutMs?) }`, `type ProductCatalog`, `type ProductRow`
  - `lookup-runner.ts`: `createLookupRunner(catalog, { concurrency?, onFailure? })` → `{ kick(): Promise<void>, start(intervalMs?): () => void }`
- `readProduct`가 없어지므로 이 Task에서 다음을 함께 고쳐 타입 검사를 통과시킨다(Step 6).
  - `generation.ts`(입력에 `products`), `generation.test.ts`, `scripts/check-draft-live.ts`
  - `serve.ts`(`reefApiKey` 제거)
  - `service.ts`: 생성 입력에 임시로 "조회 결과 없음"을 넘긴다. Task 6이 후보 조회로 바꾼다.

- [ ] **Step 1: 실패하는 조회 테스트 작성**

`apps/api/src/purchases/products.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReefFetcher, lookupFor, lookupWarnings, matchItem, readItem, SELLER_WARNING } from './products.js'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const raw = (overrides: Record<string, unknown> = {}) => ({ product_id: '1', item_id: '2', vendor_item_id: '3', name: '테이블, 화이트', currency: 'KRW',
  price: 11590, list_price: 15000, discount_percent: 22.7, in_stock: true, delivery_eta: '내일(금) 도착 보장',
  image: 'https://thumbnail6.coupangcdn.com/a.jpg', ...overrides })

test('상품 ID만 보내 옵션 전체를 받고, 다른 상품의 옵션은 버린다', async () => {
  let sent: RequestInit | undefined
  const fetchProduct = createReefFetcher('test-key', async (url, init) => {
    assert.equal(url, 'https://api.reefapi.com/coupang/v1/product')
    sent = init
    return json({ ok: true, data: { items: [raw(), raw({ item_id: '4', vendor_item_id: '5', name: '테이블, 블랙' }), raw({ product_id: '9' })] } })
  })
  const result = await fetchProduct('1')
  assert.deepEqual(JSON.parse(String(sent?.body)), { product_id: '1' })
  assert.equal(sent?.redirect, 'error')
  assert.ok(result.ok)
  assert.deepEqual(result.items.map(item => item.vendorItemId), ['3', '5'])
  assert.deepEqual(result.items[0], { itemId: '2', vendorItemId: '3', name: '테이블, 화이트', price: 11590, listPrice: 15000, discountPercent: 23,
    inStock: true, deliveryEta: '내일(금) 도착 보장', imageUrl: 'https://thumbnail6.coupangcdn.com/a.jpg' })
})

test('이상한 응답 값은 버리거나 자르고, 이미지는 쿠팡 이미지 서버의 https 주소만 받는다', async () => {
  assert.equal(readItem(raw({ name: '  ' }), '1'), null)
  assert.equal(readItem(raw({ name: '이름\u0000' }), '1'), null)
  assert.equal(readItem(raw({ product_id: '2' }), '1'), null)
  assert.equal(readItem([], '1'), null)
  const odd = readItem(raw({ name: '가'.repeat(600), price: '11590', list_price: -1, discount_percent: 150, in_stock: 'yes',
    delivery_eta: 'x'.repeat(101), image: 'http://thumbnail.coupangcdn.com/a.jpg', item_id: '2a', vendor_item_id: 3 }), '1')!
  assert.equal([...odd.name].length, 500)
  assert.deepEqual([odd.price, odd.listPrice, odd.discountPercent, odd.inStock, odd.itemId, odd.vendorItemId, odd.imageUrl],
    [null, null, null, null, null, null, null])
  assert.equal(odd.deliveryEta?.length, 100)
  for (const image of ['https://evil.test/a.jpg', 'https://coupangcdn.com.evil.test/a.jpg', 'https://user@image.coupangcdn.com/a.jpg', 'not a url']) {
    assert.equal(readItem(raw({ image }), '1')!.imageUrl, null, image)
  }
  assert.equal(readItem(raw({ currency: 'USD' }), '1')!.price, null)
  const many = await createReefFetcher('k', async () => json({ ok: true,
    data: { items: Array.from({ length: 150 }, (_, index) => raw({ vendor_item_id: String(index + 10) })) } }))('1')
  assert.ok(many.ok && many.items.length === 100)
})

test('실패는 다시 시도할 것과 멈출 것으로 나누고, 원문을 남기지 않는다', async () => {
  const cases: [typeof fetch, string, boolean][] = [
    [async () => json({ ok: false, error: { code: 'NOT_FOUND' } }, 404), 'NOT_FOUND', false],
    [async () => json({ ok: false, error: { code: 'RATE_LIMITED' } }, 429), 'RATE_LIMITED', true],
    [async () => json({ ok: false, error: { code: 'TARGET_BLOCKED' } }, 502), 'UPSTREAM', true],
    [async () => new Response('busy', { status: 503 }), 'UPSTREAM', true],
    [async () => { throw new Error('network-secret') }, 'UPSTREAM', true],
    [async () => { throw new DOMException('slow', 'TimeoutError') }, 'TIMEOUT', true],
    [async () => json({ ok: true, data: {} }), 'INVALID_RESPONSE', false],
    [async () => json({ ok: true, data: { items: [] } }), 'NOT_FOUND', false],
  ]
  for (const [fetcher, code, retryable] of cases) {
    const result = await createReefFetcher('test-key', fetcher)('1')
    assert.deepEqual(result, { ok: false, code, retryable }, code)
    assert.ok(!JSON.stringify(result).includes('secret'))
  }
  const never: typeof fetch = async () => { throw new Error('must not call') }
  assert.deepEqual(await createReefFetcher('', never)('1'), { ok: false, code: 'NOT_CONFIGURED', retryable: false })
  assert.deepEqual(await createReefFetcher('k', never)('1a'), { ok: false, code: 'NOT_FOUND', retryable: false })
})

test('링크의 옵션은 판매자 → 옵션 순서로 맞추고, 못 맞추면 옵션을 모르는 것으로 본다', () => {
  const items = [readItem(raw(), '1')!, readItem(raw({ item_id: '4', vendor_item_id: '5', price: null }), '1')!]
  assert.equal(matchItem(items, { itemId: '2', vendorItemId: '3' }).item?.vendorItemId, '3')
  assert.deepEqual(matchItem(items, { itemId: '2', vendorItemId: '9' }), { item: items[0], warning: SELLER_WARNING })
  assert.deepEqual(matchItem(items, { itemId: '2', vendorItemId: null }), { item: items[0], warning: null })
  assert.deepEqual(matchItem(items, { itemId: '8', vendorItemId: '9' }), { item: null, warning: null })
  const ready = { status: 'ready' as const, items, fetchedAt: new Date('2026-10-09T00:00:00Z'), errorCode: null }
  const found = lookupFor(ready, { productId: '1', itemId: '2', vendorItemId: '3' })
  assert.deepEqual([found.name, found.price, found.warning, found.snapshot?.price, found.snapshot?.vendorItemId, found.fetchedAt],
    ['테이블, 화이트', 11590, null, 11590, '3', ready.fetchedAt])
  assert.equal(lookupFor(ready, { productId: '1', itemId: '4', vendorItemId: '5' }).warning, lookupWarnings.noPrice)
  assert.equal(lookupFor(ready, { productId: '1', itemId: null, vendorItemId: null }).warning, lookupWarnings.noOption)
  assert.equal(lookupFor(ready, { productId: '1', itemId: '8', vendorItemId: '9' }).warning, lookupWarnings.noMatch)
  const link = { productId: '1', itemId: '2', vendorItemId: '3' }
  assert.equal(lookupFor({ ...ready, status: 'failed', errorCode: 'NOT_FOUND' }, link).warning, lookupWarnings.failed)
  assert.equal(lookupFor({ ...ready, status: 'failed', errorCode: 'NOT_CONFIGURED' }, link).warning, lookupWarnings.notConfigured)
  assert.deepEqual([lookupFor(undefined, link).price, lookupFor(undefined, link).snapshot], [null, null])
})
```

`apps/api/package.json`의 `"test"`에서 `src/purchases/generation.test.ts` 앞에 ` src/purchases/products.test.ts src/purchases/catalog.test.ts`를 더한다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && npx tsx --test src/purchases/products.test.ts`
Expected: FAIL — `createReefFetcher`, `lookupFor`, `matchItem`, `readItem`이 없다

- [ ] **Step 3: 조회 구현**

`apps/api/src/purchases/products.ts`를 아래로 바꾼다(`readProduct`·`ProductLookup` 옛 정의를 지운다):

```ts
import type { CoupangItem } from '../db/schema.js'

export type LookupFailure = 'NOT_CONFIGURED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM' | 'TIMEOUT' | 'INVALID_RESPONSE'
export type FetchResult = { ok: true; items: CoupangItem[] } | { ok: false; code: LookupFailure; retryable: boolean }
export type ProductFetcher = (productId: string, timeoutMs?: number) => Promise<FetchResult>
// 품목에 넣는 조회 결과. 가격은 끼룩이가 아니라 이 값만 쓴다.
export interface ProductLookup {
  name: string | null
  price: number | null
  snapshot: Record<string, unknown> | null
  fetchedAt: Date | null
  warning: string | null
}
export interface LinkIdentity { productId: string; itemId: string | null; vendorItemId: string | null }
export type StoredProduct = { status: 'pending' | 'ready' | 'failed'; items: CoupangItem[]; fetchedAt: Date | null; errorCode: string | null }

export const SELLER_WARNING = '링크의 판매자가 바뀌었을 수 있어요. 쿠팡에서 가격과 판매자를 확인해 주세요.'
export const lookupWarnings = {
  noOption: '링크에 판매 옵션 정보가 없어요. 쿠팡에서 옵션을 고른 뒤 주소창의 링크를 다시 올려 주세요.',
  noMatch: '링크와 일치하는 판매 옵션을 확인하지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.',
  failed: '상품 정보를 가져오지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.',
  notConfigured: '상품 조회 서비스가 설정되지 않았어요. 관리자에게 알려 주세요.',
  noPrice: '상품 가격을 확인하지 못했어요. 상품 링크에서 확인해 주세요.',
} as const

const REEF_URL = 'https://api.reefapi.com/coupang/v1/product'
const INTEGER_MAX = 2147483647
const ITEMS_MAX = 100
const digits = /^\d{1,20}$/
const unsafe = /[\u0000\uD800-\uDFFF]/u
const imageHost = /(^|\.)coupangcdn\.com$/

function clip(value: unknown, max: number) {
  if (typeof value !== 'string' || unsafe.test(value)) return null
  const trimmed = value.trim()
  return trimmed ? [...trimmed].slice(0, max).join('') : null
}
const won = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= INTEGER_MAX ? value : null
function imageOf(value: unknown) {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && imageHost.test(url.hostname) && !url.username && !url.password && !url.port ? url.href : null
  } catch { return null }
}

// 조회 응답의 옵션 하나를 검사한다. 이름이 없거나 다른 상품이면 버린다.
export function readItem(raw: unknown, productId: string): CoupangItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const item = raw as Record<string, unknown>
  const name = clip(item.name, 500)
  if (item.product_id !== productId || !name) return null
  const id = (value: unknown) => typeof value === 'string' && digits.test(value) ? value : null
  const krw = item.currency === 'KRW'
  const discount = typeof item.discount_percent === 'number' && Number.isFinite(item.discount_percent)
    && item.discount_percent >= 0 && item.discount_percent <= 100 ? Math.round(item.discount_percent) : null
  return { itemId: id(item.item_id), vendorItemId: id(item.vendor_item_id), name, price: krw ? won(item.price) : null,
    listPrice: krw ? won(item.list_price) : null, discountPercent: discount, inStock: typeof item.in_stock === 'boolean' ? item.in_stock : null,
    deliveryEta: clip(item.delivery_eta, 100), imageUrl: imageOf(item.image) }
}

// ReefAPI: https://reefapi.com/docs/coupang — 사용자 URL을 직접 부르지 않고 상품 ID만 보낸다. 상품 ID로 부르면 옵션 전체가 온다.
export function createReefFetcher(apiKey: string | undefined, fetcher: typeof fetch = fetch): ProductFetcher {
  return async (productId, timeoutMs = 15000) => {
    if (!apiKey?.trim()) return { ok: false, code: 'NOT_CONFIGURED', retryable: false }
    if (!digits.test(productId)) return { ok: false, code: 'NOT_FOUND', retryable: false }
    let response: Response
    try {
      response = await fetcher(REEF_URL, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId }) })
    } catch (error) {
      // 원문은 버리고 종류만 남긴다. 시간 초과·네트워크 오류는 과금되지 않아 다시 시도한다.
      return { ok: false, code: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'UPSTREAM', retryable: true }
    }
    let body: unknown = null
    try { body = await response.json() } catch { body = null }
    const payload = (body && typeof body === 'object' ? body : {}) as { ok?: unknown; data?: { items?: unknown }; error?: { code?: unknown } | null }
    const code = typeof payload.error?.code === 'string' ? payload.error.code : ''
    if (code === 'NOT_FOUND' || response.status === 404) return { ok: false, code: 'NOT_FOUND', retryable: false }
    if (code === 'RATE_LIMITED' || response.status === 429) return { ok: false, code: 'RATE_LIMITED', retryable: true }
    if (!response.ok || payload.ok !== true) return { ok: false, code: 'UPSTREAM', retryable: true }
    const list = payload.data?.items
    if (!Array.isArray(list)) return { ok: false, code: 'INVALID_RESPONSE', retryable: false }
    const items = list.map(raw => readItem(raw, productId)).filter((item): item is CoupangItem => item !== null).slice(0, ITEMS_MAX)
    return items.length ? { ok: true, items } : { ok: false, code: 'NOT_FOUND', retryable: false }
  }
}

// 링크의 옵션을 찾는다. 판매자가 바뀌면 vendorItemId가 달라지므로 같은 옵션(itemId)이면 쓰되 알린다.
export function matchItem(items: CoupangItem[], link: Pick<LinkIdentity, 'itemId' | 'vendorItemId'>) {
  const byVendor = link.vendorItemId ? items.find(item => item.vendorItemId === link.vendorItemId) : undefined
  if (byVendor) return { item: byVendor, warning: null }
  const byItem = link.itemId ? items.find(item => item.itemId === link.itemId) : undefined
  if (byItem) return { item: byItem, warning: link.vendorItemId ? SELLER_WARNING : null }
  return { item: null, warning: null }
}

// 저장된 상품 정보로 품목에 넣을 값을 만든다.
export function lookupFor(product: StoredProduct | undefined, link: LinkIdentity): ProductLookup {
  const none = (warning: string): ProductLookup => ({ name: null, price: null, snapshot: null, fetchedAt: null, warning })
  if (!product || product.status !== 'ready') return none(product?.errorCode === 'NOT_CONFIGURED' ? lookupWarnings.notConfigured : lookupWarnings.failed)
  if (!link.itemId && !link.vendorItemId) return none(lookupWarnings.noOption)
  const { item, warning } = matchItem(product.items, link)
  if (!item) return none(lookupWarnings.noMatch)
  const snapshot = { provider: 'reef', productId: link.productId, itemId: item.itemId, vendorItemId: item.vendorItemId,
    name: item.name, price: item.price, currency: 'KRW' }
  return { name: item.name, price: item.price, snapshot, fetchedAt: product.fetchedAt,
    warning: warning ?? (item.price === null ? lookupWarnings.noPrice : null) }
}
```

- [ ] **Step 4: 조회 테스트 통과 확인**

Run: `cd apps/api && npx tsx --test src/purchases/products.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: 실패하는 저장·실행기 테스트 작성**

`apps/api/src/purchases/catalog.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { migrationsFolder } from '../db/test-migrations.js'
import { createProductCatalog } from './catalog.js'
import { createLookupRunner } from './lookup-runner.js'
import type { FetchResult } from './products.js'

const item = (vendorItemId: string, price = 1000) => ({ itemId: '1', vendorItemId, name: '상품', price, listPrice: null, discountPercent: null,
  inStock: true, deliveryEta: null, imageUrl: null })
async function setup() {
  const pg = new PGlite()
  const db = drizzle(pg)
  await migrate(db, { migrationsFolder })
  const rows = async () => (await pg.query<{ id: string; status: string; attempts: number; error_code: string | null; locked: boolean; wait: number }>(
    `SELECT id, status, attempts, error_code, locked_until IS NOT NULL AS locked,
      round(extract(epoch FROM next_attempt_at - now()) / 60)::int AS wait FROM coupang_products ORDER BY id`)).rows
  return { pg, db, rows }
}

test('대기열은 시도할 때가 된 상품만 잠가 가져가고, 잠금이 풀리기 전에는 다시 가져가지 않는다', async () => {
  const { pg, db } = await setup()
  try {
    await pg.exec("INSERT INTO coupang_products (id) VALUES ('1'),('2'); INSERT INTO coupang_products (id, next_attempt_at) VALUES ('3', now() + interval '1 hour')")
    const catalog = createProductCatalog(db, async () => ({ ok: true, items: [item('9')] }))
    assert.deepEqual((await catalog.claim(5)).map(row => row.id).sort(), ['1', '2'])
    assert.deepEqual(await catalog.claim(5), [])
    await pg.exec("UPDATE coupang_products SET locked_until = now() - interval '1 second' WHERE id = '1'")
    assert.deepEqual((await catalog.claim(5)).map(row => row.id), ['1'])
  } finally { await pg.close() }
})

test('성공은 옵션을 저장하고, 실패는 1·5·30분 뒤 다시 시도하다 네 번째에 멈추며, NOT_FOUND는 바로 멈춘다', async () => {
  const { pg, db, rows } = await setup()
  try {
    await pg.exec("INSERT INTO coupang_products (id) VALUES ('1'),('2'),('3')")
    const results: Record<string, FetchResult> = {
      '1': { ok: true, items: [item('9')] },
      '2': { ok: false, code: 'RATE_LIMITED', retryable: true },
      '3': { ok: false, code: 'NOT_FOUND', retryable: false },
    }
    const catalog = createProductCatalog(db, async id => results[id]!)
    const runAll = async () => { for (const product of await catalog.claim(5)) await catalog.process(product) }
    await runAll()
    const [ready, waiting, missing] = await rows()
    assert.deepEqual([ready!.status, ready!.attempts, ready!.locked], ['ready', 0, false])
    assert.deepEqual((await catalog.read(['1'])).get('1')!.items, [item('9')])
    assert.deepEqual([waiting!.status, waiting!.attempts, waiting!.error_code, waiting!.wait], ['pending', 1, 'RATE_LIMITED', 1])
    assert.deepEqual([missing!.status, missing!.error_code], ['failed', 'NOT_FOUND'])
    for (const wait of [5, 30]) {
      await pg.exec("UPDATE coupang_products SET next_attempt_at = now() WHERE id = '2'")
      await runAll()
      assert.equal((await rows())[1]!.wait, wait)
    }
    await pg.exec("UPDATE coupang_products SET next_attempt_at = now() WHERE id = '2'")
    await runAll()
    const stopped = (await rows())[1]!
    assert.deepEqual([stopped.status, stopped.attempts], ['failed', 4])
  } finally { await pg.close() }
})

test('바로 조회는 없는 상품 행을 만들고, 이미 받은 정보는 실패해도 지우지 않는다', async () => {
  const { pg, db, rows } = await setup()
  try {
    let next: FetchResult = { ok: true, items: [item('9', 1000)] }
    const catalog = createProductCatalog(db, async () => next)
    assert.equal((await catalog.refresh(['5', '5'])).get('5')!.status, 'ready')
    next = { ok: false, code: 'TIMEOUT', retryable: true }
    const kept = (await catalog.refresh(['5'])).get('5')!
    assert.deepEqual([kept.status, kept.items[0]!.price], ['ready', 1000])
    assert.equal((await catalog.refresh(['6'])).get('6')!.status, 'pending')
    assert.deepEqual((await rows()).map(row => [row.id, row.status, row.attempts]), [['5', 'ready', 0], ['6', 'pending', 1]])
    const unconfigured = (await createProductCatalog(db).refresh(['7'])).get('7')!
    assert.deepEqual([unconfigured.status, unconfigured.errorCode], ['failed', 'NOT_CONFIGURED'])
  } finally { await pg.close() }
})

test('실행기는 대기열을 끝까지 비우고, 동시에 두 개까지만 조회하며, 실행 중 들어온 상품도 처리한다', async () => {
  const { pg, db, rows } = await setup()
  try {
    await pg.exec("INSERT INTO coupang_products (id) VALUES ('1'),('2'),('3'),('4'),('5')")
    let running = 0
    let most = 0
    const catalog = createProductCatalog(db, async () => {
      running++; most = Math.max(most, running)
      await new Promise(resolve => setTimeout(resolve, 5))
      running--
      return { ok: true, items: [item('9')] }
    })
    const runner = createLookupRunner(catalog)
    const first = runner.kick()
    await pg.exec("INSERT INTO coupang_products (id) VALUES ('6')")
    assert.equal(runner.kick(), first)
    await first
    assert.equal(most, 2)
    assert.ok((await rows()).every(row => row.status === 'ready'))
  } finally { await pg.close() }
})

test('실행기의 DB 오류는 원문 없이 알리고, 다음 kick에서 다시 시도한다', async () => {
  let failures = 0
  let claims = 0
  const runner = createLookupRunner({
    claim: async () => { claims++; if (claims === 1) throw new Error('db-secret'); return [] },
    process: async () => {},
  }, { onFailure: () => { failures++ } })
  await runner.kick()
  await runner.kick()
  assert.deepEqual([failures, claims], [1, 2])
})
```

- [ ] **Step 6: 실패 확인과 생성기 임시 정리**

Run: `cd apps/api && npx tsx --test src/purchases/catalog.test.ts`
Expected: FAIL — `Cannot find module './catalog.js'`

`readProduct`가 없어졌으므로 생성기를 이 Task에서 함께 바꾼다(Task 6의 담기 흐름이 이 입력을 쓴다).

`apps/api/src/purchases/generation.ts`:
- `import { readProduct } from './products.js'`를 `import type { ProductLookup } from './products.js'`로 바꾼다.
- `DraftInput`에 칸을 더한다:

```ts
export interface DraftInput {
  eventName: string
  links: string[]
  // links와 같은 순서의 조회 결과. 가격·상품 정보는 이 값만 쓴다.
  products: ProductLookup[]
  messages: { id: string; content: string; createdAt: string }[]
}
```

- `createDraftGenerator`의 설정에서 `reefApiKey`를 지운다: `config: { apiKey?: string; model?: string }`.
- `const products = await Promise.all(input.links.map(link => readProduct(link, config.reefApiKey, fetcher)))`를 `const products = input.products`로 바꾼다.
- `validateDraft` 첫 줄 조건에 `|| input.products.length !== input.links.length`를 더한다.

`apps/api/src/purchases/generation.test.ts`:
- `import { readProduct } from './products.js'`와 `readProduct`를 쓰는 테스트 세 개(`missing itemId…`, `missing vendor identity…`, `product identity is exact…`)를 지운다. 같은 규칙은 `products.test.ts`가 확인한다.
- 입력과 조회 결과를 바꾼다:

```ts
const found = { name: '테이블, 화이트', price: 11590, snapshot: { provider: 'reef', price: 11590 }, fetchedAt: new Date('2026-09-29T00:00:00Z'), warning: null }
const input = { eventName: '행사', links: [link], products: [found], messages: [{ id: 'm', content: '접수용 2개', createdAt: '2026-09-29T00:00:00Z' }] }
```

- `generation uses structured output…` 테스트의 fetcher에서 `if (url === 'https://api.reefapi.com/coupang/v1/product') …` 줄을 지우고, `createDraftGenerator({ apiKey: 'test-key', model: 'test-model' }, fetcher)`로 부른다(`reefApiKey` 없음).
- `failed product lookup cannot get a fabricated price from the model` 테스트를 바꾼다:

```ts
test('조회하지 못한 상품은 모델이 가격을 지어낼 수 없고 조회 경고가 품목에 붙는다', async () => {
  const failed = { name: null, price: null, snapshot: null, fetchedAt: null, warning: '상품 정보를 가져오지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.' }
  const draft = await createDraftGenerator({ apiKey: 'test-key', model: 'test-model' }, async () => json({
    status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output()) }] }],
  }))({ ...input, products: [failed] })
  assert.equal(draft.items[0]?.estimatedUnitPrice, null)
  assert.equal(draft.items[0]?.productSnapshot, null)
  assert.ok(draft.items[0]!.warnings.includes(failed.warning))
})
```

`apps/api/scripts/check-draft-live.ts`를 바꾼다(수동 실행용):

```ts
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
```

(파일의 `const item = draft.items[0]` 이하 검사 부분은 그대로 둔다.)

`apps/api/src/serve.ts`의 생성기 설정에서 `reefApiKey: env.REEF_API_KEY,` 줄을 지운다(실행기 연결은 Task 8).

`apps/api/src/purchases/service.ts`의 `createDrafts`에서 `draftInput`을 임시로 바꾼다(Task 6이 후보 조회로 바꾼다):

```ts
        // Task 6에서 후보의 저장된 조회 결과로 바꾼다.
        const products = links.map(() => ({ name: null, price: null, snapshot: null, fetchedAt: null, warning: null }))
        const draftInput: DraftInput = { eventName: event.name, links, products,
          messages: bounded.reverse().map(message => ({ ...message, createdAt: message.createdAt.toISOString() })) }
```

- [ ] **Step 7: 저장·실행기 구현**

`apps/api/src/purchases/catalog.ts`:

```ts
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { coupangProducts } from '../db/schema.js'
import type { FetchResult, ProductFetcher } from './products.js'

export type CatalogDatabase = Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'insert' | 'update' | 'transaction'>
export type ProductRow = typeof coupangProducts.$inferSelect
// 실패 뒤 다시 시도까지 기다리는 분. 네 번째 실패에서 멈춘다.
const RETRY_MINUTES = [1, 5, 30]
const NOT_CONFIGURED: FetchResult = { ok: false, code: 'NOT_CONFIGURED', retryable: false }

async function mapLimit<T, R>(values: T[], limit: number, run: (value: T) => Promise<R>) {
  const results: R[] = []
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) { const index = next++; results[index] = await run(values[index]!) }
  }))
  return results
}

export function createProductCatalog(db: CatalogDatabase, fetchProduct?: ProductFetcher) {
  const call = (id: string, timeoutMs?: number) => fetchProduct ? fetchProduct(id, timeoutMs) : Promise.resolve(NOT_CONFIGURED)
  // 성공이면 옵션 목록을 바꾸고, 실패면 다시 시도 일정을 정하거나 멈춘다.
  async function store(id: string, result: FetchResult, attempts: number) {
    if (result.ok) {
      await db.update(coupangProducts).set({ status: 'ready', items: result.items, fetchedAt: sql`now()`, attempts: 0,
        nextAttemptAt: sql`now()`, lockedUntil: null, errorCode: null }).where(eq(coupangProducts.id, id))
      return
    }
    const failures = attempts + 1
    const retry = result.retryable && failures <= RETRY_MINUTES.length
    await db.update(coupangProducts).set({ attempts: failures, lockedUntil: null, errorCode: result.code,
      ...(retry ? { status: 'pending' as const, nextAttemptAt: sql`now() + make_interval(mins => ${RETRY_MINUTES[failures - 1]!})` }
        : { status: 'failed' as const }) }).where(eq(coupangProducts.id, id))
  }
  async function read(ids: string[]) {
    if (!ids.length) return new Map<string, ProductRow>()
    const rows = await db.select().from(coupangProducts).where(inArray(coupangProducts.id, ids))
    return new Map(rows.map(row => [row.id, row]))
  }
  return {
    read,
    // 대기 중이고 시도할 때가 된 상품을 잠가 가져온다. 다른 실행이 잡은 행은 건너뛰고, 60초 안에 못 끝내면 다시 가져갈 수 있다.
    async claim(limit: number): Promise<ProductRow[]> {
      return db.transaction(async tx => {
        const due = await tx.select({ id: coupangProducts.id }).from(coupangProducts)
          .where(and(eq(coupangProducts.status, 'pending'), lte(coupangProducts.nextAttemptAt, sql`now()`),
            or(isNull(coupangProducts.lockedUntil), lt(coupangProducts.lockedUntil, sql`now()`))))
          .orderBy(asc(coupangProducts.nextAttemptAt)).limit(limit).for('update', { skipLocked: true })
        if (!due.length) return []
        return tx.update(coupangProducts).set({ lockedUntil: sql`now() + interval '60 seconds'` })
          .where(inArray(coupangProducts.id, due.map(row => row.id))).returning()
      })
    },
    async process(product: ProductRow) {
      await store(product.id, await call(product.id), product.attempts)
    },
    // 담기·제출처럼 지금 결과가 필요할 때 부른다. 이미 받아 둔 정보는 실패해도 그대로 둔다.
    async refresh(ids: string[], timeoutMs?: number) {
      const unique = [...new Set(ids)]
      if (!unique.length) return new Map<string, ProductRow>()
      await db.insert(coupangProducts).values(unique.map(id => ({ id }))).onConflictDoNothing()
      const before = await read(unique)
      const results = await mapLimit(unique, 4, async id => ({ id, result: await call(id, timeoutMs) }))
      for (const { id, result } of results) {
        const row = before.get(id)
        if (result.ok || row?.status !== 'ready') await store(id, result, row?.attempts ?? 0)
      }
      return read(unique)
    },
  }
}
export type ProductCatalog = ReturnType<typeof createProductCatalog>
```

`apps/api/src/purchases/lookup-runner.ts`:

```ts
import type { ProductCatalog } from './catalog.js'

type Options = { concurrency?: number; onFailure?: () => void }

// 대화에 쿠팡 링크가 올라오면 뒤에서 상품을 조회한다. 서버 한 대에서 동시에 concurrency개까지만 부른다(ReefAPI 키당 초당 약 5회).
export function createLookupRunner(catalog: Pick<ProductCatalog, 'claim' | 'process'>,
  { concurrency = 2, onFailure = () => console.error('PRODUCT_LOOKUP_FAILED') }: Options = {}) {
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
```

- [ ] **Step 8: 통과 확인**

Run: `cd apps/api && npx tsx --test src/purchases/products.test.ts src/purchases/catalog.test.ts src/purchases/generation.test.ts`
Expected: PASS. 이어서 `npm test --workspace @vada/api`와 `npm run typecheck`도 통과해야 한다(구매 API 테스트의 생성기는 가짜라 가격을 스스로 넣는다).

- [ ] **Step 9: 커밋**

```bash
git add apps/api/src/purchases apps/api/src/serve.ts apps/api/scripts/check-draft-live.ts apps/api/package.json
git commit -m "쿠팡 상품을 상품 단위로 조회해 저장하는 대기열 추가"
```

---

### Task 4: 대화의 쿠팡 링크를 후보로 기록

**Files:**
- Create: `apps/api/src/purchases/candidates.ts`(이 Task에서는 `recordMessageLinks`만)
- Modify: `apps/api/src/chat/chat.ts`, `apps/api/src/chat/chat.test.ts`

**Interfaces:**
- Consumes: `parseCoupangLinks`, `CoupangLink`(Task 1), 표(Task 2)
- Produces: `recordMessageLinks(tx, { organizationId, eventId, messageId }, links)`, `createChatRoutes(db, getSession, onLinks?: () => void)`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/chat/chat.test.ts` 위쪽 import에 `import { migrationsFolder } from '../db/test-migrations.js'`를 더하고, 파일 끝에 더한다:

```ts
test('쿠팡 링크가 있는 메시지는 같은 트랜잭션에서 후보·공유로 기록하고, 저장 뒤 조회를 부른다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('p','Planner','p@test.local'),('q','Second','q@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A');
      INSERT INTO memberships(id,user_id,organization_id) VALUES ('p','p','a'),('q','q','a');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e1','a','First','p');
      INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('r1','a','e1');
    `)
    let userId = 'p'
    let kicks = 0
    const session = async () => ({ user: { id: userId } })
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, chat: createChatRoutes(db, session, () => { kicks++ }) })
    const post = (content: string) => app.request('/api/organizations/a/events/e1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ content }) })
    const link = (vendor: string | null, item = '7') => `https://www.coupang.com/vp/products/1?itemId=${item}${vendor ? `&vendorItemId=${vendor}` : ''}`
    const candidates = async () => (await pg.query<{ vendor_item_id: string | null; item_id: string | null; shares: number; hidden: boolean }>(
      `SELECT c.vendor_item_id, c.item_id, count(s.*)::int AS shares, c.hidden_at IS NOT NULL AS hidden FROM purchase_candidates c
       JOIN purchase_candidate_shares s ON s.candidate_id = c.id GROUP BY c.id ORDER BY c.vendor_item_id NULLS LAST`)).rows
    const product = async () => (await pg.query<{ status: string; attempts: number }>("SELECT status, attempts FROM coupang_products WHERE id = '1'")).rows[0]

    assert.equal((await post('링크 없는 메시지')).status, 201)
    assert.equal(kicks, 0)
    assert.equal((await post(`이거 ${link('11')} 그리고 ${link('12')} 또 ${link('11')}`)).status, 201)
    assert.equal(kicks, 1)
    userId = 'q'
    // 옵션 정보가 없는 링크는 상품마다 "옵션 미정" 후보 하나로 모인다.
    assert.equal((await post(`나도 ${link('11')} ${link(null)} ${link(null, '8')}`)).status, 201)
    // 같은 링크를 거의 동시에 올려도 후보는 하나다(Review Focus 1).
    await Promise.all([post(link('13')), post(link('13'))])
    assert.deepEqual(await candidates(), [
      { vendor_item_id: '11', item_id: '7', shares: 3, hidden: false }, { vendor_item_id: '12', item_id: '7', shares: 1, hidden: false },
      { vendor_item_id: '13', item_id: '7', shares: 2, hidden: false }, { vendor_item_id: null, item_id: '7', shares: 2, hidden: false }])
    assert.deepEqual(await product(), { status: 'pending', attempts: 0 })

    // 실패했던 상품은 다시 공유되면 다시 조회하고(NOT_FOUND 제외), 숨긴 후보는 숨김을 푼다.
    await pg.exec(`UPDATE coupang_products SET status = 'failed', error_code = 'TIMEOUT', attempts = 4 WHERE id = '1';
      UPDATE purchase_candidates SET hidden_by = 'p', hidden_at = now() WHERE vendor_item_id = '12'`)
    await post(link('12'))
    assert.deepEqual(await product(), { status: 'pending', attempts: 0 })
    assert.equal((await candidates())[1]!.hidden, false)
    await pg.exec("UPDATE coupang_products SET status = 'failed', error_code = 'NOT_FOUND' WHERE id = '1'")
    await post(link('12'))
    assert.equal((await product())!.status, 'failed')
  } finally { await pg.close() }
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && npx tsx --test src/chat/chat.test.ts`
Expected: FAIL — 후보가 없다(`[]`), `kicks`가 0

- [ ] **Step 3: 링크 기록 구현**

`apps/api/src/purchases/candidates.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { CoupangLink } from '@vada/contracts'
import { coupangProducts, purchaseCandidates as candidates, purchaseCandidateShares as shares } from '../db/schema.js'

type Writer = Pick<PgDatabase<PgQueryResultHKT>, 'insert'>

// 대화 저장 트랜잭션에서 부른다. 상품 행은 조회 대기로 두고(실패했던 상품은 NOT_FOUND가 아니면 다시 대기),
// 행사의 후보를 만들거나 찾아 공유를 남긴다. 숨긴 후보가 다시 공유되면 숨김을 푼다(2026-10-09 결정).
export async function recordMessageLinks(tx: Writer, scope: { organizationId: string; eventId: string; messageId: string }, links: CoupangLink[]) {
  if (!links.length) return
  await tx.insert(coupangProducts).values([...new Set(links.map(link => link.productId))].map(id => ({ id })))
    .onConflictDoUpdate({ target: coupangProducts.id, set: { status: 'pending', attempts: 0, nextAttemptAt: sql`now()`, errorCode: null },
      setWhere: sql`${coupangProducts.status} = 'failed' AND ${coupangProducts.errorCode} IS DISTINCT FROM 'NOT_FOUND'` })
  for (const [position, link] of links.entries()) {
    const [candidate] = await tx.insert(candidates).values({ id: randomUUID(), organizationId: scope.organizationId, eventId: scope.eventId,
      productId: link.productId, itemId: link.itemId, vendorItemId: link.vendorItemId, url: link.url })
      .onConflictDoUpdate({ target: [candidates.eventId, candidates.productId, candidates.vendorItemId],
        set: { itemId: sql`coalesce(${candidates.itemId}, excluded.item_id)`, hiddenBy: null, hiddenAt: null } })
      .returning({ id: candidates.id })
    await tx.insert(shares).values({ organizationId: scope.organizationId, candidateId: candidate!.id, messageId: scope.messageId, position })
  }
}
```

`apps/api/src/chat/chat.ts`:
- import를 더한다:

```ts
import { CreateMessageSchema, parseCoupangLinks, type MessageResponse, type MessagesResponse, type MessageSummary } from '@vada/contracts'
import { recordMessageLinks } from '../purchases/candidates.js'
```

- 함수 머리를 바꾼다:

```ts
export function createChatRoutes(
  db: Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'transaction'>,
  getSession: SessionReader,
  // 쿠팡 링크가 있는 메시지를 저장한 뒤 부른다. 뒤에서 상품을 조회한다.
  onLinks?: () => void,
) {
```

- POST 처리기를 바꾼다:

```ts
  routes.post(path, json(CreateMessageSchema), authenticated, member, room, async c => {
    const { content } = c.req.valid('json')
    const links = parseCoupangLinks(content)
    const saved = await db.transaction(async tx => {
      // 저장 시점에도 소속·행사·방을 함께 검사한다. 요청 본문의 작성자/방/시각은 무시한다.
      const [created] = await tx.insert(messages).select(
        tx.select({
          id: sql<string>`${randomUUID()}`.as('id'),
          chatRoomId: chatRooms.id,
          authorId: memberships.userId,
          content: sql<string>`${content}`.as('content'),
          createdAt: sql<Date>`now()`.as('created_at'),
        }).from(chatRooms)
          .innerJoin(events, and(eq(events.id, chatRooms.eventId), eq(events.organizationId, chatRooms.organizationId)))
          .innerJoin(memberships, and(eq(memberships.organizationId, chatRooms.organizationId), eq(memberships.userId, c.get('userId'))))
          .where(and(eq(chatRooms.id, c.get('chatRoomId')), eq(events.id, c.req.param('eventId')), eq(events.organizationId, c.req.param('organizationId')))),
      ).returning({ id: messages.id })
      if (!created) return undefined
      // 메시지의 쿠팡 링크를 같은 트랜잭션에서 후보로 기록한다. 학생회·행사는 위 삽입이 검사했다.
      await recordMessageLinks(tx, { organizationId: c.req.param('organizationId'), eventId: c.req.param('eventId'), messageId: created.id }, links)
      const [row] = await tx.select(messageFields).from(messages).innerJoin(users, eq(users.id, messages.authorId))
        .where(eq(messages.id, created.id))
      return row
    })
    if (!saved) return c.json({ error: 'FORBIDDEN' }, 403)
    // 응답은 조회를 기다리지 않는다.
    if (links.length) onLinks?.()
    return c.json({ message: serialize(saved) } satisfies MessageResponse, 201)
  })
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/api && npx tsx --test src/chat/chat.test.ts src/http/boundary.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/purchases/candidates.ts apps/api/src/chat
git commit -m "대화의 쿠팡 링크를 후보로 기록"
```

---

### Task 5: 후보 목록과 숨기기 API

**Files:**
- Modify: `apps/api/src/purchases/candidates.ts`, `apps/api/src/purchases/purchases.ts`, `apps/api/src/purchases/test-setup.ts`, `apps/api/package.json`
- Create: `apps/api/src/purchases/candidates.test.ts`

**Interfaces:**
- Consumes: `recordMessageLinks`(Task 4), `matchItem`(Task 3), `PurchaseScope`(service.ts)
- Produces:
  - `createCandidateService(db)` → `{ list(scope): Promise<PurchaseCandidatesResponse>, setHidden(scope, id, hidden): Promise<PurchaseCandidate> }`
  - 라우트 `GET …/events/:eventId/purchase-candidates`, `POST …/purchase-candidates/:candidateId/hidden`
  - `setupPurchases()` 반환에 `share(content, event = 'e', author = 'p'): Promise<string>`(메시지 ID), `ready(productId, items)`, `candidateOf(url, event = 'e'): Promise<string>`

- [ ] **Step 1: 테스트 도우미 더하기**

`apps/api/src/purchases/test-setup.ts`:
- import에 더한다:

```ts
import { parseCoupangLinks } from '@vada/contracts'
import type { CoupangItem } from '../db/schema.js'
import { recordMessageLinks } from './candidates.js'
```

- `return { pg, db, … }` 위에 더한다:

```ts
  // 대화에 링크를 올린 것처럼 메시지를 넣고, 대화 저장과 같은 함수로 후보를 기록한다.
  const rooms: Record<string, [room: string, organizationId: string]> = { e: ['room', 'a'], e2: ['room2', 'a'], ex: ['roomx', 'b'] }
  async function share(content: string, event = 'e', author = 'p') {
    const [room, organizationId] = rooms[event]!
    const messageId = crypto.randomUUID()
    await pg.query('INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ($1,$2,$3,$4)', [messageId, room, author, content])
    await db.transaction(tx => recordMessageLinks(tx, { organizationId, eventId: event, messageId }, parseCoupangLinks(content)))
    return messageId
  }
  // 뒤에서 하는 조회가 끝난 것처럼 상품 행을 채운다.
  async function ready(productId: string, items: CoupangItem[]) {
    await pg.query("UPDATE coupang_products SET status = 'ready', items = $2, fetched_at = now() WHERE id = $1", [productId, JSON.stringify(items)])
  }
  const candidateOf = async (url: string, event = 'e') =>
    (await pg.query<{ id: string }>('SELECT id FROM purchase_candidates WHERE url = $1 AND event_id = $2', [url, event])).rows[0]!.id
```

- 반환 객체에 `share, ready, candidateOf`를 더한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`apps/api/src/purchases/candidates.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PurchaseCandidateResponse, PurchaseCandidatesResponse } from '@vada/contracts'
import { SELLER_WARNING } from './products.js'
import { link, setupPurchases } from './test-setup.js'

const base = '/events/e/purchase-candidates'
const option = (vendorItemId: string, name: string, price: number | null = 1000) => ({ itemId: '2001', vendorItemId, name, price,
  listPrice: null, discountPercent: null, inStock: true, deliveryEta: null, imageUrl: null })

test('후보: 같은 상품·옵션은 하나로 모으고, 공유한 사람·조회 상태·상품 정보를 보여 준다', async () => {
  const { pg, request, ok, share, ready } = await setupPurchases()
  try {
    const first = await share(`이거 ${link(1)}`)
    const second = await share(`나도 ${link(1)}`, 'e', 'q')
    await share('판매자 다른 https://www.coupang.com/vp/products/1001?itemId=2001&vendorItemId=3009')
    await share('옵션 없는 https://www.coupang.com/vp/products/1001')
    const list = async () => (await ok<PurchaseCandidatesResponse>(request('GET', base))).candidates
    let candidates = await list()
    assert.deepEqual(candidates.map(c => [c.vendorItemId, c.shareCount, c.lookup, c.product]),
      [[null, 1, 'pending', null], ['3009', 1, 'pending', null], ['3001', 2, 'pending', null]])
    assert.deepEqual(candidates[2]!.shares.map(s => [s.messageId, s.author.name]), [[second, '기획2'], [first, '기획']])
    await ready('1001', [option('3001', '테이블, 화이트', 11590), option('3002', '테이블, 블랙')])
    candidates = await list()
    const [unknown, moved, white] = candidates
    assert.deepEqual([white!.lookup, white!.optionKnown, white!.product?.name, white!.product?.price, white!.warning],
      ['ready', true, '테이블, 화이트', 11590, null])
    assert.deepEqual([moved!.optionKnown, moved!.product?.price, moved!.warning], [true, 11590, SELLER_WARNING])
    assert.deepEqual([unknown!.optionKnown, unknown!.product?.name, unknown!.product?.price], [false, '테이블, 화이트', null])
  } finally { await pg.close() }
})

test('숨기기: 학생회 누구나 하고 되돌리며, 이미 숨긴 후보는 처음 숨긴 사람을 남기고, 다시 공유되면 숨김을 푼다', async () => {
  const { pg, request, ok, share, as } = await setupPurchases()
  try {
    await share(`이거 ${link(1)}`)
    const [candidate] = (await ok<PurchaseCandidatesResponse>(request('GET', base))).candidates
    const hide = async (hidden: boolean) => (await ok<PurchaseCandidateResponse>(request('POST', `${base}/${candidate!.id}/hidden`, { hidden }))).candidate
    as('n')
    assert.equal((await hide(true)).hidden?.by.name, '새내기')
    as('q')
    assert.equal((await hide(true)).hidden?.by.name, '새내기')
    assert.equal((await hide(false)).hidden, null)
    assert.equal((await hide(false)).hidden, null)
    await hide(true)
    await share(`다시 ${link(1)}`)
    assert.equal((await ok<PurchaseCandidatesResponse>(request('GET', base))).candidates[0]!.hidden, null)
  } finally { await pg.close() }
})

test('요청됨은 제출된 품목만 모두에게, 내가 담음은 작성 중 품목의 주인에게만 보인다', async () => {
  const { pg, request, ok, share, candidateOf, as } = await setupPurchases()
  try {
    await share(`이거 ${link(1)}`)
    const id = await candidateOf(link(1))
    await pg.exec(`INSERT INTO purchase_submissions (id,organization_id,event_id,requester_id) VALUES ('s','a','e','q');
      INSERT INTO purchase_items (id,organization_id,event_id,requester_id,candidate_id,product_url,status,submission_id,quantity) VALUES
        ('mine','a','e','p','${id}','${link(1)}','draft',NULL,1),
        ('theirs','a','e','q','${id}','${link(1)}','pending','s',3),
        ('gone','a','e','q','${id}','${link(1)}','cancelled','s',9);`)
    const view = async (user: string) => { as(user); return (await ok<PurchaseCandidatesResponse>(request('GET', base))).candidates[0]! }
    const forPlanner = await view('p')
    assert.deepEqual([forPlanner.draftedByMe, forPlanner.requests], [true, [{ requester: { id: 'q', name: '기획2' }, quantity: 3, status: 'pending' }]])
    assert.equal((await view('q')).draftedByMe, false)
  } finally { await pg.close() }
})

test('후보 경계: 미인증 401, 다른 학생회 403, 없는 행사·남의 행사·다른 행사의 후보 404, 잘못된 본문 400', async () => {
  const { pg, request, share, candidateOf, as } = await setupPurchases()
  try {
    await share(`이거 ${link(1)}`, 'e2')
    const other = await candidateOf(link(1), 'e2')
    assert.equal((await request('POST', `${base}/${other}/hidden`, { hidden: true })).status, 404)
    for (const path of ['/events/missing/purchase-candidates', '/events/ex/purchase-candidates']) assert.equal((await request('GET', path)).status, 404)
    assert.equal((await request('POST', `${base}/${'x'.repeat(65)}/hidden`, { hidden: true })).status, 404)
    assert.equal((await request('POST', `/events/e2/purchase-candidates/${other}/hidden`, { hidden: 'yes' })).status, 400)
    as(null); assert.equal((await request('GET', base)).status, 401)
    as('x'); assert.equal((await request('GET', base)).status, 403)
  } finally { await pg.close() }
})

test('후보 목록은 최근 공유 300개까지만 주고 잘렸다고 알린다', async () => {
  const { pg, request, ok } = await setupPurchases()
  try {
    await pg.exec(`INSERT INTO coupang_products (id) VALUES ('9');
      INSERT INTO purchase_candidates (id,organization_id,event_id,product_id,vendor_item_id,url)
        SELECT 'c' || n, 'a', 'e', '9', n::text, 'https://www.coupang.com/vp/products/9?vendorItemId=' || n FROM generate_series(1, 301) AS n;
      INSERT INTO messages (id,chat_room_id,author_id,content) SELECT 'msg' || g, 'room', 'p', '링크' FROM generate_series(0, 30) AS g;
      INSERT INTO purchase_candidate_shares (organization_id,candidate_id,message_id,position,created_at)
        SELECT 'a', 'c' || n, 'msg' || (n / 10), n % 10, now() + make_interval(secs => n) FROM generate_series(1, 301) AS n;`)
    const body = await ok<PurchaseCandidatesResponse>(request('GET', base))
    assert.deepEqual([body.candidates.length, body.truncated, body.candidates[0]!.id], [300, true, 'c301'])
  } finally { await pg.close() }
})
```

`apps/api/package.json`의 `"test"`에서 `src/purchases/review.test.ts` 뒤에 ` src/purchases/candidates.test.ts`를 더한다.

- [ ] **Step 3: 실패 확인**

Run: `cd apps/api && npx tsx --test src/purchases/candidates.test.ts`
Expected: FAIL — 후보 경로가 없다(404)

- [ ] **Step 4: 목록·숨기기 구현**

`apps/api/src/purchases/candidates.ts`의 import를 바꾸고 아래를 더한다:

```ts
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { CoupangLink, PurchaseCandidate, PurchaseCandidatesResponse } from '@vada/contracts'
import { coupangProducts, events, messages, purchaseCandidates as candidates, purchaseCandidateShares as shares,
  purchaseItems as items, users } from '../db/schema.js'
import { matchItem } from './products.js'
import type { PurchaseScope } from './service.js'
import { PurchaseError } from './validation.js'
```

```ts
type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'selectDistinct' | 'update'>
const LIST_LIMIT = 300
const SHARES_SHOWN = 20
const hiders = alias(users, 'candidate_hiders')
type CandidateRow = { candidate: typeof candidates.$inferSelect; hiderName: string | null; shareCount: number }
type ShareRow = { candidateId: string; messageId: string; sharedAt: Date; author: { id: string; name: string } }
type RequestRow = { candidateId: string | null; status: string; quantity: number | null; requester: { id: string; name: string } }

function summary(row: CandidateRow, product: typeof coupangProducts.$inferSelect | undefined, shareRows: ShareRow[],
  requestRows: RequestRow[], drafted: { candidateId: string | null }[]): PurchaseCandidate {
  const c = row.candidate
  const ready = product?.status === 'ready' ? product : undefined
  const matched = ready ? matchItem(ready.items, c) : { item: null, warning: null }
  // 옵션을 못 맞추면 첫 옵션의 이름·이미지만 보여 주고 가격은 비운다("옵션 미정").
  const option = matched.item
  const shown = option ?? ready?.items[0] ?? null
  return {
    id: c.id, url: c.url, productId: c.productId, itemId: c.itemId, vendorItemId: c.vendorItemId,
    lookup: product?.status ?? 'pending', fetchedAt: product?.fetchedAt?.toISOString() ?? null, optionKnown: option !== null,
    product: shown ? { name: shown.name, price: option?.price ?? null, listPrice: option?.listPrice ?? null,
      discountPercent: option?.discountPercent ?? null, inStock: option?.inStock ?? null, deliveryEta: option?.deliveryEta ?? null,
      imageUrl: shown.imageUrl } : null,
    warning: matched.warning,
    shareCount: row.shareCount,
    shares: shareRows.filter(share => share.candidateId === c.id).slice(0, SHARES_SHOWN)
      .map(share => ({ messageId: share.messageId, author: share.author, sharedAt: share.sharedAt.toISOString() })),
    hidden: c.hiddenBy && c.hiddenAt ? { by: { id: c.hiddenBy, name: row.hiderName ?? '' }, at: c.hiddenAt.toISOString() } : null,
    requests: requestRows.filter(request => request.candidateId === c.id)
      .map(request => ({ requester: request.requester, quantity: request.quantity, status: request.status as 'pending' | 'approved' })),
    draftedByMe: drafted.some(entry => entry.candidateId === c.id),
  }
}

// 행사의 후보. 학생회 누구나 본다. 요청됨은 제출된 품목만, 내가 담음은 보는 사람의 작성 중 품목만 센다.
export function createCandidateService(db: Reader) {
  async function event(scope: PurchaseScope) {
    const [found] = await db.select({ id: events.id }).from(events)
      .where(and(eq(events.id, scope.eventId), eq(events.organizationId, scope.organizationId)))
    if (!found) throw new PurchaseError('NOT_FOUND', 404)
  }
  async function summaries(scope: PurchaseScope, only?: string): Promise<PurchaseCandidatesResponse> {
    const lastShared = sql<Date>`max(${shares.createdAt})`
    const rows = await db.select({ candidate: candidates, hiderName: hiders.name, shareCount: sql<number>`count(*)::int` }).from(candidates)
      .innerJoin(shares, eq(shares.candidateId, candidates.id))
      .leftJoin(hiders, eq(hiders.id, candidates.hiddenBy))
      .where(and(eq(candidates.organizationId, scope.organizationId), eq(candidates.eventId, scope.eventId),
        only === undefined ? undefined : eq(candidates.id, only)))
      .groupBy(candidates.id, hiders.name).orderBy(desc(lastShared), desc(candidates.id)).limit(LIST_LIMIT + 1)
    const page = rows.slice(0, LIST_LIMIT)
    const ids = page.map(row => row.candidate.id)
    if (!ids.length) return { candidates: [], truncated: false }
    const products = new Map((await db.select().from(coupangProducts)
      .where(inArray(coupangProducts.id, [...new Set(page.map(row => row.candidate.productId))]))).map(row => [row.id, row]))
    const shareRows = await db.select({ candidateId: shares.candidateId, messageId: shares.messageId, sharedAt: shares.createdAt,
      author: { id: users.id, name: users.name } }).from(shares)
      .innerJoin(messages, eq(messages.id, shares.messageId)).innerJoin(users, eq(users.id, messages.authorId))
      .where(inArray(shares.candidateId, ids)).orderBy(desc(shares.createdAt), desc(shares.messageId), desc(shares.position))
    const requestRows = await db.select({ candidateId: items.candidateId, status: items.status, quantity: items.quantity,
      requester: { id: users.id, name: users.name } }).from(items).innerJoin(users, eq(users.id, items.requesterId))
      .where(and(eq(items.organizationId, scope.organizationId), inArray(items.candidateId, ids), inArray(items.status, ['pending', 'approved'])))
      .orderBy(asc(items.createdAt), asc(items.id))
    const drafted = await db.selectDistinct({ candidateId: items.candidateId }).from(items)
      .where(and(eq(items.organizationId, scope.organizationId), inArray(items.candidateId, ids), eq(items.status, 'draft'),
        eq(items.requesterId, scope.userId)))
    return { candidates: page.map(row => summary(row, products.get(row.candidate.productId), shareRows, requestRows, drafted)),
      truncated: rows.length > LIST_LIMIT }
  }
  return {
    async list(scope: PurchaseScope) {
      await event(scope)
      return summaries(scope)
    },
    async setHidden(scope: PurchaseScope, id: string, hidden: boolean): Promise<PurchaseCandidate> {
      await event(scope)
      // 이미 그 상태면 그대로 둔다. 처음 숨긴 사람·시각을 덮어쓰지 않는다.
      await db.update(candidates).set(hidden ? { hiddenBy: scope.userId, hiddenAt: sql`now()` } : { hiddenBy: null, hiddenAt: null })
        .where(and(eq(candidates.id, id), eq(candidates.organizationId, scope.organizationId), eq(candidates.eventId, scope.eventId),
          hidden ? isNull(candidates.hiddenAt) : isNotNull(candidates.hiddenAt)))
      const [found] = (await summaries(scope, id)).candidates
      if (!found) throw new PurchaseError('NOT_FOUND', 404)
      return found
    },
  }
}
```

`apps/api/src/purchases/purchases.ts`:
- import에 `PurchaseCandidateHiddenSchema, type PurchaseCandidateResponse, type PurchaseCandidatesResponse`와 `import { createCandidateService } from './candidates.js'`를 더한다.
- `const review = createReviewService(db)` 위에 더한다:

```ts
  const candidates = createCandidateService(db)
  const candidateBase = '/organizations/:organizationId/events/:eventId/purchase-candidates'
  routes.get(candidateBase, auth, member, async c => c.json(await candidates.list(scope(c)) satisfies PurchaseCandidatesResponse))
  routes.post(`${candidateBase}/:candidateId/hidden`, json(PurchaseCandidateHiddenSchema), auth, member, async c =>
    c.json({ candidate: await candidates.setHidden(scope(c), idOf(c.req.param('candidateId')), c.req.valid('json').hidden) } satisfies PurchaseCandidateResponse))
```

- `createPurchaseRoutes`의 `db` 타입 `PurchaseDatabase`가 `update`·`selectDistinct`를 포함하는지 확인한다. `service.ts`의 `export type PurchaseDatabase = Pick<Db, 'select' | 'transaction'>`를 `Pick<Db, 'select' | 'selectDistinct' | 'insert' | 'update' | 'transaction'>`로 넓힌다(Task 6의 상품 저장도 쓴다).

- [ ] **Step 5: 통과 확인**

Run: `cd apps/api && npx tsx --test src/purchases/candidates.test.ts src/http/boundary.test.ts`
Expected: PASS. 경계 테스트가 `POST …/purchase-candidates/:candidateId/hidden`을 새로 검사한다.

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/purchases apps/api/package.json
git commit -m "행사 후보 목록과 숨기기 API 추가"
```

---

### Task 6: 후보로 담기

**Files:**
- Modify: `apps/api/src/purchases/service.ts`, `apps/api/src/purchases/purchases.ts`, `apps/api/src/purchases/test-setup.ts`, `apps/api/src/purchases/purchases.test.ts`

**Interfaces:**
- Consumes: `createProductCatalog`, `ProductCatalog`(Task 3), `lookupFor`, `ProductFetcher`, `FetchResult`(Task 3), `share`·`candidateOf`·`ready`(Task 5), `DraftInput.products`(Task 3)
- Produces:
  - `createPurchaseRoutes(db, session, generate, fetchProduct?: ProductFetcher)`
  - `createPurchaseService(db, generate, catalog: ProductCatalog)`
  - `OTHER_REQUEST_WARNING`(service.ts export)
  - `setupPurchases()`의 `state.fetch: ProductFetcher`, `state.lookups: number`. `drafts(links, event)`는 링크를 대화에 올린 뒤 후보 ID로 담는다.

- [ ] **Step 1: 테스트 도우미를 후보 방식으로 바꾸기**

`apps/api/src/purchases/test-setup.ts`:
- import에 `import type { FetchResult, ProductFetcher } from './products.js'`를 더한다.
- `generated` 아래에 더한다:

```ts
// 쿠팡 조회 가짜. link(n)과 같은 옵션 하나를 돌려준다.
export const lookedUp = (productId: string, price = 11590): FetchResult => {
  const n = Number(productId) - 1000
  return { ok: true, items: [{ itemId: String(2000 + n), vendorItemId: String(3000 + n), name: '테이블', price, listPrice: null,
    discountPercent: null, inStock: true, deliveryEta: null, imageUrl: null }] }
}
```

- `state`와 라우트 생성을 바꾼다:

```ts
  const state = { userId: 'p' as string | null, calls: 0, lookups: 0,
    generate: (async input => ({ items: input.links.map(url => generated(url)) })) as DraftGenerator,
    fetch: (async productId => lookedUp(productId)) as ProductFetcher }
  const routes = createPurchaseRoutes(db, async () => state.userId ? { user: { id: state.userId } } : null,
    async input => { state.calls++; return state.generate(input) },
    async (productId, timeoutMs) => { state.lookups++; return state.fetch(productId, timeoutMs) })
```

- `drafts`를 바꾼다(지금 사용자가 대화에 링크를 올리고 그 후보로 담는다):

```ts
  // 지금 사용자가 대화에 링크를 올리고, 그 후보로 담는다. 링크마다 작성 중 품목이 생긴다.
  async function drafts(links = [link(1)], event = 'e') {
    await share(links.join('\n'), event, state.userId ?? 'p')
    const candidateIds = await Promise.all(links.map(url => candidateOf(url, event)))
    return (await ok(request('POST', `/events/${event}/purchase-items/drafts`, { idempotencyKey: crypto.randomUUID(), candidateIds }), 201)).items
  }
```

(`share`·`candidateOf` 정의를 `drafts`보다 위로 옮긴다.)

- [ ] **Step 2: 실패하는 담기 테스트로 바꾸기**

`apps/api/src/purchases/purchases.test.ts`:
- import를 바꾼다:

```ts
import { DUPLICATE_WARNING, OTHER_REQUEST_WARNING } from './service.js'
import { generated, link, setupPurchases } from './test-setup.js'
```

- 첫 테스트를 바꾼다:

```ts
test('후보 담기: 후보마다 작성 중 품목을 만들고, 같은 키로 다시 보내면 새로 만들지 않는다', async () => {
  const { pg, request, ok, state, share, candidateOf } = await setupPurchases()
  try {
    await share(`${link(1)}\n${link(2)}`)
    const candidateIds = [await candidateOf(link(1)), await candidateOf(link(2))]
    const body = { idempotencyKey: 'key-1', candidateIds }
    const created = (await ok(request('POST', `${base}/drafts`, body), 201)).items
    assert.deepEqual(created.map(item => item.productUrl), [link(1), link(2)])
    assert.deepEqual(created.map(item => [item.status, item.version, item.mine, item.submissionId, item.requester]),
      [['draft', 1, true, null, { id: 'p', name: '기획' }], ['draft', 1, true, null, { id: 'p', name: '기획' }]])
    assert.deepEqual([created[0]!.note, created[0]!.estimatedUnitPrice, created[0]!.event], ['부스 설치', 11590, { id: 'e', name: '체육대회' }])
    const replay = (await ok(request('POST', `${base}/drafts`, body))).items
    assert.deepEqual(replay.map(item => item.id), created.map(item => item.id))
    assert.equal(state.calls, 1)
    const conflict = await request('POST', `${base}/drafts`, { ...body, candidateIds: [candidateIds[0]] })
    assert.equal(conflict.status, 409)
    assert.deepEqual(await conflict.json(), { error: 'IDEMPOTENCY_CONFLICT' })
    assert.equal(state.calls, 1)
    assert.deepEqual((await pg.query('SELECT message_id FROM purchase_item_sources WHERE item_id = $1', [created[0]!.id])).rows, [{ message_id: 'm' }])
    assert.deepEqual((await pg.query<{ candidate_id: string }>('SELECT candidate_id FROM purchase_items ORDER BY created_at DESC')).rows
      .map(row => row.candidate_id), candidateIds)
  } finally { await pg.close() }
})
```

- 두 번째 테스트를 바꾼다:

```ts
test('후보 담기: 없는 후보·다른 행사의 후보·권한·실패는 품목을 남기지 않는다', async () => {
  const { pg, request, state, as, share, candidateOf } = await setupPurchases()
  try {
    await share(link(1))
    await share(link(2), 'e2')
    const mine = await candidateOf(link(1))
    const elsewhere = await candidateOf(link(2), 'e2')
    const post = (candidateIds: string[], path = `${base}/drafts`) => request('POST', path, { idempotencyKey: crypto.randomUUID(), candidateIds })
    assert.equal((await post([elsewhere])).status, 404)
    assert.equal((await post(['missing'])).status, 404)
    assert.deepEqual(await (await post([mine, mine])).json(), { error: 'INVALID_INPUT' })
    assert.equal((await post([mine], '/events/missing/purchase-items/drafts')).status, 404)
    assert.equal((await post([mine], '/events/ex/purchase-items/drafts')).status, 404)
    as(null); assert.equal((await post([mine])).status, 401)
    as('x'); assert.equal((await post([mine])).status, 403)
    as('p')
    assert.equal(state.calls, 0)
    state.generate = async () => { throw new Error('secret-provider-error') }
    const failed = await post([mine])
    assert.equal(failed.status, 502)
    assert.ok(!(await failed.text()).includes('secret'))
    // 다른 행사방의 메시지를 근거로 대면 저장하지 않는다.
    state.generate = async input => ({ items: input.links.map(url => generated(url, { sourceMessageIds: ['m2'] })) })
    assert.equal((await post([mine])).status, 502)
    assert.equal((await pg.query('SELECT id FROM purchase_items')).rows.length, 0)
    assert.equal((await pg.query('SELECT id FROM purchase_generations')).rows.length, 0)
  } finally { await pg.close() }
})
```

- 세 번째 테스트(동시 생성)의 두 요청을 후보로 바꾼다:

```ts
test('후보 담기: 같은 사람의 동시 생성은 한 건만 받는다', async () => {
  const { pg, request, state, share, candidateOf } = await setupPurchases()
  try {
    await share(`${link(1)} ${link(2)}`)
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    let started!: () => void
    const running = new Promise<void>(resolve => { started = resolve })
    state.generate = async input => { started(); await blocked; return { items: input.links.map(url => generated(url)) } }
    const first = request('POST', `${base}/drafts`, { idempotencyKey: 'one', candidateIds: [await candidateOf(link(1))] })
    await running
    const second = await request('POST', `${base}/drafts`, { idempotencyKey: 'two', candidateIds: [await candidateOf(link(2))] })
    assert.equal(second.status, 409)
    assert.deepEqual(await second.json(), { error: 'GENERATION_IN_PROGRESS' })
    release()
    assert.equal((await first).status, 201)
  } finally { await pg.close() }
})
```

- `같은 행사에서 이미 담은 상품을 또 담으면…` 테스트 뒤에 더한다:

```ts
test('후보 담기: 저장된 조회 결과는 다시 조회하지 않고, 조회 전·실패한 상품만 그 자리에서 조회하며, 숨긴 후보도 담는다', async () => {
  const { pg, request, ok, state, share, ready, candidateOf } = await setupPurchases()
  try {
    // 실제 생성기처럼 받은 조회 결과를 품목에 쓴다.
    state.generate = async input => ({ items: input.links.map((url, index) => {
      const product = input.products[index]!
      return generated(url, { productName: product.name, estimatedUnitPrice: product.price, warnings: product.warning ? [product.warning] : [] })
    }) })
    await share(`${link(1)} ${link(2)}`)
    await ready('1001', [{ itemId: '2001', vendorItemId: '3001', name: '저장된 테이블', price: 9000, listPrice: null, discountPercent: null,
      inStock: true, deliveryEta: null, imageUrl: null }])
    const one = await candidateOf(link(1))
    const two = await candidateOf(link(2))
    await pg.query("UPDATE purchase_candidates SET hidden_by = 'q', hidden_at = now() WHERE id = $1", [two])
    state.fetch = async () => ({ ok: false, code: 'TIMEOUT', retryable: true })
    const created = (await ok(request('POST', `${base}/drafts`, { idempotencyKey: 'k', candidateIds: [one, two] }), 201)).items
    assert.equal(state.lookups, 1)
    assert.deepEqual(created.map(item => [item.productName, item.estimatedUnitPrice]), [['저장된 테이블', 9000], [null, null]])
    assert.ok(created[1]!.warnings.includes('상품 정보를 가져오지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.'))
  } finally { await pg.close() }
})

test('다른 구성원이 이미 제출한 후보를 담으면 경고하고 허용한다', async () => {
  const { pg, request, ok, drafts, as } = await setupPurchases()
  try {
    as('q')
    const [theirs] = await drafts([link(1)])
    await ok(request('POST', `${base}/submit`, { items: [{ id: theirs!.id, version: theirs!.version }] }))
    as('p')
    const [mine] = await drafts([link(1)])
    assert.ok(mine!.warnings.includes(OTHER_REQUEST_WARNING))
    assert.ok(!mine!.warnings.includes(DUPLICATE_WARNING))
  } finally { await pg.close() }
})
```

- `요청 취소와 다시 담기…` 테스트에서 다시 담은 품목(`copy`)을 확인하는 곳 뒤에 더한다(다시 담은 품목도 같은 후보를 가리킨다):

```ts
    const candidates = (await pg.query<{ candidate_id: string | null }>('SELECT candidate_id FROM purchase_items WHERE id IN ($1, $2)',
      [cancelled.id, copy.id])).rows
    assert.equal(new Set(candidates.map(row => row.candidate_id)).size, 1)
    assert.ok(candidates[0]!.candidate_id)
```

(변수 이름은 그 테스트의 원래 품목·복사본 이름에 맞춘다.)

- [ ] **Step 3: 실패 확인**

Run: `cd apps/api && npx tsx --test src/purchases/purchases.test.ts`
Expected: FAIL — 담기 본문의 `candidateIds`를 모르고(400) `OTHER_REQUEST_WARNING`이 없다

- [ ] **Step 4: 담기 구현**

`apps/api/src/purchases/service.ts`:
- import에 더한다:

```ts
import { purchaseCandidates as candidates, purchaseCandidateShares as candidateShares } from '../db/schema.js'
import type { ProductCatalog } from './catalog.js'
import { lookupFor } from './products.js'
```

(기존 schema import 줄에 합쳐도 된다. `productUrl` import를 지운다. `grep -rn "productUrl(" apps/api/src`로 `validation.ts`의 `productUrl` 함수가 더 쓰이지 않으면 함수도 지운다. 그 함수만 던지던 `INVALID_PRODUCT_LINK`·`DUPLICATE_LINK`가 서버에서 사라진다.)

- `DUPLICATE_WARNING` 아래에 더한다:

```ts
export const OTHER_REQUEST_WARNING = '다른 구성원이 이미 요청한 상품이에요. 같은 물건을 두 번 사지 않는지 확인해 주세요.'
```

- `previous` 함수 아래에 더한다:

```ts
// 고른 후보를 요청 순서대로 가져온다. 하나라도 이 행사의 후보가 아니면 404다. 숨긴 후보도 담을 수 있다.
async function candidatesOf(db: Reader, scope: PurchaseScope, ids: string[]) {
  const rows = await db.select().from(candidates).where(and(eq(candidates.organizationId, scope.organizationId),
    eq(candidates.eventId, scope.eventId), inArray(candidates.id, ids)))
  if (rows.length !== ids.length) throw new PurchaseError('NOT_FOUND', 404)
  return ids.map(id => rows.find(row => row.id === id)!)
}

// 끼룩이에게 줄 대화. 후보를 공유한 메시지를 먼저 넣고, 최근 대화로 2만 자까지 채운다. 메시지 중간을 자르지 않는다.
async function contextOf(db: Reader, roomId: string, candidateIds: string[]) {
  const columns = { id: messages.id, content: messages.content, createdAt: messages.createdAt }
  const shared = await db.select(columns).from(candidateShares).innerJoin(messages, eq(messages.id, candidateShares.messageId))
    .where(and(inArray(candidateShares.candidateId, candidateIds), eq(messages.chatRoomId, roomId)))
    .orderBy(desc(candidateShares.createdAt)).limit(30)
  const recent = await db.select(columns).from(messages).where(eq(messages.chatRoomId, roomId))
    .orderBy(desc(messages.createdAt), desc(messages.id)).limit(100)
  const chosen = new Map<string, (typeof recent)[number]>()
  let characters = 0
  for (const message of [...shared, ...recent]) {
    if (chosen.has(message.id)) continue
    if (characters + message.content.length > 20000) break
    chosen.set(message.id, message)
    characters += message.content.length
  }
  return [...chosen.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .map(message => ({ ...message, createdAt: message.createdAt.toISOString() }))
}
```

- `createPurchaseService(db: PurchaseDatabase, generate: DraftGenerator)`를 `createPurchaseService(db: PurchaseDatabase, generate: DraftGenerator, catalog: ProductCatalog)`로 바꾼다.
- `createDrafts`의 앞부분(링크 정규화부터 `draftInput`까지)을 바꾼다:

```ts
    async createDrafts(scope: PurchaseScope, input: CreatePurchaseDraftsRequest): Promise<{ items: PurchaseItemSummary[]; created: boolean }> {
      const event = await eventOf(db, scope)
      await member(db, scope)
      const chosen = await candidatesOf(db, scope, input.candidateIds)
      const links = chosen.map(candidate => candidate.url)
      const existing = await previous(db, scope, input.idempotencyKey, links)
      if (existing) return { items: existing, created: false }
      if (generating.has(scope.userId)) throw new PurchaseError('GENERATION_IN_PROGRESS', 409)
      generating.add(scope.userId)
      try {
        // 저장된 조회 결과를 쓴다. 아직 조회 전이거나 실패한 상품만 지금 다시 조회한다.
        const known = await catalog.read(chosen.map(candidate => candidate.productId))
        const missing = chosen.filter(candidate => known.get(candidate.productId)?.status !== 'ready').map(candidate => candidate.productId)
        const products = missing.length ? new Map([...known, ...await catalog.refresh(missing)]) : known
        const draftInput: DraftInput = { eventName: event.name, links,
          products: chosen.map(candidate => lookupFor(products.get(candidate.productId), candidate)),
          messages: await contextOf(db, event.roomId, chosen.map(candidate => candidate.id)) }
```

(Task 3의 임시 `products` 줄과 최근 100개를 직접 고르던 `recent`·`bounded` 코드를 지운다. 그 아래 `let draft…` 이하는 그대로 둔다.)

- 트랜잭션 안의 `owned` 조회 아래에 더하고, `rows`를 만드는 곳을 바꾼다:

```ts
          // 같은 행사에서 다른 구성원이 이미 제출한 상품이면 경고하고 허용한다(2026-10-04 결정).
          const others = await tx.select({ productUrl: items.productUrl }).from(items).where(and(eq(items.organizationId, scope.organizationId),
            eq(items.eventId, scope.eventId), ne(items.requesterId, scope.userId), inArray(items.status, ['pending', 'approved']),
            inArray(items.productUrl, links)))
          const rows = draft.items.map((item, index) => ({
            id: randomUUID(), organizationId: scope.organizationId, eventId: scope.eventId, requesterId: scope.userId, generationId: generation.id,
            candidateId: chosen[index]!.id,
            productUrl: item.productUrl, productName: item.productName, selectedOption: item.selectedOption, optionRequired: item.optionRequired,
            quantity: item.quantity, packagingUnit: item.packagingUnit, estimatedUnitPrice: item.estimatedUnitPrice,
            productSnapshot: item.productSnapshot, productFetchedAt: item.productFetchedAt, note: item.note, neededBy: item.neededBy,
            warnings: [...item.warnings, ...(owned.some(row => row.productUrl === item.productUrl) ? [DUPLICATE_WARNING] : []),
              ...(others.some(row => row.productUrl === item.productUrl) ? [OTHER_REQUEST_WARNING] : [])],
            // 최신순 목록에서 링크 순서대로 보이도록 같은 생성의 품목 시각을 1ms씩 앞당긴다.
            createdAt: sql`now() - interval '${sql.raw(String(index))} milliseconds'`,
          }))
```

- `reAdd`의 복사 `insert` 값에 `candidateId: row!.candidateId,`를 더한다.

`apps/api/src/purchases/purchases.ts`:
- import에 `import { createProductCatalog } from './catalog.js'`와 `import type { ProductFetcher } from './products.js'`를 더한다.
- 함수 머리와 서비스 생성을 바꾼다:

```ts
export function createPurchaseRoutes(db: PurchaseDatabase, session: SessionReader, generate: DraftGenerator, fetchProduct?: ProductFetcher) {
  const routes = new Hono<MembershipEnv>()
  const service = createPurchaseService(db, generate, createProductCatalog(db, fetchProduct))
```

- [ ] **Step 5: 통과 확인**

Run: `cd apps/api && npx tsx --test src/purchases/purchases.test.ts src/purchases/candidates.test.ts src/purchases/review.test.ts src/http/boundary.test.ts && cd ../.. && npm run typecheck`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/purchases
git commit -m "후보를 골라 작성 중 품목으로 담기"
```

---

### Task 7: 제출 때 하루 지난 가격 다시 확인

**Files:**
- Modify: `apps/api/src/purchases/service.ts`, `apps/api/src/purchases/purchases.test.ts`

**Interfaces:**
- Consumes: `catalog.refresh(ids, timeoutMs)`, `lookupFor`, `readCoupangUrl`(contracts)
- Produces: 제출 응답의 품목에 새 가격, `submitted` 기록의 `changes`에 `{ estimatedUnitPrice: { from, to } }`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/purchases/purchases.test.ts`의 `제출: …` 테스트 뒤에 더한다:

```ts
test('제출: 하루 지난 조회 가격만 다시 조회해 새 가격으로 제출하고, 처리 기록에 이전·이후 가격을 남긴다', async () => {
  const { pg, request, ok, drafts, state } = await setupPurchases()
  try {
    const [stale, fresh, manual, noPrice, failing] = await drafts([link(1), link(2), link(3), link(4), link(5)])
    // 담을 때의 조회 시각은 가짜 생성기 기본값(2026-09-29)이다. fresh만 방금 조회한 것으로 바꾼다.
    await pg.query('UPDATE purchase_items SET product_fetched_at = now() WHERE id = $1', [fresh!.id])
    const edited = (await ok(request('PATCH', `${base}/${manual!.id}`, { version: manual!.version, estimatedUnitPrice: 5000 }))).items[0]!
    state.lookups = 0
    state.fetch = async productId => productId === '1005' ? { ok: false, code: 'TIMEOUT', retryable: true }
      : productId === '1004' ? { ok: true, items: [{ ...(lookedUp(productId) as { ok: true; items: CoupangItem[] }).items[0]!, price: null }] }
        : lookedUp(productId, 12000)
    const refs = [stale!, fresh!, edited, noPrice!, failing!].map(item => ({ id: item.id, version: item.version }))
    const submitted = (await ok(request('POST', `${base}/submit`, { items: refs }))).items
    const price = (id: string) => submitted.find(item => item.id === id)!.estimatedUnitPrice
    // 직접 고친 가격과 가격 없는 조회 결과, 실패한 조회는 원래 가격을 지킨다(Review Focus 4).
    assert.deepEqual([price(stale!.id), price(fresh!.id), price(manual!.id), price(noPrice!.id), price(failing!.id)], [12000, 11590, 5000, 11590, 11590])
    assert.equal(state.lookups, 3)
    const events = (await pg.query<{ item_id: string; changes: unknown }>("SELECT item_id, changes FROM purchase_item_events WHERE action = 'submitted'")).rows
    assert.deepEqual(events.find(row => row.item_id === stale!.id)!.changes, { estimatedUnitPrice: { from: 11590, to: 12000 } })
    assert.deepEqual(events.find(row => row.item_id === fresh!.id)!.changes, {})
  } finally { await pg.close() }
})
```

import에 `lookedUp`(test-setup)과 `import type { CoupangItem } from '../db/schema.js'`를 더한다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && npx tsx --test src/purchases/purchases.test.ts`
Expected: FAIL — `stale`의 가격이 11590 그대로이고 `state.lookups`가 0

- [ ] **Step 3: 구현**

`apps/api/src/purchases/service.ts`:
- import에 `readCoupangUrl`(from `@vada/contracts`)과 `type ProductLookup`(from `./products.js`)을 더한다.
- 상수와 도우미를 더한다:

```ts
// 제출할 때 다시 조회하는 기준(2026-10-09 결정). 학생회 구매는 제출 후 며칠 안에 결제한다.
const PRICE_TTL_MS = 24 * 60 * 60 * 1000
const PRICE_TIMEOUT_MS = 8000
// 요청자가 고치지 않은 가격인지. 조회한 적이 없으면 가격이 비어 있을 때만 조회해서 채운다.
function lookedUpPrice(row: typeof items.$inferSelect) {
  const snapshot = row.productSnapshot
  if (!snapshot) return row.estimatedUnitPrice === null
  return (typeof snapshot.price === 'number' ? snapshot.price : null) === row.estimatedUnitPrice
}
```

- `submit`을 바꾼다:

```ts
    async submit(scope: PurchaseScope, input: SubmitPurchaseItemsRequest) {
      // 트랜잭션 밖에서 하루 지난 조회 가격을 다시 조회한다. 그사이 품목이 바뀌면 아래 잠금의 버전 검사에서 409가 된다.
      const drafts = await db.select().from(items).where(and(eq(items.organizationId, scope.organizationId), eq(items.eventId, scope.eventId),
        inArray(items.id, input.items.map(ref => ref.id)), mine(scope), eq(items.status, 'draft')))
      const now = Date.now()
      const stale = drafts.flatMap(row => {
        const link = readCoupangUrl(row.productUrl)
        const fresh = row.productFetchedAt !== null && now - row.productFetchedAt.getTime() < PRICE_TTL_MS
        return link && !fresh && lookedUpPrice(row) ? [{ row, link }] : []
      })
      const prices = new Map<string, ProductLookup>()
      if (stale.length) {
        const products = await catalog.refresh(stale.map(entry => entry.link.productId), PRICE_TIMEOUT_MS)
        for (const { row, link } of stale) {
          const lookup = lookupFor(products.get(link.productId), link)
          // 품목보다 새로 받은 가격이 있을 때만 바꾼다. 조회에 실패했거나 가격이 없으면 원래 가격으로 제출한다.
          if (lookup.snapshot && lookup.price !== null && lookup.fetchedAt
            && (row.productFetchedAt === null || lookup.fetchedAt > row.productFetchedAt)) prices.set(row.id, lookup)
        }
      }
      return db.transaction(async tx => {
        const membership = await member(tx, scope, true)
        await eventOf(tx, scope)
        const rows = await lockItems(tx, scope, input.items, mine(scope))
        if (rows.some(row => row.status !== 'draft')) throw new PurchaseError('INVALID_STATE', 409)
        if (!rows.every(complete)) throw new PurchaseError('SUBMISSION_INCOMPLETE')
        const submissionId = randomUUID()
        await tx.insert(submissions).values({ id: submissionId, organizationId: scope.organizationId, eventId: scope.eventId,
          requesterId: scope.userId, departmentId: membership.departmentId })
        const changes = new Map<string, Record<string, unknown>>()
        for (const row of rows) {
          const lookup = prices.get(row.id)
          if (!lookup) continue
          await tx.update(items).set({ estimatedUnitPrice: lookup.price, productSnapshot: lookup.snapshot, productFetchedAt: lookup.fetchedAt })
            .where(eq(items.id, row.id))
          if (lookup.price !== row.estimatedUnitPrice) changes.set(row.id, { estimatedUnitPrice: { from: row.estimatedUnitPrice, to: lookup.price } })
        }
        const ids = rows.map(row => row.id)
        await tx.update(items).set({ status: 'pending', submissionId, ...bump }).where(inArray(items.id, ids))
        await record(tx, scope, ids.map(itemId => ({ itemId, changes: changes.get(itemId) })), 'submitted', submissionId)
        return byIds(tx, scope, ids)
      })
    },
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/api && npx tsx --test src/purchases/purchases.test.ts src/purchases/review.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/purchases
git commit -m "제출할 때 하루 지난 조회 가격을 다시 확인"
```

---

### Task 8: 서버에 조회 실행기 연결

**Files:**
- Modify: `apps/api/src/serve.ts`

**Interfaces:**
- Consumes: `createReefFetcher`, `createProductCatalog`, `createLookupRunner`, `createChatRoutes(db, session, onLinks)`, `createPurchaseRoutes(db, session, generate, fetchProduct)`

- [ ] **Step 1: 연결**

`apps/api/src/serve.ts`:
- import에 더한다:

```ts
import { createProductCatalog } from './purchases/catalog.js'
import { createLookupRunner } from './purchases/lookup-runner.js'
import { createReefFetcher } from './purchases/products.js'
```

- `const chat = …`부터 `const purchases = …`까지를 바꾼다:

```ts
  // 키는 서버 런타임에서만 사용한다. 브라우저 응답·로그에 포함하지 않는다.
  const fetchProduct = env.REEF_API_KEY?.trim() ? createReefFetcher(env.REEF_API_KEY) : undefined
  // 대화의 쿠팡 링크는 이 서버 안에서 뒤에서 조회한다. 키가 없으면 켜지 않는다.
  const lookups = fetchProduct ? createLookupRunner(createProductCatalog(db, fetchProduct)) : undefined
  const chat = createChatRoutes(db, (headers) => auth.api.getSession({ headers }), lookups ? () => { void lookups.kick() } : undefined)
  const generate = createDraftGenerator({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL })
  const purchases = createPurchaseRoutes(db, (headers) => auth.api.getSession({ headers }), generate, fetchProduct)
```

- 서버를 띄운 뒤 실행기를 켜고, 끌 때 멈춘다:

```ts
  const stopLookups = lookups?.start()
  const shutdown = () => {
    stopLookups?.()
    server.close(() => { void client.end({ timeout: 5 }); void stopErrorReporting() })
  }
```

- [ ] **Step 2: 검사**

Run: `npm run typecheck && npm test --workspace @vada/api`
Expected: PASS. 서버 연결은 Task 12의 dev 확인에서 실제로 본다(링크를 올리면 몇 초 안에 후보에 상품 정보가 채워지는지).

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/serve.ts
git commit -m "서버에서 쿠팡 상품 조회 실행기 켜기"
```

---

### Task 9: 후보 화면 부품

**Files:**
- Modify: `apps/web/src/components/ui/sheet.tsx`, `apps/web/src/ui-gallery/Gallery.tsx`, `apps/web/src/ui-gallery/Gallery.test.tsx`
- Modify: `apps/web/src/purchases/purchase-view.ts`, `apps/web/src/purchases/purchase-view.test.ts`, `apps/web/src/purchases/purchase-fixtures.ts`, `apps/web/src/test-support/workflow-fixtures.ts`
- Create: `apps/web/src/purchases/useCandidates.ts`, `apps/web/src/purchases/CandidateCard.tsx`, `apps/web/src/purchases/PurchaseCandidates.tsx`, `apps/web/src/purchases/PurchaseCandidates.test.tsx`

**Interfaces:**
- Consumes: `PurchaseCandidate`, `PurchaseCandidatesResponse`, `PurchaseCandidateResponse`, `CreatePurchaseDraftsSchema`(Task 1), 라우트(Task 5)
- Produces:
  - `SheetContent`의 `side?: 'left' | 'right'`(기본 왼쪽), `closeLabel?: string`(기본 `메뉴 닫기`)
  - `purchase-view.ts`: `shortDay(iso)`, `candidateName(c)`, `candidatePrice(c)`, `shareText(share)`, `hiddenText(hidden)`, `requestText(request)`
  - `purchase-fixtures.ts`: `candidate(overrides)`; `workflow-fixtures.ts`: `candidatesPath(id = 'e')`
  - `useCandidates(organizationId, eventId, enabled, live)` → `{ candidates: PurchaseCandidate[] | null, truncated, loadError, busy, refresh(), setHidden(candidate, hidden): Promise<{ ok: true } | { ok: false; message: string }> }`, `type Candidates`
  - `CandidateCard({ candidate, selection?, onShowMessage, children? })`
  - `PurchaseCandidates({ candidates, generating, onAdd(ids): Promise<PurchaseResult>, onShowMessage(messageId) })`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/purchases/purchase-fixtures.ts`에 더한다(import에 `PurchaseCandidate` 타입 추가):

```ts
// 화면 테스트용 후보. 기본은 조회가 끝난, 옵션을 아는 후보다.
export function candidate(overrides: Partial<PurchaseCandidate> = {}): PurchaseCandidate {
  return {
    id: 'c1', url: 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3', productId: '1', itemId: '2', vendorItemId: '3',
    lookup: 'ready', fetchedAt: '2026-10-09T05:00:00.000Z', optionKnown: true,
    product: { name: '모닝글로리 유성매직 12색', price: 9800, listPrice: null, discountPercent: null, inStock: true,
      deliveryEta: '내일(금) 도착 예정', imageUrl: 'https://thumbnail.coupangcdn.com/a.jpg' },
    warning: null, shareCount: 1, shares: [{ messageId: 'm1', author: { id: 'u', name: '기획 테스터' }, sharedAt: '2026-10-09T05:12:00.000Z' }],
    hidden: null, requests: [], draftedByMe: false, ...overrides,
  }
}
```

`apps/web/src/test-support/workflow-fixtures.ts`에 더한다:

```ts
export const candidatesPath = (id = 'e') => `${eventsPath}/${id}/purchase-candidates`
```

`apps/web/src/purchases/purchase-view.test.ts`에 더한다(import에 새 함수와 `candidate` 추가):

```ts
test('후보 문구: 조회 날짜·공유·숨김 시각은 한국 시간으로 쓴다', () => {
  expect(shortDay('2026-10-08T15:30:00.000Z')).toBe('10/9')
  expect(shareText({ messageId: 'm', author: { id: 'u', name: '기획' }, sharedAt: '2026-10-09T05:12:00.000Z' })).toBe('기획 · 10월 9일 오후 2:12에 공유')
  expect(hiddenText({ by: { id: 'u', name: '기획' }, at: '2026-10-09T05:12:00.000Z' })).toBe('기획 · 10월 9일에 숨김')
  expect(requestText({ requester: { id: 'q', name: '박해랑' }, quantity: 2, status: 'pending' })).toBe('요청됨 · 박해랑 · 2개')
  expect(requestText({ requester: { id: 'q', name: '박해랑' }, quantity: null, status: 'approved' })).toBe('요청됨 · 박해랑')
  expect(candidatePrice(candidate())).toBe('예상 9,800원 · 10/9 기준')
  expect(candidatePrice(candidate({ product: { ...candidate().product!, price: null } }))).toBe('금액 확인 필요 · 10/9 기준')
  expect(candidateName(candidate({ product: null, lookup: 'pending' }))).toBe('상품 정보를 불러오는 중…')
  expect(candidateName(candidate({ product: null, lookup: 'failed' }))).toBe('상품 정보를 가져오지 못했어요. 쿠팡에서 확인해 주세요.')
})
```

`apps/web/src/purchases/PurchaseCandidates.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PurchaseCandidate } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import PurchaseCandidates from './PurchaseCandidates'
import { candidate } from './purchase-fixtures'
import { useCandidates } from './useCandidates'
import type { PurchaseResult } from './useEventPurchases'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const base = '/api/organizations/o/events/e/purchase-candidates'
type HarnessProps = { onAdd?: (ids: string[]) => Promise<PurchaseResult>; onShowMessage?: (messageId: string) => void }
function Harness({ onAdd = async () => ({ ok: true, items: [] }), onShowMessage = () => {} }: HarnessProps) {
  const state = useCandidates('o', 'e', true, false)
  return <PurchaseCandidates candidates={state} generating={false} onAdd={onAdd} onShowMessage={onShowMessage} />
}
function setup(candidates: PurchaseCandidate[], props: HarnessProps = {}) {
  const api = mockApi()
  api.on('GET', base, () => json({ candidates, truncated: false }))
  render(<Harness {...props} />)
  return api
}
const share = (messageId: string, name = '기획 테스터') => ({ messageId, author: { id: 'u', name }, sharedAt: '2026-10-09T05:12:00.000Z' })

test('후보는 가격·칩·공유한 사람을 보여 주고, 고른 후보만 담는다', async () => {
  const onAdd = vi.fn(async () => ({ ok: true as const, items: [] }))
  setup([
    candidate({ id: 'c1', shareCount: 3, shares: [share('m1'), share('m2', '박해랑')], draftedByMe: true,
      requests: [{ requester: { id: 'q', name: '박해랑' }, quantity: 2, status: 'pending' }] }),
    candidate({ id: 'c2', lookup: 'pending', product: null, optionKnown: false, fetchedAt: null }),
    candidate({ id: 'c3', optionKnown: false, product: { ...candidate().product!, name: '옵션 모르는 상품', price: null, inStock: false } }),
  ], { onAdd })
  expect(await screen.findByText('모닝글로리 유성매직 12색')).toBeTruthy()
  expect(screen.getByText('조회 가격은 참고값이에요. 옵션·포장 단위와 배송비·최종 결제 금액을 확인해 주세요.')).toBeTruthy()
  expect(screen.getByText('예상 9,800원 · 10/9 기준')).toBeTruthy()
  expect(screen.getByText('요청됨 · 박해랑 · 2개')).toBeTruthy()
  expect(screen.getByText('내가 담음')).toBeTruthy()
  expect(screen.getByRole('button', { name: '기획 테스터 · 10월 9일 오후 2:12에 공유 · 외 2번' })).toBeTruthy()
  expect(screen.getByText('상품 정보를 불러오는 중…')).toBeTruthy()
  expect(screen.getByText('옵션 미정')).toBeTruthy()
  expect(screen.getByText('품절')).toBeTruthy()
  expect(screen.getByText('금액 확인 필요 · 10/9 기준')).toBeTruthy()
  expect(screen.getByRole('button', { name: '선택한 0개 담기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: '모닝글로리 유성매직 12색 고르기' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '상품 정보를 불러오는 중… 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 2개 담기' }))
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith(['c1', 'c2']))
})

test('숨기면 되돌리기를 보여 주고, 숨긴 후보 목록에서 누가 숨겼는지 보이며 다시 보일 수 있다', async () => {
  const visible = candidate({ id: 'c1' })
  const hidden = { ...visible, hidden: { by: { id: 'u', name: '기획 테스터' }, at: '2026-10-09T05:12:00.000Z' } }
  const api = setup([visible])
  api.on('POST', `${base}/c1/hidden`, call => json({ candidate: (call.body as { hidden: boolean }).hidden ? hidden : visible }))
  fireEvent.click(await screen.findByRole('button', { name: '숨기기' }))
  expect(await screen.findByText('후보를 숨겼어요.')).toBeTruthy()
  expect(screen.queryByRole('checkbox', { name: '모닝글로리 유성매직 12색 고르기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '숨긴 후보 1' }))
  expect(screen.getByText('기획 테스터 · 10월 9일에 숨김')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 보이기' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
  expect(await screen.findByRole('checkbox', { name: '모닝글로리 유성매직 12색 고르기' })).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ hidden: true }, { hidden: false }])
})

test('공유 표시를 누르면 그 메시지로 가고, 여러 번 공유됐으면 펼쳐 고른다', async () => {
  const onShowMessage = vi.fn()
  setup([candidate({ id: 'c1', shareCount: 2, shares: [share('m2', '박해랑'), share('m1')] })], { onShowMessage })
  fireEvent.click(await screen.findByRole('button', { name: '박해랑 · 10월 9일 오후 2:12에 공유 · 외 1번' }))
  expect(onShowMessage).toHaveBeenLastCalledWith('m2')
  fireEvent.click(screen.getByText('공유 2번'))
  fireEvent.click(screen.getByRole('button', { name: '기획 테스터 · 10월 9일 오후 2:12에 공유' }))
  expect(onShowMessage).toHaveBeenLastCalledWith('m1')
})

test('후보가 없으면 대화에 링크를 올리라고 안내한다', async () => {
  setup([])
  expect(await screen.findByText('아직 올라온 쿠팡 링크가 없어요')).toBeTruthy()
  expect(screen.getByText('대화에 쿠팡 상품 링크를 올리면 여기에 모여요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /담기$/ })).toBeNull()
})

test('후보를 불러오지 못하면 알리고 다시 시도한다', async () => {
  const api = mockApi()
  api.on('GET', base, () => json({ error: 'X' }, 500))
  render(<Harness />)
  expect(await screen.findByText('후보를 불러오지 못했어요.')).toBeTruthy()
  api.on('GET', base, () => json({ candidates: [candidate()], truncated: false }))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('모닝글로리 유성매직 12색')).toBeTruthy()
})

test('긴 상품명·주소·이름은 카드 안에서 줄을 바꾼다', async () => {
  const long = '가'.repeat(120)
  setup([candidate({ id: 'c1', product: { ...candidate().product!, name: long }, shares: [share('m1', '이'.repeat(60))] }),
    candidate({ id: 'c2', lookup: 'failed', product: null,
      url: `https://www.coupang.com/vp/products/1?itemId=${'2'.repeat(20)}&vendorItemId=${'3'.repeat(20)}` })])
  expect((await screen.findByText(long)).className).toContain('wrap-anywhere')
  expect(screen.getByText(/^https:\/\/www\.coupang\.com/).className).toContain('wrap-anywhere')
  expect(screen.getByRole('button', { name: /^이+ · / }).className).toContain('wrap-anywhere')
})
```

`apps/web/src/ui-gallery/Gallery.test.tsx`에 더한다(필요한 testing-library 함수를 import에 맞춘다):

```tsx
test('오른쪽 패널 예시는 열고 패널 닫기로 닫을 수 있다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '오른쪽 패널 열기' }))
  const panel = await screen.findByRole('dialog', { name: '예시 패널' })
  expect(panel.className).toContain('right-0')
  fireEvent.click(within(panel).getByRole('button', { name: '패널 닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/purchases/PurchaseCandidates.test.tsx src/purchases/purchase-view.test.ts src/ui-gallery/Gallery.test.tsx`
Expected: FAIL — `./PurchaseCandidates`, `./useCandidates`, 새 문구 함수, `오른쪽 패널 열기`가 없다

- [ ] **Step 3: Sheet 오른쪽 변형과 부품 확인 화면**

`apps/web/src/components/ui/sheet.tsx`의 `SheetContent`를 바꾼다:

```tsx
// 768px 미만의 사이드바(왼쪽)와 대화 링크의 상품 패널(오른쪽)이 쓴다. 제목은 화면에 보이지 않게 두고 설명은 생략한다.
// 폭은 shadcn 모바일 사이드바 기본값 18rem(288px)이다. Material Design처럼 뒤 화면이 보이도록 좁은 화면에서는 5/6까지만 쓴다.
export function SheetContent({ className, children, title, side = 'left', closeLabel = '메뉴 닫기', onOpenAutoFocus, onCloseAutoFocus, ...props }:
  ComponentProps<typeof DialogPrimitive.Content> & { title: string; side?: 'left' | 'right'; closeLabel?: string }) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content aria-describedby={undefined} className={cn(
      'fixed inset-y-0 z-50 flex w-72 max-w-5/6 flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-in',
      side === 'left' ? 'left-0 data-[state=open]:slide-in-from-left' : 'right-0 data-[state=open]:slide-in-from-right', className)} {...props} {...returnFocus}>
      <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
      {children}
      <DialogPrimitive.Close aria-label={closeLabel} className="absolute top-5 right-3 cursor-pointer rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}
```

`apps/web/src/ui-gallery/Gallery.tsx`: `const [sheetOpen, setSheetOpen] = useState(false)` 아래에 `const [panelOpen, setPanelOpen] = useState(false)`를 두고, `옆 메뉴 열기` 예시 바로 뒤에 더한다:

```tsx
      <Button variant="outline" onClick={() => setPanelOpen(true)}>오른쪽 패널 열기</Button>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" title="예시 패널" closeLabel="패널 닫기" className="w-96">
          <div className="p-6 pt-14 text-sm text-gray-700">대화 링크의 상품 정보 패널</div>
        </SheetContent>
      </Sheet>
```

- [ ] **Step 4: 문구 도우미**

`apps/web/src/purchases/purchase-view.ts`:
- import에 `PurchaseCandidate, PurchaseCandidateRequest, PurchaseCandidateShare` 타입을 더한다.
- `won` 아래(`priceNotice` 아래)에 더한다:

```ts
const seoul = { timeZone: 'Asia/Seoul' } as const
// 10/9처럼 월/일. 조회 날짜에 쓴다.
export function shortDay(value: string) {
  const parts = new Intl.DateTimeFormat('ko-KR', { ...seoul, month: 'numeric', day: 'numeric' }).formatToParts(new Date(value))
  return `${parts.find(part => part.type === 'month')!.value}/${parts.find(part => part.type === 'day')!.value}`
}
export const candidateName = (candidate: PurchaseCandidate) => candidate.product?.name
  ?? (candidate.lookup === 'failed' ? '상품 정보를 가져오지 못했어요. 쿠팡에서 확인해 주세요.' : '상품 정보를 불러오는 중…')
export function candidatePrice(candidate: PurchaseCandidate) {
  const price = candidate.product?.price ?? null
  return `${price === null ? '금액 확인 필요' : `예상 ${won(price)}`}${candidate.fetchedAt ? ` · ${shortDay(candidate.fetchedAt)} 기준` : ''}`
}
export const shareText = (share: PurchaseCandidateShare) => `${share.author.name} · ${new Date(share.sharedAt)
  .toLocaleString('ko-KR', { ...seoul, month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}에 공유`
export const hiddenText = (hidden: NonNullable<PurchaseCandidate['hidden']>) =>
  `${hidden.by.name} · ${new Date(hidden.at).toLocaleDateString('ko-KR', { ...seoul, month: 'long', day: 'numeric' })}에 숨김`
export const requestText = (request: PurchaseCandidateRequest) =>
  `요청됨 · ${request.requester.name}${request.quantity === null ? '' : ` · ${request.quantity}개`}`
```

- [ ] **Step 5: 후보 데이터 훅**

`apps/web/src/purchases/useCandidates.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PurchaseCandidate, PurchaseCandidateResponse, PurchaseCandidatesResponse } from '@vada/contracts'
import { messageOf, purchaseFailure } from './purchase-view'

const POLL_MS = 5000
const isList = (body: unknown): body is PurchaseCandidatesResponse =>
  typeof body === 'object' && body !== null && Array.isArray((body as PurchaseCandidatesResponse).candidates)

// 행사의 후보. enabled면 불러오고, live면 5초마다 새로 불러온다(새 링크·숨김·요청됨·조회 완료).
export function useCandidates(organizationId: string, eventId: string, enabled: boolean, live: boolean) {
  const base = `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/purchase-candidates`
  const [candidates, setCandidates] = useState<PurchaseCandidate[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const active = useRef(true)
  // 불러오는 사이에 숨김을 바꿨으면 늦게 온 목록을 버리고 다시 불러온다.
  const changes = useRef(0)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const started = changes.current
    void (async () => {
      try {
        const response = await fetch(base, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isList(body)) throw new Error('Candidates lookup failed')
        if (controller.signal.aborted) return
        if (started !== changes.current) { setAttempt(value => value + 1); return }
        setCandidates(body.candidates)
        setTruncated(body.truncated === true)
        setLoadError(false)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  useEffect(() => {
    if (!enabled || !live) return
    const timer = setInterval(() => setAttempt(value => value + 1), POLL_MS)
    return () => clearInterval(timer)
  }, [enabled, live])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  async function setHidden(candidate: PurchaseCandidate, hidden: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
    setBusy(true)
    try {
      const response = await fetch(`${base}/${encodeURIComponent(candidate.id)}/hidden`, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden }) })
      const result = await response.json().catch(() => null) as (Partial<PurchaseCandidateResponse> & { error?: unknown }) | null
      if (!response.ok || !result?.candidate) return { ok: false, message: messageOf(result?.error) }
      const next = result.candidate
      changes.current++
      if (active.current) setCandidates(previous => previous?.map(item => item.id === next.id ? next : item) ?? previous)
      return { ok: true }
    } catch {
      return { ok: false, message: purchaseFailure }
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return { candidates, truncated, loadError, busy, refresh, setHidden }
}
export type Candidates = ReturnType<typeof useCandidates>
```

- [ ] **Step 6: 후보 카드와 후보 화면**

`apps/web/src/purchases/CandidateCard.tsx`:

```tsx
import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PurchaseCandidate } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { candidateName, candidatePrice, hiddenText, requestText, shareText } from './purchase-view'

type Props = {
  candidate: PurchaseCandidate
  selection?: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }
  // 공유 표시를 누르면 대화의 그 메시지로 간다.
  onShowMessage: (messageId: string) => void
  children?: ReactNode
}

// 후보 하나. 상품 정보는 뒤에서 조회한 값이다. 1차 품목 카드와 같은 모양을 쓴다.
export default function CandidateCard({ candidate, selection, onShowMessage, children }: Props) {
  const name = candidateName(candidate)
  const [first] = candidate.shares
  const ready = candidate.lookup === 'ready' && candidate.product !== null
  const linkClass = 'h-auto justify-start p-0 text-left text-xs whitespace-normal wrap-anywhere'
  return <li className={cn(cardClass, 'flex gap-3 p-4')}>
    {selection && <input type="checkbox" className="mt-1 size-4 shrink-0 accent-blue-600" aria-label={`${name} 고르기`}
      checked={selection.checked} disabled={selection.disabled} onChange={event => selection.onChange(event.target.checked)} />}
    {candidate.product?.imageUrl && <img src={candidate.product.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
      className="size-16 shrink-0 rounded-md border object-cover" />}
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900">{name}</p>
        <a href={candidate.url} target="_blank" rel="noopener noreferrer" aria-label="쿠팡에서 보기"
          className={buttonVariants({ variant: 'ghost', size: 'icon', className: '-my-1.5' })}><ExternalLink /></a>
      </div>
      {ready ? <p className="text-xs text-gray-700">{candidatePrice(candidate)}</p>
        : <p className="text-xs wrap-anywhere text-gray-500">{candidate.url}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {candidate.lookup === 'ready' && !candidate.optionKnown && <Badge tone="warning">옵션 미정</Badge>}
        {candidate.product?.inStock === false && <Badge tone="danger">품절</Badge>}
        {candidate.requests.map((request, index) => <Badge key={index} tone="info" className="whitespace-normal wrap-anywhere">{requestText(request)}</Badge>)}
        {candidate.draftedByMe && <Badge>내가 담음</Badge>}
      </div>
      {candidate.warning && <p className="text-xs wrap-anywhere text-yellow-700">{candidate.warning}</p>}
      {first && <Button variant="link" size="sm" className={cn(linkClass, 'self-start')} onClick={() => onShowMessage(first.messageId)}>
        {shareText(first)}{candidate.shareCount > 1 ? ` · 외 ${candidate.shareCount - 1}번` : ''}</Button>}
      {candidate.shares.length > 1 && <details className="text-xs text-gray-600">
        <summary className="cursor-pointer">공유 {candidate.shareCount}번</summary>
        <ul className="mt-1 flex flex-col gap-1">{candidate.shares.map((share, index) => <li key={index}>
          <Button variant="link" size="sm" className={linkClass} onClick={() => onShowMessage(share.messageId)}>{shareText(share)}</Button>
        </li>)}</ul>
      </details>}
      {candidate.hidden && <p className="text-xs wrap-anywhere text-gray-500">{hiddenText(candidate.hidden)}</p>}
      {children && <div className="flex flex-wrap justify-end gap-2">{children}</div>}
    </div>
  </li>
}
```

`apps/web/src/purchases/PurchaseCandidates.tsx`:

```tsx
import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { CreatePurchaseDraftsSchema, type PurchaseCandidate } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import CandidateCard from './CandidateCard'
import { priceNotice } from './purchase-view'
import type { Candidates } from './useCandidates'
import type { PurchaseResult } from './useEventPurchases'

type Props = {
  candidates: Candidates
  generating: boolean
  onAdd: (ids: string[]) => Promise<PurchaseResult>
  onShowMessage: (messageId: string) => void
}

// 행사 대화에 올라온 쿠팡 링크. 고르기는 사람마다 따로고, 숨김·요청됨은 모두에게 보인다(2026-10-04 결정).
export default function PurchaseCandidates({ candidates: state, generating, onAdd, onShowMessage }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [undo, setUndo] = useState<PurchaseCandidate | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  if (!state.candidates) return state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">후보를 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">후보 불러오는 중…</StateMessage>
  const all = state.candidates
  const visible = all.filter(candidate => !candidate.hidden)
  const hidden = all.filter(candidate => candidate.hidden)
  const chosen = selected.filter(id => visible.some(candidate => candidate.id === id))
  // 담기 버튼은 서버와 같은 스키마로 켠다. 개수 상한을 화면에 다시 적지 않는다.
  const valid = CreatePurchaseDraftsSchema.safeParse({ idempotencyKey: 'check', candidateIds: chosen }).success
  async function add() {
    setMessage('')
    const result = await onAdd(chosen)
    if (result.ok) setSelected([])
    else setMessage(result.message)
  }
  async function setHidden(candidate: PurchaseCandidate, hide: boolean) {
    setMessage('')
    const result = await state.setHidden(candidate, hide)
    if (!result.ok) { setMessage(result.message); return }
    setUndo(hide ? candidate : null)
    if (hide) setSelected(previous => previous.filter(id => id !== candidate.id))
  }
  return <div className="flex flex-col gap-3">
    <p className="text-xs text-gray-500">{priceNotice}</p>
    {state.truncated && <StateMessage kind="notice">최근 300개만 보여요.</StateMessage>}
    {undo && <div className="flex flex-wrap items-center gap-2">
      <StateMessage kind="notice">후보를 숨겼어요.</StateMessage>
      <Button variant="outline" size="sm" disabled={state.busy} onClick={() => void setHidden(undo, false)}>되돌리기</Button>
    </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {all.length === 0 && <Card><EmptyState icon={Link2} title="아직 올라온 쿠팡 링크가 없어요" description="대화에 쿠팡 상품 링크를 올리면 여기에 모여요." /></Card>}
    {visible.length > 0 && <>
      <ul className="flex flex-col gap-2" aria-label="후보 목록">{visible.map(candidate => <CandidateCard key={candidate.id} candidate={candidate}
        onShowMessage={onShowMessage} selection={{ checked: chosen.includes(candidate.id), disabled: generating,
          onChange: checked => setSelected(previous => checked ? [...previous, candidate.id] : previous.filter(id => id !== candidate.id)) }}>
        <Button variant="ghost" size="sm" disabled={state.busy || generating} onClick={() => void setHidden(candidate, true)}>숨기기</Button>
      </CandidateCard>)}</ul>
      <div className="flex flex-col gap-2">
        <Button className="self-start" disabled={generating || !valid} onClick={() => void add()}>선택한 {chosen.length}개 담기</Button>
        {generating && <StateMessage kind="loading">담는 중… 최대 약 75초 걸릴 수 있어요. 끝날 때까지 기다려 주세요.</StateMessage>}
      </div>
    </>}
    {hidden.length > 0 && <section aria-label="숨긴 후보" className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" className="self-start" aria-expanded={showHidden} onClick={() => setShowHidden(value => !value)}>숨긴 후보 {hidden.length}</Button>
      {showHidden && <ul className="flex flex-col gap-2">{hidden.map(candidate => <CandidateCard key={candidate.id} candidate={candidate} onShowMessage={onShowMessage}>
        <Button variant="outline" size="sm" disabled={state.busy} onClick={() => void setHidden(candidate, false)}>다시 보이기</Button>
      </CandidateCard>)}</ul>}
    </section>}
  </div>
}
```

- [ ] **Step 7: 통과 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/purchases/PurchaseCandidates.test.tsx src/purchases/purchase-view.test.ts src/ui-gallery/Gallery.test.tsx`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add apps/web/src
git commit -m "후보 목록 화면 부품과 Sheet 오른쪽 변형 추가"
```

---

### Task 10: 대화의 쿠팡 링크와 상품 패널

**Files:**
- Create: `apps/web/src/chat/MessageText.tsx`, `apps/web/src/purchases/ProductPanel.tsx`, `apps/web/src/purchases/ProductPanel.test.tsx`
- Modify: `apps/web/src/chat/Chat.tsx`, `apps/web/src/chat/useChat.ts`, `apps/web/src/chat/Chat.test.tsx`

**Interfaces:**
- Consumes: `parseCoupangLinks`, `CoupangLink`(Task 1), `Candidates`, 문구 도우미(Task 9), `SheetContent side="right"`(Task 9)
- Produces:
  - `Chat({ organizationId, eventId, eventName, onOpenLink?, focus? })` — `focus: { id: number; messageId: string } | null`
  - `useChat(...).reveal(messageId): Promise<boolean>`
  - `ProductPanel({ link: CoupangLink | null, candidates: Candidates, onClose })`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/chat/Chat.test.tsx` import에 `waitFor`를 더하고 끝에 더한다:

```tsx
test('쿠팡 상품 링크는 버튼으로 그리고, 누르면 그 링크를 넘기며, 다른 글은 그대로 둔다', async () => {
  const link = 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([msg('m1', `이거 어때? ${link} 다른 건 https://example.com`)])))
  const onOpenLink = vi.fn()
  render(<Chat {...props} onOpenLink={onOpenLink} />)
  const button = await screen.findByRole('button', { name: link })
  expect(button.className).toContain('wrap-anywhere')
  fireEvent.click(button)
  expect(onOpenLink).toHaveBeenCalledWith(expect.objectContaining({ productId: '1', vendorItemId: '3', url: link }))
  expect(screen.getByText(/다른 건 https:\/\/example\.com/)).toBeTruthy()
})

test('후보에서 고른 메시지가 이전 페이지에 있으면 더 불러와 강조하고, 없으면 알린다', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('before=new') ? ok([msg('target')], null) : ok([msg('new')], 'new')))
  const scrolled = vi.fn()
  Element.prototype.scrollIntoView = scrolled
  try {
    const view = render(<Chat {...props} focus={null} />)
    await screen.findByText('new')
    view.rerender(<Chat {...props} focus={{ id: 1, messageId: 'target' }} />)
    const target = await screen.findByText('target')
    await waitFor(() => expect(target.closest('li')!.className).toContain('bg-yellow-50'))
    expect(scrolled).toHaveBeenCalled()
    view.rerender(<Chat {...props} focus={{ id: 2, messageId: 'missing' }} />)
    expect(await screen.findByText('메시지를 찾지 못했어요.')).toBeTruthy()
  } finally {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  }
})
```

`apps/web/src/purchases/ProductPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readCoupangUrl, type PurchaseCandidate } from '@vada/contracts'
import ProductPanel from './ProductPanel'
import { candidate } from './purchase-fixtures'
import type { Candidates } from './useCandidates'

afterEach(cleanup)
const link = { ...readCoupangUrl('https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3')!, start: 0, end: 0 }
const state = (candidates: PurchaseCandidate[] | null): Candidates =>
  ({ candidates, truncated: false, loadError: false, busy: false, refresh: vi.fn(), setHidden: vi.fn() })

test('링크 패널은 후보의 상품 정보를 오른쪽에 보여 주고 닫을 수 있다', async () => {
  const onClose = vi.fn()
  render(<ProductPanel link={link} onClose={onClose}
    candidates={state([candidate({ product: { ...candidate().product!, listPrice: 12000, discountPercent: 18 } })])} />)
  const panel = await screen.findByRole('dialog', { name: '모닝글로리 유성매직 12색' })
  expect(panel.className).toContain('right-0')
  expect(within(panel).getByText('예상 9,800원 · 10/9 기준')).toBeTruthy()
  expect(within(panel).getByText('정가 12,000원 · 18% 할인')).toBeTruthy()
  expect(within(panel).getByText('도착 예정: 내일(금) 도착 예정')).toBeTruthy()
  expect(within(panel).getByRole('link', { name: '쿠팡에서 보기' }).getAttribute('href')).toBe(link.url)
  fireEvent.click(within(panel).getByRole('button', { name: '패널 닫기' }))
  expect(onClose).toHaveBeenCalled()
})

test('후보를 아직 못 찾았거나, 조회가 실패했거나, 옵션을 모르면 그렇게 알린다', async () => {
  const view = render(<ProductPanel link={link} candidates={state(null)} onClose={() => {}} />)
  expect(await screen.findByText('상품 정보를 불러오는 중…')).toBeTruthy()
  view.rerender(<ProductPanel link={link} candidates={state([candidate({ lookup: 'failed', product: null })])} onClose={() => {}} />)
  expect(await screen.findByText('상품 정보를 가져오지 못했어요. 쿠팡에서 확인해 주세요.')).toBeTruthy()
  view.rerender(<ProductPanel link={link} onClose={() => {}}
    candidates={state([candidate({ optionKnown: false, product: { ...candidate().product!, price: null } })])} />)
  expect(await screen.findByText('옵션 미정')).toBeTruthy()
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/chat/Chat.test.tsx src/purchases/ProductPanel.test.tsx`
Expected: FAIL — 링크 버튼이 없고(`Unable to find role="button"`), `./ProductPanel`이 없다

- [ ] **Step 3: 링크 버튼**

`apps/web/src/chat/MessageText.tsx`:

```tsx
import type { ReactNode } from 'react'
import { parseCoupangLinks, type CoupangLink } from '@vada/contracts'
import { Button } from '@/components/ui/button'

// 메시지 안의 쿠팡 상품 링크를 버튼으로 그린다. 나머지 글은 그대로 둔다(서버가 후보로 기록하는 것과 같은 규칙).
export default function MessageText({ content, onOpenLink }: { content: string; onOpenLink?: (link: CoupangLink) => void }) {
  const links = onOpenLink ? parseCoupangLinks(content) : []
  if (!links.length) return <>{content}</>
  const parts: ReactNode[] = []
  let cursor = 0
  for (const [index, link] of links.entries()) {
    if (link.start > cursor) parts.push(content.slice(cursor, link.start))
    parts.push(<Button key={index} variant="link" size="sm" className="inline h-auto p-0 text-left text-sm whitespace-normal wrap-anywhere"
      onClick={() => onOpenLink!(link)}>{content.slice(link.start, link.end)}</Button>)
    cursor = link.end
  }
  if (cursor < content.length) parts.push(content.slice(cursor))
  return <>{parts}</>
}
```

- [ ] **Step 4: 메시지 찾기**

`apps/web/src/chat/useChat.ts`:
- `const controller = useRef<AbortController | null>(null)` 아래에 더한다:

```ts
  // nextCursor의 최신 값. 이전 페이지를 이어 불러오는 비동기 반복에서 쓴다.
  const cursor = useRef<string | null>(null)
  function moveCursor(next: string | null) {
    cursor.current = next
    setNextCursor(next)
  }
```

- `latest`와 `older` 안의 `setNextCursor(...)` 호출을 모두 `moveCursor(...)`로 바꾼다.
- `send` 함수 아래에 더한다:

```ts
  // 후보에서 고른 메시지를 찾는다. 다른 불러오기가 끝나기를 기다린 뒤 이전 페이지를 10번까지 더 불러온다.
  async function reveal(messageId: string) {
    const signal = controller.current?.signal
    const has = () => rows.current.some(message => message.id === messageId)
    const idle = async () => { for (let wait = 0; lock.current && wait < 50; wait++) await new Promise(resolve => setTimeout(resolve, 100)) }
    await idle()
    for (let pages = 0; !has() && pages < 10 && cursor.current && signal && !signal.aborted && !blocked.current; pages++) {
      await idle()
      const before = cursor.current
      await run(signal, async () => {
        const result = await page(signal, before)
        if (signal.aborted) return
        const known = new Set(rows.current.map(message => message.id))
        update([...result.messages.filter(message => !known.has(message.id)), ...rows.current])
        moveCursor(result.nextCursor)
        setLoadError('')
      })
      if (cursor.current === before) break
    }
    return has()
  }
```

- 반환 객체에 `reveal`을 더한다.

- [ ] **Step 5: 대화 화면**

`apps/web/src/chat/Chat.tsx`:
- import를 바꾼다:

```tsx
import { useEffect, useId, useRef, useState } from 'react'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX, codePoints, type CoupangLink } from '@vada/contracts'
import { cn } from '@/lib/utils'
import MessageText from './MessageText'
```

- props 타입을 바꾼다:

```tsx
type Props = {
  organizationId: string
  eventId: string
  eventName: string
  // 메시지의 쿠팡 상품 링크를 누르면 부른다.
  onOpenLink?: (link: CoupangLink) => void
  // 후보에서 고른 메시지. id가 바뀔 때마다 그 메시지를 찾아 강조한다.
  focus?: { id: number; messageId: string } | null
}
```

- `ChatPanel({ organizationId, eventId, eventName, onOpenLink, focus }: Props)`로 받고, `const length = …` 아래에 더한다:

```tsx
  const list = useRef<HTMLOListElement>(null)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const { reveal } = chat
  useEffect(() => {
    if (!focus) return
    let cancelled = false
    setMissing(false)
    void reveal(focus.messageId).then(found => {
      if (cancelled) return
      if (found) setHighlighted(focus.messageId)
      else setMissing(true)
    })
    return () => { cancelled = true }
    // focus.id가 바뀔 때만 다시 찾는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id])
  useEffect(() => {
    if (!highlighted) return
    const element = [...(list.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [])].find(item => item.dataset.messageId === highlighted)
    element?.scrollIntoView?.({ block: 'center' })
    const timer = setTimeout(() => setHighlighted(null), 2000)
    return () => clearTimeout(timer)
  }, [highlighted])
```

- 목록을 바꾼다(`ref`, `data-message-id`, 강조, 링크 버튼):

```tsx
          chat.messages.length ? <ol ref={list} className="flex flex-col" aria-label="대화 내용">{chat.messages.map(message => <li key={message.id}
            data-message-id={message.id} className={cn('flex gap-2 border-b border-gray-100 py-3 last:border-b-0', highlighted === message.id && 'bg-yellow-50')}>
            <Avatar />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <strong className="min-w-0 text-sm font-semibold wrap-anywhere text-gray-900">{message.author.name}</strong>
                <time className="text-xs text-gray-400" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ko-KR')}</time>
              </div>
              <p className="mt-0.5 text-sm wrap-anywhere whitespace-pre-wrap text-gray-700"><MessageText content={message.content} onOpenLink={onOpenLink} /></p>
            </div>
          </li>)}</ol> : !chat.loadError && <StateMessage kind="empty">아직 대화가 없어요.</StateMessage>
```

- `{chat.loadError && …}` 위에 더한다:

```tsx
        {missing && <StateMessage kind="notice">메시지를 찾지 못했어요.</StateMessage>}
```

- [ ] **Step 6: 상품 패널**

`apps/web/src/purchases/ProductPanel.tsx`:

```tsx
import { ExternalLink } from 'lucide-react'
import type { CoupangLink } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { candidateName, candidatePrice, won } from './purchase-view'
import type { Candidates } from './useCandidates'

type Props = { link: CoupangLink | null; candidates: Candidates; onClose: () => void }

// 대화의 쿠팡 링크를 누르면 오른쪽에 상품 정보를 연다. 대화는 뒤에 그대로 남는다(2026-10-09 결정).
export default function ProductPanel({ link, candidates, onClose }: Props) {
  const found = link ? candidates.candidates?.find(candidate => candidate.productId === link.productId
    && candidate.vendorItemId === link.vendorItemId) : undefined
  const product = found?.product ?? null
  return <Sheet open={link !== null} onOpenChange={open => { if (!open) onClose() }}>
    {link && <SheetContent side="right" title={product?.name ?? '상품 정보'} closeLabel="패널 닫기" className="w-96">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6 pt-14">
        {product?.imageUrl && <img src={product.imageUrl} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-md border object-contain" />}
        <h2 className="text-base font-semibold wrap-anywhere text-gray-900">{found ? candidateName(found) : '상품 정보를 불러오는 중…'}</h2>
        {found && product && <div className="flex flex-col gap-1 text-sm text-gray-700">
          <p>{candidatePrice(found)}</p>
          {product.listPrice !== null && product.discountPercent !== null
            && <p className="text-xs text-gray-500">정가 {won(product.listPrice)} · {product.discountPercent}% 할인</p>}
          {product.deliveryEta && <p className="wrap-anywhere">도착 예정: {product.deliveryEta}</p>}
        </div>}
        {found && <div className="flex flex-wrap gap-1.5">
          {found.lookup === 'ready' && !found.optionKnown && <Badge tone="warning">옵션 미정</Badge>}
          {product?.inStock === false && <Badge tone="danger">품절</Badge>}
        </div>}
        {found?.warning && <p className="text-xs wrap-anywhere text-yellow-700">{found.warning}</p>}
        <a href={link.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
          쿠팡에서 보기<ExternalLink /></a>
      </div>
    </SheetContent>}
  </Sheet>
}
```

- [ ] **Step 7: 통과 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/chat src/purchases/ProductPanel.test.tsx`
Expected: PASS(기존 대화 테스트 포함)

- [ ] **Step 8: 커밋**

```bash
git add apps/web/src/chat apps/web/src/purchases/ProductPanel.tsx apps/web/src/purchases/ProductPanel.test.tsx
git commit -m "대화의 쿠팡 링크를 버튼으로 그리고 상품 패널로 열기"
```

---

### Task 11: 구매 탭 연결과 붙여 넣기 창 삭제

**Files:**
- Modify: `apps/web/src/purchases/EventPurchases.tsx`, `apps/web/src/purchases/EventPurchases.test.tsx`, `apps/web/src/purchases/useEventPurchases.ts`, `apps/web/src/purchases/purchase-view.ts`
- Modify: `apps/web/src/workspace/EventWorkspace.tsx`, `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/workspace/Workspace.test.tsx`, `apps/web/src/workspace/purchase-workflow.integration.test.tsx`, `apps/web/src/App.integration.test.tsx`
- Delete: `apps/web/src/purchases/LinkDialog.tsx`, `LinkDialog.test.tsx`, `LinkDialog.test-support.ts`

**Interfaces:**
- Consumes: Task 9·10의 부품과 훅
- Produces:
  - `type PurchaseView = 'candidates' | 'mine' | 'all'`
  - `EventPurchases({ state, candidates, view, onViewChange, onShowMessage })`
  - `useEventPurchases(...).create(candidateIds: string[])`

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`apps/web/src/purchases/EventPurchases.test.tsx`:
- import에 `import { useState } from 'react'`, `import { candidate } from './purchase-fixtures'`(기존 `item` import에 합침), `import { useCandidates } from './useCandidates'`, `import EventPurchases, { type PurchaseView } from './EventPurchases'`를 둔다.
- `Harness`와 `setup`을 바꾼다:

```tsx
const candidatesBase = '/api/organizations/o/events/e/purchase-candidates'
function Harness({ initialView = 'mine' }: { initialView?: PurchaseView }) {
  const state = useEventPurchases('o', 'e', true)
  const candidates = useCandidates('o', 'e', true, false)
  const [view, setView] = useState<PurchaseView>(initialView)
  return <EventPurchases state={state} candidates={candidates} view={view} onViewChange={setView} onShowMessage={() => {}} />
}
function setup(items: PurchaseItemSummary[], initialView: PurchaseView = 'mine', candidates = [candidate()]) {
  const api = mockApi()
  api.on('GET', base, () => json({ items, truncated: false }))
  api.on('GET', candidatesBase, () => json({ candidates, truncated: false }))
  render(<Harness initialView={initialView} />)
  return api
}
```

- 파일 끝에 더한다:

```tsx
test('후보 보기에서 골라 담으면 내 품목으로 가서 담았다고 알리고 후보를 새로 불러온다', async () => {
  const api = setup([], 'candidates')
  api.on('POST', `${base}/drafts`, () => json({ items: [item({ id: 'd1', productName: '유성매직' })] }, 201))
  fireEvent.click(await screen.findByRole('checkbox', { name: '모닝글로리 유성매직 12색 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 담기' }))
  expect(await screen.findByText('1개를 담았어요. 확인하고 제출해 주세요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '내 품목' }).getAttribute('aria-pressed')).toBe('true')
  expect(api.calls.find(call => call.path === `${base}/drafts`)?.body).toEqual({ idempotencyKey: expect.any(String), candidateIds: ['c1'] })
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET' && call.path === candidatesBase)).toHaveLength(2))
})

test('제출 응답에서 가격이 바뀐 품목을 알린다', async () => {
  const api = setup([item({ id: 'd1', productName: '유성매직' })])
  fireEvent.click(await screen.findByRole('checkbox', { name: '유성매직 고르기' }))
  api.on('POST', `${base}/submit`, () => json({ items: [item({ id: 'd1', productName: '유성매직', status: 'pending', version: 2,
    submissionId: 's1', estimatedUnitPrice: 5200 })] }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 제출' }))
  expect(await screen.findByText('가격이 바뀐 품목이 있어 새 가격으로 제출했어요.')).toBeTruthy()
  expect(screen.getByText('유성매직 4,900원 → 5,200원')).toBeTruthy()
})

test('담은 품목이 없으면 후보에서 골라 담으라고 안내한다', async () => {
  setup([])
  expect(await screen.findByText('아직 담은 품목이 없어요')).toBeTruthy()
  expect(screen.getByText('후보에서 골라 담아 보세요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '끼룩이로 담기' })).toBeNull()
})
```

`apps/web/src/workspace/Workspace.test.tsx`:
- `import '../purchases/LinkDialog.test-support'`를 지우고, `import { candidate, item } from '../purchases/purchase-fixtures'`로 바꾼다.
- `setup`의 가짜 응답에서 `: url.endsWith('/purchase-review') ? review` 앞에 `: url.endsWith('/purchase-candidates') ? { candidates: [], truncated: false }`를 더한다.
- 첫 테스트 이름을 `'sidebar selects events; tabs retain chat draft without mixing events'`로 바꾸고, 구매 탭을 연 뒤 끼룩이 창을 쓰던 부분을 바꾼다:

```tsx
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  await screen.findByText('아직 올라온 쿠팡 링크가 없어요')
  fireEvent.click(screen.getByRole('tab', { name: '대화' }))
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('작성 중인 대화')
  expect(screen.getByRole('region', { name: '대화 기록' }).scrollTop).toBe(120)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: '축제' }))
```

(그 뒤 `await screen.findByText('아직 대화가 없어요.')`부터는 그대로 둔다.)

- `'대화의 끼룩이로 담으면 구매 탭에서 새 품목을 골라 둔 채 보여 준다'` 테스트를 바꾼다:

```tsx
test('구매 탭은 후보로 열리고, 후보에서 담으면 내 품목에서 새 품목을 골라 둔 채 보여 준다', async () => {
  const created = item({ id: 'n1', productName: '테이블' })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, status: init?.method === 'POST' ? 201 : 200, json: async () =>
    url.endsWith('/events') ? { events: [event, { ...event, id: 'e2', name: '축제' }] }
      : url.endsWith('/messages') ? { messages: [], nextCursor: null }
        : url.endsWith('/purchase-candidates') ? { candidates: [candidate({ product: { ...candidate().product!, name: '테이블' } })], truncated: false }
          : url.endsWith('/drafts') ? { items: [created] } : { items: [], truncated: false } })))
  render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '남겨 둔 대화' } })
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: '테이블 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 담기' }))
  expect(await screen.findByText('1개를 담았어요. 확인하고 제출해 주세요.')).toBeTruthy()
  expect((screen.getByRole('checkbox', { name: '테이블 고르기' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('tab', { name: '대화' }))
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('남겨 둔 대화')
})

test('후보의 공유 표시를 누르면 대화 탭의 그 메시지를 강조하고, 대화의 링크를 누르면 상품 패널을 연다', async () => {
  const url = 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'
  const message = { id: 'm1', chatRoomId: 'r1', author: { id: 'u1', name: '기획 테스터' }, content: `이거 ${url}`, createdAt: '2026-10-09T05:12:00Z' }
  vi.stubGlobal('fetch', vi.fn(async (path: string) => ({ ok: true, status: 200, json: async () =>
    path.endsWith('/events') ? { events: [event] } : path.endsWith('/messages') ? { messages: [message], nextCursor: null }
      : path.endsWith('/purchase-candidates') ? { candidates: [candidate()], truncated: false } : { items: [], truncated: false } })))
  Element.prototype.scrollIntoView = vi.fn()
  try {
    render(<Workspace {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
    fireEvent.click(screen.getByRole('tab', { name: '구매' }))
    fireEvent.click(await screen.findByRole('button', { name: '기획 테스터 · 10월 9일 오후 2:12에 공유' }))
    expect(screen.getByRole('tab', { name: '대화' }).getAttribute('aria-selected')).toBe('true')
    const link = screen.getByRole('button', { name: url })
    await waitFor(() => expect(link.closest('li')!.className).toContain('bg-yellow-50'))
    fireEvent.click(link)
    expect(await screen.findByRole('dialog', { name: '모닝글로리 유성매직 12색' })).toBeTruthy()
  } finally {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  }
})
```

`apps/web/src/workspace/purchase-workflow.integration.test.tsx`:
- `import '../purchases/LinkDialog.test-support'`와 `const link = …`를 지우고, import에 `candidatesPath`(workflow-fixtures)와 `candidate`(purchase-fixtures)를 더한다.
- `beforeEach`의 행사 반복 안에 `api.on('GET', candidatesPath(id), () => json({ candidates: [], truncated: false }))`를 더한다.
- 테스트 이름을 `'후보 담기 → 제출 → 구매 검토 %s → 요청자가 결과를 본다'`로 바꾸고, 담기 부분을 바꾼다:

```tsx
  api.on('GET', candidatesPath(), () => json({ candidates: [candidate({ product: { ...candidate().product!, name: '테이블' } })], truncated: false }))
  api.on('POST', `${purchaseItemsPath()}/drafts`, () => json({ items: [draft] }, 201))
  api.on('POST', `${purchaseItemsPath()}/submit`, () => json({ items: [pending] }))
  const planning = render(workspace())
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: '테이블 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 담기' }))
  expect(await screen.findByText('1개를 담았어요. 확인하고 제출해 주세요.')).toBeTruthy()
  expect(api.calls.find(call => call.path === `${purchaseItemsPath()}/drafts`)?.body).toEqual({ candidateIds: ['c1'], idempotencyKey: expect.any(String) })
```

- 마지막에 요청자가 결과를 보는 부분에서 구매 탭을 연 뒤 `fireEvent.click(screen.getByRole('button', { name: '내 품목' }))`을 더한다.

`apps/web/src/App.integration.test.tsx`: `import './purchases/LinkDialog.test-support'`를 지운다. `purchaseItemsPath()` GET을 등록하는 곳 옆에 `api.on('GET', candidatesPath(), () => json({ candidates: [], truncated: false }))`를 더하고 `candidatesPath`를 import한다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/purchases/EventPurchases.test.tsx src/workspace src/App.integration.test.tsx`
Expected: FAIL — `EventPurchases`가 `candidates`·`view`를 받지 않고, `LinkDialog.test-support`가 없어진 곳이 있다

- [ ] **Step 3: 담기 요청을 후보로 바꾸기**

`apps/web/src/purchases/useEventPurchases.ts`의 `create`를 바꾼다:

```ts
    async create(candidateIds: string[]) {
      const payload = JSON.stringify(candidateIds)
      // 같은 후보로 다시 시도하면 같은 키를 써서 두 번 만들지 않는다.
      if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() }
      setGenerating(true)
      try {
        const result = await apply(send('POST', '/drafts', { idempotencyKey: retry.current.key, candidateIds }),
          created => setSelected(created.filter(item => item.status === 'draft').map(item => item.id)))
        if (result.ok) retry.current = null
        return result
      } finally {
        if (active.current) setGenerating(false)
      }
    },
```

`apps/web/src/purchases/purchase-view.ts`의 `purchaseErrors`에서 `INVALID_PRODUCT_LINK`, `DUPLICATE_LINK` 줄을 지운다.

- [ ] **Step 4: 구매 탭**

`apps/web/src/purchases/EventPurchases.tsx`를 바꾼다:
- import에서 `Sparkles`를 지우고 `PurchaseCandidates`, `productNameOf`, `priceNotice`, `won`, `type Candidates`를 쓴다:

```tsx
import { useState, type ReactNode } from 'react'
import { ShoppingCart } from 'lucide-react'
import type { PurchaseItemSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import DraftEditDialog from './DraftEditDialog'
import ItemDetailDialog from './ItemDetailDialog'
import NeededByDialog from './NeededByDialog'
import PurchaseCandidates from './PurchaseCandidates'
import PurchaseItemCard, { productNameOf } from './PurchaseItemCard'
import { missingFields, pressed, priceNotice, sectionOf, todayInSeoul, won } from './purchase-view'
import type { Candidates } from './useCandidates'
import type { EventPurchases as State, PurchaseResult } from './useEventPurchases'

export type PurchaseView = 'candidates' | 'mine' | 'all'
const views: { value: PurchaseView; label: string }[] = [
  { value: 'candidates', label: '후보' }, { value: 'mine', label: '내 품목' }, { value: 'all', label: '행사 전체' }]
type PriceChange = { name: string; from: number | null; to: number }
type Props = {
  state: State
  candidates: Candidates
  view: PurchaseView
  onViewChange: (view: PurchaseView) => void
  // 후보의 공유 표시를 누르면 대화의 그 메시지로 간다.
  onShowMessage: (messageId: string) => void
}
```

- 컴포넌트 머리부터 첫 `return` 앞까지를 바꾼다(아래 `actionsOf`·`card`·`section`·대화상자 코드는 그대로 둔다):

```tsx
// 행사의 구매 탭. 후보에서 골라 담고, 내 품목은 작성 중·진행 중·끝남으로, 행사 전체는 제출된 품목을 진행 중·끝남으로 나눈다.
export default function EventPurchases({ state, candidates, view, onViewChange, onShowMessage }: Props) {
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([])
  const [dialogError, setDialogError] = useState('')
  const [editing, setEditing] = useState<PurchaseItemSummary | null>(null)
  const [dating, setDating] = useState<PurchaseItemSummary[] | null>(null)
  const [removing, setRemoving] = useState<PurchaseItemSummary | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  function clear() { setMessage(''); setNotice(''); setPriceChanges([]) }
  // 후보에서 담으면 내 품목으로 가서 새 품목을 골라 둔 채 보여 준다.
  async function add(ids: string[]) {
    const result = await state.create(ids)
    if (result.ok) {
      clear()
      setNotice(`${result.items.length}개를 담았어요. 확인하고 제출해 주세요.`)
      onViewChange('mine')
      candidates.refresh()
    }
    return result
  }
  const switcher = <div role="group" aria-label="구매 보기" className="flex flex-wrap gap-2">
    {views.map(option => <Button key={option.value} variant="outline" size="sm" className={pressed} aria-pressed={view === option.value}
      onClick={() => onViewChange(option.value)}>{option.label}</Button>)}
  </div>
  if (view === 'candidates') return <div className="flex flex-col gap-4">{switcher}
    <PurchaseCandidates candidates={candidates} generating={state.generating} onAdd={add} onShowMessage={onShowMessage} /></div>
  if (!state.items) return <div className="flex flex-col gap-4">{switcher}{state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">구매 품목을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">구매 품목 불러오는 중…</StateMessage>}</div>
  const items = state.items
  const mine = items.filter(item => item.mine)
  const drafts = mine.filter(item => sectionOf(item) === 'draft')
  const chosen = drafts.filter(item => state.selected.includes(item.id))
  const blocked = chosen.some(item => missingFields(item).length > 0)
  const shared = items.filter(item => item.status !== 'draft')

  async function run(action: () => Promise<PurchaseResult>) {
    clear()
    const result = await action()
    if (!result.ok) setMessage(result.message)
  }
  // 제출할 때 하루 지난 가격을 서버가 다시 조회한다. 바뀐 품목을 알린다.
  async function submit() {
    clear()
    const before = new Map(chosen.map(item => [item.id, item.estimatedUnitPrice]))
    const result = await state.submit(chosen)
    if (!result.ok) { setMessage(result.message); return }
    setPriceChanges(result.items.flatMap(item => {
      const from = before.get(item.id)
      return from !== undefined && item.estimatedUnitPrice !== null && from !== item.estimatedUnitPrice
        ? [{ name: productNameOf(item), from, to: item.estimatedUnitPrice }] : []
    }))
  }
  // 대화상자 안의 실패는 대화상자에 보여 준다. 성공하면 닫는다.
  // 먼저 바뀐 품목이면 대화상자가 든 품목이 오래된 것이다. 닫고 위쪽에 안내해 새로 불러온 목록에서 다시 열게 한다.
  async function inDialog(action: () => Promise<PurchaseResult>, close: () => void) {
    setDialogError('')
    clear()
    const result = await action()
    if (result.ok) close()
    else if (result.stale) { close(); setMessage(result.message) }
    else setDialogError(result.message)
  }
```

(기존의 `seenNotice` 상태와 `notice` prop 처리, `if (notice) setSeenNotice(...)` 줄을 모두 지운다.)

- `draftTools`의 제출 버튼을 `onClick={() => void submit()}`로 바꾼다.
- 반환하는 JSX의 머리 부분을 바꾼다:

```tsx
  return <div className="flex flex-col gap-4">
    {switcher}
    {notice && <StateMessage kind="notice">{notice}</StateMessage>}
    {priceChanges.length > 0 && <div className="flex flex-col gap-1" role="status">
      <p className="text-sm text-gray-500">가격이 바뀐 품목이 있어 새 가격으로 제출했어요.</p>
      <ul className="flex flex-col gap-0.5 text-xs text-gray-700">
        {priceChanges.slice(0, 3).map((change, index) => <li key={index} className="wrap-anywhere">
          {change.name} {change.from === null ? '금액 확인 필요' : won(change.from)} → {won(change.to)}</li>)}
        {priceChanges.length > 3 && <li>외 {priceChanges.length - 3}개</li>}
      </ul>
    </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {state.truncated && <StateMessage kind="notice">최근 300개만 보여요.</StateMessage>}
```

(기존의 `구매 보기` 버튼 묶음과 `끼룩이로 담기` 버튼이 있던 줄, `notice && notice.id !== seenNotice` 줄을 지운다. `view === 'mine' ? … : …` 분기는 그대로 둔다.)

- 내 품목이 비었을 때의 안내를 바꾼다:

```tsx
      {mine.length === 0 && <Card><EmptyState icon={ShoppingCart} title="아직 담은 품목이 없어요" description="후보에서 골라 담아 보세요." /></Card>}
```

- [ ] **Step 5: 행사 화면**

`apps/web/src/workspace/EventWorkspace.tsx`를 바꾼다:

```tsx
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { CoupangLink, EventSummary } from '@vada/contracts'
import Chat from '../chat/Chat'
import EventPurchases, { type PurchaseView } from '../purchases/EventPurchases'
import ProductPanel from '../purchases/ProductPanel'
import { useCandidates } from '../purchases/useCandidates'
import { useEventPurchases } from '../purchases/useEventPurchases'
import { TabButton } from '@/components/ui/tab-button'

const tabs = { chat: '대화', purchases: '구매' } as const
type Tab = keyof typeof tabs

export default function EventWorkspace({ event, onLeaveRiskChange }: { event: EventSummary; onLeaveRiskChange: (risk: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('chat')
  const [view, setView] = useState<PurchaseView>('candidates')
  // 구매 목록은 구매 탭을 처음 열 때, 후보는 구매 탭이나 링크 패널을 처음 열 때 불러온다.
  const [opened, setOpened] = useState(false)
  const [link, setLink] = useState<CoupangLink | null>(null)
  const [focus, setFocus] = useState<{ id: number; messageId: string } | null>(null)
  const purchases = useEventPurchases(event.organizationId, event.id, opened)
  const candidates = useCandidates(event.organizationId, event.id, opened || link !== null,
    (tab === 'purchases' && view === 'candidates') || link !== null)
  const risk = purchases.generating
  useEffect(() => { onLeaveRiskChange(risk) }, [risk, onLeaveRiskChange])
  useEffect(() => () => onLeaveRiskChange(false), [onLeaveRiskChange])
  const prefix = useId()
  function select(next: Tab) { setTab(next); if (next === 'purchases') setOpened(true) }
  function navigate(keyboard: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboard.key)) return
    keyboard.preventDefault()
    const next: Tab = keyboard.key === 'Home' ? 'chat' : keyboard.key === 'End' ? 'purchases' : tab === 'chat' ? 'purchases' : 'chat'
    select(next)
    document.getElementById(`${prefix}-${next}-tab`)?.focus()
  }
  // 후보의 공유 표시를 누르면 대화 탭으로 가서 그 메시지를 찾는다.
  function showMessage(messageId: string) { setTab('chat'); setFocus({ id: Date.now(), messageId }) }
  // 행사 이름은 WorkspaceHeader의 제목이 보여 준다. 대화 탭은 흰 바탕 전체 화면, 구매 탭은 gray-50 본문에 여백을 둔다.
  return <>
    <div className="flex shrink-0 gap-0.5 border-b bg-white px-4 sm:px-6" role="tablist" aria-label="행사 작업">
      {(Object.keys(tabs) as Tab[]).map(value => <TabButton key={value} id={`${prefix}-${value}-tab`}
        aria-selected={tab === value} aria-controls={`${prefix}-${value}-panel`} tabIndex={tab === value ? 0 : -1}
        onClick={() => select(value)} onKeyDown={navigate}>{tabs[value]}</TabButton>)}
    </div>
    {/* 탭은 숨기기만 하여 대화 입력·스크롤과 구매 화면 상태를 보존한다. 행사 이동은 key로 격리한다. */}
    <div className="flex min-h-0 flex-1 flex-col bg-white" role="tabpanel" id={`${prefix}-chat-panel`} aria-labelledby={`${prefix}-chat-tab`} hidden={tab !== 'chat'}>
      <Chat organizationId={event.organizationId} eventId={event.id} eventName={event.name} onOpenLink={setLink} focus={focus} />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-purchases-panel`} aria-labelledby={`${prefix}-purchases-tab`} hidden={tab !== 'purchases'}>
      {opened && <div className="mx-auto max-w-3xl"><EventPurchases state={purchases} candidates={candidates} view={view}
        onViewChange={setView} onShowMessage={showMessage} /></div>}
    </div>
    <ProductPanel link={link} candidates={candidates} onClose={() => setLink(null)} />
  </>
}
```

`apps/web/src/workspace/Workspace.tsx`의 이동 경고 문구를 바꾼다:

```tsx
  function canLeave() { return !leaveRisk || window.confirm('끼룩이가 품목을 담는 중이에요. 이동해도 담는 중인 품목은 서버에서 계속 만들어질 수 있어요. 이동할까요?') }
```

붙여 넣기 창 파일 셋(`LinkDialog.tsx`, `LinkDialog.test.tsx`, `LinkDialog.test-support.ts`)을 지운다. `grep -rn "LinkDialog\|PURCHASE_LINKS_MAX" apps packages`로 남은 곳이 없는지 본다.

- [ ] **Step 6: 통과 확인**

Run: `npm test --workspace @vada/web && npm run typecheck && npm run build --workspace @vada/web`
Expected: PASS(병렬 실행 포함)

- [ ] **Step 7: 커밋**

```bash
git add -A apps/web/src
git commit -m "구매 탭에 후보 보기를 연결하고 링크 붙여 넣기 창 삭제"
```

---

### Task 12: 문서

**Files:**
- Modify: `docs/ERD.md`, `docs/purchase-model.md`

- [ ] **Step 1: ERD**

`docs/ERD.md`의 "## 구매 품목" 절 다이어그램과 설명에 더한다.
- 다이어그램에 `coupangProducts`, `purchaseCandidates`, `purchaseCandidateShares` 표와 관계를 넣는다: 행사 → 후보, 후보 → 공유 → 메시지, 후보 → 상품, 품목 → 후보(선택).
- `purchase_items`에 `candidate_id`를 넣는다.
- 설명 줄:
  - `coupang_products`: 학생회와 무관한 공개 상품 정보. 상품 ID 하나에 옵션 전체를 저장한다(최대 100개). `pending`은 조회 대기열이고, 웹 서버 안의 실행기가 `locked_until`로 잠가 가져가며 실패하면 1·5·30분 뒤 다시 시도하다 네 번째에 `failed`가 된다. `NOT_FOUND`는 바로 `failed`다.
  - `purchase_candidates`: 같은 행사에서 (상품, `vendor_item_id`)마다 하나다(`NULLS NOT DISTINCT`, 옵션 미정은 상품마다 하나). 숨긴 사람·시각은 같이 있거나 같이 없고, 다시 공유되면 숨김을 푼다.
  - `purchase_candidate_shares`: 메시지 안 링크 순서(0~9)마다 한 줄. 대화 저장과 같은 트랜잭션에서 기록한다.
  - `purchase_items.candidate_id`: 후보에서 담은 품목. 다시 담기 복사본도 이어 받는다.

- [ ] **Step 2: 구매 도메인 문서**

`docs/purchase-model.md`의 머리 목록에 더한다:

```markdown
- 2026-10-09 2차(후보 목록, 상품 단위 조회 저장, 제출 때 가격 다시 확인)를 반영했다. 설계는 [채팅 링크 후보 목록 설계](superpowers/specs/2026-10-09-purchase-candidates-design.md)에 있다. 채팅 알림 카드는 3차다.
```

"채팅 링크와 상품 정보" 절의 `현재 코드(apps/api/src/purchases/products.ts)는 옵션 단위(itemId)로 조회한다. 구매 흐름을 다시 만들 때 상품 단위로 바꾼다.` 줄을 `상품 단위로 조회해 \`coupang_products\`에 저장한다(2026-10-09). 제출 때 다시 확인하는 기준은 24시간이다.`로 바꾼다. `- 후보 목록·상품 단위 조회 저장·채팅 알림 카드는 2·3차다.` 줄을 지운다.

- [ ] **Step 3: 커밋**

```bash
git add docs/ERD.md docs/purchase-model.md
git commit -m "후보 목록과 상품 조회 저장을 문서에 반영"
```

---

### Task 13: dev 확인, DB 적용, 배포

**Files:**
- Create(커밋하지 않음): `.superpowers/apply-0014.mts`

- [ ] **Step 1: 적용 스크립트(점검 전용 기본값)**

`.superpowers/apply-0013.mts`를 바탕으로 만든다.
- 마지막 로컬 마이그레이션이 `0014_purchase_candidates`인지 확인한다.
- 점검에서 적용 기록 개수와 순서·해시가 맞는지 보고, 새 표 셋이 이미 있는지(`to_regclass`)와 `purchase_items.candidate_id`가 있는지 본다.
- 새 표·새 칸만 더하므로 막는 행 검사는 없다.
- `--apply`는 `applied === local.length - 1`, 순서 일치, 새 표 없음일 때만 `migrate()`를 부른다.
- 적용 뒤 확인: 적용 기록이 `local.length`이고, 새 표 셋과 칸이 있고, `purchase_items` 행 수가 그대로인지 본다. 맞으면 `MIGRATION_0014_APPLIED`를 출력한다.
- 접속 주소·값·오류 원문은 출력하지 않는다.

Run: `cd apps/api && npx tsx ../../.superpowers/apply-0014.mts dev && npx tsx ../../.superpowers/apply-0014.mts preview`
Expected: 둘 다 `applied 14/15 (in order: true)`, 새 표 없음

- [ ] **Step 2: 적용 승인**

AskUserQuestion으로 묻는다. 추천은 "dev 먼저 → 확인 → 배포 DB → 바로 병합·푸시"다. 새 표만 더하므로 지금 배포된 코드는 영향을 받지 않는다.

- [ ] **Step 3: dev 적용과 화면 확인**

Run: `cd apps/api && npx tsx ../../.superpowers/apply-0014.mts dev --apply`
Expected: `MIGRATION_0014_APPLIED`

API·웹 개발 서버로 확인한다(브라우저 창이 가려져 있으면 DOM과 390px iframe으로 잰다).
- 대화에 실제 쿠팡 상품 링크를 올린다. 메시지는 바로 보이고, 링크가 버튼으로 그려진다.
- 10초 안에 구매 탭 "후보"에 이름·가격·이미지가 채워진다(실제 ReefAPI).
- 링크를 누르면 오른쪽 패널이 열린다.
- 공유 표시를 누르면 대화의 그 메시지가 강조된다.
- 숨기기·되돌리기·숨긴 후보를 확인한다.
- 후보를 골라 담으면 내 품목에 작성 중 품목이 생기고, 제출까지 된다.
- 390px에서 후보 카드·패널·대화 링크가 넘치지 않는다.
- 와이어프레임에는 비교할 노드가 없다(spec). 1차 카드와 모양이 같은지만 본다.

- [ ] **Step 4: 배포 DB 적용, 병합, 푸시**

Run: `cd apps/api && npx tsx ../../.superpowers/apply-0014.mts preview --apply`
Expected: `MIGRATION_0014_APPLIED`

```bash
git checkout main && git merge --ff-only purchase-candidates && git push origin main
```

CI와 Render 배포를 기다린다(운영 번들 이름이 로컬 빌드와 같아지면 배포된 것이다). 운영에서 후보 목록 GET이 200인지 읽기만 해서 확인한다. 운영의 실제 조회는 Render의 `REEF_API_KEY` 설정이 필요하다는 것을 보고에 적는다.
