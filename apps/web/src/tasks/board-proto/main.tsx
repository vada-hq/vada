import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { B1Board, B1List } from './b1/Board'
import { B2Board, B2List } from './b2/Board'
import { B3Board, B3List } from './b3/Board'
import { NowBoard } from './now/Board'
import { DATA_NAMES, SAMPLES, type DataName } from './data'
import { Frame } from './Frame'

// 행사 업무 탭 보드 시안 판: /tasks-board.html?variant=b1|b2|b3&data=main|few|many|adding
// 서버 없이 견본(data.ts)으로만 그린다. 명세 notes/integration/tasks/board-spec.md 8절.
const params = new URLSearchParams(window.location.search)
const VARIANTS = {
  b1: { board: B1Board, list: B1List },
  b2: { board: B2Board, list: B2List },
  b3: { board: B3Board, list: B3List },
  now: { board: NowBoard, list: B1List },
}
type Variant = keyof typeof VARIANTS
const variant = (params.get('variant') ?? 'b1') as Variant
const { board: Board, list: List } = VARIANTS[variant] ?? VARIANTS.b1
const dataName = (
  DATA_NAMES.includes(params.get('data') as DataName) ? params.get('data') : 'main'
) as DataName
const sample = SAMPLES[dataName]
document.documentElement.dataset.variant = variant

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Frame board={<Board sample={sample} />} list={<List sample={sample} />} />
  </StrictMode>,
)
