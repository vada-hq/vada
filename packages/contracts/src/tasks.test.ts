import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import { ChangeTaskStatusSchema, CreateTaskSchema, DeleteTaskSchema, TASK_DESCRIPTION_MAX, TASK_STATUS_LABELS, TASK_TITLE_MAX,
  UpdateTaskSchema } from './tasks.js'

// 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const emoji = '😀'
type Schema = { safeParse: (value: unknown) => { success: boolean } }
const accepts = (schema: Schema, values: unknown[]) => {
  for (const value of values) assert.equal(schema.safeParse(value).success, true, JSON.stringify(value))
}
const rejects = (schema: Schema, values: unknown[]) => {
  for (const value of values) assert.equal(schema.safeParse(value).success, false, JSON.stringify(value))
}

const task = { title: '현수막 디자인', description: '시안 두 개', departmentId: 'dp', assigneeMembershipId: 'mq', dueOn: '2026-10-20' }
const without = (key: keyof typeof task) => Object.fromEntries(Object.entries(task).filter(([name]) => name !== key))

test('업무: 제목은 꼭 있고, 설명·부서·담당자·마감일은 null로 비운다', () => {
  for (const schema of [CreateTaskSchema, UpdateTaskSchema, ChangeTaskStatusSchema, DeleteTaskSchema]) assert.equal(isStrictObject(schema), true)
  accepts(CreateTaskSchema, [task, { ...task, description: null, departmentId: null, assigneeMembershipId: null, dueOn: null },
    { ...task, title: emoji.repeat(TASK_TITLE_MAX) }, { ...task, description: emoji.repeat(TASK_DESCRIPTION_MAX) },
    { ...task, dueOn: '2000-01-01' }, { ...task, dueOn: '2999-12-31' }, { ...task, dueOn: '2028-02-29' }, { ...task, description: '첫 줄\n둘째 줄' }])
  assert.deepEqual(CreateTaskSchema.parse({ ...task, title: '  현수막 디자인 ', description: ' 시안 두 개  ' }), task)
  rejects(CreateTaskSchema, [without('title'), without('description'), without('departmentId'), without('assigneeMembershipId'), without('dueOn'),
    { ...task, title: '' }, { ...task, title: '   ' }, { ...task, title: emoji.repeat(TASK_TITLE_MAX + 1) }, { ...task, title: `현수막${nul}` },
    { ...task, title: `현수막${lone}` }, { ...task, description: '' }, { ...task, description: ' \n ' },
    { ...task, description: emoji.repeat(TASK_DESCRIPTION_MAX + 1) }, { ...task, description: `설명${nul}` },
    { ...task, departmentId: '' }, { ...task, departmentId: 'd'.repeat(65) }, { ...task, assigneeMembershipId: `m${nul}` },
    { ...task, dueOn: '2026-02-30' }, { ...task, dueOn: '2027-02-29' }, { ...task, dueOn: '1999-12-31' }, { ...task, dueOn: '3000-01-01' },
    { ...task, dueOn: '2026-1-1' }, { ...task, dueOn: '' }, { ...task, status: 'todo' }, { ...task, extra: 1 }])
})

test('업무 수정: 버전과 모든 칸을 다시 보낸다', () => {
  accepts(UpdateTaskSchema, [{ ...task, version: 1 }, { ...task, version: 7, dueOn: null }])
  rejects(UpdateTaskSchema, [task, { ...task, version: 0 }, { ...task, version: 1.5 }, { ...task, version: '1' }, { version: 1, title: '제목' }])
})

test('상태 바꾸기·지우기: 버전과 정한 상태만 받는다', () => {
  accepts(ChangeTaskStatusSchema, ['todo', 'doing', 'done'].map(status => ({ version: 1, status })))
  rejects(ChangeTaskStatusSchema, [{ version: 1, status: 'review' }, { version: 1 }, { status: 'done' }, { version: 1, status: 'done', extra: 1 }])
  accepts(DeleteTaskSchema, [{ version: 3 }])
  rejects(DeleteTaskSchema, [{}, { version: 0 }, { version: 1, reason: '중복' }])
  assert.deepEqual(TASK_STATUS_LABELS, { todo: '예정', doing: '진행 중', done: '완료' })
})
