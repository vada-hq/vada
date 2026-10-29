import type { PublicRegistrationForm } from '@vada/contracts'
import { momentLabel, whenLabel } from '@/events/event-view'
import { DEFAULT_FORM_NAME } from '@/registrations/registration-form'
import { type } from './public-look'
import { feeText } from './registration-text'

// 신청 화면 머리: 작은 회색 학생회 → 큰 굵은 행사명(두 줄까지) → 회색 요약 한 덩이(마감·일시·장소·참가비).
// 링크를 연 학생은 행사를 이미 알아 스쳐 읽고, 휴대폰 첫 화면에 첫 칸이 보이게 짧게 묶는다(내용 ①).
// 남은 자리는 싣지 않는다(학생 행동을 바꾸지 않음, 다 차면 정원 마감 자리가 맡는다).
export default function FormSummary({ data }: { data: PublicRegistrationForm }) {
  const { event, form } = data
  // 마감은 받는 중일 때만. 마감이 빈 것은 만드는 중인 미리보기뿐이다.
  const facts = [
    data.status === 'open' && form.closesAt !== '' && `${momentLabel(form.closesAt)}까지 신청`,
    whenLabel(event),
    event.place ?? '장소 미정',
    feeText(data),
  ].filter((fact): fact is string => Boolean(fact))
  return (
    <header className="flex flex-col gap-2 break-keep">
      <p className={`${type.small} font-medium text-fg-muted wrap-anywhere`}>{data.councilName}</p>
      <h1 className={`${type.title} line-clamp-2 text-fg wrap-anywhere`}>{event.name}</h1>
      {form.name !== DEFAULT_FORM_NAME && (
        <p className={`${type.label} font-medium text-fg-secondary wrap-anywhere`}>{form.name}</p>
      )}
      <p className={`${type.label} text-fg-muted`}>
        {facts.map((fact, at) => (
          <span key={`${at}-${fact}`}>
            {at > 0 && <span aria-hidden="true"> · </span>}
            <span className="wrap-anywhere">{fact}</span>
          </span>
        ))}
      </p>
      {form.notice && (
        <p className={`${type.label} whitespace-pre-wrap text-fg-secondary wrap-anywhere`}>
          {form.notice}
        </p>
      )}
    </header>
  )
}
