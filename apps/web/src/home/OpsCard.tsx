import { useId, useState } from 'react'
import { ChevronRight, UserPlus } from 'lucide-react'
import { HOME_OPS_SHOWN, type HomeOps, type HomeOpsRow } from '@vada/contracts'
import AssignRow, { TEXT_LINK, type AssignLink } from '@/components/AssignRow'
import { Button } from '@/components/ui/button'
import PersonFace from '@/components/PersonFace'
import QuietBand from '@/components/QuietBand'
import SeeAllButton from '@/components/SeeAllButton'
import TwoColumnRow from '@/components/TwoColumnRow'
import { Tray, TrayGroup, TrayHead } from '@/components/Tray'
import {
  OPS_ICON,
  OPS_TITLE,
  contactText,
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
}

// 누구: 얼굴 + '…에게 묻기'. 묻기는 아직 없어(시연 뒤) 같은 모양의 글로 두고 누르는 곳이 아니다.
// 연락할 부장이 없으면 '기획부 · 부장 없음'과 [부장 정하기](조직의 그 부서, 재정 담당 없음과 같은 꼴)를 둔다.
function Contact({ row, onSetHead }: { row: HomeOpsRow; onSetHead: Props['onSetHead'] }) {
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
  if (!row.contact) return null
  return (
    <span className="-mx-1.5 inline-flex min-h-9 max-w-full items-center gap-2 px-1.5 pr-2.5 text-row-sub font-medium text-primary-strong">
      <PersonFace name={row.contact.name} tint={row.contact.tint} />
      <span className="min-w-0 wrap-anywhere">{`${contactText(row.contact)}에게 묻기`}</span>
    </span>
  )
}

function assignLinks(ops: HomeOps, props: Props): AssignLink[] {
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
// 회장단이 배정할 일 한 줄을 늘 맨 아래에 둔다. '전체 n건 보기'는 홈 안에서 접힌 줄을 펼친다.
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
            who={<Contact row={row} onSetHead={props.onSetHead} />}
            onOpen={() => onOpen(row.target)}
          />
        ))}
        {hasAssign(ops) && (
          <AssignRow icon={UserPlus} title="회장단이 배정할 일" links={assignLinks(ops, props)} />
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
