import type { EventChange, EventVersion } from '@vada/contracts'
import { monthDayTime } from '@/lib/korean-date-text'
import { momentLabel, NO_OWNER_LABEL } from './event-view'

const NONE = '없음'
const TBD = '미정'
const UNKNOWN_PERSON = '알 수 없는 사람'

type Person = { id: string; name: string | null } | null
const personText = (side: Person) =>
  side === null ? NO_OWNER_LABEL : (side.name ?? UNKNOWN_PERSON)
const momentText = (value: string | null) => (value === null ? TBD : momentLabel(value))

function changeText(change: EventChange) {
  switch (change.field) {
    case 'created':
      return '만듦'
    case 'name':
      return `이름 ${change.from} → ${change.to}`
    case 'startsAt':
      return `시작 ${momentText(change.from)} → ${momentText(change.to)}`
    case 'endsAt':
      return `끝 ${momentText(change.from)} → ${momentText(change.to)}`
    case 'place':
      return `장소 ${change.from ?? NONE} → ${change.to ?? NONE}`
    case 'owner':
      return `책임자 ${personText(change.from)} → ${personText(change.to)}`
  }
}

// 이력 한 줄: '이름 · 10월 20일 14:03 · 책임자 책임자 없음 → 김회장'
export function eventVersionLine(version: EventVersion) {
  return [
    version.by?.name ?? UNKNOWN_PERSON,
    monthDayTime(version.at),
    version.changes.map(changeText).join(', '),
  ].join(' · ')
}
