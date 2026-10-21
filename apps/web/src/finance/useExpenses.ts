import { statusOf, type ExpensesResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { expensesPath } from './expense-api'

// 지출 목록. 화면이 보이는 동안 15초마다, 다시 보일 때, 내 변경 뒤에 다시 읽는다. 지출 탭이 열려 있을 때만 읽는다.
// 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useExpenses(councilId: string, onForbidden: () => void, enabled: boolean) {
  return usePolledRead<ExpensesResponse>(
    expensesPath(councilId),
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
    enabled,
  )
}
export type ExpenseList = ReturnType<typeof useExpenses>
