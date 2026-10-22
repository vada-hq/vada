// 요청 내기 폼의 값. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
export type ItemValues = {
  // 줄을 지워도 입력칸 상태가 섞이지 않게 하는 키(서버로 보내지 않는다)
  key: number
  name: string
  quantity: string
  link: string
  options: string
}
export type RequestValues = {
  title: string
  body: string
  neededBy: string
  // 낼 때 고르고 바꾸지 않는다. 비면 행사에 잇지 않는다.
  eventId: string | null
  items: ItemValues[]
}

let lastKey = 0
export const newItem = (): ItemValues => ({
  key: ++lastKey,
  name: '',
  quantity: '1',
  link: '',
  options: '',
})
export const emptyRequest = (eventId: string | null = null): RequestValues => ({
  title: '',
  body: '',
  neededBy: '',
  eventId,
  items: [newItem()],
})

const orNull = (value: string) => (value.trim() === '' ? null : value)

// 수량이 비었거나 숫자가 아니면 NaN이라 계약 검사가 막는다.
export const requestOf = (values: RequestValues) => ({
  title: values.title,
  eventId: values.eventId,
  body: orNull(values.body),
  neededBy: orNull(values.neededBy),
  items: values.items.map(item => ({
    name: item.name,
    quantity: item.quantity.trim() === '' ? Number.NaN : Number(item.quantity),
    link: orNull(item.link),
    options: orNull(item.options),
  })),
})
