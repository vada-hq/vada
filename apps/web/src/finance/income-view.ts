import type { IncomeChange, IncomeSource, IncomeVersion } from '@vada/contracts'
import { monthDayTime } from '@/lib/korean-date-text'

// 참가비는 행사 완료 때, 이월금은 결산 공개 때 서버가 만든다. 출처 이름이 곧 그 표시다.
export const SOURCE_LABEL: Record<IncomeSource, string> = {
  fee: '학생회비',
  grant: '지원금',
  business: '사업 수익',
  donation: '후원금',
  other: '기타',
  participation_fee: '참가비',
  carryover: '이월금',
}

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
