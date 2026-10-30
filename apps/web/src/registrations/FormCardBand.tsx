import { useState, type RefObject } from 'react'
import { Copy, Download } from 'lucide-react'
import { registrationStatusLabel, type RegistrationForm } from '@vada/contracts'
import { copyText } from '@/lib/copy-text'
import { MainButton, SoftButton, StatusMark, TextAction, type Tone } from './DocParts'
import { type } from './doc-look'
import { activationChecks, shownLink, type Check } from './form-card-text'
import { CountValue } from './FormCardValues'
import { PosterQr, QrDialog, saveQr } from './FormQr'
import { applyUrl } from './registration-view'
import type { FormCardActions } from './useFormCardActions'

// 양식 카드 머리 띠: 왼쪽 상태 + 큰 수(신청 수, 초안이면 링크 열기까지 남은 수), 오른쪽 가져가기(받는 중 이후의 큰 QR·링크·
// [링크 복사]·[QR 저장]) 또는 초안의 [신청 양식 활성화]. 선 하나로 아래 속성 줄과 나눈다(검토 지적: 상태·링크가 속성 줄에 묻힘).

function CopyLink({ url, strong }: { url: string; strong: boolean }) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')
  const Action = strong ? MainButton : SoftButton
  return (
    <>
      <Action
        icon={Copy}
        onClick={() => void copyText(url).then(ok => setResult(ok ? 'copied' : 'failed'))}
      >
        {result === 'copied' ? '복사했어요' : '링크 복사'}
      </Action>
      {result === 'failed' && (
        <p role="status" className={`w-full ${type.small} text-fg-muted wrap-anywhere`}>
          길게 눌러 복사하세요. <span className="text-fg select-all">{url}</span>
        </p>
      )}
    </>
  )
}

// 받는 중·멈춤·종료의 가져가기: 큰 QR + 공개 링크 + [링크 복사]·[QR 저장]. 받는 중이면 [링크 복사]가 주 버튼.
function Share({ form, tone }: { form: RegistrationForm; tone: Tone }) {
  const [big, setBig] = useState(false)
  const url = applyUrl(form.publicCode)
  return (
    <div className="flex items-start gap-4">
      <PosterQr link={url} name={form.name} onOpen={() => setBig(true)} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className={`${type.small} text-fg-muted`}>공개 링크 · 포스터용 QR</span>
        <span className={`min-w-0 ${type.body} text-fg-body wrap-anywhere`}>{shownLink(url)}</span>
        <div className="flex flex-wrap items-center gap-2">
          <CopyLink url={url} strong={tone === 'open'} />
          <TextAction icon={Download} onClick={() => saveQr(url, form.name)}>
            QR 저장
          </TextAction>
        </div>
      </div>
      <QrDialog link={url} name={form.name} open={big} onOpenChange={setBig} />
    </div>
  )
}

// 초안의 [신청 양식 활성화]. 조건이 덜 찼으면 옅은 면 버튼(끄지 않음), 누르면 빠진 조건 목록과 첫 [채우기]로 초점. 다 차면 주 버튼.
function Activate({
  checks,
  actions,
  sheet,
}: {
  checks: Check[]
  actions: FormCardActions
  sheet: RefObject<HTMLElement | null>
}) {
  const [tried, setTried] = useState(false)
  const ready = checks.every(check => check.state === 'done')
  const press = () => {
    if (ready) return actions.activate()
    setTried(true)
    sheet.current?.querySelector<HTMLElement>('[data-fill]')?.focus()
  }
  const Action = ready ? MainButton : SoftButton
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <Action busy={actions.post.busy} onClick={press}>
        신청 양식 활성화
      </Action>
      {tried && !ready && (
        <ul role="alert" className={`flex flex-col gap-0.5 ${type.small} sm:text-right`}>
          {checks.map(check =>
            check.state === 'done' ? null : (
              <li
                key={check.key}
                className={
                  check.state === 'missing' ? 'font-medium text-danger' : 'text-fg-tertiary'
                }
              >
                {check.state === 'missing'
                  ? `${check.label} 비어 있음`
                  : `${check.label}: 마감 입력 뒤 확인`}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function DraftCount({ checks }: { checks: Check[] }) {
  const left = checks.filter(check => check.state === 'missing').length
  return (
    <span className={`${type.count} text-fg`}>
      {left > 0 ? `링크 열기까지 ${left}개` : '링크 열 준비 완료'}
    </span>
  )
}

export function FormCardBand({
  form,
  tone,
  actions,
  sheet,
}: {
  form: RegistrationForm
  tone: Tone
  actions: FormCardActions
  sheet: RefObject<HTMLElement | null>
}) {
  const checks = activationChecks(actions.missing)
  const resumable = tone === 'paused' && form.actions.includes('form.resume')
  const activatable = tone === 'draft' && form.actions.includes('form.activate')
  return (
    <div className="flex flex-col gap-5 border-b border-border-subtle pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="flex flex-col gap-1">
        <StatusMark tone={tone} label={registrationStatusLabel(form.status, form.applicantCount)} />
        {tone === 'draft' ? <DraftCount checks={checks} /> : <CountValue form={form} />}
        {resumable && (
          <div className="pt-2">
            <MainButton busy={actions.post.busy} onClick={actions.resume}>
              다시 받기
            </MainButton>
          </div>
        )}
      </div>
      {activatable && <Activate checks={checks} actions={actions} sheet={sheet} />}
      {tone !== 'draft' && (
        <div className="min-w-0 sm:w-110">
          <Share form={form} tone={tone} />
        </div>
      )}
    </div>
  )
}
