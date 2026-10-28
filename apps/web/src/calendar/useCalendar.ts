import { statusOf, type CalendarResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'

export function useCalendar(councilId: string, from: string, to: string, onForbidden: () => void) {
  const path = `/api/organizations/${councilId}/calendar?${new URLSearchParams({ from, to })}`
  return usePolledRead<CalendarResponse>(path, status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
}
