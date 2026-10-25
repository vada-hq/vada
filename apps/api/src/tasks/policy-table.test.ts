import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TASK_ACTIONS, type TaskAction, type TaskDetail } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRateLimiter } from '../http/rate-limit.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTaskRoutes } from './routes.js'

// 업무 정책의 구조 검사(기능 015 조각 1): 업무 × 사람 × TASK_ACTIONS 표.
// 칸마다 읽기 actions에 있으면 그 쓰기가 성공하고, 없으면 403으로 거절된다(같은 decide를 쓴다).
// 동작이나 상황을 더하면 이 표에 줄을 더한다. 예외 목록은 없다.

const noon = new Date('2026-10-25T03:00:00Z')
type Person = 'president' | 'planningHead' | 'planningMember' | 'plain'
const PEOPLE: Person[] = ['president', 'planningHead', 'planningMember', 'plain']
const ALL = [...TASK_ACTIONS]

// 쓰기 요청. 동작 하나마다 한 칸이라, 목록에 동작을 더하면 여기도 더해야 한다.
const WRITE: Record<TaskAction, (id: string) => [string, unknown]> = {
  'task.edit': id => [id, { title: '고침', body: null, dueDate: null }],
  'task.remove': id => [`${id}/delete`, {}],
  'task.change_department': id => [`${id}/department`, { departmentId: null }],
  'task.change_assignee': id => [`${id}/assignee`, { assigneeId: null }],
  'task.change_status': id => [`${id}/status`, { status: 'in_progress' }],
}

type Scene = {
  name: string
  // 만든 사람, 부서, 담당자, 행사 책임자
  creator: Person
  department: 'planning' | 'finance'
  assignee: Person | null
  eventOwner: Person | null
  expected: Record<Person, TaskAction[]>
}

const SCENES: Scene[] = [
  {
    name: '부장이 부원에게 맡긴 업무',
    creator: 'planningHead',
    department: 'planning',
    assignee: 'planningMember',
    eventOwner: null,
    expected: {
      president: ALL,
      planningHead: ['task.edit', 'task.remove', 'task.change_assignee', 'task.change_status'],
      planningMember: ['task.edit', 'task.change_status'],
      plain: [],
    },
  },
  {
    name: '담당자가 직접 만든 업무',
    creator: 'planningMember',
    department: 'planning',
    assignee: 'planningMember',
    eventOwner: null,
    expected: {
      president: ALL,
      planningHead: ['task.edit', 'task.remove', 'task.change_assignee', 'task.change_status'],
      planningMember: ['task.edit', 'task.remove', 'task.change_status'],
      plain: [],
    },
  },
  {
    name: '만들었어도 담당자가 아닌 업무',
    creator: 'planningMember',
    department: 'planning',
    assignee: null,
    eventOwner: null,
    expected: {
      president: ALL,
      planningHead: ['task.edit', 'task.remove', 'task.change_assignee', 'task.change_status'],
      planningMember: [],
      plain: [],
    },
  },
  {
    name: '행사 책임자의 행사 업무',
    creator: 'president',
    department: 'finance',
    assignee: null,
    eventOwner: 'plain',
    expected: { president: ALL, planningHead: [], planningMember: [], plain: ALL },
  },
]

async function start() {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(db, testSession, {
        clock: () => noon,
        writeLimiter: createRateLimiter({ limit: 100_000, windowMs: 10_000 }),
      }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/tasks`
  const idOf = (person: Person) => council.people[person].memberId
  const make = (scene: Scene) =>
    db.transaction(async tx => {
      const eventId = scene.eventOwner
        ? await createRecord(tx, {
            kind: 'event',
            councilId: council.councilId,
            actor: idOf('president'),
            values: { name: '봄 축제', ownerId: idOf(scene.eventOwner) },
          })
        : null
      return createRecord(tx, {
        kind: 'task',
        councilId: council.councilId,
        actor: idOf(scene.creator),
        values: {
          title: '현수막 주문',
          departmentId: council.departments[scene.department],
          assigneeId: scene.assignee ? idOf(scene.assignee) : null,
          eventId,
        },
      })
    })
  return { council, db, pg, api, base, make, close }
}

test('업무 × 사람 × 동작: 읽기 actions에 있으면 쓰기가 성공하고, 없으면 403으로 거절된다', async () => {
  assert.deepEqual(Object.keys(WRITE).sort(), [...TASK_ACTIONS].sort(), '표 열이 목록과 다르다')
  const s = await start()
  try {
    for (const scene of SCENES)
      for (const person of PEOPLE)
        for (const action of TASK_ACTIONS) {
          const cell = `${scene.name} ${person} ${action}`
          const id = await s.make(scene)
          const user = `s-${person}`
          const read = (await (await s.api.get(`${s.base}/${id}`, user)).json()) as {
            task: TaskDetail
          }
          assert.deepEqual(
            read.task.actions,
            ALL.filter(item => scene.expected[person].includes(item)),
            `${cell} actions`,
          )
          const allowed = scene.expected[person].includes(action)
          const [path, body] = WRITE[action](id)
          const response = await s.api.post(`${s.base}/${path}`, body, user)
          assert.equal(response.status === 403, !allowed, `${cell} 쓰기 ${response.status}`)
          assert.equal(response.ok, allowed, `${cell} 성공`)
        }
  } finally {
    await s.close()
  }
})

test('부장이 맡긴 업무를 담당자가 지우려 하면 403이고 업무가 그대로다', async () => {
  const s = await start()
  try {
    const id = await s.make(SCENES[0]!)
    const response = await s.api.post(`${s.base}/${id}/delete`, {}, 's-planningMember')
    assert.equal(response.status, 403)
    const read = (await (await s.api.get(`${s.base}/${id}`, 's-president')).json()) as {
      task: TaskDetail
    }
    assert.equal(read.task.title, '현수막 주문')
  } finally {
    await s.close()
  }
})

// 만들기 선택지(기능 018 조각 1): 선택지에 있는 (부서, 담당자) 짝은 만들기가 201이고 없는 짝은 403이다.
// 둘이 같은 decideCreate를 쓰므로 판정을 바꾸면 이 표의 두 쪽(선택지, 만들기)이 함께 실패한다.
type Options = { departments: { id: string | null; assignees: { id: string | null }[] }[] }
const pairsOf = (options: Options) =>
  options.departments.flatMap(item => item.assignees.map(who => `${item.id}|${who.id}`)).sort()

test('만들기 선택지 × 직급: 선택지에 있는 짝은 201이고 없는 짝은 403이며 기록이 늘지 않는다', async () => {
  const s = await start()
  try {
    const { people, departments } = s.council
    const id = (person: keyof typeof people) => people[person].memberId
    const withNone: (string | null)[] = [
      null,
      id('president'),
      id('vicePresident'),
      id('financeMember'),
      id('planningHead'),
      id('planningViceHead'),
      id('planningMember'),
      id('plain'),
    ]
    const pairs = (department: string | null, who: (string | null)[]) =>
      who.map(item => `${department}|${item}`)
    const { finance, planning } = departments
    const eventId = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: s.council.councilId,
        actor: id('president'),
        values: { name: '봄 축제', ownerId: id('plain') },
      }),
    )
    const everything = [finance, planning, null].flatMap(item => pairs(item, withNone))
    const onlyMe = (person: keyof typeof people) => [
      ...pairs(planning, [id(person)]),
      ...pairs(null, [id(person)]),
    ]
    // 직급마다 기대하는 선택지. 부장은 자기 부서의 모두, 그 밖은 나만이다. 떠난 사람은 어디에도 없다.
    const cases: { name: string; person: Person; event?: string; expected: string[] }[] = [
      { name: '회장단', person: 'president', expected: everything },
      {
        name: '부장',
        person: 'planningHead',
        expected: [...pairs(planning, withNone), ...pairs(null, [id('planningHead')])],
      },
      { name: '부원', person: 'planningMember', expected: onlyMe('planningMember') },
      { name: '부서 없는 운영진', person: 'plain', expected: pairs(null, [id('plain')]) },
      { name: '행사 책임자', person: 'plain', event: eventId, expected: everything },
      {
        name: '책임자가 아닌 부원의 그 행사',
        person: 'planningMember',
        event: eventId,
        expected: onlyMe('planningMember'),
      },
    ]
    // 후보에는 선택지에 없어야 하는 사람(떠난 사람, 다른 학생회 사람)도 넣는다.
    const other = await seedCouncil(s.db, s.pg, 'o')
    const outsiders = [id('ended'), other.people.president.memberId]
    let created = 0
    for (const item of cases) {
      const user = `s-${item.person}`
      const query = item.event ? `?event=${item.event}` : ''
      const response = await s.api.get(`${s.base}/options${query}`, user)
      assert.equal(response.status, 200, item.name)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      const options = (await response.json()) as Options
      assert.deepEqual(pairsOf(options), [...item.expected].sort(), `${item.name} 선택지`)
      const offered = new Set(pairsOf(options))
      const grid = [finance, planning, null].flatMap(department =>
        [...withNone, ...outsiders].map(assignee => ({ department, assignee })),
      )
      for (const { department, assignee } of grid) {
        const cell = `${item.name} ${department} ${assignee}`
        const made = await s.api.post(
          s.base,
          {
            title: '표 시험',
            departmentId: department,
            assigneeId: assignee,
            eventId: item.event ?? null,
          },
          user,
        )
        const inOptions = offered.has(`${department}|${assignee}`)
        assert.equal(made.status === 201, inOptions, `${cell} 만들기 ${made.status}`)
        if (inOptions) created += 1
        else if (!outsiders.includes(assignee as string))
          assert.equal(made.status, 403, `${cell} 선택지에 없는 짝은 403`)
      }
    }
    const all = (await (await s.api.get(`${s.base}?view=all`, 's-president')).json()) as {
      tasks: unknown[]
    }
    assert.equal(all.tasks.length, created, '거절된 만들기가 기록을 남겼다')
  } finally {
    await s.close()
  }
})

test('만들기 선택지: 다른 학생회 행사 404, 틀린 번호·모르는 키 400, 운영진이 아니면 403, 로그인 없으면 401', async () => {
  const s = await start()
  try {
    const other = await seedCouncil(s.db, s.pg, 'o')
    const foreign = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: other.councilId,
        actor: other.people.president.memberId,
        values: { name: '남의 축제', ownerId: other.people.plain.memberId },
      }),
    )
    const get = (query: string, user?: string) => s.api.get(`${s.base}/options${query}`, user)
    assert.equal((await get(`?event=${foreign}`, 's-president')).status, 404)
    assert.equal((await get('?event=nope', 's-president')).status, 400)
    assert.equal((await get('?x=1', 's-president')).status, 400)
    assert.equal((await get('', 'o-president')).status, 403)
    assert.equal((await get('', 's-ended')).status, 403)
    assert.equal((await get('')).status, 401)
    const text = JSON.stringify(await (await get('', 's-president')).json())
    assert.ok(!text.includes(other.people.president.memberId), '다른 학생회 사람이 실렸다')
    assert.ok(!text.includes(s.council.people.ended.memberId), '떠난 사람이 실렸다')
  } finally {
    await s.close()
  }
})
