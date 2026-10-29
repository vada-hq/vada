import AgreementPanel from '@/auth/AgreementPanel'
import KakaoBlock from '@/auth/KakaoBlock'
import PushPanel from '@/push/PushPanel'
import { AuthCard } from '@/components/AuthCard'
import { BrandMark } from '@/components/BrandMark'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NavItem } from '@/components/ui/nav-item'
import { Section } from './GallerySection'
import { kakaoUserAgent, longName, unbroken } from './sample-text'

export function StateSection() {
  return (
    <Section title="상태 문구">
      <StateMessage kind="loading">불러오는 중…</StateMessage>
      <StateMessage kind="notice">저장했어요.</StateMessage>
      <StateMessage kind="empty">아직 대화가 없어요.</StateMessage>
      <StateMessage kind="error">연결을 확인해 주세요.</StateMessage>
    </Section>
  )
}

export function PushSection() {
  return (
    <Section title="휴대폰 알림">
      {(['needs-home-screen', 'ask', 'on', 'denied'] as const).map(state => (
        <Card key={state} className="w-96 p-4">
          <PushPanel
            state={state}
            device="ios"
            enableFailed={false}
            test={state === 'on' ? { kind: 'result', result: 'sent' } : { kind: 'idle' }}
            onEnable={() => {}}
            onTest={() => {}}
            onRetry={() => {}}
          />
        </Card>
      ))}
    </Section>
  )
}

export function AuthSection() {
  return (
    <Section title="인증 카드">
      <AuthCard>
        <div className="flex flex-wrap items-center gap-2">
          <BrandMark />
          <p className="text-base font-semibold">VADA</p>
          <p className="ml-auto text-xs text-fg-muted">학생회를 위한 공간</p>
        </div>
        <div className="flex flex-col gap-3">
          <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>
          <p className="text-sm text-fg-muted">Google 계정으로 로그인해 주세요.</p>
          <Button>Google로 로그인</Button>
        </div>
      </AuthCard>
    </Section>
  )
}

// 주소 상수가 비어 있는 동안(#32 전) 운영에서는 이 화면이 뜨지 않는다. 주소가 있을 때의 모습을 여기서 본다.
export function AgreementSection() {
  return (
    <Section title="가입 동의">
      <AuthCard>
        <AgreementPanel
          terms={{
            termsVersion: '2026-11-01',
            privacyVersion: '2026-11-01',
            termsUrl: 'https://example.com/terms',
            privacyUrl: 'https://example.com/privacy',
            required: true,
            agreed: false,
          }}
          logoutBusy={false}
          onTerms={() => {}}
          onLogout={() => {}}
        />
      </AuthCard>
    </Section>
  )
}

export function KakaoSection() {
  return (
    <Section title="카톡 안 로그인">
      <AuthCard>
        <div className="flex flex-wrap items-center gap-2">
          <BrandMark />
          <p className="text-base font-semibold">VADA</p>
          <p className="ml-auto text-xs text-fg-muted">학생회를 위한 공간</p>
        </div>
        <KakaoBlock
          userAgent={kakaoUserAgent}
          location={{ href: 'https://vada.example/join/ABCD2345' }}
          clipboard={{ writeText: async () => {} }}
        />
      </AuthCard>
    </Section>
  )
}

export function LongTextSection() {
  return (
    <Section title="긴 글">
      <div className="flex w-60 flex-col rounded-lg border bg-white p-2">
        <NavItem active>{longName}</NavItem>
      </div>
      <div className="flex w-60 flex-wrap items-baseline gap-x-2 rounded-lg border bg-white p-2">
        <strong className="min-w-0 text-sm font-semibold wrap-anywhere">{unbroken}</strong>
        <time className="text-xs text-fg-muted">오후 3:00</time>
      </div>
      <p className="w-full text-sm wrap-anywhere">{unbroken}</p>
    </Section>
  )
}

export function HiddenSection() {
  return (
    <Section title="숨김">
      <div hidden className="flex" data-check="hidden">
        이 문장이 보이면 hidden 속성이 깨진 것이다.
      </div>
      <p className="text-xs text-fg-muted">위에 아무 문장도 보이지 않아야 한다.</p>
    </Section>
  )
}
