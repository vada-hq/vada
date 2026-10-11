import { createHash, randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { BudgetPlanResponse, EventFinanceResponse, EventPurchaseItemsResponse, EventResponse, ExpenseResponse, PurchaseCandidatesResponse,
  ReceiptUploadResponse, RegistrationCreated, RegistrationResponse, TaskResponse, TaskStatus, EventsResponse } from '@vada/contracts'
import { createApp } from '../src/app.js'
import { createAccessRoutes } from '../src/access/access.js'
import { createBudgetRoutes } from '../src/budget/routes.js'
import { createChatRoutes } from '../src/chat/chat.js'
import { budgetPeriodEvents, budgetPeriods, chatRooms, coupangProducts, departments, eventFinanceEvents, eventFinances, events, expenseEvents, expenseReceipts,
  feeAccountEvents, incomeEvents, incomes, memberships, messages, organizations, purchaseItemEvents, purchaseItems, registrationForms, registrations,
  users } from '../src/db/schema.js'
import { createEventRoutes } from '../src/events/events.js'
import { createExpenseRoutes } from '../src/expenses/routes.js'
import type { ReceiptStorage } from '../src/expenses/storage.js'
import { createFeeRoutes } from '../src/fees/routes.js'
import { createIncomeRoutes } from '../src/incomes/routes.js'
import { createOrganizationRoutes } from '../src/organization/routes.js'
import { createProductCatalog } from '../src/purchases/catalog.js'
import type { DraftGenerator } from '../src/purchases/generation.js'
import { createLookupRunner } from '../src/purchases/lookup-runner.js'
import type { ProductFetcher } from '../src/purchases/products.js'
import { createPurchaseRoutes } from '../src/purchases/purchases.js'
import { createRegistrationRoutes } from '../src/registrations/routes.js'
import { createSettlementRoutes } from '../src/settlement/routes.js'
import { createTaskRoutes } from '../src/tasks/routes.js'

// 기획자 시연용 데이터. 배포 DB의 검증 학생회(로그인 계정 셋이 소속)를 "소프트웨어학부 학생회 (시연)"으로 바꾸고,
// 그 안의 내용을 모두 지운 뒤 한 학기 반의 활동을 실제 서버 코드(라우트·서비스·입력 검사)로 다시 넣는다.
// 외부 호출(쿠팡 조회, 요청서 초안 생성)만 가짜이고, 배송 추적은 외부 서비스에 등록되므로 넣지 않는다.
type Db = PgDatabase<PgQueryResultHKT>
export const DEMO_ORGANIZATION_ID = 'm1-test-council'
export const DEMO_ORGANIZATION_NAME = '소프트웨어학부 학생회 (시연)'
const ORIGIN = 'http://127.0.0.1:5180'
const DEMO_USER_PREFIX = 'demo-member-'
const PROMOTION_ID = 'demo-promotion'
// 시연용 가짜 쿠팡 상품 ID. 실제 상품과 겹치지 않게 아주 큰 번호를 쓴다. 상품 정보 표는 학생회끼리 같이 쓰므로 초기화 때 이 번호만 지운다.
const PRODUCT_PREFIX = '999999'

export interface DemoOptions {
  db: Db
  storage: ReceiptStorage
  // 서명 주소로 영수증 파일을 올린다. 운영은 fetch PUT, 테스트는 가짜 저장소에 넣는다.
  upload: (url: string, headers: Record<string, string>, body: Uint8Array) => Promise<void>
  // 시나리오 날짜의 기준이 되는 한국 날짜(YYYY-MM-DD)
  today: string
  log?: (line: string) => void
}

// ── 날짜 ──────────────────────────────────────────────────────────────
const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
const kst = (day: string, time: string) => new Date(`${day}T${time}:00+09:00`)
const koreanTime = (day: string, time: string) => `${day}T${time}`
const lastDayOfFebruary = (year: number) => new Date(Date.UTC(year, 2, 0)).toISOString().slice(0, 10)

// 2학기(9월~2월) 가운데, 지난 행사(오늘 − 15일)가 개강총회 뒤이고 학술제(오늘 + 34일)가 학기 안일 때만 시나리오가 맞는다.
export function demoCalendar(today: string) {
  const [year = 0, month = 0] = today.split('-').map(Number)
  if (!(month >= 9 || month <= 2)) throw new Error('DEMO_WINDOW')
  const first = month >= 9 ? year : year - 1
  const current = { name: `${first}년 2학기`, startsOn: `${first}-09-01`, endsOn: lastDayOfFebruary(first + 1) }
  const previous = { name: `${first}년 1학기`, startsOn: `${first}-03-01`, endsOn: `${first}-08-31` }
  const calendar = { today, current, previous, orientation: `${first}-03-06`, opening: addDays(current.startsOn, 3), sports: addDays(today, -15),
    snack: addDays(today, 10), festival: addDays(today, 34) }
  if (calendar.sports < addDays(calendar.opening, 7) || calendar.festival > current.endsOn) throw new Error('DEMO_WINDOW')
  return calendar
}
type Calendar = ReturnType<typeof demoCalendar>

// ── 사람 ──────────────────────────────────────────────────────────────
type DepartmentKey = 'leadership' | 'finance' | 'planning' | 'promotion'
const people = [
  { key: 'vice', name: '이서연', department: 'leadership', title: '부회장' },
  { key: 'treasurer', name: '박준호', department: 'finance', title: '재정부장' },
  { key: 'accountant', name: '최유진', department: 'finance', title: null },
  { key: 'planner', name: '정민재', department: 'planning', title: '기획부장' },
  { key: 'planner2', name: '한지우', department: 'planning', title: null },
  { key: 'planner3', name: '오세린', department: 'planning', title: null },
  { key: 'promoter', name: '윤태민', department: 'promotion', title: '홍보부장' },
  { key: 'newcomer', name: '강하늘', department: null, title: null },
] as const satisfies readonly { key: string; name: string; department: DepartmentKey | null; title: string | null }[]
type PersonKey = typeof people[number]['key']
const userIdOf = (key: PersonKey) => `${DEMO_USER_PREFIX}${key}`

// 신청자 이름: 성 × 이름을 겹치지 않게 돌린다. 학번은 실존 여부와 무관한 가상 번호다.
const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍']
const givenNames = ['민준', '서윤', '도현', '지우', '하준', '서연', '예준', '하은', '시우', '지민', '주원', '수아', '건우', '지아', '우진', '채원',
  '선우', '다은', '유찬', '소율', '은호', '예린', '태윤', '나연', '현우', '가은', '정우', '서현', '승현', '유나', '민성', '하린', '준혁', '윤서']
const studentName = (n: number) => `${surnames[n % surnames.length]}${givenNames[(n * 7 + Math.floor(n / surnames.length)) % givenNames.length]}`
const studentIdOf = (year: number, n: number) => `${year}${String(1000 + n).padStart(4, '0')}`

// ── 가짜 쿠팡 상품 ────────────────────────────────────────────────────
type Product = { id: string; name: string; option: string | null; price: number; quantity: number; packaging: string | null; note: string | null }
const product = (n: number, name: string, option: string | null, price: number, quantity: number, packaging: string | null = null, note: string | null = null):
  Product => ({ id: `${PRODUCT_PREFIX}${String(n).padStart(5, '0')}`, name, option, price, quantity, packaging, note })
const catalog = {
  snack: product(1, '오리온 대용량 과자 선물세트', '12종 구성', 18900, 6, '세트', '개강총회 다과'),
  cola: product(2, '코카콜라 355ml', '24캔', 17800, 3, '박스'),
  cups: product(3, '무형광 종이컵 6.5온스', '1000개', 12900, 1, '박스'),
  water2l: product(4, '제주 삼다수 2L', '6개입', 6980, 10, '묶음', '경기장 구역마다 2묶음'),
  vests: product(5, '팀 조끼 4색 세트', '빨강·파랑·노랑·초록 각 5벌', 23900, 1, '세트'),
  whistle: product(6, '스포츠 호루라기', '10개입', 8900, 1, '팩'),
  arch: product(7, '에어 아치 풍선 게이트 6m', '송풍기 포함', 189000, 1),
  ramen: product(8, '농심 육개장 사발면', '30개입', 21900, 4, '박스'),
  bar: product(9, '견과 에너지바', '30개입', 15900, 3, '박스'),
  water500: product(10, '제주 삼다수 500ml', '40병', 13800, 2, '박스'),
  spoons: product(11, '일회용 수저 세트', '500개', 9900, 1, '박스'),
  easel: product(12, '알루미늄 이젤 거치대', '높이 조절형', 15900, 4, '개', '포스터 발표용'),
  badges: product(13, '목걸이 명찰 케이스', '100개', 12900, 1, '팩'),
  clipboards: product(14, 'A4 클립보드', '20개', 21000, 1, '팩'),
}
type ProductKey = keyof typeof catalog
const linkOf = (item: Product) => `https://www.coupang.com/vp/products/${item.id}?itemId=${item.id}1&vendorItemId=${item.id}2`
const productById = (id: string) => Object.values(catalog).find(item => item.id === id)

const fetchProduct: ProductFetcher = async productId => {
  const item = productById(productId)
  if (!item) return { ok: false, code: 'NOT_FOUND', retryable: false }
  return { ok: true, items: [{ itemId: `${item.id}1`, vendorItemId: `${item.id}2`, name: item.option ? `${item.name}, ${item.option}` : item.name,
    price: item.price, listPrice: null, discountPercent: null, inStock: true, deliveryEta: null, imageUrl: null }] }
}
// 끼룩이(요청서 초안 생성) 대신 상품마다 정해 둔 값으로 초안을 만든다. 가격은 조회값과 같다.
const generateDraft: DraftGenerator = async input => ({
  items: input.links.map(url => {
    const id = /products\/(\d+)/.exec(url)?.[1] ?? ''
    const item = productById(id)
    if (!item) throw new Error('DEMO_PRODUCT')
    return { productUrl: url, productName: item.name, selectedOption: item.option, optionRequired: item.option !== null, quantity: item.quantity,
      packagingUnit: item.packaging, note: item.note, neededBy: null,
      sourceMessageIds: input.messages.filter(message => message.content.includes(item.id)).map(message => message.id).slice(0, 20), warnings: [],
      estimatedUnitPrice: item.price, productSnapshot: { price: item.price }, productFetchedAt: new Date() }
  }),
})

// ── 시연용 영수증(PDF, 글자는 영문) ─────────────────────────────────
// 실제 영수증처럼 보이지 않게 맨 위에 SAMPLE을 적는다.
export function receiptPdf(lines: string[]) {
  const escape = (value: string) => value.replace(/[\\()]/g, match => `\\${match}`)
  const body = ['SAMPLE RECEIPT - VADA DEMO', '-'.repeat(40), ...lines, '-'.repeat(40), 'Sample data for a product demo.']
  const content = ['BT', '/F1 10 Tf', '14 TL', '28 560 Td', ...body.flatMap(line => [`(${escape(line)}) Tj`, 'T*']), 'ET'].join('\n')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}
const won = (value: number) => value.toLocaleString('en-US')
const row = (label: string, amount: number) => `${label.padEnd(28).slice(0, 28)}${won(amount).padStart(12)}`

// ── 초기화 ───────────────────────────────────────────────────────────
// 시연 학생회의 내용을 모두 지운다. 학생회·부서(회장단·재정부·기획부)·로그인 계정의 소속은 남긴다. 지운 영수증 파일 경로를 돌려준다.
export async function resetDemo(db: Db) {
  const org = DEMO_ORGANIZATION_ID
  const keys = (await db.select({ key: expenseReceipts.objectKey }).from(expenseReceipts).where(eq(expenseReceipts.organizationId, org)))
    .map(item => item.key)
  await db.transaction(async tx => {
    const run = (statement: ReturnType<typeof sql>) => tx.execute(statement)
    // 업무는 행사·가상 구성원·홍보부를 가리키므로 먼저 지운다.
    await run(sql`DELETE FROM task_events WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM tasks WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM income_events WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM incomes WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM expense_events WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM expense_receipts WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM expense_items WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM expenses WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM event_finance_events WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM event_finances WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM registrations WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM registration_forms WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM fee_account_events WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM fee_accounts WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM dues_rosters WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM shipment_jobs WHERE shipment_id IN (SELECT id FROM shipments WHERE organization_id = ${org})`)
    await run(sql`DELETE FROM shipment_registrations WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM shipment_items WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM shipments WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM purchase_item_events WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM purchase_item_sources WHERE item_id IN (SELECT id FROM purchase_items WHERE organization_id = ${org})`)
    await run(sql`DELETE FROM purchase_candidate_shares WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM purchase_items WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM purchase_submissions WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM purchase_generations WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM purchase_candidates WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM budget_period_events WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM budget_lines WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM budget_periods WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM messages WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE organization_id = ${org})`)
    await run(sql`DELETE FROM chat_rooms WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM events WHERE organization_id = ${org}`)
    await run(sql`DELETE FROM memberships WHERE organization_id = ${org} AND user_id LIKE ${`${DEMO_USER_PREFIX}%`}`)
    await run(sql`DELETE FROM users WHERE id LIKE ${`${DEMO_USER_PREFIX}%`}`)
    await run(sql`UPDATE memberships SET department_id = NULL WHERE organization_id = ${org} AND department_id = ${PROMOTION_ID}`)
    await run(sql`DELETE FROM departments WHERE organization_id = ${org} AND id = ${PROMOTION_ID}`)
    await run(sql`DELETE FROM coupang_products WHERE id LIKE ${`${PRODUCT_PREFIX}%`}
      AND NOT EXISTS (SELECT 1 FROM purchase_candidates c WHERE c.product_id = coupang_products.id)`)
  })
  return keys
}

// ── 넣기 ─────────────────────────────────────────────────────────────
export async function seedDemo({ db, storage, upload, today, log = () => {} }: DemoOptions) {
  const calendar = demoCalendar(today)
  const org = DEMO_ORGANIZATION_ID
  // 시연 기준 날짜의 정오. 참가비·참가 신청의 시계(명단 기한, 신청 상태)로 쓴다.
  const state = { userId: null as string | null, now: kst(today, '12:00') }
  const session = async () => state.userId ? { user: { id: state.userId } } : null
  const lookups = createLookupRunner(createProductCatalog(db, fetchProduct))
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
    access: createAccessRoutes(db, session), organization: createOrganizationRoutes(db, session), events: createEventRoutes(db, session),
    chat: createChatRoutes(db, session, () => { void lookups.kick() }),
    purchases: createPurchaseRoutes(db, session, generateDraft, fetchProduct), expenses: createExpenseRoutes(db, session, storage),
    settlement: createSettlementRoutes(db, session, ORIGIN), budget: createBudgetRoutes(db, session, ORIGIN), incomes: createIncomeRoutes(db, session),
    registrations: createRegistrationRoutes(db, session, { now: () => state.now }), fees: createFeeRoutes(db, session, { now: () => state.now }),
    tasks: createTaskRoutes(db, session) })
  // 실패하면 단계와 상태·오류 코드만 남긴다(응답 본문에는 개인 칸이 없고 오류 코드만 있다). 200을 기대하면 201도 받는다.
  // 원격 DB 연결이 잠깐 끊겨 생긴 5xx는 거래가 되돌려진 것이므로 잠시 뒤 두 번까지 다시 보낸다.
  async function call<T>(user: PersonKey | null, method: string, path: string, body?: unknown, status = 200): Promise<T> {
    state.userId = user === null ? null : userIdOf(user)
    const send = () => app.request(`/api${path}`, body === undefined ? { method }
      : { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    let response = await send()
    for (let attempt = 1; attempt <= 2 && response.status >= 500; attempt++) {
      log(`다시 시도 ${attempt}: ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')}`)
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt))
      response = await send()
    }
    if (response.status !== status && !(status === 200 && response.status === 201)) {
      throw new Error(`DEMO_STEP ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')} → ${response.status} ${(await response.text()).slice(0, 120)}`)
    }
    return await response.json() as T
  }
  const orgPath = (path: string) => `/organizations/${org}${path}`

  // 1. 학생회 이름, 부서, 가상 구성원
  log('학생회·부서·구성원')
  await db.update(organizations).set({ name: DEMO_ORGANIZATION_NAME }).where(eq(organizations.id, org))
  const existing = await db.select().from(departments).where(eq(departments.organizationId, org))
  async function departmentId(key: DepartmentKey) {
    const found = existing.find(item => key === 'leadership' ? item.isLeadership : key === 'finance' ? item.handlesFinance
      : item.name === (key === 'planning' ? '기획부' : '홍보부'))
    if (found) return found.id
    const id = key === 'promotion' ? PROMOTION_ID : `demo-${key}`
    await db.insert(departments).values({ id, organizationId: org, name: { leadership: '회장단', finance: '재정부', planning: '기획부', promotion: '홍보부' }[key],
      handlesFinance: key === 'finance', isLeadership: key === 'leadership' })
    return id
  }
  const departmentIds: Record<DepartmentKey, string> = { leadership: await departmentId('leadership'), finance: await departmentId('finance'),
    planning: await departmentId('planning'), promotion: await departmentId('promotion') }
  const joinedAt = kst(addDays(calendar.previous.startsOn, -10), '10:00')
  for (const person of people) {
    await db.insert(users).values({ id: userIdOf(person.key), name: person.name, email: `${userIdOf(person.key)}@example.com`, createdAt: joinedAt })
    await db.insert(memberships).values({ id: `${userIdOf(person.key)}-membership`, userId: userIdOf(person.key), organizationId: org,
      departmentId: person.department === null ? null : departmentIds[person.department], title: person.title, createdAt: joinedAt })
  }
  const treasurerMembership = `${userIdOf('treasurer')}-membership`

  // 2. 참가비 설정: 학생회 계좌(가짜 번호)와 학생회비 납부 명단
  log('참가비 설정')
  await call('treasurer', 'POST', orgPath('/fee-account'), { version: 0, bank: '카카오뱅크', accountNumber: '3333-00-0000000', holder: '소프트웨어학부 학생회' })
  const duesPeople = Array.from({ length: 30 }, (_, n) => ({ studentId: studentIdOf(2023 + (n % 4), 200 + n), name: studentName(200 + n) }))
  await call('treasurer', 'POST', orgPath('/dues-roster'), { version: 0, label: `${calendar.current.name} 학생회비 납부자`, useUntil: calendar.current.endsOn,
    members: duesPeople })

  // 3. 회계 기간 둘
  log('회계 기간')
  const previous = await call<BudgetPlanResponse>('treasurer', 'POST', orgPath('/budget/periods'), calendar.previous, 201)
  const current = await call<BudgetPlanResponse>('treasurer', 'POST', orgPath('/budget/periods'), calendar.current, 201)

  // 4. 행사 다섯 개. 참가 신청을 다루는 동안에는 보관 기간 파기에 걸리지 않게 날짜를 잠시 미래로 두고, 끝에 시나리오 날짜로 옮긴다.
  log('행사')
  const future = addDays(new Date().toISOString().slice(0, 10), 90)
  const plan = [
    { key: 'orientation', name: `${calendar.previous.startsOn.slice(0, 4)} 새내기 배움터`, creator: 'vice', day: calendar.orientation, start: '10:00',
      endDay: addDays(calendar.orientation, 1), end: '15:00', place: '가평 청소년수련원' },
    { key: 'opening', name: '2학기 개강총회', creator: 'planner', day: calendar.opening, start: '18:00', endDay: calendar.opening, end: '20:30', place: '학생회관 대강당' },
    { key: 'sports', name: '소프트웨어학부 체육대회', creator: 'planner', day: calendar.sports, start: '10:00', endDay: calendar.sports, end: '17:00', place: '대운동장' },
    { key: 'snack', name: '중간고사 간식 나눔', creator: 'planner2', day: calendar.snack, start: '12:00', endDay: calendar.snack, end: '14:00', place: '공학관 1층 로비' },
    { key: 'festival', name: '소프트웨어학부 학술제', creator: 'promoter', day: calendar.festival, start: '13:00', endDay: calendar.festival, end: '18:00',
      place: '공학관 대강의실' },
  ] as const
  type EventKey = typeof plan[number]['key']
  const eventIds = {} as Record<EventKey, string>
  for (const item of plan) {
    const { event } = await call<EventResponse>(item.creator, 'POST', orgPath('/events'), { name: item.name }, 201)
    eventIds[item.key] = event.id
    await call(item.creator, 'PATCH', orgPath(`/events/${event.id}`), { version: event.version, startsAt: koreanTime(future, item.start),
      endsAt: koreanTime(future, item.end), place: item.place })
  }
  const eventPath = (key: EventKey, path = '') => orgPath(`/events/${eventIds[key]}${path}`)

  // 5. 행사 대화. 쿠팡 링크는 구매 후보가 된다.
  // 상품 정보를 먼저 조회 완료로 넣는다. 운영 서버의 조회 실행기는 대기(pending) 상품만 가져가므로, 가짜 번호로 실제 조회를 보내지 않는다.
  log('대화')
  for (const item of Object.values(catalog)) {
    const result = await fetchProduct(item.id)
    if (!result.ok) throw new Error('DEMO_PRODUCT')
    const ready = { status: 'ready' as const, items: result.items, fetchedAt: new Date(), attempts: 0, lockedUntil: null, errorCode: null }
    await db.insert(coupangProducts).values({ id: item.id, ...ready }).onConflictDoUpdate({ target: coupangProducts.id, set: ready })
  }
  const talk: Record<EventKey, { by: PersonKey; text: string; day: number; at: string }[]> = {
    orientation: [
      { by: 'vice', text: '새내기 배움터 숙소는 가평 청소년수련원으로 확정했어요. 버스는 45인승 두 대예요.', day: -20, at: '13:10' },
      { by: 'planner', text: '참가비는 3만 원으로 잡고 신청 링크 열게요. 정원은 60명이에요.', day: -19, at: '10:05' },
      { by: 'treasurer', text: '숙박비 견적서 받았어요. 입금은 행사 3일 전에 할게요.', day: -8, at: '16:40' },
    ],
    opening: [
      { by: 'planner', text: '개강총회 다과 준비해요. 지난 학기보다 신입생이 늘어서 과자 6세트, 음료 3박스 생각 중이에요.', day: -8, at: '14:02' },
      { by: 'planner', text: linkOf(catalog.snack), day: -8, at: '14:03' },
      { by: 'planner2', text: `콜라는 24캔 3박스면 될 것 같아요 ${linkOf(catalog.cola)}`, day: -8, at: '14:11' },
      { by: 'planner3', text: `종이컵도 다 떨어졌어요! ${linkOf(catalog.cups)}`, day: -8, at: '14:16' },
      { by: 'treasurer', text: '확인했어요. 요청서 올려 주시면 오늘 안에 볼게요.', day: -8, at: '15:02' },
    ],
    sports: [
      { by: 'planner', text: '체육대회 참가 신청 열었어요. 참가비 5천 원이고 학생회비 낸 사람은 무료예요.', day: -15, at: '09:12' },
      { by: 'planner2', text: `물은 구역마다 2묶음씩 10묶음이요 ${linkOf(catalog.water2l)}`, day: -12, at: '11:30' },
      { by: 'planner3', text: `팀 조끼 4색 세트 하나면 20명이에요 ${linkOf(catalog.vests)}`, day: -12, at: '11:34' },
      { by: 'planner', text: `호루라기도 필요해요 ${linkOf(catalog.whistle)}`, day: -12, at: '11:40' },
      { by: 'promoter', text: `입구에 에어 아치 있으면 사진이 잘 나올 것 같아요 ${linkOf(catalog.arch)}`, day: -12, at: '12:05' },
      { by: 'treasurer', text: '에어 아치는 예산을 넘어서 대여 업체 견적이랑 비교해 볼게요.', day: -11, at: '10:20' },
    ],
    snack: [
      { by: 'planner2', text: '중간고사 간식 나눔은 컵라면이랑 에너지바로 해요. 신청한 사람만 받아요.', day: -13, at: '15:20' },
      { by: 'planner2', text: `컵라면 4박스 ${linkOf(catalog.ramen)}`, day: -13, at: '15:21' },
      { by: 'planner3', text: `에너지바 3박스면 충분해요 ${linkOf(catalog.bar)}`, day: -13, at: '15:30' },
      { by: 'planner', text: `물도 같이 주면 좋겠어요 ${linkOf(catalog.water500)}`, day: -12, at: '10:02' },
      { by: 'planner2', text: `수저는 컵라면용으로 ${linkOf(catalog.spoons)}`, day: -12, at: '10:15' },
    ],
    festival: [
      { by: 'promoter', text: '학술제 포스터 발표는 이젤 4개 필요해요. 현수막은 홍보부에서 주문했어요.', day: -40, at: '17:05' },
      { by: 'promoter', text: linkOf(catalog.easel), day: -40, at: '17:06' },
      { by: 'planner', text: `심사위원용 명찰이랑 클립보드도요 ${linkOf(catalog.badges)} ${linkOf(catalog.clipboards)}`, day: -38, at: '09:40' },
      { by: 'vice', text: '발표 팀 접수는 다음 주에 공지할게요. 예산은 접수 끝나고 정해요.', day: -37, at: '13:15' },
    ],
  }
  for (const item of plan) {
    for (const line of talk[item.key]) await call(line.by, 'POST', eventPath(item.key, '/messages'), { content: line.text }, 201)
  }
  await lookups.kick()

  // 6. 구매: 후보 → 작성 중 → 제출 → 승인·반려 → 구매 완료 → 받음
  log('구매')
  type ItemRef = { id: string; version: number; productName: string | null }
  // 작성 중 품목은 만든 사람에게만 보인다. 그래서 읽는 사람을 넘긴다.
  async function itemsOf(key: EventKey, by: PersonKey = 'treasurer') {
    return (await call<EventPurchaseItemsResponse>(by, 'GET', eventPath(key, '/purchase-items'))).items as ItemRef[]
  }
  const byName = (list: ItemRef[], key: ProductKey) => {
    const found = list.find(item => item.productName === catalog[key].name)
    if (!found) throw new Error(`DEMO_ITEM ${key}`)
    return found
  }
  async function draft(key: EventKey, by: PersonKey, products: ProductKey[]) {
    const { candidates } = await call<PurchaseCandidatesResponse>(by, 'GET', eventPath(key, '/purchase-candidates'))
    const candidateIds = products.map(name => {
      const found = candidates.find(candidate => candidate.url.includes(catalog[name].id))
      if (!found) throw new Error(`DEMO_CANDIDATE ${name}`)
      return found.id
    })
    await call(by, 'POST', eventPath(key, '/purchase-items/drafts'), { idempotencyKey: randomUUID(), candidateIds }, 201)
  }
  async function submit(key: EventKey, by: PersonKey, products: ProductKey[]) {
    const list = await itemsOf(key, by)
    await call(by, 'POST', eventPath(key, '/purchase-items/submit'), { items: products.map(name => ({ id: byName(list, name).id, version: byName(list, name).version })) })
  }
  async function decide(key: EventKey, approved: ProductKey[], rejected: { product: ProductKey; reason: string }[] = []) {
    const list = await itemsOf(key)
    await call('treasurer', 'POST', orgPath('/purchase-review/decisions'), { decisions: [
      ...approved.map(name => ({ id: byName(list, name).id, version: byName(list, name).version, decision: 'approved' })),
      ...rejected.map(item => ({ id: byName(list, item.product).id, version: byName(list, item.product).version, decision: 'rejected', reason: item.reason })),
    ] })
  }
  async function purchased(key: EventKey, products: ProductKey[]) {
    for (const name of products) {
      const item = byName(await itemsOf(key), name)
      await call('treasurer', 'POST', orgPath(`/purchase-review/${item.id}/purchased`), { version: item.version, purchased: true })
    }
  }
  async function received(key: EventKey, by: PersonKey, products: ProductKey[]) {
    for (const name of products) {
      const item = byName(await itemsOf(key, by), name)
      await call(by, 'POST', eventPath(key, `/purchase-items/${item.id}/received`), { version: item.version, received: true })
    }
  }
  await draft('opening', 'planner', ['snack', 'cola', 'cups'])
  await submit('opening', 'planner', ['snack', 'cola', 'cups'])
  await decide('opening', ['snack', 'cola', 'cups'])
  await purchased('opening', ['snack', 'cola', 'cups'])
  await received('opening', 'planner', ['snack', 'cola', 'cups'])
  await draft('sports', 'planner', ['water2l', 'vests', 'whistle', 'arch'])
  await submit('sports', 'planner', ['water2l', 'vests', 'whistle', 'arch'])
  await decide('sports', ['water2l', 'vests', 'whistle'], [{ product: 'arch', reason: '예산을 넘어요. 대여 업체 견적과 비교한 뒤 다시 올려 주세요.' }])
  await purchased('sports', ['water2l', 'vests', 'whistle'])
  await received('sports', 'planner', ['water2l', 'vests', 'whistle'])
  await draft('snack', 'planner2', ['ramen', 'bar', 'water500', 'spoons'])
  await submit('snack', 'planner2', ['ramen', 'bar', 'water500'])
  await decide('snack', ['ramen', 'bar'])
  await purchased('snack', ['ramen'])
  await draft('festival', 'promoter', ['badges'])

  // 7. 참가 신청·입금·참석. 학번 앞자리는 학년별로 다르다.
  log('참가 신청')
  type Applicant = { name: string; studentId: string }
  async function openForm(key: EventKey, form: { capacity: number; notice: string; fee: number; memberFee: number | null }) {
    const { form: created } = await call<RegistrationResponse>('planner', 'POST', eventPath(key, '/registration'), { opensAt: null,
      closesAt: koreanTime(future, '09:00'), capacity: form.capacity, notice: form.notice, collectPhone: false, fee: form.fee, memberFee: form.memberFee }, 201)
    return created!
  }
  async function apply(code: string, applicants: Applicant[]) {
    const tokens: string[] = []
    for (const person of applicants) {
      const { token } = await call<RegistrationCreated>(null, 'POST', `/public/registration-forms/${code}/entries`,
        { name: person.name, studentId: person.studentId, phone: null, agreed: true }, 201)
      tokens.push(token)
    }
    return tokens
  }
  const entriesOf = async (key: EventKey) => (await call<RegistrationResponse>('planner', 'GET', eventPath(key, '/registration'))).registrations
  async function confirmAndCheckIn(key: EventKey, unpaid: number[], absent: number[]) {
    const list = await entriesOf(key)
    for (const [index, entry] of list.entries()) {
      if (entry.fee > 0 && !unpaid.includes(index)) await call('planner', 'POST', eventPath(key, `/registration/entries/${entry.id}/payment`), {})
      if (!absent.includes(index)) await call('planner', 'POST', eventPath(key, `/registration/entries/${entry.id}/check-in`), {})
    }
  }
  const freshmen = Array.from({ length: 42 }, (_, n) => ({ name: studentName(n), studentId: studentIdOf(Number(calendar.previous.startsOn.slice(0, 4)), n) }))
  const orientationForm = await openForm('orientation', { capacity: 60, fee: 30000, memberFee: null,
    notice: '1박 2일 · 버스는 10시에 공학관 앞에서 출발해요.\n준비물: 세면도구, 편한 옷\n문의: 학생회실' })
  await apply(orientationForm.code, freshmen)
  await confirmAndCheckIn('orientation', [17, 33], [17, 33, 40])
  const athletes = [...duesPeople.slice(0, 9), ...Array.from({ length: 17 }, (_, n) => ({ name: studentName(100 + n), studentId: studentIdOf(2023 + (n % 4), 100 + n) }))]
  const sportsForm = await openForm('sports', { capacity: 80, fee: 5000, memberFee: 0, notice: '팀은 현장에서 정해요. 운동화는 꼭 신고 오세요.\n문의: 학생회실' })
  await apply(sportsForm.code, athletes)
  // 납부자 9명(0~8)은 무료다. 미납자 가운데 셋은 입금하지 않았고, 넷은 오지 않았다.
  await confirmAndCheckIn('sports', [12, 19, 24], [5, 12, 21, 24])
  const snackers = Array.from({ length: 47 }, (_, n) => ({ name: studentName(300 + n), studentId: studentIdOf(2022 + (n % 5), 300 + n) }))
  const snackForm = await openForm('snack', { capacity: 150, fee: 0, memberFee: null, notice: '시험 기간 응원 간식이에요. 받을 때 학생증을 보여 주세요.' })
  await apply(snackForm.code, snackers)

  // 8. 예산 편성. 행사 줄의 version은 그 행사 재정의 버전(행이 없으면 0)이다.
  log('예산 편성')
  const financeVersion = async (key: EventKey) => (await call<EventFinanceResponse>('treasurer', 'GET', eventPath(key, '/finance'))).finance.version
  const savePlan = async (period: BudgetPlanResponse, incomes: [string, number][], operating: [string, number][], eventsInPeriod: [EventKey, number | null][]) =>
    call<BudgetPlanResponse>('treasurer', 'POST', orgPath(`/budget/periods/${period.period.id}/plan`), { version: period.period.version,
      name: period.period.name, startsOn: period.period.startsOn, endsOn: period.period.endsOn,
      incomes: incomes.map(([name, amount]) => ({ id: null, name, amount })), operating: operating.map(([name, amount]) => ({ id: null, name, amount })),
      events: await Promise.all(eventsInPeriod.map(async ([key, budget]) => ({ eventId: eventIds[key], version: await financeVersion(key), budget }))) })
  const previousPlan = await savePlan(previous, [['학생회비', 1_800_000], ['학교 지원금', 500_000], ['참가비 수입', 1_200_000]],
    [['회의비', 100_000], ['소모품', 150_000]], [['orientation', 3_000_000]])
  const currentPlan = await savePlan(current, [['이월금', 500_000], ['학생회비', 1_600_000], ['학교 지원금', 600_000], ['참가비 수입', 100_000]],
    [['회의비', 120_000], ['소모품', 150_000], ['홍보물', 200_000]], [['opening', 300_000], ['sports', 700_000], ['snack', 300_000], ['festival', null]])
  const lineId = (response: BudgetPlanResponse, group: 'incomes' | 'operating', name: string) => {
    const found = response[group].find(line => line.name === name)
    if (!found) throw new Error(`DEMO_LINE ${name}`)
    return found.id
  }

  // 9. 지출과 영수증
  log('지출·영수증')
  async function expense(input: { event: EventKey | null; vendor: string; description: string; amount: number; paidOn: string
    method: 'council_card' | 'transfer' | 'cash'; items?: ProductKey[]; line?: string | null; period?: BudgetPlanResponse; receipt?: string[] }) {
    const eventItems = input.event && input.items ? await itemsOf(input.event) : []
    const { expense: created } = await call<ExpenseResponse>('treasurer', 'POST', orgPath('/expenses'), { eventId: input.event ? eventIds[input.event] : null,
      vendor: input.vendor, description: input.description, amount: input.amount, paidOn: input.paidOn, method: input.method,
      payerMembershipId: treasurerMembership, note: null, itemIds: (input.items ?? []).map(name => byName(eventItems, name).id),
      budgetLineId: input.line && input.period ? lineId(input.period, 'operating', input.line) : null }, 201)
    if (input.receipt) {
      const file = receiptPdf(input.receipt)
      const slot = await call<ReceiptUploadResponse>('treasurer', 'POST', orgPath(`/expenses/${created.id}/receipts`),
        { fileName: `receipt-${input.paidOn}.pdf`, contentType: 'application/pdf', size: file.byteLength, kind: 'receipt' }, 201)
      await upload(slot.upload.url, slot.upload.headers, file)
      await call('treasurer', 'POST', orgPath(`/expenses/${created.id}/receipts/${slot.receiptId}/confirm`), {})
    }
    return created.id
  }
  const total = (keys: ProductKey[]) => keys.reduce((sum, key) => sum + catalog[key].price * catalog[key].quantity, 0)
  const orientationDay = calendar.orientation
  await expense({ event: 'orientation', vendor: '가평 청소년수련원', description: '숙박비(1박, 42명)', amount: 1_650_000, paidOn: addDays(orientationDay, -3),
    method: 'transfer', receipt: [`Store : Gapyeong Youth Center`, `Date  : ${addDays(orientationDay, -3)}`, row('Lodging 1 night x 42', 1_650_000),
      row('TOTAL (KRW)', 1_650_000), 'Paid by: bank transfer'] })
  await expense({ event: 'orientation', vendor: '한빛관광버스', description: '버스 대절(45인승 2대, 왕복)', amount: 1_100_000, paidOn: addDays(orientationDay, -2),
    method: 'transfer', receipt: [`Store : Hanbit Tour Bus`, `Date  : ${addDays(orientationDay, -2)}`, row('Bus 45 seats x 2 (round)', 1_100_000),
      row('TOTAL (KRW)', 1_100_000), 'Paid by: bank transfer'] })
  await expense({ event: 'orientation', vendor: '이마트 가평점', description: '간식·음료', amount: 186_000, paidOn: addDays(orientationDay, -1), method: 'council_card',
    receipt: [`Store : E-mart`, `Date  : ${addDays(orientationDay, -1)}`, row('Snacks and drinks', 186_000), row('TOTAL (KRW)', 186_000), 'Paid by: council card'] })
  const openingItems: ProductKey[] = ['snack', 'cola', 'cups']
  await expense({ event: 'opening', vendor: '쿠팡', description: '개강총회 다과·음료', amount: total(openingItems), paidOn: addDays(calendar.opening, -7),
    method: 'council_card', items: openingItems, receipt: [`Store : Coupang`, `Date  : ${addDays(calendar.opening, -7)}`,
      ...openingItems.map(key => row(`Item ${catalog[key].id.slice(-2)} x${catalog[key].quantity}`, catalog[key].price * catalog[key].quantity)),
      row('TOTAL (KRW)', total(openingItems)), 'Paid by: council card'] })
  const sportsItems: ProductKey[] = ['water2l', 'vests', 'whistle']
  await expense({ event: 'sports', vendor: '쿠팡', description: '체육대회 물품(물·조끼·호루라기)', amount: total(sportsItems), paidOn: addDays(calendar.sports, -10),
    method: 'council_card', items: sportsItems, receipt: [`Store : Coupang`, `Date  : ${addDays(calendar.sports, -10)}`,
      ...sportsItems.map(key => row(`Item ${catalog[key].id.slice(-2)} x${catalog[key].quantity}`, catalog[key].price * catalog[key].quantity)),
      row('TOTAL (KRW)', total(sportsItems)), 'Paid by: council card'] })
  await expense({ event: 'sports', vendor: '교내 매점', description: '현장 간식(김밥·음료)', amount: 64_000, paidOn: calendar.sports, method: 'cash',
    receipt: [`Store : Campus store`, `Date  : ${calendar.sports}`, row('Gimbap and drinks', 64_000), row('TOTAL (KRW)', 64_000), 'Paid by: cash'] })
  await expense({ event: null, vendor: '오피스디포', description: '학생회실 A4 용지·토너', amount: 82_400, paidOn: addDays(calendar.previous.startsOn, 17),
    method: 'council_card', line: '소모품', period: previousPlan, receipt: [`Store : Office Depot`, `Date  : ${addDays(calendar.previous.startsOn, 17)}`,
      row('A4 paper and toner', 82_400), row('TOTAL (KRW)', 82_400), 'Paid by: council card'] })
  await expense({ event: null, vendor: '카페 온더힐', description: '운영위원회 회의 다과', amount: 46_000, paidOn: addDays(calendar.previous.startsOn, 72),
    method: 'council_card', line: '회의비', period: previousPlan, receipt: [`Store : Cafe On the Hill`, `Date  : ${addDays(calendar.previous.startsOn, 72)}`,
      row('Meeting refreshments', 46_000), row('TOTAL (KRW)', 46_000), 'Paid by: council card'] })
  await expense({ event: null, vendor: '오피스디포', description: '학생회실 A4 용지', amount: 32_900, paidOn: addDays(calendar.current.startsOn, 9),
    method: 'council_card', line: '소모품', period: currentPlan, receipt: [`Store : Office Depot`, `Date  : ${addDays(calendar.current.startsOn, 9)}`,
      row('A4 paper', 32_900), row('TOTAL (KRW)', 32_900), 'Paid by: council card'] })
  // 영수증을 아직 올리지 않은 지출(증빙 누락 표시를 보여 준다)
  await expense({ event: null, vendor: '프린트원', description: '학술제 홍보 현수막 제작', amount: 88_000, paidOn: addDays(today, -9), method: 'transfer',
    line: '홍보물', period: currentPlan })

  // 10. 실제 수입
  log('수입')
  const income = (period: BudgetPlanResponse, description: string, amount: number, receivedOn: string, line: string) =>
    call('treasurer', 'POST', orgPath(`/budget/periods/${period.period.id}/incomes`), { description, amount, receivedOn,
      budgetLineId: lineId(period, 'incomes', line), note: null }, 201)
  await income(previousPlan, `${calendar.previous.name} 학생회비`, 1_860_000, addDays(calendar.previous.startsOn, 24), '학생회비')
  await income(previousPlan, '학교 학생활동 지원금', 500_000, addDays(calendar.previous.startsOn, 33), '학교 지원금')
  await income(currentPlan, `${calendar.current.name} 학생회비`, 1_540_000, addDays(calendar.current.startsOn, 21), '학생회비')
  await income(currentPlan, '학교 학생활동 지원금', 600_000, addDays(calendar.current.startsOn, 29), '학교 지원금')

  // 11. 시나리오 시각으로 옮긴다(행사 날짜, 신청 기간, 신청·입금·참석, 대화, 구매 처리 기록).
  log('시각 맞추기')
  await shapeTimes(db, calendar, plan, eventIds, talk)

  // 12. 정산과 마감. 정산은 받은 참가비를 그 행사가 든 기간의 수입으로 넣는다.
  log('정산·마감')
  const settle = async (key: EventKey, period: BudgetPlanResponse | null) => call('treasurer', 'POST', eventPath(key, '/finance/settle'),
    { version: await financeVersion(key), feeIncomeLineId: period ? lineId(period, 'incomes', '참가비 수입') : null })
  await settle('orientation', previousPlan)
  await settle('opening', null)
  await settle('sports', currentPlan)
  const closing = await call<BudgetPlanResponse>('treasurer', 'GET', orgPath(`/budget/periods/${previous.period.id}`))
  await call('treasurer', 'POST', orgPath(`/budget/periods/${previous.period.id}/close`), { version: closing.period.version,
    carryoverLineId: lineId(currentPlan, 'incomes', '이월금') })
  await shapeClosing(db, calendar, eventIds)

  // 13. 행사 업무. 정산한 체육대회는 모두 끝났고, 다가오는 행사에는 지연·담당자 없음이 섞여 있다.
  // 로그인 회장단 계정들에게도 소속 ID 순으로 돌아가며 맡겨 누구로 들어와도 내 업무가 비지 않게 한다. 첫째에게는 지연이 하나 간다.
  // 로그인 회장단이 없으면 그 업무는 넣지 않는다.
  log('업무')
  const loginLeaders = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.organizationId, org),
    eq(memberships.departmentId, departmentIds.leadership), sql`${memberships.userId} NOT LIKE ${`${DEMO_USER_PREFIX}%`}`))
    .orderBy(asc(memberships.id))
  const taskPlan: { event: EventKey; title: string; description?: string; department: DepartmentKey; assignee: PersonKey | 'login' | null;
    due: string; status: TaskStatus }[] = [
    { event: 'sports', title: '경기장 대관 신청', department: 'leadership', assignee: 'vice', due: addDays(calendar.sports, -20), status: 'done' },
    { event: 'sports', title: '팀 조끼·호루라기 준비', department: 'planning', assignee: 'planner', due: addDays(calendar.sports, -3), status: 'done' },
    { event: 'sports', title: '경기 결과 공지', department: 'promotion', assignee: 'promoter', due: addDays(calendar.sports, 1), status: 'done' },
    { event: 'snack', title: '간식 수량 확정', description: '신청 인원 기준 1인 1세트, 여유분 10%', department: 'finance', assignee: 'treasurer',
      due: addDays(calendar.today, -3), status: 'done' },
    { event: 'snack', title: '배부 장소 섭외', description: '공학관 1층 로비 사용 신청서 내기', department: 'planning', assignee: 'planner',
      due: addDays(calendar.today, 2), status: 'doing' },
    { event: 'snack', title: '학생처 공문 보내기', department: 'leadership', assignee: 'login', due: addDays(calendar.today, -1), status: 'doing' },
    { event: 'snack', title: '현장 인력 배치', department: 'planning', assignee: null, due: addDays(calendar.snack, -1), status: 'todo' },
    { event: 'snack', title: '배부 후기 공유', department: 'promotion', assignee: 'promoter', due: addDays(calendar.snack, 3), status: 'todo' },
    { event: 'festival', title: '장소 대관 신청', department: 'leadership', assignee: 'vice', due: addDays(calendar.today, -10), status: 'done' },
    { event: 'festival', title: '발표팀 모집 공지', description: '학년별 단톡방과 인스타그램에 올리기', department: 'promotion', assignee: 'promoter',
      due: addDays(calendar.today, -5), status: 'done' },
    { event: 'festival', title: '포스터 디자인', description: '시안 두 개를 만들어 회의에서 고르기', department: 'promotion', assignee: 'promoter',
      due: addDays(calendar.today, 5), status: 'doing' },
    { event: 'festival', title: '심사위원 섭외', description: '교수님 두 분, 졸업생 한 분', department: 'planning', assignee: 'planner',
      due: addDays(calendar.today, -2), status: 'doing' },
    { event: 'festival', title: '학교 행사 승인 신청', department: 'leadership', assignee: 'login', due: addDays(calendar.today, 3), status: 'todo' },
    { event: 'festival', title: '시상품 구매 요청', department: 'planning', assignee: 'planner2', due: addDays(calendar.today, 10), status: 'todo' },
    { event: 'festival', title: '발표 순서표 확정', department: 'planning', assignee: null, due: addDays(calendar.festival, -7), status: 'todo' },
    { event: 'festival', title: '리허설 진행', department: 'planning', assignee: 'planner3', due: addDays(calendar.festival, -1), status: 'todo' },
    { event: 'festival', title: '결과 보고서 작성', department: 'planning', assignee: null, due: addDays(calendar.festival, 7), status: 'todo' },
  ]
  let loginTurn = 0
  for (const item of taskPlan) {
    if (item.assignee === 'login' && !loginLeaders.length) continue
    const assigneeMembershipId = item.assignee === null ? null
      : item.assignee === 'login' ? loginLeaders[loginTurn++ % loginLeaders.length]!.id : `${userIdOf(item.assignee)}-membership`
    const { task } = await call<TaskResponse>('planner', 'POST', eventPath(item.event, '/tasks'), { title: item.title, description: item.description ?? null,
      departmentId: departmentIds[item.department], assigneeMembershipId, dueOn: item.due }, 201)
    if (item.status !== 'todo') await call('planner', 'POST', eventPath(item.event, `/tasks/${task.id}/status`), { version: task.version, status: item.status })
  }
  await shapeTasks(db, calendar)

  // 14. 행사 완료(M5a). 정산한 지난 행사 둘을 회장단(부회장)이 완료한다. 체육대회는 시연에서 완료해 보도록 남긴다.
  log('행사 완료')
  const { events: listed } = await call<EventsResponse>('vice', 'GET', orgPath('/events'))
  for (const key of ['orientation', 'opening'] as const) {
    const target = listed.find(item => item.id === eventIds[key])!
    await call('vice', 'POST', eventPath(key, '/completion'), { version: target.version })
  }
  await shapeCompletion(db, calendar, eventIds)
  log('완료')
  return { eventIds, periods: { previous: previous.period.id, current: current.period.id } }
}

// 넣은 뒤 화면에 보이는 시각을 시나리오에 맞춘다. 순서는 넣은 순서를 그대로 지킨다.
async function shapeTimes(db: Db, calendar: Calendar, plan: readonly { key: string; day: string; start: string; endDay: string; end: string }[],
  eventIds: Record<string, string>, talk: Record<string, { day: number; at: string }[]>) {
  for (const item of plan) {
    const id = eventIds[item.key]!
    // 만든 때는 행사 32일 전이고, 시연 기준 날짜 사흘 전보다 늦지 않다.
    const createdOn = [addDays(item.day, -32), addDays(calendar.today, -3)].sort()[0]!
    await db.update(events).set({ startsAt: kst(item.day, item.start), endsAt: kst(item.endDay, item.end), createdAt: kst(createdOn, '10:00') })
      .where(eq(events.id, id))
    // 대화: 넣은 순서대로 시나리오 시각을 준다.
    const [room] = await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.eventId, id))
    const rows = await db.select({ id: messages.id }).from(messages).where(eq(messages.chatRoomId, room!.id)).orderBy(asc(messages.createdAt), asc(messages.id))
    for (const [index, message] of rows.entries()) {
      const line = talk[item.key]![index]!
      await db.update(messages).set({ createdAt: kst(addDays(item.day, line.day), line.at) }).where(eq(messages.id, message.id))
    }
    // 구매 처리 기록: 대화 다음 날부터 하루에 한 단계씩
    const firstTalk = talk[item.key]![0]!
    const items = await db.select({ id: purchaseItems.id }).from(purchaseItems).where(eq(purchaseItems.eventId, id))
    for (const purchase of items) {
      const history = await db.select({ id: purchaseItemEvents.id }).from(purchaseItemEvents).where(eq(purchaseItemEvents.itemId, purchase.id))
        .orderBy(asc(purchaseItemEvents.createdAt), asc(purchaseItemEvents.id))
      const start = kst(addDays(item.day, firstTalk.day), '16:00')
      for (const [index, entry] of history.entries()) {
        await db.update(purchaseItemEvents).set({ createdAt: new Date(start.getTime() + index * 20 * 3_600_000) }).where(eq(purchaseItemEvents.id, entry.id))
      }
      await db.update(purchaseItems).set({ createdAt: start }).where(eq(purchaseItems.id, purchase.id))
    }
    // 참가 신청: 신청 기간과 신청·입금·참석 시각
    const [form] = await db.select({ id: registrationForms.id }).from(registrationForms).where(eq(registrationForms.eventId, id))
    if (!form) continue
    const opens = kst(addDays(item.day, item.key === 'snack' ? -13 : -15), '09:00')
    const closes = item.key === 'snack' ? kst(item.day, '11:00') : kst(addDays(item.day, -2), '18:00')
    await db.update(registrationForms).set({ opensAt: opens, closesAt: closes, createdAt: new Date(opens.getTime() - 3_600_000) })
      .where(eq(registrationForms.id, form.id))
    const entries = await db.select({ id: registrations.id, paidAt: registrations.paidAt, checkedInAt: registrations.checkedInAt }).from(registrations)
      .where(eq(registrations.formId, form.id)).orderBy(asc(registrations.createdAt), asc(registrations.id))
    // 오늘보다 늦은 신청 시각은 두지 않는다(받는 중인 신청).
    const lastApplied = Math.min(closes.getTime(), kst(calendar.today, '11:30').getTime())
    const span = Math.max(1, lastApplied - opens.getTime() - 3_600_000)
    for (const [index, entry] of entries.entries()) {
      const appliedAt = new Date(opens.getTime() + 600_000 + Math.floor(span * index / Math.max(1, entries.length)))
      const paidAt = entry.paidAt ? new Date(Math.min(appliedAt.getTime() + 26 * 3_600_000, closes.getTime() - 3_600_000)) : null
      const checkedInAt = entry.checkedInAt ? new Date(kst(item.day, item.start).getTime() - 30 * 60_000 + index * 50_000) : null
      await db.update(registrations).set({ createdAt: appliedAt, paidAt, checkedInAt }).where(eq(registrations.id, entry.id))
    }
  }
  // 구매 품목의 결정·구매·수령 시각은 맞춘 처리 기록의 시각을 따른다.
  const org = DEMO_ORGANIZATION_ID
  for (const [column, actions] of [['decided_at', ['approved', 'rejected']], ['purchased_at', ['purchased']], ['received_at', ['received']]] as const) {
    await db.execute(sql`UPDATE purchase_items p SET ${sql.identifier(column)} = e.created_at FROM purchase_item_events e
      WHERE e.item_id = p.id AND p.organization_id = ${org} AND e.action IN (${sql.join(actions.map(action => sql`${action}`), sql`, `)})`)
  }
  await db.execute(sql`UPDATE purchase_items SET updated_at = greatest(created_at, coalesce(decided_at, created_at), coalesce(purchased_at, created_at),
    coalesce(received_at, created_at)) WHERE organization_id = ${org}`)
  await db.execute(sql`UPDATE registration_forms SET updated_at = created_at WHERE organization_id = ${org}`)
  // 구매 후보: 공유 시각은 그 링크를 올린 대화 시각, 후보와 상품 조회 시각은 첫 공유 시각, 요청서 초안·제출 기록은 품목 시각을 따른다.
  await db.execute(sql`UPDATE purchase_candidate_shares s SET created_at = m.created_at FROM messages m WHERE m.id = s.message_id AND s.organization_id = ${org}`)
  await db.execute(sql`UPDATE purchase_candidates c SET created_at = first.at FROM (SELECT candidate_id, min(created_at) AS at FROM purchase_candidate_shares
    WHERE organization_id = ${org} GROUP BY candidate_id) first WHERE first.candidate_id = c.id`)
  await db.execute(sql`UPDATE coupang_products p SET fetched_at = first.at FROM (SELECT product_id, min(created_at) AS at FROM purchase_candidates
    WHERE organization_id = ${org} GROUP BY product_id) first WHERE first.product_id = p.id AND p.id LIKE ${`${PRODUCT_PREFIX}%`}`)
  await db.execute(sql`UPDATE purchase_items SET product_fetched_at = created_at WHERE organization_id = ${org}`)
  await db.execute(sql`UPDATE purchase_generations g SET created_at = first.at FROM (SELECT generation_id, min(created_at) AS at FROM purchase_items
    WHERE organization_id = ${org} AND generation_id IS NOT NULL GROUP BY generation_id) first WHERE first.generation_id = g.id`)
  await db.execute(sql`UPDATE purchase_submissions s SET submitted_at = e.at FROM (SELECT i.submission_id, min(ev.created_at) AS at FROM purchase_items i
    JOIN purchase_item_events ev ON ev.item_id = i.id AND ev.action = 'submitted' WHERE i.organization_id = ${org} AND i.submission_id IS NOT NULL
    GROUP BY i.submission_id) e WHERE e.submission_id = s.id`)
  await db.execute(sql`UPDATE expenses SET created_at = (paid_on::timestamp + interval '18 hours') AT TIME ZONE 'Asia/Seoul',
    updated_at = (paid_on::timestamp + interval '18 hours') AT TIME ZONE 'Asia/Seoul' WHERE organization_id = ${org}`)
  await db.execute(sql`UPDATE incomes SET created_at = (received_on::timestamp + interval '10 hours') AT TIME ZONE 'Asia/Seoul',
    updated_at = (received_on::timestamp + interval '10 hours') AT TIME ZONE 'Asia/Seoul' WHERE organization_id = ${org}`)
  // 예산 편성 기록(기간 만들기·편성 저장, 행사 예산 정하기)은 학기 시작 닷새 전이다.
  const planned = { previous: kst(addDays(calendar.previous.startsOn, -5), '14:00'), current: kst(addDays(calendar.current.startsOn, -5), '14:00') }
  const orientationId = eventIds.orientation!
  await db.execute(sql`UPDATE event_finance_events SET created_at = CASE WHEN event_id = ${orientationId} THEN ${planned.previous.toISOString()}::timestamptz
    ELSE ${planned.current.toISOString()}::timestamptz END WHERE organization_id = ${org} AND action = 'budget_set'`)
  await db.execute(sql`UPDATE event_finances SET created_at = CASE WHEN event_id = ${orientationId} THEN ${planned.previous.toISOString()}::timestamptz
    ELSE ${planned.current.toISOString()}::timestamptz END, updated_at = CASE WHEN event_id = ${orientationId} THEN ${planned.previous.toISOString()}::timestamptz
    ELSE ${planned.current.toISOString()}::timestamptz END WHERE organization_id = ${org}`)
  for (const [name, at] of [[calendar.previous.name, planned.previous], [calendar.current.name, planned.current]] as const) {
    await db.update(budgetPeriods).set({ createdAt: at, updatedAt: at }).where(and(eq(budgetPeriods.organizationId, org), eq(budgetPeriods.name, name)))
  }
  const accountAt = kst(addDays(calendar.current.startsOn, 4), '14:00')
  await db.execute(sql`UPDATE fee_accounts SET created_at = ${accountAt.toISOString()}::timestamptz, updated_at = ${accountAt.toISOString()}::timestamptz
    WHERE organization_id = ${org}`)
  // 지출·수입 처리 기록은 결제일·받은 날 저녁으로
  await db.execute(sql`UPDATE expense_events SET created_at = (ordered.paid_on::timestamp + interval '18 hours' + ordered.step * interval '1 minute') AT TIME ZONE 'Asia/Seoul'
    FROM (SELECT e.id, x.paid_on, row_number() OVER (PARTITION BY e.expense_id ORDER BY e.created_at, e.id) AS step
      FROM expense_events e JOIN expenses x ON x.id = e.expense_id WHERE e.organization_id = ${DEMO_ORGANIZATION_ID}) ordered WHERE expense_events.id = ordered.id`)
  await db.execute(sql`UPDATE expense_receipts r SET created_at = (x.paid_on::timestamp + interval '18 hours') AT TIME ZONE 'Asia/Seoul',
    confirmed_at = (x.paid_on::timestamp + interval '18 hours 1 minute') AT TIME ZONE 'Asia/Seoul'
    FROM expenses x WHERE x.id = r.expense_id AND r.organization_id = ${DEMO_ORGANIZATION_ID}`)
  await db.execute(sql`UPDATE income_events SET created_at = (i.received_on::timestamp + interval '10 hours') AT TIME ZONE 'Asia/Seoul'
    FROM incomes i WHERE i.id = income_events.income_id AND income_events.organization_id = ${DEMO_ORGANIZATION_ID}`)
  await db.update(feeAccountEvents).set({ createdAt: kst(addDays(calendar.current.startsOn, 4), '14:00') })
    .where(eq(feeAccountEvents.organizationId, DEMO_ORGANIZATION_ID))
  await db.execute(sql`UPDATE dues_rosters SET uploaded_at = ${kst(addDays(calendar.current.startsOn, 21), '15:00').toISOString()}::timestamptz
    WHERE organization_id = ${DEMO_ORGANIZATION_ID}`)
  await db.update(budgetPeriodEvents).set({ createdAt: kst(addDays(calendar.previous.startsOn, -5), '14:00') })
    .where(and(eq(budgetPeriodEvents.organizationId, DEMO_ORGANIZATION_ID), inArray(budgetPeriodEvents.periodId,
      db.select({ id: budgetPeriods.id }).from(budgetPeriods).where(eq(budgetPeriods.name, calendar.previous.name)))))
  await db.update(budgetPeriodEvents).set({ createdAt: kst(addDays(calendar.current.startsOn, -5), '14:00') })
    .where(and(eq(budgetPeriodEvents.organizationId, DEMO_ORGANIZATION_ID), inArray(budgetPeriodEvents.periodId,
      db.select({ id: budgetPeriods.id }).from(budgetPeriods).where(eq(budgetPeriods.name, calendar.current.name)))))
}

// 정산·마감 처리 시각: 정산은 행사 사흘 뒤, 1학기 마감과 이월은 2학기 시작 이틀 뒤다.
async function shapeClosing(db: Db, calendar: Calendar, eventIds: Record<string, string>) {
  const settledOn: Record<string, string> = { orientation: addDays(calendar.orientation, 4), opening: addDays(calendar.opening, 3),
    sports: addDays(calendar.sports, 3) }
  for (const [key, day] of Object.entries(settledOn)) {
    const at = kst(day, '15:00')
    await db.update(eventFinances).set({ settledAt: at }).where(eq(eventFinances.eventId, eventIds[key]!))
    await db.update(eventFinanceEvents).set({ createdAt: at }).where(and(eq(eventFinanceEvents.eventId, eventIds[key]!), eq(eventFinanceEvents.action, 'settled')))
    await db.update(incomeEvents).set({ createdAt: at }).where(inArray(incomeEvents.incomeId,
      db.select({ id: incomes.id }).from(incomes).where(eq(incomes.eventId, eventIds[key]!))))
    await db.update(incomes).set({ createdAt: at, updatedAt: at }).where(eq(incomes.eventId, eventIds[key]!))
    await db.update(eventFinances).set({ updatedAt: at }).where(eq(eventFinances.eventId, eventIds[key]!))
  }
  const closedAt = kst(addDays(calendar.current.startsOn, 2), '10:00')
  await db.update(budgetPeriods).set({ closedAt, updatedAt: closedAt }).where(and(eq(budgetPeriods.organizationId, DEMO_ORGANIZATION_ID),
    eq(budgetPeriods.name, calendar.previous.name)))
  await db.update(incomes).set({ createdAt: closedAt, updatedAt: closedAt }).where(and(eq(incomes.organizationId, DEMO_ORGANIZATION_ID),
    isNotNull(incomes.carriedFromPeriodId)))
  await db.update(budgetPeriodEvents).set({ createdAt: closedAt }).where(and(eq(budgetPeriodEvents.organizationId, DEMO_ORGANIZATION_ID),
    eq(budgetPeriodEvents.action, 'closed')))
  await db.update(incomeEvents).set({ createdAt: closedAt }).where(inArray(incomeEvents.incomeId,
    db.select({ id: incomes.id }).from(incomes).where(and(eq(incomes.organizationId, DEMO_ORGANIZATION_ID), isNotNull(incomes.carriedFromPeriodId)))))
}

// 완료 시각: 정산 다음 날 10시다(정산은 새내기 배움터가 행사 나흘 뒤, 개강총회가 사흘 뒤 15시).
async function shapeCompletion(db: Db, calendar: Calendar, eventIds: Record<string, string>) {
  const completedOn: Record<string, string> = { orientation: addDays(calendar.orientation, 5), opening: addDays(calendar.opening, 4) }
  for (const [key, day] of Object.entries(completedOn)) {
    await db.update(events).set({ completedAt: kst(day, '10:00') }).where(eq(events.id, eventIds[key]!))
  }
}

// 내 신청 화면의 참석 확인 코드와 같은 값(토큰의 SHA-256). 시연 안내에 쓴다.
export const checkInCodeOf = (token: string) => createHash('sha256').update(token).digest('hex')

// 업무의 만든 때·완료한 때·처리 기록을 시나리오 시각으로 옮긴다. 만든 때는 행사를 만든 한 시간 뒤다.
// 완료한 때는 마감일 17시이고, 시연 기준 날짜 9시보다 늦지 않다. 진행 중으로 바꾼 때는 만든 다음 날이다.
async function shapeTasks(db: Db, calendar: Calendar) {
  const org = DEMO_ORGANIZATION_ID
  const morning = kst(calendar.today, '09:00').toISOString()
  await db.execute(sql`UPDATE tasks t SET created_at = e.created_at + interval '1 hour' FROM events e WHERE e.id = t.event_id AND t.organization_id = ${org}`)
  await db.execute(sql`UPDATE tasks SET completed_at = greatest(created_at + interval '1 hour',
    least((due_on::timestamp + interval '17 hours') AT TIME ZONE 'Asia/Seoul', ${morning}::timestamptz))
    WHERE organization_id = ${org} AND status = 'done'`)
  await db.execute(sql`UPDATE task_events ev SET created_at = CASE WHEN ev.action = 'created' THEN t.created_at
    WHEN ev.changes -> 'status' ->> 'to' = 'done' THEN t.completed_at ELSE least(t.created_at + interval '1 day', ${morning}::timestamptz) END
    FROM tasks t WHERE t.id = ev.task_id AND ev.organization_id = ${org}`)
}
