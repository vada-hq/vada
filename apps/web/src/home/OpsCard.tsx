import { useId, useState } from 'react'
import { ChevronRight, UserPlus } from 'lucide-react'
import { HOME_OPS_SHOWN, type HomeOps, type HomeOpsRow } from '@vada/contracts'
import AssignRow, { TEXT_LINK, type AssignLink } from '@/components/AssignRow'
import { Button } from '@/components/ui/button'
import QuietBand from '@/components/QuietBand'
import SeeAllButton from '@/components/SeeAllButton'
import TwoColumnRow from '@/components/TwoColumnRow'
import { Tray, TrayGroup, TrayHead } from '@/components/Tray'
import PersonText from './PersonText'
import type { AskOf } from './use-ask'
import {
  ASSIGN_TITLE,
  OPS_ICON,
  OPS_TITLE,
  factText,
  hasAssign,
  hiddenText,
  isDanger,
  shownLimit,
} from './ops-view'

type Props = {
  ops: HomeOps
  onOpen: (target: HomeOpsRow['target']) => void
  onAssignTasks: () => void
  onSeePeople: () => void
  onSeeFinance: () => void
  // 부장 없는 부서의 '부장 정하기': 조직 화면의 그 부서
  onSetHead: (departmentId: string) => void
  // '…에게 묻기'를 누르면 그 사람과의 1:1을 연다. 없으면 글로만 보인다.
  askOf?: AskOf | undefined
}

// 누구: 얼굴 + '…에게 묻기'(누르면 그 사람과의 1:1).
// 연락할 부장이 없으면 '기획부 · 부장 없음'과 [부장 정하기](조직의 그 부서, 재정 담당 없음과 같은 꼴)를 둔다.
function Contact({
  row,
  onSetHead,
  askOf,
}: {
  row: HomeOpsRow
  onSetHead: Props['onSetHead']
  askOf: Props['askOf']
}) {
  if (row.noHead) {
    const { id, name } = row.noHead
    return (
      <span className="flex min-h-9 flex-wrap items-center gap-x-3 text-row-sub">
        <span className="text-fg-tertiary">{`${name} · 부장 없음`}</span>
        <Button variant="link" className={TEXT_LINK} onClick={() => onSetHead(id)}>
          부장 정하기
          <ChevronRight aria-hidden />
        </Button>
      </span>
    )
  }
  return row.contact && <PersonText person={row.contact} ask onAsk={askOf?.(row.contact)} />
}

function assignLinks(ops: HomeOps, props: Props): AssignLink[] {
  if (ops.assign.by === 'head')
    return [{ label: `담당자 없는 업무 ${ops.assign.noAssignee}건`, onClick: props.onAssignTasks }]
  const { noDepartment, unassignedMembers, financeStaffed } = ops.assign
  return [
    noDepartment > 0 && { label: `부서 미정 업무 ${noDepartment}건`, onClick: props.onAssignTasks },
    unassignedMembers > 0 && {
      label: `미배정 구성원 ${unassignedMembers}명`,
      onClick: props.onSeePeople,
    },
    !financeStaffed && { label: '재정 담당 없음', onClick: props.onSeeFinance },
  ].filter((link): link is AssignLink => Boolean(link))
}

// ① 확인이 필요한 운영 상황(f8 확정 시안): 회색 쟁반 위 흰 묶음. 일 줄은 상한 5(배정할 일이 있으면 4)이고
// 배정할 일(회장단 또는 부장) 한 줄을 늘 맨 아래에 둔다. '전체 n건 보기'는 홈 안에서 접힌 줄을 펼친다.
export default function OpsCard(props: Props) {
  const { ops, onOpen } = props
  const headId = useId()
  const [expanded, setExpanded] = useState(false)
  if (ops.total === 0) return <QuietBand id={headId}>{`${OPS_TITLE} 없음`}</QuietBand>
  const shown = expanded ? ops.rows : ops.rows.slice(0, shownLimit(ops))
  const hidden = hiddenText(ops.counts, shown)
  // 펼친 뒤에도 서버 상한 밖에 남은 줄이 있으면 그 수를 글로 남긴다(누를 곳은 없다).
  const showSeeAll = expanded ? hidden !== null : ops.total > HOME_OPS_SHOWN || hidden !== null
  return (
    <Tray labelledBy={headId}>
      <TrayHead id={headId} title={OPS_TITLE} count={ops.total} />
      <TrayGroup>
        {shown.map(row => (
          <TwoColumnRow
            key={row.target.id}
            icon={OPS_ICON[row.kind]}
            title={row.title}
            fact={factText(row)}
            danger={isDanger(row)}
            detail={row.event?.name}
            who={<Contact row={row} onSetHead={props.onSetHead} askOf={props.askOf} />}
            onOpen={() => onOpen(row.target)}
          />
        ))}
        {hasAssign(ops) && (
          <AssignRow
            icon={UserPlus}
            title={ASSIGN_TITLE[ops.assign.by]}
            links={assignLinks(ops, props)}
          />
        )}
      </TrayGroup>
      {showSeeAll && (
        <SeeAllButton
          total={ops.total}
          hidden={hidden}
          onClick={hidden && !expanded ? () => setExpanded(true) : undefined}
        />
      )}
    </Tray>
  )
}
