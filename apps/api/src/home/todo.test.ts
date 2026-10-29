import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeResponse, HomeTodo } from '@vada/contracts'
import { createApp } from '../app.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

// 회장단 홈 ③ 내가 할 일(시연 조각 ㉯). 한국 시각 2026-10-25(일) 12:00. 시험 도구(SettlementKit)의 시계와 같다.
const now = new Date('2026-10-25T03:00:00Z')
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)
const at = (value: string) => new Date(`${value}+09:00`)

function open(t: SettlementKit) {
  const home = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const board = async (user = 's-president', owner = t.council) => {
    const response = await home.get(`/api/organizations/${owner.councilId}/home`, user)
    assert.equal(response.status, 200, user)
    const value = ((await response.json()) as HomeResponse).councilBoard
    assert.ok(value, `${user}의 회장단 홈`)
    return value
  }
  const todo = async (user = 's-president'): Promise<HomeTodo> => (await board(user)).todo
  const { people } = t.council
  const task = (values: Record<string, unknown>) =>
    t.make(t.council, 'task', { title: '업무', ...values })
  // 끝난 회의 하나와 안건(회의록 글). creator는 만든 사람(운영진 번호).
  const meeting = async (
    values: Record<string, unknown> = {},
    options: { creator?: string; notes?: string | null; owner?: typeof t.council } = {},
  ) => {
    const owner = options.owner ?? t.council
    const id = await t.make(
      owner,
      'meeting',
      {
        title: '운영 회의',
        heldAt: at('2026-10-24T10:00:00'),
        endsAt: at('2026-10-24T11:00:00'),
        place: '학생회실',
        ...values,
      },
      options.creator ?? owner.people.president.memberId,
    )
    const agenda = await t.make(owner, 'agenda_item', {
      meetingId: id,
      position: 1,
      title: '안건',
      notes: options.notes === undefined ? '논의한 것' : options.notes,
    })
    return { id, agenda }
  }
  return { board, todo, people, task, meeting }
}

const kinds = (todo: HomeTodo) => todo.rows.map(row => row.kind)

test('줄은 회의록 → 행사 정리 → 내 업무·회장단 업무 지남 → 오늘 차례이고 남의 업무와 내일 마감은 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { people } = h
    const { agenda } = await h.meeting()
    await t.make(t.council, 'decision', {
      content: '결정',
      decidedBy: people.president.memberId,
      decidedAt: at('2026-10-24T10:30:00'),
      originId: agenda,
      originKind: 'agenda_item',
    })
    await h.task({ title: '후속', originId: agenda, originKind: 'agenda_item' })
    await t.event({ name: '끝난 행사', startsAt: at('2026-10-20T10:00:00') })
    await h.task({
      title: '내 지남',
      dueAt: due('2026-10-23'),
      assigneeId: people.president.memberId,
    })
    await h.task({
      title: '부회장 오늘',
      dueAt: due('2026-10-25'),
      assigneeId: people.vicePresident.memberId,
    })
    await h.task({
      title: '부원 지남',
      dueAt: due('2026-10-22'),
      assigneeId: people.planningMember.memberId,
    })
    await h.task({
      title: '내 내일',
      dueAt: due('2026-10-26'),
      assigneeId: people.president.memberId,
    })
    const todo = await h.todo()
    assert.deepEqual(kinds(todo), ['minutes', 'event_tidy', 'task_late', 'task_today'])
    const [minutes, tidy, late, today] = todo.rows
    assert.ok(minutes?.kind === 'minutes')
    assert.equal(minutes.meeting.title, '운영 회의')
    assert.deepEqual(
      { decisions: minutes.decisions, followUps: minutes.followUps },
      { decisions: 1, followUps: 1 },
    )
    assert.ok(tidy?.kind === 'event_tidy')
    assert.equal(tidy.event.name, '끝난 행사')
    assert.deepEqual(tidy.remaining, { tasks: 0, settlement: 0 })
    assert.equal(tidy.settlementContact, null)
    assert.ok(late?.kind === 'task_late')
    assert.equal(late.task.title, '내 지남')
    assert.equal(late.days, 2)
    assert.equal(late.owner, null)
    assert.ok(today?.kind === 'task_today')
    assert.equal(today.task.title, '부회장 오늘')
    assert.deepEqual(today.owner?.role, { kind: 'council', title: '부회장' })
    assert.equal(today.owner?.memberId, people.vicePresident.memberId)
    assert.deepEqual(todo.counts, { minutes: 1, event_tidy: 1, task_late: 1, task_today: 1 })
    assert.equal(todo.total, 4)
    // 머리 얼굴(나) 색: 들어온 차례 0번
    assert.equal(todo.meTint, 0)
    // ③의 업무는 ①에 없다(같은 빼기 조건).
    const ops = (await h.board()).ops
    assert.ok(!ops.rows.some(row => ['내 지남', '부회장 오늘'].includes(row.title)))
    // 부회장의 ③에서는 회장의 업무가 회장단 업무로, 자기 업무가 내 업무로 보인다.
    const vice = await h.todo('s-vicePresident')
    const tasks = vice.rows.flatMap(row =>
      row.kind.startsWith('task') && 'task' in row ? [row] : [],
    )
    assert.deepEqual(
      tasks.map(row => [row.task.title, row.owner?.memberId ?? null]),
      [
        ['내 지남', people.president.memberId],
        ['부회장 오늘', null],
      ],
    )
  })()
})

test('회의록 줄은 내가 만든, 끝났고 확정·취소 전이며 회의록 글이 있는 회의만이고, 만든 사람이 떠났으면 회장단 모두에게 보인다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { people } = h
    await h.meeting({ title: '끝남' })
    await h.meeting({ title: '아직 안 끝남', endsAt: at('2026-10-25T15:00:00') })
    await h.meeting({ title: '글 없음' }, { notes: '  ' })
    const cancelled = await h.meeting({ title: '취소' })
    await t.pg.query(
      `UPDATE meeting SET cancelled_at = now(), cancel_reason = '취소' WHERE id = $1`,
      [cancelled.id],
    )
    const confirmed = await h.meeting({ title: '확정' })
    await t.pg.query(`UPDATE record SET confirmed_at = now(), confirmed_by = $2 WHERE id = $1`, [
      confirmed.id,
      people.president.memberId,
    ])
    await h.meeting({ title: '부회장이 만듦' }, { creator: people.vicePresident.memberId })
    await h.meeting({ title: '떠난 사람이 만듦' }, { creator: people.ended.memberId })
    await h.meeting({ title: '다른 학생회' }, { owner: t.other })
    const titles = (todo: HomeTodo) =>
      todo.rows.flatMap(row => (row.kind === 'minutes' ? [row.meeting.title] : []))
    assert.deepEqual(titles(await h.todo()), ['끝남', '떠난 사람이 만듦'])
    assert.deepEqual(titles(await h.todo('s-vicePresident')), ['부회장이 만듦', '떠난 사람이 만듦'])
    const theirs = (await h.board('o-president', t.other)).todo
    assert.deepEqual(titles(theirs), ['다른 학생회'])
  })()
})

test('정산이 남은 행사 정리 줄은 재정부장이 연락할 사람이고, 재정부장이 나면 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { people } = h
    const ended = await t.event({ name: '정산 남음', startsAt: at('2026-10-20T10:00:00') })
    const { line } = await t.requestWithItem(ended)
    await t.approve(line)
    await t.pg.query(
      `UPDATE department_membership SET department_rank = 'head' WHERE member_id = $1`,
      [people.financeMember.memberId],
    )
    const [row] = (await h.todo()).rows
    assert.ok(row?.kind === 'event_tidy')
    assert.ok(row.remaining.settlement > 0)
    assert.equal(row.settlementContact?.memberId, people.financeMember.memberId)
    assert.deepEqual(row.settlementContact?.role, {
      kind: 'finance_head',
      department: '재정부',
      title: '부장',
    })
    assert.deepEqual(row.actions, [])
    await t.pg.query(`UPDATE department_membership SET member_id = $1 WHERE member_id = $2`, [
      people.president.memberId,
      people.financeMember.memberId,
    ])
    const [mine] = (await h.todo()).rows
    assert.ok(mine?.kind === 'event_tidy')
    assert.equal(mine.settlementContact, null)
  })()
})

test('줄은 상한까지 싣고 갈래별 수와 전체 수는 전체를 센다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    for (let i = 0; i < 52; i += 1)
      await h.task({
        title: `지남 ${i}`,
        dueAt: due('2026-10-20'),
        assigneeId: h.people.president.memberId,
      })
    const todo = await h.todo()
    assert.equal(todo.rows.length, 50)
    assert.equal(todo.counts.task_late, 52)
    assert.equal(todo.total, 52)
  })()
})
