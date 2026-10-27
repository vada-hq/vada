import { useCallback, useState, type SetStateAction } from 'react'
import { sameJson } from '@/lib/same-json'
import type { ExpenseValues } from './expense-form'

const apply = (action: SetStateAction<ExpenseValues>, before: ExpenseValues) =>
  typeof action === 'function' ? action(before) : action

// 지출 적기 폼의 값과, 떠날 때 물을지 가르는 기준 값.
// 화면이 저절로 바꾼 것(연결된 요청 골라 두기, 그 요청의 사유 채우기)은 사람이 손대기 전이면 기준도 같이 옮긴다.
// 사람이 쓴 것이 없는데 떠날 때 묻지 않게 하려는 것이다. 사람이 고친 뒤의 자동 변경은 기준을 옮기지 않는다.
export function useExpenseValues(init: () => ExpenseValues) {
  const [form, setForm] = useState(() => {
    const initial = init()
    return { values: initial, baseline: initial }
  })
  const setValues = useCallback((action: SetStateAction<ExpenseValues>) => {
    setForm(before => ({ ...before, values: apply(action, before.values) }))
  }, [])
  const autoChange = useCallback((action: SetStateAction<ExpenseValues>) => {
    setForm(before => {
      const values = apply(action, before.values)
      const untouched = sameJson(before.values, before.baseline)
      return { values, baseline: untouched ? values : before.baseline }
    })
  }, [])
  return {
    values: form.values,
    setValues,
    autoChange,
    dirty: !sameJson(form.values, form.baseline),
  }
}
