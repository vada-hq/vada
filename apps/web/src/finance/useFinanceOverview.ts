import { useState } from 'react'
import { statusOf, type FinanceOverviewResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { financeOverviewPath } from './finance-api'

// 한 기간의 재정 개요. 화면이 보이는 동안 15초마다 다시 읽는다. 기간을 바꾸면 이전 기간의 늦은 응답은 버려진다.
// 권한이 바뀌었으면(403) 학생회를 다시 읽게 하고, 기간이 사라졌으면(404) 이유를 남긴다.
export function useFinanceOverview(councilId: string, periodId: string, onForbidden: () => void) {
  const [gone, setGone] = useState<string | null>(null)
  const read = usePolledRead<FinanceOverviewResponse>(
    financeOverviewPath(councilId, periodId),
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
      if (status === statusOf('NOT_FOUND')) setGone(periodId)
    },
  )
  return { ...read, lost: gone === periodId }
}
