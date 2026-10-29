import { cn } from '@/lib/utils'

// 부서 카드 한 칸의 폭. 연결선 칸과 부서 카드가 같은 폭·같은 가운데 정렬이라 선이 카드 가운데에 닿는다.
// 단 수는 창 폭이 아니라 본문 폭(@container)을 본다. 1280px 창의 본문(약 992px)은 3단이다.
export const DEPARTMENT_COLUMN = 'w-full @2xl:w-1/2 @2xl:px-2 @4xl:w-1/3 @6xl:w-1/4'

// 첫 줄 마지막 칸은 오른쪽 가로선을 긋지 않는다. 단 수(2·3·4)마다 첫 줄 마지막 칸이 다르다.
const COLUMNS = [
  { count: 2, hidden: '@2xl:hidden', shown: '@2xl:block' },
  { count: 3, hidden: '@4xl:hidden', shown: '@4xl:block' },
  { count: 4, hidden: '@6xl:hidden', shown: '@6xl:block' },
] as const

const rightHalf = (index: number, total: number) =>
  COLUMNS.map(({ count, hidden, shown }) =>
    index === Math.min(total, count) - 1 ? hidden : shown,
  ).join(' ')

const LINE = 'absolute bg-border-strong'

// 회장단 카드에서 부서 카드로 가는 연결선(와이어프레임 ORG-03A): 세로선 → 가로선 → 첫 줄 부서마다 세로선.
// 부서 줄과 같은 가운데 정렬 칸을 깔고 첫 줄만 보이게 잘라, 단 수가 바뀌어도 선이 카드 가운데에 닿는다.
// 한 단(휴대폰)에서는 선 없이 카드를 세로로 쌓는다.
export function OrgConnector({ total }: { total: number }) {
  return (
    <div aria-hidden className="hidden @2xl:block">
      <div className="mx-auto h-5 w-px bg-border-strong" />
      <div className="flex h-5 flex-wrap justify-center overflow-hidden">
        {Array.from({ length: total }, (_, index) => (
          <div key={index} className={cn('relative h-5', DEPARTMENT_COLUMN)}>
            {index > 0 && <span className={cn(LINE, 'top-0 right-1/2 left-0 h-px')} />}
            <span
              className={cn(LINE, 'top-0 right-0 left-1/2 hidden h-px', rightHalf(index, total))}
            />
            <span className={cn(LINE, 'inset-y-0 left-1/2 w-px')} />
          </div>
        ))}
      </div>
    </div>
  )
}
