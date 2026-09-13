import { expect, test } from '@playwright/test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import type { Manifest } from 'vite'

const dist = new URL('../dist/', import.meta.url)
const screens = new URL('../../../specs/figma/vada-wireframe/screens/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('assets/bundle-manifest.json', dist), 'utf8')) as Manifest

test('모든 Figma 그림을 원본과 같은 개별 파일로 배포한다', () => {
  let checked = 0
  for (const screen of readdirSync(screens, { withFileTypes: true })) {
    if (!screen.isDirectory()) continue
    const directory = new URL(`${screen.name}/assets/`, screens)
    if (!existsSync(directory)) continue
    for (const file of readdirSync(directory).filter(name => /\.(svg|png)$/.test(name))) {
      const source = `../../specs/figma/vada-wireframe/screens/${screen.name}/assets/${file}`
      const output = manifest[source]?.file
      expect(output, source).toMatch(/^assets\/[^/]+\.(svg|png)$/)
      expect(readFileSync(new URL(output!, dist)), source).toEqual(readFileSync(new URL(file, directory)))
      checked += 1
    }
  }
  expect(checked).toBeGreaterThan(0)
  console.log(`[Figma 원본 대조] ${checked} files`)
})

test('홈은 표시하는 그림만 요청하고 전체 다운로드 예산을 지킨다', async ({ page }, info) => {
  const requested = new Set<string>()
  page.on('request', req => {
    const path = new URL(req.url()).pathname
    if (/^\/assets\/[^/]+\.(js|svg|png)$/.test(path)) requested.add(path)
  })
  await page.goto('/#/HOME-01K')
  const pictures = page.locator('img[data-asset-node-id]')
  await expect(pictures.first()).toBeVisible()
  await expect.poll(() => pictures.evaluateAll(nodes => nodes.every(node => {
    const img = node as HTMLImageElement
    return img.complete && img.naturalWidth > 0
  }))).toBe(true)

  const files = [...requested].map(path => {
    const body = readFileSync(new URL(path.slice(1), dist))
    return { path, bytes: body.length, gzipBytes: gzipSync(body).length }
  })
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0)
  const gzipBytes = files.reduce((sum, file) => sum + file.gzipBytes, 0)
  await info.attach('home-assets', { body: JSON.stringify({ bytes, gzipBytes, files }, null, 2), contentType: 'application/json' })
  console.log(`[홈 JS·그림] ${files.length} files / ${bytes} bytes / gzip ${gzipBytes} bytes`)

  const drawn = await pictures.evaluateAll(nodes => nodes.map(node => (node as HTMLImageElement).currentSrc))
  for (const src of drawn) expect(new URL(src).pathname).toMatch(/^\/assets\/[^/]+\.(svg|png)$/)
  const drawnPaths = [...new Set(drawn.map(src => new URL(src).pathname))].sort()
  const imagePaths = [...requested].filter(path => /\.(svg|png)$/.test(path)).sort()
  expect(imagePaths).toEqual(drawnPaths)
  // 공통 JS와 실제로 표시한 그림까지 합친다. 분리 전 홈은 이 예산을 넘는다.
  expect(gzipBytes).toBeLessThan(300_000)
})
