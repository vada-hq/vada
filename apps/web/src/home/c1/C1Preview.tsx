import { useState } from 'react'
import { StartPanel, type StartAction } from '../s7/S7Start'
import C1A from './C1A'
import C1B from './C1B'
import { C1_DATA, C1_TODAY, type C1DataName, type C1Row } from './c1-view'

// 컴포넌트만 띄우는 미리보기: /home-s5.html?component=c1&variant=A|B&data=main|many|normal
// 본문 폭은 창 폭에서 바깥 여백(p-6, 휴대폰 p-4)을 뺀 값이다. 찍을 때 창을 1025·764·390으로 열어 977·716·358을 만든다.
export default function C1Preview({ variant, data }: { variant: 'A' | 'B'; data: C1DataName }) {
  const [action, setAction] = useState<StartAction | null>(null)
  const items = C1_DATA[data] ?? C1_DATA.main
  const onAsk = (row: C1Row) =>
    row.person && setAction({ kind: 'ask', to: row.person, attach: row.title, marker: row.fact, asked: row.asked })
  const props = { items, today: C1_TODAY, onOpen: () => {}, onAsk, onAssign: () => {}, onSeeAll: () => {} }
  return (
    <main className="min-h-dvh bg-background p-6 max-sm:p-4" data-c1-variant={variant}>
      <div className="@container" data-c1-root>
        {variant === 'B' ? <C1B {...props} /> : <C1A {...props} />}
      </div>
      <StartPanel action={action} onClose={() => setAction(null)} />
    </main>
  )
}
