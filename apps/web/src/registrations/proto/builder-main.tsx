// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다.
// ─────────────────────────────────────────────────────────────────────────────
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BUILDER_DATA,
  BUILDER_SCREENS,
  SCREEN_DATA,
  type BuilderDataName,
  type BuilderScreen,
} from './builder-data'
import BuilderPreview, { BUILDER_VARIANTS, type BuilderVariant } from './BuilderPreview'
import '../../index.css'

// 양식 만들기 화면 시안 진입(form-builder.html). 판 문서: notes/integration/events/form-builder-board.md
// ?variant=v0|v1|v2|v3&screen=card|editor|empty&data=<견본>
// 모르는 값은 v0·card·그 화면의 첫 견본(card는 active, editor는 new, empty는 none). API 서버 없이 견본으로만 그린다.
const params = new URLSearchParams(window.location.search)
const pick = <T extends string>(value: string | null, names: readonly T[], fallback: T): T =>
  names.includes(value as T) ? (value as T) : fallback

const variant = pick(params.get('variant'), Object.keys(BUILDER_VARIANTS) as BuilderVariant[], 'v0')
const screen = pick<BuilderScreen>(params.get('screen'), BUILDER_SCREENS, 'card')
const names: readonly BuilderDataName[] = SCREEN_DATA[screen]
const dataName = pick(params.get('data'), names, names[0]!)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BuilderPreview variant={variant} screen={screen} data={BUILDER_DATA[dataName]} />
  </StrictMode>,
)
