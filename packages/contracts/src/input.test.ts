import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { z } from 'zod'
import { codePoints, isStrictObject, text, token } from './input.js'
import { CreateEventSchema, EVENT_NAME_MAX } from './events.js'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX } from './chat.js'
import { DeliveryLookupSchema, RegisterShipmentSchema, UnlinkShipmentSchema } from './deliveries.js'
import { INVITE_CODE_MAX, InviteCodeSchema, JoinOrganizationSchema } from './invites.js'
import { CREATE_DEPARTMENTS_MAX, DEPARTMENT_NAME_MAX, MEMBER_TITLE_MAX, ORGANIZATION_NAME_MAX, AssignDepartmentSchema, CreateDepartmentSchema,
  CreateOrganizationSchema, DeleteDepartmentSchema, UpdateDepartmentSchema, UpdateMemberTitleSchema } from './organizations.js'
import { PURCHASE_BATCH_MAX, PURCHASE_INTEGER_MAX, PURCHASE_LINKS_MAX, PURCHASE_NOTE_MAX, PURCHASE_OPTION_MAX, PURCHASE_PACKAGING_MAX,
  PURCHASE_PRODUCT_NAME_MAX, PURCHASE_REASON_MAX, ChangeNeededBySchema, CreatePurchaseDraftsSchema, DecidePurchaseItemsSchema,
  GeneratedPurchaseItemSchema, PurchaseItemVersionSchema, PurchasePurchasedSchema, PurchaseReceivedSchema, SubmitPurchaseItemsSchema,
  UpdatePurchaseItemSchema } from './purchases.js'

// 홀로 쓰인 서러게이트까지 만들도록 UTF-16 코드 단위를 직접 뽑는다.
const anyText = fc.string({ unit: fc.integer({ min: 0, max: 0xffff }).map(n => String.fromCharCode(n)), maxLength: 120 })

test('text: 앞뒤 공백 제거 후 1..max 코드 포인트, NUL·홀로 쓰인 서러게이트 없음일 때만 통과한다', () => {
  const schema = text(50)
  fc.assert(fc.property(anyText, value => {
    const trimmed = value.trim()
    const expected = trimmed.length > 0 && codePoints(trimmed) <= 50 && !/[\u0000\uD800-\uDFFF]/u.test(value)
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, trimmed)
  }))
})

test('token: 원문 max 이하, 제어 문자 없음, 공백 제거 후 1자 이상일 때만 통과한다', () => {
  const schema = token(40)
  fc.assert(fc.property(anyText, value => {
    const expected = value.length <= 40 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value) && value.trim().length > 0
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, value.trim())
  }))
})

test('문자열이 아닌 값은 거부한다', () => {
  for (const value of [null, undefined, 1, true, [], {}]) {
    assert.equal(text(10).safeParse(value).success, false)
    assert.equal(token(10).safeParse(value).success, false)
  }
})

test('행사 이름: 이모지도 코드 포인트로 세어 100개까지 통과한다', () => {
  assert.equal(CreateEventSchema.safeParse({ name: '😀'.repeat(EVENT_NAME_MAX) }).success, true)
  assert.equal(CreateEventSchema.safeParse({ name: '😀'.repeat(EVENT_NAME_MAX + 1) }).success, false)
  assert.deepEqual(CreateEventSchema.parse({ name: '  축제  ' }), { name: '축제' })
})

test('채팅 본문: 2000 코드 포인트까지, 줄바꿈은 허용한다', () => {
  assert.equal(CreateMessageSchema.safeParse({ content: '😀'.repeat(MESSAGE_CONTENT_MAX) }).success, true)
  assert.equal(CreateMessageSchema.safeParse({ content: 'a'.repeat(MESSAGE_CONTENT_MAX + 1) }).success, false)
  assert.equal(CreateMessageSchema.safeParse({ content: '😀'.repeat(MESSAGE_CONTENT_MAX + 1) }).success, false)
  assert.equal(CreateMessageSchema.parse({ content: '첫 줄\n둘째 줄' }).content, '첫 줄\n둘째 줄')
})

test('모르는 키가 하나라도 있으면 거부한다', () => {
  const key = fc.string({ minLength: 1, maxLength: 20 })
  fc.assert(fc.property(key.filter(k => k !== 'name'), k => !CreateEventSchema.safeParse(JSON.parse(JSON.stringify({ name: 'a', [k]: 1 }))).success))
  fc.assert(fc.property(key.filter(k => k !== 'content'), k => !CreateMessageSchema.safeParse(JSON.parse(JSON.stringify({ content: 'a', [k]: 1 }))).success))
})

test('배송 스키마는 기존 수동 검사와 같은 규칙을 지킨다', () => {
  assert.deepEqual(DeliveryLookupSchema.parse({ carrierId: ' kr.cjlogistics ', trackingNumber: '1234-5' }), { carrierId: 'kr.cjlogistics', trackingNumber: '1234-5' })
  for (const body of [{ carrierId: 'kr cj', trackingNumber: '1' }, { carrierId: 'kr.cj', trackingNumber: '1 2' }, { carrierId: 'kr.cj', trackingNumber: '1', extra: 1 }, { carrierId: 'kr.cj' }]) {
    assert.equal(DeliveryLookupSchema.safeParse(body).success, false)
  }
  const register = { carrierId: 'kr.cj', trackingNumber: '1', purchaseItemIds: ['b', 'a'], idempotencyKey: 'k' }
  assert.deepEqual(RegisterShipmentSchema.parse(register).purchaseItemIds, ['a', 'b'])
  for (const ids of [[], ['a', 'a'], Array.from({ length: 51 }, (_, i) => `i${i}`), ['a\u0001']]) {
    assert.equal(RegisterShipmentSchema.safeParse({ ...register, purchaseItemIds: ids }).success, false)
  }
  assert.equal(RegisterShipmentSchema.safeParse({ ...register, idempotencyKey: 'k'.repeat(129) }).success, false)
  assert.deepEqual(UnlinkShipmentSchema.parse({ linkIds: ['z', 'y'] }), { linkIds: ['y', 'z'] })
  assert.equal(UnlinkShipmentSchema.safeParse({ linkIds: ['y'], extra: 1 }).success, false)
})

test('isStrictObject: 모르는 키를 거부하는 z.strictObject만 참이다', () => {
  assert.equal(isStrictObject(z.strictObject({ a: z.string() })), true)
  for (const schema of [z.object({ a: z.string() }), z.looseObject({ a: z.string() }), z.string(), null, {}]) {
    assert.equal(isStrictObject(schema), false)
  }
})

test('초대 코드: 공백·하이픈·소문자를 정규화하고, 빈 값·제어 문자·상한 초과는 거부한다', () => {
  assert.equal(InviteCodeSchema.parse(' abcd-2345 '), 'ABCD2345')
  assert.equal(InviteCodeSchema.parse('abcd 2345'), 'ABCD2345')
  for (const value of ['', '   ', '-', 'A'.repeat(INVITE_CODE_MAX + 1), '😀'.repeat(INVITE_CODE_MAX + 1), 'ABCD\u00002345', '\uD800ABCD', 'AB\tCD', 1, null]) {
    assert.equal(InviteCodeSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  assert.deepEqual(JoinOrganizationSchema.parse({ code: 'abcd2345' }), { code: 'ABCD2345' })
  assert.equal(JoinOrganizationSchema.safeParse({ code: 'ABCD2345', extra: 1 }).success, false)
  assert.equal(JoinOrganizationSchema.safeParse({}).success, false)
  assert.equal(isStrictObject(JoinOrganizationSchema), true)
})

test('학생회 만들기: 이름·부서를 정규화하고, 상한·중복·회장단 이름은 거부한다', () => {
  const body = { name: ' 제12대 학생회 ', departments: [{ name: ' 총무부 ', handlesFinance: true }, { name: '기획부', handlesFinance: false }] }
  assert.deepEqual(CreateOrganizationSchema.parse(body), { name: '제12대 학생회', departments: [{ name: '총무부', handlesFinance: true }, { name: '기획부', handlesFinance: false }] })
  assert.equal(CreateOrganizationSchema.safeParse({ ...body, departments: [] }).success, true)
  assert.equal(CreateOrganizationSchema.safeParse({ ...body, name: '😀'.repeat(ORGANIZATION_NAME_MAX) }).success, true)
  const bad: unknown[] = [
    { ...body, name: '😀'.repeat(ORGANIZATION_NAME_MAX + 1) }, { ...body, name: '   ' }, { ...body, name: 'a\u0000' }, { ...body, name: '\uD800' },
    { ...body, departments: [{ name: '기획부', handlesFinance: false }, { name: ' 기획부', handlesFinance: false }] },
    { ...body, departments: [{ name: '회장단', handlesFinance: false }] },
    { ...body, departments: [{ name: '가'.repeat(DEPARTMENT_NAME_MAX + 1), handlesFinance: false }] },
    { ...body, departments: Array.from({ length: CREATE_DEPARTMENTS_MAX + 1 }, (_, i) => ({ name: `부서${i}`, handlesFinance: false })) },
    { ...body, departments: [{ name: '기획부' }] }, { ...body, extra: 1 }, { name: '학생회' },
  ]
  for (const value of bad) assert.equal(CreateOrganizationSchema.safeParse(value).success, false, JSON.stringify(value))
  assert.equal(isStrictObject(CreateOrganizationSchema), true)
})

test('부서·배정·직책 스키마: 정규화, null 허용 범위, 상한, 모르는 키', () => {
  assert.deepEqual(CreateDepartmentSchema.parse({ name: ' 홍보부 ' }), { name: '홍보부' })
  assert.deepEqual(UpdateDepartmentSchema.parse({ name: '사무국', handlesFinance: true }), { name: '사무국', handlesFinance: true })
  assert.deepEqual(DeleteDepartmentSchema.parse({}), {})
  assert.deepEqual(AssignDepartmentSchema.parse({ departmentId: null }), { departmentId: null })
  assert.deepEqual(AssignDepartmentSchema.parse({ departmentId: ' d1 ' }), { departmentId: 'd1' })
  assert.deepEqual(UpdateMemberTitleSchema.parse({ title: ' 국장 ' }), { title: '국장' })
  assert.deepEqual(UpdateMemberTitleSchema.parse({ title: null }), { title: null })
  assert.equal(UpdateMemberTitleSchema.safeParse({ title: '😀'.repeat(MEMBER_TITLE_MAX) }).success, true)
  const cases: [{ safeParse: (value: unknown) => { success: boolean } }, unknown][] = [
    [CreateDepartmentSchema, { name: '가'.repeat(DEPARTMENT_NAME_MAX + 1) }], [CreateDepartmentSchema, { name: ' ' }], [CreateDepartmentSchema, {}],
    [CreateDepartmentSchema, { name: '홍보부', extra: 1 }],
    [UpdateDepartmentSchema, { name: '사무국' }], [UpdateDepartmentSchema, { name: '사무국', handlesFinance: 'yes' }],
    [DeleteDepartmentSchema, { id: 'd1' }],
    [AssignDepartmentSchema, {}], [AssignDepartmentSchema, { departmentId: '' }], [AssignDepartmentSchema, { departmentId: 'd'.repeat(65) }],
    [AssignDepartmentSchema, { departmentId: 'd\u0001' }],
    [UpdateMemberTitleSchema, { title: '' }], [UpdateMemberTitleSchema, { title: '😀'.repeat(MEMBER_TITLE_MAX + 1) }],
    [UpdateMemberTitleSchema, { title: '\uD800' }], [UpdateMemberTitleSchema, {}],
  ]
  for (const [schema, value] of cases) assert.equal(schema.safeParse(value).success, false, JSON.stringify(value))
  for (const schema of [CreateDepartmentSchema, UpdateDepartmentSchema, DeleteDepartmentSchema, AssignDepartmentSchema, UpdateMemberTitleSchema]) {
    assert.equal(isStrictObject(schema), true)
  }
})

test('구매 담기: 키와 링크 1~5개만 받고, 모르는 키·제어 문자는 거부한다', () => {
  const link = 'https://www.coupang.com/vp/products/1'
  assert.deepEqual(CreatePurchaseDraftsSchema.parse({ idempotencyKey: ' k ', links: [` ${link} `] }), { idempotencyKey: 'k', links: [link] })
  for (const body of [{}, { idempotencyKey: 'k' }, { links: [link] }, { idempotencyKey: ' ', links: [link] },
    { idempotencyKey: 'k'.repeat(129), links: [link] }, { idempotencyKey: 'k', links: [] },
    { idempotencyKey: 'k', links: Array(PURCHASE_LINKS_MAX + 1).fill(link) }, { idempotencyKey: 'k', links: [`${link}\u0000`] },
    { idempotencyKey: 'k', links: [link], requesterId: 'f' }]) {
    assert.equal(CreatePurchaseDraftsSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('작성 중 품목 수정: 버전과 바꿀 칸 하나 이상, 칸마다 상한과 정수 범위', () => {
  assert.deepEqual(UpdatePurchaseItemSchema.parse({ version: 1, note: '  계주 바통  ', selectedOption: null }),
    { version: 1, note: '계주 바통', selectedOption: null })
  assert.equal(UpdatePurchaseItemSchema.safeParse({ version: 1, note: '😀'.repeat(PURCHASE_NOTE_MAX) }).success, true)
  assert.equal(UpdatePurchaseItemSchema.safeParse({ version: 1, estimatedUnitPrice: PURCHASE_INTEGER_MAX }).success, true)
  for (const body of [{ version: 1 }, { note: 'a' }, { version: 0, note: 'a' }, { version: 1.5, note: 'a' },
    { version: 1, note: '😀'.repeat(PURCHASE_NOTE_MAX + 1) }, { version: 1, note: '  ' }, { version: 1, note: 'a\u0000' }, { version: 1, note: '\uD800' },
    { version: 1, productName: 'a'.repeat(PURCHASE_PRODUCT_NAME_MAX + 1) }, { version: 1, selectedOption: 'a'.repeat(PURCHASE_OPTION_MAX + 1) },
    { version: 1, packagingUnit: 'a'.repeat(PURCHASE_PACKAGING_MAX + 1) }, { version: 1, quantity: 0 }, { version: 1, quantity: 2.5 },
    { version: 1, estimatedUnitPrice: -1 }, { version: 1, estimatedUnitPrice: PURCHASE_INTEGER_MAX + 1 }, { version: 1, optionRequired: 'yes' },
    { version: 1, neededBy: '2026-10-10' }, { version: 1, status: 'approved' }]) {
    assert.equal(UpdatePurchaseItemSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('일괄 처리: 1~50개, 같은 품목 두 번 금지, 받을 날짜는 실제 날짜나 null', () => {
  const ref = (n: number) => ({ id: `item-${n}`, version: 1 })
  assert.equal(SubmitPurchaseItemsSchema.safeParse({ items: [ref(1), ref(2)] }).success, true)
  for (const items of [[], Array.from({ length: PURCHASE_BATCH_MAX + 1 }, (_, n) => ref(n)), [ref(1), ref(1)], [{ id: 'item-1' }],
    [{ ...ref(1), extra: true }], [{ id: 'x'.repeat(65), version: 1 }], [{ id: '\u0001', version: 1 }]]) {
    assert.equal(SubmitPurchaseItemsSchema.safeParse({ items }).success, false, JSON.stringify(items).slice(0, 60))
  }
  for (const neededBy of [null, '2026-10-20', '2028-02-29']) {
    assert.equal(ChangeNeededBySchema.safeParse({ items: [ref(1)], neededBy }).success, true, String(neededBy))
  }
  for (const neededBy of ['2026-02-30', '2027-02-29', '2026-13-01', '0000-01-01', '2026-1-1', '', ' 2026-10-20', undefined]) {
    assert.equal(ChangeNeededBySchema.safeParse({ items: [ref(1)], neededBy }).success, false, String(neededBy))
  }
  assert.equal(PurchaseItemVersionSchema.safeParse({ version: 1, extra: 1 }).success, false)
  assert.equal(PurchaseReceivedSchema.safeParse({ version: 1, received: true }).success, true)
  assert.equal(PurchaseReceivedSchema.safeParse({ version: 1, received: 'true' }).success, false)
  assert.equal(PurchasePurchasedSchema.safeParse({ version: 1 }).success, false)
})

test('결정: 승인은 사유를 받지 않고, 반려는 500자 이내 사유가 있어야 한다', () => {
  const parsed = DecidePurchaseItemsSchema.parse({ decisions: [{ id: 'a', version: 1, decision: 'approved' },
    { id: 'b', version: 2, decision: 'rejected', reason: ' 규격 확인 ' }] })
  assert.deepEqual(parsed.decisions[1], { id: 'b', version: 2, decision: 'rejected', reason: '규격 확인' })
  assert.equal(DecidePurchaseItemsSchema.safeParse({ decisions: [{ id: 'b', version: 1, decision: 'rejected',
    reason: '😀'.repeat(PURCHASE_REASON_MAX) }] }).success, true)
  for (const decisions of [[], [{ id: 'a', version: 1, decision: 'rejected' }], [{ id: 'a', version: 1, decision: 'rejected', reason: ' ' }],
    [{ id: 'a', version: 1, decision: 'rejected', reason: '😀'.repeat(PURCHASE_REASON_MAX + 1) }],
    [{ id: 'a', version: 1, decision: 'approved', reason: 'x' }], [{ id: 'a', version: 1, decision: 'hold' }],
    [{ id: 'a', version: 1, decision: 'approved' }, { id: 'a', version: 1, decision: 'approved' }],
    Array.from({ length: PURCHASE_BATCH_MAX + 1 }, (_, n) => ({ id: `i${n}`, version: 1, decision: 'approved' }))]) {
    assert.equal(DecidePurchaseItemsSchema.safeParse({ decisions }).success, false, JSON.stringify(decisions).slice(0, 80))
  }
})

test('끼룩이 출력: 빈 글은 모르는 값으로 바꾸고, 상한과 실제 날짜를 지킨다', () => {
  const item = { productUrl: 'https://www.coupang.com/vp/products/1', productName: '테이블', selectedOption: ' ', packagingUnit: '',
    optionRequired: null, quantity: null, note: '부스 설치', neededBy: '2026-10-20', sourceMessageIds: ['m'], warnings: [] }
  assert.deepEqual(GeneratedPurchaseItemSchema.parse(item), { ...item, selectedOption: null, packagingUnit: null })
  for (const change of [{ quantity: 0 }, { neededBy: '2026-02-30' }, { note: 'a'.repeat(PURCHASE_NOTE_MAX + 1) },
    { warnings: Array(11).fill('확인') }, { estimatedUnitPrice: 999 }, { sourceMessageIds: ['\u0000'] }]) {
    assert.equal(GeneratedPurchaseItemSchema.safeParse({ ...item, ...change }).success, false, JSON.stringify(change))
  }
})

test('구매 요청 본문 스키마는 모두 모르는 키를 거부하는 strictObject다', () => {
  for (const schema of [CreatePurchaseDraftsSchema, UpdatePurchaseItemSchema, PurchaseItemVersionSchema, SubmitPurchaseItemsSchema,
    ChangeNeededBySchema, PurchaseReceivedSchema, PurchasePurchasedSchema, DecidePurchaseItemsSchema]) assert.equal(isStrictObject(schema), true)
})
