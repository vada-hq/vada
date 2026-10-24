import { expect, test } from 'vitest'
import { inviteCodeFromPath, inviteCodeFromText, inviteLink, invitePath } from './invite-path'

test('초대 경로에서 코드를 꺼내고, 깨진 인코딩은 그대로 서버에 맡긴다', () => {
  expect(inviteCodeFromPath('/join/ABCD2345')).toBe('ABCD2345')
  expect(inviteCodeFromPath('/join/ab%20cd')).toBe('ab cd')
  expect(inviteCodeFromPath('/join/%E0%A4%A')).toBe('%E0%A4%A')
  expect(inviteCodeFromPath('/join/ABCD2345/')).toBe('ABCD2345')
  expect(inviteCodeFromPath('/join/ABCD2345//')).toBeNull()
  expect(inviteCodeFromPath('/')).toBeNull()
  expect(inviteCodeFromPath('/join/')).toBeNull()
  expect(inviteCodeFromPath('/join/a/b')).toBeNull()
  expect(invitePath('AB CD')).toBe('/join/AB%20CD')
  expect(inviteLink('ABCD2345', 'https://vada.test')).toBe('https://vada.test/join/ABCD2345')
})

test('붙여 넣은 초대 링크에서 코드만 꺼내고, 코드만 쓴 입력은 그대로 둔다', () => {
  expect(inviteCodeFromText('https://vada-m1.onrender.com/join/ABCD2345')).toBe('ABCD2345')
  expect(inviteCodeFromText('vada-m1.onrender.com/join/abcd2345?from=kakao')).toBe('abcd2345')
  expect(inviteCodeFromText('https://vada-m1.onrender.com/join/%E0%A4%A')).toBe('%E0%A4%A')
  expect(inviteCodeFromText(' ABCD2345 ')).toBe(' ABCD2345 ')
})
