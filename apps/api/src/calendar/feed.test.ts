import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createCalendarFeedRoutes, createPublicCalendarRoutes } from './feed.js'
import type { Db } from '../db/types.js'
import { setErrorReporter } from '../http/on-error.js'

const NOW = new Date('2026-10-27T15:30:00Z')
const origin = 'https://calendar.example.test'
type Created = { feed: { createdAt: string }; url: string }
function open(t: SettlementKit, trustedOrigin = origin) {
  let now = NOW
  const options = { clock: () => now, trustedOrigin }
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: ORIGIN,
    calendarFeeds: createCalendarFeedRoutes(t.db, testSession, options),
    publicCalendar: createPublicCalendarRoutes(t.db, options),
  })
  const api = caller(app)
  const path = `/api/organizations/${t.council.councilId}/calendar/feed`
  const create = async (user = 's-planningMember') => {
    const response = await api.post(path, {}, user)
    assert.equal(response.status, 201)
    return (await response.json()) as Created
  }
  const read = (url: string, etag?: string) =>
    app.request(new URL(url).pathname, { headers: etag ? { 'If-None-Match': etag } : {} })
  return {
    app,
    api,
    path,
    create,
    read,
    setNow: (value: Date) => {
      now = value
    },
  }
}
const rowsOf = async (t: SettlementKit) =>
  (
    await t.pg.query<{
      member_id: string
      council_id: string
      token_hash: string
      created_at: unknown
    }>('SELECT * FROM calendar_feed')
  ).rows

test('공개 읽기 실패의 응답·로그·수집기 필드에는 토큰·해시 없이 라우트 꼴만 남는다', async context => {
  const token = 'a'.repeat(43)
  const hash = createHash('sha256').update(token).digest('hex')
  const lines: string[] = []
  const fields: Record<string, unknown>[] = []
  context.mock.method(console, 'error', (line: string) => lines.push(line))
  setErrorReporter((_error, values) => fields.push(values))
  try {
    const db = {
      transaction: async () => {
        throw new Error(`${token} ${hash}`)
      },
    } as unknown as Db
    const app = createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      publicCalendar: createPublicCalendarRoutes(db, { trustedOrigin: origin, clock: () => NOW }),
    })
    const response = await app.request(`/api/public/calendar/${token}.ics`)
    assert.equal(response.status, 500)
    const output = JSON.stringify([await response.text(), lines, fields])
    assert.ok(!output.includes(token))
    assert.ok(!output.includes(hash))
    assert.equal(fields[0]?.route, '/api/public/calendar/:file')
  } finally {
    setErrorReporter(undefined)
  }
})

test(
  '주소는 만들기 응답에만 있고 32바이트 토큰의 SHA-256만 저장하며 개인별로 독립된다',
  withSettlement(async t => {
    const h = open(t)
    assert.deepEqual(await (await h.api.get(h.path, 's-planningMember')).json(), { feed: null })
    const created = await h.create()
    assert.ok(created.url.startsWith(`${origin}/api/public/calendar/`))
    const file = new URL(created.url).pathname.split('/').at(-1)!
    assert.match(file, /^[A-Za-z0-9_-]{43}\.ics$/)
    assert.equal(Buffer.from(file.slice(0, -4), 'base64url').length, 32)
    const stored = await rowsOf(t)
    assert.equal(stored.length, 1)
    assert.equal(
      stored[0]!.token_hash,
      createHash('sha256').update(file.slice(0, -4)).digest('hex'),
    )
    assert.deepEqual(Object.keys(stored[0]!).sort(), [
      'council_id',
      'created_at',
      'member_id',
      'token_hash',
    ])
    assert.deepEqual(await (await h.api.get(h.path, 's-planningMember')).json(), {
      feed: created.feed,
    })
    assert.deepEqual(await (await h.api.get(h.path, 's-financeMember')).json(), { feed: null })
    assert.equal((await h.read(created.url)).status, 200)
  }),
)

test(
  '새 주소는 예전 주소를 즉시 막고 구독 끊기는 자기 줄만 지우며 거듭 끊을 수 있다',
  withSettlement(async t => {
    const h = open(t)
    const first = await h.create()
    const theirs = await h.create('s-financeMember')
    h.setNow(new Date(NOW.getTime() + 1000))
    const second = await h.create()
    assert.notEqual(first.url, second.url)
    assert.notEqual(first.feed.createdAt, second.feed.createdAt)
    assert.equal((await rowsOf(t)).length, 2)
    const old = await h.read(first.url)
    assert.equal(old.status, 404)
    assert.equal(await old.text(), '')
    assert.equal((await h.read(second.url)).status, 200)
    for (let i = 0; i < 2; i++)
      assert.deepEqual(
        await (await h.api.post(`${h.path}/delete`, {}, 's-planningMember')).json(),
        { feed: null },
      )
    assert.equal((await h.read(second.url)).status, 404)
    assert.equal((await h.read(theirs.url)).status, 200)
  }),
)

test(
  '떠났거나 기수가 지난 운영진은 404이고 그 줄을 지우며 부서 공개 범위를 매번 다시 본다',
  withSettlement(async t => {
    const h = open(t)
    await t.make(t.council, 'schedule_item', {
      title: '기획부 비공개',
      type: 'other',
      startsOn: '2026-10-28',
      visibility: 'department',
      departmentId: t.council.departments.planning,
    })
    const created = await h.create()
    assert.ok((await (await h.read(created.url)).text()).includes('기획부 비공개'))
    await t.pg.query(
      "UPDATE department_membership SET ends_at = greatest(starts_at + interval '1 second', $1) WHERE member_id = $2",
      [NOW.toISOString(), t.council.people.planningMember.memberId],
    )
    assert.ok(!(await (await h.read(created.url)).text()).includes('기획부 비공개'))
    await t.pg.query(
      "UPDATE council_membership SET ends_at = greatest(starts_at + interval '1 second', $1) WHERE member_id = $2",
      [NOW.toISOString(), t.council.people.planningMember.memberId],
    )
    assert.equal((await h.read(created.url)).status, 404)
    assert.equal((await rowsOf(t)).length, 0)
    const next = await h.create('s-financeMember')
    await t.make(t.council, 'cohort', {
      name: '2027',
      startsOn: '2027-01-01',
      endsOn: '2027-12-31',
    })
    h.setNow(new Date('2027-01-01T00:00:00Z'))
    assert.equal((await h.read(next.url)).status, 404)
    assert.equal((await rowsOf(t)).length, 0)
  }),
)

test(
  '공개 원점 끝에 슬래시가 있어도 만든 주소와 원본 주소는 정규 경로다',
  withSettlement(async t => {
    const h = open(t, `${origin}/`)
    const id = await t.event({ startsAt: NOW })
    const created = await h.create()
    assert.ok(created.url.startsWith(`${origin}/api/public/calendar/`))
    const response = await h.read(created.url)
    assert.equal(response.status, 200)
    assert.ok(
      (await response.text())
        .replace(/\r\n /g, '')
        .includes(`URL:${origin}/events/${t.council.councilId}/${id}?tab=overview`),
    )
  }),
)

test(
  '한도를 다 썼어도 바꾸기·끊기·떠나기로 무효가 된 주소는 404이며 떠난 줄을 정리한다',
  withSettlement(async t => {
    const h = open(t)
    for (const [user, action] of [
      ['s-planningMember', 'replace'],
      ['s-financeMember', 'delete'],
      ['s-plain', 'leave'],
    ] as const) {
      const url = (await h.create(user)).url
      for (let i = 0; i < 30; i++) assert.equal((await h.read(url)).status, 200)
      assert.equal((await h.read(url)).status, 429)
      if (action === 'replace') await h.create(user)
      else if (action === 'delete') await h.api.post(`${h.path}/delete`, {}, user)
      else
        await t.pg.query(
          "UPDATE council_membership SET ends_at = starts_at + interval '1 second' WHERE member_id = $1",
          [t.council.people.plain.memberId],
        )
      assert.equal((await h.read(url)).status, 404)
    }
    const rows = await rowsOf(t)
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.member_id, t.council.people.planningMember.memberId)
  }),
)

test(
  '구독에는 볼 수 있는 일정과 자기 업무·구매만 담고 신청자 정보·다른 학생회·범위 밖은 없다',
  withSettlement(async t => {
    const h = open(t)
    const mine = t.council.people.planningMember.memberId
    const event = await t.event({ name: '행사', startsAt: NOW })
    const form = await t.form(event)
    await t.registration(form, { name: '신청자 비밀 이름' })
    await t.make(t.council, 'task', { title: '내 업무', dueAt: NOW, assigneeId: mine })
    await t.make(t.council, 'task', {
      title: '남의 업무',
      dueAt: NOW,
      assigneeId: t.council.people.financeMember.memberId,
    })
    await t.requestWithItem(null, { title: '내 구매', requestedBy: mine, neededBy: '2026-10-28' })
    await t.requestWithItem(null, {
      title: '남의 구매',
      requestedBy: t.council.people.financeMember.memberId,
      neededBy: '2026-10-28',
    })
    const make = (title: string, values = {}, owner = t.council) =>
      t.make(owner, 'schedule_item', { title, type: 'other', startsOn: '2026-10-28', ...values })
    await make('전체 일정', { memo: '일정 메모' })
    await make('기획부 일정', {
      departmentId: t.council.departments.planning,
      visibility: 'department',
    })
    await make('재정부 비공개', {
      departmentId: t.council.departments.finance,
      visibility: 'department',
    })
    await make('다른 학생회', {}, t.other)
    await make('범위 전', { startsOn: '2026-08-28' })
    await make('범위 끝', { startsOn: '2027-10-28' })
    await make('범위 후', { startsOn: '2027-10-29' })
    const created = await h.create()
    const body = (await (await h.read(created.url)).text()).replace(/\r\n /g, '')
    for (const value of [
      '[행사] 행사',
      '신청 신청 마감',
      '내 업무',
      '내 구매 필요',
      '전체 일정',
      '일정 메모',
      '기획부 일정',
      '범위 끝',
    ])
      assert.ok(body.includes(value), value)
    for (const value of [
      '남의 업무',
      '남의 구매',
      '재정부 비공개',
      '다른 학생회',
      '신청자 비밀 이름',
      '범위 전',
      '범위 후',
    ])
      assert.ok(!body.includes(value), value)
  }),
)

test(
  '1000줄 상한은 내 것 거르기와 정렬 뒤에 적용한다',
  withSettlement(async t => {
    const h = open(t)
    await t.pg.query(
      `WITH made AS (INSERT INTO record (kind, council_id) SELECT 'task', $1 FROM generate_series(1, 1001) RETURNING id) INSERT INTO task (id, title, due_at, assignee_id) SELECT id, '내 업무', $2, $3 FROM made`,
      [t.council.councilId, NOW.toISOString(), t.council.people.planningMember.memberId],
    )
    const body = await (await h.read((await h.create()).url)).text()
    assert.equal(body.split('BEGIN:VEVENT\r\n').length - 1, 1000)
  }),
)

test(
  '응답 머리·ETag는 본문에 맞고 시계가 흘러도 안 바뀐 내용은 304, 고치면 200이다',
  withSettlement(async t => {
    const h = open(t)
    const event = await t.event({ startsAt: NOW })
    const url = (await h.create()).url
    const response = await h.read(url)
    const body = await response.text()
    for (const [key, value] of Object.entries({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="vada.ics"',
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    }))
      assert.equal(response.headers.get(key), value)
    const etag = `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`
    assert.equal(response.headers.get('ETag'), etag)
    h.setNow(new Date(NOW.getTime() + 2000))
    const unchanged = await h.read(url, etag)
    assert.equal(unchanged.status, 304)
    assert.equal(await unchanged.text(), '')
    assert.equal(unchanged.headers.get('ETag'), etag)
    await t.pg.query('UPDATE event SET name = $1 WHERE id = $2', ['변경', event])
    assert.equal((await h.read(url, etag)).status, 200)
  }),
)

test(
  '한도는 토큰마다 10분 30회이며 304도 세고 다른 토큰은 독립된다',
  withSettlement(async t => {
    const h = open(t)
    const url = (await h.create()).url
    const first = await h.read(url)
    for (let i = 1; i < 30; i++)
      assert.equal((await h.read(url, first.headers.get('ETag')!)).status, 304)
    assert.equal((await h.read(url)).status, 429)
    assert.equal((await h.read((await h.create('s-financeMember')).url)).status, 200)
    h.setNow(new Date(NOW.getTime() + 600_000))
    assert.equal((await h.read(url)).status, 200)
  }),
)

test(
  '잘못된 파일·없는 토큰은 본문 없는 404, 관리는 미인증 401·다른 학생회 403·모르는 키 400이다',
  withSettlement(async t => {
    const h = open(t)
    for (const file of [
      'bad',
      'x.ics',
      `${'a'.repeat(42)}.ics`,
      `${'a'.repeat(44)}.ics`,
      `${'a'.repeat(43)}.ICS`,
      `${'a'.repeat(43)}.ics`,
    ]) {
      const response = await h.app.request(`/api/public/calendar/${file}`)
      assert.equal(response.status, 404)
      assert.equal(await response.text(), '')
    }
    for (const path of [h.path, `${h.path}/delete`]) {
      assert.equal((await h.api.post(path, {})).status, 401)
      assert.equal((await h.api.post(path, {}, 'o-president')).status, 403)
      assert.equal((await h.api.post(path, { unknown: 1 }, 's-planningMember')).status, 400)
    }
    assert.equal((await h.api.get(h.path)).status, 401)
    assert.equal((await h.api.get(h.path, 's-ended')).status, 403)
  }),
)
