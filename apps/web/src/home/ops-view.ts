import { AlarmClock, CalendarClock, CalendarX2, type LucideIcon, Stamp } from 'lucide-react'
import {
  HOME_OPS_KINDS,
  HOME_OPS_SHOWN,
  type HomeOps,
  type HomeOpsKind,
  type HomeOpsPerson,
  type HomeOpsRow,
} from '@vada/contracts'

// ① 확인이 필요한 운영 상황(f8)의 글. 갈래·차례·셈은 서버가 정했고 여기는 글만 만든다.
export const OPS_TITLE = '확인이 필요한 운영 상황'

// ①이 0건인 날 머리 인사 대신 쓰는 한 문장(배치 merge). ① 이름에 묶어, 같은 날 ③에 할 일이 있어도 헷갈리지 않게 한다.
// 문구는 대표 확인 중이라 이 한 곳에서만 정한다.
export const calmGreeting = (name: string) => `${name}님, ${OPS_TITLE} 없어요`

export const OPS_ICON: Record<HomeOpsKind, LucideIcon> = {
  late: CalendarX2,
  today: AlarmClock,
  tomorrow: CalendarClock,
  approval: Stamp,
}

// 접힌 줄을 '전체 보기' 옆에 셀 때의 이름
const OPS_KIND_NAME: Record<HomeOpsKind, string> = {
  late: '지남',
  today: '오늘 마감',
  tomorrow: '내일 마감',
  approval: '결재 대기',
}

export function factText(row: HomeOpsRow) {
  if (row.kind === 'late') return `${row.days}일 지남`
  if (row.kind !== 'approval') return OPS_KIND_NAME[row.kind]
  if (row.days > 0) return `결재 대기 D-${row.days}`
  return row.days === 0 ? '결재 대기 · 오늘 필요' : `결재 대기 · ${-row.days}일 지남`
}

// 위험 색은 지남·오늘 마감만(c1-spec K5). 결재는 지나도 위험 색을 쓰지 않는다.
export const isDanger = (row: HomeOpsRow) => row.kind === 'late' || row.kind === 'today'

// 부서 직급 이름: 부서 이름 끝 글자와 직급 첫 글자가 같으면 붙여 쓴다('기획부' + '부장' → '기획부장', '기획국' + '국장' → '기획국장').
const TITLE_LENGTH = 2
function headLabel(department: string, title: string) {
  if (title.length === TITLE_LENGTH && title.endsWith('장') && department.endsWith(title[0]!))
    return `${department}장`
  return `${department} ${title}`
}

export function contactText(person: HomeOpsPerson) {
  const { role } = person
  if (role.kind === 'assignee') return `${person.name} 담당자`
  if (role.kind === 'council') return `${person.name} ${role.title}`
  return `${person.name} ${headLabel(role.department, role.title)}`
}

// 회장단이 배정할 일 줄을 둘지(부서 미정 업무, 미배정 구성원, 재정 담당 없음 가운데 하나라도 있으면)
export const hasAssign = ({ assign }: HomeOps) =>
  assign.noDepartment > 0 || assign.unassignedMembers > 0 || !assign.financeStaffed

// 처음에 보일 일 줄 수: 상한 5에서 배정 줄 몫 하나를 뺀다.
export const shownLimit = (ops: HomeOps) => HOME_OPS_SHOWN - (hasAssign(ops) ? 1 : 0)

// 접힌 일 줄을 갈래별로 센 글: '외 2건 · 내일 마감 1, 결재 대기 1'. 서버가 상한으로 자른 줄도 갈래별 수로 센다.
export function hiddenText(counts: HomeOps['counts'], shown: HomeOpsRow[]) {
  const parts = HOME_OPS_KINDS.map(kind => ({
    kind,
    n: counts[kind] - shown.filter(row => row.kind === kind).length,
  })).filter(part => part.n > 0)
  if (!parts.length) return null
  const total = parts.reduce((sum, part) => sum + part.n, 0)
  return `외 ${total}건 · ${parts.map(part => `${OPS_KIND_NAME[part.kind]} ${part.n}`).join(', ')}`
}
