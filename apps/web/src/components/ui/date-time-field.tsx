import { useState, type ComponentProps } from 'react'
import { DateField } from './date-field'
import { NativeSelect } from './native-select'

const MINUTES_PER_DAY = 1440
// 시각 목록은 30분 단위다. 학생회 일정(회의·행사·신청 마감)은 정시와 30분에 잡히고, Outlook 일정 시각 목록도 30분이다.
// 15분(Google Calendar)은 하루 96줄이라 휴대폰 선택 화면에서 찾기 길다.
const TIME_STEP_MINUTES = 30
const HOUR = 60
const TWO_DIGITS = 2
const pad = (value: number) => String(value).padStart(TWO_DIGITS, '0')

export const TIME_OPTIONS: readonly string[] = Array.from(
  { length: MINUTES_PER_DAY / TIME_STEP_MINUTES },
  (_, index) => {
    const minutes = index * TIME_STEP_MINUTES
    return `${pad(Math.floor(minutes / HOUR))}:${pad(minutes % HOUR)}`
  },
)

// 목록 밖의 지금 값(예전에 브라우저 칸으로 넣은 14:10)도 고른 채로 보이게 끼워 둔다. 보이지 않으면 저장할 때 바뀐다.
function optionsWith(value: string) {
  if (!value || TIME_OPTIONS.includes(value)) return TIME_OPTIONS
  return [...TIME_OPTIONS, value].sort()
}

type TimeProps = Omit<ComponentProps<typeof NativeSelect>, 'value' | 'onChange'> & {
  // 'HH:mm'. 비었으면 ''. 브라우저 시각 칸(type="time")과 같은 글이다.
  value: string
  onChange: (value: string) => void
}

// 시각만 고르는 칸. 앱 선택칸(NativeSelect)에 30분 단위 목록을 둔다. 휴대폰은 시스템 선택 화면이 뜬다.
export function TimeField({ value, onChange, ...props }: TimeProps) {
  return (
    <NativeSelect {...props} value={value} onChange={event => onChange(event.target.value)}>
      {!value && <option value="" />}
      {optionsWith(value).map(time => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </NativeSelect>
  )
}

// 날짜만 고르고 시각이 비었을 때 채우는 시각. 일정 만들기의 종일 끄기와 같은 값이다(calendar/schedule-form).
const DEFAULT_TIME = '09:00'
const TIME_FROM = 11

type Props = {
  // 한국 시각 'YYYY-MM-DDTHH:mm'. 비었으면 ''. 브라우저 칸(type="datetime-local")과 같은 글이라 폼 쪽 로직은 그대로다.
  value: string
  onChange: (value: string) => void
  // 시각 선택칸의 이름(예: '시작 시각'). 날짜 칸의 이름은 Field 라벨이다.
  timeLabel: string
  today?: string
  clearable?: boolean | undefined
  disabled?: boolean | undefined
  // 날짜 칸에 붙는다. 고치기 창이 이 이름으로 칸을 찾아 초점을 옮긴다.
  name?: string | undefined
  id?: string
  'aria-required'?: boolean | undefined
  'aria-invalid'?: boolean | undefined
  'aria-describedby'?: string | undefined
}

// 날짜(앱 달력)와 시각(30분 목록)을 나란히 고르는 칸. 둘 다 있어야 값이 생기고, 날짜를 지우면 빈 값이다.
// 시각을 먼저 고르면 날짜를 고를 때까지 칸에만 기억한다.
export function DateTimeField({
  value,
  onChange,
  timeLabel,
  today,
  clearable,
  disabled,
  ...date
}: Props) {
  const [pendingTime, setPendingTime] = useState('')
  const day = value.slice(0, TIME_FROM - 1)
  const time = value.slice(TIME_FROM) || pendingTime
  const emit = (nextDay: string, nextTime: string) => {
    if (!nextDay) setPendingTime(nextTime)
    onChange(nextDay ? `${nextDay}T${nextTime || DEFAULT_TIME}` : '')
  }
  return (
    <div data-slot="date-time-field" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
      <DateField
        {...date}
        {...(today !== undefined && { today })}
        value={day}
        clearable={clearable}
        disabled={disabled}
        onChange={next => emit(next, time)}
      />
      <TimeField
        aria-label={timeLabel}
        className="w-24"
        value={time}
        disabled={disabled}
        {...(date['aria-invalid'] && { 'aria-invalid': true })}
        onChange={next => (day ? emit(day, next) : setPendingTime(next))}
      />
    </div>
  )
}
