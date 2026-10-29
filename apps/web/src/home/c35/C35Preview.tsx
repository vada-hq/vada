import { C1R_DATA } from '../c1r/c1r-data'
import F8 from '../c1r/f8'
import { C2_DATA } from '../c2/c2-data'
import E3 from '../c2/e3'
import AvailableA from './AvailableA'
import AvailableB from './AvailableB'
import { C35_DATA, type C35DataName } from './c35-data'
import Todo from './Todo'
import WeekA from './WeekA'
import WeekB from './WeekB'

// ③·⑤·사용 가능 미리보기 껍데기:
//   /home-s5.html?component=c35&part=todo|week|available&variant=a|b&data=main|normal|empty
//   /home-s5.html?component=c35&part=stack&variant=a|b  (① f8 → ② e3 → ③ → ⑤ → 사용 가능을 main으로 쌓은 홈 미리 보기)
// ③은 한 안이라 variant를 보지 않는다. 바깥 여백·폭은 ①②와 같다(창 1025·764·390 → 977·716·358).
// 찍기·측정은 [data-c35-root] 상자를 컴포넌트로 본다. 숨김(⑤ 안 a 0건, 사용 가능 null)이면 상자가 빈다.

export const C35_PARTS = ['todo', 'week', 'available', 'stack'] as const
export type C35Part = (typeof C35_PARTS)[number]
type C35Variant = 'a' | 'b'

const log = (what: string, ...rest: unknown[]) => console.info(`[c35] ${what}`, ...rest)
const noop = () => {}

const WEEK = { a: WeekA, b: WeekB }
const AVAILABLE = { a: AvailableA, b: AvailableB }

function Part({ part, variant, data }: { part: C35Part; variant: C35Variant; data: C35DataName }) {
  const home = C35_DATA[data] ?? C35_DATA.main
  if (part === 'todo')
    return (
      <Todo
        data={home.todo}
        onOpen={row => log('원래 화면', row.source, row.id)}
        onAsk={row => log('정산 묻기', row.id)}
        onSeeAll={() => log('전체 보기')}
      />
    )
  if (part === 'week') {
    const Week = WEEK[variant]
    return (
      <Week
        items={home.week}
        onOpen={item => log('일정 보기', item.id)}
        onAgenda={item => log('안건 올리기', item.id)}
      />
    )
  }
  const Available = AVAILABLE[variant]
  return <Available amount={home.available} onFinance={() => log('재정 보기')} />
}

// 배치 단계 전 '대충 이렇게 이어진다'를 보이는 쌓기. 구역 사이 24px, 다른 꾸밈 없음.
function Stack({ variant }: { variant: C35Variant }) {
  return (
    <div className="flex flex-col gap-6">
      <F8
        data={C1R_DATA.main}
        onOpen={noop}
        onAsk={noop}
        onOpenAsked={noop}
        onAssign={noop}
        onSeeAll={noop}
      />
      <E3
        data={C2_DATA.main}
        onOpen={noop}
        onLate={noop}
        onRegistrations={noop}
        onDecide={noop}
        onBudget={noop}
        onSeeAll={noop}
        onCreate={noop}
      />
      <Part part="todo" variant={variant} data="main" />
      <Part part="week" variant={variant} data="main" />
      <Part part="available" variant={variant} data="main" />
    </div>
  )
}

export default function C35Preview({
  part,
  variant,
  data,
}: {
  part: C35Part
  variant: C35Variant
  data: C35DataName
}) {
  return (
    <main
      className="min-h-dvh bg-background p-6 max-sm:p-4"
      data-c35-part={part}
      data-c35-variant={variant}
      data-c35-data={data}
    >
      <div className="@container" data-c35-root>
        {part === 'stack' ? (
          <Stack variant={variant} />
        ) : (
          <Part part={part} variant={variant} data={data} />
        )}
      </div>
    </main>
  )
}
