import { koreanDateOf } from '@vada/contracts'

// 시연 날짜는 돌리는 날(한국) 기준이다. 한국은 일광절약시간이 없어 하루는 24시간이다.
const DAY_MS = 86_400_000

// now에서 days일 뒤(앞이면 음수)의 한국 날짜 YYYY-MM-DD
const dayOf = (now: Date, days: number) => koreanDateOf(new Date(now.getTime() + days * DAY_MS))

// 시연 내용이 쓰는 날짜의 어긋남(일). 음수는 지난 날이다.
const DEMO_OFFSETS = {
  endedEvent: -7,
  upcomingEvent: 10,
  endedEventTaskDue: -12,
  roomTaskDue: 5,
  snackTaskDue: 7,
  noticeTaskDue: 3,
  posterNeededBy: 5,
  expensePaid: -6,
} as const

export const demoDay = (now: Date, key: keyof typeof DEMO_OFFSETS) => dayOf(now, DEMO_OFFSETS[key])
