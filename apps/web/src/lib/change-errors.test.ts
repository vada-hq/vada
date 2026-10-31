import { expect, test } from 'vitest'
import { changeErrors, VERSION_CONFLICT_MESSAGE } from './change-errors'
import { EVENT_ERRORS, SEND_ERRORS, WITHDRAW_ERRORS } from './messages'
import { REGISTRATION_STAFF_ERRORS } from './registration-messages'

test('학생회를 바꾸는 화면의 표는 그만두는 학생회에 같은 문구를 보이고, 표의 문구는 그대로다', () => {
  const closing = changeErrors({}).COUNCIL_CLOSING
  expect(closing).toBe('학생회를 그만두는 중이라 읽기만 할 수 있어요.')
  for (const table of [EVENT_ERRORS, SEND_ERRORS, REGISTRATION_STAFF_ERRORS])
    expect(table.COUNCIL_CLOSING).toBe(closing)
  expect(changeErrors({ FORBIDDEN: '권한' })).toEqual({
    COUNCIL_CLOSING: closing,
    VERSION_CONFLICT: VERSION_CONFLICT_MESSAGE,
    FORBIDDEN: '권한',
  })
  // 학생회를 바꾸지 않는 화면(탈퇴)에는 없다.
  expect(WITHDRAW_ERRORS.COUNCIL_CLOSING).toBeUndefined()
})
