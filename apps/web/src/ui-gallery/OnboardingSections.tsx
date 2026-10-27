import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { InviteNotice } from '@/lib/messages'
import CreateBasicStep from '../councils/CreateBasicStep'
import CreateInviteStep from '../councils/CreateInviteStep'
import CreateStructureStep from '../councils/CreateStructureStep'
import { useCouncilDraft } from '../councils/useCouncilDraft'
import { RotateInviteDialog } from '../team/RotateInviteDialog'
import { Section } from './GallerySection'
import { RealFrame } from './RealFrame'

// 운영 연도 선택지가 날마다 바뀌지 않게 연 날을 고정한다(스냅숏).
const OPENED = new Date('2026-06-15T03:00:00Z')
// 올해 날짜라 만든 시각에 연도가 붙지 않는다.
const SAMPLE_INVITE = {
  code: 'ABCD2345',
  createdAt: `${new Date().getFullYear()}-10-25T05:00:00.000Z`,
}

const SAMPLE_ADDED = ['복지부', '문화부', '체육부', '학술부']

// 이어진 운영진(이름만 보임)이 부서를 많이 더해 조직도가 두 줄로 바뀐 모양.
function ManyDepartmentsStructure() {
  const draft = useCouncilDraft('김구글', OPENED)
  // 개발 모드는 효과를 두 번 돌리므로 한 번만 더한다.
  const added = useRef(false)
  useEffect(() => {
    if (added.current) return
    added.current = true
    for (const name of SAMPLE_ADDED) draft.addDepartment(name)
  }, [draft])
  return (
    <CreateStructureStep
      draft={draft}
      linkedName="김회장"
      saving={false}
      error=""
      onBack={() => {}}
      onSubmit={() => {}}
      onYearReset={() => {}}
    />
  )
}

// 복합 이름의 줄기는 더하기에서 빠지고, 재정 이름 후보도 국 끝말을 따르는 견본.
function BureauDepartmentsStructure() {
  const draft = useCouncilDraft('김구글', OPENED)
  const renamed = useRef(false)
  useEffect(() => {
    if (renamed.current) return
    renamed.current = true
    draft.renameDepartment(0, '기획국')
    draft.renameDepartment(1, '인권복지국')
  }, [draft])
  return (
    <CreateStructureStep
      draft={draft}
      linkedName="김회장"
      saving={false}
      error=""
      onBack={() => {}}
      onSubmit={() => {}}
      onYearReset={() => {}}
    />
  )
}

// 학생회 만들기 세 단계(기본 정보, 조직 구조, 초대 링크)와 코드 바꾸기 확인 창. 서버를 부르지 않는다.
export function CreateCouncilSection() {
  const draft = useCouncilDraft('김구글', OPENED)
  const [notice, setNotice] = useState<InviteNotice | null>(null)
  const [asking, setAsking] = useState(false)
  return (
    <Section title="학생회 만들기 단계">
      <RealFrame>
        <CreateBasicStep draft={draft} onNext={() => {}} onCancel={() => {}} />
      </RealFrame>
      <RealFrame>
        <CreateStructureStep
          draft={draft}
          linkedName={null}
          saving={false}
          error=""
          onBack={() => {}}
          onSubmit={() => {}}
          onYearReset={() => {}}
        />
      </RealFrame>
      <RealFrame>
        <ManyDepartmentsStructure />
      </RealFrame>
      <RealFrame>
        <BureauDepartmentsStructure />
      </RealFrame>
      <RealFrame>
        <CreateInviteStep
          invite={SAMPLE_INVITE}
          loadError={null}
          notice={notice}
          onCopy={(_, what) => setNotice(what === 'link' ? 'copied' : 'code-copied')}
          onRetry={() => {}}
          onHome={() => {}}
        />
      </RealFrame>
      <Button variant="outline" onClick={() => setAsking(true)}>
        코드 바꾸기 확인 창 열기
      </Button>
      <RotateInviteDialog
        open={asking}
        busy={false}
        onConfirm={() => setAsking(false)}
        onClose={() => setAsking(false)}
      />
    </Section>
  )
}
