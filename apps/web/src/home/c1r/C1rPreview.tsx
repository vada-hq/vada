// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v0~v3, f1~f8)은 읽기만 한다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { StartPanel, type StartAction } from '../s7/S7Start'
import { C1R_DATA, type C1rDataName, type C1rRow } from './c1r-data'
import type { C1rProps } from './c1r-props'
import type { ThemeName } from './themes/theme'
import V0 from './v0'
import V1 from './v1'
import V2 from './v2'
import V3 from './v3'
import F1 from './f1'
import F2 from './f2'
import F3 from './f3'
import F4 from './f4'
import F5 from './f5'
import F6 from './f6'
import F7 from './f7'
import F8 from './f8'

// ① 컴포넌트 하나만 띄우는 미리보기 껍데기: /home-s5.html?component=c1r&variant=0|1|2|3|f1..f8&data=main|many|assign|normal|empty[&theme=base|a|b|c]
// 테마는 진입 파일이 <html data-theme>에 건다(themes/theme.ts). 여기는 찍기 도구가 읽을 표시만 둔다.
// 컴포넌트 폭 = 창 폭 - 바깥 여백(p-6, 휴대폰 p-4). 창 1025·764·390 → 977·716·358(옆 메뉴 포함 셸의 본문 폭과 같다).
// 찍기·측정은 [data-c1r-root] 상자를 컴포넌트로 본다. 컴포넌트는 그 안에 하나만 둔다.
// f1~f8: 생김새 회차(c1f). 자리는 미리 다 등록해 두어 만드는 쪽은 자기 f{N}/ 폴더만 고친다.
export const C1R_VARIANTS = {
  '0': V0,
  '1': V1,
  '2': V2,
  '3': V3,
  f1: F1,
  f2: F2,
  f3: F3,
  f4: F4,
  f5: F5,
  f6: F6,
  f7: F7,
  f8: F8,
}
export type C1rVariant = keyof typeof C1R_VARIANTS

export default function C1rPreview({
  variant,
  data,
  theme,
}: {
  variant: C1rVariant
  data: C1rDataName
  theme: ThemeName
}) {
  const [action, setAction] = useState<StartAction | null>(null)
  // 묻기와 물은 대화 열기는 같은 대화(그 일이 붙은 대화)를 연다. 물은 적이 있으면 물은 것과 답이 보인다.
  const ask = (row: C1rRow) =>
    row.person && setAction({ kind: 'ask', to: row.person, attach: row.title, marker: row.fact, asked: row.asked })
  const props: C1rProps = {
    data: C1R_DATA[data] ?? C1R_DATA.main,
    onOpen: row => console.info('[c1r] 일 보기', row.id),
    onAsk: ask,
    onOpenAsked: ask,
    onAssign: row => console.info('[c1r] 배정하기', row.id),
    onSeeAll: () => console.info('[c1r] 전체 보기'),
  }
  const Variant = C1R_VARIANTS[variant] ?? V0
  return (
    <main
      className="min-h-dvh bg-background p-6 max-sm:p-4"
      data-c1r-variant={variant}
      data-c1r-data={data}
      data-c1r-theme={theme}
    >
      <div className="@container" data-c1r-root>
        <Variant {...props} />
      </div>
      <StartPanel action={action} onClose={() => setAction(null)} />
    </main>
  )
}
