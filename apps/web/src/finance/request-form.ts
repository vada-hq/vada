// 요청 내기 폼의 값. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
export type ItemValues = {
  // 줄을 지워도 입력칸 상태가 섞이지 않게 하는 키(서버로 보내지 않는다)
  key: number
  name: string
  quantity: string
  link: string
  options: string
  // 불러온 가격은 확인용이며 요청 본문에는 보내지 않는다(022-6, DEC-40).
  loadedPrice?: number | null
}
export type RequestValues = {
  title: string
  body: string
  neededBy: string
  // 낼 때 고르고 바꾸지 않는다. 비면 행사에 잇지 않는다.
  eventId: string | null
  // 재정부가 남을 대신해 낼 때의 요청한 사람. 비면 나다.
  requestedBy: string | null
  // 메시지에서 열었으면 그 메시지. 사람이 고르지 않고 서버가 볼 수 있는지 본다.
  sourceMessageId: string | null
  items: ItemValues[]
}
// 메시지에서 열 때 미리 채우는 값
export type RequestStart = Partial<
  Pick<RequestValues, 'title' | 'body' | 'requestedBy' | 'sourceMessageId'>
> & { items?: { name: string; link: string; loadedPrice: number | null }[] }

let lastKey = 0
export const newItem = (): ItemValues => ({
  key: ++lastKey,
  name: '',
  quantity: '1',
  link: '',
  options: '',
})
export const emptyRequest = (
  eventId: string | null = null,
  start: RequestStart = {},
): RequestValues => ({
  title: start.title ?? '',
  body: start.body ?? '',
  neededBy: '',
  eventId,
  requestedBy: start.requestedBy ?? null,
  sourceMessageId: start.sourceMessageId ?? null,
  items: start.items?.length ? start.items.map(item => ({ ...newItem(), ...item })) : [newItem()],
})

const orNull = (value: string) => (value.trim() === '' ? null : value)

// 수량이 비었거나 숫자가 아니면 NaN이라 계약 검사가 막는다.
export const requestOf = (values: RequestValues) => ({
  title: values.title,
  eventId: values.eventId,
  // 비면 키를 보내지 않는다(서버 기본값이 같다).
  ...(values.requestedBy === null ? {} : { requestedBy: values.requestedBy }),
  ...(values.sourceMessageId === null ? {} : { sourceMessageId: values.sourceMessageId }),
  body: orNull(values.body),
  neededBy: orNull(values.neededBy),
  items: values.items.map(item => ({
    name: item.name,
    quantity: item.quantity.trim() === '' ? Number.NaN : Number(item.quantity),
    link: orNull(item.link),
    options: orNull(item.options),
  })),
})
