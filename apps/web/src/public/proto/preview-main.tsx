// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다.
// ─────────────────────────────────────────────────────────────────────────────
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  CLOSED_DATA_NAMES,
  FORM_DATA,
  FORM_DATA_NAMES,
  type ClosedDataName,
  type FormDataName,
} from './form-data'
import { FORM_SCREENS, type FormScreen } from './form-props'
import FormPreview, { FORM_VARIANTS, type FormState, type FormVariant } from './FormPreview'
import '../../index.css'

// 신청자 화면 시안 진입(form-apply.html). 판 문서: notes/integration/events/form-apply-board.md
// ?variant=v0|v1|v2|v3&screen=apply|done|closed&data=<견본>[&state=busy|problem]
// 모르는 값은 v0·apply·main. closed 화면의 견본은 full|before|paused|ended|cancelled|moved(모르면 full),
// apply·done의 견본은 main|free|long|dayof(모르면 main)다. API 서버 없이 견본으로만 그린다.
const params = new URLSearchParams(window.location.search)
const pick = <T extends string>(value: string | null, names: readonly T[], fallback: T): T =>
  names.includes(value as T) ? (value as T) : fallback

const variant = pick(params.get('variant'), Object.keys(FORM_VARIANTS) as FormVariant[], 'v0')
const screen = pick<FormScreen>(params.get('screen'), FORM_SCREENS, 'apply')
const dataName =
  screen === 'closed'
    ? pick<ClosedDataName>(params.get('data'), CLOSED_DATA_NAMES, 'full')
    : pick<FormDataName>(params.get('data'), FORM_DATA_NAMES, 'main')
const state = pick<FormState>(params.get('state'), ['idle', 'busy', 'problem'], 'idle')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FormPreview variant={variant} screen={screen} data={FORM_DATA[dataName]} state={state} />
  </StrictMode>,
)
