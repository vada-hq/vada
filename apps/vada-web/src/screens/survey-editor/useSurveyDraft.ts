import { useState } from 'react'
import { readObjectSource } from '../../data-sources/catalog'
import { draftFromRow } from '../../spec/draft-values'
import { resolveParams } from '../../spec/params'
import { evt05 } from '../../spec/screen-specs/evt05'
import { useFieldDraft } from '../../spec/useFieldDraft'
import type { ScopeDraft } from '../../state/scopes'

interface SurveyDraftOptions {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
}

// 서버 초기값과 쓰던 초안을 연결하고, 공통 필드 편집 규칙에 위임한다.
export function useSurveyDraft({ screenParams, draft: scopeDraft, onChangeDraft }: SurveyDraftOptions) {
  const missing = (evt05.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )

  // 인자가 없는데 초안을 읽으러 가면 readObjectSource가 먼저 던진다. 갈고리는
  // 조건 없이 불러야 하므로 판정을 여기 안에서 한다(EVT-02B와 같은 자리).
  const [seed] = useState<ScopeDraft>(() =>
    missing.length > 0
      ? { values: {}, labels: {} }
      : draftFromRow(
          readObjectSource(
            evt05.draftFrom!.dataSourceKey,
            resolveParams(evt05.draftFrom!.params, { screenParams }),
          ),
        ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({ elements: evt05.elements, draft, onChangeDraft, screenParams })
  return { missing, draft, setFieldValue: field.setFieldValue }
}
