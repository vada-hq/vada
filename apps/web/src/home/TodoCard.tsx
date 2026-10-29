import { useId, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { HOME_TODO_SHOWN, type HomeTodo, type HomeTodoRow } from '@vada/contracts'
import ActionPill from '@/components/ActionPill'
import PersonFace from '@/components/PersonFace'
import QuietBand from '@/components/QuietBand'
import SeeAllButton from '@/components/SeeAllButton'
import TwoColumnRow from '@/components/TwoColumnRow'
import { Tray, TrayGroup, TrayHead } from '@/components/Tray'
import PersonText from './PersonText'
import {
  TODO_ICON,
  TODO_TITLE,
  isTodoDanger,
  todoFact,
  todoHiddenText,
  todoTargetId,
  todoTitle,
} from './todo-view'

type Props = {
  todo: HomeTodo
  // 머리 얼굴의 이름(나)
  name: string
  onOpen: (row: HomeTodoRow) => void
}

// 누구 칸: 회장단 업무의 담당자(사람만), 정산이 남은 행사 정리의 재정부장('…에게 묻기' 글, 누르는 곳 아님)
function Who({ row }: { row: HomeTodoRow }) {
  if (row.kind === 'event_tidy')
    return row.settlementContact && <PersonText person={row.settlementContact} ask />
  if (row.kind === 'minutes' || !row.owner) return null
  return <PersonText person={row.owner} />
}

// ③ 내가 할 일(c35 확정 시안): ①과 같은 쟁반·흰 묶음·두 칸 줄이고, 머리에 내 얼굴, 줄 끝에 '확인하기' 알약을 둔다.
// 확인할 것(회의록·행사 정리)은 알약으로 원래 화면을 열고, 업무 줄은 줄 전체가 업무를 연다(꺾쇠).
export default function TodoCard({ todo, name, onOpen }: Props) {
  const headId = useId()
  const [expanded, setExpanded] = useState(false)
  if (todo.total === 0) return <QuietBand id={headId}>{`${TODO_TITLE} 없음`}</QuietBand>
  const shown = expanded ? todo.rows : todo.rows.slice(0, HOME_TODO_SHOWN)
  const hidden = todoHiddenText(todo.counts, shown)
  return (
    <Tray labelledBy={headId}>
      <TrayHead
        id={headId}
        title={TODO_TITLE}
        count={todo.total}
        lead={<PersonFace name={name} tint={todo.meTint} />}
      />
      <TrayGroup>
        {shown.map(row => (
          <TwoColumnRow
            key={`${row.kind}-${todoTargetId(row)}`}
            icon={TODO_ICON[row.kind]}
            title={todoTitle(row)}
            fact={todoFact(row)}
            danger={isTodoDanger(row)}
            who={<Who row={row} />}
            trailing={
              row.kind === 'minutes' || row.kind === 'event_tidy' ? (
                <ActionPill onClick={() => onOpen(row)}>확인하기</ActionPill>
              ) : (
                <ChevronRight aria-hidden className="size-5 text-fg-muted" />
              )
            }
            onOpen={() => onOpen(row)}
          />
        ))}
      </TrayGroup>
      {hidden && (
        <SeeAllButton
          total={todo.total}
          hidden={hidden}
          onClick={expanded ? undefined : () => setExpanded(true)}
        />
      )}
    </Tray>
  )
}
