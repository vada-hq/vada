import type { MadeRecord } from '@vada/contracts'
import ExpenseFlowView from './ExpenseFlowView'
import RequestFlowView, { type RequestAccess } from './RequestFlowView'
import { useExpenseFlow } from './useExpenseFlow'
import { useRequestFlow } from './useRequestFlow'

type Props = {
  councilId: string
  meId: string
  // 구매 요청 만들기: 권한(`purchase.request`, 대신 내기 `finance.manage`)은 받은 값 그대로다.
  request: RequestAccess
  // 지출 적기: `finance.manage`를 받은 값 그대로 쓴다.
  canWriteExpense: boolean
  onForbidden: () => void
  // 낸 요청·적은 지출을 그 메시지 아래 기록에 바로 더한다.
  onMade: (messageId: string, made: MadeRecord) => void
}

// 메시지에서 시작하는 재정 흐름들(구매 요청 만들기, 지출 적기). 대화상자들(`views`)과 메뉴가 쓸 시작 동작을 함께 준다.
export function useMessageFlows({ request, canWriteExpense, onMade, ...common }: Props) {
  const requestFlow = useRequestFlow()
  const expenseFlow = useExpenseFlow()
  const views = (
    <>
      <RequestFlowView {...request} {...common} flow={requestFlow} onMade={onMade} />
      <ExpenseFlowView
        {...common}
        onMade={onMade}
        team={request.team}
        canManage={canWriteExpense}
        flow={expenseFlow}
      />
    </>
  )
  const menu = {
    canRequest: request.canRequest,
    onRequest: requestFlow.start,
    canWriteExpense,
    onWriteExpense: expenseFlow.start,
    onMade,
  }
  return { views, menu }
}
