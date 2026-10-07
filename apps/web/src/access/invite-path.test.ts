import { expect, test } from 'vitest'
import { inviteCodeFromPath, invitePath } from './invite-path'

test('초대 경로에서 코드를 꺼내고, 깨진 인코딩은 그대로 서버에 맡긴다', () => {
  expect(inviteCodeFromPath('/join/ABCD2345')).toBe('ABCD2345')
  expect(inviteCodeFromPath('/join/ab%20cd')).toBe('ab cd')
  expect(inviteCodeFromPath('/join/%E0%A4%A')).toBe('%E0%A4%A')
  expect(inviteCodeFromPath('/')).toBeNull()
  expect(inviteCodeFromPath('/join/')).toBeNull()
  expect(inviteCodeFromPath('/join/a/b')).toBeNull()
  expect(invitePath('AB CD')).toBe('/join/AB%20CD')
})
