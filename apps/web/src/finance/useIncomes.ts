import { statusOf, type FiscalPeriodsResponse, type IncomesResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { fiscalPeriodsPath } from './finance-api'
import { incomesPath } from './income-api'

const whenForbidden = (onForbidden: () => void) => (status: number) => {
  if (status === statusOf('FORBIDDEN')) onForbidden()
}

// 회계 기간 목록(시작이 늦은 순). 수입 탭이 열려 있을 때만 읽는다. 화면이 보이는 동안 15초마다 다시 읽는다.
// 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function usePeriods(councilId: string, onForbidden: () => void) {
  return usePolledRead<FiscalPeriodsResponse>(
    fiscalPeriodsPath(councilId),
    whenForbidden(onForbidden),
  )
}

// 한 기간의 수입(받은 날 최근 순). 기간을 고르기 전(null)에는 읽지 않는다. 기간을 바꾸면 이전 기간의 늦은 응답은 버려진다.
export function useIncomes(councilId: string, periodId: string | null, onForbidden: () => void) {
  return usePolledRead<IncomesResponse>(
    periodId === null ? '' : incomesPath(councilId, periodId),
    whenForbidden(onForbidden),
    periodId !== null,
  )
}
export type IncomeList = ReturnType<typeof useIncomes>
