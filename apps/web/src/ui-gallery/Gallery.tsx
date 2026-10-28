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
  SystemMessageSection,
  MessageMenuSection,
} from './MenuSections'
import { SpaceListSection } from './SpaceSections'
import { SidebarSection } from './SidebarSections'
import { HeaderSection } from './HeaderSections'
import { BottomNavigationSection } from './BottomNavigationSections'
import { AccountSection } from './AccountSections'
import { FinancePeriodsSection } from './FinancePeriodsSections'
import { FeePaymentUploadSection } from './FeePaymentSections'
import { MessageBubbleSection, MessageMadeSection, RoomRowSection } from './ChatSections'
import { ExpenseCreateSection } from './ExpenseCreateSections'
import { ExpenseSection } from './ExpenseSections'
import { ShipmentSection } from './ShipmentSections'
import { ExpenseListSection } from './ExpenseListSections'
import { ClosingSection } from './ClosingSections'
import { IncomeSection } from './IncomeSections'
import { OverviewSection } from './OverviewSections'
import { BudgetItemLineSection, BudgetPlanSection } from './BudgetSections'
import {
  DecisionPanelSection,
  DecisionSection,
  FinanceSection,
  ItemCancelSection,
} from './FinanceSections'
import { EventHeaderSection, EventSection } from './EventSections'
import { EventMessagesSection, EventRoomListSection } from './EventMessageSections'
import { EventEditSection } from './EventEditSections'
import { EventSettlementsSection, SettlementSection } from './SettlementSections'
import {
  TaskBoardSection,
  TaskQuickAddSection,
  TaskSection,
  TaskTableSection,
  TaskUndoBarSection,
} from './TaskSections'
import { TaskDetailSection } from './TaskDetailSections'
import {
  HomeEmptyEventsSection,
  HomeInboxSection,
  HomeOtherSection,
  HomeSection,
} from './HomeSections'
import { HomeFrameSection } from './HomeFrameSections'
import { TaskMenuSection } from './TaskMenuSection'
import { CouncilHomeSection } from './CouncilHomeSections'
import { MemberHomeSection } from './MemberHomeSections'
import { DepartmentHomeSection } from './DepartmentHomeSections'
import { FinanceHomeSection, HomeFinanceSummarySection } from './FinanceHomeSections'
import { HomeEventStatusSection } from './HomeEventStatusSections'
import { ApplyNoticeSection, PublicSection } from './PublicSections'
import {
  ApplicantRowSection,
  EventApplicantsSection,
  RegistrationSection,
  RegistrationReceptionSection,
} from './RegistrationSections'
import { ScanVerdictSection } from './ScanVerdictSection'
import { ConfirmSection, DialogSheetSection } from './OverlaySections'
import { CreateCouncilSection } from './OnboardingSections'
import { CouncilEntrySection } from './CouncilEntrySections'
import { JoinSection, MyNameSection } from './JoinSections'
import { ProductPanelSection } from './ProductSections'
import { PurchaseRequestSection } from './PurchaseRequestSections'
import { PurchasesSection } from './PurchasesSections'
import { WithdrawSection } from './WithdrawSections'
import { OrgInviteSection, OrgSection } from './OrgSections'
import { DepartmentColorSection } from './DepartmentColorSections'
import { GalleryNavigation } from './GalleryNavigation'
import { CalendarSection } from './CalendarSections'

// 새 부품이나 변형을 더하면 해당 묶음 파일에도 더한다(AGENTS.md "화면" 절). 와이어프레임 스크린샷과 나란히 비교하는 화면이다.
export const gallerySections = [
  ProductPanelSection,
  PurchaseRequestSection,
  ButtonsSection,
  InputsSection,
  ChipsSection,
  CardsSection,
  MenuTabsSection,
  SidebarSection,
  SpaceListSection,
  HeaderSection,
  BottomNavigationSection,
  ActionMenuSection,
  MessageMenuSection,
  SystemMessageSection,
  RoomRowSection,
  MessageBubbleSection,
  MessageMadeSection,
  EmptyAvatarSection,
  DialogSheetSection,
  ConfirmSection,
  StateSection,
  PushSection,
  EventSection,
  EventHeaderSection,
  EventMessagesSection,
  EventRoomListSection,
  EventEditSection,
  SettlementSection,
  TaskSection,
  TaskMenuSection,
  TaskTableSection,
  TaskBoardSection,
  TaskQuickAddSection,
  TaskUndoBarSection,
  TaskDetailSection,
  CalendarSection,
  HomeSection,
  HomeInboxSection,
  HomeOtherSection,
  HomeEmptyEventsSection,
  HomeEventStatusSection,
  HomeFrameSection,
  CouncilHomeSection,
  MemberHomeSection,
  DepartmentHomeSection,
  FinanceHomeSection,
  HomeFinanceSummarySection,
  OrgSection,
  DepartmentColorSection,
  OrgInviteSection,
  PublicSection,
  ApplyNoticeSection,
  RegistrationSection,
  RegistrationReceptionSection,
  ScanVerdictSection,
  ApplicantRowSection,
  EventApplicantsSection,
  FinanceSection,
  PurchasesSection,
  OverviewSection,
  DecisionSection,
  DecisionPanelSection,
  ItemCancelSection,
  ExpenseSection,
  ShipmentSection,
  ExpenseListSection,
  ExpenseCreateSection,
  IncomeSection,
  ClosingSection,
  BudgetItemLineSection,
  BudgetPlanSection,
  EventSettlementsSection,
  AccountSection,
  FinancePeriodsSection,
  FeePaymentUploadSection,
  AuthSection,
  CreateCouncilSection,
  CouncilEntrySection,
  JoinSection,
  MyNameSection,
  WithdrawSection,
  AgreementSection,
  KakaoSection,
  LongTextSection,
  HiddenSection,
] as const

export default function Gallery() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold">VADA 부품</h1>
      <GalleryNavigation>
        {gallerySections.map(Section => (
          <Section key={Section.name} />
        ))}
      </GalleryNavigation>
    </main>
  )
}
