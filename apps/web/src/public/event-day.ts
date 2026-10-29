import { useEffect, useState } from 'react'
import { koreanDateOf, KOREAN_DATE_LENGTH, type PublicRegistrationForm } from '@vada/contracts'

// 오늘(한국 날짜)이 행사 기간 안인지. 이때 내 신청 맨 위에 입장 QR이 온다(내용 ④: 볼 때가 된 것만).
// 시작이 미정이면 당일을 모른다. 끝이 없으면 시작한 날 하루다.
function isEventDay(
  event: Pick<PublicRegistrationForm['event'], 'startsAt' | 'endsAt'>,
  now: Date,
) {
  if (event.startsAt === null) return false
  const today = koreanDateOf(now)
  const first = event.startsAt.slice(0, KOREAN_DATE_LENGTH)
  const last = (event.endsAt ?? event.startsAt).slice(0, KOREAN_DATE_LENGTH)
  return first <= today && today <= last
}

// 지금이 행사 당일인지. 시각은 그리기 밖(효과)에서 읽고, again(다시 읽은 내 신청)이 바뀔 때마다 다시 본다.
// 화면을 연 채 자정을 넘겨도 다음 다시 읽기에서 당일 모양으로 바뀐다.
export function useEventDay(form: PublicRegistrationForm | null, again: unknown) {
  const [day, setDay] = useState(false)
  useEffect(() => {
    setDay(form !== null && isEventDay(form.event, new Date()))
  }, [form, again])
  return day
}
