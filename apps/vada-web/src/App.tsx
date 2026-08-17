import { useState } from 'react'
import { ONB01Screen } from './screens/ONB01Screen'
import { ONB02Screen } from './screens/ONB02Screen'
import { createEmptyDraft } from './state/onboarding'
import type { OnboardingDraft } from './state/onboarding'

function App() {
  const [screenId, setScreenId] = useState('ONB-01')
  // onboardingDraft 스코프: 화면 이동 후 복귀해도 입력값이 유지된다(메모리 수준).
  const [draft, setDraft] = useState<OnboardingDraft>(createEmptyDraft)

  if (screenId === 'ONB-02') {
    return <ONB02Screen onNavigate={setScreenId} />
  }
  return <ONB01Screen draft={draft} onChangeDraft={setDraft} onNavigate={setScreenId} />
}

export default App
