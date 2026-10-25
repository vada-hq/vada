import { useEffect, useRef, useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import { useMyName } from '../profile/useMyName'
import { useInvite } from '../team/useInvite'
import CreateBasicStep from './CreateBasicStep'
import CreateInviteStep from './CreateInviteStep'
import CreateStructureStep from './CreateStructureStep'
import { inviteLink } from './invite-path'
import { useCouncilDraft, type CouncilDraftState } from './useCouncilDraft'
import { useCreateCouncil } from './useCreateCouncil'

type Props = {
  // 로그인한 Google 이름. '내 이름' 칸에 미리 채운다.
  userName: string
  // 초대 링크 단계의 [홈으로]. 그때 학생회 목록에 더하고 그 학생회 홈을 연다.
  onCreated: (council: MyCouncil) => void
  onCancel: () => void
}

// 학생회 만들기(기능 020 정한 것 1): 1/3 기본 정보 → 2/3 조직 구조 → 3/3 초대 링크 → 그 학생회 홈.
// 학생회는 2단계의 [학생회 만들기]에서 생기고, 그 전에는 화면에만 값이 있다.
export default function CreateCouncilForm({ userName, onCreated, onCancel }: Props) {
  const draft = useCouncilDraft(userName)
  const linkedName = useMyName()
  const create = useCreateCouncil()
  const [step, setStep] = useState<'basic' | 'structure'>('basic')
  const [created, setCreated] = useState<MyCouncil | null>(null)
  // 단계가 바뀌면 누른 버튼이 사라져 초점이 페이지 맨 앞으로 간다. 새 단계의 제목으로 옮긴다(처음 열 때도 같다).
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frame.current?.querySelector<HTMLElement>('h2')?.focus()
  }, [step, created])
  return (
    <div ref={frame} className="contents">
      {created ? (
        <CreatedInvite council={created} onHome={() => onCreated(created)} />
      ) : step === 'basic' ? (
        <CreateBasicStep draft={draft} onNext={() => setStep('structure')} onCancel={onCancel} />
      ) : (
        <StructureStep
          draft={draft}
          linkedName={linkedName}
          create={create}
          onStep={setStep}
          onCreated={setCreated}
        />
      )}
    </div>
  )
}

type StructureProps = {
  draft: CouncilDraftState
  linkedName: string | null
  create: ReturnType<typeof useCreateCouncil>
  onStep: (step: 'basic') => void
  onCreated: (council: MyCouncil) => void
}
function StructureStep({ draft, linkedName, create, onStep, onCreated }: StructureProps) {
  return (
    <CreateStructureStep
      draft={draft}
      linkedName={linkedName}
      saving={create.saving}
      error={create.error}
      onBack={() => onStep('basic')}
      onYearReset={() => onStep('basic')}
      onSubmit={() => {
        const parsed = draft.parse(linkedName === null)
        if (!parsed.success) return
        void create.submit(parsed.data).then(council => council && onCreated(council))
      }}
    />
  )
}

// 막 만든 학생회의 초대 링크. 만든 사람은 회장이라 초대 코드를 읽을 수 있다.
function CreatedInvite({ council, onHome }: { council: MyCouncil; onHome: () => void }) {
  const invite = useInvite(council.id, () => {})
  return (
    <CreateInviteStep
      link={invite.code ? inviteLink(invite.code) : null}
      loadError={invite.loadError}
      notice={invite.notice}
      onCopy={link => {
        void invite.copy(link)
      }}
      onRetry={invite.retry}
      onHome={onHome}
    />
  )
}
