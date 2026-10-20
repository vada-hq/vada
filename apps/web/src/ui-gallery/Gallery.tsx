import {
  AuthSection,
  HiddenSection,
  KakaoSection,
  LongTextSection,
  PushSection,
  StateSection,
} from './AppSections'
import { ButtonsSection, CardsSection, ChipsSection, InputsSection } from './FormSections'
import { ActionMenuSection, EmptyAvatarSection, MenuTabsSection } from './MenuSections'
import { ConfirmSection, DialogSheetSection } from './OverlaySections'

// 새 부품이나 변형을 더하면 해당 묶음 파일에도 더한다(AGENTS.md "화면" 절). 와이어프레임 스크린샷과 나란히 비교하는 화면이다.
export default function Gallery() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold">VADA 부품</h1>
      <ButtonsSection />
      <InputsSection />
      <ChipsSection />
      <CardsSection />
      <MenuTabsSection />
      <ActionMenuSection />
      <EmptyAvatarSection />
      <DialogSheetSection />
      <ConfirmSection />
      <StateSection />
      <PushSection />
      <AuthSection />
      <KakaoSection />
      <LongTextSection />
      <HiddenSection />
    </main>
  )
}
