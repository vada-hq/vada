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
import { SidebarSection } from './SidebarSections'
import { HeaderSection } from './HeaderSections'
import { AccountSection } from './AccountSections'
import { MessageBubbleSection, RoomRowSection } from './ChatSections'
import { ExpenseCreateSection } from './ExpenseCreateSections'
import { ExpenseSection } from './ExpenseSections'
import { ClosingSection } from './ClosingSections'
import { IncomeSection } from './IncomeSections'
import { BudgetItemLineSection, BudgetPlanSection } from './BudgetSections'
import {
  DecisionPanelSection,
  DecisionSection,
  FinanceSection,
  ItemCancelSection,
} from './FinanceSections'
import { EventHeaderSection, EventSection } from './EventSections'
import { EventEditSection } from './EventEditSections'
import { EventSettlementsSection, SettlementSection } from './SettlementSections'
import {
  TaskBoardSection,
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
import { HomeFrameSection } from './HomeFrameSections'
import { CouncilHomeSection } from './CouncilHomeSections'
import { MemberHomeSection } from './MemberHomeSections'
import { HomeEventStatusSection } from './HomeEventStatusSections'
import { ApplyNoticeSection, PublicSection } from './PublicSections'
import { ApplicantRowSection, RegistrationSection } from './RegistrationSections'
import { ConfirmSection, DialogSheetSection } from './OverlaySections'
import { CreateCouncilSection } from './OnboardingSections'
import { JoinSection, MyNameSection } from './JoinSections'
import { WithdrawSection } from './WithdrawSections'
import { OrgInviteSection, OrgSection } from './OrgSections'
import { PersonSection } from './PersonSections'

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
      <SidebarSection />
      <SpaceListSection />
      <HeaderSection />
      <ActionMenuSection />
      <MessageMenuSection />
      <KkirukMessageSection />
      <RoomRowSection />
      <MessageBubbleSection />
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
      <TaskBoardSection />
      <TaskQuickAddSection />
      <TaskUndoBarSection />
      <TaskResultsSection />
      <HomeSection />
      <HomeInboxSection />
      <HomeOtherSection />
      <HomeEmptyEventsSection />
      <HomeEventStatusSection />
      <HomeFrameSection />
      <CouncilHomeSection />
      <MemberHomeSection />
      <OrgSection />
      <OrgInviteSection />
      <PersonSection />
      <PublicSection />
      <ApplyNoticeSection />
      <RegistrationSection />
      <ApplicantRowSection />
      <FinanceSection />
      <DecisionSection />
      <DecisionPanelSection />
      <ItemCancelSection />
      <ExpenseSection />
      <ExpenseCreateSection />
      <IncomeSection />
      <ClosingSection />
      <BudgetItemLineSection />
      <BudgetPlanSection />
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
