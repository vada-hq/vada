import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../http/errors.js'
import { errorCodeOf, uniqueViolationOf } from './error-code.js'

test('오류에서 SQLSTATE나 시스템 오류 코드만 꺼낸다', () => {
  assert.equal(errorCodeOf(Object.assign(new Error('x'), { code: '42501' })), '42501')
  assert.equal(errorCodeOf(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })), 'ECONNREFUSED')
  assert.equal(errorCodeOf(new ApiError('PRESIDENT_CANNOT_LEAVE')), 'PRESIDENT_CANNOT_LEAVE')
})

test('drizzle이 감싼 DB 오류는 cause를 따라가 코드를 꺼낸다', () => {
  const wrapped = new Error('Failed query', {
    cause: Object.assign(new Error('duplicate key'), { code: '23505' }),
  })
  assert.equal(errorCodeOf(wrapped), '23505')
  // 세 단계까지만 따라간다.
  const deep = new Error('a', {
    cause: new Error('b', {
      cause: new Error('c', { cause: Object.assign(new Error('d'), { code: '23505' }) }),
    }),
  })
  assert.equal(errorCodeOf(deep), '')
})

test('코드가 없거나 코드 모양이 아니면 빈 글자이고, 오류 원문은 돌려주지 않는다', () => {
  assert.equal(errorCodeOf(new Error('postgres://u:secret@h/db')), '')
  assert.equal(errorCodeOf(Object.assign(new Error('x'), { code: 'connect failed: secret' })), '')
  assert.equal(errorCodeOf(Object.assign(new Error('x'), { code: 'lower' })), '')
  assert.equal(errorCodeOf('postgres://u:secret@h/db'), '')
  assert.equal(errorCodeOf(undefined), '')
  assert.equal(errorCodeOf(null), '')
})

test('유일 제약 위반은 두 드라이버의 모양(constraint, constraint_name)과 감싼 오류에서 제약 이름을 꺼낸다', () => {
  const pglite = Object.assign(new Error('x'), {
    code: '23505',
    constraint: 'file_storage_key_key',
  })
  const postgresJs = Object.assign(new Error('x'), {
    code: '23505',
    constraint_name: 'file_storage_key_key',
  })
  for (const driver of [pglite, postgresJs]) {
    assert.equal(uniqueViolationOf(driver), 'file_storage_key_key')
    assert.equal(uniqueViolationOf(new Error('wrap', { cause: driver })), 'file_storage_key_key')
  }
  const other = Object.assign(new Error('x'), { code: '23503', constraint_name: 'fk' })
  assert.equal(uniqueViolationOf(other), undefined)
  assert.equal(uniqueViolationOf(Object.assign(new Error('x'), { code: '23505' })), undefined)
  assert.equal(uniqueViolationOf(undefined), undefined)
})
