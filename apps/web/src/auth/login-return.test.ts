import { expect, test } from 'vitest'
import { loginCallback, loginReturnPath } from './login-return'

const C = '0199d1a0-0000-7000-8000-0000000000c1'
const T = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const BACKSLASH = String.fromCharCode(92)

test('학생회 안 주소는 경로와 쿼리를 그대로 돌아올 곳으로 삼는다', () => {
  expect(loginReturnPath(`/home/${C}`)).toBe(`/home/${C}`)
  expect(loginReturnPath(`/tasks/${C}/${T}`)).toBe(`/tasks/${C}/${T}`)
  expect(loginReturnPath(`/tasks/${C}?view=all&filter=done`)).toBe(
    `/tasks/${C}?view=all&filter=done`,
  )
  expect(loginReturnPath(`/finance/${C}/`)).toBe(`/finance/${C}`)
})

test('해석기가 아는 값만 남긴다: 모르는 쿼리는 버린다', () => {
  expect(loginReturnPath(`/tasks/${C}?view=all&utm=//evil.com&token=abc`)).toBe(
    `/tasks/${C}?view=all`,
  )
})

test('바깥 주소, //, 역슬래시, 모르는 꼴은 /로 바뀐다', () => {
  for (const bad of [
    '//evil.com',
    '//evil.com/home/' + C,
    `/${BACKSLASH}evil.com`,
    `/${BACKSLASH}home/${C}`,
    'https://evil.com/x',
    'javascript:alert(1)',
    `/%2F%2Fevil.com`,
    `/home/${C}/../../x`,
    '/nope/' + C,
    '/home/not-a-uuid',
    '',
    '/',
  ])
    expect(loginReturnPath(bad), bad).toBe('/')
})

test('공개 주소와 초대 주소, 로그인 끝 주소는 돌아올 곳이 아니다', () => {
  for (const path of [
    '/apply/ABCD2345',
    '/apply/ABCD2345/',
    '/r',
    '/r#token',
    '/join/ABCD2345',
    '/auth-done',
  ])
    expect(loginReturnPath(path), path).toBe('/')
})

test('초대 링크가 먼저다', () => {
  expect(loginCallback({ code: 'ABCD2345', from: 'link' }, `/home/${C}`)).toBe('/join/ABCD2345')
  expect(loginCallback({ code: 'ABCD2345', from: 'form' }, `/home/${C}`)).toBe(`/home/${C}`)
  expect(loginCallback(null, `/home/${C}`)).toBe(`/home/${C}`)
  expect(loginCallback(null, '//evil.com')).toBe('/')
})
