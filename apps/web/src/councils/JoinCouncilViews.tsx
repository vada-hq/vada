import { useId, useState } from 'react'
import type { InvitePreviewResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { operatingYearText, scopeText } from '@/lib/council-text'
import { myNameErrors } from '@/lib/my-name'
import { useFormCheck } from '@/lib/use-form-check'
import { unitLabels } from './unit-labels'

// 초대 링크 화면의 세 모습: 없는 코드, 확인 실패, 초대받은 학생회(들어가기).

export function InvalidInvite({
  leaveLabel,
  onLeave,
}: {
  leaveLabel: string
  onLeave: () => void
}) {
  return (
    <section aria-label="학생회 들어가기" className="flex flex-col gap-3">
      <StateMessage kind="error">
        초대 코드가 올바르지 않아요. 바뀌었을 수 있으니 학생회에 다시 받아 주세요.
      </StateMessage>
      <Button variant="outline" touch onClick={onLeave}>
        {leaveLabel}
      </Button>
    </section>
  )
}

type FailedProps = { leaveLabel: string; onRetry: () => void; onLeave: () => void }
export function FailedInvite({ leaveLabel, onRetry, onLeave }: FailedProps) {
  return (
    <section aria-label="학생회 들어가기" className="flex flex-col gap-3">
      <StateMessage kind="error">
        초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.
      </StateMessage>
      <Button touch onClick={onRetry}>
        다시 시도
      </Button>
      <Button variant="ghost" size="sm" touch onClick={onLeave}>
        {leaveLabel}
      </Button>
    </section>
  )
}

type Council = InvitePreviewResponse['council']

// 이름 | 값 한 줄. 긴 값은 줄을 바꾼다.
function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-16 shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 text-gray-800 wrap-anywhere">{value}</dd>
    </div>
  )
}

// 맞는 학생회인지 가릴 줄(DEC-87). 값이 없는 줄은 두지 않는다. 이름과 값을 한 줄에 두어 [들어가기]가 휴대폰 첫 화면에 들어오게 한다(와이어프레임 INV-01).
function CouncilFacts({ council }: { council: Council }) {
  const facts = [
    { label: '유형', value: unitLabels[council.unit] },
    { label: '대표 범위', value: scopeText(council) },
    { label: '운영 연도', value: operatingYearText(council.cohortName) },
  ].filter(fact => fact.value !== '')
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {facts.map(fact => (
        <FactRow key={fact.label} label={fact.label} value={fact.value} />
      ))}
    </dl>
  )
}

type AskProps = {
  council: Council
  // 로그인에 이어진 운영진 이름. null이면 처음 이어지는 것이라 '내 이름' 칸을 둔다.
  myName: string | null
  // 처음 이어지는 사람의 칸에 미리 채우는 로그인 계정 이름.
  googleName: string
  joining: boolean
  error: string
  // 처음 이어지면 칸의 이름을, 이미 이어졌으면 undefined를 준다.
  onJoin: (memberName?: string) => void
  onLeave: () => void
}
export function AskToJoin({
  council,
  myName,
  googleName,
  joining,
  error,
  onJoin,
  onLeave,
}: AskProps) {
  const [name, setName] = useState(googleName)
  const titleId = useId()
  const asking = myName === null
  const { formRef, errors, attempt } = useFormCheck(() => (asking ? myNameErrors(name) : {}))
  // '내 이름' 칸에서 Enter로도 들어가도록 form이다. [들어가기]는 끄지 않고 누를 때 확인한다.
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="학생회 들어가기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (attempt()) onJoin(asking ? name : undefined)
      }}
    >
      {/* 상자에는 학생회 사실만 둔다. 고칠 수 있는 '내 이름'은 상자 밖이다(와이어프레임 INV-01). */}
      <section
        aria-labelledby={titleId}
        className="flex flex-col gap-3 rounded-lg border p-4 sm:p-6"
      >
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-gray-500">초대받은 학생회</p>
          <h2 id={titleId} className="text-lg font-semibold wrap-anywhere">
            {council.name}
          </h2>
        </div>
        <CouncilFacts council={council} />
      </section>
      {myName === null ? (
        <Field label="내 이름" required error={errors.name}>
          <Input
            value={name}
            autoComplete="name"
            disabled={joining}
            onChange={event => setName(event.target.value)}
          />
        </Field>
      ) : (
        <dl className="text-sm">
          <FactRow label="내 이름" value={myName} />
        </dl>
      )}
      {/* 이름과 이메일이 학생회 데이터가 된다는 고지라 설명 글을 줄이는 규칙의 예외다(DEC-72 '운영진 명단'). */}
      <p className="text-xs text-muted-foreground">
        들어가면 부서와 직급 없이 운영진이 되고, 이름과 이메일이 이 학생회의 운영진 명단에 들어가요.
        부서는 회장단이 정해요.
      </p>
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <div className="flex flex-col gap-2">
        <Button type="submit" touch busy={joining}>
          {joining ? '들어가는 중…' : '들어가기'}
        </Button>
        <Button type="button" variant="ghost" size="sm" touch busy={joining} onClick={onLeave}>
          들어가지 않기
        </Button>
      </div>
    </form>
  )
}
