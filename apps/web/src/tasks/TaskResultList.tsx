import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Megaphone,
  Plus,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import {
  DELETED_MESSAGE,
  type TaskDetail,
  type TaskResult,
  type TaskResultKind,
} from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { SidePanelSection } from '@/components/ui/side-panel'
import { RESULT_KIND_LABEL, STAGE_CHIP } from './task-results'

type Props = {
  task: Pick<TaskDetail, 'results' | 'canMake'>
  busy: boolean
  onMake: (kind: TaskResultKind) => void
  // 결과물 줄을 누르면 그 기록을 연다. 열 곳이 없으면(지운 공지 등) null이고 줄은 글자뿐이다.
  openerOf: (result: TaskResult) => (() => void) | null
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

// 누를 수 있는 줄은 오른쪽 꺾쇠로 그 기록으로 간다는 것을 보인다(목록 항목 이동의 관례).
function ResultLine({ result, openable }: { result: TaskResult; openable: boolean }) {
  const Icon = ICON[result.kind]
  const chip = STAGE_CHIP[result.stage]
  return (
    <>
      <Icon aria-hidden className="size-4 shrink-0 text-gray-400" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-normal text-gray-500">{RESULT_KIND_LABEL[result.kind]}</span>
        <span className="text-sm font-normal wrap-anywhere text-gray-900">
          {result.title ?? DELETED_MESSAGE}
        </span>
      </span>
      {chip && <Badge tone={chip.tone}>{chip.label}</Badge>}
      {openable && <ChevronRight aria-hidden className="size-4 shrink-0 text-gray-300" />}
    </>
  )
}

function ResultRows({ task, openerOf }: Pick<Props, 'task' | 'openerOf'>) {
  if (task.results.length === 0) return <p className="text-sm text-gray-400">결과물 없음</p>
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {task.results.map(result => {
        const open = openerOf(result)
        return (
          <li key={result.id} className="flex">
            {open ? (
              <Button
                variant="ghost"
                className="h-auto flex-1 justify-start gap-3 rounded-none px-3 py-2.5 text-left whitespace-normal hover:bg-gray-50"
                onClick={open}
              >
                <ResultLine result={result} openable />
              </Button>
            ) : (
              <span className="flex flex-1 items-center gap-3 px-3 py-2.5">
                <ResultLine result={result} openable={false} />
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function MakeMenu({ task, busy, onMake }: Omit<Props, 'openerOf'>) {
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

// 업무 상세의 결과물: 이 업무로 만든 구매 요청·신청 양식·공지·행사와 그 진행 단계, 그리고 만들기.
// 서버가 준 results와 canMake만 쓴다(DEC-38). 만들기는 목록 아래 [+ 만들기] 하나다(와이어프레임 '작업 문서 및 결과물' 표의 '+ 파일 추가' 줄). 만들 수 있을 때만 '저절로 바뀐다'는 한 줄을 단다(와이어프레임 EVT-02B 자동 반영 힌트).
export function TaskResultList({ task, busy, onMake, openerOf }: Props) {
  const canMake = task.canMake.length > 0
  return (
    <SidePanelSection
      title="결과물"
      hint={canMake ? '만들면 업무 상태가 저절로 바뀌어요' : undefined}
    >
      <ResultRows task={task} openerOf={openerOf} />
      {canMake && <MakeMenu task={task} busy={busy} onMake={onMake} />}
    </SidePanelSection>
  )
}
