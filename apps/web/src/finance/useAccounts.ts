import { statusOf, type AccountsResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { accountsPath } from './finance-api'

// 계좌 목록. 모든 운영진이 본다. 화면이 보이는 동안 15초마다, 다시 보일 때 읽는다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useAccounts(councilId: string, onForbidden: () => void, enabled = true) {
  return usePolledRead<AccountsResponse>(
    accountsPath(councilId),
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
    enabled,
  )
}
