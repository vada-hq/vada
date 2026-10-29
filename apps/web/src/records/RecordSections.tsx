import type { ReactNode } from 'react'
import type { EventRecord, EventTab } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { dayLabel, dayTimeLabel } from '@/lib/korean-date-text'
import { openRecord } from '@/lib/go-to'
import { signedWon } from '../finance/closing-view'
import { wonLabel } from '../finance/purchase-view'
import { recordWhen, TIMELINE_PREFIX, type RecordSectionId } from './record-view'

export type RecordSectionProps = { councilId: string; record: EventRecord; now?: Date | undefined }

const NONE = '미정'

// 이름과 값 한 줄(와이어프레임 REC-02 개요·성과의 왼쪽 이름, 오른쪽 값). 휴대폰은 위아래로 놓는다.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-sm text-fg-muted sm:w-32">{label}</dt>
      <dd className="min-w-0 text-sm text-fg-body tabular-nums wrap-anywhere">{children}</dd>
    </div>
  )
}

const joined = (parts: (string | null)[]) => parts.filter(part => part !== null).join(' · ')

function Overview({ record, now }: RecordSectionProps) {
  const { overview } = record
  return (
    <dl className="flex flex-col gap-3">
      <Row label="일시">{recordWhen(overview, now)}</Row>
      <Row label="장소">{overview.place ?? '장소 미정'}</Row>
      <Row label="담당 부서">{overview.departments.join(', ') || NONE}</Row>
      <Row label="책임자">{overview.owner?.name ?? NONE}</Row>
      <Row label="완료 처리">
        {joined([dayLabel(overview.completedAt, now), overview.completedBy?.name ?? null])}
      </Row>
    </dl>
  )
}

// 비율은 서버 값 그대로이고, 분모가 0이라 없으면(null) 그 칸을 뺀다(앞의 수가 이미 0을 보인다).
function Outcome({ record }: RecordSectionProps) {
  const { registrations, money, tasks } = record.outcome
  return (
    <dl className="flex flex-col gap-3">
      <Row label="신청 대비 참석">
        {joined([
          `신청 ${registrations.total}`,
          `취소 ${registrations.cancelled}`,
          `출석 ${registrations.attended}`,
          registrations.rate === null ? null : `출석률 ${registrations.rate}%`,
        ])}
      </Row>
      <Row label="예산 대비 집행">
        {joined([
          `예산 ${wonLabel(money.budget)}`,
          `실제 ${wonLabel(money.actual)}`,
          `차이 ${signedWon(money.difference)}`,
          money.rate === null ? null : `집행률 ${money.rate}%`,
        ])}
      </Row>
      <Row label="업무 완료">{`끝남 ${tasks.done} / 전체 ${tasks.total}`}</Row>
    </dl>
  )
}

// 시각순 줄. 회의 줄은 그 회의 기록으로 간다(근거 연결, PRIN-2).
function Timeline({ councilId, record, now }: RecordSectionProps) {
  return (
    <ol className="flex flex-col gap-3">
      {record.timeline.map((entry, index) => {
        const prefix = TIMELINE_PREFIX[entry.kind]
        const text = prefix ? `${prefix} · ${entry.text}` : entry.text
        const meetingId = entry.kind === 'meeting' ? entry.recordId : null
        return (
          <li
            key={`${entry.at}-${index}`}
            className="flex flex-col gap-0.5 border-l-2 border-border-default pl-3 sm:flex-row sm:gap-4"
          >
            <time
              dateTime={entry.at}
              className="shrink-0 text-xs text-fg-muted tabular-nums sm:w-40 sm:pt-0.5"
            >
              {dayTimeLabel(entry.at, now)}
            </time>
            <span className="min-w-0 text-sm text-fg-body wrap-anywhere">
              {meetingId ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-left text-sm whitespace-normal"
                  onClick={() => openRecord('meetings', councilId, meetingId)}
                >
                  {text}
                </Button>
              ) : (
                text
              )}
              {entry.by && <span className="text-fg-muted"> · {entry.by.name}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const SOURCE_LINKS: { key: keyof EventRecord['sources']; label: string; tab: EventTab }[] = [
  { key: 'tasks', label: '업무', tab: 'tasks' },
  { key: 'meetings', label: '회의', tab: 'meetings' },
  { key: 'purchases', label: '구매 요청', tab: 'money' },
]

// 근거 자료: 이 행사 화면의 업무·회의·구매 탭으로 간다. 수는 취소하지 않은 것만이다.
function Sources({ councilId, record }: RecordSectionProps) {
  const eventId = record.overview.id
  return (
    <ul className="flex flex-col gap-2">
      {SOURCE_LINKS.map(source => (
        <li key={source.key}>
          <Button
            variant="link"
            size="sm"
            touch
            className="h-auto p-0 text-sm"
            onClick={() => openRecord('events', councilId, eventId, { tab: source.tab })}
          >
            {`${source.label} ${record.sources[source.key]}건`}
          </Button>
        </li>
      ))}
    </ul>
  )
}

// 대목 id → 본문. 목차와 본문은 record-view의 RECORD_SECTIONS 차례를 같이 쓴다.
export const SECTION_BODIES: Record<RecordSectionId, (props: RecordSectionProps) => ReactNode> = {
  overview: Overview,
  outcome: Outcome,
  timeline: Timeline,
  sources: Sources,
}
