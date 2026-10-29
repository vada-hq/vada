import type { EventSummary, RegistrationForm, RegistrationFormsResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { SidePanelSection } from '@/components/ui/side-panel'
import type { PolledState } from '@/lib/use-polled-read'
import { REGISTRATION_FORMS_LOAD_FAILED } from '@/lib/registration-messages'
import { feeText } from '@/public/registration-text'

type Props = {
  forms: PolledState<RegistrationFormsResponse>
  owner: EventSummary['owner']
  busy: boolean
  // 참가비·정원을 고치러 신청 양식이 있는 탭으로 간다(패널을 닫는다).
  onOpenForms: () => void
}

// 고칠 양식이 없으면 링크가 만들러 간다(가는 곳은 같다).
const noForms = (forms: PolledState<RegistrationFormsResponse>) =>
  forms.kind === 'ready' && forms.data.forms.length === 0

const feeOf = (form: RegistrationForm) =>
  form.payerFee === null || form.nonPayerFee === null ? '없음' : feeText(form)
const capacityOf = (form: RegistrationForm) =>
  form.capacity === null ? '제한 없음' : `${form.capacity}명`

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-3">
          <dt className="w-14 shrink-0 text-fg-muted">{label}</dt>
          <dd className="min-w-0 flex-1 text-fg wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function FormFacts({ forms }: { forms: PolledState<RegistrationFormsResponse> }) {
  if (forms.kind === 'loading') return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  if (forms.kind === 'failed')
    return <StateMessage kind="error">{REGISTRATION_FORMS_LOAD_FAILED}</StateMessage>
  const list = forms.data.forms
  if (list.length === 0) return <StateMessage kind="empty">신청 양식 없음</StateMessage>
  const rows = (form: RegistrationForm): [string, string][] => [
    ['참가비', feeOf(form)],
    ['정원', capacityOf(form)],
  ]
  if (list.length === 1) return <Facts rows={rows(list[0]!)} />
  return (
    <div className="flex flex-col gap-3">
      {list.map(form => (
        <div
          key={form.id}
          className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0"
        >
          <p className="line-clamp-2 text-sm font-medium text-fg wrap-anywhere">{form.name}</p>
          <Facts rows={rows(form)} />
        </div>
      ))}
    </div>
  )
}

// 고치기 패널의 읽기만 하는 구역 둘(DEC-93). 참가비와 정원은 신청 양식의 값이라(DEC-44) 여기서 고치지 않고 그 화면으로 잇는다.
// 담당은 칸이 없다: 부서는 그 행사 업무를 맡은 부서에서 저절로 정해지고(DEC-25), 책임자는 만든 사람이다(DEC-79).
export function EventEditFacts({ forms, owner, busy, onOpenForms }: Props) {
  return (
    <>
      <SidePanelSection
        title="참여 정보"
        hint={
          <Button
            type="button"
            variant="link"
            size="sm"
            // 누르는 영역을 24px 이상으로 둔다(WCAG 2.5.8). '→'는 이동 링크 표시라 이름에 넣지 않는다(와이어프레임).
            className="h-auto min-h-6 p-0"
            busy={busy}
            onClick={onOpenForms}
          >
            {noForms(forms) ? '신청 양식 만들기' : '신청 양식에서 수정'}
            <span aria-hidden>→</span>
          </Button>
        }
      >
        <FormFacts forms={forms} />
      </SidePanelSection>
      <SidePanelSection title="담당 및 안내">
        <Facts rows={[['책임자', owner?.name ?? '담당 미정']]} />
      </SidePanelSection>
    </>
  )
}
