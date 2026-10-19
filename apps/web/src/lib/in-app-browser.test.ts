import { expect, test } from 'vitest'
import { isKakaoInAppBrowser, openOutsideKakao } from './in-app-browser'

const android =
  'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/10.9.0'
const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0'
const chrome =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

test('카카오톡 내장 브라우저면 현재 주소를 기본 브라우저로 넘긴다', () => {
  const location = { href: 'https://vada-m1.onrender.com/join/ABCD2345' }
  expect(openOutsideKakao(android, location)).toBe(true)
  expect(location.href).toBe(
    'kakaotalk://web/openExternal?url=https%3A%2F%2Fvada-m1.onrender.com%2Fjoin%2FABCD2345',
  )
  expect(isKakaoInAppBrowser(iphone)).toBe(true)
})

test('다른 브라우저는 그대로 둔다', () => {
  const location = { href: 'https://vada-m1.onrender.com/' }
  expect(openOutsideKakao(chrome, location)).toBe(false)
  expect(location.href).toBe('https://vada-m1.onrender.com/')
})
