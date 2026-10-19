import { expect, test } from 'vitest'
import { deviceOf, isIosHomeScreenApp } from './platform'

const ua = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneKakao: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
}

test('사용자 에이전트로 아이폰, 안드로이드, 그 밖을 가린다', () => {
  expect(deviceOf(ua.iphoneSafari)).toBe('ios')
  expect(deviceOf(ua.iphoneKakao)).toBe('ios')
  expect(deviceOf(ua.ipadDesktop, 5)).toBe('ios')
  expect(deviceOf(ua.ipadDesktop, 0)).toBe('other')
  expect(deviceOf(ua.androidChrome)).toBe('android')
  expect(deviceOf(ua.samsung)).toBe('android')
  expect(deviceOf(ua.windowsChrome)).toBe('other')
})

test('iOS 홈 화면 앱에서만 참이다', () => {
  expect(isIosHomeScreenApp({ standalone: true })).toBe(true)
  expect(isIosHomeScreenApp({ standalone: false })).toBe(false)
  expect(isIosHomeScreenApp({})).toBe(false)
})
