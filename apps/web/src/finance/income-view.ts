import { SOURCE_LABEL, type IncomeChange, type IncomeVersion } from '@vada/contracts'
import { monthDayTime } from '@/lib/korean-date-text'

export { SOURCE_LABEL }

const UNKNOWN_PERSON = '알 수 없는 사람'
const CHANGE_TEXT: Record<IncomeChange['field'], string> = {
  created: '적음',
  cancelled: '취소함',
}

// 이력 한 줄: '이름 · 10월 20일 14:03 · 취소함: 사유'. 사유는 취소할 때 받은 것이다.
export function versionLine(version: IncomeVersion) {
  const changes = version.changes.map(change => CHANGE_TEXT[change.field]).join(', ')
  return [
    version.by?.name ?? UNKNOWN_PERSON,
    monthDayTime(version.at),
    version.reason ? `${changes}: ${version.reason}` : changes,
  ].join(' · ')
}
