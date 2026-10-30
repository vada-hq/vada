import { useEffect, useRef, useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import LeaveConfirm from '@/components/LeaveConfirm'
import { Button } from '@/components/ui/button'
import { askLeave, useUnsavedInput, useWindowLeave } from '@/lib/leave-guard'
import { useWindowHistory } from '@/lib/use-window-history'
import { useMyName } from '../profile/useMyName'
import { useInvite } from '../team/useInvite'
import CreateBasicStep from './CreateBasicStep'
import CreateInviteStep from './CreateInviteStep'
import CreateStructureStep from './CreateStructureStep'
import { useCouncilDraft, type CouncilDraftState } from './useCouncilDraft'
import { useCreateCouncil } from './useCreateCouncil'

type Props = {
  // 로그인한 Google 이름. '내 이름' 칸에 미리 채운다.
  userName: string
  // 초대 링크 단계의 [홈으로]. 그때 학생회 목록에 더하고 그 학생회 홈을 연다.
  onCreated: (council: MyCouncil) => void
  onCancel: () => void
  // 둘째 학생회 만들기의 카드 [닫기]. 보내는 동안은 막아 만든 결과를 놓치지 않게 한다.
  onClose?: (() => void) | undefined
}

// 기기 뒤로가 앱을 떠나지 않고 화면 안의 [이전]과 같은 길로 가게 기록 한 칸을 쓴다.
function BackStep({ onBack }: { onBack: () => void }) {
  useWindowHistory(onBack)
  return null
}

// 학생회 만들기(기능 020 정한 것 1): 1/3 기본 정보 → 2/3 조직 구조 → 3/3 초대 링크 → 그 학생회 홈.
// 학생회는 2단계의 [학생회 만들기]에서 생기고, 그 전에는 화면에만 값이 있다.
// 그래서 쓴 값이 있으면 떠나기 전에 묻는다. 새로 고침은 브라우저가 묻고, 뒤로는 2단계면 1단계로, 1단계면 [이전]처럼 묻고 나간다.
// 학생회가 없는 사람도 오는 화면이라 작업 공간 밖이므로 확인 창을 여기 둔다. 둘째 학생회 만들기도 작업 공간을 내리고 이 화면을 그린다.
export default function CreateCouncilForm({ userName, onCreated, onCancel, onClose }: Props) {
  const draft = useCouncilDraft(userName)
  const linkedName = useMyName()
  const create = useCreateCouncil()
  const [step, setStep] = useState<'basic' | 'structure'>('basic')
  const [created, setCreated] = useState<MyCouncil | null>(null)
  const leave = useWindowLeave(onCancel)
  // 보내는 동안은 묻지 않고, 만들고 나면 지킬 값이 없다. 실패하면 다시 지킨다.
  useUnsavedInput(draft.dirty && !create.saving && created === null, leave.holder)
  // 단계가 바뀌면 누른 버튼이 사라져 초점이 페이지 맨 앞으로 간다. 새 단계의 제목으로 옮긴다(처음 열 때도 같다).
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frame.current?.querySelector<HTMLElement>('h2')?.focus()
  }, [step, created])
  return (
    <div ref={frame} className="contents">
      {!created && <BackStep onBack={leave.close} />}
      {!created && step === 'structure' && (
        <BackStep
          onBack={() => {
            if (!create.saving) setStep('basic')
          }}
        />
      )}
      {created ? (
        <CreatedInvite council={created} onHome={() => onCreated(created)} />
      ) : step === 'basic' ? (
        <CreateBasicStep draft={draft} onNext={() => setStep('structure')} onCancel={leave.close} />
      ) : (
        <StructureStep
          draft={draft}
          linkedName={linkedName}
          create={create}
          onStep={setStep}
          onCreated={setCreated}
        />
      )}
      <LeaveConfirm />
      {onClose && (
        <Button
          touch
          variant="outline"
          className="mt-4 w-full"
          busy={create.saving && !created}
          onClick={() => askLeave(onClose)}
        >
          닫기
        </Button>
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
      invite={invite.invite}
      loadError={invite.loadError}
      notice={invite.notice}
      onCopy={(text, what) => {
        void invite.copy(text, what)
      }}
      onRetry={invite.retry}
      onHome={onHome}
    />
  )
}
