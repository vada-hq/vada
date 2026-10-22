import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AgreementResponse } from '@vada/contracts'
import AgreementPanel, { AGREEMENT_PATH } from './AgreementPanel'
import AuthPage from './AuthPage'
import { getJson, setTermsRequiredHandler } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { AGREEMENT_READ_FAILED } from '@/lib/messages'
import StateMessage from '@/components/StateMessage'

type Props = {
  logoutBusy: boolean
  onLogout: () => void
  children: ReactNode
}

function ReadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <AuthPage>
      <StateMessage kind="error">{AGREEMENT_READ_FAILED}</StateMessage>
      <Button onClick={onRetry}>다시 시도</Button>
    </AuthPage>
  )
}

// 동의가 필요한 사람에게는 학생회 고르기보다 먼저 동의 화면을 보인다(DEC-51). 서버가 학생회 요청을 막으므로(403) 이 화면은 안내다.
// 동의 상태를 읽지 못하면 막지 않고 보낸다: 막는 일은 서버가 하고, 쓰는 중 403 TERMS_REQUIRED가 오면 다시 읽어 이 화면으로 온다.
export default function AgreementGate({ logoutBusy, onLogout, children }: Props) {
  const [terms, setTerms] = useState<AgreementResponse | null>(null)
  const [loaded, setLoaded] = useState(false)
  // 서버가 막았는데(403) 동의 상태를 읽지 못하면 그대로 두지 않고 다시 읽게 한다.
  const [blockedUnread, setBlockedUnread] = useState(false)
  const reload = useCallback(async (blocked: boolean) => {
    const result = await getJson<AgreementResponse>(AGREEMENT_PATH)
    if (result.ok) setTerms(result.data)
    setBlockedUnread(blocked && !result.ok)
    setLoaded(true)
  }, [])
  useEffect(() => {
    void reload(false)
    setTermsRequiredHandler(() => {
      void reload(true)
    })
    return () => {
      setTermsRequiredHandler(null)
    }
  }, [reload])

  if (!loaded)
    return (
      <AuthPage>
        <StateMessage kind="loading">확인 중…</StateMessage>
      </AuthPage>
    )
  if (blockedUnread) return <ReadFailed onRetry={() => void reload(true)} />
  if (terms?.required && !terms.agreed)
    return (
      <AuthPage>
        <AgreementPanel
          terms={terms}
          logoutBusy={logoutBusy}
          onTerms={setTerms}
          onLogout={onLogout}
        />
      </AuthPage>
    )
  return children
}
