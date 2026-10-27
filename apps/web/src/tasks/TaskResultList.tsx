import {
  CalendarDays,
  ClipboardList,
  Megaphone,
  Plus,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import { DELETED_MESSAGE, type TaskDetail, type TaskResultKind } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { SidePanelSection } from '@/components/ui/side-panel'
import { makeLabel, RESULT_KIND_LABEL, STAGE_CHIP } from './task-results'

// 결과물을 보이는 두 안. menu: 목록 아래 [+ 만들기] 하나(와이어프레임 '작업 문서 및 결과물' 표의 '+ 파일 추가' 줄).
// inline: 만들 수 있는 것마다 한 줄씩 펼쳐 둔다(무엇이 되는지 먼저 보인다).
export type ResultsLayout = 'menu' | 'inline'

type Props = {
  task: Pick<TaskDetail, 'results' | 'canMake'>
  layout: ResultsLayout
  busy: boolean
  onMake: (kind: TaskResultKind) => void
}

const ICON: Record<TaskResultKind, LucideIcon> = {
  request: ShoppingCart,
  registration_form: ClipboardList,
  message: Megaphone,
  event: CalendarDays,
}

// 만들면 업무 상태가 어떻게 바뀌는지(RULE-41, DEC-82). 결과물이 왜 여기 있는지를 누르기 전에 말한다.
const EFFECT: Record<TaskResultKind, string> = {
  request: '내면 진행 중, 모두 결제되면 끝남',
  registration_form: '만들면 끝남',
  message: '공지방에 올리면 끝남',
  event: '행사를 완료하면 끝남',
}

function ResultRows({ task }: Pick<Props, 'task'>) {
  if (task.results.length === 0) return <p className="text-sm text-gray-400">결과물 없음</p>
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {task.results.map(result => {
        const Icon = ICON[result.kind]
        const chip = STAGE_CHIP[result.stage]
        return (
          <li key={result.id} className="flex items-center gap-3 px-3 py-2.5">
            <Icon aria-hidden className="size-4 shrink-0 text-gray-400" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-gray-500">{RESULT_KIND_LABEL[result.kind]}</span>
              <span className="text-sm wrap-anywhere text-gray-900">
                {result.title ?? DELETED_MESSAGE}
              </span>
            </span>
            {chip && <Badge tone={chip.tone}>{chip.label}</Badge>}
          </li>
        )
      })}
    </ul>
  )
}

function MakeMenu({ task, busy, onMake }: Omit<Props, 'layout'>) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline" size="sm" busy={busy} className="self-start">
          <Plus aria-hidden />
          만들기
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="min-w-64">
        {task.canMake.map(kind => {
          const Icon = ICON[kind]
          return (
            <MenuItem key={kind} className="items-start" onSelect={() => onMake(kind)}>
              <Icon aria-hidden className="mt-0.5 text-gray-500" />
              <span className="flex flex-col">
                <span>{RESULT_KIND_LABEL[kind]}</span>
                <span className="text-xs text-gray-500">{EFFECT[kind]}</span>
              </span>
            </MenuItem>
          )
        })}
      </MenuContent>
    </Menu>
  )
}

function MakeRows({ task, busy, onMake }: Omit<Props, 'layout'>) {
  return (
    <div className="flex flex-col gap-2">
      {task.canMake.map(kind => {
        const Icon = ICON[kind]
        return (
          <Button
            key={kind}
            variant="outline"
            busy={busy}
            className="h-auto justify-start gap-3 border-dashed px-3 py-2.5 text-left whitespace-normal"
            onClick={() => onMake(kind)}
          >
            <Icon aria-hidden className="text-gray-400" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm text-gray-900">{makeLabel(kind)}</span>
              <span className="text-xs font-normal text-gray-500">{EFFECT[kind]}</span>
            </span>
          </Button>
        )
      })}
    </div>
  )
}

// 업무 상세의 결과물: 이 업무로 만든 구매 요청·신청 양식·공지·행사와 그 진행 단계, 그리고 만들기.
// 서버가 준 results와 canMake만 쓴다(DEC-38). 만들 수 있을 때만 '저절로 바뀐다'는 한 줄을 단다(와이어프레임 EVT-02B 자동 반영 힌트).
export function TaskResultList({ task, layout, busy, onMake }: Props) {
  const canMake = task.canMake.length > 0
  return (
    <SidePanelSection
      title="결과물"
      hint={canMake ? '만들면 업무 상태가 저절로 바뀌어요' : undefined}
    >
      {(task.results.length > 0 || !canMake || layout === 'menu') && <ResultRows task={task} />}
      {canMake &&
        (layout === 'menu' ? (
          <MakeMenu task={task} busy={busy} onMake={onMake} />
        ) : (
          <MakeRows task={task} busy={busy} onMake={onMake} />
        ))}
    </SidePanelSection>
  )
}
