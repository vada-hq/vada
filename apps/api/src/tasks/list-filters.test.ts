import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TasksResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTaskRoutes } from './routes.js'

// 한국 시각 2026-10-25 12:00. 7일째는 11월 1일이다.
const noon = new Date('2026-10-25T03:00:00Z')
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)

type Council = Awaited<ReturnType<typeof seedCouncil>>

async function start() {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(db, testSession, { clock: () => noon }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/tasks`
  const make = (values: Record<string, unknown>, owner: Council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { title: '업무', ...values },
      }),
    )
  const list = async (query: string, user = 's-president') => {
    const response = await api.get(`${base}?${query}`, user)
    assert.equal(response.status, 200, query)
    return (await response.json()) as TasksResponse
  }
  const titles = async (query: string, user?: string) =>
    (await list(query, user)).tasks.map(row => row.title).sort()
  return { pg, council, other, api, base, make, list, titles, close }
}

// 거르기에 걸리지 않는 열린 업무 301개가 마감 순으로 앞선다(재정부, 지금 운영진이 맡음, 11월 30일 마감).
async function fillPastLimit(t: Awaited<ReturnType<typeof start>>) {
  const { councilId, departments, people } = t.council
  await t.pg.exec(`INSERT INTO record (id, kind, council_id)
    SELECT uuidv7(), 'task', '${councilId}' FROM generate_series(1, 301)`)
  await t.pg.exec(`INSERT INTO task (id, title, department_id, assignee_id, due_at)
    SELECT id, '앞선 업무', '${departments.finance}', '${people.financeMember.memberId}',
      '2026-11-30T14:59:59Z'
    FROM record WHERE kind = 'task'`)
}

test('칩·홈 범위는 300개 상한 전에 서버가 걸러 상한 뒤 업무도 빠지지 않는다', async () => {
  const t = await start()
  try {
    await fillPastLimit(t)
    const { planning } = t.council.departments
    const { planningMember, ended, financeMember } = t.council.people
    await t.make({
      title: '기획 마감 없음',
      departmentId: planning,
      assigneeId: planningMember.memberId,
    })
    await t.make({ title: '부서·담당자 없음' })
    await t.make({
      title: '떠난 담당',
      departmentId: planning,
      assigneeId: ended.memberId,
      dueAt: due('2026-12-10'),
    })
    await t.make({ title: '지남', assigneeId: financeMember.memberId, dueAt: due('2026-10-24') })
    await t.make({ title: '오늘', assigneeId: financeMember.memberId, dueAt: due('2026-10-25') })
    await t.make({ title: '7일째', assigneeId: financeMember.memberId, dueAt: due('2026-11-01') })
    await t.make({ title: '8일째', assigneeId: financeMember.memberId, dueAt: due('2026-11-02') })
    await t.make({ title: '다른 학생회', dueAt: due('2026-10-20') }, t.other)
    assert.equal((await t.list('view=all')).truncated, true)
    const expected: [string, string[]][] = [
      [`dept=${planning}`, ['기획 마감 없음', '떠난 담당']],
      ['dept=none', ['7일째', '8일째', '부서·담당자 없음', '오늘', '지남']],
      ['due=none', ['기획 마감 없음', '부서·담당자 없음']],
      ['due=overdue', ['지남']],
      ['due=week', ['7일째', '오늘']],
      [`assignee=${planningMember.memberId}`, ['기획 마감 없음']],
      ['assignee=none', ['떠난 담당', '부서·담당자 없음']],
      ['attention=true', ['떠난 담당', '부서·담당자 없음', '지남']],
      [`dept=${planning}&due=none`, ['기획 마감 없음']],
      ['dept=none&attention=true', ['부서·담당자 없음', '지남']],
    ]
    for (const [query, titles] of expected) {
      const result = await t.list(`view=all&${query}`)
      assert.deepEqual(result.tasks.map(row => row.title).sort(), titles, query)
      assert.equal(result.truncated, false, query)
    }
    assert.deepEqual(await t.titles('view=all&heads=true', 's-planningHead'), [
      '기획 마감 없음',
      '떠난 담당',
    ])
    // 직급 부서가 없으면 빈 목록이다(부원, 회장).
    assert.deepEqual(await t.titles('view=all&heads=true', 's-planningMember'), [])
    assert.deepEqual(await t.titles('view=all&heads=true'), [])
    assert.deepEqual(await t.titles('view=mine&dept=none', 's-planningMember'), [])
    assert.deepEqual(await t.titles('view=unassigned&event=none&dept=none'), ['부서·담당자 없음'])
  } finally {
    await t.close()
  }
})

test('끝남 목록에서 마감·확인 필요·담당자 없음 칩은 빈 목록이고 부서·담당자 칩은 그대로 건다', async () => {
  const t = await start()
  try {
    const { planning } = t.council.departments
    const { planningMember } = t.council.people
    await t.make({
      title: '기획 끝남',
      status: 'done',
      departmentId: planning,
      assigneeId: planningMember.memberId,
      dueAt: due('2026-10-01'),
    })
    await t.make({ title: '담당 없이 끝남', status: 'done' })
    for (const query of ['due=overdue', 'due=none', 'due=week', 'attention=true', 'assignee=none'])
      assert.deepEqual(await t.titles(`view=all&status=done&${query}`), [], query)
    assert.deepEqual(await t.titles(`view=all&status=done&dept=${planning}`), ['기획 끝남'])
    assert.deepEqual(await t.titles('view=all&status=done&dept=none'), ['담당 없이 끝남'])
    assert.deepEqual(await t.titles(`view=all&status=done&assignee=${planningMember.memberId}`), [
      '기획 끝남',
    ])
    assert.deepEqual(await t.titles('view=all&status=done&heads=true', 's-planningHead'), [
      '기획 끝남',
    ])
  } finally {
    await t.close()
  }
})

test('다른 학생회의 부서·사람 번호로 걸러도 그 학생회 업무는 섞이지 않는다', async () => {
  const t = await start()
  try {
    const { planning } = t.other.departments
    const { planningMember } = t.other.people
    await t.make(
      { title: '다른 학생회 기획', departmentId: planning, assigneeId: planningMember.memberId },
      t.other,
    )
    assert.deepEqual(await t.titles(`view=all&dept=${planning}`), [])
    assert.deepEqual(await t.titles(`view=all&assignee=${planningMember.memberId}`), [])
    const response = await t.api.get(`${t.base}?view=all&dept=${planning}`, 'o-president')
    assert.equal(response.status, 403)
  } finally {
    await t.close()
  }
})

test('거르기 키의 틀린 값과 같은 키 두 번은 400 INVALID_INPUT이다', async () => {
  const t = await start()
  try {
    const { planning } = t.council.departments
    for (const query of [
      'view=all&dept=nope',
      'view=all&dept=',
      'view=all&due=soon',
      'view=all&assignee=x',
      'view=all&attention=false',
      'view=all&heads=1',
      `view=all&dept=${planning}&dept=none`,
    ]) {
      const response = await t.api.get(`${t.base}?${query}`, 's-president')
      assert.equal(response.status, 400, query)
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' }, query)
    }
  } finally {
    await t.close()
  }
})
