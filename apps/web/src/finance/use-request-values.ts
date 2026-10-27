import { useCallback, type SetStateAction } from 'react'
import { useBaselineValues } from '@/lib/use-baseline-values'
import type { Choice } from '@/tasks/task-form-options'
import type { RequestValues } from './request-form'

type RequestInput = { request: RequestValues; picked: Choice | null }

// 구매 요청 폼의 값과 고른 업무, 떠날 때 물을지 가르는 기준 값.
// 고른 업무도 사람이 한 일이라 같이 비교한다. 업무만 고른 뒤 늦게 온 상품 조회가 기준을 옮겨, 고른 것을 묻지 않고 버리지 않게 한다.
export function useRequestValues(init: () => { values: RequestInput; baseline: RequestInput }) {
  const { values, setValues, autoChange, dirty } = useBaselineValues(init)
  const setRequest = useCallback(
    (request: RequestValues) => setValues(before => ({ ...before, request })),
    [setValues],
  )
  const setPicked = useCallback(
    (picked: Choice | null) => setValues(before => ({ ...before, picked })),
    [setValues],
  )
  // 화면이 저절로 채우는 것(메시지 링크의 상품 조회)은 요청 값만 바꾼다.
  const autoRequest = useCallback(
    (action: SetStateAction<RequestValues>) =>
      autoChange(before => ({
        ...before,
        request: typeof action === 'function' ? action(before.request) : action,
      })),
    [autoChange],
  )
  return {
    values: values.request,
    picked: values.picked,
    setValues: setRequest,
    setPicked,
    autoChange: autoRequest,
    dirty,
  }
}
