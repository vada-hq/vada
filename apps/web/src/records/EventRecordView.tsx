import PageHeading from '@/components/PageHeading'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ownerLine } from '../events/event-header-view'
import EventStatusChip from '../events/EventStatusChip'
import { completedLabel, RECORD_SECTIONS, recordWhen } from './record-view'
import { RecordToc, sectionAnchor } from './RecordToc'
import { SECTION_BODIES, type RecordSectionProps } from './RecordSections'

// 머리(와이어프레임 REC-02 '문서 헤더'): 완료 배지와 기간, 행사명, 담당, 완료 처리일과 완료한 사람.
// 발행 버전·작성자·검토자는 나중에 붙일 살이다(DEC-110).
function RecordHead({ record, now }: Pick<RecordSectionProps, 'record' | 'now'>) {
  const { overview } = record
  const completed = [completedLabel(overview.completedAt, now), overview.completedBy?.name]
    .filter(Boolean)
    .join(' · ')
  return (
    <div
      role="group"
      aria-label="행사 기록 머리"
      className={cn(cardClass, 'flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:gap-4')}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <EventStatusChip status="completed" />
          <span className="text-xs text-fg-muted tabular-nums">{recordWhen(overview, now)}</span>
        </div>
        <h2 className="text-lg font-semibold text-fg wrap-anywhere">{overview.name}</h2>
        <p className="text-sm text-fg-muted wrap-anywhere">{ownerLine(overview)}</p>
      </div>
      <p className="shrink-0 text-xs text-fg-muted tabular-nums">{completed}</p>
    </div>
  )
}

// 행사 기록 상세(와이어프레임 REC-02): 머리, 왼쪽 목차, 가운데 본문 대목. 대목은 RECORD_SECTIONS 차례이고 숫자는 서버가 센다.
// 오른쪽 인수인계 패널과 현장 운영·회고·인수인계 대목은 나중에 붙일 살이라 자리도 두지 않는다(DEC-110).
export function EventRecordView({ councilId, record, now }: RecordSectionProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 break-keep">
      <PageHeading
        trail={{ title: '행사 기록', crumbs: [{ label: record.overview.name, truncate: true }] }}
      >
        <h2 className="text-xl font-semibold text-fg">행사 기록</h2>
      </PageHeading>
      <RecordHead record={record} now={now} />
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
        <RecordToc />
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:max-w-200">
          {RECORD_SECTIONS.map(section => {
            const Body = SECTION_BODIES[section.id]
            const titleId = `${sectionAnchor(section.id)}-title`
            return (
              <section
                key={section.id}
                id={sectionAnchor(section.id)}
                aria-labelledby={titleId}
                className={cn(cardClass, 'scroll-mt-4')}
              >
                <h3 id={titleId} className="border-b px-5 py-3 text-sm font-semibold text-fg">
                  {section.label}
                </h3>
                <div className="px-5 py-4">
                  <Body councilId={councilId} record={record} now={now} />
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
