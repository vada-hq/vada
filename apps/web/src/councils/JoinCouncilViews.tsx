import { useState } from 'react'
import type { InvitePreviewResponse } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { operatingYearText, scopeText } from '@/lib/council-text'
import { myNameErrors } from '@/lib/my-name'
import { useFormCheck } from '@/lib/use-form-check'
import { unitLabels } from './unit-labels'

// 초대 링크 화면의 세 모습: 없는 코드, 확인 실패, 들어갈까요?

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
      <Button variant="outline" onClick={onLeave}>
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
      <Button onClick={onRetry}>다시 시도</Button>
      <Button variant="ghost" size="sm" onClick={onLeave}>
        {leaveLabel}
      </Button>
    </section>
  )
}

type Council = InvitePreviewResponse['council']

// 맞는 학생회인지 가릴 줄(DEC-87). 값이 없는 줄은 두지 않는다.
function CouncilFacts({ council }: { council: Council }) {
  const facts = [
    { label: '유형', value: unitLabels[council.unit] },
    { label: '대표 범위', value: scopeText(council) },
    { label: '운영 연도', value: operatingYearText(council.cohortName) },
  ].filter(fact => fact.value !== '')
  return (
    <dl className="flex flex-col gap-3">
      {facts.map(fact => (
        <Fact key={fact.label} label={fact.label}>
          {fact.value}
        </Fact>
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
  const asking = myName === null
  const { formRef, errors, attempt } = useFormCheck<HTMLDivElement>(() =>
    asking ? myNameErrors(name) : {},
  )
  return (
    <section aria-label="학생회 들어가기" className="flex flex-col gap-4">
      <div ref={formRef} className="flex flex-col gap-4 rounded-lg border p-6">
        <h2 className="text-base font-semibold wrap-anywhere">{council.name}에 들어갈까요?</h2>
        <CouncilFacts council={council} />
        {asking ? (
          <Field label="내 이름" required error={errors.name}>
            <Input
              value={name}
              autoComplete="name"
              disabled={joining}
              onChange={event => setName(event.target.value)}
            />
          </Field>
        ) : (
          <dl>
            <Fact label="내 이름">{myName}</Fact>
          </dl>
        )}
      </div>
      {/* 이름과 이메일이 학생회 데이터가 된다는 고지라 설명 글을 줄이는 규칙의 예외다(DEC-72 '운영진 명단'). */}
      <p className="text-xs text-muted-foreground">
        들어가면 부서와 직급 없이 운영진이 되고, 이름과 이메일이 이 학생회의 운영진 명단에 들어가요.
        부서는 회장단이 정해요.
      </p>
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <div className="flex flex-col gap-2">
        <Button busy={joining} onClick={() => attempt() && onJoin(asking ? name : undefined)}>
          {joining ? '들어가는 중…' : '들어가기'}
        </Button>
        <Button variant="ghost" size="sm" busy={joining} onClick={onLeave}>
          들어가지 않기
        </Button>
      </div>
    </section>
  )
}
