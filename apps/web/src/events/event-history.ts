import type { EventChange, EventVersion } from '@vada/contracts'
import { monthDayTime } from '@/lib/korean-date-text'
import { momentLabel } from './event-view'

const NONE = '없음'
const UNKNOWN_PERSON = '알 수 없는 사람'

const momentText = (value: string | null) => (value === null ? NONE : momentLabel(value))
const placeText = (value: string | null) => value ?? NONE
const personText = (side: { id: string; name: string | null } | null) =>
  side === null ? NONE : (side.name ?? UNKNOWN_PERSON)

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
      return `장소 ${placeText(change.from)} → ${placeText(change.to)}`
    case 'owner':
      return `담당 ${personText(change.from)} → ${personText(change.to)}`
  }
}

// 이력 한 줄: '이름 · 10월 20일 14:03 · 장소 없음 → 학생회관'
export function versionLine(version: EventVersion) {
  return [
    version.by?.name ?? UNKNOWN_PERSON,
    monthDayTime(version.at),
    version.changes.map(changeText).join(', '),
  ].join(' · ')
}
