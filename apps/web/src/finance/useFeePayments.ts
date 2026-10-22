import { statusOf, type FeePaymentsResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { feePaymentsPath } from './finance-api'

// 납부 기간별 수와, 찾은 학번 하나의 기록. 재정부와 회장단이 본다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useFeePayments(
  councilId: string,
  studentId: string | undefined,
  onForbidden: () => void,
) {
  return usePolledRead<FeePaymentsResponse>(feePaymentsPath(councilId, studentId), status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
}
