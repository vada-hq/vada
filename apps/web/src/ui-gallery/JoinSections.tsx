import { useState } from 'react'
import type { InvitePreviewResponse } from '@vada/contracts'
import { AskToJoin } from '@/councils/JoinCouncilViews'
import MyNameDialog from '@/profile/MyNameDialog'
import { Button } from '@/components/ui/button'
import { RealFrame } from './RealFrame'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const council = (
  extra: Partial<InvitePreviewResponse['council']> = {},
): InvitePreviewResponse['council'] => ({
  id: 'c1',
  name: '소프트웨어융합대학 학생회',
  unit: 'college',
  schoolName: '한양대학교 ERICA',
  cohortName: '2026',
  ...extra,
})

const noop = () => {}

// 초대 확인 카드: 처음 이어지는 사람(내 이름 칸), 이미 이어진 사람(이름만), 지금 기수가 없고 이름이 긴 학생회.
export function JoinSection() {
  return (
    <Section title="초대 확인">
      <RealFrame>
        <AskToJoin
          council={council()}
          myName={null}
          googleName="김바다"
          joining={false}
          error=""
          onJoin={noop}
          onLeave={noop}
        />
      </RealFrame>
      <RealFrame>
        <AskToJoin
          council={council({ unit: 'university', name: '총학생회' })}
          myName="김바다"
          googleName="김바다"
          joining={false}
          error=""
          onJoin={noop}
          onLeave={noop}
        />
      </RealFrame>
      <RealFrame>
        <AskToJoin
          council={council({ name: longName, schoolName: unbroken, cohortName: null })}
          myName={unbroken}
          googleName="김바다"
          joining={false}
          error=""
          onJoin={noop}
          onLeave={noop}
        />
      </RealFrame>
    </Section>
  )
}

// 옆 메뉴 아래 사용자 줄을 누르면 여는 '내 이름' 창. 여기서는 저장하거나 탈퇴를 눌러도 보내지 않고 닫는다(탈퇴 창은 '탈퇴 창' 묶음).
export function MyNameSection() {
  const [open, setOpen] = useState(false)
  return (
    <Section title="내 이름 창">
      <Button variant="outline" onClick={() => setOpen(true)}>
        내 이름 창 열기
      </Button>
      {open && (
        <MyNameDialog
          name="김바다"
          busy={false}
          error={null}
          onSave={() => setOpen(false)}
          onClose={() => setOpen(false)}
          onWithdraw={() => setOpen(false)}
        />
      )}
    </Section>
  )
}
