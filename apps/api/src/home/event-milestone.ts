import {
  DAY_MS,
  HOME_EVENT_MILESTONES,
  daysBetween,
  koreanDateOf,
  type HomeEventLane,
  type HomeEventMilestone,
} from '@vada/contracts'
import { eventEndDayOf } from '../events/end-day.js'

type Candidate = { kind: HomeEventMilestone; at: Date; date: string }

export type MilestoneInput = {
  startsAt: Date | null
  endsAt: Date | null
  ongoing: boolean
  // 멈추지 않은 양식(초안·멈춤은 뺀다)
  forms: { opensAt: Date | null; closesAt: Date }[]
}

const candidate = (kind: HomeEventMilestone, at: Date | null): Candidate[] =>
  at ? [{ kind, at, date: koreanDateOf(at) }] : []

// 진행 중인 행사의 끝: 끝 시각, 없으면 시작한 날(eventEndDayOf)의 끝이다.
function endOf(input: MilestoneInput): Candidate[] {
  if (!input.ongoing) return []
  const day = eventEndDayOf(input)
  if (!day) return []
  const at = input.endsAt ?? new Date(Date.parse(`${day}T00:00:00+09:00`) + DAY_MS - 1)
  return [{ kind: 'event_end', at, date: day }]
}

// 다음 일정: 신청 시작·신청 마감·행사 시작·(진행 중이면) 행사 종료 가운데 지금 뒤의 가장 이른 것. 같은 시각이면 HOME_EVENT_MILESTONES 차례다.
export function milestoneOf(input: MilestoneInput, now: Date): HomeEventLane['milestone'] {
  const all = [
    ...input.forms.flatMap(form => [
      ...candidate('registration_open', form.opensAt),
      ...candidate('registration_close', form.closesAt),
    ]),
    ...candidate('event_start', input.startsAt),
    ...endOf(input),
  ].filter(item => item.at.getTime() > now.getTime())
  const [next] = all.sort(
    (a, b) =>
      a.at.getTime() - b.at.getTime() ||
      HOME_EVENT_MILESTONES.indexOf(a.kind) - HOME_EVENT_MILESTONES.indexOf(b.kind),
  )
  if (!next) return null
  return { kind: next.kind, date: next.date, days: daysBetween(koreanDateOf(now), next.date) }
}
