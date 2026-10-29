import type { ReactNode } from 'react'
import { dayTime, koreanYearOf, type EventApplicant } from '@vada/contracts'
import { SidePanel, SidePanelBody, SidePanelContent } from '@/components/ui/side-panel'
import { won } from '@/public/registration-text'
import { EVENT_APPLICANTS } from '@/lib/registration-messages'
import { AttendanceMark, AttentionMark, DepositMark, RegistrationMark } from './ApplicantMarks'
import { listType } from './list-look'

// 한 사람 보기: 이름을 누르면 오른쪽 패널이 열린다(Notion side peek, 앱의 SidePanel). 안은 위 양식 카드와 같은 '회색 이름표 │ 값' 줄이다.
// 휴대폰·추가 질문 답처럼 명단 첫눈엔 판단에 안 쓰이는 값은 여기에만 둔다. 모두 서버가 열람 기록을 남기고 준 같은 응답의 값이다(DEC-65).

const KOREAN_MINUTE_LENGTH = 16

// 신청 시각 'YYYY-MM-DDTHH:MM'(한국) → '10월 27일 (화) 10:00', 올해가 아니면 앞에 '2026년'.
function appliedText(at: string, now: Date) {
  const { date, text } = dayTime(at.slice(0, KOREAN_MINUTE_LENGTH))
  return date.startsWith(koreanYearOf(now)) ? text : `${date.split('-')[0]}년 ${text}`
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-start gap-3 py-1.5">
      <dt className={`w-24 shrink-0 break-keep ${listType.body} text-fg-muted`}>{label}</dt>
      <dd className={`min-w-0 flex-1 ${listType.body} text-fg-body wrap-anywhere`}>{children}</dd>
    </div>
  )
}

function feeText(row: EventApplicant) {
  if (row.payer === null) return won(row.appliedFee)
  return `${won(row.appliedFee)} · ${row.payer ? '납부자' : '미납자'}`
}

export function ApplicantPeek({
  row,
  reason,
  showForm,
  now,
  onClose,
}: {
  row: EventApplicant | undefined
  reason: string | null
  showForm: boolean
  now: Date
  onClose: () => void
}) {
  return (
    <SidePanel open={row !== undefined} onOpenChange={open => !open && onClose()}>
      {row && (
        <SidePanelContent
          title={row.name}
          description={row.needsAttention ? <AttentionMark reason={reason} /> : undefined}
          className="sm:w-100"
        >
          <SidePanelBody>
            <dl>
              <Prop label={EVENT_APPLICANTS.studentId}>
                <span className={listType.num}>{row.studentId ?? '—'}</span>
              </Prop>
              {row.phone && (
                <Prop label={EVENT_APPLICANTS.phone}>
                  <span className={listType.num}>{row.phone}</span>
                </Prop>
              )}
              {row.affiliation && (
                <Prop label={EVENT_APPLICANTS.affiliation}>{row.affiliation}</Prop>
              )}
              {showForm && <Prop label={EVENT_APPLICANTS.form}>{row.formTitle}</Prop>}
              <Prop label={EVENT_APPLICANTS.registration}>
                <span className="inline-flex flex-wrap items-center gap-x-2">
                  <RegistrationMark row={row} />
                  <span className={`${listType.small} text-fg-muted`}>
                    {appliedText(row.appliedAt, now)}
                  </span>
                </span>
              </Prop>
              <Prop label={EVENT_APPLICANTS.fee}>{feeText(row)}</Prop>
              <Prop label={EVENT_APPLICANTS.deposit}>
                <DepositMark row={row} due={false} />
              </Prop>
              <Prop label={EVENT_APPLICANTS.attendance}>
                <AttendanceMark row={row} />
              </Prop>
            </dl>
            {row.answers.length > 0 && (
              <dl className="border-t border-border-subtle pt-3">
                {row.answers.map(answer => (
                  <Prop key={answer.questionId} label={answer.title}>
                    {answer.values.join(', ') || '—'}
                  </Prop>
                ))}
              </dl>
            )}
          </SidePanelBody>
        </SidePanelContent>
      )}
    </SidePanel>
  )
}
