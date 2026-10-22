import {
  CLOSING_EXPORT_MAX_BYTES,
  CLOSING_EXPORT_MAX_PHOTOS,
  CLOSING_EXPORT_MAX_ROWS,
  type ClosingExportInfo,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import type { ClosingPeriod } from './period.js'
import { expenseCountOf, photoTotalsOf } from './totals.js'

type Reader = Pick<Db, 'select'>

// 내보내기 정보. 결산서 읽기(exportInfo)와 내보내기 상한 검사가 같은 값을 본다(상한을 판단하는 곳은 여기 하나다).
export async function exportInfoOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
  facts: { incomeCount: number; bundleAvailable: boolean },
): Promise<ClosingExportInfo> {
  const photos = await photoTotalsOf(db, actor, period)
  const expenseCount = await expenseCountOf(db, actor, period)
  const workbookTooLarge =
    expenseCount > CLOSING_EXPORT_MAX_ROWS || facts.incomeCount > CLOSING_EXPORT_MAX_ROWS
  return {
    expenseCount,
    incomeCount: facts.incomeCount,
    photoCount: photos.count,
    photoBytes: photos.bytes,
    workbookTooLarge,
    bundleTooLarge:
      workbookTooLarge ||
      photos.count > CLOSING_EXPORT_MAX_PHOTOS ||
      photos.bytes > CLOSING_EXPORT_MAX_BYTES,
    bundleAvailable: facts.bundleAvailable,
  }
}
