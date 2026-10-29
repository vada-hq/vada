import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { koreanDateOf } from '@vada/contracts'
import { dayLabel } from '@/lib/korean-date-text'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Calendar, focusCalendarDay } from './calendar'
import { fieldClass, Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Sheet, SheetContent } from './sheet'

// 'YYYY-MM-DD' → '10월 30일 (금)'. 올해(한국)가 아니면 '2027년 1월 2일 (토)'다(AGENTS.md '화면 문구와 폼'의 날짜 꼴).
export function dateFieldText(date: string, today: string) {
  if (!date) return ''
  return dayLabel(`${date}T00:00+09:00`, new Date(`${today}T12:00+09:00`))
}

// 휴대폰 폭(Tailwind sm 미만)인가. 폭을 모르면(matchMedia가 없는 시험 환경) 데스크톱으로 본다.
const SM = '(min-width: 40rem)'
const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(SM) : null)
function subscribe(change: () => void) {
  const query = media()
  query?.addEventListener('change', change)
  return () => query?.removeEventListener('change', change)
}
const usePhoneWidth = () => useSyncExternalStore(subscribe, () => media()?.matches === false)

type PickerProps = {
  value: string
  today: string
  min?: string | undefined
  max?: string | undefined
  clearable?: boolean | undefined
  touch: boolean
  onPick: (date: string) => void
}

// 고르기 창 안: 달력과(선택 칸이면) 날짜 지우기.
function Picker({ value, today, min, max, clearable, touch, onPick }: PickerProps) {
  return (
    <div className="flex flex-col">
      <Calendar
        value={value || null}
        today={today}
        min={min}
        max={max}
        touch={touch}
        onSelect={onPick}
      />
      {clearable && value !== '' && (
        <div className="border-t pt-1">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start font-normal text-fg-secondary"
            onClick={() => onPick('')}
          >
            날짜 지우기
          </Button>
        </div>
      )}
    </div>
  )
}

type Props = {
  // 한국 날짜 'YYYY-MM-DD'. 비었으면 ''. 브라우저 날짜 칸(type="date")과 같은 글이라 폼 쪽 로직은 그대로다.
  value: string
  onChange: (value: string) => void
  // 오늘(한국 날짜). 부품 확인 화면과 시험이 날을 고정할 때만 준다.
  today?: string
  min?: string | undefined
  max?: string | undefined
  // 비워도 되는 칸. 고르기 창에 '날짜 지우기'가 있다.
  clearable?: boolean | undefined
  disabled?: boolean | undefined
  readOnly?: boolean | undefined
  name?: string | undefined
  className?: string | undefined
  // Field가 붙이는 라벨 연결과 필수·문제 표시
  id?: string
  'aria-label'?: string | undefined
  'aria-required'?: boolean | undefined
  'aria-invalid'?: boolean | undefined
  'aria-describedby'?: string | undefined
}

// Enter·Space는 버튼 누르기로 열고, 아래 화살표로도 연다(APG Combobox, 브라우저 선택칸과 같은 손).
const OPEN_KEY = 'ArrowDown'

// 앱 달력으로 날을 고르는 칸. 브라우저 날짜 칸은 운영체제마다 모양과 글이 달라 쓰지 않는다.
// 칸에는 고른 날이 앱 날짜 꼴로 보이고, 누르면 데스크톱은 칸 아래에 달력이 뜨고 휴대폰은 아래에서 시트가 올라온다(M3 date picker의 docked·modal).
// 고르면 닫히고 초점은 칸으로 돌아온다. 칸은 combobox라 Field의 라벨·필수·문제가 그대로 이어지고, 첫 문제 칸 찾기([aria-invalid])에 걸린다.
export function DateField({
  value,
  onChange,
  today: fixedToday,
  min,
  max,
  clearable,
  readOnly,
  className,
  ...trigger
}: Props) {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  const [clock] = useState(() => koreanDateOf(new Date()))
  const today = fixedToday ?? clock
  const phone = usePhoneWidth()
  const text = dateFieldText(value, today)
  if (readOnly) return <Input {...trigger} readOnly value={text} className={className} />
  const pick = (date: string) => {
    onChange(date)
    setOpen(false)
  }
  const button = (
    <button
      ref={opener}
      type="button"
      role="combobox"
      aria-haspopup="dialog"
      aria-expanded={open}
      value={value}
      className={cn(
        fieldClass,
        'flex cursor-pointer items-center justify-between gap-2 text-left',
        className,
      )}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== OPEN_KEY) return
        event.preventDefault()
        setOpen(true)
      }}
      onClick={phone ? () => setOpen(true) : undefined}
      {...trigger}
    >
      <span className="truncate">{text}</span>
      <CalendarDays aria-hidden className="size-4 shrink-0 text-fg-subtle" />
    </button>
  )
  const picker = (touch: boolean): ReactNode => (
    <Picker
      value={value}
      today={today}
      min={min}
      max={max}
      clearable={clearable}
      touch={touch}
      onPick={pick}
    />
  )
  if (phone)
    return (
      <>
        {button}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="adaptive"
            title="날짜 선택"
            closeLabel="닫기"
            className="pb-4"
            onOpenAutoFocus={focusCalendarDay}
            // 휴대폰 사파리는 눌러도 버튼에 초점을 주지 않아, 연 순간의 초점 대신 날짜 칸으로 돌아온다.
            onCloseAutoFocus={event => {
              event.preventDefault()
              opener.current?.focus()
            }}
          >
            <div className="flex justify-center">{picker(true)}</div>
          </SheetContent>
        </Sheet>
      </>
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent className="w-auto" onOpenAutoFocus={focusCalendarDay}>
        {picker(false)}
      </PopoverContent>
    </Popover>
  )
}
