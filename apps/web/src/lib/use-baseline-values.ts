import { useCallback, useState, type SetStateAction } from 'react'
import { sameJson } from './same-json'

const apply = <T>(action: SetStateAction<T>, before: T) =>
  typeof action === 'function' ? (action as (before: T) => T)(before) : action

// 폼의 값과, 떠날 때 물을지 가르는 기준 값(떠날 때 확인).
// 화면이 저절로 바꾼 것(autoChange: 메시지에서 채운 값의 상품 조회, 골라 둔 연결 같은 것)은 사람이 손대기 전이면 기준도 같이 옮긴다.
// 사람이 쓴 것이 없는데 떠날 때 묻지 않게 하려는 것이다. 사람이 고친 뒤의 자동 변경은 기준을 옮기지 않는다.
// 처음 값과 기준이 다르면(새로고침 뒤 되살린 입력) 이미 고친 것으로 본다. sameInput은 화면 안의 기록을 빼고 비교할 때 준다.
export function useBaselineValues<T>(
  init: () => { values: T; baseline?: T },
  sameInput: (a: T, b: T) => boolean = sameJson,
) {
  const [form, setForm] = useState(() => {
    const { values, baseline = values } = init()
    return { values, baseline }
  })
  const setValues = useCallback((action: SetStateAction<T>) => {
    setForm(before => ({ ...before, values: apply(action, before.values) }))
  }, [])
  const autoChange = useCallback(
    (action: SetStateAction<T>) => {
      setForm(before => {
        const values = apply(action, before.values)
        const untouched = sameInput(before.values, before.baseline)
        return { values, baseline: untouched ? values : before.baseline }
      })
    },
    [sameInput],
  )
  return {
    values: form.values,
    setValues,
    autoChange,
    dirty: !sameInput(form.values, form.baseline),
  }
}
