import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TASK_ACTIONS, type TaskAction, type TaskDetail } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
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
  'task.manage': id => [id, { title: '고침', body: null, dueDate: null }],
  'task.delete': id => [`${id}/delete`, {}],
  'task.set_department': id => [`${id}/department`, { departmentId: null }],
  'task.assign': id => [`${id}/assignee`, { assigneeId: null }],
  'task.status': id => [`${id}/status`, { status: 'in_progress' }],
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
      planningHead: ['task.manage', 'task.delete', 'task.assign', 'task.status'],
      planningMember: ['task.manage', 'task.status'],
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
      planningHead: ['task.manage', 'task.delete', 'task.assign', 'task.status'],
      planningMember: ['task.manage', 'task.delete', 'task.status'],
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
      planningHead: ['task.manage', 'task.delete', 'task.assign', 'task.status'],
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
      tasks: createTaskRoutes(db, testSession, { clock: () => noon }),
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
  return { council, api, base, make, close }
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
