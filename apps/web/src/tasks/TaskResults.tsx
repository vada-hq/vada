import type { TaskDetail, TaskResultKind } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DELETED_MESSAGE } from '@/lib/messages'
import { makeLabel, RESULT_KIND_LABEL, STAGE_CHIP } from './task-results'

type Props = {
  task: Pick<TaskDetail, 'results' | 'canMake'>
  saving: boolean
  onMake: (kind: TaskResultKind) => void
}

// 업무에서 만든 결과물과 [○○ 만들기]. 서버가 준 results와 canMake만 쓴다(DEC-38).
export function TaskResults({ task, saving, onMake }: Props) {
  return (
    <section aria-label="결과물" className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-gray-500">결과물</h3>
      {task.results.length === 0 ? (
        <p className="text-sm text-gray-500">결과물 없음</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {task.results.map(result => {
            const chip = STAGE_CHIP[result.stage]
            return (
              <li key={result.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 wrap-anywhere text-gray-800">
                  <span className="text-gray-500">{RESULT_KIND_LABEL[result.kind]}</span>
                  {` · ${result.title ?? DELETED_MESSAGE}`}
                </span>
                {chip && <Badge tone={chip.tone}>{chip.label}</Badge>}
              </li>
            )
          })}
        </ul>
      )}
      {task.canMake.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {task.canMake.map(kind => (
            <Button
              key={kind}
              variant="outline"
              size="sm"
              busy={saving}
              onClick={() => onMake(kind)}
            >
              {makeLabel(kind)}
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}
