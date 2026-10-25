import { useEffect, useState } from 'react'
import SignedInCard from '@/auth/SignedInCard'
import NoCouncil from '@/councils/NoCouncil'
import { WITHDRAW_FAILED } from '@/profile/useWithdrawal'
import WithdrawDialog from '@/profile/WithdrawDialog'
import { Button } from '@/components/ui/button'
import { WITHDRAW_ERRORS } from '@/lib/messages'
import { Section } from './GallerySection'

const noop = () => {}
const BUSY_EXAMPLE_MS = 1500

type Kind = 'ready' | 'reauth' | 'president' | 'busy' | 'failed'
const examples: { kind: Kind; label: string }[] = [
  { kind: 'ready', label: '탈퇴 창 열기' },
  { kind: 'reauth', label: '다시 로그인 탈퇴 창 열기' },
  { kind: 'president', label: '회장 탈퇴 창 열기' },
  { kind: 'busy', label: '보내는 중 탈퇴 창 열기' },
  { kind: 'failed', label: '실패 탈퇴 창 열기' },
]
const errorOf: Record<Kind, string | null> = {
  ready: null,
  reauth: WITHDRAW_ERRORS.REAUTH_REQUIRED ?? null,
  president: WITHDRAW_ERRORS.PRESIDENT_CANNOT_WITHDRAW ?? null,
  busy: null,
  failed: WITHDRAW_FAILED,
}

// 탈퇴: 학생회가 없을 때의 가운데 카드(계정 줄의 [탈퇴])와 확인 창의 다섯 모양. 창은 실제 화면 폭의 대화상자로 연다.
// 여기서는 눌러도 보내지 않고 닫는다. 보내는 중 예시는 닫히지 않으므로 잠시 뒤 저절로 닫는다.
export function WithdrawSection() {
  const [kind, setKind] = useState<Kind | null>(null)
  useEffect(() => {
    if (kind !== 'busy') return
    const timer = setTimeout(() => setKind(null), BUSY_EXAMPLE_MS)
    return () => clearTimeout(timer)
  }, [kind])
  const close = () => setKind(null)
  return (
    <Section title="탈퇴 창">
      <div className="w-full max-w-md">
        <SignedInCard
          user={{ name: '김구글', email: 'kim.google@example.com' }}
          page={false}
          withdraw
          busy={false}
          onLogout={noop}
        >
          <NoCouncil onEnterCode={noop} onCreate={noop} />
        </SignedInCard>
      </div>
      {examples.map(example => (
        <Button key={example.kind} variant="outline" onClick={() => setKind(example.kind)}>
          {example.label}
        </Button>
      ))}
      {kind && (
        <WithdrawDialog
          busy={kind === 'busy'}
          reauth={kind === 'reauth'}
          error={errorOf[kind]}
          onWithdraw={close}
          onLogin={close}
          onClose={close}
        />
      )}
    </Section>
  )
}
