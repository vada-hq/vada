import type { EventDetail } from '@vada/contracts'
import { requiredText } from '@/lib/use-form-check'

// 만들기와 고치기 폼이 같이 쓰는 칸. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
// 일시는 datetime-local 값('YYYY-MM-DDTHH:mm')이라 계약의 한국 시각과 글자가 같다.
// endTbd·placeTbd는 '종료 시간 미정'·'장소 미정' 체크다(DEC-93). 체크하면 그 칸을 비워 저장하고, 쓰던 글은 풀면 돌아온다.
export type EventFieldValues = {
  name: string
  startsAt: string
  endsAt: string
  place: string
  endTbd: boolean
  placeTbd: boolean
}

export const emptyEventFields: EventFieldValues = {
  name: '',
  startsAt: '',
  endsAt: '',
  place: '',
  endTbd: true,
  placeTbd: true,
}

// 비어 있는 끝과 장소는 미정 체크로 연다. 빈 장소를 채우려고 연 때([장소 넣기])는 바로 쓰도록 체크를 풀어 둔다.
export const eventFieldsOf = (
  event: Pick<EventDetail, 'name' | 'startsAt' | 'endsAt' | 'place'>,
  focus?: 'startsAt' | 'place',
): EventFieldValues => ({
  name: event.name,
  startsAt: event.startsAt ?? '',
  endsAt: event.endsAt ?? '',
  place: event.place ?? '',
  endTbd: event.endsAt === null,
  placeTbd: event.place === null && focus !== 'place',
})

// 미정으로 체크한 끝·장소는 보내지 않는다(null).
const endOf = (values: EventFieldValues) => (values.endTbd ? '' : values.endsAt)

// 공백뿐인 장소는 비운 것으로 본다(계약은 장소가 있으면 공백뿐인 글을 받지 않는다).
export const eventFieldsRequest = (values: EventFieldValues) => ({
  name: values.name,
  startsAt: values.startsAt === '' ? null : values.startsAt,
  endsAt: endOf(values) === '' ? null : endOf(values),
  place: values.placeTbd || values.place.trim() === '' ? null : values.place,
})

// 이름은 늘 필수이고, 끝을 넣었으면 시작도 필수다(계약: 끝만 있는 행사는 없다). 끝은 시작보다 늦어야 한다.
export const eventFieldErrors = (values: EventFieldValues) => {
  const end = endOf(values)
  return {
    name: requiredText(values.name, '이름을'),
    startsAt: end === '' ? undefined : requiredText(values.startsAt, '시작 일시를'),
    endsAt:
      values.startsAt !== '' && end !== '' && end <= values.startsAt
        ? '시작보다 늦은 시각을 입력해 주세요'
        : undefined,
  }
}
