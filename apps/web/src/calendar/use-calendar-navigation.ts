import { useCallback, useState, useSyncExternalStore } from 'react'
import { koreanDateOf } from '@vada/contracts'
import { monthOf } from '@/tasks/calendar-month'

const MONTH_QUERY = '(min-width: 48rem)'
const media = () => window.matchMedia?.(MONTH_QUERY)
function subscribe(change: () => void) {
  const query = media()
  query?.addEventListener('change', change)
  return () => query?.removeEventListener('change', change)
}
export const useDefaultCalendarView = () =>
  useSyncExternalStore(subscribe, () => (media()?.matches ? 'month' : 'list'))

export function useCalendarNavigation(referenceDay?: string) {
  const [today] = useState(() => referenceDay ?? koreanDateOf(new Date()))
  const [month, setMonth] = useState(() => monthOf(today))
  const [selected, setSelected] = useState(today)
  const selectDay = useCallback((day: string) => {
    setMonth(monthOf(day))
    setSelected(day)
  }, [])
  const go = (next: string) => {
    setMonth(next)
    setSelected(next === monthOf(today) ? today : `${next}-01`)
  }
  return { today, month, selected, setSelected, selectDay, go }
}
