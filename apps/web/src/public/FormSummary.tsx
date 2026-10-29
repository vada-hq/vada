import { useEffect, useState } from 'react'
import { CalendarDays, Clock, MapPin, Wallet } from 'lucide-react'
import type { PublicRegistrationForm } from '@vada/contracts'
import { momentLabel, whenLabel } from '@/events/event-view'
import { DEFAULT_FORM_NAME } from '@/registrations/registration-form'
import { Fact, FactList } from './PageParts'
import { type } from './public-look'
import { deadlineMark, feeLines } from './registration-text'

// 마감 표시('오늘 마감'·'내일 마감'). 시각은 그리기 밖(효과)에서 읽는다(event-day와 같다).
function useDeadlineMark(closesAt: string) {
  const [mark, setMark] = useState<string | null>(null)
  useEffect(() => {
    setMark(closesAt === '' ? null : deadlineMark(closesAt, new Date()))
  }, [closesAt])
  return mark
}

// 마감 줄. 마감이 오늘·내일이면 값 옆에 빨간 알약이 붙는다(객관적 사실에만 강조).
function Deadline({ closesAt }: { closesAt: string }) {
  const mark = useDeadlineMark(closesAt)
  return (
    <Fact icon={Clock}>
      <span className="wrap-anywhere">{momentLabel(closesAt)}까지 신청</span>
      {mark && (
        <span
          className={`rounded-full bg-danger-surface px-2 py-0.5 ${type.small} font-semibold text-danger`}
        >
          {mark}
        </span>
      )}
    </Fact>
  )
}

// 신청 화면 머리: 학생회 알약 → 큰 굵은 행사명(두 줄까지) → 행사 정보 한 줄에 하나씩(마감·일시·장소·참가비) → 안내.
// 링크를 연 학생은 행사를 이미 알아 스쳐 읽는다. 아이콘 줄이라 값만 훑어도 무엇인지 보인다(내용 ①).
// 남은 자리는 싣지 않는다(학생 행동을 바꾸지 않음, 다 차면 정원 마감 자리가 맡는다).
export default function FormSummary({ data }: { data: PublicRegistrationForm }) {
  const { event, form } = data
  return (
    <header className="flex flex-col break-keep">
      <p
        className={`self-start rounded-full bg-surface-muted px-2.5 py-1 ${type.small} font-semibold text-fg-secondary wrap-anywhere`}
      >
        {data.councilName}
      </p>
      <h1 className={`mt-3 ${type.title} line-clamp-2 text-fg wrap-anywhere`}>{event.name}</h1>
      {form.name !== DEFAULT_FORM_NAME && (
        <p className={`mt-1 ${type.label} font-medium text-fg-tertiary wrap-anywhere`}>
          {form.name}
        </p>
      )}
      <div className="mt-6">
        <FactList>
          {/* 마감은 받는 중일 때만. 마감이 빈 것은 만드는 중인 미리보기뿐이다. */}
          {data.status === 'open' && form.closesAt !== '' && <Deadline closesAt={form.closesAt} />}
          <Fact icon={CalendarDays}>
            <span className="wrap-anywhere">{whenLabel(event)}</span>
          </Fact>
          <Fact icon={MapPin}>
            <span className="wrap-anywhere">{event.place ?? '장소 미정'}</span>
          </Fact>
          <Fact icon={Wallet}>
            <span className="flex flex-col">
              {feeLines(data).map(line => (
                <span key={line} className="tabular-nums">
                  {line}
                </span>
              ))}
            </span>
          </Fact>
        </FactList>
      </div>
      {form.notice && (
        <p className={`mt-5 ${type.label} whitespace-pre-wrap text-fg-secondary wrap-anywhere`}>
          {form.notice}
        </p>
      )}
    </header>
  )
}
