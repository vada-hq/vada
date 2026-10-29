// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(e1~e6)은 읽기만 한다.
// ─────────────────────────────────────────────────────────────────────────────
import { C2_DATA, type C2DataName } from './c2-data'
import type { C2Props } from './c2-props'
import E1 from './e1'
import E2 from './e2'
import E3 from './e3'
import E4 from './e4'
import E5 from './e5'
import E6 from './e6'

// ② 행사 구역 컴포넌트 하나만 띄우는 미리보기 껍데기: /home-s5.html?component=c2&variant=e1..e6&data=main|quiet|one|empty|long
// 바깥 여백은 ①(C1rPreview)과 같다. 컴포넌트 폭 = 창 폭 - 바깥 여백(p-6, 휴대폰 p-4).
// 창 1025·764·390 → 977·716·358(옆 메뉴 포함 셸의 본문 폭과 같다).
// 찍기·측정은 [data-c2-root] 상자를 컴포넌트로 본다. 컴포넌트는 그 안에 하나만 둔다.
// 테마는 진입 파일이 기본(base)으로 건다(명세: 토큰 값은 '지금' 그대로).
// e1~e6: 시안 자리. 미리 다 등록해 두어 만드는 쪽은 자기 e{N}/ 폴더만 고친다.
export const C2_VARIANTS = { e1: E1, e2: E2, e3: E3, e4: E4, e5: E5, e6: E6 }
export type C2Variant = keyof typeof C2_VARIANTS

const log = (what: string, ...rest: unknown[]) => console.info(`[c2] ${what}`, ...rest)

const props = (data: C2DataName): C2Props => ({
  data: C2_DATA[data] ?? C2_DATA.main,
  onOpen: event => log('행사 보기', event.id),
  onLate: (event, department) => log('늦은 부서 보기', event.id, department),
  onRegistrations: event => log('신청 보기', event.id),
  onDecide: (event, field) => log('미정 정하기', event.id, field),
  onBudget: event => log('예산 보기', event.id),
  onSeeAll: () => log('전체 보기'),
  onCreate: () => log('새 행사'),
})

export default function C2Preview({ variant, data }: { variant: C2Variant; data: C2DataName }) {
  const Variant = C2_VARIANTS[variant] ?? E1
  return (
    <main
      className="min-h-dvh bg-background p-6 max-sm:p-4"
      data-c2-variant={variant}
      data-c2-data={data}
    >
      <div className="@container" data-c2-root>
        <Variant {...props(data)} />
      </div>
    </main>
  )
}
