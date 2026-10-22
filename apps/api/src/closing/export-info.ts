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

// 내보내기 정보. 결산서 읽기(exportInfo)와 내보내기 상한 검사가 같은 수를 본다.
export async function exportInfoOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
  incomeCount: number,
): Promise<ClosingExportInfo> {
  const photos = await photoTotalsOf(db, actor, period)
  const expenseCount = await expenseCountOf(db, actor, period)
  return {
    expenseCount,
    incomeCount,
    photoCount: photos.count,
    photoBytes: photos.bytes,
    tooLarge:
      expenseCount > CLOSING_EXPORT_MAX_ROWS ||
      incomeCount > CLOSING_EXPORT_MAX_ROWS ||
      photos.count > CLOSING_EXPORT_MAX_PHOTOS ||
      photos.bytes > CLOSING_EXPORT_MAX_BYTES,
  }
}
