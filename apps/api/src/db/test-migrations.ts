import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const migrationsFolder = fileURLToPath(new URL('../../migrations', import.meta.url))

// 테스트용: tag 바로 앞까지의 마이그레이션만 담은 임시 폴더를 만든다. 다 쓰면 remove()로 지운다.
export function migrationsBefore(tag: string) {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8')) as { entries: { tag: string }[] }
  const index = journal.entries.findIndex(entry => entry.tag === tag)
  if (index <= 0) throw new Error(`Migration not found: ${tag}`)
  const entries = journal.entries.slice(0, index)
  const folder = mkdtempSync(join(tmpdir(), 'vada-migrations-'))
  mkdirSync(join(folder, 'meta'))
  writeFileSync(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }))
  for (const entry of entries) copyFileSync(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`))
  return { folder, remove: () => rmSync(folder, { recursive: true, force: true }) }
}
