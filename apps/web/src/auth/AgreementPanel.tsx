import { useId, useState } from 'react'
import { AgreeSchema, type AgreementResponse } from '@vada/contracts'
import { AGREEMENT_ERRORS, AGREEMENT_FAILED, AGREEMENT_REQUIRED } from '@/lib/messages'
import { useFormCheck } from '@/lib/use-form-check'
import { getJson, postJson } from '@/lib/api'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export const AGREEMENT_PATH = '/api/me/agreement'

// 문서 링크는 운영 중에 바뀌는 공개 주소다. 새 창과 noopener noreferrer로만 연다.
function DocLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-blue-700 underline underline-offset-4 wrap-anywhere"
    >
      {children}
    </a>
  )
}

function AgreementFields({
  terms,
  checked,
  disabled,
  error,
  onChecked,
}: {
  terms: AgreementResponse
  checked: boolean
  disabled: boolean
  error: string | undefined
  onChecked: (checked: boolean) => void
}) {
  const checkId = useId()
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-gray-900">시작하기 전에</h2>
      <Alert tone="info">VADA를 쓰려면 이용약관에 동의해 주세요. 한 번만 하면 돼요.</Alert>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <DocLink href={terms.termsUrl}>약관 보기</DocLink>
        <DocLink href={terms.privacyUrl}>처리방침 보기</DocLink>
      </div>
      <Label htmlFor={checkId} className="flex items-center gap-2 text-sm">
        <input
          id={checkId}
          type="checkbox"
          className="size-4 accent-blue-600"
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${checkId}-error` : undefined}
          onChange={event => {
            onChecked(event.target.checked)
          }}
        />
        이용약관에 동의합니다
      </Label>
      {error && (
        <p id={`${checkId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

type Props = {
  terms: AgreementResponse
  logoutBusy: boolean
  onTerms: (terms: AgreementResponse) => void
  onLogout: () => void
}

// 동의 화면(DEC-51): 체크 하나로 지금 판 둘에 동의한다. 판이 그사이 바뀌었으면(409) 새 판을 읽어 다시 체크하게 한다.
export default function AgreementPanel({ terms, logoutBusy, onTerms, onLogout }: Props) {
  const versions = `${terms.termsVersion}|${terms.privacyVersion}`
  // 체크는 그 판에 대해서만 유효하다. 판이 바뀌면 저절로 풀린다.
  const [checkedFor, setCheckedFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const body = { termsVersion: terms.termsVersion, privacyVersion: terms.privacyVersion }
  const checked = checkedFor === versions
  // 시작하기는 늘 켜져 있고, 동의 칸이 비었으면 누를 때 그 칸 아래에 이유가 보인다.
  const { formRef, errors, attempt, reset } = useFormCheck<HTMLDivElement>(() => ({
    agree: checked ? undefined : AGREEMENT_REQUIRED,
  }))

  async function agree() {
    if (!attempt() || !AgreeSchema.safeParse(body).success) return
    setBusy(true)
    setMessage('')
    const result = await postJson<AgreementResponse>(AGREEMENT_PATH, body)
    if (result.ok) return onTerms(result.data)
    if (result.code === 'TERMS_OUTDATED') {
      reset()
      const fresh = await getJson<AgreementResponse>(AGREEMENT_PATH)
      if (fresh.ok) onTerms(fresh.data)
    }
    setMessage(AGREEMENT_ERRORS[result.code] ?? AGREEMENT_FAILED)
    setBusy(false)
  }

  return (
    <div ref={formRef} className="contents">
      <AgreementFields
        terms={terms}
        checked={checked}
        disabled={busy}
        error={errors.agree}
        onChecked={checked => {
          setCheckedFor(checked ? versions : null)
        }}
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            busy={busy}
            onClick={() => {
              void agree()
            }}
          >
            {busy ? '확인 중…' : '시작하기'}
          </Button>
          <Button variant="outline" busy={logoutBusy} onClick={onLogout}>
            로그아웃
          </Button>
        </div>
        {message && <StateMessage kind="error">{message}</StateMessage>}
      </div>
    </div>
  )
}
