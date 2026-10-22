import type { EventDetail } from '@vada/contracts'

// 만들기와 고치기 폼이 같이 쓰는 네 칸. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
// 일시는 datetime-local 값('YYYY-MM-DDTHH:mm')이라 계약의 한국 시각과 글자가 같다.
export type EventFieldValues = { name: string; startsAt: string; endsAt: string; place: string }

export const emptyEventFields: EventFieldValues = { name: '', startsAt: '', endsAt: '', place: '' }

export const eventFieldsOf = (
  event: Pick<EventDetail, 'name' | 'startsAt' | 'endsAt' | 'place'>,
): EventFieldValues => ({
  name: event.name,
  startsAt: event.startsAt ?? '',
  endsAt: event.endsAt ?? '',
  place: event.place ?? '',
})

// 공백뿐인 장소는 비운 것으로 본다(계약은 장소가 있으면 공백뿐인 글을 받지 않는다).
export const eventFieldsRequest = (values: EventFieldValues) => ({
  name: values.name,
  startsAt: values.startsAt === '' ? null : values.startsAt,
  endsAt: values.endsAt === '' ? null : values.endsAt,
  place: values.place.trim() === '' ? null : values.place,
})
