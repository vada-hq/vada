import { useRef, useState } from 'react'
import { evaluateButtonExecution, hasFieldValue } from '../../../../packages/contracts/src/button-execution.mjs'
import { resolveParams } from './params'
import type { ButtonSpec, ScreenElement, SelectSpec } from './types'
import type { ScopeDraft } from '../state/scopes'

// 화면 명세가 이미 완전히 서술하는 동작을 화면마다 다시 쓰지 않기 위한 훅.
//
// enabledWhen(활성 조건), resetOnChangeOf(연쇄 초기화), optionsSource.params
// (인자 매핑), executeWhen/onExecutionBlocked(실행 판정)는 전부 스펙에 있고
// 해석 규칙도 하나뿐이다. 그런데 ONB-01·ORG-01·ORG-02가 같은 코드를 각자
// 들고 있었다 — INV-01에서 네 번째 사본을 만드는 대신 여기로 모은다.
// (ORG-01·ORG-02의 이전 방식은 아직 남아 있다. 백로그 참조.)

const MISSING_FIELD_MESSAGE = '필수 항목입니다'

interface UseFieldDraftOptions {
  elements: ScreenElement[]
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  // 화면이 밖에서 받은 인자. 선택지를 그것으로 좁히는 화면에만 있다.
  screenParams?: Record<string, string>
}

export function useFieldDraft({
  elements,
  draft,
  onChangeDraft,
  screenParams,
}: UseFieldDraftOptions) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})

  function setFieldValue(fieldKey: string, value: string | null, label?: string) {
    // 같은 값 재선택은 "변경"이 아니므로 resetOnChangeOf를 발동하지 않는다.
    if ((draft.values[fieldKey] ?? null) === value) {
      if (value !== null && label !== undefined && draft.labels[fieldKey] !== label) {
        onChangeDraft({ values: draft.values, labels: { ...draft.labels, [fieldKey]: label } })
      }
      return
    }

    const values = { ...draft.values, [fieldKey]: value }
    const labels = { ...draft.labels }
    if (value !== null && label !== undefined) {
      labels[fieldKey] = label
    } else {
      delete labels[fieldKey]
    }

    const clearedKeys = [fieldKey]
    for (const element of elements) {
      const spec = element.spec
      if (spec.type === 'select' && spec.resetOnChangeOf?.includes(fieldKey)) {
        values[spec.fieldKey] = null
        delete labels[spec.fieldKey]
        clearedKeys.push(spec.fieldKey)
      }
    }

    onChangeDraft({ values, labels })
    setErrors((previous) => {
      const next = { ...previous }
      for (const key of clearedKeys) {
        delete next[key]
      }
      return next
    })
  }

  function isSelectEnabled(spec: SelectSpec): boolean {
    if (!spec.enabledWhen) {
      return true
    }
    return spec.enabledWhen.every((condition) => hasFieldValue(draft.values[condition.fieldKey]))
  }

  // 선택지를 조회할 때 넘기는 인자. 예전에는 여기만 {인자: fieldKey}라는 다른
  // 모양을 손으로 풀었고, 그래서 화면이 밖에서 받은 값으로는 선택지를 좁힐 수
  // 없었다. 이제 목록·요약과 같은 해석기를 쓴다.
  function resolveSourceParams(spec: SelectSpec): Record<string, string> {
    return resolveParams(spec.optionsSource.params, {
      fields: draft.values,
      screenParams,
    })
  }

  function selectValue(fieldKey: string) {
    const value = draft.values[fieldKey]
    if (typeof value !== 'string' || value.length === 0) {
      return null
    }
    return { value, label: draft.labels[fieldKey] ?? value }
  }

  function registerRef(fieldKey: string) {
    return (element: HTMLElement | null) => {
      fieldRefs.current[fieldKey] = element
    }
  }

  // executeWhen을 만족하면 onAllowed를 부르고, 막히면 누락 필드를 표시하고
  // onExecutionBlocked.focus대로 첫 누락 필드로 이동한다.
  function runButton(button: ButtonSpec, onAllowed: () => void) {
    const result = evaluateButtonExecution({
      action: button.action,
      elements,
      values: draft.values,
    })

    if (result.allowed) {
      onAllowed()
      return
    }

    setErrors(
      Object.fromEntries(result.missingFieldKeys.map((key: string) => [key, MISSING_FIELD_MESSAGE])),
    )
    const first = result.missingFieldKeys[0]
    if (first) {
      const element = fieldRefs.current[first]
      element?.focus()
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  return {
    errors,
    isSelectEnabled,
    registerRef,
    resolveSourceParams,
    runButton,
    selectValue,
    setFieldValue,
  }
}
