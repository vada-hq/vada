import {
  AgreementSection,
  AuthSection,
  HiddenSection,
  KakaoSection,
  LongTextSection,
  PushSection,
  StateSection,
} from './AppSections'
import { ButtonsSection, CardsSection, ChipsSection, InputsSection } from './FormSections'
import {
  ActionMenuSection,
  EmptyAvatarSection,
  MenuTabsSection,
  KkirukMessageSection,
  MessageMenuSection,
} from './MenuSections'
import { SpaceListSection } from './SpaceSections'
import { AccountSection } from './AccountSections'
import { ExpenseSection } from './ExpenseSections'
import { ClosingSection } from './ClosingSections'
import { IncomeSection } from './IncomeSections'
import { DecisionSection, FinanceSection, ItemCancelSection } from './FinanceSections'
import { EventHeaderSection, EventSection } from './EventSections'
import { EventEditSection } from './EventEditSections'
import { EventSettlementsSection, SettlementSection } from './SettlementSections'
import {
  TaskQuickAddSection,
  TaskResultsSection,
  TaskSection,
  TaskTableSection,
  TaskUndoBarSection,
} from './TaskSections'
import {
  HomeEmptyEventsSection,
  HomeInboxSection,
  HomeOtherSection,
  HomeSection,
} from './HomeSections'
import { ApplyNoticeSection, PublicSection } from './PublicSections'
import { ApplicantRowSection, RegistrationSection } from './RegistrationSections'
import { ConfirmSection, DialogSheetSection } from './OverlaySections'
import { CreateCouncilSection } from './OnboardingSections'
import { JoinSection, MyNameSection } from './JoinSections'
import { WithdrawSection } from './WithdrawSections'

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
      <SpaceListSection />
      <ActionMenuSection />
      <MessageMenuSection />
      <KkirukMessageSection />
      <EmptyAvatarSection />
      <DialogSheetSection />
      <ConfirmSection />
      <StateSection />
      <PushSection />
      <EventSection />
      <EventHeaderSection />
      <EventEditSection />
      <SettlementSection />
      <TaskSection />
      <TaskTableSection />
      <TaskQuickAddSection />
      <TaskUndoBarSection />
      <TaskResultsSection />
      <HomeSection />
      <HomeInboxSection />
      <HomeOtherSection />
      <HomeEmptyEventsSection />
      <PublicSection />
      <ApplyNoticeSection />
      <RegistrationSection />
      <ApplicantRowSection />
      <FinanceSection />
      <DecisionSection />
      <ItemCancelSection />
      <ExpenseSection />
      <IncomeSection />
      <ClosingSection />
      <EventSettlementsSection />
      <AccountSection />
      <AuthSection />
      <CreateCouncilSection />
      <JoinSection />
      <MyNameSection />
      <WithdrawSection />
      <AgreementSection />
      <KakaoSection />
      <LongTextSection />
      <HiddenSection />
    </main>
  )
}
