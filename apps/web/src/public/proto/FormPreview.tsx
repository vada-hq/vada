// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다.
// ─────────────────────────────────────────────────────────────────────────────
import { APPLY_ERRORS } from '@/lib/registration-messages'
import type { FormSample } from './form-data'
import type { FormProps, FormScreen } from './form-props'
import V0 from './v0'
import V1 from './v1'
import V2 from './v2'
import V3 from './v3'

// 신청자 화면 시안 미리보기 껍데기: /form-apply.html?variant=v0..v3&screen=apply|done|closed&data=<견본>[&state=busy|problem]
// 찍기·측정은 [data-form-root] 상자(페이지 전체)를 본다. 안은 그 안에 페이지 하나를 그린다.
// v0 = 지금 구현, v1~v3 = 시안 자리. 미리 다 등록해 두어 만드는 쪽은 자기 vN/ 폴더만 고친다.
export const FORM_VARIANTS = { v0: V0, v1: V1, v2: V2, v3: V3 }
export type FormVariant = keyof typeof FORM_VARIANTS
export type FormState = 'idle' | 'busy' | 'problem'

const log = (what: string, ...rest: unknown[]) => console.info(`[form] ${what}`, ...rest)

function propsOf(screen: FormScreen, data: FormSample, state: FormState): FormProps {
  return {
    screen,
    data,
    values: data.input,
    errors: data.errors,
    busy: state === 'busy',
    problem: state === 'problem' ? (APPLY_ERRORS.REGISTRATION_FULL ?? '') : '',
    onApply: values => log('신청하기', values),
    onCancel: () => log('신청 취소'),
    onCopy: (what, value) => log('복사', what, value),
    onClosedAction: () => log(data.closed?.action.label ?? '돌아가기', data.closed?.action.href),
  }
}

type Props = { variant: FormVariant; screen: FormScreen; data: FormSample; state: FormState }

export default function FormPreview({ variant, screen, data, state }: Props) {
  const Variant = FORM_VARIANTS[variant] ?? V0
  return (
    <div
      className="min-h-dvh bg-background"
      data-form-root
      data-form-variant={variant}
      data-form-screen={screen}
      data-form-data={data.name}
    >
      <Variant {...propsOf(screen, data, state)} />
    </div>
  )
}
