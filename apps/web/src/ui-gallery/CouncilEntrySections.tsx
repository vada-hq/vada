import { useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import CreateBasicStep from '@/councils/CreateBasicStep'
import NoCouncil from '@/councils/NoCouncil'
import { useCouncilDraft } from '@/councils/useCouncilDraft'
import { AttentionCard } from '@/home/CouncilColumns'
import UnassignedBand from '@/home/UnassignedBand'
import CouncilMenu from '@/workspace/CouncilMenu'
import type { CouncilEntry } from '@/workspace/pages'
import { Section } from './GallerySection'
import { noop, pushBand, Width } from './home-frame-samples'
import { RealFrame } from './RealFrame'

const OPENED = new Date('2026-06-15T03:00:00Z')
const COUNCILS: MyCouncil[] = [
  {
    id: '0199d1a0-0000-7000-8000-0000000000c1',
    name: '총학생회',
    unit: 'university',
    schoolName: '한양대학교 ERICA',
    councilRank: 'president',
    departments: [],
  },
  {
    id: '0199d1a0-0000-7000-8000-0000000000c2',
    name: '총학생회',
    unit: 'university',
    schoolName: '다른대학교',
    councilRank: null,
    departments: [],
  },
]

// 메뉴의 두 길은 실제 카드의 보기 부품으로 이어진다. 견본에서는 서버를 부르거나 주소를 바꾸지 않는다.
function EntrySample() {
  const [entry, setEntry] = useState<CouncilEntry | null>(null)
  const [selected, setSelected] = useState(COUNCILS[0]!)
  const draft = useCouncilDraft('김운영', OPENED)
  if (entry)
    return (
      <RealFrame>
        {entry === 'create' ? (
          <CreateBasicStep draft={draft} onNext={noop} onCancel={() => setEntry('join')} />
        ) : (
          <NoCouncil additional onEnterCode={noop} onCreate={() => setEntry('create')} />
        )}
        <Button touch variant="outline" className="mt-4 w-full" onClick={() => setEntry(null)}>
          닫기
        </Button>
      </RealFrame>
    )
  return (
    <div className="w-60 rounded-lg border bg-white">
      <CouncilMenu
        council={selected}
        councils={COUNCILS}
        onPage={noop}
        onAddCouncil={setEntry}
        onSelect={id => setSelected(COUNCILS.find(council => council.id === id)!)}
      />
    </div>
  )
}

export function CouncilEntrySection() {
  return (
    <Section title="학생회 고르기·둘째 학생회·미배정 안내">
      {(['1280', '390'] as const).map(size => (
        <Width
          key={size}
          label={`${size} 학생회 고르기와 미배정 안내`}
          className={size === '1280' ? 'flex w-248 flex-col gap-4' : 'flex w-90 flex-col gap-4'}
        >
          <EntrySample />
          <UnassignedBand />
          {pushBand}
          <AttentionCard
            board={{ attention: { items: [], total: 0 }, unassignedMembers: 2 }}
            onOpenTask={noop}
            onSeeAll={noop}
            onSeePeople={noop}
          />
        </Width>
      ))}
    </Section>
  )
}
