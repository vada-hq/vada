import { expect, test, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import type { Manifest } from 'vite'

async function manifestOf(request: APIRequestContext): Promise<Manifest> {
  const response = await request.get('/assets/bundle-manifest.json')
  expect(response.ok()).toBe(true)
  return response.json()
}

test('로그인은 다른 화면 파일을 받지 않으며 초기 JS 예산을 지킨다', async ({ page, request }, info) => {
  const manifest = await manifestOf(request)
  const scripts = new Set<string>()
  page.on('request', req => {
    const url = new URL(req.url())
    if (url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js')) scripts.add(url.pathname)
  })
  await page.goto('/#/SIGN-IN')
  await expect(page.getByRole('button', { name: '구글로 계속하기' })).toBeVisible()
  expect(scripts.has(`/${manifest['src/screens/SIGNINScreen.tsx']!.file}`)).toBe(true)
  for (const [source, chunk] of Object.entries(manifest)) {
    if (!source.startsWith('src/screens/') || !chunk.isDynamicEntry || source.endsWith('/SIGNINScreen.tsx')) continue
    expect(scripts.has(`/${chunk.file}`), `${source}는 로그인에서 필요하지 않습니다`).toBe(false)
  }
  const files = [...scripts].map(path => {
    const code = readFileSync(new URL(`../dist${path}`, import.meta.url))
    return { path, bytes: code.length, gzipBytes: gzipSync(code).length }
  })
  const bytes = files.reduce((total, file) => total + file.bytes, 0)
  const gzipBytes = files.reduce((total, file) => total + file.gzipBytes, 0)
  // 화면 구현만 분리했을 때는 195.7KB였다. 화면 JSON 88개를 화면별 청크로 옮긴 뒤
  // 150.4KB가 됐다. 공통 파일과 실제 요청한 로그인 파일을 모두 합쳐 재유입을 막는다.
  expect(gzipBytes).toBeLessThan(170_000)
  await info.attach('login-script-bytes', { body: JSON.stringify({ bytes, gzipBytes, files }, null, 2), contentType: 'application/json' })
  console.log(`[로그인 JS] ${files.length} files / ${bytes} bytes / gzip ${gzipBytes} bytes`)
})

test('화면 파일을 받는 동안 로딩 표시 후 로그인 화면을 그린다', async ({ page, request }) => {
  const manifest = await manifestOf(request)
  const path = `**/${manifest['src/screens/SIGNINScreen.tsx']!.file}`
  let release!: () => void
  let blocked = false
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(path, async route => {
    blocked = true
    await gate
    await route.continue()
  })
  try {
    await page.goto('/#/SIGN-IN', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => blocked).toBe(true)
    await expect(page.getByRole('status').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '구글로 계속하기' })).toHaveCount(0)
  } finally {
    release()
  }
  await expect(page.getByRole('button', { name: '구글로 계속하기' })).toBeVisible()
})

test('화면 파일 요청이 실패하면 안내하고 새로고침으로 복구한다', async ({ page, request }) => {
  const manifest = await manifestOf(request)
  const path = `**/${manifest['src/screens/SIGNINScreen.tsx']!.file}`
  await page.route(path, route => route.abort())
  await page.goto('/#/SIGN-IN')
  await expect(page.getByRole('alert')).toContainText('화면을 불러오지 못했습니다')
  await page.unroute(path)
  await page.getByRole('button', { name: '새로고침' }).click()
  await expect(page.getByRole('button', { name: '구글로 계속하기' })).toBeVisible()
  await expect(page).toHaveURL(/#\/SIGN-IN$/)
})

test('다른 화면을 불러왔다가 뒤로 가도 초안과 받은 화면 파일을 유지한다', async ({ page, request }) => {
  const manifest = await manifestOf(request)
  const path = `/${manifest['src/screens/ONB01Screen.tsx']!.file}`
  let requested = 0
  page.on('request', req => { if (new URL(req.url()).pathname === path) requested += 1 })
  await page.goto('/#/ONB-01')
  await page.getByRole('textbox', { name: '이름*' }).fill('남길 이름')
  await page.evaluate(() => { window.location.hash = '#/ONB-02' })
  await expect(page.getByRole('heading', { name: '어떻게 시작하시겠어요?' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('textbox', { name: '이름*' })).toHaveValue('남길 이름')
  expect(requested).toBe(1)
})
