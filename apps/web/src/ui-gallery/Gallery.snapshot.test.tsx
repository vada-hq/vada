// @vitest-environment jsdom
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { snapshotHtml } from '@/test-support/snapshot-html'
import { gallerySections } from './Gallery'

// 앞 묶음의 useId 변경이 뒤 스냅숏에 번지지 않게 각각 그린다(r01 조각 10).
// 대화상자를 연 모양은 Gallery.overlay.snapshot.test.tsx가 맡는다.
afterEach(cleanup)

const snapshotDirectory = join(dirname(fileURLToPath(import.meta.url)), '__snapshots__/gallery')
const sections = gallerySections.map(Section => [Section.name, Section] as const)

test('섹션 이름과 스냅숏 파일 목록', async () => {
  expect(sections.length).toBeGreaterThan(0)
  const names = sections.map(([name]) => name)
  expect(new Set(names).size).toBe(names.length)
  for (const name of names) expect(name).toMatch(/^[A-Z][A-Za-z0-9]*Section$/)

  const expected = new Set(names.map(name => `${name}.html`))
  // Vitest는 시험이 끝난 뒤 새 파일을 저장한다. 빠진 파일은 각 파일 스냅숏이 검사한다.
  const files = existsSync(snapshotDirectory) ? await readdir(snapshotDirectory) : []
  expect(
    files.filter(file => !expected.has(file)),
    '삭제하거나 이름을 바꾼 섹션의 스냅숏 파일을 지워 주세요.',
  ).toEqual([])
})

test.each(sections)('%s', async (name, Section) => {
  render(<Section />)
  await expect(snapshotHtml()).toMatchFileSnapshot(`__snapshots__/gallery/${name}.html`)
})
