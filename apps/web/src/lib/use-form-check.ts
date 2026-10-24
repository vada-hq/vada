import { useRef, useState } from 'react'

export type FieldErrors = Record<string, string | undefined>

// 문제가 없는 칸(undefined, 빈 글)을 뺀다.
const present = (errors: FieldErrors): FieldErrors =>
  Object.fromEntries(Object.entries(errors).filter(([, message]) => message))

// 제출 버튼을 끄지 않고 누를 때 확인한다(GOV.UK, NN/g "Marking Required Fields in Forms").
// 한 번 누른 뒤에는 고치는 대로 다시 세어, 고친 칸의 글이 바로 사라진다. 문제가 있으면 첫 문제 칸(aria-invalid)으로 옮긴다.
// check는 칸 이름 → 문제 글이다. 칸 아래 글은 Field의 error로 그린다.
// 칸을 감싼 요소(보통 form)의 ref를 붙인다. form이 없는 확인 창은 감싼 div에 붙인다.
export function useFormCheck<T extends HTMLElement = HTMLFormElement>(check: () => FieldErrors) {
  const [tried, setTried] = useState(false)
  const formRef = useRef<T>(null)
  const errors = tried ? present(check()) : {}

  // 보내도 되면 true. 아니면 문제를 보이고 false.
  function attempt() {
    setTried(true)
    const ok = Object.keys(present(check())).length === 0
    if (!ok)
      // 칸 아래 글과 aria-invalid가 그려진 다음에 옮긴다.
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
    return ok
  }

  return { formRef, errors, attempt }
}

// 필수 글 칸이 비었을 때의 문제 글. 목적어는 조사까지 받는다(예: '이름을').
export const requiredText = (value: string, object: string) =>
  value.trim() === '' ? `${object} 입력해 주세요` : undefined
