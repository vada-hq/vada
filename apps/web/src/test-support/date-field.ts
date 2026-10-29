import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { dayLabel, monthLabel, monthOf } from '@/lib/month-grid'

const MONTH = /^(\d{4})년 (\d{1,2})월$/

// 앱 날짜 칸(DateField)에서 날 하나를 고른다: 칸을 눌러 달력을 열고, 그 달까지 넘긴 뒤 날을 누른다.
// 브라우저 날짜 칸처럼 값을 바로 넣지 않고 사람이 하는 대로 고른다.
export async function pickDate(field: HTMLElement, date: string) {
  fireEvent.click(field)
  const grid = await screen.findByRole('grid', { name: MONTH })
  const popup = grid.closest<HTMLElement>('[role="dialog"]') ?? document.body
  const target = monthLabel(monthOf(date))
  for (let turns = 0; turns < 240; turns++) {
    const shown = within(popup).getByRole('grid').getAttribute('aria-label') ?? ''
    if (shown === target) break
    const [, year = '', month = ''] = MONTH.exec(shown) ?? []
    const later = `${year}-${month.padStart(2, '0')}` < monthOf(date)
    fireEvent.click(within(popup).getByRole('button', { name: later ? '다음 달' : '이전 달' }))
  }
  fireEvent.click(within(popup).getByRole('button', { name: dayLabel(date) }))
  // 닫힌 창은 다음 틱에 초점을 칸으로 돌린다. 기다리지 않고 다음 칸을 열면 그 초점 이동이 새 창을 바깥 초점으로 닫는다.
  await waitFor(() => {
    if (document.activeElement !== field) throw new Error('날짜 칸으로 초점이 돌아오지 않았다')
  })
}

// 앱 날짜+시각 칸(DateTimeField)에 'YYYY-MM-DDTHH:mm'을 넣는다: 날짜는 달력에서 고르고 시각은 옆 선택칸에서 고른다.
export async function pickDateTime(field: HTMLElement, value: string) {
  const [date = '', time = ''] = value.split('T')
  await pickDate(field, date)
  const select = field.closest('[data-slot="date-time-field"]')?.querySelector('select')
  if (!select) throw new Error('날짜+시각 칸의 시각 선택칸이 없다')
  fireEvent.change(select, { target: { value: time } })
}
