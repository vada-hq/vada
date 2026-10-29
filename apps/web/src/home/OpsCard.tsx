import { useId, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { HOME_OPS_SHOWN, type HomeOps, type HomeOpsRow } from '@vada/contracts'
import AssignRow, { type AssignLink } from '@/components/AssignRow'
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
}

// 누구: 얼굴 + '…에게 묻기'. 묻기는 아직 없어(시연 뒤) 같은 모양의 글로 두고 누르는 곳이 아니다.
function Contact({ row }: { row: HomeOpsRow }) {
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
  const showSeeAll = !expanded && (ops.total > HOME_OPS_SHOWN || hidden !== null)
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
            who={<Contact row={row} />}
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
          onClick={hidden ? () => setExpanded(true) : undefined}
        />
      )}
    </Tray>
  )
}
