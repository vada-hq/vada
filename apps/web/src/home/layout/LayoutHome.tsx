import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import F8 from '../c1r/f8'
import E6 from '../c2/e6'
import AvailableA from '../c35/AvailableA'
import AvailableB from '../c35/AvailableB'
import { dateText, ME } from '../c35/c35-data'
import Todo from '../c35/Todo'
import WeekA from '../c35/WeekA'
import WeekB from '../c35/WeekB'
import { LAYOUT_DAYS, LAYOUT_PLANS, LAYOUT_TODAY, type LayoutGreet } from './layout-days'
import type { LayoutPreviewValue } from './layout-preview'
import {
  FOCUS_TRAY,
  HEAD,
  HEAD_MID,
  HEAD_TEXT,
  MIXED_COLS,
  MIXED_LEFT,
  MIXED_RIGHT,
  RULE,
  STACK,
  TWO_COLS,
} from './tokens'

// 회장단 홈 배치 시안 L1~L3(notes/integration/home/layout-spec.md). 구역은 각 폴더의 것을 그대로 놓고, 놓는 법만 안마다 다르다.
//   L1 한 단 · 머리 line · ① 쟁반 진하게 · 간격만
//   L2 두 단(왼쪽 ①② | 오른쪽 ③⑤·사용 가능) · 머리 date · 같은 무게 · 구역 머리 글자 크기 차이
//   L3 섞기(위 ① | 아래 ② | ③⑤·사용 가능) · 머리 merge · ①이 0건이면 ②가 첫 구역 · 얇은 구분
// 구역마다 @container를 따로 둔다: 구역은 자기 폭으로 390 꼴과 넓은 꼴을 가른다(단 폭이 곧 구역 폭).
// 찍기·측정은 [data-layout-root], [data-layout-zone], [data-layout-col]을 본다.

type Props = LayoutPreviewValue & { pushBand?: ReactNode }

const log = (what: string, ...rest: unknown[]) => console.info(`[layout] ${what}`, ...rest)
const noop = () => {}

function Head({ greet, calm }: { greet: LayoutGreet; calm: boolean }) {
  const merged = greet === 'merge' && calm
  const line =
    greet === 'date'
      ? null
      : merged
        ? `${ME.name}님, 오늘은 확인할 일 없어요`
        : `${ME.name}님, 안녕하세요`
  return (
    <div className={HEAD} data-layout-zone="head">
      <h2 className={cn('font-semibold text-fg-secondary', HEAD_TEXT)}>{dateText(LAYOUT_TODAY)}</h2>
      {line && (
        <p
          className={cn(
            'break-keep',
            HEAD_TEXT,
            merged ? 'font-medium text-fg-secondary' : 'text-fg-tertiary',
          )}
        >
          {line}
        </p>
      )}
    </div>
  )
}

function Zone({
  name,
  className,
  children,
}: {
  name: string
  className?: string | undefined
  children: ReactNode
}) {
  return (
    <div data-layout-zone={name} className={cn('@container min-w-0 empty:hidden', className)}>
      {children}
    </div>
  )
}

const Rule = ({ className }: { className?: string | undefined }) => (
  <div aria-hidden className={cn(RULE, className)} />
)

function useZones({ day, week }: Pick<Props, 'day' | 'week'>) {
  const d = LAYOUT_DAYS[day]
  const Week = week === 'b' ? WeekB : WeekA
  const Available = week === 'b' ? AvailableB : AvailableA
  return {
    calm: d.c1.total === 0,
    // ⑤ 안 a는 0건이면 숨는다(구역 그대로). 숨으면 ③ 뒤 구분선도 없앤다.
    hasWeek: week === 'b' || d.c35.week.length > 0,
    c1: (
      <F8
        data={d.c1}
        onOpen={row => log('일 보기', row.id)}
        onAsk={row => log('묻기', row.id)}
        onOpenAsked={row => log('물은 대화', row.id)}
        onAssign={row => log('배정', row.id)}
        onSeeAll={() => log('① 전체 보기')}
      />
    ),
    c2: (
      <E6
        data={d.c2}
        onOpen={event => log('행사 보기', event.id)}
        onLate={noop}
        onRegistrations={noop}
        onDecide={noop}
        onBudget={noop}
        onSeeAll={() => log('행사 전체 보기')}
        onCreate={() => log('새 행사')}
      />
    ),
    todo: (
      <Todo
        data={d.c35.todo}
        onOpen={row => log('원래 화면', row.id)}
        onAsk={row => log('정산 묻기', row.id)}
        onSeeAll={() => log('③ 전체 보기')}
      />
    ),
    week: (
      <Week
        items={d.c35.week}
        onOpen={item => log('일정 보기', item.id)}
        onAgenda={item => log('안건 올리기', item.id)}
      />
    ),
    available: <Available amount={d.c35.available} onFinance={() => log('재정 보기')} />,
  }
}

type Zones = ReturnType<typeof useZones>

// L1: 한 단. ①만 쟁반을 한 단계 진하게(0건 띠는 그대로). 구역 사이는 간격만.
function L1({ z, showC1 }: { z: Zones; showC1: boolean }) {
  return (
    <>
      {showC1 && (
        <Zone name="c1" className={z.calm ? undefined : FOCUS_TRAY}>
          {z.c1}
        </Zone>
      )}
      <Zone name="c2">{z.c2}</Zone>
      <Zone name="todo">{z.todo}</Zone>
      <Zone name="week">{z.week}</Zone>
      <Zone name="available">{z.available}</Zone>
    </>
  )
}

// L2: 넓으면 두 단(왼쪽 ①② | 오른쪽 ③⑤·사용 가능), 1024 이하는 한 단. 무게는 같고, 구역 머리 글자를 ①② 20 / ③ 17 / ⑤ 15로 단계 짓는다.
function L2({ z, showC1 }: { z: Zones; showC1: boolean }) {
  return (
    <div className={TWO_COLS}>
      <div data-layout-col="left" className={STACK}>
        {showC1 && <Zone name="c1">{z.c1}</Zone>}
        <Zone name="c2">{z.c2}</Zone>
      </div>
      <div data-layout-col="right" className={STACK}>
        <Zone name="todo" className={HEAD_MID}>
          {z.todo}
        </Zone>
        <Zone name="week">{z.week}</Zone>
        <Zone name="available">{z.available}</Zone>
      </div>
    </div>
  )
}

// L3: 위 ①(한 단 전체) / 아래 ② | ③⑤·사용 가능. ①이 0건이면(merge) ①이 머리 한 문장으로 들어가고 ②가 첫 구역이 된다.
// 구역 사이는 얇은 선: 위아래 줄 사이 가로선, 두 단 사이 세로선, 오른쪽 단 ③과 ⑤ 사이 가로선. 한 단이면 모두 가로선.
function L3({ z, showC1 }: { z: Zones; showC1: boolean }) {
  return (
    <>
      {showC1 && (
        <>
          <Zone name="c1">{z.c1}</Zone>
          <Rule />
        </>
      )}
      <div className={MIXED_COLS}>
        <div data-layout-col="left" className={cn(STACK, MIXED_LEFT)}>
          <Zone name="c2">{z.c2}</Zone>
          <Rule className="@min-[56rem]:hidden" />
        </div>
        <div data-layout-col="right" className={cn(STACK, MIXED_RIGHT)}>
          <Zone name="todo">{z.todo}</Zone>
          {z.hasWeek && <Rule />}
          <Zone name="week">{z.week}</Zone>
          <Zone name="available">{z.available}</Zone>
        </div>
      </div>
    </>
  )
}

const PLANS = { L1, L2, L3 }

export default function LayoutHome({ plan, day, week, greet, pushBand }: Props) {
  const z = useZones({ day, week })
  // merge이고 ①이 0건이면 ① 띠 대신 머리 한 문장(어느 안에서든 주소로 greet=merge를 주면 같다)
  const showC1 = !(greet === 'merge' && z.calm)
  const Plan = PLANS[plan]
  const axes = LAYOUT_PLANS[plan]
  return (
    <div
      className="@container"
      data-layout-root
      data-layout-plan={plan}
      data-layout-day={day}
      data-layout-week={week}
      data-layout-greet={greet}
      data-layout-columns={axes.columns}
    >
      <div className={STACK}>
        {pushBand}
        <Head greet={greet} calm={z.calm} />
        <Plan z={z} showC1={showC1} />
      </div>
    </div>
  )
}
