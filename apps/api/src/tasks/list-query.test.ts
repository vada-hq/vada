import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../http/errors.js'
import { listQueryOf } from './list-query.js'

test('view만 주면 status는 open이다', () => {
  assert.deepEqual(listQueryOf({ view: ['mine'] }), { view: 'mine', status: 'open' })
  assert.deepEqual(listQueryOf({ view: ['all'], status: ['done'] }), {
    view: 'all',
    status: 'done',
  })
})

test('event=none은 행사 없는 업무 범위이고 다른 값이나 중복은 거절한다', () => {
  assert.deepEqual(listQueryOf({ view: ['all'], event: ['none'] }), {
    view: 'all',
    status: 'open',
    event: 'none',
  })
  for (const event of [['nope'], [''], ['none', 'none']])
    assert.throws(() => listQueryOf({ view: ['all'], event }), ApiError)
})

test('같은 키 두 번, 모르는 키, 틀린 값, 빠진 view는 INVALID_INPUT이다', () => {
  const bad: Record<string, string[]>[] = [
    { view: ['mine', 'all'] },
    { view: ['mine'], x: ['1'] },
    { view: ['other'] },
    { view: ['mine'], status: ['cancelled'] },
    { status: ['open'] },
    {},
    { view: [] },
  ]
  for (const query of bad)
    assert.throws(
      () => listQueryOf(query),
      error => error instanceof ApiError && error.code === 'INVALID_INPUT',
      JSON.stringify(query),
    )
})

test('거르기 키는 화면 주소와 같은 값을 받고 부서·담당자 번호는 소문자로 읽는다', () => {
  const id = '0199D1A0-0000-7000-8000-0000000000D1'
  assert.deepEqual(
    listQueryOf({
      view: ['all'],
      dept: [id],
      due: ['week'],
      assignee: ['none'],
      attention: ['true'],
      heads: ['true'],
    }),
    {
      view: 'all',
      status: 'open',
      dept: id.toLowerCase(),
      due: 'week',
      assignee: 'none',
      attention: 'true',
      heads: 'true',
    },
  )
  for (const bad of [
    { due: ['soon'] },
    { dept: ['x'] },
    { attention: ['1'] },
    { heads: ['false'] },
  ])
    assert.throws(() => listQueryOf({ view: ['all'], ...bad }), ApiError, JSON.stringify(bad))
})
