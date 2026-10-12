import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setupPurchases } from '../purchases/test-setup.js'
import { timelineOf } from './timeline.js'

// 학생회 a의 행사 e(체육대회)에 날짜를 정해 기록을 넣는다. 시각은 모두 한국 시각(+09)으로 적는다.
async function seeded() {
  const env = await setupPurchases()
  await env.pg.exec(`
    UPDATE events SET created_at = '2026-02-01T10:00+09', starts_at = '2026-03-02T10:00+09', place = '대운동장',
      completed_at = '2026-03-10T10:00+09', completed_by = 'l' WHERE id = 'e';
    INSERT INTO registration_forms(id, organization_id, event_id, closes_at, created_by, created_at)
      VALUES ('form','a','e','2026-02-25T23:59+09','p','2026-02-10T09:00+09');
    INSERT INTO registrations(id, organization_id, form_id, purged_at) VALUES ('r1','a','form',now()),('r2','a','form',now());
    INSERT INTO registrations(id, organization_id, form_id, purged_at, cancelled_at) VALUES ('r3','a','form',now(),now());
    INSERT INTO tasks(id, organization_id, event_id, title, status, department_id, due_on, completed_at, created_by, created_at) VALUES
      ('t1','a','e','포스터','done','dp','2026-02-20','2026-02-22T01:00+09','p','2026-02-05T09:00+09'),
      ('t2','a','e','대관','done',NULL,'2026-02-24','2026-02-24T23:00+09','p','2026-02-05T09:00+09'),
      ('t3','a','e','정산 서류','todo','dp','2026-03-01',NULL,'p','2026-02-05T09:00+09'),
      ('t4','a','e','후기','doing',NULL,NULL,NULL,'p','2026-02-05T09:30+09');
    INSERT INTO purchase_submissions(id, organization_id, event_id, requester_id, department_id, submitted_at)
      VALUES ('s1','a','e','p','dp','2026-02-12T14:00+09');
    INSERT INTO purchase_items(id, organization_id, event_id, requester_id, submission_id, status, product_url, product_name, created_at,
      decided_by, decided_at, decision_reason, purchased_by, purchased_at, received_by, received_at) VALUES
      ('i1','a','e','p','s1','approved','https://www.coupang.com/vp/products/1','과자 세트','2026-02-12T13:00+09',
        'f','2026-02-13T10:00+09',NULL,'f','2026-02-14T09:00+09','f','2026-02-17T18:00+09'),
      ('i2','a','e','p','s1','approved','https://www.coupang.com/vp/products/2','콜라','2026-02-12T13:01+09',
        'f','2026-02-13T10:05+09',NULL,'f','2026-02-14T09:30+09',NULL,NULL),
      ('i3','a','e','p','s1','rejected','https://www.coupang.com/vp/products/3','에어 아치','2026-02-12T13:02+09',
        'f','2026-02-13T10:10+09','예산 초과',NULL,NULL,NULL,NULL),
      ('i4','a','e','p','s1','cancelled','https://www.coupang.com/vp/products/4',NULL,'2026-02-12T13:03+09',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
      ('i5','a','e','p',NULL,'draft','https://www.coupang.com/vp/products/5','작성 중','2026-02-12T13:04+09',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    INSERT INTO purchase_item_events(id, organization_id, item_id, actor_id, action, created_at) VALUES ('pe1','a','i4','p','cancelled','2026-02-12T16:00+09');
    INSERT INTO expenses(id, organization_id, event_id, vendor, description, amount, paid_on, method, payer_id, recorded_by) VALUES
      ('x1','a','e','쿠팡','물품',46000,'2026-02-23','council_card','f','f'),
      ('x2','a','e','한빛관광','버스',1100000,'2026-02-27','transfer','f','f'),
      ('x3','a','e','쿠팡','잘못',9000,'2026-02-23','council_card','f','f');
    UPDATE expenses SET voided_at = now(), voided_by = 'f', void_reason = '잘못 기록' WHERE id = 'x3';
    INSERT INTO expense_receipts(id, organization_id, expense_id, object_key, file_name, content_type, size_bytes, kind, status, uploaded_by,
      confirmed_at) VALUES ('rc1','a','x1','k1','r.pdf','application/pdf',1024,'receipt','ready','f',now());
    INSERT INTO event_finance_events(id, organization_id, event_id, actor_id, action, changes, reason, created_at) VALUES
      ('fe1','a','e','f','budget_set','{"from":null,"to":1000000}',NULL,'2026-02-03T10:00+09'),
      ('fe2','a','e','f','budget_set','{"from":1000000,"to":1200000}',NULL,'2026-02-04T10:00+09'),
      ('fe3','a','e','f','settled','{"budget":1200000,"spent":1146000,"expenseCount":2,"fee":0}',NULL,'2026-03-05T15:00+09'),
      ('fe4','a','e','f','reopened','{}','영수증 다시 확인','2026-03-06T09:00+09'),
      ('fe5','a','e','f','settled','{"budget":1200000,"spent":1146000,"expenseCount":2,"fee":0}',NULL,'2026-03-06T11:00+09');
  `)
  return env
}

test('준비 과정: 행사 기록을 날짜 순으로 줄 세우고, 날짜만 있는 줄은 그날 맨 앞이다', async () => {
  const env = await seeded()
  try {
    const entries = await timelineOf(env.db, 'a', 'e')
    assert.deepEqual(entries.map(entry => entry.id), ['event:created', 'finance:fe1', 'finance:fe2', 'task:t4', 'registration:open', 'submission:s1',
      'cancelled:i4', 'approved:2026-02-13', 'rejected:i3', 'purchased:2026-02-14', 'received:2026-02-17', 'task:t1', 'expense:x1', 'task:t2',
      'registration:close', 'expense:x2', 'task:t3', 'event:day', 'finance:fe3', 'finance:fe4', 'finance:fe5', 'event:completed'])
    const by = Object.fromEntries(entries.map(entry => [entry.id, entry]))
    assert.deepEqual(by['event:created'], { id: 'event:created', day: '2026-02-01', at: '2026-02-01T01:00:00.000Z', kind: 'event', text: '행사 만듦',
      note: null, warning: false, tab: null })
    assert.deepEqual(by['event:day'], { id: 'event:day', day: '2026-03-02', at: '2026-03-02T01:00:00.000Z', kind: 'event', text: '행사',
      note: '대운동장', warning: false, tab: null })
    assert.deepEqual(by['event:completed']!.text, '행사 완료')
    // 신청서에 시작 시각이 없으면 신청서를 만든 때다. 마감 줄에 취소하지 않은 신청 수를 적는다.
    assert.deepEqual([by['registration:open']!.day, by['registration:open']!.tab], ['2026-02-10', 'registrations'])
    assert.deepEqual([by['registration:close']!.day, by['registration:close']!.text, by['registration:close']!.note],
      ['2026-02-25', '참가 신청 마감', '신청 2명'])
    // 업무: 이틀 늦게 끝냄(한국 날짜), 마감일 당일에 끝냄, 마감이 지났고 끝내지 않음(마감일, 날짜만), 마감 없이 끝내지 않음(만든 때)
    assert.deepEqual(by['task:t1'], { id: 'task:t1', day: '2026-02-22', at: '2026-02-21T16:00:00.000Z', kind: 'task', text: '업무 완료: 포스터',
      note: '기획부 · 마감 2월 20일 · 2일 늦음', warning: true, tab: 'tasks' })
    assert.deepEqual([by['task:t2']!.note, by['task:t2']!.warning], ['마감 2월 24일', false])
    assert.deepEqual(by['task:t3'], { id: 'task:t3', day: '2026-03-01', at: null, kind: 'task', text: '업무 미완료: 정산 서류',
      note: '기획부 · 마감 3월 1일', warning: true, tab: 'tasks' })
    assert.deepEqual([by['task:t4']!.day, by['task:t4']!.text, by['task:t4']!.note, by['task:t4']!.warning], ['2026-02-05', '업무 미완료: 후기', null, true])
    // 구매: 제출 묶음, 날마다 묶은 승인·구매 완료·받음, 반려 사유, 취소. 작성 중 품목은 없다.
    assert.deepEqual(by['submission:s1'], { id: 'submission:s1', day: '2026-02-12', at: '2026-02-12T05:00:00.000Z', kind: 'purchase',
      text: '구매 요청 4건: 과자 세트, 콜라, 에어 아치 외 1건', note: '기획부', warning: false, tab: 'purchases' })
    assert.deepEqual([by['approved:2026-02-13']!.text, by['approved:2026-02-13']!.at], ['구매 승인 2건: 과자 세트, 콜라', '2026-02-13T01:00:00.000Z'])
    assert.deepEqual([by['rejected:i3']!.text, by['rejected:i3']!.note, by['rejected:i3']!.warning], ['구매 반려: 에어 아치', '예산 초과', true])
    assert.deepEqual([by['cancelled:i4']!.text, by['cancelled:i4']!.at], ['구매 취소: 이름 없는 품목', '2026-02-12T07:00:00.000Z'])
    assert.equal(by['purchased:2026-02-14']!.text, '구매 완료 2건: 과자 세트, 콜라')
    assert.equal(by['received:2026-02-17']!.text, '받음 1건: 과자 세트')
    assert.ok(!entries.some(entry => entry.text.includes('작성 중')))
    // 지출: 결제일(날짜만), 영수증이 없으면 주의. 취소한 지출은 없다.
    assert.deepEqual(by['expense:x1'], { id: 'expense:x1', day: '2026-02-23', at: null, kind: 'expense', text: '지출 46,000원: 쿠팡', note: '물품',
      warning: false, tab: 'finance' })
    assert.deepEqual([by['expense:x2']!.text, by['expense:x2']!.note, by['expense:x2']!.warning], ['지출 1,100,000원: 한빛관광', '버스 · 영수증 없음', true])
    assert.equal(by['expense:x3'], undefined)
    // 재정: 예산 정함(전 금액), 정산, 다시 엶(사유)
    assert.deepEqual([by['finance:fe1']!.text, by['finance:fe1']!.note], ['예산 1,000,000원으로 정함', null])
    assert.deepEqual([by['finance:fe2']!.text, by['finance:fe2']!.note], ['예산 1,200,000원으로 정함', '전에는 1,000,000원'])
    assert.deepEqual([by['finance:fe3']!.text, by['finance:fe3']!.note, by['finance:fe3']!.tab], ['정산', '집행 1,146,000원', 'finance'])
    assert.deepEqual([by['finance:fe4']!.text, by['finance:fe4']!.note], ['정산 다시 엶', '영수증 다시 확인'])
    // 사람 이름(기획·재정·회장)은 어느 줄에도 없다.
    assert.ok(!JSON.stringify(entries).match(/기획2|재정"|회장"/))
  } finally { await env.pg.close() }
})

test('준비 과정: 날짜를 정하지 않은 행사에는 행사 줄이 없고, 예산을 미정으로 바꾸면 그렇게 적는다. 없는 행사는 빈 목록이다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`INSERT INTO event_finance_events(id, organization_id, event_id, actor_id, action, changes) VALUES
      ('fe1','a','e2','f','budget_set','{"from":500000,"to":null}')`)
    const entries = await timelineOf(env.db, 'a', 'e2')
    assert.deepEqual(entries.map(entry => entry.id), ['event:created', 'finance:fe1'])
    assert.deepEqual([entries[1]!.text, entries[1]!.note], ['예산 미정으로 바꿈', '전에는 500,000원'])
    assert.deepEqual(await timelineOf(env.db, 'a', 'ex'), [])
    assert.deepEqual(await timelineOf(env.db, 'a', 'nope'), [])
  } finally { await env.pg.close() }
})
