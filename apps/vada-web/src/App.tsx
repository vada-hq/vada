import { useState } from 'react'
import { ScreenRouter } from './screens/ScreenRouter'
import { createEmptyDraft } from './state/onboarding'
import type { OnboardingDraft } from './state/onboarding'

function App() {
  const [screenId, setScreenId] = useState('ONB-01')
  // onboardingDraft 스코프: 화면 이동 후 복귀해도 입력값이 유지된다(메모리 수준).
  const [draft, setDraft] = useState<OnboardingDraft>(createEmptyDraft)

  return (
    <ScreenRouter
      screenId={screenId}
      draft={draft}
      onChangeDraft={setDraft}
      onNavigate={setScreenId}
    />
  )
}

export default App
