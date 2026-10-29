import { CalendarX2, UserPlus } from 'lucide-react'
import type { HomeOps, HomeOpsPerson, HomeOpsRow } from '@vada/contracts'
import AskedPill from '@/components/AskedPill'
import AssignRow from '@/components/AssignRow'
import PersonFace from '@/components/PersonFace'
import QuietBand from '@/components/QuietBand'
import SeeAllButton from '@/components/SeeAllButton'
import TwoColumnRow from '@/components/TwoColumnRow'
import { Tray, TrayGroup, TrayHead } from '@/components/Tray'
import OpsCard from '@/home/OpsCard'
import { Section } from './GallerySection'
import { noop, Width } from './home-frame-samples'

// 회장단 홈 ① '확인이 필요한 운영 상황'(f8 확정 시안)과 그 부품. 폭은 시안의 977(1280 창 본문)·716·358(휴대폰 구역)이다.

const person = (name: string, tint: number, role: HomeOpsPerson['role']): HomeOpsPerson => ({
  memberId: `m-${name}`,
  name,
  role,
  tint,
})
// 얼굴 색 번호(서버가 사람마다 정한다)
const TINT = { kim: 3, park: 1, lee: 0, jung: 2 } as const
const KIM = person('김민준', TINT.kim, { kind: 'head', department: '기획부', title: '부장' })
const PARK = person('박서준', TINT.park, { kind: 'head', department: '총무부', title: '부장' })
const LEE = person('이서연', TINT.lee, { kind: 'assignee' })
const JUNG = person('정하늘', TINT.jung, {
  kind: 'finance_head',
  department: '재정부',
  title: '부장',
})

const row = (
  id: string,
  kind: HomeOpsRow['kind'],
  title: string,
  extra: Partial<HomeOpsRow>,
): HomeOpsRow => ({
  kind,
  target: { kind: kind === 'approval' ? 'request' : 'task', id },
  title,
  days: 0,
  event: null,
  contact: null,
  noHead: null,
  actions: [],
  ...extra,
})
const FESTIVAL = { id: 'e1', name: '가을 축제' }
const TALK = { id: 'e2', name: '진로 특강' }
const LONG_EVENT = { id: 'e3', name: '2026 소프트웨어융합대학 체육대회 및 학과 대항 e스포츠 리그' }

// 주(main): 지남 2, 오늘 1, 내일 1, 결재 1, 부서 미정 1, 미배정 1 = 7건
const LATE_KIM = row('t101', 'late', '체험 부스 구성안 확정', {
  days: 3,
  event: FESTIVAL,
  contact: KIM,
})
const LATE_LEE = row('t102', 'late', '동아리 지원금 신청서 제출', { days: 2, contact: LEE })
const REST_ROWS = [
  row('t103', 'today', '부스 전기 사용 신청', { event: FESTIVAL, contact: PARK }),
  row('t104', 'tomorrow', '진로 특강 현장 운영 순서표 만들기', {
    days: 1,
    event: TALK,
    contact: KIM,
  }),
  row('r201', 'approval', '진로 특강 다과 구매', { days: 3, event: TALK, contact: JUNG }),
]
const MAIN_ROWS = [LATE_KIM, LATE_LEE, ...REST_ROWS]
export const mainOps: HomeOps = {
  rows: MAIN_ROWS,
  counts: { late: 2, today: 1, tomorrow: 1, approval: 1 },
  assign: { noDepartment: 1, unassignedMembers: 1, financeStaffed: true },
  total: 7,
}
// 많음(many): 지남 셋(긴 제목·긴 행사 포함)이라 결재가 접힌다. 재정 담당도 없다.
const many: HomeOps = {
  rows: [
    row('t100', 'late', '2학기 학생회비 집행 내역 정리와 학과 사무실 제출용 증빙 묶음 만들기', {
      days: 5,
      event: LONG_EVENT,
      contact: KIM,
    }),
    LATE_KIM,
    LATE_LEE,
    row('t105', 'today', '홍보 포스터 인쇄 맡기기', { noHead: { id: 'd4', name: '홍보부' } }),
    ...REST_ROWS,
  ],
  counts: { late: 3, today: 2, tomorrow: 1, approval: 1 },
  assign: { noDepartment: 2, unassignedMembers: 0, financeStaffed: false },
  total: 10,
}
// 배정만: 마감 줄이 하나이고 배정 줄
const assign: HomeOps = {
  rows: [
    row('t104', 'tomorrow', '진로 특강 현장 운영 순서표 만들기', {
      days: 1,
      event: TALK,
      contact: KIM,
    }),
  ],
  counts: { late: 0, today: 0, tomorrow: 1, approval: 0 },
  assign: { noDepartment: 3, unassignedMembers: 2, financeStaffed: true },
  total: 6,
}
const empty: HomeOps = {
  rows: [],
  counts: { late: 0, today: 0, tomorrow: 0, approval: 0 },
  assign: { noDepartment: 0, unassignedMembers: 0, financeStaffed: true },
  total: 0,
}

const WIDTHS = [
  ['977px 칸(1280 창 본문)', 'w-244'],
  ['716px 칸', 'w-179'],
  ['358px 칸(휴대폰 구역)', 'w-90'],
] as const

const Ops = ({ ops }: { ops: HomeOps }) => (
  <OpsCard
    ops={ops}
    onOpen={noop}
    onAssignTasks={noop}
    onSeePeople={noop}
    onSeeFinance={noop}
    onSetHead={noop}
  />
)

export function HomeOpsSection() {
  const samples = [
    ['주', mainOps],
    ['많음(재정 담당 없음)', many],
    ['배정', assign],
    ['0건', empty],
  ] as const
  return (
    <Section title="회장단 홈 ① 확인이 필요한 운영 상황(f8)">
      {samples.flatMap(([name, ops]) =>
        WIDTHS.map(([label, width]) => (
          <Width
            key={`${name}-${label}`}
            label={`${name} · ${label}`}
            className={`${width} shrink-0`}
          >
            <Ops ops={ops} />
          </Width>
        )),
      )}
    </Section>
  )
}

// 홈 구역 부품 한 벌(②③⑤가 같이 쓴다). 물어봄 알약은 아직 화면에 나오지 않는다(묻기는 시연 뒤).
export function HomePartsSection() {
  return (
    <Section title="홈 구역 부품(쟁반·두 칸 줄·배정 줄·얼굴·물어봄·전체 보기·0건 띠)">
      {WIDTHS.filter((_, index) => index !== 1).map(([label, width]) => (
        <Width key={label} label={`쟁반 · ${label}`} className={`${width} shrink-0`}>
          <Tray labelledBy={`parts-${width}`}>
            <TrayHead id={`parts-${width}`} title="구역 이름" count={3} />
            <TrayGroup>
              <TwoColumnRow
                icon={CalendarX2}
                title="체험 부스 구성안 확정"
                fact="3일 지남"
                danger
                detail="가을 축제"
                who={<AskedPill asked="10월 28일 물어봄" answer="답 있음" answered />}
                onOpen={noop}
              />
              <TwoColumnRow
                icon={CalendarX2}
                title="부스 전기 사용 신청"
                fact="내일 마감"
                who={<AskedPill asked="10월 29일 물어봄" answer="답 없음" answered={false} />}
                onOpen={noop}
              />
              <AssignRow
                icon={UserPlus}
                title="회장단이 배정할 일"
                links={[
                  { label: '부서 미정 업무 1건', onClick: noop },
                  { label: '미배정 구성원 1명', onClick: noop },
                ]}
              />
            </TrayGroup>
            <SeeAllButton total={7} hidden="외 1건 · 결재 대기 1" onClick={noop} />
            <SeeAllButton total={7} hidden={null} />
          </Tray>
        </Width>
      ))}
      <Width label="얼굴 여섯 색" className="w-90 shrink-0">
        <div className="flex gap-2">
          {['김민준', '이서연', '박서준', '정하늘', '최유나', '한도윤'].map((name, tint) => (
            <PersonFace key={name} name={name} tint={tint} />
          ))}
        </div>
      </Width>
      <Width label="0건 띠" className="w-90 shrink-0">
        <QuietBand id="parts-quiet">확인이 필요한 운영 상황 없음</QuietBand>
      </Width>
    </Section>
  )
}
