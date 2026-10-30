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

  // 확인한 문제를 걷는다(칸을 새로 여는 때처럼, 앞의 문제가 새 칸과 상관없을 때).
  const reset = () => setTried(false)

  return { formRef, errors, attempt, reset }
}

export const TOO_BIG = '더 작은 값을 입력해 주세요'
// 계약이 막은 시각은 길이 문제가 아니라서 칸 이름마다 messages로 준다.
export const TIME_CHECK = '시각을 확인해 주세요'

// 숫자 칸의 문제 글. 글자 칸의 상한도 too_big이라 origin으로 가른다. 그 밖(글자 칸의 refine 등)은 '더 짧게 입력해 주세요'다.
const CODE_TEXT: Record<string, string> = {
  invalid_type: '숫자를 입력해 주세요',
  too_small: '더 큰 값을 입력해 주세요',
  too_big: TOO_BIG,
}

type Issue = { code: string; path: readonly PropertyKey[]; origin?: string }

// 계약의 safeParse 결과. zod를 화면에 들이지 않으려고 쓰는 모양만 적는다.
export type Parsed = {
  success: boolean
  error?: { issues: readonly Issue[] } | undefined
}

const numberText = (issue: Issue) => (issue.origin === 'string' ? undefined : CODE_TEXT[issue.code])

// 칸 확인(check)이 다루지 않는 길이 상한과 형식은 계약이 마지막에 막는다. 그 문제를 칸 이름 → 글로 바꿔 칸 아래에 보인다.
// 그러지 않으면 버튼을 눌러도 아무 표시 없이 보내지 않는다(src/structure/form-check-contract.test.ts가 지킨다).
// 칸 이름은 계약의 경로를 '.'로 이은 것이다(예: 'items.0.link'). 화면의 칸도 이 이름으로 글을 읽어야 칸 아래에 보인다.
// 글자 칸(text)은 길이와 쓸 수 없는 글자를 함께 거르는데, 빈 칸은 칸 확인이 먼저 잡으므로 남는 경우는 거의 너무 긴 글이다.
// messages는 경로의 마지막 이름 → 글로, 형식이나 refine이 따로 있는 칸(링크, 날짜 등)에 준다. 칸 확인의 글이 있으면 그 글이 먼저다.
export function withContract(
  errors: FieldErrors,
  parsed: Parsed,
  messages: Record<string, string> = {},
): FieldErrors {
  const found: FieldErrors = {}
  for (const issue of parsed.error?.issues ?? []) {
    const key = issue.path.map(String).join('.')
    found[key] ??=
      numberText(issue) ?? messages[String(issue.path.at(-1))] ?? '더 짧게 입력해 주세요'
  }
  return { ...found, ...present(errors) }
}

// 필수 글 칸이 비었을 때의 문제 글. 목적어는 조사까지 받는다(예: '이름을').
export const requiredText = (value: string, object: string) =>
  value.trim() === '' ? `${object} 입력해 주세요` : undefined
