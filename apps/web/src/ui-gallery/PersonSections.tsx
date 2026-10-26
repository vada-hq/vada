import { useState } from 'react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import { UndoToast } from '@/components/UndoToast'
import { Button } from '@/components/ui/button'
import { personActions, type Can } from '@/team/people-access'
import { PersonSheet } from '@/team/PersonSheet'
import { Section } from './GallerySection'

const noop = () => {}
const titles: CouncilTitles = {
  president: '회장',
  vicePresident: '부회장',
  head: '부장',
  viceHead: '부부장',
}
const departments: TeamDepartment[] = [
  { id: 'd1', name: '재정부', role: 'finance', memberCount: 2 },
  { id: 'd2', name: '기획부', role: null, memberCount: 4 },
  { id: 'd3', name: '홍보부', role: null, memberCount: 0 },
]
// 올해 날짜라 들어온 때에 연도가 붙지 않는다.
const JOINED = `${new Date().getFullYear()}-10-04T01:00:00.000Z`
// 재정부 부장이면서 기획부원인 겸직자.
const member: TeamMember = {
  id: 'm4',
  name: '최재정',
  councilRank: null,
  departments: [
    { id: 'd1', rank: 'head' },
    { id: 'd2', rank: null },
  ],
  joinedAt: JOINED,
}
const all: Can = () => true
const none: Can = () => false

// 사람 상세(DEC-91)와 되돌리기 토스트(기능 023 정한 것 5). 회장이 보는 모양(모든 동작)과 부원이 보는 모양(동작 없음).
export function PersonSection() {
  const [open, setOpen] = useState<'lead' | 'member' | null>(null)
  return (
    <Section title="사람 상세·되돌리기">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setOpen('lead')}>
          사람 상세 열기(회장)
        </Button>
        <Button variant="outline" onClick={() => setOpen('member')}>
          사람 상세 열기(부원)
        </Button>
      </div>
      <UndoToast
        text="최재정 옮기기 완료"
        error={null}
        busy={false}
        onUndo={noop}
        onDismiss={noop}
      />
      <UndoToast
        text="최재정 옮기기 완료"
        error="저장하지 못했어요. 다시 시도해 주세요."
        busy={false}
        onUndo={noop}
        onDismiss={noop}
      />
      {open && (
        <PersonSheet
          member={member}
          departments={departments}
          titles={titles}
          actions={personActions(member, 'm1', open === 'lead' ? all : none)}
          saving={false}
          error=""
          toast={
            open === 'lead' && (
              <UndoToast
                text="최재정 직급 바꾸기 완료"
                error={null}
                busy={false}
                onUndo={noop}
                onDismiss={noop}
              />
            )
          }
          onSave={noop}
          onConfirm={noop}
          onClose={() => setOpen(null)}
        />
      )}
    </Section>
  )
}
