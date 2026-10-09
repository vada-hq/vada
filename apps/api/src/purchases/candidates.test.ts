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
