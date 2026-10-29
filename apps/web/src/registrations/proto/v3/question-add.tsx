import { useState } from 'react'
import { CircleDot, Plus, SquareCheck, Type } from 'lucide-react'
import { QUESTION_KIND_LABELS, QUESTION_KINDS, type QuestionKind } from '@vada/contracts'
import { Button } from '@/components/ui/button'

// 질문 종류 아이콘과 [질문 추가](누르면 종류 셋이 나온다, 점진 공개).

export const KIND_ICON = {
  short_text: Type,
  single_choice: CircleDot,
  multiple_choice: SquareCheck,
}

export function AddQuestion({ onAdd }: { onAdd: (kind: QuestionKind) => void }) {
  const [picking, setPicking] = useState(false)
  if (!picking)
    return (
      <Button
        type="button"
        variant="ghost"
        touch
        className="-ml-2 self-start text-primary-strong"
        onClick={() => setPicking(true)}
      >
        <Plus aria-hidden />
        질문 추가
      </Button>
    )
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-subtle p-1">
      {QUESTION_KINDS.map(kind => {
        const Icon = KIND_ICON[kind]
        return (
          <Button
            type="button"
            key={kind}
            variant="ghost"
            size="sm"
            touch
            className="text-fg-secondary"
            onClick={() => {
              onAdd(kind)
              setPicking(false)
            }}
          >
            <Icon aria-hidden />
            {QUESTION_KIND_LABELS[kind]}
          </Button>
        )
      })}
    </div>
  )
}
