import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const publicFile = (path: string) => new URL(`../public/${path}`, import.meta.url)
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

test('홈 화면 설정은 VADA를 앱처럼 연다', () => {
  const manifest = JSON.parse(readFileSync(publicFile('manifest.webmanifest'), 'utf8')) as {
    icons: unknown
  }
  expect(manifest).toMatchObject({
    id: '/',
    name: 'VADA',
    short_name: 'VADA',
    description: '학생회 대화, 업무, 재정을 한곳에서',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#155dfc',
    background_color: '#ffffff',
  })
  expect(manifest.icons).toEqual([
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ])
})

test('아이콘 파일은 PNG이고 적힌 크기와 같다', () => {
  for (const [path, size] of [
    ['icons/icon-16.png', 16],
    ['icons/icon-32.png', 32],
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/maskable-192.png', 192],
    ['icons/maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
  ] as const) {
    const bytes = readFileSync(publicFile(path))
    expect(bytes.subarray(0, 8)).toEqual(PNG)
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([size, size])
  }
})

test.each(['index.html', 'ui.html'])('%s: 탭과 Apple 아이콘을 잇는다', file => {
  const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  for (const tag of [
    '<link rel="icon" href="/icons/icon-16.png" sizes="16x16" type="image/png" />',
    '<link rel="icon" href="/icons/icon-32.png" sizes="32x32" type="image/png" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  ]) {
    expect(html).toContain(tag)
  }
})

test('페이지가 홈 화면 설정과 아이콘을 잇는다', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  for (const tag of [
    '<link rel="manifest" href="/manifest.webmanifest" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<meta name="theme-color" content="#155dfc" />',
    '<meta name="apple-mobile-web-app-title" content="VADA" />',
    '<title>VADA</title>',
  ]) {
    expect(html).toContain(tag)
  }
})
