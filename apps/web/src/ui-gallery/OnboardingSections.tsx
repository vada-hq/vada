import { useState } from 'react'
import { AuthCard } from '@/components/AuthCard'
import { Button } from '@/components/ui/button'
import type { InviteNotice } from '@/lib/messages'
import CreateBasicStep from '../councils/CreateBasicStep'
import CreateInviteStep from '../councils/CreateInviteStep'
import CreateStructureStep from '../councils/CreateStructureStep'
import { useCouncilDraft } from '../councils/useCouncilDraft'
import { RotateInviteDialog } from '../team/RotateInviteDialog'
import { Section } from './GallerySection'

// 운영 연도 선택지가 날마다 바뀌지 않게 연 날을 고정한다(스냅숏).
const OPENED = new Date('2026-06-15T03:00:00Z')
const SAMPLE_LINK = 'https://vada.example/join/ABCD2345'

// 학생회 만들기 세 단계(기본 정보, 조직 구조, 초대 링크)와 코드 바꾸기 확인 창. 서버를 부르지 않는다.
export function CreateCouncilSection() {
  const draft = useCouncilDraft('김구글', OPENED)
  const [notice, setNotice] = useState<InviteNotice | null>(null)
  const [asking, setAsking] = useState(false)
  return (
    <Section title="학생회 만들기 단계">
      <AuthCard>
        <CreateBasicStep draft={draft} onNext={() => {}} onCancel={() => {}} />
      </AuthCard>
      <AuthCard>
        <CreateStructureStep
          draft={draft}
          linkedName={null}
          saving={false}
          error=""
          onBack={() => {}}
          onSubmit={() => {}}
          onYearReset={() => {}}
        />
      </AuthCard>
      <AuthCard>
        <CreateInviteStep
          link={SAMPLE_LINK}
          loadError={null}
          notice={notice}
          onCopy={() => setNotice('copied')}
          onRetry={() => {}}
          onHome={() => {}}
        />
      </AuthCard>
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
