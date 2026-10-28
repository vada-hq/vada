import { inArray } from 'drizzle-orm'
import { file } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { reportBackgroundFailure } from '../http/on-error.js'
import type { ObjectPurgeLock } from './orphan-lock.js'
import type { FileStorage } from './storage.js'
import { isStorageKey } from './storage-key.js'

const ORPHAN_AGE_MS = 259_200_000
const PREFIXES = ['chat/', 'evidence/']
type Counts = {
  listed: number
  removed: number
  failed: number
  attempted: number
  skipped: number
}
export type ObjectPurgeOptions = { storage: FileStorage; lock: ObjectPurgeLock }
type Sweep = {
  db: Pick<Db, 'select'>
  storage: FileStorage
  cutoff: number
  counts: Counts
  signal: AbortSignal
}

function candidatesOf(
  sweep: Sweep,
  prefix: string,
  objects: { key: string; lastModified: Date }[],
) {
  sweep.counts.listed += objects.length
  return objects.filter(object => {
    if (!isStorageKey(object.key) || !object.key.startsWith(prefix)) {
      sweep.counts.skipped++
      return false
    }
    return object.lastModified.getTime() < sweep.cutoff
  })
}

async function removePage(
  sweep: Sweep,
  prefix: string,
  objects: { key: string; lastModified: Date }[],
) {
  const { db, storage, counts, signal } = sweep
  signal.throwIfAborted()
  const candidates = candidatesOf(sweep, prefix, objects)
  if (!candidates.length) return
  // 학생회나 붙은 기록으로 거르지 않아 증빙 복사본을 포함한 모든 파일 행을 보호한다.
  const linked = await db
    .select({ key: file.storageKey })
    .from(file)
    .where(
      inArray(
        file.storageKey,
        candidates.map(object => object.key),
      ),
    )
  const referenced = new Set(linked.map(row => row.key))
  for (const { key } of candidates) {
    signal.throwIfAborted()
    if (referenced.has(key)) continue
    counts.attempted++
    try {
      await storage.remove(key)
      counts.removed++
    } catch {
      counts.failed++
    }
  }
}

async function sweepPrefix(sweep: Sweep, prefix: string) {
  const seen = new Set<string>()
  let token: string | undefined
  do {
    sweep.signal.throwIfAborted()
    const page = await sweep.storage.list(prefix, token)
    await removePage(sweep, prefix, page.objects)
    token = page.continuationToken
    if (token && seen.has(token)) throw new Error('STORAGE_LIST_FAILED')
    if (token) seen.add(token)
  } while (token)
}

// 24시간을 넘긴 업로드는 붙일 수 없어 72시간 후보를 읽은 뒤 새 참조가 붙는 일과 겹치지 않는다.
export async function runObjectPurge(
  db: Pick<Db, 'select'>,
  now: Date,
  options?: ObjectPurgeOptions,
) {
  if (!options) return false
  const counts: Counts = { listed: 0, removed: 0, failed: 0, attempted: 0, skipped: 0 }
  try {
    return await options.lock(async signal => {
      const sweep: Sweep = {
        db,
        storage: options.storage,
        cutoff: now.getTime() - ORPHAN_AGE_MS,
        counts,
        signal,
      }
      for (const prefix of PREFIXES) {
        try {
          await sweepPrefix(sweep, prefix)
        } catch {
          signal.throwIfAborted()
          counts.failed++
        }
      }
    })
  } catch {
    counts.failed++
    return false
  } finally {
    // 오류 원문에는 키나 이름이 들 수 있어 수집기에도 고정 오류와 개수만 넘긴다.
    if (counts.failed || counts.skipped)
      reportBackgroundFailure('object-purge', new Error('ObjectPurgeFailure'), counts)
  }
}
