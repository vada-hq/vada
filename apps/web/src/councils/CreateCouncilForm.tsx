import { useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import { useInvite } from '../team/useInvite'
import CreateBasicStep from './CreateBasicStep'
import CreateInviteStep from './CreateInviteStep'
import CreateStructureStep from './CreateStructureStep'
import { inviteLink } from './invite-path'
import { useCouncilDraft } from './useCouncilDraft'
import { useCreateCouncil } from './useCreateCouncil'
import { useLinkedMemberName } from './useLinkedMemberName'

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
  const linkedName = useLinkedMemberName()
  const create = useCreateCouncil()
  const [step, setStep] = useState<'basic' | 'structure'>('basic')
  const [created, setCreated] = useState<MyCouncil | null>(null)
  if (created) return <CreatedInvite council={created} onHome={() => onCreated(created)} />
  if (step === 'basic')
    return <CreateBasicStep draft={draft} onNext={() => setStep('structure')} onCancel={onCancel} />
  return (
    <CreateStructureStep
      draft={draft}
      linkedName={linkedName}
      saving={create.saving}
      error={create.error}
      onBack={() => setStep('basic')}
      onYearReset={() => setStep('basic')}
      onSubmit={() => {
        const parsed = draft.parse(linkedName === null)
        if (!parsed.success) return
        void create.submit(parsed.data).then(council => council && setCreated(council))
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
