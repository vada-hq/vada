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
  const event = (ownerId: string) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: council.councilId,
        actor: idOf('president'),
        values: { name: '봄 축제', ownerId },
      }),
    )
  const task = (eventId: string | null, departmentId: string, assigneeId: string | null = null) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: council.councilId,
        actor: idOf('president'),
        values: { title: '현수막 주문', departmentId, assigneeId, eventId },
      }),
    )
  const count = async () =>
    Number(((await pg.query('SELECT count(*) AS n FROM task')).rows[0] as { n: string }).n)
  return { council, db, pg, api, base, make, event, task, count, close }
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
    // 행사 칸마다 새 행사를 둔다: 앞 칸이 만든 업무가 그 행사의 담당 부서를 바꾸지 않게 한다.
    const freshEvent = () => s.event(id('plain'))
    const staffedEvent = async () => {
      const eventId = await freshEvent()
      await s.task(eventId, planning)
      return eventId
    }
    const everything = [finance, planning, null].flatMap(item => pairs(item, withNone))
    const onlyMe = (person: keyof typeof people) => [
      ...pairs(planning, [id(person)]),
      ...pairs(null, [id(person)]),
    ]
    const headPairs = [...pairs(planning, withNone), ...pairs(null, [id('planningHead')])]
    // 직급마다 기대하는 선택지. 부장은 자기 부서의 모두, 그 밖은 나만이다. 떠난 사람은 어디에도 없다.
    // 행사에서는 그 행사의 담당 부서가 아닌 부서가 책임자와 회장단에게만 있다(DEC-94).
    const cases: { name: string; person: Person; event?: string; expected: string[] }[] = [
      { name: '회장단', person: 'president', expected: everything },
      { name: '부장', person: 'planningHead', expected: headPairs },
      { name: '부원', person: 'planningMember', expected: onlyMe('planningMember') },
      { name: '부서 없는 운영진', person: 'plain', expected: pairs(null, [id('plain')]) },
      { name: '행사 책임자', person: 'plain', event: await freshEvent(), expected: everything },
      {
        name: '회장단의 남의 행사',
        person: 'president',
        event: await freshEvent(),
        expected: everything,
      },
      {
        name: '기획부 업무가 없는 행사의 부원',
        person: 'planningMember',
        event: await freshEvent(),
        expected: pairs(null, [id('planningMember')]),
      },
      {
        name: '기획부 업무가 없는 행사의 부장',
        person: 'planningHead',
        event: await freshEvent(),
        expected: pairs(null, [id('planningHead')]),
      },
      {
        name: '기획부 업무가 있는 행사의 부원',
        person: 'planningMember',
        event: await staffedEvent(),
        expected: onlyMe('planningMember'),
      },
      {
        name: '기획부 업무가 있는 행사의 부장',
        person: 'planningHead',
        event: await staffedEvent(),
        expected: headPairs,
      },
    ]
    // 후보에는 선택지에 없어야 하는 사람(떠난 사람, 다른 학생회 사람)도 넣는다.
    const other = await seedCouncil(s.db, s.pg, 'o')
    const outsiders = [id('ended'), other.people.president.memberId]
    let created = await s.count()
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
    assert.equal(await s.count(), created, '거절된 만들기가 기록을 남겼다')
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

// 행사 바꾸기(DEC-94): 선택지의 이을 수 있는 행사(linkableEvents)에 있으면 바꾸기가 200이고, 없으면 403이며 행사가 그대로다.
// 만들기·선택지·바꾸기가 같은 decideEventLink를 쓰므로 어느 한 경로에서 판정을 지우면 이 표나 위 표가 실패한다.
type Target = 'staffed' | 'empty' | 'plainOwns'
const TARGETS: Target[] = ['staffed', 'empty', 'plainOwns']
// 기획부 업무가 있는 행사는 누구나, 빈 행사는 회장단만, 책임자의 행사는 책임자와 회장단이다.
const LINKABLE: Record<Person, Target[]> = {
  president: ['staffed', 'empty', 'plainOwns'],
  planningHead: ['staffed'],
  planningMember: ['staffed'],
  plain: ['staffed', 'plainOwns'],
}

test('행사 바꾸기 × 직급: 이을 수 있는 행사에 있으면 200, 없으면 403이고 행사가 그대로다', async () => {
  const s = await start()
  try {
    const id = (person: Person) => s.council.people[person].memberId
    const { planning } = s.council.departments
    // 사람마다 고칠 수 있는 기획부 업무: 회장단과 부장은 맡지 않은 것, 부원과 책임자는 자기가 맡은 것.
    // 책임자는 자기 행사의 업무만 고치므로 자기 행사에서 시작한다.
    const own = async (person: Person) => {
      if (person === 'plain') return s.task(await s.event(id('plain')), planning, id('plain'))
      return s.task(null, planning, person === 'planningMember' ? id(person) : null)
    }
    const target = async (kind: Target) => {
      if (kind === 'plainOwns') return s.event(id('plain'))
      const eventId = await s.event(id('president'))
      if (kind === 'staffed') await s.task(eventId, planning)
      return eventId
    }
    const eventOf = async (taskId: string) => {
      const read = await s.api.get(`${s.base}/${taskId}`, 's-president')
      return ((await read.json()) as { task: TaskDetail }).task.event?.id ?? null
    }
    for (const person of PEOPLE)
      for (const kind of TARGETS) {
        const cell = `${person} ${kind}`
        const taskId = await own(person)
        const eventId = await target(kind)
        const user = `s-${person}`
        const options = (await (await s.api.get(`${s.base}/options`, user)).json()) as Options & {
          linkableEvents: { departmentId: string | null; eventIds: string[] }[]
        }
        const linkable = options.linkableEvents
          .find(item => item.departmentId === planning)!
          .eventIds.includes(eventId)
        assert.equal(linkable, LINKABLE[person].includes(kind), `${cell} 선택지`)
        const before = await eventOf(taskId)
        const body = { title: '현수막 주문', body: null, dueDate: null, eventId }
        const response = await s.api.post(`${s.base}/${taskId}`, body, user)
        assert.equal(response.status, linkable ? 200 : 403, `${cell} 바꾸기`)
        assert.equal(await eventOf(taskId), linkable ? eventId : before, `${cell} 행사`)
      }
  } finally {
    await s.close()
  }
})
