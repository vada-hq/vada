import React, { useEffect, useState } from "react";
import {
  GripVertical, Plus, X, ChevronRight, ChevronDown, Search, Download,
  Copy, RefreshCw, QrCode, Check, AlertCircle, Clock, User, Users,
  Calendar, MapPin, ArrowLeft, ArrowRight, FileText, Settings, Home,
  BarChart2, Clipboard, Menu, ExternalLink, MoreHorizontal, Upload, Eye,
  Minus, Star, Info, Sparkles
} from "lucide-react";

// ─── Shared Types ───────────────────────────────────────────────────────────

type Screen = {
  id: string;
  label: string;
  group: string;
  mobile?: boolean;
};

const SCREENS: Screen[] = [
  { id: "ONB-01", label: "본인 소속 입력", group: "온보딩" },
  { id: "ONB-02", label: "시작 방식 선택", group: "온보딩" },
  { id: "ORG-01", label: "새 학생회 생성", group: "학생회 생성" },
  { id: "ORG-02", label: "조직 구조 설정", group: "학생회 생성" },
  { id: "INV-00", label: "초대 코드 입력", group: "학생회 참여" },
  { id: "INV-01", label: "초대받은 학생회 확인", group: "학생회 참여" },
  { id: "HOME-01", label: "홈 — 학생회 운영 현황", group: "홈" },
  { id: "MY-01", label: "내 업무", group: "내 업무" },
  { id: "OPS-00", label: "운영 홈 — 업무·회의·행사·캘린더", group: "운영" },
  { id: "OPS-TASK-01", label: "상시 업무 — 칸반 보드", group: "운영 — 상시 업무" },
  { id: "OPS-MEET-01A", label: "전체 회의 — 일반 참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-01B", label: "전체 회의 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-01C", label: "전체 회의 — 회의 생성 가능", group: "운영 — 회의" },
  { id: "OPS-MEET-02", label: "회의 생성·수정", group: "운영 — 회의" },
  { id: "OPS-MEET-03A", label: "예정 회의 상세 — 일반 참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-03B", label: "예정 회의 관리 — 생성자", group: "운영 — 회의" },
  { id: "OPS-MEET-03C", label: "예정 회의 상세 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-04A", label: "진행 권한 현황 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-04B", label: "진행 권한 관리 — 회의 생성자", group: "운영 — 회의" },
  { id: "OPS-MEET-05A", label: "진행 중 회의 — 일반 참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-05B", label: "진행 중 회의 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-06A", label: "정리 중 회의 — 일반 참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-06B", label: "회의록 정리 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-07", label: "완료 회의록 — 참석자", group: "운영 — 회의" },
  { id: "OPS-MEET-08", label: "회의 요약 확인 — 불참자", group: "운영 — 회의" },
  { id: "OPS-MEET-09", label: "취소된 회의 상세", group: "운영 — 회의" },
  { id: "OPS-MEET-D01", label: "회의 시작 확인", group: "운영 — 회의 · 확인 상태" },
  { id: "OPS-MEET-D02", label: "회의 종료 확인", group: "운영 — 회의 · 확인 상태" },
  { id: "OPS-MEET-D03", label: "진행 권한 부여 확인", group: "운영 — 회의 · 확인 상태" },
  { id: "OPS-MEET-D04", label: "회의 취소 확인", group: "운영 — 회의 · 확인 상태" },
  { id: "EVT-00A", label: "행사 목록 — 일반 구성원", group: "운영 — 행사" },
  { id: "EVT-00A2", label: "행사 목록 — 운영진", group: "운영 — 행사" },
  { id: "EVT-00B", label: "새 행사 만들기 모달", group: "운영 — 행사" },
  { id: "EVT-02", label: "행사 개요 — 기획 중", group: "운영 — 행사" },
  { id: "EVT-02B", label: "행사 정보 편집 패널", group: "운영 — 행사" },
  { id: "EVT-02C", label: "행사 종료 확인 모달", group: "운영 — 행사" },
  { id: "EVT-02D", label: "행사 개요 — 후속 정리 중", group: "운영 — 행사" },
  { id: "EVT-02E", label: "행사 완료 처리 확인 모달", group: "운영 — 행사" },
  { id: "EVT-03C", label: "운영 조직 — 빈 상태", group: "운영 — 행사" },
  { id: "EVT-01", label: "행사 운영 조직 설정", group: "운영 — 행사" },
  { id: "EVT-03A", label: "운영 조직 — 보기", group: "운영 — 행사" },
  { id: "EVT-03B", label: "운영 조직 — 수정", group: "운영 — 행사" },
  { id: "EVT-04C", label: "행사 참가자 — 빈 상태", group: "운영 — 행사" },
  { id: "EVT-04", label: "행사 참가자 명단", group: "운영 — 행사" },
  { id: "EVT-04B", label: "QR 참석 확인 모달", group: "운영 — 행사" },
  { id: "EVT-05", label: "참여 설문 생성·관리", group: "운영 — 행사" },
  { id: "EVT-05B", label: "기존 설문 교체 모달", group: "운영 — 행사" },
  { id: "EVT-TASK-01", label: "행사 업무 — 칸반 보드", group: "운영 — 행사" },
  { id: "EVT-TASK-02", label: "업무 상세 — 관련 문서·결과물", group: "운영 — 행사" },
  { id: "EVT-FIN-01", label: "행사 재정 — 개요", group: "운영 — 행사" },
  { id: "EVT-MEET-01", label: "행사 관련 회의", group: "운영 — 행사" },
  { id: "EVT-SCHED-01", label: "행사 일정", group: "운영 — 행사" },
  { id: "EVT-DOC-01", label: "행사 문서", group: "운영 — 행사" },
  { id: "MY-REQ-01", label: "내 구매 요청 — 행사 재정", group: "운영 — 행사" },
  { id: "OPS-CAL-01", label: "캘린더 — 월간 일정", group: "운영 — 캘린더" },
  { id: "FIN-00", label: "전체 재정 현황", group: "재정" },
  { id: "FIN-WORK-01", label: "구매 요청 목록", group: "재정" },
  { id: "FIN-REQ-01", label: "구매 요청 작성·수정", group: "재정" },
  { id: "FIN-REQ-02", label: "구매 요청 상세·진행 상태", group: "재정" },
  { id: "FIN-REV-01", label: "구매 요청 검토", group: "재정" },
  { id: "FIN-SUP-01", label: "보완 요청 확인·재제출", group: "재정" },
  { id: "FIN-PROC-01", label: "구매·발주 처리", group: "재정" },
  { id: "FIN-LEDGER-01", label: "사용 내역", group: "재정" },
  { id: "FIN-EVID-01", label: "결제·증빙 정리", group: "재정" },
  { id: "REC-01", label: "완료된 행사 목록", group: "기록" },
  { id: "REC-02", label: "행사 아카이브 상세", group: "기록" },
  { id: "REC-02A", label: "아카이브 작성·검토", group: "기록" },
  { id: "ORG-00", label: "조직 관리 홈", group: "조직 관리" },
  { id: "ORG-03A", label: "조직 관리 — 보기", group: "조직 관리" },
  { id: "ORG-03B", label: "조직 관리 — 수정", group: "조직 관리" },
  { id: "ORG-03C", label: "구성원 초대 패널", group: "조직 관리" },
  { id: "ORG-07A", label: "학생 명단 관리", group: "조직 관리" },
  { id: "ORG-07B", label: "학생 명단 업로드·갱신 모달", group: "조직 관리" },
  { id: "ORG-04", label: "역할 및 권한", group: "조직 관리" },
  { id: "ORG-04B", label: "역할 및 권한 관리 — 회장단", group: "조직 관리" },
  { id: "EXT-02A", label: "외부 참여 설문", group: "외부 참여", mobile: true },
  { id: "EXT-02B", label: "참여 신청 완료", group: "외부 참여", mobile: true },
  { id: "EXT-02C", label: "설문 예외·종료 상태", group: "외부 참여", mobile: true },
  { id: "EXT-01A", label: "QR 참석 확인", group: "외부 참여", mobile: true },
  { id: "EXT-01B", label: "참석 확인 결과", group: "외부 참여", mobile: true },
];

// ─── Shared Event State ───────────────────────────────────────────────────────

type FeeType = "무료" | "정액 유료" | "학생회비 조건부" | "미정";
type CapacityType = "제한없음" | "인원제한" | "미정";
type SurveyStatus = "초안" | "활성" | "종료" | "교체됨";
type RecruitMethod = "선착순" | "관리자승인";

type FinanceStatus = "검토 대기" | "승인" | "보완 요청" | "반려" | "구매 필요" | "증빙 필요" | "정산 완료";

type PurchaseItem = {
  id: number;
  name: string;
  category: string;
  budgetLine: string;
  purchaseType: "일반 구매" | "제작·인쇄" | "대여·용역";
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotalPrice: number;
  status: "검토 대기" | "승인" | "보완 요청" | "반려";
  details: any;
};

type PurchaseRequest = {
  id: string;
  title: string;
  event: string;
  dept: string;
  requester: string;
  purpose: string;
  neededDate: string;
  priority: "보통" | "긴급";
  totalEstimatedAmount: number;
  items: PurchaseItem[];
  status: FinanceStatus | "부분 승인";
  history: { date: string; action: string; user: string }[];
};

type PurchaseDraftItem = Omit<PurchaseItem, "status"> & { quoteStatus: string };

type PurchaseRequestDraft = {
  title: string;
  neededDate: string;
  purpose: string;
  priority: "보통" | "긴급";
  items: PurchaseDraftItem[];
  savedAt: string;
};

type PurchaseSupplementDraft = {
  size: string;
  color: string;
  printPosition: string;
  quantityOption: string;
  savedAt: string;
};

type EventInfo = {
  // 행사 정보
  name: string;
  intro: string;
  purpose: string;
  // 일시
  startAt: string;
  endAt: string;
  noEndTime: boolean;
  // 장소
  placeConfirmed: boolean;
  placeName: string;
  placeAddress: string;
  placeDetail: string;
  // 참여 정보
  target: string;
  feeType: FeeType;
  feeAmount: string;
  feePayment: string;
  feePaidAmount: string;
  feeUnpaidAmount: string;
  capacityType: CapacityType;
  capacityCount: string;
  // 담당 및 안내
  dept: string;
  manager: string;
  contact: string;
  notice: string;
};

type EventLifecycle = "기획 중" | "진행 중" | "후속 정리 중" | "완료" | "취소됨";
type EventWorkspaceFilter = "unassignedTasks" | "participantReview" | null;
type CalendarFocus = { month: number; day: number; label: string } | null;
type ArchiveStatus = "미발행" | "초안" | "검토 중" | "발행";
type ArchiveReviewState = "대기" | "보완 요청" | "승인";

type ArchiveDraft = {
  operation: string;
  good: string;
  bad: string;
  improve: string;
  improveOwner: string;
  handover: string;
  nextOwner: string;
  reviewer: string;
  reviewNote: string;
  reviewState: ArchiveReviewState;
};

type ArchiveRecord = {
  id: string;
  name: string;
  date: string;
  manager: string;
  owner: string;
  completedAt: string;
  summary: string;
  archiveStatus: ArchiveStatus;
  version: string;
  publishedAt?: string;
  author: string;
  performance: { attend: string; budget: string; tasks: string };
  sourceScreen: string;
  draft: ArchiveDraft;
  versions: string[];
  snapshots: { version: string; publishedAt: string; draft: ArchiveDraft }[];
};

type EventTaskStatus = "예정" | "진행 중" | "검토 필요" | "완료";

type EventTaskOfficialDoc = {
  name: string;
  lastModified: string;
  status: "확정" | "검토 중" | "참고";
  preview: string;
};

type EventTaskWorkDoc = {
  name: string;
  type: "파일" | "문서";
  reviewStatus: "작성 중" | "검토 중" | "승인";
  officialSynced: boolean;
};

type EventTaskReviewInfo = {
  submitStatus: "미제출" | "작성 중" | "제출 완료";
  reviewComment: string;
  needsRevision: boolean;
  isOfficial: boolean;
};

type EventTask = {
  id: string;
  name: string;
  dept: string;
  assignee: string;
  status: EventTaskStatus;
  due: string;
  priority: "보통" | "높음";
  hasDoc: boolean;
  delayed: boolean;
  description: string;
  related: string[];
  completionCriteria?: string;
  deliverable?: string;
  reviewRequired?: boolean;
  officialDocs?: EventTaskOfficialDoc[];
  workDocs?: EventTaskWorkDoc[];
  reviewInfo?: EventTaskReviewInfo;
  history?: { date: string; action: string; user: string; note?: string }[];
};

type RecurringTask = {
  id: string;
  name: string;
  dept: string;
  assignee: string;
  status: EventTaskStatus;
  due: string;
  cycle: "매주" | "매월" | "상시";
  delayed: boolean;
  description: string;
  related: string[];
  history?: { date: string; action: string; user: string; note?: string }[];
};

type CreatedEvent = {
  name: string;
  createdAt: string;
};

type CreatedMeeting = {
  id: string;
  group: string;
  name: string;
  status: "예정" | "진행 중" | "정리 중" | "완료" | "취소";
  time: string;
  place: string;
  owner: string;
  participants: number;
  agendas: number;
  docStatus: "작성 전" | "작성 중" | "정리 필요" | "정리 완료" | "취소됨";
  relation: "회의 생성자";
  agendaTitles: string[];
  participantNames: string[];
  facilitatorNames: string[];
  attendance: Record<string, { joinedAt?: string; summaryConfirmedAt?: string }>;
  agendaRecords: CreatedMeetingAgendaRecord[];
  startedAt?: string;
  endedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
};

type CreatedMeetingAgendaRecord = {
  title: string;
  discussion: string;
  decision: string;
  decisionNone: boolean;
  taskName: string;
  taskAssignee: string;
  taskDue: string;
  taskNone: boolean;
  taskCreatedId?: string;
};

type MeetingDraft = {
  meetingType: "regular" | "event";
  form: { event: string; name: string; date: string; time: string; place: string };
  purpose: string;
  savedAt: string;
};

type OrganizationRole = "회장단" | "부서장" | "부원";
type OrganizationMemberRole = {
  name: string;
  dept: string;
  role: OrganizationRole;
};

type DemoDataMode = "default" | "first-use";

const DEFAULT_ORGANIZATION_MEMBER_ROLES: OrganizationMemberRole[] = [
  { name: "김바다", dept: "학술체육부", role: "회장단" },
  { name: "이수현", dept: "기획부", role: "부서장" },
  { name: "이윤슬", dept: "홍보부", role: "부서장" },
  { name: "김민준", dept: "재정부", role: "부서장" },
  { name: "박해랑", dept: "운영부", role: "부원" },
  { name: "정하늘", dept: "운영부", role: "부원" },
];

const DRAFT_STORAGE_KEYS = {
  meeting: "vada:meeting-draft",
  purchaseRequest: "vada:purchase-request-draft",
  purchaseSupplement: "vada:purchase-supplement-draft",
} as const;

function loadDraft<T>(key: string): T | null {
  try {
    const savedDraft = window.localStorage.getItem(key);
    return savedDraft ? JSON.parse(savedDraft) as T : null;
  } catch {
    return null;
  }
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultNeededDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return formatDateInput(date);
}

const MEMBER_DEPARTMENTS: Record<string, string> = {
  "박해랑": "운영부",
  "정하늘": "운영부",
  "이수현": "기획부",
  "이윤슬": "홍보부",
  "김민준": "재정부",
  "김바다": "학술체육부",
};

type SurveyQuestion = {
  id: number; q: string; type: string; required: boolean; locked: boolean;
};

type SurveySettings = {
  startAt: string;
  endAt: string;
  method: RecruitMethod;
  useWaiting: boolean;
  useHakbi: boolean;
  completionMsg: string;
  questions: SurveyQuestion[];
  status: SurveyStatus;
  responseCount: number;
};

const DEFAULT_EVENT_INFO: EventInfo = {
  name: "2026 소프트웨어융합대학 체육대회",
  intro: "소프트웨어융합대학 구성원 전체가 함께하는 연간 체육 행사입니다.",
  purpose: "",
  startAt: "2026-08-20T10:00",
  endAt: "2026-08-20T14:00",
  noEndTime: false,
  placeConfirmed: true,
  placeName: "ERICA 체육관",
  placeAddress: "경기 안산시 상록구 한양대학로 55",
  placeDetail: "",
  target: "소프트웨어융합대학 전체",
  feeType: "학생회비 조건부",
  feeAmount: "",
  feePayment: "",
  feePaidAmount: "0",
  feeUnpaidAmount: "5000",
  capacityType: "인원제한",
  capacityCount: "200",
  dept: "학술체육부",
  manager: "김바다",
  contact: "카카오톡 채널 @swcollege",
  notice: "",
};

const DEFAULT_SURVEY_SETTINGS: SurveySettings = {
  startAt: "2026-07-10T00:00",
  endAt: "",
  method: "선착순",
  useWaiting: false,
  useHakbi: true,
  completionMsg: "",
  questions: [
    { id: 1, q: "이름", type: "단답형", required: true, locked: true },
    { id: 2, q: "학번", type: "단답형", required: true, locked: true },
    { id: 3, q: "단과대학", type: "단답형", required: true, locked: false },
    { id: 4, q: "학부·학과", type: "단답형", required: true, locked: false },
    { id: 5, q: "학년", type: "객관식", required: true, locked: false },
    { id: 6, q: "개인정보 동의", type: "개인정보 동의", required: true, locked: false },
  ],
  status: "초안",
  responseCount: 142,
};

type AppContextType = {
  eventInfo: EventInfo;
  setEventInfo: React.Dispatch<React.SetStateAction<EventInfo>>;
  eventLifecycle: EventLifecycle;
  setEventLifecycle: React.Dispatch<React.SetStateAction<EventLifecycle>>;
  eventWorkspaceFilter: EventWorkspaceFilter;
  setEventWorkspaceFilter: React.Dispatch<React.SetStateAction<EventWorkspaceFilter>>;
  calendarFocus: CalendarFocus;
  setCalendarFocus: React.Dispatch<React.SetStateAction<CalendarFocus>>;
  surveySettings: SurveySettings;
  setSurveySettings: React.Dispatch<React.SetStateAction<SurveySettings>>;
  eventTasks: EventTask[];
  setEventTasks: React.Dispatch<React.SetStateAction<EventTask[]>>;
  recurringTasks: RecurringTask[];
  setRecurringTasks: React.Dispatch<React.SetStateAction<RecurringTask[]>>;
  createdMeetings: CreatedMeeting[];
  setCreatedMeetings: React.Dispatch<React.SetStateAction<CreatedMeeting[]>>;
  createdEvents: CreatedEvent[];
  setCreatedEvents: React.Dispatch<React.SetStateAction<CreatedEvent[]>>;
  selectedCreatedMeetingId: string | null;
  setSelectedCreatedMeetingId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedRecurringTaskId: string | null;
  setSelectedRecurringTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedArchiveId: string | null;
  setSelectedArchiveId: React.Dispatch<React.SetStateAction<string | null>>;
  archives: ArchiveRecord[];
  setArchives: React.Dispatch<React.SetStateAction<ArchiveRecord[]>>;
  selectedEventTaskId: string | null;
  setSelectedEventTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  purchaseRequests: PurchaseRequest[];
  setPurchaseRequests: React.Dispatch<React.SetStateAction<PurchaseRequest[]>>;
  meetingDraft: MeetingDraft | null;
  setMeetingDraft: React.Dispatch<React.SetStateAction<MeetingDraft | null>>;
  purchaseRequestDraft: PurchaseRequestDraft | null;
  setPurchaseRequestDraft: React.Dispatch<React.SetStateAction<PurchaseRequestDraft | null>>;
  purchaseSupplementDraft: PurchaseSupplementDraft | null;
  setPurchaseSupplementDraft: React.Dispatch<React.SetStateAction<PurchaseSupplementDraft | null>>;
  organizationMemberRoles: OrganizationMemberRole[];
  setOrganizationMemberRoles: React.Dispatch<React.SetStateAction<OrganizationMemberRole[]>>;
  demoDataMode: DemoDataMode;
  setDemoDataMode: React.Dispatch<React.SetStateAction<DemoDataMode>>;
  navigateTo: (screenId: string) => void;
  currentUser: { name: string; dept: string; role: string };
  activeSidebar?: string;
};

const DEFAULT_PURCHASE_REQUESTS: PurchaseRequest[] = [
  {
    id: "REQ-001",
    title: "체육대회 운영 물품 4종",
    event: "2026 소프트웨어융합대학 체육대회",
    dept: "운영부",
    requester: "박해랑",
    purpose: "행사 당일 운영 및 물품 관리",
    neededDate: "2026-03-15",
    priority: "보통",
    totalEstimatedAmount: 135000,
    status: "검토 대기",
    items: [
      { id: 1, name: "박스테이프", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 5, unit: "개", estimatedUnitPrice: 2000, estimatedTotalPrice: 10000, status: "승인", details: {} },
      { id: 2, name: "생수 500ml", category: "식음료", budgetLine: "식비", purchaseType: "일반 구매", quantity: 10, unit: "박스", estimatedUnitPrice: 5000, estimatedTotalPrice: 50000, status: "승인", details: {} },
      { id: 3, name: "이름표 용지", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 200, unit: "장", estimatedUnitPrice: 300, estimatedTotalPrice: 60000, status: "보완 요청", details: {} },
      { id: 4, name: "유성 마커", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 10, unit: "개", estimatedUnitPrice: 1500, estimatedTotalPrice: 15000, status: "승인", details: {} },
    ],
    history: [
      { date: "2026-03-01 10:00", action: "요청 생성", user: "박해랑" },
      { date: "2026-03-01 10:05", action: "제출", user: "박해랑" },
    ]
  },
  {
    id: "REQ-002",
    title: "현수막 A형 제작",
    event: "2026 소프트웨어융합대학 체육대회",
    dept: "홍보부",
    requester: "이윤슬",
    purpose: "행사장 메인 무대 설치",
    neededDate: "2026-03-14",
    priority: "긴급",
    totalEstimatedAmount: 180000,
    status: "보완 요청",
    items: [
      { id: 5, name: "메인 현수막", category: "제작·굿즈", budgetLine: "홍보비", purchaseType: "제작·인쇄", quantity: 1, unit: "개", estimatedUnitPrice: 180000, estimatedTotalPrice: 180000, status: "보완 요청", details: { 규격: "500*90", 소재: "부직포" } },
    ],
    history: [
      { date: "2026-03-02 14:00", action: "요청 생성", user: "이윤슬" },
      { date: "2026-03-03 09:00", action: "보완 요청", user: "김바다" },
    ]
  }
];

const DEFAULT_EVENT_TASKS: EventTask[] = [
  { id: "T-01", name: "행사 운영 계획 확정", dept: "기획부", assignee: "이수현", status: "완료", due: "2026-07-10", priority: "높음", hasDoc: true, delayed: false, description: "행사 운영 계획의 범위와 역할 분담을 최종 확정합니다.", related: ["행사 개요", "운영 계획서"] },
  { id: "T-02", name: "참가자 모집 공지 작성", dept: "홍보부", assignee: "이윤슬", status: "진행 중", due: "2026-07-20", priority: "보통", hasDoc: true, delayed: false, description: "참가 신청 일정과 안내 사항을 포함한 모집 공지를 작성합니다.", related: ["참여 설문", "홍보 가이드라인"] },
  {
    id: "T-03",
    name: "현수막 디자인 수정 반영",
    dept: "홍보부",
    assignee: "이윤슬",
    status: "진행 중",
    due: "2026-07-18",
    priority: "높음",
    hasDoc: true,
    delayed: true,
    description: "검토 의견을 반영해 현수막 디자인을 수정하고 인쇄 전 시안을 확정합니다.",
    related: ["현수막 제작 사양서", "홍보 가이드라인"],
    officialDocs: [
      { name: "2026 체육대회 홍보 가이드라인", lastModified: "2026-07-12", status: "확정", preview: "행사 전반의 시각 언어, 색상 코드, 글꼴 사용 기준을 정의합니다." },
      { name: "현수막 제작 사양서", lastModified: "2026-07-10", status: "검토 중", preview: "메인 현수막 및 보조 배너의 규격, 소재, 인쇄 방식에 대한 공식 사양." },
    ],
    workDocs: [
      { name: "현수막 시안 v2.png", type: "파일", reviewStatus: "검토 중", officialSynced: false },
      { name: "현수막 디자인 작업 노트", type: "문서", reviewStatus: "작성 중", officialSynced: false },
    ],
    reviewInfo: {
      submitStatus: "제출 완료",
      reviewComment: "메인 색상이 가이드라인과 다름. 교정 후 재제출 바랍니다.",
      needsRevision: true,
      isOfficial: false,
    },
  },
  { id: "T-04", name: "물품 구매 요청", dept: "운영부", assignee: "박해랑", status: "진행 중", due: "2026-07-25", priority: "보통", hasDoc: false, delayed: false, description: "행사 운영 물품을 정리하고 구매 요청서를 제출합니다.", related: ["행사 재정", "구매 요청"] },
  { id: "T-05", name: "행사장 안전 점검", dept: "운영부", assignee: "미지정", status: "예정", due: "2026-08-18", priority: "높음", hasDoc: false, delayed: false, description: "행사장 동선과 안전 설비를 점검하고 개선 사항을 등록합니다.", related: ["안전 점검표"] },
  { id: "T-06", name: "참가자 명단 최종 확정", dept: "기획부", assignee: "미지정", status: "예정", due: "2026-08-10", priority: "보통", hasDoc: false, delayed: false, description: "신청과 확인이 끝난 참가자 명단을 최종 확정합니다.", related: ["행사 참가자 명단"] },
  { id: "T-07", name: "행사 안전 안내문 검토", dept: "기획부", assignee: "박해랑", status: "검토 필요", due: "2026-07-22", priority: "보통", hasDoc: true, delayed: false, description: "참가자에게 전달할 안전 안내문을 검토하고 승인 의견을 남깁니다.", related: ["안전 안내문 초안"] },
];

const DEFAULT_RECURRING_TASKS: RecurringTask[] = [
  { id: "R-01", name: "주간 운영회의 자료 준비", dept: "운영부", assignee: "박해랑", status: "진행 중", due: "2026-07-21", cycle: "매주", delayed: false, description: "주간 운영회의 전까지 부서별 진행 현황과 확인이 필요한 안건을 취합합니다.", related: ["운영 > 회의 · 주간 운영회의"] },
  { id: "R-02", name: "회계 장부 주간 정리", dept: "재정부", assignee: "김민준", status: "진행 중", due: "2026-07-22", cycle: "매주", delayed: false, description: "이번 주 수입·지출 내역과 증빙 상태를 장부에 반영하고 누락 항목을 확인합니다.", related: ["재정 > 사용 내역"] },
  { id: "R-03", name: "SNS 계정 운영·공지 게시", dept: "홍보부", assignee: "이윤슬", status: "진행 중", due: "상시", cycle: "상시", delayed: false, description: "학생회 공식 SNS 채널의 문의를 확인하고 승인된 공지를 게시합니다.", related: ["홍보 채널 · 인스타그램", "홍보 채널 · 학생회 공지"] },
  { id: "R-04", name: "동아리방·물품 정기 점검", dept: "운영부", assignee: "미지정", status: "예정", due: "2026-08-01", cycle: "매월", delayed: false, description: "동아리방 시설과 공용 물품의 상태를 점검하고 보완이 필요한 항목을 기록합니다.", related: ["운영 > 상시 업무"] },
  { id: "R-05", name: "학생 건의함 확인·답변", dept: "기획부", assignee: "이수현", status: "진행 중", due: "2026-07-18", cycle: "매주", delayed: true, description: "접수된 학생 건의를 분류하고 담당 부서 확인 후 답변 방향을 정리합니다.", related: ["학생 건의함", "운영 > 회의 · 답변 검토"] },
  { id: "R-06", name: "게시판 공지물 정리", dept: "홍보부", assignee: "이윤슬", status: "예정", due: "2026-07-31", cycle: "매월", delayed: false, description: "기간이 지난 게시물을 제거하고 최신 공지물로 교체합니다.", related: ["홍보 채널 · 오프라인 게시판"] },
  { id: "R-07", name: "회의실 예약 현황 관리", dept: "운영부", assignee: "정하늘", status: "완료", due: "2026-07-15", cycle: "매주", delayed: false, description: "다음 주 회의실 예약 현황을 확인하고 겹치는 일정을 조정합니다.", related: ["운영 > 회의"] },
  { id: "R-08", name: "월간 예산 사용 공유", dept: "재정부", assignee: "김민준", status: "완료", due: "2026-07-05", cycle: "매월", delayed: false, description: "전월 예산 사용 현황을 부서별로 공유하고 확인이 필요한 지출을 안내합니다.", related: ["재정 > 전체 재정 현황"] },
  { id: "R-09", name: "학생 건의 답변 문안 검토", dept: "기획부", assignee: "박해랑", status: "검토 필요", due: "2026-07-22", cycle: "매주", delayed: false, description: "학생 건의함 답변 초안을 검토하고 표현 및 후속 안내 내용을 확정합니다.", related: ["학생 건의함", "R-05 학생 건의함 확인·답변"] },
];

const AppContext = React.createContext<AppContextType>({
  eventInfo: DEFAULT_EVENT_INFO,
  setEventInfo: () => {},
  eventLifecycle: "기획 중",
  setEventLifecycle: () => {},
  eventWorkspaceFilter: null,
  setEventWorkspaceFilter: () => {},
  calendarFocus: null,
  setCalendarFocus: () => {},
  surveySettings: DEFAULT_SURVEY_SETTINGS,
  setSurveySettings: () => {},
  eventTasks: DEFAULT_EVENT_TASKS,
  setEventTasks: () => {},
  recurringTasks: DEFAULT_RECURRING_TASKS,
  setRecurringTasks: () => {},
  createdMeetings: [],
  createdEvents: [],
  setCreatedEvents: () => {},
  setCreatedMeetings: () => {},
  selectedCreatedMeetingId: null,
  setSelectedCreatedMeetingId: () => {},
  selectedRecurringTaskId: null,
  setSelectedRecurringTaskId: () => {},
  selectedArchiveId: null,
  setSelectedArchiveId: () => {},
  archives: [],
  setArchives: () => {},
  selectedEventTaskId: null,
  setSelectedEventTaskId: () => {},
  purchaseRequests: DEFAULT_PURCHASE_REQUESTS,
  setPurchaseRequests: () => {},
  meetingDraft: null,
  setMeetingDraft: () => {},
  purchaseRequestDraft: null,
  setPurchaseRequestDraft: () => {},
  purchaseSupplementDraft: null,
  setPurchaseSupplementDraft: () => {},
  organizationMemberRoles: DEFAULT_ORGANIZATION_MEMBER_ROLES,
  setOrganizationMemberRoles: () => {},
  demoDataMode: "default",
  setDemoDataMode: () => {},
  navigateTo: () => {},
  currentUser: { name: "김바다", dept: "재정부", role: "부원" },
  activeSidebar: undefined,
});

// ─── Spec System ─────────────────────────────────────────────────────────────

type SpecFn = {
  num: string;
  element: string;
  description: string;
  constraint?: string;
};

type SpecDef = {
  id: string;
  name: string;
  stateChip: string;
  purpose: string;
  users: string;
  entryPath: string;
  preconditions?: string;
  functions: SpecFn[];
  exceptions?: string[];
  nextScreens?: string[];
};

const SPEC_DATA: Record<string, SpecDef> = {
  // ─── 회의 화면 정의서 (2026-07-19 작성 · 권한 매트릭스 확정값 반영) ─────────
  "OPS-MEET-01A": {
    id: "OPS-MEET-01A", name: "전체 회의 — 일반 참가자", stateChip: "기본",
    purpose: "학생회의 모든 회의를 상태별로 확인하고, 내 참여 관계에 맞는 다음 행동으로 이동한다.",
    users: "전 구성원 (일반 참가자 관점)",
    entryPath: "사이드바 운영 → 회의",
    functions: [
      { num: "01", element: "상태 필터·검색", description: "키워드와 전체·예정·진행 중·정리 중·완료·취소 상태로 회의를 좁히고, 일시순 또는 이름순으로 정렬한다. 결과가 없으면 초기화할 수 있다." },
      { num: "02", element: "회의 카드", description: "이름, 일시·장소, 참가 현황, 안건 수, 나와의 관계(참가자·미참가)를 표시한다. 생성된 예정 회의도 같은 그룹에 즉시 추가되며, 카드에서 해당 회의 정보를 연다." },
      { num: "03", element: "상태별 버튼", description: "예정=회의 상세 보기, 진행 중·미참가=회의 참가, 진행 중·참가=회의로 돌아가기, 완료·참석=회의록 보기, 완료·불참=회의 요약 확인.", constraint: "핸드오프 버튼 규칙 고정" },
      { num: "04", element: "새 회의 만들기", description: "이 화면에는 노출하지 않는다.", constraint: "회의 생성은 회장단·부서장만 (권한 매트릭스)" },
    ],
    exceptions: ["회의 시작·종료·권한 관리 버튼은 일반 참가자에게 노출하지 않는다"],
    nextScreens: ["OPS-MEET-03A 예정 상세", "OPS-MEET-05A 진행 중", "OPS-MEET-07 회의록", "OPS-MEET-08 요약 확인"],
  },
  "OPS-MEET-01B": {
    id: "OPS-MEET-01B", name: "전체 회의 — 진행 권한자", stateChip: "기본",
    purpose: "진행 권한이 있는 회의를 구분해 확인하고, 해당 회의의 시작·진행·정리 화면으로 이동한다.",
    users: "회의별 진행 권한자 (기본 직급과 무관)",
    entryPath: "사이드바 운영 → 회의",
    functions: [
      { num: "01", element: "목록·필터", description: "01A와 동일한 목록 구조." },
      { num: "02", element: "진행 권한 행동", description: "예정=회의 시작, 진행 중=회의로 돌아가기, 정리 중=회의록 정리로 이동한다.", constraint: "진행 권한이 있는 회의에만 적용" },
      { num: "03", element: "관계 칩", description: "진행 권한 보유 여부를 회의 카드별로 표시한다." },
      { num: "04", element: "새 회의 만들기", description: "이 화면에는 노출하지 않는다.", constraint: "진행 권한만으로 회의를 생성할 수 없음" },
    ],
    exceptions: ["진행 권한자는 다른 사람의 권한을 변경하거나 회의 정보를 수정·취소할 수 없다"],
    nextScreens: ["OPS-MEET-03C 예정 상세", "OPS-MEET-05B 진행 중", "OPS-MEET-06B 회의록 정리"],
  },
  "OPS-MEET-01C": {
    id: "OPS-MEET-01C", name: "전체 회의 — 회의 생성 가능", stateChip: "기본",
    purpose: "회의 생성 권한이 있는 사용자가 전체 회의를 확인하고 새 회의를 만든다.",
    users: "회장단·부서장",
    entryPath: "사이드바 운영 → 회의",
    functions: [
      { num: "01", element: "목록·필터", description: "01A와 동일한 목록 구조." },
      { num: "02", element: "새 회의 만들기", description: "OPS-MEET-02 회의 생성으로 이동한다.", constraint: "회장단·부서장에게만 노출" },
      { num: "03", element: "회의별 관계 행동", description: "내가 생성한 회의만 수정·취소·권한 관리가 가능하며, 진행 권한만 받은 회의는 시작·진행·정리만 가능하다." },
      { num: "04", element: "관계 칩", description: "회의 생성자, 진행 권한, 참가자 관계를 카드별로 구분한다." },
    ],
    exceptions: ["회의 생성 가능 직급이어도 다른 사람이 만든 회의의 정보나 권한을 임의로 변경할 수 없다"],
    nextScreens: ["OPS-MEET-02 회의 생성", "OPS-MEET-03A 참가자 상세", "OPS-MEET-03B 생성자 관리", "OPS-MEET-03C 진행 권한자 상세"],
  },
  "OPS-MEET-02": {
    id: "OPS-MEET-02", name: "회의 생성·수정", stateChip: "작성",
    purpose: "새 회의를 만들거나 예정 회의의 정보를 수정한다.",
    users: "회장단·부서장 (권한 매트릭스 확정), 수정은 회의 생성자",
    entryPath: "회의 목록(01C) → 새 회의 만들기 / 예정 회의 관리(03B) → 수정",
    functions: [
      { num: "01", element: "기본 정보", description: "회의 이름, 일시, 장소를 입력한다." },
      { num: "02", element: "참가자 초대", description: "구성원을 검색해 초대 목록을 구성한다." },
      { num: "03", element: "안건 구성", description: "안건 제목, 예상 시간, 관련 자료를 추가·정렬한다." },
      { num: "04", element: "회의 만들기", description: "필수값(회의명·일시·장소)을 확인해 예정 회의를 생성하고 권한자용 회의 목록에 즉시 추가한다.", constraint: "생성자는 자동으로 진행 권한자가 된다. 생성 결과는 로컬 상태 데모로 목록에만 반영된다" },
    ],
    exceptions: ["회의명·일시·장소 등 필수값이 없으면 회의를 생성하지 않는다", "임시 저장 초안은 회의 목록과 참가자에게 노출하지 않는다"],
    nextScreens: ["OPS-MEET-01C 회의 생성 가능 목록", "OPS-MEET-03B 예정 회의 관리"],
  },
  "OPS-MEET-03A": {
    id: "OPS-MEET-03A", name: "예정 회의 상세 — 일반 참가자", stateChip: "예정",
    purpose: "예정 회의의 정보, 안건, 참가 현황을 확인한다.",
    users: "초대된 전 구성원",
    entryPath: "회의 목록 → 회의 상세 보기",
    functions: [
      { num: "01", element: "요약 카드", description: "일시, 장소, 참가 예정 인원을 표시한다. 회의 생성 직후 목록에서 연 경우 생성 시 입력한 값과 안건·참가자 목록을 표시한다." },
      { num: "02", element: "안건 미리보기", description: "안건 제목과 예상 시간, 자료를 열람한다." },
      { num: "03", element: "참가 현황", description: "초대된 구성원과 참여 상태를 표시한다." },
      { num: "04", element: "생성 회의 시작", description: "생성자가 생성 회의의 시작을 확인하면 상태를 진행 중으로 바꾸고, 회의 목록의 상태·회의록 상태에도 즉시 반영한다.", constraint: "생성 회의의 진행·종료·회의록 편집은 현재 단계에서 기존 예시 회의 흐름과 분리한다" },
      { num: "05", element: "생성 회의 종료", description: "진행 중인 생성 회의의 종료를 확인하면 상태를 정리 중으로 바꾸고, 종료 시각과 회의록 정리 필요 상태를 목록에 반영한다." },
      { num: "06", element: "생성 회의 회의록 정리", description: "정리 중인 생성 회의에서 안건별 논의, 결정 또는 없음, 후속 업무 카드 생성 또는 없음을 입력한다. 후속 업무 카드는 실제 상시 업무로 생성되어 내 업무·캘린더에도 반영된다." },
      { num: "07", element: "생성 회의 정리 완료", description: "모든 안건이 논의·결정·후속 업무 처리 조건을 충족한 경우에만 완료로 전환한다. 완료 회의록은 안건별 최종 기록과 실제 후속 업무 카드를 읽기 전용으로 제공한다." },
      { num: "08", element: "참석·불참 요약", description: "생성자는 회의 시작과 함께 참석 처리되고, 초대된 참가자는 진행 중에 회의 참가로 참석 시각을 남긴다. 완료 회의록에서는 불참자가 핵심 요약을 확인하고 확인 시각을 남길 수 있다.", constraint: "요약 확인은 불참·참석 기록을 변경하지 않음" },
      { num: "09", element: "생성 회의 관리", description: "생성자는 예정 상태에서 참가자를 추가·제거하고 진행 권한을 부여·해제하며 안건을 추가·수정·삭제하거나 회의를 취소할 수 있다.", constraint: "시작 이후에는 관리 항목을 잠그고, 취소 회의는 목록에만 보관한다" },
    ],
    exceptions: ["회의 시작·수정·권한 관리 버튼을 일반 참가자에게 노출하지 않는다", "상세 열람은 참석 처리가 아니다", "취소된 생성 회의는 진행·정리·캘린더 표시 대상에서 제외한다"],
    nextScreens: ["OPS-MEET-01A 회의 목록"],
  },
  "OPS-MEET-03B": {
    id: "OPS-MEET-03B", name: "예정 회의 관리 — 생성자", stateChip: "예정",
    purpose: "회의 생성자가 예정 회의를 수정·취소하고 진행 권한을 관리한다.",
    users: "회의 생성자",
    entryPath: "회의 목록 → 예정 회의(내가 만든 회의)",
    functions: [
      { num: "01", element: "회의 정보 수정", description: "OPS-MEET-02로 이동해 정보를 수정한다." },
      { num: "02", element: "진행 권한 관리", description: "OPS-MEET-04B로 이동한다.", constraint: "생성자만 진입 가능" },
      { num: "03", element: "회의 취소", description: "OPS-MEET-D04 취소 확인을 거쳐 취소한다.", constraint: "예정 회의만 취소 가능" },
    ],
    exceptions: ["회의 생성자가 아니면 참가자·안건·진행 권한 관리 기능을 노출하지 않는다", "회의 시작 이후에는 예정 정보와 권한 구성을 수정할 수 없다"],
    nextScreens: ["OPS-MEET-02 수정", "OPS-MEET-04B 진행 권한 관리", "OPS-MEET-D04 취소 확인"],
  },
  "OPS-MEET-03C": {
    id: "OPS-MEET-03C", name: "예정 회의 상세 — 진행 권한자", stateChip: "예정",
    purpose: "진행 권한자가 회의 시작 전 정보를 확인하고 회의를 시작한다.",
    users: "진행 권한자",
    entryPath: "회의 목록 → 예정 회의(진행 권한 보유)",
    functions: [
      { num: "01", element: "회의 시작", description: "OPS-MEET-D01 시작 확인을 거쳐 회의를 진행 중으로 전환한다." },
      { num: "02", element: "진행 권한 확인", description: "OPS-MEET-04A 읽기 전용 현황으로 이동한다.", constraint: "다른 사람의 권한은 변경할 수 없다" },
      { num: "03", element: "안건·참가 확인", description: "03A와 동일한 정보 열람." },
    ],
    exceptions: ["진행 권한이 회수되었거나 회의가 취소된 경우 시작할 수 없다", "진행 권한만으로 다른 참가자의 권한을 변경할 수 없다"],
    nextScreens: ["OPS-MEET-D01 시작 확인", "OPS-MEET-04A 진행 권한 현황"],
  },
  "OPS-MEET-04A": {
    id: "OPS-MEET-04A", name: "진행 권한 현황 — 읽기 전용", stateChip: "읽기 전용",
    purpose: "이 회의의 진행 권한 보유자를 확인한다.",
    users: "진행 권한자",
    entryPath: "OPS-MEET-03C → 진행 권한 확인",
    functions: [
      { num: "01", element: "권한자 목록", description: "진행 권한을 가진 참가자를 표시한다." },
      { num: "02", element: "변경 불가 안내", description: "권한 부여·해제는 회의 생성자만 가능함을 안내한다.", constraint: "부여·해제 버튼 노출 금지" },
    ],
    exceptions: ["진행 권한 현황은 읽기 전용이며 권한 부여·해제 버튼을 표시하지 않는다"],
    nextScreens: ["OPS-MEET-03C 예정 상세"],
  },
  "OPS-MEET-04B": {
    id: "OPS-MEET-04B", name: "진행 권한 관리 — 회의 생성자", stateChip: "기본",
    purpose: "회의 생성자가 참가자에게 진행 권한을 부여하거나 해제한다.",
    users: "회의 생성자 (유일한 권한 관리자)",
    entryPath: "OPS-MEET-03B → 진행 권한 관리",
    functions: [
      { num: "01", element: "권한 부여", description: "참가자를 선택해 OPS-MEET-D03 확인을 거쳐 부여한다." },
      { num: "02", element: "권한 해제", description: "부여된 권한을 해제한다." },
      { num: "03", element: "생성자 표시", description: "생성자는 기본 진행 권한자로 해제 대상이 아니다." },
    ],
    exceptions: ["회의 생성자만 진행 권한을 부여하거나 해제할 수 있다", "회의 생성자의 기본 진행 권한은 해제할 수 없다"],
    nextScreens: ["OPS-MEET-D03 부여 확인", "OPS-MEET-03B 예정 회의 관리"],
  },
  "OPS-MEET-05A": {
    id: "OPS-MEET-05A", name: "진행 중 회의 — 일반 참가자", stateChip: "진행 중",
    purpose: "진행 중 회의에서 안건별 기록을 함께 작성하고 결정 의견을 남긴다.",
    users: "참가 처리된 구성원",
    entryPath: "회의 목록 → 회의 참가 / 회의로 돌아가기",
    functions: [
      { num: "01", element: "2열 구조", description: "왼쪽은 선택한 안건의 회의록 문서, 오른쪽은 전체 안건과 참가 현황." },
      { num: "02", element: "안건 전환", description: "안건 선택 시 논의 내용·결정사항·후속 업무가 함께 전환된다.", constraint: "네 영역은 안건에 귀속된 하나의 데이터 단위" },
      { num: "03", element: "논의 내용 공동 작성", description: "참가자 전원이 안건별 기록을 작성한다." },
      { num: "04", element: "결정 의견 추가", description: "의견만 제안한다. 확정·수정은 진행 권한자." },
      { num: "05", element: "참석 표시", description: "첫 참가 시각을 기록하고 참석 처리됨을 표시한다." },
    ],
    exceptions: ["회의 종료·안건 진행 버튼을 노출하지 않는다"],
    nextScreens: ["OPS-MEET-06A 정리 중 (회의 종료 시)"],
  },
  "OPS-MEET-05B": {
    id: "OPS-MEET-05B", name: "진행 중 회의 — 진행 권한자", stateChip: "진행 중",
    purpose: "진행 권한자가 안건을 진행하고 결정을 확정하며 회의를 종료한다.",
    users: "진행 권한자",
    entryPath: "회의 목록 → 진행 중 회의(권한 보유)",
    functions: [
      { num: "01", element: "회의 종료", description: "OPS-MEET-D02 확인을 거쳐 정리 중 상태로 전환한다." },
      { num: "02", element: "안건 진행", description: "이 안건 논의 완료, 다음 안건 시작으로 흐름을 제어한다." },
      { num: "03", element: "결정 확정·수정", description: "안건의 결정사항을 기록·수정한다." },
      { num: "04", element: "공동 작성·안건 전환", description: "05A와 동일." },
    ],
    exceptions: ["진행 권한이 없는 참가자에게 회의 종료와 기록 편집 기능을 노출하지 않는다", "이미 종료된 회의에 종료 처리를 중복 적용하지 않는다"],
    nextScreens: ["OPS-MEET-D02 종료 확인", "OPS-MEET-06B 회의록 정리"],
  },
  "OPS-MEET-06A": {
    id: "OPS-MEET-06A", name: "정리 중 회의 — 일반 참가자", stateChip: "정리 중",
    purpose: "회의 종료 후 정리 중 상태를 안내하고 최종 회의록 제공을 기다린다.",
    users: "참가했던 구성원",
    entryPath: "회의 종료 시 자동 전환 / 회의 목록",
    functions: [
      { num: "01", element: "정리 중 안내", description: "정리 완료 후 회의록 제공 예정임을 안내한다." },
      { num: "02", element: "기록 열람", description: "안건별 기록을 읽기 전용으로 확인한다." },
    ],
    exceptions: ["정리 중 내용은 확정본이 아니므로 편집·완료 처리 기능을 제공하지 않는다", "완료 전 변경될 수 있음을 명확히 표시한다"],
    nextScreens: ["OPS-MEET-07 완료 회의록"],
  },
  "OPS-MEET-06B": {
    id: "OPS-MEET-06B", name: "회의록 정리 — 진행 권한자", stateChip: "정리 중",
    purpose: "안건별 필수 기록을 최종 정리하고, 필요하면 AI 전체 요약을 작성해 회의를 완료 상태로 만든다.",
    users: "진행 권한자",
    entryPath: "회의 종료 → 회의록 정리 / 회의 목록(정리 중)",
    functions: [
      { num: "01", element: "안건별 결정 정리", description: "오른쪽 패널에서 안건을 선택해 결정과 후속 업무를 확정한다.", constraint: "없으면 '결정사항 없음'·'후속 업무 없음'을 명시" },
      { num: "02", element: "AI 전체 요약", description: "버튼으로 초안 생성 → 'AI 생성 초안·검토 필요' → 원본 변경 시 오래됨 경고(다시 생성/직접 검토) → 최종 확인(검토자·시각 기록).", constraint: "최종 승인 기능. 기록에 없는 결정·담당자·기한을 만들지 않음. 실패 시 수동 작성. 요약 미작성은 정리 완료를 막지 않음" },
      { num: "03", element: "정리 완료 조건", description: "논의 내용, 결정사항 또는 없음, 후속 업무 또는 없음, 참가 결과의 필수 4개 조건과 선택 조건인 전체 요약을 분리해 표시한다." },
      { num: "04", element: "정리 완료", description: "본문 진행 카드에서 남은 안건과 완료 조건을 확인하고, 필수 4개 조건이 모두 충족된 경우에만 완료 확인을 거쳐 활성화한다. 완료 시 참석자에게 회의록을 제공하고 불참자에게 요약 확인을 요청한다.", constraint: "AI 전체 요약은 선택 사항" },
      { num: "05", element: "후속 업무 카드 생성", description: "안건별 업무명·담당자·마감일을 확정해 상시 업무 카드로 만든다. 카드가 생성되어야 후속 업무 정리가 완료되며, 생성 결과는 내 업무·캘린더에도 즉시 반영된다." },
    ],
    exceptions: ["모든 안건에 결정사항 또는 없음, 후속 업무 또는 없음이 없으면 정리 완료할 수 없다", "AI 요약 생성 실패 시 수동 작성할 수 있으며 전체 요약 미작성은 정리 완료를 막지 않는다"],
    nextScreens: ["OPS-MEET-07 완료 회의록"],
  },
  "OPS-MEET-07": {
    id: "OPS-MEET-07", name: "완료 회의록 — 참석자", stateChip: "완료",
    purpose: "완료된 회의의 안건별 최종 회의록을 열람한다.",
    users: "참석자",
    entryPath: "회의 목록 → 회의록 보기 / 기록 관련 화면",
    functions: [
      { num: "01", element: "안건별 회의록", description: "논의 내용과 결정사항, 회의록 정리에서 생성된 실제 후속 업무 카드를 최종본으로 표시한다." },
      { num: "02", element: "후속 업무 열기", description: "안건에 연결된 후속 업무를 선택해 상시 업무 보드의 원래 카드와 상세 패널을 연다." },
      { num: "03", element: "참석 결과", description: "참석·불참 기록을 표시한다." },
      { num: "04", element: "후속 업무 진행 현황", description: "회의에서 생성된 후속 업무의 완료 수와 지연·검토 필요·미배정 업무를 실제 업무 카드 상태로 요약하고, 확인이 필요한 카드를 바로 연다." },
    ],
    exceptions: ["회의록 열람은 참석 처리와 무관하다"],
  },
  "OPS-MEET-08": {
    id: "OPS-MEET-08", name: "회의 요약 확인 — 불참자", stateChip: "완료",
    purpose: "불참자가 회의 전체 요약과 결정사항을 확인한다.",
    users: "불참자",
    entryPath: "회의 목록 → 회의 요약 확인",
    functions: [
      { num: "01", element: "전체 요약", description: "정리 단계에서 확정된 회의 전체 요약을 표시한다." },
      { num: "02", element: "결정·후속 확인", description: "안건별 결정사항과 실제 생성된 후속 업무를 확인한다." },
      { num: "03", element: "내 후속 업무 열기", description: "현재 사용자에게 배정된 미완료 후속 업무만 모아 표시하고, 선택하면 상시 업무 보드의 원래 카드와 상세 패널을 연다." },
      { num: "04", element: "후속 업무 진행 현황", description: "회의에서 생성된 후속 업무의 최신 완료·확인 필요 상태를 실제 업무 카드 기준으로 확인한다." },
      { num: "05", element: "요약 확인 완료", description: "불참자가 핵심 결정과 본인 후속 업무를 확인한 뒤 확인 시각을 남긴다. 확인 기록은 참석·불참 상태를 변경하지 않는다." },
    ],
    exceptions: ["요약 확인 기록은 이 화면의 로컬 데모 상태로 표시한다", "요약을 확인해도 참석으로 바뀌지 않는다"],
  },
  "OPS-MEET-09": {
    id: "OPS-MEET-09", name: "취소된 회의 상세", stateChip: "취소됨",
    purpose: "취소된 회의의 정보와 취소 기록을 열람한다.",
    users: "초대되었던 구성원",
    entryPath: "회의 목록(취소됨)",
    functions: [
      { num: "01", element: "취소 안내", description: "취소 처리자와 시각, 사유를 표시한다." },
      { num: "02", element: "회의 정보", description: "취소 전 계획된 정보와 안건을 읽기 전용으로 보여준다." },
    ],
    exceptions: ["취소된 회의는 시작·수정·참가할 수 없다", "취소 전 정보와 취소 이력은 삭제하지 않고 읽기 전용으로 보존한다"],
  },
  "OPS-MEET-D01": {
    id: "OPS-MEET-D01", name: "회의 시작 확인", stateChip: "확인 대화상자",
    purpose: "회의 시작을 확인받고 진행 중 상태로 전환한다.",
    users: "진행 권한자",
    entryPath: "OPS-MEET-03C → 회의 시작",
    functions: [
      { num: "01", element: "시작 확인", description: "확인 시 회의가 진행 중이 되고 참가자에게 참가가 열린다.", constraint: "시작한 사용자는 자동 참석 처리" },
      { num: "02", element: "취소", description: "예정 상태를 유지한다." },
    ],
    exceptions: ["회의가 이미 시작·취소되었거나 진행 권한이 없으면 확인 행동을 실행하지 않는다"],
    nextScreens: ["OPS-MEET-05B 진행 중"],
  },
  "OPS-MEET-D02": {
    id: "OPS-MEET-D02", name: "회의 종료 확인", stateChip: "확인 대화상자",
    purpose: "회의 종료를 확인받고 정리 중 상태로 전환한다.",
    users: "진행 권한자",
    entryPath: "OPS-MEET-05B → 회의 종료",
    functions: [
      { num: "01", element: "종료 확인", description: "확인 시 정리 중으로 전환되고 회의록 정리가 시작된다." },
      { num: "02", element: "취소", description: "진행 중 상태를 유지한다." },
    ],
    exceptions: ["진행 권한이 없거나 이미 종료된 회의에는 종료를 중복 적용하지 않는다"],
    nextScreens: ["OPS-MEET-06B 회의록 정리"],
  },
  "OPS-MEET-D03": {
    id: "OPS-MEET-D03", name: "진행 권한 부여 확인", stateChip: "확인 대화상자",
    purpose: "선택한 참가자에게 진행 권한 부여를 확인받는다.",
    users: "회의 생성자",
    entryPath: "OPS-MEET-04B → 권한 부여",
    functions: [
      { num: "01", element: "부여 확인", description: "대상자와 부여될 권한(시작·종료·안건 진행)을 보여주고 확정한다.", constraint: "부여·해제는 생성자만 가능" },
    ],
    exceptions: ["이미 같은 권한이 있는 참가자에게 중복 부여하지 않는다", "회의 생성자가 아니면 확인 동작을 실행할 수 없다"],
    nextScreens: ["OPS-MEET-04B 진행 권한 관리"],
  },
  "OPS-MEET-D04": {
    id: "OPS-MEET-D04", name: "회의 취소 확인", stateChip: "확인 대화상자",
    purpose: "예정 회의의 취소를 확인받는다.",
    users: "회의 생성자",
    entryPath: "OPS-MEET-03B → 회의 취소",
    functions: [
      { num: "01", element: "취소 확인", description: "확인 시 회의가 취소 상태가 되고 참가자에게 안내된다.", constraint: "예정 회의만 취소 가능" },
    ],
    exceptions: ["이미 시작·완료·취소된 회의는 취소할 수 없다", "취소 시 일정 화면에서 제외되며 기존 기록은 삭제하지 않는다"],
    nextScreens: ["OPS-MEET-09 취소된 회의 상세"],
  },
  // ─── 2차 정의서 (2026-07-19 작성) ───────────────────────────────────────────
  "HOME-01": {
    id: "HOME-01", name: "홈 — 학생회 운영 현황", stateChip: "기본",
    purpose: "학생회 전체 운영 현황을 한 화면에서 요약해 보여준다.",
    users: "전 구성원",
    entryPath: "사이드바 홈",
    functions: [
      { num: "01", element: "요약 카드", description: "진행 중 행사, 예정 행사, 이번 주 주요 일정, 행사 업무의 지연·담당자 미지정 건수를 계산해 표시하고 대상 화면으로 이동한다." },
      { num: "02", element: "진행 중·예정 행사", description: "행사별 준비율과 행사 업무의 지연·담당자 없는 업무 경고를 표시하며 행사 업무로 이동한다." },
      { num: "03", element: "다가오는 주요 일정", description: "행사·상시 업무의 미완료 마감, 행사 일정, 취소되지 않은 생성 회의를 날짜순으로 표시한다. 이번 주 주요 일정 수치도 같은 데이터에서 계산하며, 일정 행을 누르면 통합 캘린더가 해당 월·날짜와 선택한 일정을 강조해 연다." },
      { num: "04", element: "조직 주요 알림", description: "행사 업무의 지연·담당자 미지정 건수와 증빙 누락, 명단 확인 필요 건수를 표시하고 해당 필터·처리 화면으로 이동한다." },
      { num: "05", element: "전체 재정 요약", description: "예산 사용률과 승인·집행 예정, 증빙 누락을 요약한다.", constraint: "홈은 내 업무의 상위 공간이 아니다" },
      { num: "06", element: "내 담당 업무 요약", description: "행사·상시 업무에서 현재 사용자에게 배정된 미완료 업무 수를 표시하고 내 업무로 이동한다." },
    ],
    exceptions: ["연결 데이터가 없으면 임의 수치를 만들지 않고 0건·빈 상태로 표시한다", "권한이 없는 사용자의 관리 전용 바로가기를 노출하지 않는다"],
    nextScreens: ["FIN-00 전체 재정 현황", "MY-01 내 업무"],
  },
  "MY-01": {
    id: "MY-01", name: "내 업무", stateChip: "기본",
    purpose: "여러 행사와 조직 활동에서 내가 처리할 업무를 상태별로 모아 본다.",
    users: "전 구성원 (본인 업무)",
    entryPath: "사이드바 내 업무",
    functions: [
      { num: "01", element: "개인 업무 집계", description: "행사 업무와 상시 업무 중 현재 사용자에게 배정된 카드만 상태별로 합쳐 표시한다. 업무 생성, 담당자 배정, 상태 변경 결과는 즉시 반영된다." },
      { num: "02", element: "요약 칩", description: "배정된 업무를 기준으로 지연, 해야 할 업무, 검토 필요 건수를 아이콘 칩으로 표시한다." },
      { num: "03", element: "상태 탭", description: "해야 할 업무 / 진행 중인 업무 / 완료된 업무 3분류로 전환한다.", constraint: "메뉴 구조 v5 기준 (2026-07-19 재편)" },
      { num: "04", element: "마감 그룹", description: "해야 할 업무 탭 안에서 검토 필요·지연과 예정 업무를 구분해 묶는다." },
      { num: "05", element: "다음 행동 안내", description: "각 업무의 다음 행동을 회색 라벨로 표시한다.", constraint: "링크처럼 보이지 않게 중립색 사용" },
      { num: "06", element: "업무 상세 패널", description: "모든 업무 카드를 누르면 담당 부서, 상태, 마감, 다음 행동과 연결 문서를 확인하는 읽기 전용 패널이 열린다. 행사 업무는 EVT-TASK-02 상세, 상시 업무는 OPS-TASK-01 보드로 이동한다." },
      { num: "07", element: "통일된 업무 카드", description: "흰 카드에 부서별 좌측 색상선과 부서 칩을 표시하고, 상태 칩은 별도로 표시한다.", constraint: "부서 색상은 소속, 상태 색상은 긴급도·진행 상태를 의미" },
      { num: "08", element: "범위·상태 필터와 검색", description: "체육대회·상시 업무 범위, 업무 상태, 업무명·영역·부서 키워드로 목록을 즉시 좁힌다. 결과가 없으면 필터 초기화 행동을 제공한다." },
    ],
    exceptions: ["내게 배정된 업무가 없으면 다른 구성원의 업무를 대신 표시하지 않는다", "필터 결과가 없으면 빈 상태와 필터 초기화를 제공한다"],
    nextScreens: ["EVT-TASK-02 행사 업무 상세", "OPS-TASK-01 상시 업무 보드"],
  },
  "MY-REQ-01": {
    id: "MY-REQ-01", name: "내 구매 요청 — 행사 재정", stateChip: "기본",
    purpose: "이 행사에서 내가 제출한 구매 요청과 진행 상태를 확인한다.",
    users: "요청자 본인",
    entryPath: "행사 > 재정 → 내 구매 요청 (2026-07-19 위치 확정)",
    functions: [
      { num: "01", element: "상태 요약 카드", description: "현재 사용자가 제출한 요청을 기준으로 검토 대기, 보완 필요, 승인 완료, 구매 진행, 처리 완료 건수를 표시한다." },
      { num: "02", element: "요청 목록", description: "요청 번호, 제목, 요청액, 품목 수, 필요한 날짜, 상태를 표시한다. 새로 제출한 요청도 즉시 목록에 반영한다." },
      { num: "03", element: "보완하기", description: "보완 필요 요청은 FIN-SUP-01 재제출로 이동한다." },
      { num: "04", element: "새 구매 요청", description: "FIN-REQ-01 작성으로 이동한다.", constraint: "구매 요청 작성은 전 구성원 가능" },
    ],
    exceptions: ["내가 요청한 항목이 없으면 빈 상태로 표시한다", "다른 요청자의 구매 요청과 보완 내용을 노출하지 않는다"],
    nextScreens: ["FIN-SUP-01 보완 재제출", "FIN-REQ-01 구매 요청 작성", "EVT-FIN-01 행사 재정"],
  },
  "FIN-REQ-02": {
    id: "FIN-REQ-02", name: "구매 요청 상세·진행 상태", stateChip: "기본",
    purpose: "제출한 구매 요청의 품목별 상태와 처리 이력을 단계로 확인한다.",
    users: "요청자 본인, 재정부·회장단",
    entryPath: "내 구매 요청 → 상태 확인",
    functions: [
      { num: "01", element: "진행 단계", description: "요청 제출 → 재정부 검토 → 구매·발주 → 결제·증빙 → 처리 완료 단계를 표시한다." },
      { num: "02", element: "품목별 상태", description: "품목 단위로 승인·보완 필요를 구분해 표시한다.", constraint: "부분 승인 존재" },
      { num: "03", element: "처리 이력", description: "제출, 검토 시작, 보완 요청 발송 등 이력을 시간순으로 표시한다." },
    ],
    exceptions: ["요청자와 재정부 외 사용자는 민감한 구매 세부정보를 수정할 수 없다", "보완 요청 상태가 아니면 재제출 행동을 노출하지 않는다"],
    nextScreens: ["FIN-SUP-01 보완 재제출"],
  },
  "FIN-SUP-01": {
    id: "FIN-SUP-01", name: "보완 요청 확인·재제출", stateChip: "보완 요청",
    purpose: "재정부가 요청한 보완 사항을 확인하고 수정해 재제출한다.",
    users: "요청자 본인",
    entryPath: "내 업무·내 구매 요청 → 보완하기",
    functions: [
      { num: "01", element: "보완 요청 안내", description: "재정부의 보완 요청 사유를 표시한다." },
      { num: "02", element: "보완 품목 수정", description: "수량, 규격, 옵션, 첨부 파일(디자인·인쇄·견적서)을 수정한다." },
      { num: "03", element: "재제출", description: "수정본을 제출하면 재검토 대기 상태가 된다." },
    ],
    exceptions: ["필수 보완 항목이 비어 있으면 재제출할 수 없다", "재제출 후에는 기존 검토 이력을 덮어쓰지 않고 새 이력을 추가한다"],
    nextScreens: ["FIN-REQ-02 진행 상태"],
  },
  "FIN-PROC-01": {
    id: "FIN-PROC-01", name: "구매·발주 처리", stateChip: "구매 필요",
    purpose: "승인된 요청의 품목을 구매처별로 발주하고 주문·배송 상태를 관리한다.",
    users: "재정부·회장단 (확정)",
    entryPath: "재정 > 구매 요청 목록 → 구매 필요 건",
    functions: [
      { num: "01", element: "구매처 그룹", description: "품목을 구매처 단위로 묶어 표시한다." },
      { num: "02", element: "주문·배송 상태", description: "주문 완료, 배송 중, 배송 예정, 품절·변경 필요 상태를 관리한다." },
      { num: "03", element: "품절·변경 처리", description: "품절 품목은 대체·변경 흐름으로 표시한다." },
    ],
    exceptions: ["승인되지 않은 품목은 구매·발주 처리할 수 없다", "재정부·회장단 외 사용자에게 구매 처리 기능을 노출하지 않는다"],
    nextScreens: ["FIN-EVID-01 결제·증빙 정리"],
  },
  "FIN-EVID-01": {
    id: "FIN-EVID-01", name: "결제·증빙 정리", stateChip: "증빙 필요",
    purpose: "결제 수단과 증빙 서류를 등록해 지출 건을 정산 완료로 만든다.",
    users: "재정부·회장단 (확정)",
    entryPath: "재정 > 구매 요청 목록 → 증빙 필요 건 / 구매 요청 화면의 증빙 관리 버튼",
    functions: [
      { num: "01", element: "결제 정보", description: "법인카드, 계좌이체 등 결제 수단과 결제자를 기록한다." },
      { num: "02", element: "증빙 등록", description: "영수증, 거래명세서, 세금계산서 등록 상태(등록 완료·누락)를 관리한다." },
      { num: "03", element: "정산 완료", description: "증빙이 갖춰지면 정산 완료 처리한다.", constraint: "감사보고서류 기능은 어떤 형태로도 추가 금지" },
    ],
    exceptions: ["결제 정보나 필수 증빙이 누락되면 정산 완료할 수 없다", "재정부·회장단 외 사용자는 증빙 상태를 변경할 수 없다"],
    nextScreens: ["FIN-LEDGER-01 사용 내역"],
  },
  "EVT-TASK-01": {
    id: "EVT-TASK-01", name: "행사 업무 — 칸반 보드", stateChip: "기본",
    purpose: "행사 참가자 전원이 행사 업무를 칸반으로 함께 관리한다.",
    users: "행사 참가자 전원 (핸드오프 확정 — 협업 공간)",
    entryPath: "행사 > 업무 탭",
    functions: [
      { num: "01", element: "행사 배너", description: "행사명, D-DAY, 전체 진행 현황을 표시한다." },
      { num: "02", element: "요약 칩", description: "지연, 검토 필요, 내 담당 건수를 표시한다." },
      { num: "03", element: "칸반 보드", description: "예정 → 진행 중 → 검토 필요 → 완료 4열로 업무를 표시한다." },
      { num: "04", element: "통일된 업무 카드", description: "흰 카드에 운영부·기획부·재정부·홍보부의 좌측 색상선과 부서 칩을 표시한다. 지연·검토 필요는 별도 상태 칩으로 표시하고 담당자 없는 업무는 빨간 경고 카드로 강조한다.", constraint: "부서 색상은 소속, 상태 색상은 긴급도·진행 상태를 의미" },
      { num: "05", element: "재정 처리 구분", description: "구매가 필요한 업무는 '재정 처리 별도' 뱃지로 재정 흐름과 구분한다." },
      { num: "06", element: "전체·내 업무 전환", description: "하단 중복 목록 없이 칸반 위 토글로 전체 업무와 내 업무만 전환한다." },
      { num: "07", element: "업무 상세 진입", description: "카드를 누르면 선택한 업무의 상세·관련 문서 화면으로 이동한다." },
      { num: "08", element: "업무 추가", description: "업무명·설명·완료 기준, 담당 부서·담당자, 마감일·초기 상태·우선순위, 결과물 유형, 연결 항목과 검토 필요 여부를 입력해 새 업무를 추가한다." },
      { num: "09", element: "개요 경고 필터", description: "개요의 담당자 없는 업무 경고에서 진입하면 해당 업무만 보드에 표시하고, 필터 해제 시 전체 목록으로 돌아간다." },
    ],
    exceptions: ["업무가 없으면 첫 업무 추가를 안내하는 빈 상태를 표시한다", "담당자가 없는 업무는 개인 업무 목록에 포함하지 않고 배정 필요로 표시한다"],
    nextScreens: ["EVT-TASK-02 업무 상세"],
  },
  "EVT-TASK-02": {
    id: "EVT-TASK-02", name: "업무 상세 — 관련 문서·결과물", stateChip: "기본",
    purpose: "업무 하나의 정보와 관련 문서·결과물을 함께 확인한다.",
    users: "행사 참가자",
    entryPath: "행사 업무 칸반 → 업무 카드",
    functions: [
      { num: "01", element: "업무 정보", description: "담당자, 담당 부서, 상태, 우선순위, 마감일과 업무 설명을 표시한다." },
      { num: "02", element: "업무 정의", description: "완료 기준, 예상 결과물, 제출 후 검토 여부와 연결된 항목을 표시한다." },
      { num: "03", element: "관련 문서·결과물", description: "사양서, 디자인 파일, 작업 노트를 상태(확정·검토 중·작성 중·제출 완료)와 함께 표시한다." },
      { num: "04", element: "담당자 배정", description: "담당자가 미지정인 경우 구성원을 선택해 배정한다. 배정 결과는 상세와 칸반 카드에 즉시 반영된다." },
      { num: "05", element: "상태 변경·완료 처리", description: "예정·진행 중·검토 필요·완료 중 다음 상태를 선택하고 처리 내용을 필수로 기록한다. 완료 처리 시 완료 열로 이동하며 처리 기록에 남는다." },
    ],
    exceptions: ["선택 업무에 결과물이 없으면 다른 업무의 문서·검토 상태를 대신 표시하지 않는다", "존재하지 않는 업무 ID로 진입하면 기본 샘플 업무로 안전하게 복귀한다"],
    nextScreens: ["EVT-TASK-01 칸반 보드"],
  },
  "EVT-FIN-01": {
    id: "EVT-FIN-01", name: "행사 재정 — 개요", stateChip: "기본",
    purpose: "이 행사 맥락의 예산 현황과 구매 요청 처리 상태를 확인한다.",
    users: "전 구성원 열람. 처리 진입은 재정부·회장단",
    entryPath: "행사 > 재정 탭",
    functions: [
      { num: "01", element: "예산 요약", description: "배정 예산, 승인·집행 예정액, 실제 지출액, 사용 가능액을 표시한다." },
      { num: "02", element: "처리 단계 보드", description: "검토 필요 → 구매 필요 → 증빙 필요 → 정산 완료 단계로 요청을 표시한다." },
      { num: "03", element: "전체 목록", description: "이 행사의 구매 요청을 표로 표시한다." },
      { num: "04", element: "내 구매 요청", description: "MY-REQ-01로 이동한다 (2026-07-19 위치 확정)." },
      { num: "05", element: "새 구매 요청", description: "FIN-REQ-01 작성으로 이동한다." },
    ],
    exceptions: ["구매 요청이 없으면 단계별 0건과 빈 상태를 표시한다", "일반 구성원은 검토 화면 대신 자신의 요청 상태 확인 화면으로 이동한다"],
    nextScreens: ["MY-REQ-01 내 구매 요청", "FIN-REQ-01 작성", "FIN-REV-01 검토"],
  },
  "EVT-MEET-01": {
    id: "EVT-MEET-01", name: "행사 관련 회의", stateChip: "기본",
    purpose: "특정 행사와 연결된 회의만 모아 현재 상태와 참여 맥락을 확인한다.",
    users: "행사 참가자 전원 (열람)",
    entryPath: "행사 워크스페이스 > 관련 회의 탭",
    functions: [
      { num: "01", element: "관련 회의 목록", description: "진행 중·예정·정리 중·완료 상태의 행사 연결 회의를 표시한다. 이 행사로 연결해 새로 만든 회의도 즉시 함께 표시한다." },
      { num: "02", element: "회의 상세 진입", description: "각 회의의 사용자 관계와 상태에 맞는 기존 회의 상세 화면으로 이동한다. 생성 회의는 해당 회의의 현재 상세 또는 완료 회의록으로 이동한다." },
      { num: "03", element: "전체 회의 보기", description: "전체 회의 목록으로 이동한다." },
    ],
    exceptions: ["회의 생성·수정 버튼은 이 화면에서 제공하지 않는다. 해당 권한은 전체 회의 공간에서 역할에 따라 판단한다."],
    nextScreens: ["OPS-MEET-01A 전체 회의", "OPS-MEET-03A 예정 회의 상세", "OPS-MEET-05A 진행 중 회의", "OPS-MEET-07 완료 회의록"],
  },
  "EVT-SCHED-01": {
    id: "EVT-SCHED-01", name: "행사 일정", stateChip: "기본",
    purpose: "행사 기본정보와 관련 회의·모집·후속 정리의 주요 시점을 행사 맥락에서 확인한다.",
    users: "행사 참가자 전원 (열람)",
    entryPath: "행사 워크스페이스 > 일정 탭",
    functions: [
      { num: "01", element: "일정 운영 보드", description: "모집 마감, 관련 회의, 행사 업무의 실제 마감일, 행사 일시, 후속 정리 시점을 담당자와 함께 날짜순으로 표시한다. 행사 업무와 이 행사에 연결한 취소되지 않은 생성 회의의 일정·상태도 즉시 반영된다." },
      { num: "02", element: "유형 필터", description: "전체·이번 주·마감·회의·행사 당일 기준으로 일정 항목을 거른다." },
      { num: "03", element: "원본·담당자 표시", description: "각 항목에 담당자와 원본 화면을 표시하고, 행사 업무 마감은 해당 업무 상세로, 생성 회의는 해당 회의 상세 또는 완료 회의록으로 이동한다.", constraint: "일정 탭은 통합 열람용이며 중복 수정하지 않음" },
      { num: "04", element: "행사 기본정보 반영", description: "행사 일시와 장소는 EVT-02B의 단일 원본을 읽어 표시한다." },
      { num: "05", element: "전체 캘린더 보기", description: "행사·회의·마감 통합 월간 캘린더로 이동한다." },
    ],
    exceptions: ["일정 생성·수정 기능은 제공하지 않는다. 행사 사실은 기본정보, 회의 일시는 관련 회의, 업무 마감은 행사 업무에서 관리한다."],
    nextScreens: ["OPS-CAL-01 캘린더", "EVT-02B 행사 기본정보", "EVT-05 참여 설문", "EVT-MEET-01 관련 회의", "EVT-TASK-02 행사 업무 상세"],
  },
  "EVT-DOC-01": {
    id: "EVT-DOC-01", name: "행사 문서", stateChip: "기본",
    purpose: "행사 전체 맥락에서 참조하는 계획서·체크리스트·명단·결과 문서의 상태를 모아 확인한다.",
    users: "행사 참가자 전원 (열람)",
    entryPath: "행사 워크스페이스 > 문서 탭",
    functions: [
      { num: "01", element: "문서 카드", description: "문서명, 분류, 작성 상태, 최근 갱신 정보를 표시한다." },
      { num: "02", element: "업무별 문서 보기", description: "문서가 귀속된 업무를 칸반에서 확인한다." },
    ],
    exceptions: ["문서 업로드·작성·검토 버튼은 이 화면에서 제공하지 않는다. 역할별 권한은 연결된 업무와 행사 운영 역할에서 판단한다."],
    nextScreens: ["EVT-TASK-01 행사 업무"],
  },
  // ─── 신규 화면 정의서 (2026-07-19) ──────────────────────────────────────────
  "OPS-00": {
    id: "OPS-00", name: "운영 홈", stateChip: "기본",
    purpose: "학생회 운영의 네 하위 공간 중 필요한 업무 영역을 선택하는 진입 허브.",
    users: "전 구성원",
    entryPath: "사이드바 운영",
    functions: [
      { num: "01", element: "상시 업무", description: "행사에 속하지 않는 반복·조직 운영 업무 칸반(OPS-TASK-01)으로 이동한다." },
      { num: "02", element: "회의", description: "현재 사용자의 회의 관계에 맞는 회의 목록으로 이동한다. 기본 진입은 일반 참가자 목록(OPS-MEET-01A)이다." },
      { num: "03", element: "행사", description: "진행 중·기획 중 행사를 확인하는 행사 목록(EVT-00A)으로 이동한다." },
      { num: "04", element: "캘린더", description: "행사·회의·마감 일정을 통합 열람하는 월간 캘린더(OPS-CAL-01)로 이동한다." },
      { num: "05", element: "운영 지표", description: "상시 업무 카드의 진행 중·검토 필요 수와 행사·상시 업무의 이번 주·다가오는 미완료 마감 수를 실제 업무 데이터에서 계산해 메뉴 카드에 표시한다." },
    ],
    exceptions: ["이 화면에서는 회의 생성, 행사 생성, 일정 생성 등 권한별 행동을 노출하지 않는다. 각 하위 공간에서 역할에 맞게 제공한다."],
    nextScreens: ["OPS-TASK-01 상시 업무", "OPS-MEET-01A 전체 회의", "EVT-00A 행사 목록", "OPS-CAL-01 캘린더"],
  },
  "OPS-TASK-01": {
    id: "OPS-TASK-01", name: "상시 업무 — 칸반 보드", stateChip: "기본",
    purpose: "행사에 속하지 않는 반복·조직 운영 업무를 부서와 함께 관리한다.",
    users: "전 구성원 (열람·업무 추가)",
    entryPath: "사이드바 운영 → 상시 업무",
    functions: [
      { num: "01", element: "요약 칩", description: "지연, 검토 필요, 내 담당 건수를 표시한다." },
      { num: "02", element: "칸반 보드", description: "예정 → 진행 중 → 검토 필요 → 완료 4열로 업무를 표시한다.", constraint: "행사 업무 칸반(EVT-TASK-01)과 동일한 열 구조" },
      { num: "03", element: "반복 주기 뱃지", description: "매주, 매월, 상시 주기를 카드에 표시한다." },
      { num: "04", element: "업무 추가", description: "업무명·설명, 담당 부서·담당자, 반복 주기·첫 마감일·초기 상태와 연결 항목을 입력해 새 상시 업무를 추가한다. 생성 직후 해당 칸반과 상세 패널에 반영한다." },
      { num: "05", element: "통일된 업무 카드", description: "흰 카드에 부서별 좌측 색상선과 부서 칩을 표시한다. 지연·검토 필요는 별도 상태 칩으로, 담당자 없는 업무는 빨간 경고 카드로 구분한다.", constraint: "부서 색상은 소속, 상태 색상은 긴급도·진행 상태를 의미" },
      { num: "06", element: "전체·내 업무 전환", description: "칸반 위 토글로 전체 업무와 현재 사용자의 업무만 전환한다." },
      { num: "07", element: "업무 상세 패널", description: "카드를 누르면 오른쪽 패널에서 업무 설명, 담당자·부서, 상태·마감일, 반복 주기와 연결 항목을 확인한다. 내 업무에서 진입한 경우에도 해당 카드의 패널을 즉시 연다. 담당자 미지정 업무에는 구성원 선택과 담당자 배정 버튼을 제공한다." },
      { num: "08", element: "상태 변경·완료 처리", description: "상세 패널에서 상태와 처리 내용을 입력해 칸반 열을 변경한다. 완료 처리 시 지연 표시를 해제하고 완료 열로 이동하며, 변경 내용과 담당자 배정은 처리 기록에 남긴다." },
    ],
    exceptions: ["상시 업무가 없으면 첫 업무 추가를 안내하는 빈 상태를 표시한다", "담당자 없는 업무는 개인 업무에 포함하지 않고 배정 필요 상태를 유지한다"],
  },
  "OPS-CAL-01": {
    id: "OPS-CAL-01", name: "캘린더 — 월간 일정", stateChip: "기본",
    purpose: "행사·회의·마감 일정을 월간으로 통합해 확인한다.",
    users: "전 구성원 (열람)",
    entryPath: "사이드바 운영 → 캘린더",
    functions: [
      { num: "01", element: "월간 그리드", description: "요일별 날짜와 행사·회의·마감 일정을 표시하고 오늘을 강조한다. 행사·상시 업무의 미완료 마감일과 생성 회의의 실제 예정 일시도 자동으로 반영하며, 이전·다음 달로 이동할 수 있다. 홈에서 선택한 일정은 해당 날짜와 안내 배너로 강조한다." },
      { num: "02", element: "유형 필터", description: "전체·행사·회의·마감으로 표시 항목을 거른다." },
      { num: "03", element: "이번 주 일정 패널", description: "이번 주 일정을 목록으로 표시하고 일정 유형에 맞는 원본 업무·회의·행사로 이동한다. 업무 마감은 원래 행사 업무 상세 또는 상시 업무 상세 패널로, 생성 회의는 해당 회의의 상세 또는 완료 회의록으로 이동한다." },
      { num: "04", element: "일정 생성 없음", description: "캘린더는 열람 전용이다.", constraint: "회의는 운영>회의, 행사 일정은 각 행사의 일정 탭에서 생성" },
    ],
    exceptions: ["일정이 없으면 빈 월간 그리드와 안내를 표시하고 임의 일정을 만들지 않는다", "취소된 회의와 완료된 업무 마감은 다가오는 일정에서 제외한다"],
  },
  "FIN-LEDGER-01": {
    id: "FIN-LEDGER-01", name: "사용 내역", stateChip: "기본",
    purpose: "학생회 예산이 언제, 어디에 사용되었는지 시간순으로 열람한다.",
    users: "전 구성원 (열람 전용 — 재정 열람은 전원 가능 확정)",
    entryPath: "사이드바 재정 → 사용 내역",
    functions: [
      { num: "01", element: "요약 카드", description: "총 지출, 월 지출, 증빙 완료, 증빙 누락을 표시한다." },
      { num: "02", element: "필터", description: "기간, 행사, 부서, 예산 항목으로 거른다." },
      { num: "03", element: "내역 테이블", description: "일자, 내역, 행사·사용처(상시 포함), 부서, 예산 항목, 금액, 증빙 상태를 표시한다." },
      { num: "04", element: "처리 버튼 없음", description: "열람 전용 화면이다.", constraint: "증빙·정산 처리는 FIN-EVID-01 담당. 감사보고서류 기능은 어떤 형태로도 추가 금지" },
    ],
    exceptions: ["사용 내역이 없거나 필터 결과가 없으면 합계 0원과 빈 상태를 표시한다", "증빙 누락을 이 화면에서 임의 완료 처리하지 않으며 감사보고서 생성 기능을 추가하지 않는다"],
  },
  "ORG-00": {
    id: "ORG-00", name: "조직 관리 홈", stateChip: "기본",
    purpose: "조직 관리의 세 영역 중 관리할 대상을 선택하는 허브.",
    users: "전 구성원",
    entryPath: "사이드바 조직 관리",
    functions: [
      { num: "01", element: "부서 & 구성원", description: "ORG-03A 조직 관리로 이동한다." },
      { num: "02", element: "학생 명단", description: "ORG-07A 학생 명단 관리로 이동한다.", constraint: "열람은 전 구성원 (2026-07-19 확정)" },
      { num: "03", element: "역할 및 권한", description: "ORG-04 열람 화면으로 이동한다." },
    ],
    exceptions: ["조직 데이터가 없으면 첫 조직 설정 안내를 표시한다", "회장단 전용 관리 행동은 일반 구성원에게 노출하지 않는다"],
    nextScreens: ["ORG-03A", "ORG-07A", "ORG-04"],
  },
  "ORG-04": {
    id: "ORG-04", name: "역할 및 권한", stateChip: "읽기 전용",
    purpose: "역할별로 사용할 수 있는 기능을 열람한다.",
    users: "전 구성원 (열람)",
    entryPath: "조직 관리 홈 → 역할 및 권한",
    functions: [
      { num: "01", element: "기본 역할 카드", description: "회장단, 부서장, 부원의 역할과 인원을 표시한다." },
      { num: "02", element: "기능 영역별 권한 표", description: "가능·조건부(재정부만 등)·불가(—)를 표시한다.", constraint: "2026-07-19 확정된 권한 매트릭스가 기준" },
      { num: "03", element: "맥락 역할 안내", description: "회의 진행 권한자·생성자, 행사 운영 조직 역할의 부여 규칙을 설명한다." },
    ],
    exceptions: ["일반 구성원은 권한 구성을 열람만 할 수 있다", "기본 역할과 회의·행사별 맥락 권한을 혼합해 표시하지 않는다"],
    nextScreens: ["ORG-04B"],
  },
  "ORG-04B": {
    id: "ORG-04B", name: "역할 및 권한 관리 — 회장단", stateChip: "회장단 전용",
    purpose: "회장단이 구성원의 기본 역할을 변경한다.",
    users: "회장단",
    entryPath: "조직 관리 → 역할 및 권한 → 권한 변경",
    functions: [
      { num: "01", element: "구성원 기본 역할 목록", description: "구성원별 현재 기본 역할과 소속 부서를 표시하고 변경 대상을 선택한다." },
      { num: "02", element: "기본 역할 선택", description: "회장단·부서장·부원 중 하나를 선택한다.", constraint: "회의 진행 권한, 회의 생성자, 행사 운영 조직 역할은 변경하지 않음" },
      { num: "03", element: "권한 변경 확인", description: "변경 전·후 역할을 확인한 뒤 반영한다. 반영 결과는 역할 카드와 구성원 목록에 즉시 표시된다." },
      { num: "04", element: "마지막 회장단 보호", description: "유일한 회장단을 다른 역할로 변경할 수 없다.", constraint: "먼저 다른 구성원에게 회장단 역할을 부여해야 함" },
    ],
    exceptions: ["회장단이 아닌 사용자는 권한 변경 화면에 진입할 수 없다", "마지막 회장단을 다른 역할로 변경하거나 같은 역할 변경을 중복 적용할 수 없다"],
  },
  "EVT-00A2": {
    id: "EVT-00A2", name: "행사 목록 — 운영진", stateChip: "기본",
    purpose: "운영진 관점의 행사 목록. 새 행사 생성으로 진입한다.",
    users: "회장단·부서장",
    entryPath: "사이드바 운영 → 행사 (운영진)",
    functions: [
      { num: "01", element: "목록·검색·필터", description: "EVT-00A와 동일한 목록 구조." },
      { num: "02", element: "새 행사 만들기", description: "EVT-00B 모달을 열어 행사 공간을 생성한다.", constraint: "회장단·부서장에게만 노출 (권한 매트릭스 2026-07-19)" },
    ],
    exceptions: ["행사 생성 권한이 없으면 새 행사 만들기 버튼을 노출하지 않는다", "검색 결과가 없을 때 기존 행사 카드를 남겨 두지 않는다"],
    nextScreens: ["EVT-00B 새 행사 만들기 모달"],
  },
  "ONB-01": {
    id: "ONB-01", name: "본인 소속 입력", stateChip: "기본",
    purpose: "내부 사용자의 개인 학적 소속을 등록한다.",
    users: "Vada에 처음 가입한 학생회 구성원",
    entryPath: "회원가입 완료 → 본인 소속 입력",
    preconditions: "로그인 또는 회원가입 완료",
    functions: [
      { num: "01", element: "진행 단계", description: "현재 온보딩 단계 1/2를 표시한다." },
      { num: "02", element: "학교 선택", description: "학교를 검색·선택한다. 캠퍼스는 학교명에 포함한다 (예: 한양대학교 ERICA)." },
      { num: "03", element: "단과대학 선택", description: "선택한 학교에 속한 단과대학만 표시한다." },
      { num: "04", element: "학부·학과 선택", description: "선택한 단과대학에 속한 학부·학과만 표시한다." },
      { num: "05", element: "직접 입력", description: "목록에 소속이 없을 때 사용자가 직접 입력한다.", constraint: "직접 입력 시 자유 텍스트 허용" },
      { num: "06", element: "학년·이름·학번", description: "학년과 이름은 필수. 학번은 선택 입력이다." },
      { num: "07", element: "다음", description: "필수값 검증 후 ONB-02로 이동한다.", constraint: "누락 시 해당 입력창에 오류 표시" },
    ],
    exceptions: ["개인 소속과 학생회 대표 범위는 별도 데이터", "목록에 없는 소속은 직접 입력 가능"],
    nextScreens: ["ONB-02 시작 방식 선택"],
  },
  "INV-00": {
    id: "INV-00", name: "초대 코드 입력", stateChip: "기본",
    purpose: "초대 코드를 입력해 참여할 학생회를 확인한다.",
    users: "초대 코드를 전달받은 신규 구성원",
    entryPath: "ONB-02 → 초대받은 학생회 참여하기",
    preconditions: "로그인 및 개인 소속 입력 완료",
    functions: [
      { num: "01", element: "코드 입력란", description: "6~8자리 영문·숫자 초대 코드를 입력한다. 붙여넣기 지원." },
      { num: "02", element: "학생회 확인 버튼", description: "코드를 검증하고 학생회를 조회한다. 성공 시 INV-01로 이동.", constraint: "비어있으면 비활성화" },
      { num: "03", element: "이전으로 버튼", description: "ONB-02로 돌아간다." },
      { num: "04", element: "오류 안내", description: "코드 오류 종류에 따라 오류 메시지를 표시한다." },
    ],
    exceptions: ["존재하지 않는 코드", "만료·재생성으로 무효화된 코드", "이미 참여한 학생회", "다른 학생회에 참여 중", "네트워크 오류"],
    nextScreens: ["INV-01 초대받은 학생회 확인"],
  },
  "ONB-02": {
    id: "ONB-02", name: "시작 방식 선택", stateChip: "기본",
    purpose: "새 학생회를 만들지, 기존 학생회에 초대 코드로 참여할지 선택한다.",
    users: "본인 소속 입력을 완료한 사용자",
    entryPath: "ONB-01 → 시작 방식 선택",
    functions: [
      { num: "01", element: "새 학생회 만들기", description: "ORG-01 새 학생회 생성으로 이동한다." },
      { num: "02", element: "초대받은 학생회 참여하기", description: "초대 링크 또는 참여 정보 확인 흐름으로 이동한다." },
      { num: "03", element: "진행 단계", description: "온보딩 2/2를 표시한다." },
    ],
    exceptions: ["초대 코드 또는 링크로 직접 접속한 경우 ONB-03을 건너뛰고 INV-01로 이동", "다른 학생회에 이미 참여 중인 경우 참여 제한 안내"],
    nextScreens: ["ORG-01 새 학생회 생성", "ONB-03 초대 코드 입력"],
  },
  "ORG-01": {
    id: "ORG-01", name: "새 학생회 생성", stateChip: "기본",
    purpose: "새 학생회의 기본 정보와 관리 범위를 설정한다.",
    users: "학생회 생성자, 학생회장",
    entryPath: "ONB-02 → 새 학생회 만들기",
    functions: [
      { num: "01", element: "학생회 유형", description: "총학생회, 단과대 학생회, 학부 학생회, 학과 학생회, 기타 중 하나를 선택한다." },
      { num: "02", element: "대표 범위", description: "유형에 따라 학교 → 단과대학 → 학부·학과를 단계적으로 선택한다.", constraint: "이후 학생 명단 관리 범위를 결정" },
      { num: "03", element: "학생회명", description: "공식 학생회 이름을 입력한다. (예: 제12대 소프트웨어융합대학 학생회)" },
      { num: "04", element: "운영 연도", description: "연도 단위 selector로 제공한다. 기본값은 현재 연도.", constraint: "기수·임기명, 시작일·종료일 입력 없음" },
      { num: "05", element: "추천값 안내", description: "개인 소속을 추천값으로만 표시하고 대표 범위로 강제하지 않는다." },
      { num: "06", element: "다음", description: "입력값을 저장하고 ORG-02 조직 구조 설정으로 이동한다." },
    ],
    exceptions: ["필수 학생회 정보가 없거나 중복된 학생회명인 경우 생성하지 않는다", "생성 취소 시 부분 입력 조직을 남기지 않는다"],
    nextScreens: ["ORG-02 조직 구조 설정"],
  },
  "ORG-02": {
    id: "ORG-02", name: "조직 구조 설정", stateChip: "기본",
    purpose: "학생회 생성 직후 회장단과 부서의 기본 구조를 만든다.",
    users: "학생회 생성자, 학생회장",
    entryPath: "ORG-01 → 조직 구조 설정",
    functions: [
      { num: "01", element: "시작 방식", description: "기본 구조, 템플릿, 빈 조직 중 하나를 선택한다." },
      { num: "02", element: "회장단 조직 카드", description: "조직도 최상단에 위치한 큰 조직 카드. 회장·부학생회장 등 복수 구성원 카드를 담는다.", constraint: "회장단 카드는 일반 부서와 동일한 카드 형태로 표현" },
      { num: "03", element: "부서 카드", description: "기획부, 홍보부, 디자인부 등 부서 구조를 표시한다. 구성원 배정은 다음 단계에서 진행." },
      { num: "04", element: "부서 추가", description: "＋ 부서 추가 버튼으로 새 부서를 만든다." },
      { num: "05", element: "부서 카드 … 메뉴", description: "각 부서 카드 우측 상단 … 버튼을 클릭하면 '부서명 수정', '부서 삭제' 메뉴가 나타난다.", constraint: "부서명 수정은 인라인 편집. Enter 저장, Esc 취소. 공백·중복 오류. 삭제는 확인 dialog 필요" },
      { num: "06", element: "조직 만들기", description: "설정한 구조를 저장하고 ORG-03 조직 관리 메인으로 이동한다." },
    ],
    exceptions: ["최소 하나의 운영 조직과 회장단 책임자를 지정하기 전에는 설정을 완료할 수 없다", "같은 구성원을 중복 책임자로 등록하지 않는다"],
    nextScreens: ["ORG-03A 조직 관리 메인"],
  },
  "INV-01": {
    id: "INV-01", name: "초대받은 학생회 확인", stateChip: "기본",
    purpose: "초대받은 학생회 정보를 확인하고 참여를 확정한다.",
    users: "초대 링크로 가입한 구성원",
    entryPath: "초대 링크 → 로그인·가입 → 본인 소속 입력 → 초대 확인",
    functions: [
      { num: "01", element: "학생회 정보", description: "학생회명, 유형, 대표 범위, 임기를 표시한다." },
      { num: "02", element: "개인 소속", description: "사용자의 현재 개인 소속 정보를 표시한다." },
      { num: "03", element: "개인 소속 수정", description: "잘못된 개인 소속 정보를 수정할 수 있다." },
      { num: "04", element: "학생회 참여하기", description: "미배정 구성원으로 추가하고 학생회 홈으로 이동한다." },
    ],
    exceptions: ["만료·사용 완료·잘못된 초대는 참여할 수 없다", "소속 부서가 미배정이면 임의 부서에 자동 배치하지 않는다"],
    nextScreens: ["ORG-03A 조직 관리 메인 (미배정 상태)"],
  },
  "ORG-03A": {
    id: "ORG-03A", name: "조직 관리 메인 — 보기 모드", stateChip: "기본",
    purpose: "학생회 전체 조직과 구성원의 현재 배치 상태를 확인한다.",
    users: "학생회장, 조직 관리자, 권한이 있는 구성원",
    entryPath: "사이드바 조직 관리 → 부서 및 구성원",
    functions: [
      { num: "01", element: "회장단 카드", description: "조직도 최상단에 위치. 회장·부학생회장 등 여러 구성원 카드를 포함. 클릭 시 상세 팝오버." },
      { num: "02", element: "부서 카드", description: "부서장, 부원 수, 구성원 카드를 표시. 부서장 없으면 ＋ 부서장 지정 표시." },
      { num: "03", element: "구성원 카드", description: "이름, 학부·학과, 학년 표시. 클릭 시 상세 팝오버 열림.", constraint: "팝오버에서 부서 이동 가능" },
      { num: "04", element: "미배정 구성원 패널", description: "부서 없는 구성원을 검색·확인. 같은 구성원 카드 형식 사용." },
      { num: "05", element: "수정 버튼", description: "같은 화면을 수정 모드(ORG-03B)로 전환한다." },
      { num: "06", element: "구성원 초대 버튼", description: "오른쪽 패널을 초대 링크 UI(ORG-03C)로 전환. 별도 페이지 이동 없음." },
    ],
    exceptions: ["조직 정보가 없으면 빈 상태와 설정 진입을 제공한다", "편집 권한이 없는 구성원에게 수정·초대 행동을 노출하지 않는다"],
    nextScreens: ["ORG-03B 수정 모드", "ORG-03C 초대 패널"],
  },
  "ORG-03B": {
    id: "ORG-03B", name: "조직 관리 메인 — 수정 모드", stateChip: "수정 모드",
    purpose: "구성원과 부서 구조를 같은 화면에서 수정한다.",
    users: "학생회장, 조직 관리자",
    entryPath: "ORG-03A → 수정 버튼",
    functions: [
      { num: "01", element: "완료 버튼", description: "수정 내용을 저장하고 보기 모드(ORG-03A)로 복귀." },
      { num: "02", element: "구성원 드래그", description: "미배정 구성원 ↔ 부서 사이 드래그로 구성원을 이동한다.", constraint: "드래그 중에도 카드 크기·형태 유지" },
      { num: "03", element: "구성원 제거 (－)", description: "카드의 － 클릭 시 확인 dialog. 제거 시 미배정으로 이동하며 실행 취소 toast 제공." },
      { num: "04", element: "부서 추가·수정·삭제", description: "별도 페이지 없이 현재 조직도에서 처리한다." },
      { num: "05", element: "부서장 지정", description: "구성원을 부서장으로 임명 전 확인 dialog 표시." },
      { num: "06", element: "회장단 수정", description: "회장단 카드 내부에서도 구성원 추가·이동·제거 가능. 회장·부학생회장 역할 구분 유지." },
    ],
    exceptions: ["마지막 회장단 또는 필수 조직 단위를 삭제할 수 없다", "저장하지 않고 나가면 변경 내용을 조직도에 반영하지 않는다"],
    nextScreens: ["ORG-03A 보기 모드 (완료)"],
  },
  "ORG-03C": {
    id: "ORG-03C", name: "구성원 초대 패널", stateChip: "패널 열림",
    purpose: "학생회 공용 초대 링크를 관리한다.",
    users: "학생회장, 조직 관리자",
    entryPath: "ORG-03A → 구성원 초대 버튼",
    functions: [
      { num: "01", element: "초대 링크", description: "현재 학생회의 공용 초대 링크를 표시한다." },
      { num: "02", element: "짧은 초대 코드", description: "링크와 동일한 초대 권한을 짧은 코드 형식으로 제공한다. (예: AB12CD34)" },
      { num: "03", element: "링크 복사", description: "초대 링크를 클립보드에 복사하고 완료 toast 표시." },
      { num: "04", element: "코드 복사", description: "초대 코드를 클립보드에 복사하고 완료 toast 표시." },
      { num: "05", element: "초대 정보 재생성", description: "기존 링크·코드 즉시 무효화 확인 dialog 후 새 링크·코드를 동시 생성.", constraint: "링크와 코드는 동일한 초대 권한. 재생성 시 둘 다 무효화" },
      { num: "06", element: "뒤로가기", description: "미배정 구성원 패널로 복귀한다." },
    ],
    exceptions: ["초대받아 가입한 구성원은 미배정으로 자동 추가", "링크·코드는 별도 초대 권한이 아닌 동일한 권한의 두 가지 형식"],
    nextScreens: ["ORG-03A 보기 모드"],
  },
  "ORG-07A": {
    id: "ORG-07A", name: "학생 명단 관리", stateChip: "기본",
    purpose: "업로드한 전체 학생 명단을 관리하고 행사 신청자 대조의 기준 데이터로 사용한다.",
    users: "학생회장, 관리자",
    entryPath: "사이드바 조직 관리 → 학생 명단",
    functions: [
      { num: "01", element: "관리 범위 안내", description: "대표 범위를 고정 정보로 표시. 이 화면에서 범위 변경 불가.", constraint: "범위 변경은 조직 설정에서만 가능" },
      { num: "02", element: "학생 명단 업로드·갱신", description: "중앙 modal에서 양식 다운로드 → 파일 업로드 → 검증 → 반영을 처리한다." },
      { num: "03", element: "명단 내보내기", description: "현재 필터와 관리 범위에 맞는 명단을 파일로 내보낸다." },
      { num: "04", element: "검색·필터", description: "이름·학번 검색, 단과대학, 학부·학과, 학년, 학생회비 납부 여부 필터를 제공한다." },
      { num: "05", element: "학생 명단 표", description: "이름, 학번, 단과대학, 학부·학과, 학년, 학생회비 상태를 열로 표시한다." },
      { num: "06", element: "학생회비 상태 chip", description: "납부 / 미납 두 가지 기본 상태. 정상 판단 불가 시에만 확인 필요 사용." },
      { num: "07", element: "행사 설문 연결", description: "참여 설문의 학번을 이 명단과 대조해 참가비를 자동 결정한다. 이 명단이 기준 데이터다." },
    ],
    exceptions: ["학번 일치·이름 불일치 → 확인 필요", "대표 범위 밖 학생은 업로드 파일 검증 오류로 처리"],
    nextScreens: ["ORG-07B 학생 명단 업로드·갱신 모달"],
  },
  "ORG-07B": {
    id: "ORG-07B", name: "학생 명단 업로드·갱신 모달", stateChip: "모달 열림",
    purpose: "전체 학생 명단 파일을 업로드해 기준 명단 데이터를 갱신한다.",
    users: "학생회장, 관리자",
    entryPath: "ORG-07A → 학생 명단 업로드·갱신",
    functions: [
      { num: "01", element: "양식 다운로드", description: "현재 관리 범위에 맞는 명단 양식을 내려받는다. (이름·학번·단과대학·학부·학과·학년·학생회비 납부 여부 포함)" },
      { num: "02", element: "파일 업로드", description: "드래그 앤 드롭 또는 파일 선택으로 .xlsx 파일을 업로드한다." },
      { num: "03", element: "파일 검증", description: "필수 열 누락·이름·학번 누락·학번 형식 오류·중복 학번·대표 범위 밖 학생·상태값 오류를 확인한다.", constraint: "오류 있으면 오류 항목과 수정 방법만 표시. 명단 비교 화면 없음" },
      { num: "04", element: "명단 반영", description: "오류가 없으면 바로 반영. 재업로드 시 학번 기준으로 최신 상태를 갱신.", constraint: "행사 참가자와 과거 행사 기록은 삭제하지 않음" },
    ],
    exceptions: ["기존 명단과의 추가·변경·제외 비교 화면 없음", "학생회비 파일 별도 업로드 흐름 없음"],
    nextScreens: ["ORG-07A 학생 명단 관리"],
  },
  "EVT-00A": {
    id: "EVT-00A", name: "행사 목록 — 일반 구성원", stateChip: "기본",
    purpose: "현재 기획 중이거나 운영 및 후속 정리가 진행 중인 행사를 한곳에서 확인한다. 완료된 행사는 기록 > 완료된 행사에서 확인한다.",
    users: "학생회장, 행사 책임자, 행사 운영진",
    entryPath: "사이드바 운영 → 행사",
    preconditions: "로그인 및 학생회 참여 완료",
    functions: [
      { num: "01", element: "새 행사 만들기", description: "EVT-00B 새 행사 만들기 모달을 열고 행사 공간을 생성한다. 생성 직후 상태는 기획 중. 권한 매트릭스에 따라 회장단·부서장 화면(EVT-00A2)에서만 노출된다." },
      { num: "02", element: "완료된 행사 보기 링크", description: "기록 > 완료된 행사(REC-01)로 이동한다.", constraint: "완료 필터를 이 화면에 두지 않음" },
      { num: "03", element: "행사 검색", description: "행사명 또는 가칭으로 목록을 검색한다." },
      { num: "04", element: "상태 필터", description: "전체 / 기획 중 / 진행 중 / 후속 정리 중 필터를 제공한다.", constraint: "완료 필터 없음. 상태는 관리자가 수동으로 변경하며 자동 계산하지 않음" },
      { num: "05", element: "행사 카드", description: "행사명, 상태 배지, 일시, 장소, 담당 부서/담당자, 마지막 수정 시각, 후속 정리 중이면 남은 항목 요약을 표시한다. 미정 정보는 미정으로 표시한다. 전체 진행률 퍼센트는 표시하지 않는다." },
      { num: "06", element: "행사 진입", description: "행사 카드를 클릭하면 해당 행사의 EVT-02 행사 개요로 이동한다." },
      { num: "07", element: "행사 더보기", description: "카드 우측 상단 … 버튼으로 행사 정보 수정, 보관, 삭제 action을 제공한다. 삭제는 확인 dialog를 거친다." },
      { num: "08", element: "빈 상태", description: "행사가 없으면 행사명만으로 공간을 생성할 수 있음을 안내하고 첫 행사 만들기 버튼을 제공한다." },
    ],
    exceptions: ["등록된 행사 없음 — 빈 상태", "검색 결과 없음 — 검색 빈 상태와 필터 초기화", "행사 삭제 확인 dialog", "일시·장소 미정 — 미정 텍스트 표시"],
    nextScreens: ["EVT-00B 새 행사 만들기 모달", "EVT-02 행사 개요 대시보드", "REC-01 완료된 행사 목록"],
  },
  "EVT-00B": {
    id: "EVT-00B", name: "새 행사 만들기 모달", stateChip: "모달 열림",
    purpose: "행사명만 입력해 행사 공간을 즉시 생성한다. 생성 직후 상태는 기획 중이며 나머지 정보는 이후 채운다.",
    users: "학생회장, 행사 기획자",
    entryPath: "EVT-00A 행사 목록 → 새 행사 만들기",
    preconditions: "행사 생성 권한",
    functions: [
      { num: "01", element: "행사명 입력", description: "행사명 또는 가칭을 입력한다. 유일한 필수 입력값. 일시·장소·참가비·운영 조직은 입력 강제 없음." },
      { num: "02", element: "행사 만들기 버튼", description: "행사 공간을 기획 중 상태로 생성하고 EVT-02로 이동한다. 생성자는 임시 행사 담당자로 자동 설정. 미입력 정보는 대시보드에서 미정으로 표시." },
      { num: "03", element: "취소 버튼", description: "모달을 닫고 EVT-00A 행사 목록으로 복귀한다." },
    ],
    exceptions: ["행사명 누락 시 입력란 오류 표시", "일시·장소·참가비·운영 조직 입력 강제 없음"],
    nextScreens: ["취소 → EVT-00A 행사 목록", "행사 만들기 → EVT-02 행사 개요 대시보드 (기획 중 상태)"],
  },
  "EVT-01": {
    id: "EVT-01", name: "행사 운영 조직 설정", stateChip: "기본",
    purpose: "행사별로 실제 운영에 참여하는 책임자·팀·구성원을 설정한다. 행사 생성 필수 단계가 아닌 선택적 설정 화면이다.",
    users: "행사 책임자, 학생회장",
    entryPath: "행사 > 인원 관리 > 운영 조직 빈 상태(EVT-03C) → 운영 조직 구성하기 (2026-07-19 흐름 확정 — 행사 생성 직후 필수 단계가 아님)",
    functions: [
      { num: "01", element: "시작 방식", description: "기본 조직 불러오기, 참여 부서만 선택, 빈 조직 중 하나를 선택한다." },
      { num: "02", element: "행사 책임자", description: "행사 전체 운영 책임자를 지정한다." },
      { num: "03", element: "참여 부서·팀", description: "행사에 참여할 부서나 임시 팀과 팀장·구성원을 배정한다." },
      { num: "04", element: "기본 조직 공유 안내", description: "행사 조직 변경은 기본 학생회 조직에 영향을 주지 않는다.", constraint: "행사 조직과 기본 조직은 별도 데이터" },
      { num: "05", element: "저장·이전", description: "저장하면 EVT-03A 운영 조직 보기로, 이전을 누르면 EVT-03C 빈 상태로 돌아간다." },
    ],
    exceptions: ["참여 부서가 하나도 없으면 빈 상태를 유지하고 임의 조직을 만들지 않는다", "같은 부서·구성원을 중복 추가하지 않는다"],
    nextScreens: ["EVT-03A 운영 조직 보기", "EVT-03C 운영 조직 빈 상태"],
  },
  "EVT-03C": {
    id: "EVT-03C", name: "운영 조직 — 빈 상태", stateChip: "빈 상태",
    purpose: "운영 조직이 아직 없는 행사에서 조직 구성의 시작점을 제공한다.",
    users: "행사 운영 조직 관리자·회장단 (구성 진입), 열람은 행사 참가자",
    entryPath: "행사 > 인원 관리 > 운영 조직 (조직 미구성 상태)",
    functions: [
      { num: "01", element: "빈 상태 안내", description: "아직 운영 조직이 구성되지 않았음을 안내한다.", constraint: "행사 조직은 기본 조직과 별개 데이터" },
      { num: "02", element: "운영 조직 구성하기", description: "EVT-01 행사 운영 조직 설정으로 이동한다." },
      { num: "03", element: "인원 관리 서브탭", description: "운영 조직 / 행사 참가자 구분을 유지한다." },
    ],
    exceptions: ["운영 조직이 없는 상태에서도 행사 기본정보와 다른 탭 열람은 막지 않는다"],
    nextScreens: ["EVT-01 행사 운영 조직 설정"],
  },
  "EVT-04C": {
    id: "EVT-04C", name: "행사 참가자 — 빈 상태", stateChip: "빈 상태",
    purpose: "참가 신청자가 없는 행사에서 모집 시작점을 제공한다.",
    users: "행사 운영 조직 (설문 생성 진입), 열람은 행사 참가자",
    entryPath: "행사 > 인원 관리 > 행사 참가자 (신청자 없음 · 설문 미생성 상태)",
    functions: [
      { num: "01", element: "빈 상태 안내", description: "아직 참가 신청자가 없음을 안내한다.", constraint: "참가자는 직접 추가하는 것이 아니라 참여 설문 신청으로 유입된다" },
      { num: "02", element: "참여 설문 만들기", description: "EVT-05 참여 설문 생성·관리로 이동한다." },
      { num: "03", element: "외부 참여 안내", description: "외부 학생은 가입 없이 모바일 웹으로 신청함을 안내한다." },
    ],
    exceptions: ["참가자가 없어도 QR 확인이나 명단 수치를 임의 생성하지 않는다", "활성 설문이 없으면 설문 생성 경로를 안내한다"],
    nextScreens: ["EVT-05 참여 설문 생성·관리"],
  },
  "EVT-02": {
    id: "EVT-02", name: "행사 개요 대시보드 — 기획 중", stateChip: "기획 중",
    purpose: "행사 데이터를 해석하고 현재 상황과 다음 행동을 보여주는 운영 판단 화면이다. 행사 상태와 권한에 따라 관리 행동을 분리한다.",
    users: "행사 참가자 전원 열람. 행사 운영 조직 관리자·회장단은 관리 행동 가능",
    entryPath: "사이드바 → 운영 → 행사 → 행사 선택 / EVT-00B 행사 만들기 완료",
    functions: [
      { num: "01", element: "행사 공통 헤더", description: "상태, 행사 업무의 지연·미배정·검토 필요 수로 계산한 건강도와 근거, 담당 부서·책임자, 행사일, 다음 미완료 업무를 행사 전 탭에서 공통 표시한다.", constraint: "건강도는 지연·담당자 없음 등 구체적 근거를 함께 표시" },
      { num: "02", element: "상태별 주요 액션 버튼", description: "기획 중: 행사 시작 / 진행 중: 행사 종료 / 후속 정리 중: 행사 완료 처리 / 완료: 버튼 없음", constraint: "행사 운영 조직 관리자·회장단에게만 노출" },
      { num: "03", element: "상황 요약 문장", description: "현재 데이터 기반 한 문장 요약. (예: 모집 마감까지 3일, 142/200명 신청, 확인 필요 6명)" },
      { num: "04", element: "행사 기본 정보 카드", description: "행사명, 일시, 장소, 참여 대상, 참가비, 모집 정원, 신청 기간, 설명. 미정 정보는 미정으로 표시." },
      { num: "05", element: "정보 입력·수정 버튼", description: "EVT-02B 행사 정보 편집 패널을 연다." },
      { num: "06", element: "우선 처리 카드", description: "실제 행사 업무의 담당자 없는 업무 수·항목과 다음 미완료 업무를, 확인 필요 참가자와 함께 최상단에 표시하고 해당 화면의 필터된 목록으로 이동한다." },
      { num: "07", element: "최근 변경 사항", description: "행사 정보 변경, 신규 신청자, 완료된 업무 등 최근 활동." },
    ],
    exceptions: ["미정 정보는 빈칸이 아닌 미정으로 표시", "일반 행사 참가자에게 행사 설정·정보 수정·상태 전환을 노출하지 않음", "취소됨 상태는 예외 상태로만 표시, 상태 변경 버튼 없음"],
    nextScreens: ["EVT-02B 행사 정보 편집 패널", "EVT-02C 행사 종료 확인 모달", "EVT-02D 후속 정리 중 대시보드", "EVT-TASK-01 담당자 없음 필터", "EVT-04 확인 필요 참가자 필터", "EVT-SCHED-01 행사 일정"],
  },
  "EVT-02C": {
    id: "EVT-02C", name: "행사 종료 확인 모달", stateChip: "모달 열림",
    purpose: "진행 중 상태에서 행사 종료를 선택하면 후속 정리 중으로 상태가 변경됨을 명확히 안내하고 확인을 받는다.",
    users: "행사 책임자, 학생회장",
    entryPath: "EVT-02 개요 대시보드 (진행 중) → 행사 종료 버튼",
    functions: [
      { num: "01", element: "안내 문구", description: "행사 운영은 종료되지만 미완료 업무와 문서를 계속 정리할 수 있음을 안내한다. 상태가 후속 정리 중으로 변경됨을 명시한다." },
      { num: "02", element: "취소 버튼", description: "모달을 닫고 EVT-02로 복귀한다." },
      { num: "03", element: "행사 종료 버튼", description: "행사 상태를 후속 정리 중으로 변경하고 EVT-02D로 이동한다." },
    ],
    exceptions: ["행사 종료 권한이 없거나 이미 종료된 행사에는 확인 동작을 실행하지 않는다", "미완료 업무가 있어도 종료를 막지 않고 후속 정리 중으로 전환한다"],
    nextScreens: ["취소 → EVT-02 행사 개요 (진행 중)", "행사 종료 → EVT-02D 후속 정리 중 대시보드"],
  },
  "EVT-02D": {
    id: "EVT-02D", name: "행사 개요 대시보드 — 후속 정리 중", stateChip: "후속 정리 중",
    purpose: "행사 운영이 종료된 후 후속 정리가 필요한 항목을 구체적으로 보여주고 완료 처리를 유도한다.",
    users: "행사 책임자, 운영진",
    entryPath: "EVT-02C 행사 종료 확인 → 행사 종료 / EVT-00A 행사 목록에서 후속 정리 중 행사 선택",
    functions: [
      { num: "01", element: "상태 배지", description: "후속 정리 중 배지를 행사명 근처에 표시한다. 주황색 계열." },
      { num: "02", element: "후속 정리 안내 영역", description: "행사는 종료되었으며 후속 정리가 진행 중임을 안내한다. 남은 업무와 기록 확인 후 완료 처리 가능." },
      { num: "03", element: "후속 정리 현황 카드", description: "미완료 업무 수, 정리되지 않은 문서 수, 미작성 회의·결정 기록 수, 확인 필요 참가자 수를 카드로 표시한다. 각 항목 클릭 시 해당 워크스페이스 메뉴로 이동." },
      { num: "04", element: "행사 완료 처리 버튼", description: "EVT-02E 완료 처리 확인 모달을 연다." },
      { num: "05", element: "기본 정보 카드", description: "행사 기본 정보를 계속 표시한다." },
      { num: "06", element: "최근 변경 사항", description: "후속 정리 진행 중 변경 활동을 표시한다." },
    ],
    exceptions: ["임의 진행률 퍼센트 표시 금지. 구체적 남은 항목 수를 표시", "후속 정리 항목이 0이어도 완료 버튼은 항상 표시"],
    nextScreens: ["EVT-02E 행사 완료 처리 확인 모달"],
  },
  "EVT-02E": {
    id: "EVT-02E", name: "행사 완료 처리 확인 모달", stateChip: "모달 열림",
    purpose: "후속 정리가 완료되었는지 확인하고 행사를 완료 상태로 변경하여 기록으로 이동시킨다. 남은 항목이 있어도 완료 처리를 강제 차단하지 않는다.",
    users: "행사 책임자, 학생회장",
    entryPath: "EVT-02D 후속 정리 중 대시보드 → 행사 완료 처리 버튼",
    functions: [
      { num: "01", element: "잔여 항목 확인", description: "남은 업무·문서·회의록 등 미완료 항목을 목록으로 표시한다. 항목이 없으면 깔끔한 완료 확인 문구를 표시한다." },
      { num: "02", element: "완료 처리 버튼", description: "항목이 없으면: 완료 처리 / 항목이 있으면: 그래도 완료 처리. 실행하면 상태를 완료로 변경하고 REC-01로 이동한다." },
      { num: "03", element: "계속 정리하기 버튼", description: "모달을 닫고 EVT-02D로 복귀한다. 항목이 있을 때만 표시." },
      { num: "04", element: "취소 버튼", description: "모달을 닫고 EVT-02D로 복귀한다." },
    ],
    exceptions: ["남은 항목 있어도 완료 처리 차단 안 함. 경고 표시 후 선택권 제공", "완료 처리 후 REC-01로 이동"],
    nextScreens: ["계속 정리하기 / 취소 → EVT-02D 후속 정리 중 대시보드", "완료 처리 → REC-01 완료된 행사 목록"],
  },
  "REC-01": {
    id: "REC-01", name: "완료된 행사 목록", stateChip: "기본",
    purpose: "완료 처리된 행사를 열람하고 기록을 확인한다. 완료된 행사는 운영 > 행사에서 제외되고 이 화면에서 관리된다.",
    users: "학생회장, 행사 책임자, 운영진",
    entryPath: "사이드바 기록 → 완료된 행사 / EVT-02E 완료 처리 완료 후",
    functions: [
      { num: "01", element: "행사 카드", description: "완료 배지, 행사명, 행사 일시, 담당 부서·책임자, 완료 처리일을 표시한다." },
      { num: "02", element: "성과 요약", description: "참석 인원(신청 대비), 예산 집행률, 완료 업무 수를 표시한다.", constraint: "발행본이 있으면 발행 시점 수치를 쓴다" },
      { num: "03", element: "아카이브 상태 배지", description: "미발행 / 초안 / 검토 중 / 발행 vN을 표시한다.", constraint: "행사 완료 상태와 별개의 축" },
      { num: "04", element: "상세 보기", description: "발행·검토 중이면 REC-02로, 미발행·초안이면 권한자에게 REC-02A 작성 화면으로 이동한다.", constraint: "일반 열람자는 미발행 안내에 머무르며 찾을 수 없는 행사 목록으로 보내지 않는다" },
      { num: "05", element: "미발행 안내", description: "인수인계 문서가 없는 행사 수를 상단에 표시한다.", constraint: "완료 처리를 되돌리거나 막지 않는다" },
      { num: "06", element: "검색·정렬", description: "행사명 검색과 완료 처리일순·행사 일시순 정렬을 제공한다." },
    ],
    exceptions: ["완료된 행사는 열람만 가능. 상태 되돌리기는 별도 권한 절차 필요", "아카이브 미발행이어도 행사 완료를 막지 않는다"],
    nextScreens: ["REC-02 행사 아카이브 상세", "REC-02A 아카이브 작성·검토"],
  },
  "REC-02": {
    id: "REC-02", name: "행사 아카이브 상세", stateChip: "발행",
    purpose: "완료된 행사의 전 과정과 인수인계 내용을 문서 형태로 열람한다.",
    users: "전 구성원 (열람 전용)",
    entryPath: "기록 > 완료된 행사 → 상세 보기",
    preconditions: "아카이브가 검토 중 또는 발행 상태",
    functions: [
      { num: "01", element: "문서 헤더", description: "행사명, 기간, 담당 부서·책임자, 상태 배지, 발행 버전·발행일·작성자·검토자를 표시한다.", constraint: "기록 신뢰성 정보를 항상 함께 노출" },
      { num: "02", element: "좌측 목차", description: "문서 옆에 고정되어 따라다니며, 대목을 누르면 본문의 해당 위치로 이동한다. 현재 읽는 대목을 강조한다.", constraint: "회고는 잘된 점·미흡했던 점·개선안을 하위 항목으로 펼친다" },
      { num: "03", element: "개요", description: "목표, 참여 대상, 일정·장소, 책임 부서·책임자, 행사 규모를 표시한다." },
      { num: "04", element: "성과", description: "계획 대비 신청·참석 인원, 만족도, 예산 계획 대비 집행을 표시한다." },
      { num: "05", element: "타임라인", description: "기획 확정, 주요 의사결정, 업무 지연, 일정 변경, 행사 진행, 종료·정산을 시간순으로 표시한다." },
      { num: "06", element: "현장 운영", description: "실제 진행 순서, 인력 배치, 돌발 상황과 대응, 운영 변경 사항을 표시한다." },
      { num: "07", element: "근거 자료", description: "업무·회의·문서·정산 요약을 표시하고 각 항목에서 원본으로 이동한다.", constraint: "수치는 발행 시점 스냅샷이며 원본 변경이 이 문서를 바꾸지 않는다" },
      { num: "08", element: "회고", description: "잘된 점, 미흡했던 점과 원인, 다음 행사 개선안을 표시한다.", constraint: "개선안은 다음 담당 부서를 함께 표시" },
      { num: "09", element: "인수인계 체크리스트", description: "우측 고정 패널에 부서별 확인 항목을 표시한다. 본문에는 재사용 자산, 협력처·담당자, 주의사항, 다음 담당자를 표시한다." },
      { num: "10", element: "아카이브 수정", description: "행사 운영 조직 관리자·회장단에게만 REC-02A로 가는 버튼을 노출한다." },
    ],
    exceptions: ["검토 중 상태에서는 확정 전 내용임을 상단에 표시한다", "발행 이력이 있는 문서는 삭제하지 않는다"],
    nextScreens: ["REC-02A 아카이브 작성·검토", "원본 화면 (업무·회의·문서·정산)"],
  },
  "REC-02A": {
    id: "REC-02A", name: "아카이브 작성·검토", stateChip: "초안",
    purpose: "행사 책임자와 회장단이 회고·인수인계 내용을 작성하고 아카이브를 발행한다.",
    users: "행사 운영 조직 관리자 · 회장단",
    entryPath: "REC-01 미발행·초안 행사 → 아카이브 작성 / REC-02 → 아카이브 수정",
    preconditions: "행사가 완료 상태",
    functions: [
      { num: "01", element: "자동 채움 영역", description: "개요·성과·타임라인·근거 자료는 행사 데이터에서 자동으로 채우며 편집하지 않는다.", constraint: "원본 수치를 사람이 고쳐 쓰지 않는다" },
      { num: "02", element: "현장 운영 작성", description: "실제 진행 순서, 인력 배치, 돌발 상황과 대응을 입력한다." },
      { num: "03", element: "회고 작성", description: "잘된 점, 미흡했던 점과 원인, 다음 행사 개선안을 각각 입력한다.", constraint: "개선안은 다음 담당 부서를 함께 지정한다" },
      { num: "04", element: "인수인계 작성", description: "재사용 자산, 협력처·담당자, 주의사항과 다음 담당자를 입력한다." },
      { num: "05", element: "발행 조건", description: "현장 운영·회고·인수인계·다음 담당자 충족 여부를 체크리스트로 표시한다.", constraint: "조건 미충족 시 발행할 수 없다" },
      { num: "06", element: "검토 요청", description: "검토자를 지정해 검토 중 상태로 전환한다." },
      { num: "07", element: "검토 의견", description: "검토자가 의견을 남긴다." },
      { num: "08", element: "발행", description: "발행 시점의 성과·타임라인·근거를 스냅샷으로 고정하고 버전을 부여한다.", constraint: "발행 후 수정은 새 버전으로 발행한다" },
      { num: "09", element: "임시 저장", description: "작성 중 내용을 초안으로 보관한다." },
      { num: "10", element: "좌측 목차", description: "열람 화면과 같은 목차를 제공하고 아직 작성하지 않은 대목을 작성 전으로 표시한다." },
    ],
    exceptions: ["행사가 완료 상태가 아니면 진입할 수 없다", "발행 이력이 있는 문서는 삭제하지 않는다"],
    nextScreens: ["REC-02 행사 아카이브 상세"],
  },
  "EVT-02B": {
    id: "EVT-02B", name: "행사 기본정보 입력·수정", stateChip: "패널 열림",
    purpose: "행사의 공통 사실 정보를 입력·수정한다. 저장된 정보는 일정·참여 설문·공지 등에 단일 원본으로 자동 반영된다. 설문 전용 설정(신청 기간, 승인제 등)은 이 화면에서 관리하지 않는다.",
    users: "행사 책임자, 편집 권한이 있는 운영진",
    entryPath: "EVT-02 개요 대시보드 → 정보 입력·수정",
    functions: [
      { num: "01", element: "행사 정보 영역", description: "행사명, 행사 소개, 행사 목적·주요 내용을 입력한다. 행사명은 행사 생성 시 입력한 값으로 미리 채운다.", constraint: "행사 기본정보에서 관리" },
      { num: "02", element: "일시 영역", description: "시작 일자·시간, 종료 일자·시간을 입력한다. 종료 시간이 미정인 경우 '종료 시간 미정' 선택 가능.", constraint: "행사 기본정보에서 관리 / 일정·참여 설문에 자동 반영" },
      { num: "03", element: "장소 영역", description: "장소명, 주소, 상세 위치·집합 장소를 입력한다. 미정이면 빈칸으로 저장 가능. 조회 화면에서 미정으로 표시.", constraint: "행사 기본정보에서 관리 / 일정·참여 설문·공지에 자동 반영" },
      { num: "04", element: "참여 정보 영역", description: "참가 대상, 참가비(무료/유료/미정), 행사 정원(제한 없음/인원 제한/미정)을 입력한다. 유료 선택 시 금액·결제 안내 입력란 노출. 인원 제한 선택 시 정원 입력란 노출.", constraint: "행사 기본정보에서 관리 / 참가비→참여 설문에 자동 반영 / 행사 정원→신청 인원 관리에 자동 반영" },
      { num: "05", element: "담당 및 안내 영역", description: "담당 부서, 담당자, 문의 방법·연락처, 참가자에게 사전 안내할 유의사항을 입력한다.", constraint: "행사 기본정보에서 관리 / 담당자·문의처→설문·참가자 안내에 자동 반영" },
      { num: "06", element: "자동 반영 힌트", description: "각 입력 항목 근처에 해당 정보가 어디에 자동 반영되는지 보조 문구로 표시한다. 예: '일정 및 참여 설문에 자동 반영'", constraint: "행사 기본정보에서 자동 반영" },
      { num: "07", element: "저장 확인 모달", description: "설문 링크가 활성화된 상태에서 행사 일시·장소·참가비 등 행사 사실이 변경된 경우, 저장 전에 변경 항목·자동 반영 화면·기존 신청자 공지 필요 여부를 확인 모달로 보여준다. 변경 자체는 차단하지 않는다.", constraint: "변경 공지 만들기 기능 제안. 링크 강제 비활성화 안 함" },
    ],
    exceptions: ["모든 항목은 비워둔 채 저장 가능. 조회 화면에서 미정으로 표시", "신청 기간·승인제·선착순·대기자 운영은 이 화면에서 관리하지 않음 → 참여 설문 설정에서 관리", "설문 문항·응답 구조 변경이 필요한 경우에는 새 설문으로 다시 만들기 흐름 제공"],
    nextScreens: ["EVT-02 행사 개요 대시보드", "EVT-05 참여 설문 (변경 내용 자동 반영)"],
  },
  "EVT-03A": {
    id: "EVT-03A", name: "인원 관리 — 운영 조직 보기", stateChip: "기본",
    purpose: "행사 운영 조직의 현재 구성을 확인한다.",
    users: "행사 운영진",
    entryPath: "행사 워크스페이스 → 인원 관리 → 운영 조직 탭",
    functions: [
      { num: "01", element: "내부 탭", description: "운영 조직과 행사 참가자를 구분하는 탭." },
      { num: "02", element: "행사 책임자 카드", description: "조직도 최상단에 책임자를 카드 형태로 표시한다." },
      { num: "03", element: "팀·부서 카드", description: "팀장과 일반 구성원을 구분해 표시한다." },
      { num: "04", element: "구성원 팝업", description: "이름, 학과, 학년, 기본 조직 소속, 행사 역할을 팝오버로 표시한다." },
      { num: "05", element: "수정 버튼", description: "같은 화면을 수정 모드(EVT-03B)로 전환한다." },
    ],
    exceptions: ["운영 조직이 비어 있으면 EVT-03C 빈 상태를 표시한다", "열람 권한만 있는 사용자는 구성원·역할을 변경할 수 없다"],
    nextScreens: ["EVT-03B 수정 모드"],
  },
  "EVT-03B": {
    id: "EVT-03B", name: "인원 관리 — 운영 조직 수정", stateChip: "수정 모드",
    purpose: "행사 운영 조직만 수정한다. 기본 학생회 조직에 영향 없음.",
    users: "행사 책임자, 학생회장",
    entryPath: "EVT-03A → 수정 버튼",
    functions: [
      { num: "01", element: "추가 가능한 구성원", description: "행사 조직에 없는 학생회 구성원을 표시. 같은 구성원 카드 형식 사용." },
      { num: "02", element: "구성원 이동", description: "팀 사이 또는 추가 가능한 영역으로 드래그한다." },
      { num: "03", element: "구성원 제거", description: "행사 조직에서만 제거. 기본 조직 영향 없음. 제거 시 추가 가능한 영역으로 복귀." },
      { num: "04", element: "팀·부서 추가", description: "＋ 팀/부서 추가로 행사 전용 팀을 만든다." },
      { num: "05", element: "행사 책임자 변경 경고", description: "현재 책임자를 바로 제거 불가. 새 책임자를 먼저 지정해야 한다.", constraint: "경고 메시지 표시" },
      { num: "06", element: "완료 버튼", description: "변경사항을 저장하고 보기 모드로 복귀한다." },
    ],
    exceptions: ["필수 책임자를 제거하거나 같은 역할에 구성원을 중복 배정할 수 없다", "취소 시 편집 내용을 저장하지 않는다"],
    nextScreens: ["EVT-03A 보기 모드"],
  },
  "EVT-04": {
    id: "EVT-04", name: "인원 관리 — 행사 참가자", stateChip: "기본",
    purpose: "행사 신청자들의 신청·입금·참석 상태를 표에서 관리한다.",
    users: "행사 운영진, 행사 책임자",
    entryPath: "행사 워크스페이스 → 인원 관리 → 행사 참가자 탭",
    functions: [
      { num: "01", element: "참가자 표", description: "이름, 학번, 소속, 신청 상태, 입금 상태, 참석 상태를 열로 표시한다. 학생 명단과 대조된 결과를 반영한다." },
      { num: "02", element: "검색·필터", description: "신청 상태, 입금 상태, 참석 상태, 학부·학과, 재응답 필요 여부로 필터링한다. 개요의 확인 필요 경고에서 진입하면 해당 대상만 표시한다." },
      { num: "03", element: "다중 선택·일괄 처리", description: "체크박스로 여러 참가자를 선택해 참석·불참·납부 확인을 일괄 적용한다." },
      { num: "04", element: "참여 설문 생성", description: "EVT-05 설문 생성 화면으로 이동한다." },
      { num: "05", element: "참석 확인 QR", description: "중앙 modal에서 QR, 활성 시간, 활성 상태를 설정한다." },
      { num: "06", element: "명단 내보내기", description: "현재 참가자 명단을 파일로 내보낸다." },
      { num: "07", element: "경고 강조 행", description: "학번·이름 불일치 또는 조건 미충족 참가자 행을 노란색으로 강조한다." },
    ],
    exceptions: [
      "행사 운영 조직이 아닌 사용자는 참가자 표를 열람만 하며 QR·내보내기 등 관리 행동을 노출하지 않음",
      "신청 상태: 신청 완료 / 대기 중 / 확인 필요 / 재응답 필요",
      "입금 상태: 납부 확인 / 미납 / 미확인",
      "참석 상태: 참석 / 불참 / 참석 미확인",
      "학번 일치 + 학생회비 납부 → 납부자 참가비 규칙 적용",
      "학번 일치 + 이름 불일치 → 확인 필요",
      "설문 교체 후 이전 응답자는 재응답 필요 상태",
    ],
    nextScreens: ["EVT-04B QR 모달", "EVT-05 참여 설문"],
  },
  "EVT-04B": {
    id: "EVT-04B", name: "참석 확인 QR 모달", stateChip: "모달 열림",
    purpose: "행사 현장에서 사용할 공용 참석 확인 QR을 관리한다.",
    users: "행사 운영진",
    entryPath: "EVT-04 → 참석 확인 QR 생성",
    functions: [
      { num: "01", element: "QR 코드", description: "참가자가 휴대폰 기본 카메라로 촬영한다. 로그인·앱 설치 불필요." },
      { num: "02", element: "활성 시간", description: "체크인 가능한 시작·종료 시각을 설정한다." },
      { num: "03", element: "활성 상태 chip", description: "현재 QR이 활성인지 비활성인지 표시한다." },
      { num: "04", element: "QR 다운로드", description: "행사장에 표시할 QR 이미지를 내려받는다." },
      { num: "05", element: "비활성화·재생성", description: "위험 작업이므로 확인 dialog를 거친다.", constraint: "재생성 시 기존 QR 즉시 무효화" },
    ],
    exceptions: ["명단 불일치·중복 참석·시간 외·비활성 QR 결과를 성공 처리하지 않는다", "모달을 닫아도 기존 참석 기록을 변경하지 않는다"],
    nextScreens: ["EVT-04 행사 참가자 (닫기)"],
  },
  "EVT-05": {
    id: "EVT-05", name: "참여 설문 생성·관리", stateChip: "기본",
    purpose: "설문 문항을 작성하고 설문 전용 모집 설정을 구성한다. 설문 링크 활성화 조건이 충족되면 공개 링크와 QR을 활성화한다. 행사 공통 정보는 EVT-02B 기본정보에서 단일 원본으로 관리하며 이 화면에서 중복 입력하지 않는다.",
    users: "행사 운영진",
    entryPath: "행사 워크스페이스 → 인원 관리 탭 → 참여 설문",
    functions: [
      { num: "01", element: "행사 기본정보 요약 영역", description: "행사명, 일시, 장소, 참가 대상, 참가비, 행사 정원, 담당자·문의처를 읽기 전용으로 표시한다. 미입력 값은 미정으로 표시. '행사 기본정보에서 수정' 버튼으로 EVT-02B로 이동하며, 돌아왔을 때 설문 작성 내용은 유지.", constraint: "행사 기본정보에서 자동 반영. 이 화면에서 중복 수정 안 함" },
      { num: "02", element: "설문 모집 설정", description: "신청 시작 일시, 신청 마감 일시, 신청 방식(선착순/관리자 승인), 정원 초과 시 대기 신청 운영 여부, 학생회비 납부 여부 대조 사용 여부를 설정한다. 행사 정원은 기본정보에서 가져옴.", constraint: "참여 설문에서 관리. 학생회비 대조 사용 시 이름·학번 식별 문항 필요 여부 검사 및 추가 유도" },
      { num: "03", element: "설문 상태 chip", description: "초안 / 활성 / 종료 / 교체됨 네 가지 상태를 표시한다." },
      { num: "04", element: "링크 활성화 조건 패널", description: "두 영역으로 구분: (A) 행사 기본정보 조건 — 행사명·일시·장소·참가 대상, 유료이면 금액·결제 안내, 정원 제한이면 정원 인원. (B) 참여 설문 설정 조건 — 신청 마감 일시, 신청 방식, 필수 문항, 개인정보 동의, 학생회비 대조 시 식별 문항. 각 미충족 항목에 누락된 정보·입력 위치·바로 이동 버튼을 표시한다.", constraint: "조건 미충족 시 링크 활성화 버튼 비활성화. 미충족 항목 수 표시. 단순 '정보 부족' 메시지 금지" },
      { num: "05", element: "설문 문항 목록", description: "이름(삭제 불가), 학번(삭제 불가), 단과대학, 학부·학과, 학년, 개인정보 동의를 기본 제공한다. 문항 추가·순서 변경·설정 가능." },
      { num: "06", element: "질문 추가", description: "단답형, 객관식, 체크박스, 개인정보 동의 유형을 추가한다." },
      { num: "07", element: "질문 설정 패널", description: "선택한 질문의 문구, 필수 여부, 선택지를 오른쪽 패널에서 수정한다." },
      { num: "08", element: "설문 링크 활성화", description: "모든 조건 충족 시 외부 설문 링크와 QR을 활성화하고 EVT-04 참가자 명단으로 이동한다. 초안 상태에서도 문항 편집 가능.", constraint: "활성 상태는 유지되므로 설문 화면으로 돌아오면 ‘링크 활성화됨’으로 표시" },
      { num: "09", element: "새 설문으로 교체", description: "응답이 1명 이상인 활성 설문에서만 표시. EVT-05B 교체 모달 진입.", constraint: "응답 0명 활성 설문은 직접 수정 허용" },
      { num: "10", element: "미리보기", description: "일반 학생이 보게 될 모바일 설문 화면을 확인한다." },
    ],
    exceptions: [
      "행사 정보가 미완성이어도 설문 초안 작성 가능. 링크 활성화 조건만 별도 판단",
      "활성화 조건 미충족 항목마다 입력 경로와 이동 버튼 제공. 단순 오류 메시지 금지",
      "설문 링크 활성화 이후 행사 기본정보(일시·장소·참가비) 변경 시: 설문 안내에 자동 반영. 기존 신청 응답 유지. 변경 공지 만들기 제안. 링크 강제 비활성화 안 함",
      "설문 문항·응답 구조 변경이 필요한 경우: 새 설문으로 교체 흐름(EVT-05B) 안내. 기존 응답 보관",
      "참여 여부 질문은 만들지 않음 (제출 자체가 신청)",
    ],
    nextScreens: ["EVT-04 행사 참가자 명단 (링크 활성화 시)", "EXT-02A 외부 참여 설문 (링크 활성화 후)", "EVT-05B 기존 설문 교체 모달", "EVT-02B 행사 기본정보 수정 (기본정보에서 수정 버튼)"],
  },
  "EVT-05B": {
    id: "EVT-05B", name: "기존 설문 교체 모달", stateChip: "모달 열림",
    purpose: "응답이 존재하는 기존 설문을 종료하고 새로운 설문으로 교체한다.",
    users: "행사 책임자, 설문 관리 권한자",
    entryPath: "EVT-05 → 새 설문으로 교체",
    functions: [
      { num: "01", element: "영향 안내", description: "현재 설문 응답자 수, 기존 설문 종료 안내, 기존 응답 보관 안내, 기존 응답자 재응답 필요 안내를 표시한다." },
      { num: "02", element: "기존 링크 안내", description: "새 설문 활성화 시 기존 링크에서 새 설문으로 이동 버튼이 표시된다는 안내." },
      { num: "03", element: "질문 복사 옵션", description: "기존 질문을 복사한 새 설문 초안으로 시작할 수 있다.", constraint: "질문만 복사. 응답 데이터는 절대 복사 안 함" },
      { num: "04", element: "교체 확인 버튼", description: "기존 설문을 교체됨 상태로 변경하고 새 설문 초안을 생성한다." },
    ],
    exceptions: ["기존 설문과 응답을 실제로 삭제하지 않음", "기존 응답자는 재응답 필요 상태로 표시됨", "새 응답은 학번으로 기존 응답자와 연결"],
    nextScreens: ["EVT-05 새 설문 초안"],
  },
  "FIN-WORK-01": {
    id: "FIN-WORK-01", name: "구매 요청 목록", stateChip: "기본",
    purpose: "학생회 전체와 각 행사의 구매 요청을 한 곳에서 확인하고 검토를 시작한다. 메뉴 구조 v5의 재정 > 구매 요청에 대응한다.",
    users: "재정부·회장단",
    entryPath: "사이드바 재정 → 구매 요청",
    functions: [
      { num: "01", element: "요약 카드", description: "검토 대기, 보완 후 재검토, 구매 기한 임박, 이번 달 정산 완료를 표시한다." },
      { num: "02", element: "필터", description: "전체, 검토 필요, 구매 필요, 증빙 필요 필터를 제공한다." },
      { num: "03", element: "요청 목록", description: "행사명(상시 지출 포함), 요청 제목, 요청액, 상태를 포함한 목록을 표시한다." },
      { num: "04", element: "항목 선택", description: "검토 항목 선택 시 FIN-REV-01로 이동한다." },
      { num: "05", element: "증빙 관리 이동", description: "증빙·정산 처리는 FIN-EVID-01 증빙 관리가 담당한다." },
    ],
    exceptions: ["요청이 없으면 첫 사용 빈 상태를 표시한다", "필터 결과가 없으면 다른 단계의 요청을 대신 표시하지 않고 초기화 경로를 제공한다"],
    nextScreens: ["FIN-REV-01 구매 요청 상세·검토", "FIN-EVID-01 결제·증빙 정리"],
  },
  "FIN-00": {
    id: "FIN-00", name: "전체 재정 현황", stateChip: "기본",
    purpose: "학생회 전체 예산과 지출 현황을 확인한다.",
    users: "모든 학생회 구성원",
    entryPath: "사이드바 → 재정",
    functions: [
      { num: "01", element: "회계 기준 정보", description: "회계 기간(2026년 1학기)과 기준일(2026.07.18)을 표시한다." },
      { num: "02", element: "재정 요약 카드", description: "총예산, 실제 지출, 지출 예정, 사용 가능 금액을 요약 표시한다." },
      { num: "03", element: "예산 집행률", description: "실제 지출과 지출 예정 포함 집행률을 진행 막대로 시각화한다." },
      { num: "04", element: "행사별·부서별 탭", description: "재정 현황을 행사별 또는 부서별로 구분하여 조회한다." },
      { num: "05", element: "재정 데이터 목록", description: "구분, 배정 예산, 실제 지출, 지출 예정, 사용 가능, 집행률을 표로 표시한다." },
    ],
    exceptions: ["재정 데이터가 없으면 금액과 집행률을 0으로 표시하고 임의 예산을 생성하지 않는다", "기준일이 오래된 경우 최신 데이터로 오해하지 않도록 기준일을 유지한다"],
    nextScreens: [],
  },
  "FIN-REQ-01": {
    id: "FIN-REQ-01", name: "구매 요청 작성·수정", stateChip: "수정 모드",
    purpose: "행사에 필요한 물품의 구매를 요청한다.",
    users: "운영진, 재정부원",
    entryPath: "FIN-01 → 새 구매 요청",
    functions: [
      { num: "01", element: "요청 정보", description: "제목, 목적, 필요일 등 기본 정보를 입력한다." },
      { num: "02", element: "품목 추가", description: "여러 품목을 한 요청에 담을 수 있다." },
      { num: "03", element: "구매 유형 선택", description: "일반 구매, 제작·인쇄, 대여·용역에 따라 입력 필드가 전환된다." },
      { num: "04", element: "제출 버튼", description: "유효성 검사를 통과하면 요청자·부서·품목·금액·이력을 포함한 검토 대기 요청을 생성하고, 내 구매 요청과 행사 재정의 검토 필요 영역에 즉시 반영한다." },
    ],
    exceptions: ["오늘 이전 필요일은 선택하거나 제출할 수 없다", "필수 요청 정보나 유효한 품목이 없으면 제출하지 않고 항목별 오류를 표시한다"],
    nextScreens: ["MY-REQ-01 내 구매 요청", "EVT-FIN-01 행사 재정"],
  },
  "FIN-REV-01": {
    id: "FIN-REV-01", name: "구매 요청 상세·검토", stateChip: "기본",
    purpose: "제출된 구매 요청을 품목별로 검토하고 승인 여부를 결정한다.",
    users: "재정부원",
    entryPath: "MY-FIN-01 또는 FIN-01 → 요청 선택",
    functions: [
      { num: "01", element: "품목 검토 표", description: "품목별 요청액, 승인액, 상태를 확인하고 결정한다." },
      { num: "02", element: "상태 변경", description: "승인, 보완 요청, 반려 중 선택 가능하다." },
      { num: "03", element: "보완 요청 모달", description: "보완 사유와 재제출 기한을 입력한다." },
      { num: "04", element: "처리 기록", description: "상태 변화 이력을 시간순으로 표시한다." },
    ],
    exceptions: ["재정부·회장단 외 사용자는 검토 결정을 변경할 수 없다", "이미 처리된 요청에 승인·반려를 중복 적용하지 않는다"],
    nextScreens: ["보완 요청 모달", "FIN-01 행사 업무"],
  },
  "EXT-02A": {
    id: "EXT-02A", name: "외부 참여 희망 조사", stateChip: "기본",
    purpose: "일반 학생이 별도 계정 없이 행사 참여를 신청한다.",
    users: "일반 학생 (행사 참가 희망자)",
    entryPath: "공유된 행사 참여 링크",
    functions: [
      { num: "01", element: "행사 안내", description: "행사명, 일시, 장소, 참가비, 모집 인원, 신청 마감, 행사 안내를 표시한다." },
      { num: "02", element: "신청자 정보", description: "이름, 학번, 단과대학·학부·학과, 학년을 입력한다." },
      { num: "03", element: "추가 질문", description: "행사별로 관리자가 추가한 질문에 응답한다." },
      { num: "04", element: "개인정보 동의", description: "필수 동의 내용을 확인한다." },
      { num: "05", element: "참여 신청하기", description: "필수값 및 중복 학번 검증 후 참가자 명단에 자동 등록한다.", constraint: "회원가입·로그인·앱 설치 불필요" },
      { num: "06", element: "신청 결과", description: "완료 화면에서 참가비 또는 관리자 확인 중 상태를 표시한다." },
    ],
    exceptions: ["모집 전", "모집 마감", "정원 마감", "링크 비활성화", "동일 학번 중복 신청"],
    nextScreens: ["EXT-02B 참여 신청 완료", "EXT-02C 예외 상태"],
  },
  "EXT-02B": {
    id: "EXT-02B", name: "참여 신청 완료", stateChip: "완료 상태",
    purpose: "신청 완료를 확인하고 참가비 결정 상태 및 문의 방법을 안내한다.",
    users: "참여 신청을 완료한 일반 학생",
    entryPath: "EXT-02A → 참여 신청하기 버튼",
    functions: [
      { num: "01", element: "완료 메시지", description: "참여 신청 완료 안내와 행사명·신청자 이름을 표시한다." },
      { num: "02", element: "참가비 상태", description: "학생회비 납부 여부에 따라 결정된 참가비 또는 관리자 확인 중 상태를 표시한다." },
      { num: "03", element: "문의 방법", description: "행사에 등록된 문의 방법을 표시한다." },
      { num: "04", element: "별도 공지 안내", description: "운영진의 별도 공지 채널 확인 안내를 표시한다." },
    ],
    exceptions: ["완료 화면을 새로고침해도 중복 신청을 생성하지 않는다", "결제·승인 확인 전에는 확정 참가비나 최종 참가 상태를 임의 표시하지 않는다"],
    nextScreens: ["없음 (최종 화면)"],
  },
  "EXT-02C": {
    id: "EXT-02C", name: "설문 예외·종료 상태", stateChip: "예외 상태",
    purpose: "설문에 접근할 수 없거나 설문이 교체된 상태를 안내한다.",
    users: "설문 링크로 접속한 일반 학생",
    entryPath: "공유된 행사 참여 링크 (예외·종료 상태)",
    functions: [
      { num: "01", element: "상태별 안내", description: "모집 전 / 모집 마감 / 정원 마감 / 링크 비활성화 / 기존 설문 종료 / 새 설문으로 교체됨 상태별 메시지를 표시한다." },
      { num: "02", element: "새 설문 이동 버튼", description: "설문이 교체된 경우에만 표시. '새로 진행 중인 참여 조사에 다시 응답해 주세요' 안내와 함께 새 설문으로 이동 버튼 제공." },
      { num: "03", element: "돌아가기", description: "이전 페이지 또는 안내 페이지로 이동한다." },
    ],
    exceptions: ["교체됨 상태: '이 참여 조사는 종료되었습니다' 메시지와 새 설문 이동 버튼 표시"],
  },
  "EXT-01A": {
    id: "EXT-01A", name: "외부 웹 참석 확인", stateChip: "기본",
    purpose: "일반 참가자가 행사장 QR을 촬영해 참석을 확인한다.",
    users: "행사 참가자",
    entryPath: "행사장 공용 QR 촬영",
    functions: [
      { num: "01", element: "행사 정보", description: "행사명과 현재 체크인 가능 시간을 표시한다." },
      { num: "02", element: "이름·학번 입력", description: "참가자 명단과 대조할 정보를 입력한다." },
      { num: "03", element: "참석 확인 버튼", description: "명단 일치 시 참석 상태를 참석으로 변경하고 체크인 시각을 저장한다.", constraint: "회원가입·로그인·앱 설치 불필요" },
    ],
    exceptions: ["QR 활성 시간 전·후", "비활성화된 QR"],
    nextScreens: ["EXT-01B 참석 확인 결과"],
  },
  "EXT-01B": {
    id: "EXT-01B", name: "참석 확인 결과", stateChip: "완료 상태",
    purpose: "참석 확인 처리 결과를 안내한다.",
    users: "행사 참가자",
    entryPath: "EXT-01A → 참석 확인 버튼",
    functions: [
      { num: "01", element: "참석 완료", description: "체크인 시각과 함께 참석 완료를 확인한다." },
    ],
    exceptions: ["참가자 명단 불일치", "이미 참석 처리됨", "승인·입금 조건 미충족", "QR 활성 시간 전·후", "비활성화된 QR"],
    nextScreens: ["없음 (최종 화면)"],
  },
};

// ─── Spec Components ─────────────────────────────────────────────────────────

function AnnotationPin({ num }: { num: string }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold shrink-0 leading-none">
      {num}
    </span>
  );
}

function SpecStateChip({ label }: { label: string }) {
  const colors: Record<string, string> = {
    "기본": "bg-gray-800 text-white",
    "수정 모드": "bg-orange-500 text-white",
    "모달 열림": "bg-purple-600 text-white",
    "패널 열림": "bg-blue-600 text-white",
    "완료 상태": "bg-green-600 text-white",
    "예외 상태": "bg-red-600 text-white",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${colors[label] ?? "bg-gray-500 text-white"}`}>
      {label}
    </span>
  );
}

function SpecPanel({ screenId }: { screenId: string }) {
  const spec = SPEC_DATA[screenId];
  if (!spec) return (
    <div className="w-[520px] shrink-0 border-l border-orange-200 bg-orange-50 flex items-center justify-center">
      <p className="text-xs text-orange-400">이 화면의 화면정의서가 없습니다.</p>
    </div>
  );

  return (
    <div className="w-[520px] shrink-0 border-l-2 border-orange-300 bg-white overflow-auto">
      {/* Header */}
      <div className="bg-orange-500 text-white px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-bold">{spec.id}</span>
          <SpecStateChip label={spec.stateChip} />
        </div>
        <p className="text-base font-semibold">{spec.name}</p>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5 text-xs">
        {/* Meta */}
        <div className="flex flex-col gap-2">
          {[
            ["화면 목적", spec.purpose],
            ["주요 사용자", spec.users],
            ["진입 경로", spec.entryPath],
            ...(spec.preconditions ? [["진입 전 조건", spec.preconditions]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-gray-400 w-20 shrink-0 font-medium">{k}</span>
              <span className="text-gray-700 flex-1">{v}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100" />

        {/* Function table */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">기능 정의</p>
          <div className="flex flex-col gap-0 border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[32px_90px_1fr] bg-gray-50 border-b border-gray-200">
              <div className="px-2 py-2 text-[10px] font-semibold text-gray-500">#</div>
              <div className="px-2 py-2 text-[10px] font-semibold text-gray-500">UI 요소</div>
              <div className="px-2 py-2 text-[10px] font-semibold text-gray-500">기능 설명 / 제약</div>
            </div>
            {spec.functions.map((fn) => (
              <div key={fn.num} className="grid grid-cols-[32px_90px_1fr] border-b border-gray-100 last:border-b-0 hover:bg-orange-50 transition-colors">
                <div className="px-2 py-2 flex items-start pt-2.5">
                  <AnnotationPin num={fn.num} />
                </div>
                <div className="px-2 py-2 text-[11px] font-medium text-gray-800 leading-relaxed">{fn.element}</div>
                <div className="px-2 py-2 text-[11px] text-gray-600 leading-relaxed">
                  {fn.description}
                  {fn.constraint && (
                    <p className="text-orange-600 mt-0.5 text-[10px]">⚠ {fn.constraint}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exceptions */}
        {spec.exceptions && spec.exceptions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">상태·예외 처리</p>
            <ul className="flex flex-col gap-1">
              {spec.exceptions.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                  <span className="text-orange-400 mt-px">•</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next screens */}
        {spec.nextScreens && spec.nextScreens.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">연결되는 다음 화면</p>
            <div className="flex flex-col gap-1">
              {spec.nextScreens.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                  <ArrowRight className="w-3 h-3 text-orange-400 shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common UX rules */}
        <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
          <p className="text-[10px] font-semibold text-orange-700 mb-1.5">공통 UX 원칙</p>
          <ul className="flex flex-col gap-1">
            {[
              "간단한 정보 확인 → 작은 popover",
              "긴 검색·선택 → 오른쪽 panel",
              "단계 있는 작업 → 중앙 modal",
              "조직 수정 → 수정 모드 (별도 페이지 없음)",
              "위험한 작업 → 확인 dialog",
              "완료 후 → toast 또는 상태 변경",
            ].map((r, i) => (
              <li key={i} className="text-[10px] text-orange-700">· {r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function Chip({ label, variant = "default" }: { label: string; variant?: "default" | "blue" | "green" | "red" | "yellow" | "gray" }) {
  const styles: Record<string, string> = {
    default: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
    green: "bg-green-50 text-green-700 border border-green-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    yellow: "bg-yellow-50 text-yellow-700 border border-yellow-200",
    gray: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium ${styles[variant]}`}>
      {label}
    </span>
  );
}

const DEPARTMENT_CARD_STYLE: Record<string, { card: string; chip: string }> = {
  "운영부": { card: "border-l-teal-500 hover:border-teal-300", chip: "bg-teal-100 text-teal-700" },
  "기획부": { card: "border-l-violet-500 hover:border-violet-300", chip: "bg-violet-100 text-violet-700" },
  "재정부": { card: "border-l-emerald-500 hover:border-emerald-300", chip: "bg-emerald-100 text-emerald-700" },
  "홍보부": { card: "border-l-pink-500 hover:border-pink-300", chip: "bg-pink-100 text-pink-700" },
};

function DepartmentChip({ dept }: { dept: string }) {
  const style = DEPARTMENT_CARD_STYLE[dept] || { card: "border-l-gray-400 bg-gray-50", chip: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium ${style.chip}`}>{dept}</span>;
}

const departmentCardClass = (dept: string) =>
  DEPARTMENT_CARD_STYLE[dept]?.card || "border-l-gray-400 hover:border-gray-300";

const taskCardClass = (dept: string, unassigned = false) =>
  `bg-white border border-gray-200 border-l-4 rounded-lg p-4 shadow-sm transition-all cursor-pointer ${unassigned ? "border-red-300 border-l-red-500 bg-red-50 hover:border-red-400" : departmentCardClass(dept)}`;

function Btn({
  children, variant = "primary", size = "sm", className = "", onClick, disabled = false
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "text" | "destructive";
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base = "inline-flex items-center gap-1.5 font-medium rounded cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none";
  const sizes: Record<string, string> = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants: Record<string, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
    text: "text-blue-600 hover:text-blue-800 px-0",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function TaskStatusDialog({ taskName, currentStatus, onClose, onSubmit }: {
  taskName: string;
  currentStatus: string;
  onClose: () => void;
  onSubmit: (status: EventTaskStatus, note: string) => void;
}) {
  const [nextStatus, setNextStatus] = useState<EventTaskStatus>(currentStatus as EventTaskStatus);
  const [note, setNote] = useState("");
  const isComplete = nextStatus === "완료";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/35 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div><h2 className="text-base font-bold text-gray-900">업무 상태 변경</h2><p className="text-xs text-gray-500 mt-1 truncate">{taskName}</p></div>
          <button type="button" onClick={onClose} aria-label="업무 상태 변경 닫기" className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-700">변경할 상태</label><select value={nextStatus} onChange={e => setNextStatus(e.target.value as EventTaskStatus)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white"><option>예정</option><option>진행 중</option><option>검토 필요</option><option>완료</option></select></div>
          <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-700">처리 내용<span className="text-red-500 ml-0.5">*</span></label><textarea value={note} onChange={e => setNote(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm h-24" placeholder={isComplete ? "완료한 결과물·공유 위치·확인 사항을 기록하세요." : "현재 진행 상황 또는 변경 사유를 기록하세요."} /></div>
          {isComplete && <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2.5 text-[11px] text-green-800"><Check className="inline w-3.5 h-3.5 mr-1.5" />완료 처리하면 칸반의 완료 열로 이동하고 처리 기록에 남습니다.</div>}
          {nextStatus === "검토 필요" && <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2.5 text-[11px] text-yellow-800"><Clock className="inline w-3.5 h-3.5 mr-1.5" />검토가 필요한 이유와 요청 내용을 처리 기록에 남깁니다.</div>}
          <div className="flex justify-end gap-2 pt-2"><Btn variant="secondary" onClick={onClose}>취소</Btn><Btn variant={isComplete ? "primary" : "primary"} onClick={() => onSubmit(nextStatus, note.trim())} disabled={!note.trim()}>{isComplete ? "완료 처리" : "상태 변경"}</Btn></div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, placeholder, type = "text", required, hint, select, selectOptions, value, defaultValue, onChange, disabled, className: extraClass }: {
  label?: string; placeholder?: string; type?: string;
  required?: boolean; hint?: string; select?: boolean; selectOptions?: string[];
  value?: string; defaultValue?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  disabled?: boolean; className?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {select ? (
        <div className="relative">
          <select
            value={value} defaultValue={defaultValue}
            onChange={onChange as React.ChangeEventHandler<HTMLSelectElement>}
            disabled={disabled}
            className={`w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 bg-white appearance-none pr-8 disabled:bg-gray-50 disabled:text-gray-400 ${extraClass || ""}`}
          >
            <option value="">{placeholder || "선택"}</option>
            {selectOptions?.map(o => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      ) : (
        <input
          type={type} placeholder={placeholder}
          value={value} defaultValue={defaultValue}
          onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
          disabled={disabled}
          className={`border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400 ${extraClass || ""}`}
        />
      )}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function MemberCard({
  name, dept, grade, role, draggable = false, removable = false, addable = false, leader = false, small = false
}: {
  name: string; dept: string; grade: string; role?: string;
  draggable?: boolean; removable?: boolean; addable?: boolean; leader?: boolean; small?: boolean;
}) {
  return (
    <div className={`relative bg-white border ${leader ? "border-blue-300 bg-blue-50" : "border-gray-200"} rounded flex flex-col ${small ? "p-2 w-24" : "p-3 w-28"} gap-1 shrink-0`}>
      {draggable && (
        <GripVertical className="absolute top-1 left-1 w-3 h-3 text-gray-300" />
      )}
      {removable && (
        <button className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center">
          <Minus className="w-2.5 h-2.5 text-white" />
        </button>
      )}
      {addable && (
        <button className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <Plus className="w-2.5 h-2.5 text-white" />
        </button>
      )}
      <div className={`w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center ${small ? "w-6 h-6" : ""}`}>
        <User className="w-4 h-4 text-gray-500" />
      </div>
      <p className="text-xs font-semibold text-gray-800 truncate">{name}</p>
      <p className="text-[10px] text-gray-500 truncate leading-tight">{dept}</p>
      <p className="text-[10px] text-gray-400">{grade}</p>
      {role && <Chip label={role} variant="blue" />}
    </div>
  );
}

function DeptCard({
  name, leader, members, editMode = false, addDept = false
}: {
  name: string; leader?: string; members: Array<{ name: string; dept: string; grade: string }>;
  editMode?: boolean; addDept?: boolean;
}) {
  if (addDept) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center gap-2 w-48 shrink-0 cursor-pointer hover:border-gray-400">
        <Plus className="w-5 h-5 text-gray-400" />
        <p className="text-sm text-gray-400 font-medium">부서 추가</p>
      </div>
    );
  }
  return (
    <div className="border border-gray-200 rounded-lg bg-white w-52 shrink-0">
      <div className="border-b border-gray-100 px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{name}</span>
        {editMode && (
          <button className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100" title="부서 메뉴">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        {leader ? (
          <div>
            <p className="text-[10px] text-gray-400 mb-1">부서장</p>
            <MemberCard name={leader} dept="컴퓨터학부" grade="3학년" leader draggable={editMode} removable={editMode} small />
          </div>
        ) : editMode ? (
          <button className="text-xs text-blue-500 hover:text-blue-700 text-left">＋ 부서장 지정</button>
        ) : (
          <div>
            <p className="text-[10px] text-gray-400 mb-1">부서장</p>
            <button className="text-xs text-blue-500 border border-dashed border-blue-300 rounded px-2 py-1">＋ 부서장 지정</button>
          </div>
        )}
        <div>
          <p className="text-[10px] text-gray-400 mb-1">부원 {members.length}명</p>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <MemberCard key={m.name} name={m.name} dept={m.dept} grade={m.grade} draggable={editMode} removable={editMode} small />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeptCardSetup({ name }: { name: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deptName, setDeptName] = useState(name);
  return (
    <div className="border border-gray-200 rounded-lg bg-white relative">
      <div className="border-b border-gray-100 px-4 py-2 flex items-center justify-between gap-6">
        {editing ? (
          <input
            autoFocus
            value={deptName}
            onChange={e => setDeptName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") setEditing(false); if (e.key === "Escape") { setDeptName(name); setEditing(false); } }}
            className="text-sm font-semibold text-gray-800 border-b border-blue-400 bg-transparent outline-none w-24"
          />
        ) : (
          <span className="text-sm font-semibold text-gray-800">{deptName}</span>
        )}
        <button className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100" onClick={() => setMenuOpen(v => !v)}>
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-2 top-8 z-20 bg-white border border-gray-200 shadow-md rounded-lg py-1 w-28">
            <button className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50" onClick={() => { setEditing(true); setMenuOpen(false); }}>부서명 수정</button>
            <button className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">부서 삭제</button>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[10px] text-gray-400 italic">구성원은 다음 단계에서 배정합니다</p>
      </div>
    </div>
  );
}

// ─── OrgBranch — T-junction connector ────────────────────────────────────────

function OrgStem({ height = "h-8" }: { height?: string }) {
  return <div className={`w-0.5 ${height} bg-gray-400`} />;
}

function OrgBranch({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  const count = items.length;
  return (
    <div className="flex">
      {items.map((child, i) => (
        <div key={i} className="flex flex-col items-center relative px-3">
          {/* Horizontal rail connecting siblings */}
          {count > 1 && (
            <div
              className={`absolute top-0 h-0.5 bg-gray-400 ${
                i === 0
                  ? "left-1/2 right-0"
                  : i === count - 1
                  ? "left-0 right-1/2"
                  : "left-0 right-0"
              }`}
            />
          )}
          {/* Vertical drop to card */}
          <div className="w-0.5 h-4 bg-gray-400" />
          {child}
        </div>
      ))}
    </div>
  );
}

// ─── Desktop Layout Shell ─────────────────────────────────────────────────────

function DesktopShell({
  children, activeSidebar = "조직 관리", breadcrumb, title, actions, tabs, activeTab, tabScreens
}: {
  children: React.ReactNode;
  activeSidebar?: string;
  breadcrumb?: string[];
  title?: string;
  actions?: React.ReactNode;
  tabs?: string[];
  activeTab?: string;
  tabScreens?: Partial<Record<string, string>>;
}) {
  const navItems = [
    { icon: Home, label: "홈", screen: "HOME-01" },
    { icon: Clipboard, label: "내 업무", screen: "MY-01" },
    { icon: Settings, label: "운영", screen: "OPS-00" },
    { icon: BarChart2, label: "재정", screen: "FIN-00" },
    { icon: FileText, label: "기록", screen: "REC-01" },
    { icon: Users, label: "조직 관리", screen: "ORG-00" },
  ];
  const { navigateTo, currentUser, activeSidebar: ctxSidebar } = React.useContext(AppContext);

  const sidebarToUse = ctxSidebar || activeSidebar;

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Vada</p>
              <p className="text-[10px] text-gray-400">소프트웨어융합대학</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2">
          {navItems.map(({ icon: Icon, label, screen }) => (
            <div
              key={label}
              onClick={() => screen && navigateTo(screen)}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm cursor-pointer mb-0.5 ${label === sidebarToUse ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700">{currentUser.name}</p>
              <p className="text-[10px] text-gray-400">{currentUser.dept} · {currentUser.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0">
          <div className="flex-1">
            {breadcrumb && (
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                {breadcrumb.map((b, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3" />}
                    <span className={i === breadcrumb.length - 1 ? "text-gray-600" : ""}>{b}</span>
                  </span>
                ))}
              </div>
            )}
            {title && <h1 className="text-base font-semibold text-gray-900">{title}</h1>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>

        {/* Tabs */}
        {tabs && (
          <div className="bg-white border-b border-gray-200 px-6 flex gap-0 shrink-0">
            {tabs.map(tab => {
              const tabScreen = tabScreens?.[tab] ?? (tabs === EVENT_TABS ? EVENT_TAB_SCREENS[tab] : undefined);
              return (
                <button
                  key={tab}
                  onClick={() => tabScreen && navigateTo(tabScreen)}
                  className={`px-4 py-3 text-sm border-b-2 -mb-px ${tabScreen ? "cursor-pointer" : "cursor-default"} ${tab === activeTab ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        )}

        {tabs === EVENT_TABS && <EventWorkspaceHeader />}

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── FIN-00 전체 재정 현황 ─────────────────────────────────────────────────────

function FIN00() {
  const summary = [
    { title: "총예산", value: "30,000,000원", desc: "이번 학기 편성 예산", icon: BarChart2, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "실제 지출", value: "12,400,000원", desc: "결제가 완료된 금액", icon: Check, color: "text-green-600", bg: "bg-green-50" },
    { title: "지출 예정", value: "3,100,000원", desc: "승인 후 결제 예정 금액", icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
    { title: "사용 가능", value: "14,500,000원", desc: "새로 사용할 수 있는 금액", icon: Info, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  const eventData = [
    { name: "체육대회", budget: 5000000, actual: 2100000, pending: 600000, available: 2300000, rate: 42 },
    { name: "신입생 환영 행사", budget: 3000000, actual: 1800000, pending: 200000, available: 1000000, rate: 60 },
    { name: "가을 축제", budget: 8000000, actual: 0, pending: 0, available: 8000000, rate: 0 },
  ];

  const recentExpenses = [
    { date: "07.17", title: "현수막 제작", target: "체육대회", amount: "180,000원", status: "증빙 완료", statusColor: "text-green-600 bg-green-50" },
    { date: "07.16", title: "생수 구매", target: "체육대회", amount: "120,000원", status: "보완 필요", statusColor: "text-yellow-700 bg-yellow-50" },
    { date: "07.15", title: "명찰 인쇄", target: "신입생 환영 행사", amount: "75,000원", status: "미등록", statusColor: "text-red-600 bg-red-50" },
  ];

  const proofStatus = [
    { label: "증빙 완료", count: "23건", color: "text-green-600" },
    { label: "보완 필요", count: "1건", color: "text-yellow-700" },
    { label: "미등록", count: "2건", color: "text-red-600" },
  ];

  return (
    <DesktopShell
      activeSidebar="재정"
      title="재정"
      actions={
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col items-end">
            <span className="text-gray-400">회계 기간</span>
            <span className="font-semibold text-gray-700">2026년 1학기</span>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex flex-col items-end">
            <span className="text-gray-400">기준일</span>
            <span className="font-semibold text-gray-700">2026.07.18 기준</span>
          </div>
        </div>
      }
    >
      <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto pb-12">
        {/* 설명 영역 */}
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-gray-900">전체 재정 현황</h2>
          <p className="text-sm text-gray-500">학생회 전체 예산과 지출 현황을 확인합니다.</p>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-4 gap-4">
          {summary.map((s) => (
            <div key={s.title} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-medium mb-1">{s.title}</p>
              <p className={`text-xl font-bold ${s.color} mb-1.5`}>{s.value}</p>
              <p className="text-[10px] text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* 예산 집행률 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">전체 예산 집행률 41%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">지출 예정 포함 52%</span>
              </div>
            </div>
          </div>
          <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden">
            {/* 실제 지출 41.3% (12.4M / 30M) */}
            <div className="absolute left-0 top-0 h-full bg-blue-600 rounded-l-full" style={{ width: "41.3%" }} />
            {/* 지출 예정 10.3% (3.1M / 30M) */}
            <div className="absolute left-[41.3%] top-0 h-full bg-blue-300" style={{ width: "10.3%" }} />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="text-[10px] text-gray-500">실제 지출</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-300" />
              <span className="text-[10px] text-gray-500">지출 예정</span>
            </div>
          </div>
        </div>

        {/* 탭 및 표 영역 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-1 flex bg-gray-50/50">
            <button className="px-5 py-3 text-sm font-semibold border-b-2 border-blue-600 text-blue-700">행사별</button>
            <button className="px-5 py-3 text-sm font-medium text-gray-400 hover:text-gray-600">부서별</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">구분</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">배정 예산</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">실제 지출</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">지출 예정</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">사용 가능</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">집행률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {eventData.map((row) => (
                  <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">{row.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 text-right font-mono">{row.budget.toLocaleString()}원</td>
                    <td className="px-5 py-4 text-sm text-gray-600 text-right font-mono">{row.actual.toLocaleString()}원</td>
                    <td className="px-5 py-4 text-sm text-gray-600 text-right font-mono">{row.pending.toLocaleString()}원</td>
                    <td className="px-5 py-4 text-sm text-blue-600 text-right font-bold font-mono">{row.available.toLocaleString()}원</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                          <div className="h-full bg-blue-500" style={{ width: `${row.rate}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-8">{row.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 최근 지출 내역 */}
          <div className="col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700">최근 지출 내역</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-400">날짜</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-400">지출 내용</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-400">행사 또는 사용처</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-400 text-right">금액</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-400 text-center">증빙 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentExpenses.map((ex, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{ex.date}</td>
                    <td className="px-5 py-3 text-xs font-medium text-gray-800">{ex.title}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{ex.target}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-900 text-right">{ex.amount}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${ex.statusColor}`}>{ex.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 증빙 현황 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700">증빙 현황</p>
            </div>
            <div className="p-5 flex flex-col gap-4 flex-1 justify-center">
              {proofStatus.map((ps) => (
                <div key={ps.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{ps.label}</span>
                  <span className={`text-sm font-bold ${ps.color}`}>{ps.count}</span>
                </div>
              ))}
              <div className="mt-2 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">전체 지출 건수</span>
                  <span className="text-sm font-bold text-gray-900">26건</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────

function HOME01() {
  const { navigateTo, setEventWorkspaceFilter, setCalendarFocus, eventTasks, recurringTasks, createdMeetings, currentUser, eventLifecycle } = React.useContext(AppContext);
  const eventDelayedCount = eventTasks.filter(task => task.delayed).length;
  const eventUnassignedCount = eventTasks.filter(task => task.assignee === "미지정").length;
  const needsAttentionCount = eventDelayedCount + eventUnassignedCount;
  const myActiveTaskCount = [...eventTasks, ...recurringTasks].filter(task => task.assignee === currentUser.name && task.status !== "완료").length;
  const today = new Date("2026-07-19T00:00:00");
  const fixedSchedule = [
    { dateValue: new Date("2026-07-20T00:00:00"), name: "체육대회 참가 신청 마감", dept: "기획부", type: "마감", focus: { month: 6, day: 20, label: "체육대회 참가 신청 마감" } },
    { dateValue: new Date("2026-07-22T00:00:00"), name: "정기 운영회의", dept: "전체", type: "회의", focus: { month: 6, day: 22, label: "정기 운영회의" } },
    { dateValue: new Date("2026-08-20T00:00:00"), name: "소프트웨어융합대학 체육대회", dept: "학술체육부", type: "행사", focus: { month: 7, day: 20, label: "소프트웨어융합대학 체육대회" } },
  ];
  const taskSchedule = [...eventTasks, ...recurringTasks]
    .filter(task => task.status !== "완료" && task.due !== "상시")
    .map(task => {
      const dateValue = new Date(`${task.due}T00:00:00`);
      return { dateValue, name: task.name, dept: task.dept, type: "마감", focus: { month: dateValue.getMonth(), day: dateValue.getDate(), label: task.name } };
    });
  const meetingSchedule = createdMeetings.filter(meeting => meeting.status !== "취소").map(meeting => {
    const [year, month, day] = meeting.time.split(" ")[0].split(".").map(Number);
    const dateValue = new Date(year, month - 1, day);
    return { dateValue, name: meeting.name, dept: meeting.group === "정기·상시 회의" ? "전체" : "행사", type: "회의", focus: { month: dateValue.getMonth(), day: dateValue.getDate(), label: meeting.name } };
  });
  const schedule = [...fixedSchedule, ...taskSchedule, ...meetingSchedule]
    .filter(item => item.dateValue >= today)
    .sort((a, b) => a.dateValue.getTime() - b.dateValue.getTime())
    .slice(0, 6)
    .map(item => ({ ...item, date: `${String(item.dateValue.getMonth() + 1).padStart(2, "0")}.${String(item.dateValue.getDate()).padStart(2, "0")}` }));
  const thisWeekScheduleCount = [...fixedSchedule, ...taskSchedule, ...meetingSchedule].filter(item => item.dateValue >= today && item.dateValue <= new Date("2026-07-25T23:59:59")).length;
  const summaryCards = [
    { label: "진행 중 행사", value: "1개", icon: Star, color: "text-blue-600", bg: "bg-blue-50", screen: "EVT-00A" },
    { label: "예정 행사", value: "2개", icon: Calendar, color: "text-indigo-600", bg: "bg-indigo-50", screen: "EVT-00A" },
    { label: "이번 주 주요 일정", value: `${thisWeekScheduleCount}개`, icon: Clock, color: "text-orange-600", bg: "bg-orange-50", screen: "OPS-CAL-01" },
    { label: "확인 필요", value: `${needsAttentionCount}건`, icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", screen: "EVT-TASK-01" },
  ];

  const events = [
    {
      name: MAIN_EVENT_NAME, status: eventLifecycle, statusVariant: LIFECYCLE_CHIP_VARIANT[eventLifecycle],
      date: "2026-08-20", place: "ERICA 체육관", dept: "학술체육부", progress: 62,
      issue: eventDelayedCount > 0 ? `지연 업무 ${eventDelayedCount}건` : eventUnassignedCount > 0 ? `담당자 없는 업무 ${eventUnassignedCount}건` : "업무 이슈 없음", issueColor: eventDelayedCount > 0 ? "text-red-500" : eventUnassignedCount > 0 ? "text-orange-500" : "text-green-600", screen: "EVT-TASK-01",
    },
    {
      name: "2026 신입생 환영 행사", status: "기획 중", statusVariant: "gray" as const,
      date: "미정", place: "미정", dept: "홍보부", progress: 18,
      issue: "", issueColor: "text-gray-400", screen: "EVT-TASK-01",
    },
  ];

  const alerts = [
    { icon: AlertCircle, color: "text-red-500 bg-red-50", label: "체육대회 지연 업무", value: `${eventDelayedCount}건`, screen: "EVT-TASK-01" },
    { icon: User, color: "text-orange-500 bg-orange-50", label: "담당자 미지정 업무", value: `${eventUnassignedCount}건`, screen: "EVT-TASK-01", filter: "unassignedTasks" as const },
    { icon: FileText, color: "text-yellow-600 bg-yellow-50", label: "증빙 서류 누락", value: "5건", screen: "EVT-FIN-01" },
    { icon: Users, color: "text-blue-500 bg-blue-50", label: "참가자 명단 확인 필요", value: "6명", screen: "EVT-04" },
  ];

  const activity = [
    { when: "오늘 10:30", desc: "체육대회 신규 신청자 5명 추가", tag: "참가자" },
    { when: "어제 16:20", desc: "체육대회 QR 참석 확인 설정 완료", tag: "참가 확인" },
    { when: "07.16", desc: "정기 운영회의 결정사항 등록", tag: "회의" },
    { when: "07.14", desc: "체육대회 장소 확정", tag: "행사 정보" },
  ];

  const typeColor = (t: string) =>
    t === "마감" ? "bg-red-50 text-red-600" : t === "회의" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600";

  return (
    <DesktopShell
      activeSidebar="홈"
      title="홈"
      actions={
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">제12대 소프트웨어융합대학 학생회 운영 현황</p>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium">2026년 1학기</span>
        </div>
      }
    >
      <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto pb-10">

        {/* 1. 운영 요약 */}
        <div className="grid grid-cols-4 gap-4">
          {summaryCards.map(c => (
            <button key={c.label} type="button" onClick={() => navigateTo(c.screen)} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3 text-left hover:border-blue-300 hover:shadow-md transition-all">
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
                <c.icon className={`w-4.5 h-4.5 ${c.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium">{c.label}</p>
                <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 왼쪽 2/3 */}
          <div className="col-span-2 flex flex-col gap-6">

            {/* 2. 진행 중·예정 행사 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700">진행 중·예정 행사</p>
              </div>
              <div className="divide-y divide-gray-100">
                {events.map(ev => (
                  <button key={ev.name} type="button" onClick={() => navigateTo(ev.screen)} className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Chip label={ev.status} variant={ev.statusVariant} />
                        <span className="text-xs font-bold text-gray-900 truncate">{ev.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2.5">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ev.date}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.place}</span>
                        <span>{ev.dept}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ev.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500">준비 {ev.progress}%</span>
                        {ev.issue && <span className={`text-[10px] font-medium ${ev.issueColor}`}>· {ev.issue}</span>}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 다가오는 주요 일정 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">다가오는 주요 일정</p>
                <button type="button" onClick={() => { setCalendarFocus(null); navigateTo("OPS-CAL-01"); }} className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-0.5">캘린더 보기 <ExternalLink className="w-2.5 h-2.5" /></button>
              </div>
              <div className="divide-y divide-gray-100">
                {schedule.map((s, i) => (
                  <button key={i} type="button" onClick={() => { setCalendarFocus(s.focus); navigateTo("OPS-CAL-01"); }} className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
                    <span className="text-xs font-mono font-semibold text-gray-500 w-10 shrink-0">{s.date}</span>
                    <span className="text-xs font-medium text-gray-800 flex-1">{s.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-400">{s.dept}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColor(s.type)}`}>{s.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 6. 최근 활동 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700">최근 활동</p>
              </div>
              <div className="divide-y divide-gray-100">
                {activity.map((a, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-[10px] font-mono text-gray-400 w-20 shrink-0">{a.when}</span>
                    <span className="text-xs text-gray-700 flex-1">{a.desc}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">{a.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽 1/3 */}
          <div className="flex flex-col gap-6">

            {/* 4. 조직 주요 알림 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700">조직 주요 알림</p>
              </div>
              <div className="px-5 py-3 flex flex-col gap-2.5">
                {alerts.map((a, i) => (
                  <button key={i} type="button" onClick={() => { setEventWorkspaceFilter(a.filter ?? null); navigateTo(a.screen); }} className="w-full text-left flex items-center justify-between py-1.5 rounded hover:bg-gray-50">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${a.color.split(" ")[1]}`}>
                        <a.icon className={`w-3.5 h-3.5 ${a.color.split(" ")[0]}`} />
                      </div>
                      <span className="text-xs text-gray-700">{a.label}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-900">{a.value}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 5. 전체 재정 요약 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">전체 재정 요약</p>
                <button type="button" onClick={() => navigateTo("FIN-00")} className="text-[10px] text-gray-400 flex items-center gap-0.5 hover:text-blue-600">전체 재정 보기 <ExternalLink className="w-2.5 h-2.5" /></button>
              </div>
              <div className="px-5 py-4 flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-gray-400">전체 예산 사용률</span>
                    <span className="text-xs font-bold text-gray-900">34%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "34%" }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "사용 가능 예산", value: "66%", color: "text-blue-600" },
                    { label: "승인·집행 예정", value: "4건", color: "text-gray-900" },
                    { label: "증빙 누락", value: "5건", color: "text-red-500" },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-gray-400 mb-0.5">{item.label}</p>
                      <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 내 업무 소형 요약 */}
            <button type="button" onClick={() => navigateTo("MY-01")} className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between text-left hover:border-blue-300">
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">내 담당 업무</p>
                <p className="text-xs font-bold text-gray-700">진행 중·검토 필요 {myActiveTaskCount}건</p>
              </div>
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">내 업무 보기 <ExternalLink className="w-2.5 h-2.5" /></span>
            </button>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── OPS-00 운영 홈 ─────────────────────────────────────────────────────────────

function OPS00() {
  const { navigateTo, currentUser, recurringTasks, eventTasks } = React.useContext(AppContext);
  const recurringInProgressCount = recurringTasks.filter(task => task.status === "진행 중").length;
  const recurringReviewCount = recurringTasks.filter(task => task.status === "검토 필요").length;
  const datedOpenTasks = [...eventTasks, ...recurringTasks].filter(task => task.status !== "완료" && task.due !== "상시");
  const thisWeekDeadlineCount = datedOpenTasks.filter(task => task.due >= "2026-07-19" && task.due <= "2026-07-25").length;
  const upcomingDeadlineCount = datedOpenTasks.filter(task => task.due > "2026-07-25").length;
  const spaces = [
    {
      id: "OPS-TASK-01",
      title: "상시 업무",
      description: "행사에 속하지 않는 반복·조직 운영 업무를 관리합니다.",
      icon: Clipboard,
      iconClass: "bg-blue-50 text-blue-600",
      accent: "border-blue-200 hover:border-blue-300",
      metrics: [["진행 중", `${recurringInProgressCount}건`], ["검토 필요", `${recurringReviewCount}건`]],
      action: "업무 보드 열기",
    },
    {
      id: "OPS-MEET-01A",
      title: "회의",
      description: "예정·진행 중·완료된 회의와 내 참여 상태를 확인합니다.",
      icon: Users,
      iconClass: "bg-indigo-50 text-indigo-600",
      accent: "border-indigo-200 hover:border-indigo-300",
      metrics: [["오늘 예정", "1건"], ["정리 필요", "1건"]],
      action: "회의 목록 보기",
    },
    {
      id: "EVT-00A",
      title: "행사",
      description: "기획·진행·후속 정리 중인 행사를 한곳에서 확인합니다.",
      icon: Star,
      iconClass: "bg-purple-50 text-purple-600",
      accent: "border-purple-200 hover:border-purple-300",
      metrics: [["진행 중", "1개"], ["기획 중", "2개"]],
      action: "행사 목록 보기",
    },
    {
      id: "OPS-CAL-01",
      title: "캘린더",
      description: "행사·회의·마감 일정을 월간 단위로 통합해 봅니다.",
      icon: Calendar,
      iconClass: "bg-orange-50 text-orange-600",
      accent: "border-orange-200 hover:border-orange-300",
      metrics: [["이번 주 마감", `${thisWeekDeadlineCount}건`], ["다가오는 마감", `${upcomingDeadlineCount}건`]],
      action: "월간 일정 보기",
    },
  ];

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영"]}
      title="운영"
    >
      <div className="max-w-5xl mx-auto p-6 pb-12 flex flex-col gap-6">
        <section className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <p className="text-base font-bold text-blue-950">운영 공간</p>
            <p className="text-xs text-blue-800 mt-1 leading-5">{currentUser.name}님이 확인할 업무·회의·행사·일정을 선택하세요. 각 공간에서 역할과 참여 관계에 맞는 다음 행동을 제공합니다.</p>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between mb-3 px-1">
            <div>
              <h2 className="text-sm font-bold text-gray-900">운영 메뉴</h2>
              <p className="text-[11px] text-gray-400 mt-1">운영 업무의 성격에 따라 공간을 선택합니다.</p>
            </div>
            <span className="text-[10px] text-gray-400">4개 공간</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {spaces.map(space => {
              const Icon = space.icon;
              return (
                <button
                  key={space.id}
                  onClick={() => navigateTo(space.id)}
                  className={`group text-left bg-white border rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${space.accent}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${space.iconClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors mt-1" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mt-4">{space.title}</h3>
                  <p className="text-xs text-gray-500 leading-5 mt-1.5 min-h-10">{space.description}</p>
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100">
                    {space.metrics.map(([label, value]) => (
                      <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-gray-400">{label}</p>
                        <p className="text-xs font-bold text-gray-800 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
                    {space.action}<ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-500 leading-5">회의 생성, 행사 생성, 일정 수정처럼 권한이 필요한 행동은 이 허브가 아닌 각 하위 공간에서만 표시됩니다.</p>
        </section>
      </div>
    </DesktopShell>
  );
}

// ─── Onboarding Screens ───────────────────────────────────────────────────────

function ONB01() {
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[480px] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <span className="font-semibold text-gray-900">Vada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1.5 rounded-full bg-blue-600" />
            <div className="w-5 h-1.5 rounded-full bg-gray-200" />
            <span className="text-xs text-gray-400 ml-1">1 / 2</span>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">본인 소속을 입력해 주세요</h2>
        <p className="text-sm text-gray-500 mb-6">학생회 활동에 사용되는 정보입니다.</p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">학교<span className="text-red-500">*</span></label>
            <div className="relative">
              <select className="w-full border border-blue-400 rounded px-3 py-2 text-sm bg-white appearance-none pr-8 ring-1 ring-blue-200">
                <option>한양대학교 ERICA</option>
                <option>서울과학기술대학교</option>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">단과대학<span className="text-red-500">*</span></label>
            <div className="relative">
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8">
                <option>소프트웨어융합대학</option>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">학부·학과<span className="text-red-500">*</span></label>
            <div className="relative">
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8">
                <option>컴퓨터학부</option>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-blue-500 cursor-pointer">목록에 없으신가요? 직접 입력</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">학년<span className="text-red-500">*</span></label>
              <div className="relative">
                <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8">
                  <option>3학년</option>
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <Input label="이름" placeholder="김바다" required />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">학번 <span className="text-gray-400 font-normal">(선택)</span></label>
            <input placeholder="예: 2022123456" className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 placeholder-gray-400" />
          </div>
        </div>

        <div className="mt-8">
          <Btn variant="primary" size="md" className="w-full justify-center">
            다음 <ArrowRight className="w-4 h-4" />
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ONB02() {
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[520px] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <span className="font-semibold text-gray-900">Vada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1.5 rounded-full bg-blue-600" />
            <div className="w-5 h-1.5 rounded-full bg-blue-600" />
            <span className="text-xs text-gray-400 ml-1">2 / 2</span>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">어떻게 시작하시겠어요?</h2>
        <p className="text-sm text-gray-500 mb-6">참여할 학생회를 선택해 주세요.</p>

        <div className="flex flex-col gap-3">
          {[
            {
              title: "새 학생회 만들기",
              desc: "새로운 학생회를 생성하고 조직을 구성합니다.",
              icon: Plus,
              badge: null,
            },
            {
              title: "초대받은 학생회 참여하기",
              desc: "관리자에게 전달받은 초대 코드 또는 초대 링크로 참여합니다.",
              icon: ExternalLink,
              badge: "초대 코드 입력",
            },
          ].map(({ title, desc, icon: Icon, badge }) => (
            <div key={title} className="border border-gray-200 rounded-lg p-5 flex items-center gap-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  {badge && <span className="text-[10px] bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 font-medium">{badge}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">초대 링크로 직접 접속한 경우 이 화면을 건너뜁니다.</p>

        <div className="mt-4">
          <Btn variant="text" size="sm">
            <ArrowLeft className="w-3.5 h-3.5" /> 이전으로
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ONB03() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[520px] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <span className="font-semibold text-gray-900">Vada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1.5 rounded-full bg-blue-600" />
            <div className="w-5 h-1.5 rounded-full bg-blue-600" />
            <span className="text-xs text-gray-400 ml-1">2 / 2</span>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">초대 코드를 입력해 주세요</h2>
        <p className="text-sm text-gray-500 mb-6">학생회 관리자에게 전달받은 초대 코드를 입력하면 학생회 정보를 확인할 수 있습니다.</p>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-700">초대 코드</label>
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(null); }}
            placeholder="AB12CD34"
            maxLength={8}
            className={`border rounded-lg px-4 py-3 text-center text-xl font-mono tracking-widest text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          />
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 mt-0.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Error state examples */}
          <div className="mt-2 flex flex-col gap-1.5">
            {[
              { label: "존재하지 않는 코드", example: "XXXXXXXX" },
              { label: "만료된 코드", example: "OLD12345" },
              { label: "다른 학생회 참여 중", example: null },
            ].map(({ label, example }) => (
              <button
                key={label}
                onClick={() => { if (example) setCode(example); setError(label); }}
                className="text-left text-[11px] text-gray-400 hover:text-orange-500 transition-colors"
              >
                → 오류 예시: {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <Btn variant="primary" size="md" className="w-full justify-center" onClick={() => { if (!code || code.length < 6) setError("올바른 초대 코드를 입력해 주세요."); }}>
            학생회 확인
          </Btn>
        </div>
        <div className="mt-3">
          <Btn variant="text" size="sm">
            <ArrowLeft className="w-3.5 h-3.5" /> 이전으로
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Org Creation ─────────────────────────────────────────────────────────────

function ORG01() {
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[520px] shadow-sm">
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-1">새 학생회 만들기</p>
          <h2 className="text-lg font-semibold text-gray-900">학생회 기본 정보</h2>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">학생회 유형<span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {["총학생회", "단과대 학생회", "학부 학생회", "학과 학생회", "기타"].map((t) => (
                <button key={t} className={`px-3 py-2 rounded border text-xs font-medium ${t === "단과대 학생회" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-600">대표 범위</p>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8">
                  <option>한양대학교 ERICA</option>
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-px h-4 bg-gray-300 ml-3" />
                <div className="relative flex-1">
                  <select className="w-full border border-blue-400 rounded px-3 py-2 text-sm bg-white appearance-none pr-8 ring-1 ring-blue-200">
                    <option>소프트웨어융합대학</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <Input label="학생회명" placeholder="예: 제12대 소프트웨어융합대학 학생회" required />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">운영 연도<span className="text-red-500">*</span></label>
            <div className="relative">
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8">
                <option>2026년</option>
                <option>2027년</option>
                <option>2025년</option>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-gray-400">학생회 기록과 구분을 위한 기준 연도입니다.</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded p-3">
            <p className="text-xs text-blue-600">내 소속 정보 (참고): 한양대학교 ERICA · 소프트웨어융합대학 · 컴퓨터학부 · 3학년</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8">
          <Btn variant="secondary" size="md"><ArrowLeft className="w-4 h-4" /> 이전</Btn>
          <Btn variant="primary" size="md">다음 <ArrowRight className="w-4 h-4" /></Btn>
        </div>
      </div>
    </div>
  );
}

function ORG02() {
  const depts = ["기획부", "홍보부", "디자인부"];
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[860px] shadow-sm">
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-1">새 학생회 만들기</p>
          <h2 className="text-lg font-semibold text-gray-900">조직 구조 설정</h2>
          <p className="text-sm text-gray-500 mt-1">부서 구조를 설정하세요. 구성원 배정은 다음 단계에서 진행합니다.</p>
        </div>

        {/* Segmented control */}
        <div className="flex bg-gray-100 rounded-lg p-1 w-fit mb-8 gap-1">
          {["기본 구조", "템플릿", "빈 조직"].map((opt) => (
            <button key={opt} className={`px-4 py-1.5 rounded text-sm font-medium ${opt === "기본 구조" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              {opt}
            </button>
          ))}
        </div>

        {/* Org chart */}
        <div className="flex flex-col items-center gap-0 mb-8">
          <HQCard />
          <OrgStem height="h-8" />

          <OrgBranch>
            {depts.map((dept) => (
              <DeptCardSetup key={dept} name={dept} />
            ))}
            <div className="border-2 border-dashed border-gray-300 rounded-lg px-6 py-4 flex flex-col items-center gap-1 cursor-pointer hover:border-gray-400">
              <Plus className="w-5 h-5 text-gray-400" />
              <span className="text-xs text-gray-400">부서 추가</span>
            </div>
          </OrgBranch>
        </div>

        <p className="text-xs text-gray-400 text-center mb-8">각 부서 카드 우측의 … 버튼으로 부서명 수정 및 삭제를 할 수 있습니다.</p>

        <div className="flex items-center justify-between">
          <Btn variant="secondary" size="md"><ArrowLeft className="w-4 h-4" /> 이전</Btn>
          <Btn variant="primary" size="md">조직 만들기</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Screen ────────────────────────────────────────────────────────────

function INV01() {
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[480px] shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">V</span>
          </div>
          <span className="font-semibold text-gray-900">Vada</span>
        </div>

        <div className="border border-gray-200 rounded-xl p-6 mb-6">
          <p className="text-xs text-gray-400 mb-1">초대받은 학생회</p>
          <h2 className="text-base font-semibold text-gray-900 mb-4">제12대 소프트웨어융합대학 학생회</h2>
          <div className="flex flex-col gap-2.5">
            {[
              ["유형", "단과대 학생회"],
              ["대표 범위", "한양대학교 ERICA · 소프트웨어융합대학"],
              ["임기", "2026. 01. 01 ~ 2026. 12. 31"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-20 shrink-0">{k}</span>
                <span className="text-xs text-gray-700">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <p className="text-xs font-medium text-gray-600 mb-2">내 소속 정보</p>
          <div className="flex flex-col gap-1">
            {[
              ["학교", "한양대학교 ERICA"],
              ["소속", "소프트웨어융합대학 · 컴퓨터학부"],
              ["학년", "3학년"],
              ["이름", "김바다"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-16 shrink-0">{k}</span>
                <span className="text-xs text-gray-700">{v}</span>
              </div>
            ))}
          </div>
          <button className="text-xs text-blue-500 mt-2">개인 소속 수정</button>
        </div>

        <p className="text-xs text-gray-400 mb-4">참여하면 미배정 구성원으로 등록됩니다. 부서 배정은 학생회 관리자가 진행합니다.</p>

        <Btn variant="primary" size="md" className="w-full justify-center">학생회 참여하기</Btn>
      </div>
    </div>
  );
}

// ─── Org Management ───────────────────────────────────────────────────────────

const members = [
  { name: "김바다", dept: "컴퓨터학부", grade: "3학년" },
  { name: "박해랑", dept: "컴퓨터학부", grade: "2학년" },
  { name: "이윤슬", dept: "ICT융합학부", grade: "4학년" },
  { name: "정하늘", dept: "컴퓨터학부", grade: "3학년" },
];

// ─── HQCard — 회장단 부서 카드 ───────────────────────────────────────────────

const HQ_MEMBERS = [
  { name: "김바다", dept: "컴퓨터학부", grade: "3학년", role: "회장" },
  { name: "이윤슬", dept: "ICT융합학부", grade: "4학년", role: "부회장" },
];

function HQCard({ editMode = false }: { editMode?: boolean }) {
  const [popover, setPopover] = useState<string | null>(null);
  return (
    <div className="border-2 border-gray-300 rounded-lg bg-white min-w-[240px] relative">
      {/* 카드 헤더 */}
      <div className="border-b border-gray-200 px-3 py-2 flex items-center justify-between bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-sm font-semibold text-gray-800">회장단</span>
        </div>
        {editMode && <button className="text-[10px] text-gray-400 hover:text-gray-600">수정</button>}
      </div>

      {/* 구성원 목록 */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          {HQ_MEMBERS.map((m) => (
            <div key={m.name} className="relative">
              {editMode && (
                <button className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center z-10">
                  <Minus className="w-2.5 h-2.5 text-white" />
                </button>
              )}
              <button
                onClick={() => setPopover(popover === m.name ? null : m.name)}
                className="text-left"
              >
                <div className={`border rounded-lg p-2.5 w-28 flex flex-col gap-1 cursor-pointer transition-colors ${
                  m.role === "회장"
                    ? "border-yellow-300 bg-yellow-50 hover:bg-yellow-100"
                    : "border-blue-200 bg-blue-50 hover:bg-blue-100"
                }`}>
                  {editMode && <GripVertical className="absolute top-1 left-1 w-3 h-3 text-gray-300" />}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    m.role === "회장" ? "bg-yellow-200" : "bg-blue-200"
                  }`}>
                    <User className={`w-4 h-4 ${m.role === "회장" ? "text-yellow-700" : "text-blue-700"}`} />
                  </div>
                  <p className="text-xs font-semibold text-gray-800">{m.name}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">{m.dept}</p>
                  <p className="text-[10px] text-gray-400">{m.grade}</p>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold w-fit ${
                    m.role === "회장"
                      ? "bg-yellow-200 text-yellow-800"
                      : "bg-blue-200 text-blue-800"
                  }`}>{m.role}</span>
                </div>
              </button>

              {/* 팝오버 */}
              {popover === m.name && (
                <div className="absolute z-20 bg-white border border-gray-200 shadow-lg rounded-lg p-4 w-52 top-0 left-32">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                    <button onClick={() => setPopover(null)} className="text-gray-300 hover:text-gray-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      ["학교", "한양대 ERICA"],
                      ["단과대학", "소프트웨어융합대학"],
                      ["학부", m.dept],
                      ["학년", m.grade],
                      ["현재 부서", "회장단"],
                      ["직책", m.role],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 w-16 shrink-0">{k}</span>
                        <span className="text-[10px] text-gray-700">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 구성원 추가 버튼 */}
        <button className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1">
          <Plus className="w-3 h-3" /> 구성원 추가
        </button>
      </div>
    </div>
  );
}

function EventLeaderCard({ editMode = false }: { editMode?: boolean }) {
  return (
    <div className="border-2 border-gray-300 rounded-lg bg-white min-w-[180px]">
      <div className="border-b border-gray-200 px-3 py-2 flex items-center gap-1.5 bg-gray-50 rounded-t-lg">
        <Star className="w-3.5 h-3.5 text-yellow-500" />
        <span className="text-sm font-semibold text-gray-800">행사 책임자</span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="relative">
          <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-2.5 w-28 flex flex-col gap-1">
            {editMode && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center">
                <Minus className="w-2.5 h-2.5 text-white" />
              </div>
            )}
            <div className="w-7 h-7 rounded-full bg-yellow-200 flex items-center justify-center">
              <User className="w-4 h-4 text-yellow-700" />
            </div>
            <p className="text-xs font-semibold text-gray-800">김바다</p>
            <p className="text-[10px] text-gray-500 leading-tight">컴퓨터학부</p>
            <p className="text-[10px] text-gray-400">3학년</p>
            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-200 text-yellow-800 w-fit">책임자</span>
          </div>
        </div>
        {editMode && (
          <button className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5">
            <Plus className="w-3 h-3" /> 책임자 변경
          </button>
        )}
      </div>
    </div>
  );
}

function MemberPopover() {
  return (
    <div className="absolute z-10 bg-white border border-gray-200 shadow-lg rounded-lg p-4 w-52 top-0 left-32">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <User className="w-4 h-4 text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">이윤슬</p>
          <Chip label="기획부원" variant="gray" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {[["학교", "한양대 ERICA"], ["단과대학", "소프트웨어융합대학"], ["학부", "ICT융합학부"], ["학년", "4학년"], ["현재 부서", "기획부"], ["역할", "부원"]].map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-16 shrink-0">{k}</span>
            <span className="text-[10px] text-gray-700">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ORG03A() {
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "기본 조직"]}
      title="제12대 소프트웨어융합대학 학생회"
      actions={<>
        <Btn variant="secondary" size="sm"><Users className="w-3.5 h-3.5" /> 구성원 초대</Btn>
        <Btn variant="secondary" size="sm">수정</Btn>
      </>}
    >
      <div className="flex h-full">
        {/* Org chart area */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex flex-col items-center gap-0">
            <HQCard />
            <OrgStem />

            <OrgBranch>
              {["기획부", "홍보부", "디자인부"].map((dept, di) => (
                <div key={dept} className="relative">
                  <DeptCard
                    name={dept}
                    leader={di === 0 ? "박해랑" : undefined}
                    members={members.slice(di + 1, di + 3)}
                  />
                </div>
              ))}
            </OrgBranch>
          </div>
        </div>

        {/* Unassigned panel */}
        <aside className="w-64 border-l border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">미배정 구성원</p>
            <p className="text-xs text-gray-400">2명</p>
          </div>
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5 bg-gray-50">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input placeholder="이름 검색" className="text-xs bg-transparent outline-none placeholder-gray-400 flex-1" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 flex flex-wrap gap-2 content-start">
            <MemberCard name="정하늘" dept="컴퓨터학부" grade="3학년" />
            <MemberCard name="박해랑" dept="컴퓨터학부" grade="2학년" />
          </div>
        </aside>
      </div>
    </DesktopShell>
  );
}

function ORG03B() {
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "기본 조직"]}
      title="제12대 소프트웨어융합대학 학생회"
      actions={<><Btn variant="primary" size="sm">완료</Btn></>}
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex flex-col items-center gap-0">
            <HQCard editMode />
            <OrgStem />

            <OrgBranch>
              {["기획부", "홍보부", "디자인부"].map((dept, di) => (
                di === 1 ? (
                  <div key={dept} className="relative">
                    <DeptCard name={dept} leader={undefined} members={members.slice(1, 3)} editMode />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 shadow-xl opacity-90 rotate-3 pointer-events-none">
                      <MemberCard name="박해랑" dept="컴퓨터학부" grade="2학년" draggable />
                    </div>
                  </div>
                ) : (
                  <DeptCard key={dept} name={dept} leader={di === 0 ? "이윤슬" : undefined} members={members.slice(di, di + 2)} editMode />
                )
              ))}
              <DeptCard name="" members={[]} addDept />
            </OrgBranch>
          </div>
        </div>

        <aside className="w-64 border-l border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">미배정 구성원</p>
            <p className="text-xs text-gray-400">2명 · 드래그해서 부서로 이동</p>
          </div>
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5 bg-gray-50">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input placeholder="이름 검색" className="text-xs bg-transparent outline-none placeholder-gray-400 flex-1" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 flex flex-wrap gap-2 content-start">
            <MemberCard name="정하늘" dept="컴퓨터학부" grade="3학년" draggable />
            <MemberCard name="박해랑" dept="컴퓨터학부" grade="2학년" draggable />
          </div>
        </aside>
      </div>
    </DesktopShell>
  );
}

function ORG03C() {
  const [showDialog, setShowDialog] = useState(false);
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "기본 조직"]}
      title="제12대 소프트웨어융합대학 학생회"
      actions={<><Btn variant="secondary" size="sm">수정</Btn></>}
    >
      <div className="flex h-full">
        {/* Left org chart placeholder */}
        <div className="flex-1 p-6 opacity-40 pointer-events-none overflow-auto">
          <div className="flex flex-col items-center gap-0">
            <HQCard />
            <OrgStem />
            <OrgBranch>
              {["기획부", "홍보부", "디자인부"].map((dept) => (
                <div key={dept} className="border border-gray-200 rounded-lg bg-white w-44 p-3">
                  <p className="text-sm font-semibold">{dept}</p>
                </div>
              ))}
            </OrgBranch>
          </div>
        </div>

        {/* Invite panel */}
        <aside className="w-72 border-l border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <button className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></button>
            <p className="text-sm font-semibold text-gray-800">구성원 초대</p>
          </div>
          <div className="flex-1 p-5 flex flex-col gap-5 overflow-auto">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">제12대 소프트웨어융합대학 학생회</p>
              <p className="text-xs text-gray-500">초대 링크 또는 초대 코드를 공유하면 구성원이 학생회에 참여할 수 있습니다.</p>
            </div>

            {/* Link section */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">공용 초대 링크</p>
              <div className="border border-gray-200 rounded p-2.5 bg-gray-50 mb-2">
                <p className="text-xs text-gray-500 break-all font-mono">https://vada.app/join/swcollege12/abc123xyz</p>
              </div>
              <Btn variant="secondary" size="sm"><Copy className="w-3.5 h-3.5" /> 링크 복사</Btn>
            </div>

            {/* Code section */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">짧은 초대 코드</p>
              <div className="border border-gray-200 rounded p-2.5 bg-gray-50 mb-2 flex items-center justify-between">
                <span className="text-xl font-mono font-bold text-gray-800 tracking-widest">AB12CD34</span>
              </div>
              <Btn variant="secondary" size="sm"><Copy className="w-3.5 h-3.5" /> 코드 복사</Btn>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500 mb-2">링크와 코드는 <strong>동일한 초대 권한</strong>입니다. 어느 방식으로든 참여한 구성원은 미배정으로 등록됩니다.</p>
              <Btn variant="text" size="sm" className="text-red-500" onClick={() => setShowDialog(true)}>
                <RefreshCw className="w-3 h-3" /> 초대 정보 재생성
              </Btn>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirm dialog */}
      {showDialog && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-20">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-6 w-80">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">초대 정보를 재생성하시겠어요?</h3>
            <p className="text-xs text-gray-500 mb-5">기존 링크와 코드가 즉시 무효화됩니다. 이전 링크와 코드로는 더 이상 참여할 수 없습니다.</p>
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setShowDialog(false)}>취소</Btn>
              <Btn variant="destructive" size="sm" onClick={() => setShowDialog(false)}>재생성</Btn>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
}

// ─── Student Roster ───────────────────────────────────────────────────────────

const studentRows = [
  { name: "김바다", id: "2022123456", dept: "컴퓨터학부", grade: "3학년", status: "납부", statusV: "green" as const },
  { name: "박해랑", id: "2023234567", dept: "컴퓨터학부", grade: "2학년", status: "납부", statusV: "green" as const },
  { name: "이윤슬", id: "2020345678", dept: "컴퓨터학부", grade: "4학년", status: "미납", statusV: "red" as const },
  { name: "정하늘", id: "2022456789", dept: "ICT융합학부", grade: "3학년", status: "미납", statusV: "red" as const },
  { name: "최바람", id: "2021567890", dept: "컴퓨터학부", grade: "3학년", status: "확인 필요", statusV: "yellow" as const },
  { name: "강별", id: "2024678901", dept: "ICT융합학부", grade: "1학년", status: "납부", statusV: "green" as const },
  { name: "오하늘", id: "2023789012", dept: "컴퓨터학부", grade: "2학년", status: "납부", statusV: "green" as const },
  { name: "윤서진", id: "2022890123", dept: "ICT융합학부", grade: "3학년", status: "미납", statusV: "red" as const },
];

// ─── ORG-00 조직 관리 홈 ──────────────────────────────────────────────────────

function ORG00() {
  const { navigateTo } = React.useContext(AppContext);
  const areas = [
    {
      icon: Users,
      name: "부서 & 구성원",
      desc: "학생회 기본 조직의 부서 구조와 구성원을 확인하고 관리합니다.",
      meta: "부서 5개 · 구성원 18명",
      screen: "ORG-03A",
    },
    {
      icon: Clipboard,
      name: "학생 명단",
      desc: "행사 참가 확인과 학생회비 조회에 사용하는 단과대학 학생 명단을 관리합니다.",
      meta: "학생 1,284명 · 최근 갱신 07.01",
      screen: "ORG-07A",
    },
    {
      icon: Settings,
      name: "역할 및 권한",
      desc: "역할별로 사용할 수 있는 기능을 열람합니다.",
      meta: "기본 역할 3종 · 확정된 권한 매트릭스",
      screen: "ORG-04",
    },
  ];
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리"]}
      title="조직 관리"
    >
      <div className="p-8 max-w-4xl mx-auto flex flex-col gap-5">
        <p className="text-sm text-gray-500">관리할 영역을 선택하세요.</p>
        <div className="grid grid-cols-1 gap-3">
          {areas.map(({ icon: Icon, name, desc, meta, screen }) => (
            <button
              key={name}
              onClick={() => navigateTo(screen)}
              className="text-left bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-5 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{name}</p>
                <p className="text-xs text-gray-500 mt-1 leading-5">{desc}</p>
                <p className="text-[10px] text-gray-400 mt-1.5">{meta}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── ORG-04 역할 및 권한 ────────────────────────────────────────────────────

const ROLE_DETAILS: { name: OrganizationRole; desc: string }[] = [
  { name: "회장단", desc: "학생회 전체 운영을 총괄하고 재정 처리를 승인합니다." },
  { name: "부서장", desc: "소속 부서의 업무와 구성원을 관리합니다." },
  { name: "부원", desc: "부서 업무에 참여하고 구매 요청 등을 제출합니다." },
];

const PERMISSION_ROWS: { area: string; values: [string, string, string]; confirmed: boolean }[] = [
  { area: "재정 현황·사용 내역 열람", values: ["가능", "가능", "가능"], confirmed: true },
  { area: "예산 수정·구매 승인·증빙 처리", values: ["가능", "재정부만", "재정부만"], confirmed: true },
  { area: "회의 생성", values: ["가능", "가능", "—"], confirmed: true },
  { area: "행사 만들기", values: ["가능", "가능", "—"], confirmed: true },
  { area: "행사 정보 수정·종료 처리", values: ["가능", "행사 조직만", "행사 조직만"], confirmed: true },
  { area: "조직 구조 수정", values: ["가능", "—", "—"], confirmed: true },
  { area: "구성원 초대", values: ["가능", "자기 부서만", "—"], confirmed: true },
  { area: "학생 명단 열람", values: ["가능", "가능", "가능"], confirmed: true },
  { area: "학생 명단 업로드·갱신", values: ["가능", "—", "—"], confirmed: true },
];

function PermissionCell({ value }: { value: string }) {
  if (value === "가능") return <Chip label="가능" variant="green" />;
  if (value === "—") return <span className="text-xs text-gray-300">—</span>;
  return <Chip label={value} variant="yellow" />;
}

function ORG04() {
  const { organizationMemberRoles, currentUser, navigateTo } = React.useContext(AppContext);
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "역할 및 권한"]}
      title="역할 및 권한"
      actions={currentUser.role === "회장단" ? <Btn variant="primary" size="sm" onClick={() => navigateTo("ORG-04B")}><Settings className="w-3.5 h-3.5" /> 권한 변경</Btn> : undefined}
    >
      <div className="p-6 flex flex-col gap-5 max-w-5xl">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-blue-900">역할별로 사용할 수 있는 기능을 보여주는 열람 화면입니다</p>
            <p className="text-[11px] text-blue-800 mt-1">확정된 권한 매트릭스를 기준으로 합니다. 역할 변경은 회장단 전용 관리 화면에서만 할 수 있습니다.</p>
          </div>
        </div>

        {/* 기본 역할 */}
        <div className="grid grid-cols-3 gap-3">
          {ROLE_DETAILS.map(role => (
            <div key={role.name} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-gray-900">{role.name}</p>
                <span className="text-[10px] text-gray-400">{organizationMemberRoles.filter(member => member.role === role.name).length}명</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-5">{role.desc}</p>
            </div>
          ))}
        </div>

        {/* 권한 표 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-700">기능 영역별 권한</p>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500">기능 영역</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-center">회장단</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-center">부서장</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-center">부원</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {PERMISSION_ROWS.map(row => (
                <tr key={row.area} className={row.confirmed ? "" : "bg-gray-50/50"}>
                  <td className="px-5 py-3.5 text-xs font-medium text-gray-800">{row.area}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-5 py-3.5 text-center">
                      <PermissionCell value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">‘—’는 해당 역할이 사용할 수 없는 기능입니다. 회의·행사별로 부여되는 역할은 아래 카드를 참고하세요.</p>
          </div>
        </div>

        {/* 맥락 역할 규칙 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-bold text-gray-800 mb-3">회의·행사에서 별도로 부여되는 역할</p>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <p className="text-[11px] text-gray-600 leading-5"><span className="font-semibold text-gray-800">회의 진행 권한자</span> — 회의별로 부여되며 회의 시작·종료와 안건 진행을 할 수 있습니다. 다른 사람의 권한은 변경할 수 없습니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <p className="text-[11px] text-gray-600 leading-5"><span className="font-semibold text-gray-800">회의 생성자</span> — 기본 진행 권한자이며, 진행 권한을 부여·해제할 수 있는 유일한 역할입니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <p className="text-[11px] text-gray-600 leading-5"><span className="font-semibold text-gray-800">행사 운영 조직 역할</span> — 행사별로 구성되며 기본 학생회 조직과 별개의 데이터입니다. 행사 조직을 수정해도 기본 조직은 변경되지 않습니다.</p>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function OrganizationRoleBadge({ role }: { role: OrganizationRole }) {
  const styles: Record<OrganizationRole, string> = {
    "회장단": "bg-violet-50 text-violet-700 border-violet-200",
    "부서장": "bg-blue-50 text-blue-700 border-blue-200",
    "부원": "bg-gray-50 text-gray-600 border-gray-200",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[role]}`}>{role}</span>;
}

function ORG04B() {
  const { organizationMemberRoles, setOrganizationMemberRoles } = React.useContext(AppContext);
  const [selectedName, setSelectedName] = useState("박해랑");
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>("부원");
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastChanged, setLastChanged] = useState<string | null>(null);
  const selectedMember = organizationMemberRoles.find(member => member.name === selectedName) ?? organizationMemberRoles[0];
  const presidentCount = organizationMemberRoles.filter(member => member.role === "회장단").length;
  const removesLastPresident = selectedMember.role === "회장단" && selectedRole !== "회장단" && presidentCount === 1;
  const canApply = selectedMember.role !== selectedRole && !removesLastPresident;

  const selectMember = (member: OrganizationMemberRole) => {
    setSelectedName(member.name);
    setSelectedRole(member.role);
    setLastChanged(null);
  };
  const applyRoleChange = () => {
    setOrganizationMemberRoles(current => current.map(member => member.name === selectedMember.name ? { ...member, role: selectedRole } : member));
    setLastChanged(`${selectedMember.name}님의 기본 역할을 ${selectedRole}(으)로 변경했습니다.`);
    setShowConfirm(false);
  };

  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "역할 및 권한", "권한 변경"]}
      title="역할 및 권한 관리"
      actions={<span className="inline-flex items-center rounded-full bg-violet-50 border border-violet-200 px-3 py-1.5 text-[11px] font-semibold text-violet-700">회장단 전용</span>}
    >
      <div className="p-6 max-w-5xl flex flex-col gap-5">
        <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <Settings className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-violet-900">기본 역할을 변경할 수 있습니다</p>
            <p className="text-[11px] text-violet-700 mt-1">회장단만 구성원의 기본 역할을 회장단·부서장·부원으로 변경할 수 있습니다. 회의·행사별 맥락 역할은 이 화면에서 변경되지 않습니다.</p>
          </div>
        </div>

        {lastChanged && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs font-medium text-green-700">{lastChanged}</p>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">구성원 기본 역할</p>
                <p className="text-[11px] text-gray-500 mt-1">변경할 구성원을 선택하세요.</p>
              </div>
              <span className="text-[11px] text-gray-400">{organizationMemberRoles.length}명</span>
            </div>
            <div className="divide-y divide-gray-100">
              {organizationMemberRoles.map(member => {
                const selected = member.name === selectedMember.name;
                return (
                  <button key={member.name} onClick={() => selectMember(member)} className={`w-full px-5 py-3.5 text-left flex items-center gap-3 transition-colors ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><User className="w-4 h-4 text-gray-500" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{member.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{member.dept}</p>
                    </div>
                    <OrganizationRoleBadge role={member.role} />
                    <ChevronRight className={`w-4 h-4 ${selected ? "text-blue-500" : "text-gray-300"}`} />
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="bg-white border border-gray-200 rounded-xl p-5 sticky top-0">
            <p className="text-xs font-bold text-gray-900">기본 역할 변경</p>
            <div className="mt-4 pb-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">{selectedMember.name}</p>
              <p className="text-[11px] text-gray-500 mt-1">{selectedMember.dept} · 현재 <OrganizationRoleBadge role={selectedMember.role} /></p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {ROLE_DETAILS.map(role => (
                <label key={role.name} className={`flex items-center gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors ${selectedRole === role.name ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input type="radio" name="organization-role" checked={selectedRole === role.name} onChange={() => setSelectedRole(role.name)} className="accent-blue-600" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-800">{role.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{role.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {removesLastPresident && <p className="mt-3 text-[11px] leading-5 text-red-600">마지막 회장단은 다른 역할로 변경할 수 없습니다. 먼저 다른 구성원에게 회장단 역할을 부여하세요.</p>}
            <div className="mt-5 flex gap-2">
              <Btn variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setSelectedRole(selectedMember.role)}>되돌리기</Btn>
              <Btn variant="primary" size="sm" className="flex-1 justify-center" disabled={!canApply} onClick={() => setShowConfirm(true)}>권한 변경</Btn>
            </div>
          </aside>
        </div>
      </div>

      {showConfirm && (
        <div className="absolute inset-0 z-20 bg-black/20 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white border border-gray-200 shadow-xl rounded-xl p-6">
            <h3 className="text-sm font-bold text-gray-900">기본 역할을 변경할까요?</h3>
            <p className="mt-2 text-xs leading-5 text-gray-600"><span className="font-semibold text-gray-800">{selectedMember.name}</span>님의 역할이 <OrganizationRoleBadge role={selectedMember.role} />에서 <OrganizationRoleBadge role={selectedRole} />(으)로 변경됩니다.</p>
            <p className="mt-3 text-[11px] leading-5 text-gray-500">변경 후 역할 기준으로 기능 버튼 노출과 접근 범위가 적용됩니다. 회의·행사별 개별 역할은 바뀌지 않습니다.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setShowConfirm(false)}>취소</Btn>
              <Btn variant="primary" size="sm" onClick={applyRoleChange}>변경 확정</Btn>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
}

function ORG07A({ onOpenB }: { onOpenB?: () => void }) {
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "학생 명단"]}
      title="학생 명단 관리"
      actions={<>
        <Btn variant="secondary" size="sm" onClick={onOpenB}><Upload className="w-3.5 h-3.5" /> 학생 명단 업로드·갱신</Btn>
        <Btn variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> 명단 내보내기</Btn>
      </>}
    >
      <div className="p-6 flex flex-col gap-4">
        {/* Scope banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-0.5">관리 범위</p>
            <p className="text-xs text-blue-600">한양대학교 ERICA › 소프트웨어융합대학 › 컴퓨터학부</p>
            <p className="text-xs text-blue-500 mt-0.5">컴퓨터학부 학생만 이 명단에 등록할 수 있습니다. 범위 변경은 조직 설정에서 가능합니다.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded px-3 py-1.5 bg-white w-60">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input placeholder="이름, 학번 검색" className="text-xs outline-none placeholder-gray-400 flex-1" />
          </div>
          <div className="relative">
            <select className="border border-gray-200 rounded px-3 py-1.5 text-xs bg-white appearance-none pr-7">
              <option>모든 학년</option>
              <option>1학년</option><option>2학년</option><option>3학년</option><option>4학년</option>
            </select>
            <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="border border-gray-200 rounded px-3 py-1.5 text-xs bg-white appearance-none pr-7">
              <option>학생회비 전체</option>
              <option>납부 확인</option><option>미납</option><option>미확인</option><option>확인 필요</option>
            </select>
            <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">이름</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">학번</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">학부·학과</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">학년</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">학생회비</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((r, i) => (
                <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${r.status === "확인 필요" ? "bg-yellow-50" : ""}`}>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-900">
                    <div className="flex items-center gap-1.5">
                      {r.name}
                      {r.status === "확인 필요" && <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{r.id}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{r.dept}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{r.grade}</td>
                  <td className="px-4 py-2.5"><Chip label={r.status} variant={r.statusV} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>총 8명</span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 border border-gray-200 rounded text-gray-400">이전</button>
            <button className="px-2 py-1 border border-blue-500 rounded bg-blue-50 text-blue-700">1</button>
            <button className="px-2 py-1 border border-gray-200 rounded text-gray-600">다음</button>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function ORG07B({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState(0);
  const steps = ["양식 다운로드", "파일 업로드", "검증 결과"];
  return (
    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[600px] max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">학생 명단 업로드·갱신</h3>
            <p className="text-xs text-gray-400 mt-0.5">컴퓨터학부 · 한양대학교 ERICA</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        {/* Steps */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-0">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-0">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${i === step ? "bg-blue-600 text-white" : i < step ? "text-green-600" : "text-gray-400"}`}>
                  {i < step ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                  {s}
                </div>
                {i < steps.length - 1 && <div className="w-6 h-px bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-gray-700">현재 관리 범위에 맞는 양식을 다운로드한 뒤 전체 학생 명단을 작성하세요.</p>
              <div className="border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                <FileText className="w-8 h-8 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">학생 명단 양식.xlsx</p>
                  <p className="text-xs text-gray-400">이름·학번·단과대학·학부·학년·학생회비 납부 여부 포함</p>
                </div>
                <Btn variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> 다운로드</Btn>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded p-3">
                <p className="text-xs text-blue-700">업로드한 파일 자체가 행사 신청자 대조에 사용되는 기준 명단이 됩니다.</p>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center gap-3 text-center">
              <Upload className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-600 font-medium">파일을 드래그하거나 클릭하여 업로드</p>
              <p className="text-xs text-gray-400">.xlsx 형식 지원</p>
              <Btn variant="secondary" size="sm">파일 선택</Btn>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-700 font-medium">파일 형식 검증 완료. 155명의 명단을 반영할 수 있습니다.</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">오류 항목 <span className="text-red-500">(반영에서 제외됩니다)</span></p>
                <table className="w-full border border-gray-200 rounded text-xs">
                  <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2 font-medium text-gray-500">이름</th><th className="text-left px-3 py-2 font-medium text-gray-500">학번</th><th className="text-left px-3 py-2 font-medium text-gray-500">오류</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-gray-100 bg-red-50"><td className="px-3 py-2 text-red-800">홍길동</td><td className="px-3 py-2 font-mono text-red-700">2024999999</td><td className="px-3 py-2"><Chip label="대표 범위 밖 학생" variant="red" /></td></tr>
                    <tr className="border-t border-gray-100 bg-yellow-50"><td className="px-3 py-2 text-yellow-800">김중복</td><td className="px-3 py-2 font-mono text-yellow-700">2022123456</td><td className="px-3 py-2"><Chip label="중복 학번" variant="yellow" /></td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400">재업로드 시 학번 기준으로 최신 상태를 갱신합니다. 행사 참가자 기록은 유지됩니다.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
          <Btn variant="secondary" size="sm" onClick={onClose}>취소</Btn>
          <div className="flex gap-2">
            {step > 0 && <Btn variant="secondary" size="sm" onClick={() => setStep(s => s - 1)}>이전</Btn>}
            {step < 2
              ? <Btn variant="primary" size="sm" onClick={() => setStep(s => s + 1)}>다음</Btn>
              : <Btn variant="primary" size="sm" onClick={onClose}>명단 반영</Btn>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EVT-00B Modal (standalone, used inside EVT00A) ──────────────────────────

function EVT00BModal({ onClose, onCreate }: { onClose?: () => void; onCreate?: (name: string) => void }) {
  const [value, setValue] = useState("2026 학부 체육대회");
  const [error, setError] = useState(false);
  const handleCreate = () => {
    const name = value.trim();
    if (!name) { setError(true); return; }
    onCreate?.(name);
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[440px] p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900">새 행사 만들기</h3>
        <button className="text-gray-400 hover:text-gray-600" onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">행사명 또는 가칭<span className="text-red-500">*</span></label>
          <input
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
            placeholder="예: 2026 학부 체육대회"
            className={`border rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? "border-red-400 ring-1 ring-red-400" : "border-gray-300"}`}
          />
          {error && <p className="text-[11px] text-red-500">행사명을 입력해 주세요.</p>}
          <p className="text-[11px] text-gray-400">일시·장소·참가비·운영 조직은 행사 공간에서 나중에 입력할 수 있습니다.</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs text-blue-700">행사 공간을 먼저 만들고, 회의와 업무를 진행하면서 정보를 점진적으로 채울 수 있습니다.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-8">
        <Btn variant="secondary" size="md" onClick={onClose}>취소</Btn>
        <Btn variant="primary" size="md" onClick={handleCreate}>행사 만들기</Btn>
      </div>
    </div>
  );
}

// ─── 행사 상태 시스템 ─────────────────────────────────────────────────────────
const LIFECYCLE_STYLE: Record<EventLifecycle, { badge: string; label: string }> = {
  "기획 중":     { badge: "bg-blue-50 text-blue-700 border border-blue-200",       label: "기획 중" },
  "진행 중":     { badge: "bg-green-50 text-green-700 border border-green-200",     label: "진행 중" },
  "후속 정리 중": { badge: "bg-orange-50 text-orange-700 border border-orange-200",  label: "후속 정리 중" },
  "완료":       { badge: "bg-gray-100 text-gray-500 border border-gray-200",       label: "완료" },
  "취소됨":     { badge: "bg-red-50 text-red-600 border border-red-200",           label: "취소됨" },
};

const LIFECYCLE_CHIP_VARIANT: Record<EventLifecycle, "blue" | "green" | "yellow" | "gray" | "red"> = {
  "기획 중": "blue",
  "진행 중": "green",
  "후속 정리 중": "yellow",
  "완료": "gray",
  "취소됨": "red",
};

// ─── EVT-00A 행사 목록 ────────────────────────────────────────────────────────

const EVT_LIST_DATA: {
  name: string; date: string; place: string; manager: string; updatedAt: string;
  lifecycle: EventLifecycle; highlights: string[]; followUpItems?: string;
}[] = [
  {
    name: "2026 소프트웨어융합대학 체육대회",
    date: "2026. 08. 20 10:00",
    place: "ERICA 체육관",
    manager: "학술체육부",
    updatedAt: "오늘 10:30",
    lifecycle: "진행 중",
    highlights: ["신청자 142/200명", "명단 확인 필요 6명"],
  },
  {
    name: "2026 신입생 환영 행사",
    date: "일시 미정",
    place: "장소 미정",
    manager: "홍길동",
    updatedAt: "어제 16:20",
    lifecycle: "기획 중",
    highlights: ["미정 정보 4개", "담당자 없는 업무 2개"],
  },
  {
    name: "봄 축제 학생회 부스",
    date: "2026. 05. 28",
    place: "한양대 ERICA 잔디밭",
    manager: "대외협력부",
    updatedAt: "2026. 06. 02",
    lifecycle: "후속 정리 중",
    highlights: ["실제 참석자 186명"],
    followUpItems: "미완료 업무 3건 · 미정리 문서 2건",
  },
];

// 행사 상태는 AppContext의 eventLifecycle을 단일 기준으로 한다.
// 목록·홈·워크스페이스가 같은 값을 쓰도록 대표 행사의 상태를 덮어쓴다.
const MAIN_EVENT_NAME = "2026 소프트웨어융합대학 체육대회";
const withMainEventLifecycle = (lifecycle: EventLifecycle) =>
  EVT_LIST_DATA.map(event => (event.name === MAIN_EVENT_NAME ? { ...event, lifecycle } : event));

function EventListScreen({ manager = false }: { manager?: boolean }) {
  const { navigateTo, eventLifecycle, createdEvents, setCreatedEvents } = React.useContext(AppContext);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"전체" | EventLifecycle>("전체");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // 생성한 행사는 기획 중 상태로 목록 맨 앞에 추가한다.
  const createdRows = createdEvents.map(event => ({
    name: event.name,
    date: "일시 미정",
    place: "장소 미정",
    manager: "담당 미정",
    updatedAt: event.createdAt,
    lifecycle: "기획 중" as EventLifecycle,
    highlights: ["기본 정보 입력 필요"],
  }));

  const handleCreateEvent = (name: string) => {
    setCreatedEvents(list => [...list, { name, createdAt: "방금 전" }]);
    setModalOpen(false);
    navigateTo("EVT-02");
  };

  // 완료/취소됨은 이 목록에서 제외 (완료된 행사는 REC-01)
  const activeData = [...createdRows, ...withMainEventLifecycle(eventLifecycle)].filter(e => e.lifecycle !== "완료" && e.lifecycle !== "취소됨");
  const filterOptions: ("전체" | EventLifecycle)[] = ["전체", "기획 중", "진행 중", "후속 정리 중"];

  const filtered = activeData.filter(e =>
    (filter === "전체" || e.lifecycle === filter) &&
    e.name.includes(search)
  );

  return (
    <div className="relative h-full">
      <DesktopShell
        activeSidebar="운영"
        breadcrumb={["운영", "행사"]}
        title="행사"
        actions={
          <>
            <button className="text-xs text-blue-600 hover:underline mr-2">완료된 행사 보기 →</button>
            {manager && (
              <Btn variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> 새 행사 만들기
              </Btn>
            )}
          </>
        }
      >
        <div className="p-6 flex flex-col gap-5">
          <p className="text-sm text-gray-500">기획 중이거나 운영 및 후속 정리가 진행 중인 행사를 관리합니다.</p>

          {/* 검색 + 필터 */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="행사명 검색"
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {filterOptions.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === f ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 focus:outline-none">
                <option>최근 활동순</option>
                <option>행사 일시순</option>
              </select>
            </div>
          </div>

          {/* 행사 없음 — 빈 상태 */}
          {filtered.length === 0 && search === "" && filter === "전체" && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 mb-1">아직 만든 행사가 없습니다</p>
                <p className="text-xs text-gray-400">행사명만 입력하면 행사 공간을 만들고 회의와 업무부터 시작할 수 있습니다.</p>
              </div>
              <Btn variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> 첫 행사 만들기
              </Btn>
            </div>
          )}

          {/* 검색 결과 없음 */}
          {filtered.length === 0 && (search !== "" || filter !== "전체") && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Search className="w-8 h-8 text-gray-300" />
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-600">조건에 맞는 행사가 없습니다</p>
                <p className="text-xs text-gray-400 mt-1">검색어나 필터를 변경해 보세요</p>
              </div>
              <button onClick={() => { setSearch(""); setFilter("전체"); }} className="text-xs text-blue-600 hover:underline">필터 초기화</button>
            </div>
          )}

          {/* 행사 카드 목록 */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-3 max-w-3xl">
              {filtered.map(evt => {
                const style = LIFECYCLE_STYLE[evt.lifecycle];
                return (
                  <div
                    key={evt.name}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer relative group"
                    onClick={() => navigateTo("EVT-02")}
                  >
                    {/* 더보기 버튼 */}
                    <button
                      className="absolute top-4 right-4 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === evt.name ? null : evt.name); }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuOpen === evt.name && (
                      <div className="absolute top-10 right-4 z-20 bg-white border border-gray-200 shadow-lg rounded-lg py-1 w-36" onClick={e => e.stopPropagation()}>
                        <button className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">행사 정보 수정</button>
                        <button className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">행사 보관</button>
                        <button className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50">행사 삭제</button>
                      </div>
                    )}

                    <div className="pr-6">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2 truncate">{evt.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {evt.date}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {evt.place}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {evt.manager}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {evt.highlights.map(h => (
                          <span key={h} className="inline-flex items-center px-2 py-1 rounded bg-gray-50 border border-gray-100 text-[11px] text-gray-600">{h}</span>
                        ))}
                      </div>
                      {evt.followUpItems && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <AlertCircle className="w-3 h-3 text-orange-400 shrink-0" />
                          <span className="text-[11px] text-orange-600 font-medium">{evt.followUpItems}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400">마지막 수정 {evt.updatedAt}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DesktopShell>

      {/* EVT-00B Modal overlay */}
      {modalOpen && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30" onClick={() => setModalOpen(false)}>
          <div onClick={e => e.stopPropagation()}>
            <EVT00BModal onClose={() => setModalOpen(false)} onCreate={handleCreateEvent} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EVT-00B (standalone view: EVT-00A background + modal open) ───────────────

function EVT00A() { return <EventListScreen />; }

function EVT00A2() {
  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "이수현", dept: "기획부", role: "부서장" }
    }}>
      <EventListScreen manager />
    </AppContext.Provider>
  );
}

function EVT00B() {
  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "이수현", dept: "기획부", role: "부서장" }
    }}>
    <div className="relative h-full">
      <DesktopShell
        activeSidebar="운영"
        breadcrumb={["운영", "행사"]}
        title="행사"
        actions={
          <Btn variant="primary" size="sm">
            <Plus className="w-3.5 h-3.5" /> 새 행사 만들기
          </Btn>
        }
      >
        <div className="p-6 flex flex-col gap-5">
          <p className="text-sm text-gray-500">행사 공간에서 회의, 업무, 일정, 운영 조직과 참가자를 함께 관리할 수 있습니다.</p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input placeholder="행사명 검색" className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm placeholder-gray-400" readOnly />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 max-w-3xl opacity-30 pointer-events-none">
            {EVT_LIST_DATA.filter(e => e.lifecycle !== "완료" && e.lifecycle !== "취소됨").map(evt => {
              const style = LIFECYCLE_STYLE[evt.lifecycle];
              return (
                <div key={evt.name} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${style.badge}`}>{style.label}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{evt.name}</h3>
                  <div className="flex gap-4 mb-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{evt.date}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{evt.place}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DesktopShell>

      {/* Modal always open in this screen */}
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
        <EVT00BModal />
      </div>
    </div>
    </AppContext.Provider>
  );
}

// ─── Event Screens ────────────────────────────────────────────────────────────

function EVT01() {
  const { navigateTo } = React.useContext(AppContext);
  const [mode, setMode] = useState<"import" | "select" | "empty">("import");
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[860px] shadow-sm">
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-1">2026 소프트웨어융합대학 체육대회</p>
          <h2 className="text-lg font-semibold text-gray-900">행사 운영 조직 설정</h2>
          <p className="text-sm text-gray-500 mt-1">행사에 참여할 운영 조직을 설정합니다. 기본 학생회 조직과는 별도로 관리됩니다.</p>
        </div>

        {/* Mode cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {([
            { k: "import" as const, title: "기본 조직 불러오기", desc: "학생회 기본 조직 구조를 그대로 사용합니다." },
            { k: "select" as const, title: "참여 부서만 선택", desc: "참여하는 부서와 팀원만 골라 구성합니다." },
            { k: "empty" as const, title: "빈 조직", desc: "조직을 처음부터 새로 구성합니다." },
          ]).map(({ k, title, desc }) => (
            <button key={k} onClick={() => setMode(k)} className={`border rounded-lg p-4 text-left transition-colors ${mode === k ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
              <p className={`text-sm font-semibold mb-1 ${mode === k ? "text-blue-700" : "text-gray-800"}`}>{title}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">행사 책임자<span className="text-red-500">*</span></label>
            <div className="relative w-64">
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8">
                <option>김바다</option>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-3">참여 팀 구성</p>
            <div className="flex gap-4">
              {[
                { name: "운영팀", leader: "이윤슬", mems: [members[0], members[1]] },
                { name: "홍보팀", leader: undefined, mems: [members[2]] },
                { name: "현장팀", leader: "정하늘", mems: [members[0]] },
              ].map(({ name, leader, mems }) => (
                <DeptCard key={name} name={name} leader={leader} members={mems} />
              ))}
              <DeptCard name="" members={[]} addDept />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded p-3">
            <p className="text-xs text-blue-600">행사 조직을 변경해도 기본 학생회 조직에는 영향을 주지 않습니다.</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8">
          <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-03C")}><ArrowLeft className="w-4 h-4" /> 이전</Btn>
          <Btn variant="primary" size="md" onClick={() => navigateTo("EVT-03A")}>저장</Btn>
        </div>
      </div>
    </div>
  );
}

const EVENT_TABS = ["개요", "업무", "재정", "관련 회의", "일정", "인원 관리", "문서"];
const EVENT_TAB_SCREENS: Record<string, string> = {
  "개요": "EVT-02",
  "업무": "EVT-TASK-01",
  "재정": "EVT-FIN-01",
  "관련 회의": "EVT-MEET-01",
  "일정": "EVT-SCHED-01",
  "인원 관리": "EVT-03A",
  "문서": "EVT-DOC-01",
};

// 권한 판정은 docs/VADA_PERMISSION_MATRIX.md를 단일 기준으로 한다.
// 행사 공통 헤더의 기본정보 수정·상태 전환: 행사 운영 조직 관리자 + 회장단
const isEventManager = (user: { name: string; role: string }) =>
  user.role === "회장단" || user.role === "행사 운영 관리자";

// 예산 수정·구매 승인·구매 발주·증빙 처리: 재정부 · 회장단
const canManageFinance = (user: { dept: string; role: string }) =>
  user.dept === "재정부" || user.role === "회장단";

function EventWorkspaceHeader() {
  const { eventInfo, eventLifecycle, currentUser, eventTasks, navigateTo, setEventLifecycle } = React.useContext(AppContext);
  const canManage = isEventManager(currentUser);
  const eventDate = eventInfo.startAt ? `${eventInfo.startAt.slice(5, 10).replace("-", ".")} ${eventInfo.startAt.slice(11, 16)}` : "일시 미정";
  const delayedCount = eventTasks.filter(task => task.delayed).length;
  const unassignedCount = eventTasks.filter(task => task.assignee === "미지정").length;
  const reviewCount = eventTasks.filter(task => task.status === "검토 필요").length;
  const openTasks = [...eventTasks].filter(task => task.status !== "완료").sort((a, b) => a.due.localeCompare(b.due));
  const nextTask = openTasks.find(task => task.due >= "2026-07-19") ?? openTasks[0];
  const eventHealth = delayedCount > 0
    ? { label: "주의", badge: "bg-red-50 text-red-800 border-red-200", reason: `지연 업무 ${delayedCount}건` }
    : unassignedCount > 0
    ? { label: "주의", badge: "bg-yellow-50 text-yellow-800 border-yellow-200", reason: `담당자 없는 업무 ${unassignedCount}건` }
    : reviewCount > 0
    ? { label: "확인", badge: "bg-yellow-50 text-yellow-800 border-yellow-200", reason: `검토 필요 ${reviewCount}건` }
    : { label: "안정", badge: "bg-green-50 text-green-800 border-green-200", reason: "업무 이슈 없음" };
  const primaryAction = eventLifecycle === "기획 중"
    ? { label: "행사 시작", onClick: () => setEventLifecycle("진행 중") }
    : eventLifecycle === "진행 중"
    ? { label: "행사 종료", onClick: () => navigateTo("EVT-02C") }
    : eventLifecycle === "후속 정리 중"
    ? { label: "행사 완료 처리", onClick: () => navigateTo("EVT-02E") }
    : null;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shrink-0">
      <div className="flex items-center gap-2 shrink-0">
        <Chip label={LIFECYCLE_STYLE[eventLifecycle].label} variant={eventLifecycle === "진행 중" ? "green" : eventLifecycle === "후속 정리 중" ? "yellow" : "blue"} />
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${eventHealth.badge}`}>{eventHealth.label} · {eventHealth.reason}</span>
      </div>
      <div className="h-4 border-l border-gray-200" />
      <div className="flex items-center gap-4 min-w-0 text-[11px] text-gray-500">
        <span className="truncate">담당 {eventInfo.dept || "미정"} · {eventInfo.manager || "미정"}</span>
        <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3.5 h-3.5 text-gray-400" />{eventDate}</span>
        <span className="hidden xl:inline shrink-0">다음 일정 · {nextTask ? `${nextTask.due.slice(5).replace("-", ".")} ${nextTask.name}` : "미정"}</span>
      </div>
      {canManage ? (
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-02B")}>기본정보 수정</Btn>
          {primaryAction && <Btn variant="primary" size="sm" onClick={primaryAction.onClick}>{primaryAction.label}</Btn>}
        </div>
      ) : (
        <p className="ml-auto text-[10px] text-gray-400 shrink-0">행사 관리 행동은 담당 운영진에게 제공됩니다.</p>
      )}
    </div>
  );
}

// shared EVT-02 inner content used across lifecycle states
function EVT02Content({ lifecycle }: { lifecycle: EventLifecycle }) {
  const { eventInfo, surveySettings, eventTasks, navigateTo, currentUser, setEventWorkspaceFilter } = React.useContext(AppContext);
  const canManage = isEventManager(currentUser);
  const style = LIFECYCLE_STYLE[lifecycle];

  const feeDisplay =
    eventInfo.feeType === "무료" ? "무료" :
    eventInfo.feeType === "정액 유료" ? eventInfo.feeAmount || "금액 미입력" :
    eventInfo.feeType === "학생회비 조건부" ? `납부자 ${eventInfo.feePaidAmount === "0" ? "무료" : eventInfo.feePaidAmount + "원"} / 미납자 ${eventInfo.feeUnpaidAmount}원` :
    "미정";

  const capacityDisplay =
    eventInfo.capacityType === "제한없음" ? "제한 없음" :
    eventInfo.capacityType === "인원제한" ? `${eventInfo.capacityCount || "미입력"}명` :
    "미정";

  const startDate = eventInfo.startAt ? new Date(eventInfo.startAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", weekday: "short" }) : "미정";
  const unassignedTasks = eventTasks.filter(task => task.assignee === "미지정");
  const openTasks = [...eventTasks].filter(task => task.status !== "완료").sort((a, b) => a.due.localeCompare(b.due));
  const nextTask = openTasks.find(task => task.due >= "2026-07-19") ?? openTasks[0];

  return (
    <div className="p-6 flex flex-col gap-5">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3.5 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div><p className="text-sm text-blue-800">모집 마감까지 3일 남았습니다. 정원 {eventInfo.capacityCount || "?"}명 중 {surveySettings.responseCount}명이 신청했고, <strong>명단 확인이 필요한 신청자가 6명</strong> 있습니다.</p><p className="text-[11px] text-blue-600 mt-1">현재 상태: {style.label} · 다음 운영 단계는 모집 마감 확인입니다.</p></div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "담당자 없는 업무", value: `${unassignedTasks.length}건`, desc: unassignedTasks.length > 0 ? unassignedTasks.map(task => task.name).join(" · ") : "모든 업무가 배정됨", screen: "EVT-TASK-01", filter: "unassignedTasks" as const, tone: "red" },
          { label: "확인 필요 참가자", value: "6명", desc: "학번·이름 또는 납부 확인", screen: "EVT-04", filter: "participantReview" as const, tone: "yellow" },
          { label: "다음 핵심 일정", value: nextTask?.name ?? "예정 업무 없음", desc: nextTask ? `${nextTask.due.slice(5).replace("-", ".")} · ${nextTask.assignee === "미지정" ? "담당자 배정 필요" : nextTask.assignee}` : "행사 일정에서 다음 일정을 확인하세요.", screen: "EVT-SCHED-01", filter: null, tone: "blue" },
        ].map(item => (
          <button key={item.label} onClick={() => { setEventWorkspaceFilter(item.filter); navigateTo(item.screen); }} className={`text-left border rounded-lg p-4 hover:shadow-sm transition-all ${item.tone === "red" ? "bg-red-50 border-red-200 hover:border-red-300" : item.tone === "yellow" ? "bg-yellow-50 border-yellow-200 hover:border-yellow-300" : "bg-blue-50 border-blue-200 hover:border-blue-300"}`}>
            <p className="text-[10px] text-gray-500">{item.label}</p><p className={`text-lg font-bold mt-1 ${item.tone === "red" ? "text-red-700" : item.tone === "yellow" ? "text-yellow-800" : "text-blue-700"}`}>{item.value}</p><p className="text-[10px] text-gray-500 mt-1">{item.desc} →</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-1 flex flex-col gap-4">
          {/* 행사 기본 정보 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-700">행사 기본 정보</p>
              {canManage && <button onClick={() => navigateTo("EVT-02B")} className="text-[11px] text-blue-500 hover:text-blue-700">정보 수정 →</button>}
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                ["행사명", eventInfo.name || "미정"],
                ["일시", eventInfo.startAt ? `${startDate} ${eventInfo.startAt.slice(11, 16)}` : "미정"],
                ["장소", eventInfo.placeConfirmed ? (eventInfo.placeName || "미정") : "미정"],
                ["참여 대상", eventInfo.target || "미정"],
                ["참가비", feeDisplay],
                ["모집 정원", capacityDisplay],
                ["문의", eventInfo.contact || "미정"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2 min-w-0">
                  <span className="text-[10px] text-gray-400 w-20 shrink-0 pt-px">{k}</span>
                  <span className="text-xs text-gray-700 flex-1 break-words min-w-0">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 모집 설정 요약 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-700">모집 설정</p>
              <button onClick={() => navigateTo("EVT-05")} className="text-[11px] text-blue-500 hover:text-blue-700">참여 설문에서 수정 →</button>
            </div>
            <div className="flex flex-col gap-2">
              {[
                ["설문 상태", surveySettings.status],
                ["신청 기간", surveySettings.endAt ? `${surveySettings.startAt.slice(5,10).replace("-",".")} ~ ${surveySettings.endAt.slice(5,10).replace("-",".")}` : "마감일 미입력"],
                ["신청 방식", surveySettings.method],
                ["신청자", `${surveySettings.responseCount}명`],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-[10px] text-gray-400 w-20 shrink-0 pt-px">{k}</span>
                  <span className="text-xs text-gray-700 flex-1">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2 flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "신청자", value: `${surveySettings.responseCount}명`, sub: `정원 ${eventInfo.capacityCount || "?"}명`, color: "blue" },
              { label: "납부 확인", value: "129명", sub: "미납 13명", color: "green" },
              { label: "확인 필요", value: "6명", sub: "명단 불일치", color: "yellow" },
              { label: "담당자 없는 업무", value: "2개", sub: "처리 필요", color: "red" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className={`border rounded-lg p-3 ${color === "blue" ? "border-blue-200 bg-blue-50" : color === "green" ? "border-green-200 bg-green-50" : color === "yellow" ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}`}>
                <p className={`text-[10px] font-medium mb-1 ${color === "blue" ? "text-blue-600" : color === "green" ? "text-green-700" : color === "yellow" ? "text-yellow-700" : "text-red-600"}`}>{label}</p>
                <p className={`text-lg font-bold ${color === "blue" ? "text-blue-800" : color === "green" ? "text-green-800" : color === "yellow" ? "text-yellow-800" : "text-red-800"}`}>{value}</p>
                <p className={`text-[10px] mt-0.5 ${color === "blue" ? "text-blue-500" : color === "green" ? "text-green-600" : color === "yellow" ? "text-yellow-600" : "text-red-500"}`}>{sub}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">지금 확인해야 할 항목</p>
            <div className="flex flex-col divide-y divide-gray-50">
              {[
                { icon: AlertCircle, color: "text-yellow-500", title: "명단 확인이 필요한 신청자 6명", desc: "학번·이름 불일치 또는 명단 외 학생", action: "참가자 명단 보기", screen: "EVT-04", filter: "participantReview" as const },
                { icon: Clock, color: "text-orange-500", title: "모집 마감까지 3일 남았습니다", desc: "2026. 07. 20 마감", action: null },
                { icon: AlertCircle, color: "text-red-400", title: "담당자 없는 업무 2개", desc: "현장 준비 · 장비 반납", action: "업무 보기", screen: "EVT-TASK-01", filter: "unassignedTasks" as const },
                { icon: Check, color: "text-green-500", title: "QR 참석 확인 설정 완료", desc: "행사 시작 시 활성화", action: null },
              ].map(({ icon: Icon, color, title, desc, action, screen, filter }) => (
                <div key={title} className="flex items-start gap-3 py-2.5">
                  <Icon className={`w-3.5 h-3.5 ${color} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">{title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                  </div>
                  {action && <button onClick={() => { setEventWorkspaceFilter(filter ?? null); screen && navigateTo(screen); }} className="text-[11px] text-blue-500 hover:text-blue-700 shrink-0">{action} →</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">최근 변경 사항</p>
            <div className="flex flex-col gap-2">
              {[
                ["오늘 10:30", "신규 신청자 5명 추가"],
                ["어제 16:20", "QR 참석 확인 활성화"],
                ["07. 14", "행사 장소 ERICA 체육관으로 확정"],
                ["07. 12", "운영 조직 구성 완료"],
              ].map(([time, desc]) => (
                <div key={desc} className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400 w-24 shrink-0">{time}</span>
                  <span className="text-gray-700">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EVT02() {
  const { navigateTo, currentUser, eventLifecycle } = React.useContext(AppContext);
  const isFinanceMember = canManageFinance(currentUser);
  const canManage = isEventManager(currentUser);

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회"]}
      title="2026 소프트웨어융합대학 체육대회"
      actions={canManage ? <Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-02B")}><Settings className="w-3.5 h-3.5" /> 행사 설정</Btn> : undefined}
      tabs={EVENT_TABS}
      activeTab="개요"
      tabScreens={EVENT_TAB_SCREENS}
    >
      <div className="flex flex-col h-full overflow-auto">
        <EVT02Content lifecycle={eventLifecycle} />
        {isFinanceMember && (
          <div className="p-6 pt-0">
             <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <BarChart2 className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-orange-900">재정 관리 워크스페이스</p>
                    <p className="text-xs text-orange-700">재정부 업무 탭에서 구매 요청 및 예산을 관리할 수 있습니다.</p>
                  </div>
                </div>
                <Btn variant="primary" className="bg-orange-600 hover:bg-orange-700 border-orange-600" onClick={() => navigateTo("FIN-WORK-01")}>업무로 이동</Btn>
             </div>
          </div>
        )}
      </div>
    </DesktopShell>
  );
}

function EVT02B() {
  const { eventInfo, setEventInfo, surveySettings, navigateTo } = React.useContext(AppContext);
  const [draft, setDraft] = useState<EventInfo>({ ...eventInfo });
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Reset draft when eventInfo changes externally
  React.useEffect(() => { setDraft({ ...eventInfo }); }, []);

  const upd = <K extends keyof EventInfo>(k: K, v: EventInfo[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  const Section = ({ title, hint }: { title: string; hint?: string }) => (
    <div className="border-t border-gray-100 pt-4 mt-1">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        {hint && <span className="text-[10px] text-blue-500">{hint}</span>}
      </div>
    </div>
  );

  const AutoHint = ({ text }: { text: string }) => (
    <span className="inline-block text-[10px] text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded mt-1">{text}</span>
  );

  // Compute actual diff for save modal
  const isActiveSurvey = surveySettings.status === "활성";
  const publicFields: (keyof EventInfo)[] = ["startAt", "endAt", "placeName", "feeType", "feeAmount", "feePaidAmount", "feeUnpaidAmount"];
  const changedPublic = publicFields.filter(k => draft[k] !== eventInfo[k]);
  const hasChanges = (Object.keys(draft) as (keyof EventInfo)[]).some(k => draft[k] !== eventInfo[k]);

  const handleSave = () => {
    if (!hasChanges) { navigateTo("EVT-02"); return; }
    if (isActiveSurvey && changedPublic.length > 0) { setShowSaveConfirm(true); return; }
    setEventInfo(draft);
    navigateTo("EVT-02");
  };

  const handleConfirmSave = () => {
    setEventInfo(draft);
    setShowSaveConfirm(false);
    navigateTo("EVT-02");
  };

  const fieldLabel: Record<string, string> = {
    startAt: "행사 시작 일시", endAt: "행사 종료 일시",
    placeName: "장소", feeType: "참가비 유형",
    feeAmount: "참가비 금액", feePaidAmount: "납부자 금액", feeUnpaidAmount: "미납자 금액",
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", draft.name]}
      title={draft.name}
      actions={<></>}
      tabs={EVENT_TABS}
      activeTab="개요"
    >
      <div className="flex h-full relative">
        <div className="flex-1 p-6 opacity-25 pointer-events-none overflow-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3.5 mb-4">
            <p className="text-sm text-blue-800">모집 마감까지 3일 남았습니다.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg h-64" />
        </div>

        <aside className="w-[440px] shrink-0 border-l border-gray-200 bg-white flex flex-col shadow-xl">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">행사 기본정보 수정</p>
              <p className="text-[10px] text-gray-400 mt-0.5">저장하면 일정·참여 설문에 자동 반영됩니다</p>
            </div>
            <button onClick={() => navigateTo("EVT-02")} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-auto p-5 flex flex-col gap-3">
            {/* 행사 정보 */}
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">행사 정보</p>
              <Input label="행사명" value={draft.name} onChange={e => upd("name", e.target.value)} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">행사 소개</label>
                <textarea rows={2} className="border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" value={draft.intro} onChange={e => upd("intro", e.target.value)} placeholder="행사에 대한 간단한 소개" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">행사 목적·주요 내용</label>
                <textarea rows={2} className="border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" value={draft.purpose} onChange={e => upd("purpose", e.target.value)} placeholder="행사의 목적이나 프로그램 개요" />
              </div>
            </div>

            {/* 일시 */}
            <Section title="일시" hint="일정 및 참여 설문에 자동 반영" />
            <div className="flex flex-col gap-2 -mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">시작 일시</label>
                <input type="datetime-local" className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" value={draft.startAt} onChange={e => upd("startAt", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">종료 일시</label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={draft.noEndTime} onChange={e => upd("noEndTime", e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300" />
                    <span className="text-[11px] text-gray-500">종료 시간 미정</span>
                  </label>
                </div>
                <input type="datetime-local" disabled={draft.noEndTime} className={`border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${draft.noEndTime ? "bg-gray-50 text-gray-400 border-gray-200" : "border-gray-300"}`} value={draft.noEndTime ? "" : draft.endAt} onChange={e => upd("endAt", e.target.value)} />
              </div>
            </div>

            {/* 장소 */}
            <Section title="장소" hint="일정·참여 설문·공지에 자동 반영" />
            <div className="flex flex-col gap-2 -mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">장소</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!draft.placeConfirmed} onChange={e => upd("placeConfirmed", !e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300" />
                  <span className="text-[11px] text-gray-500">장소 미정</span>
                </label>
              </div>
              {draft.placeConfirmed ? (
                <>
                  <Input placeholder="장소명 예: ERICA 체육관" value={draft.placeName} onChange={e => upd("placeName", e.target.value)} />
                  <Input placeholder="주소 예: 경기 안산시 상록구 한양대학로 55" value={draft.placeAddress} onChange={e => upd("placeAddress", e.target.value)} />
                  <Input placeholder="상세 위치·집합 장소" value={draft.placeDetail} onChange={e => upd("placeDetail", e.target.value)} />
                </>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">미정으로 저장됩니다</div>
              )}
            </div>

            {/* 참여 정보 */}
            <Section title="참여 정보" />
            <div className="flex flex-col gap-3 -mt-2">
              <Input label="참가 대상" placeholder="예: 소프트웨어융합대학 전체" value={draft.target} onChange={e => upd("target", e.target.value)} />

              {/* 참가비 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">참가비</label>
                <AutoHint text="참여 설문에 자동 반영" />
                <div className="flex flex-wrap gap-2 mt-1">
                  {(["무료", "정액 유료", "학생회비 조건부", "미정"] as FeeType[]).map(v => (
                    <button key={v} onClick={() => upd("feeType", v)} className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${draft.feeType === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>{v}</button>
                  ))}
                </div>
                {draft.feeType === "정액 유료" && (
                  <div className="flex flex-col gap-2 mt-1 pl-3 border-l-2 border-blue-100">
                    <Input label="금액" placeholder="예: 5,000원" value={draft.feeAmount} onChange={e => upd("feeAmount", e.target.value)} />
                    <Input label="결제 안내" placeholder="예: 행사 당일 현장 납부" value={draft.feePayment} onChange={e => upd("feePayment", e.target.value)} />
                  </div>
                )}
                {draft.feeType === "학생회비 조건부" && (
                  <div className="flex flex-col gap-2 mt-1 pl-3 border-l-2 border-blue-100">
                    <div className="bg-blue-50 border border-blue-100 rounded p-2 text-[10px] text-blue-700">
                      참여 설문에서 학생회비 납부 여부 대조를 활성화하면 신청자를 자동으로 분류합니다. 명단과 불일치하는 신청자는 "확인 필요"로 분류됩니다.
                    </div>
                    <Input label="납부자 금액 (0원 가능)" placeholder="예: 0 (무료)" value={draft.feePaidAmount} onChange={e => upd("feePaidAmount", e.target.value)} />
                    <Input label="미납자 금액" placeholder="예: 5000" value={draft.feeUnpaidAmount} onChange={e => upd("feeUnpaidAmount", e.target.value)} />
                    <Input label="결제 안내" placeholder="예: 현장 납부" value={draft.feePayment} onChange={e => upd("feePayment", e.target.value)} />
                  </div>
                )}
              </div>

              {/* 행사 정원 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">행사 정원</label>
                <AutoHint text="신청 인원 관리에 자동 반영" />
                <div className="flex gap-2 mt-1">
                  {(["제한없음", "인원제한", "미정"] as CapacityType[]).map(v => (
                    <button key={v} onClick={() => upd("capacityType", v)} className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${draft.capacityType === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>{v}</button>
                  ))}
                </div>
                {draft.capacityType === "인원제한" && (
                  <div className="mt-1 pl-3 border-l-2 border-blue-100">
                    <Input label="정원 인원" placeholder="예: 200" value={draft.capacityCount} onChange={e => upd("capacityCount", e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {/* 담당 및 안내 */}
            <Section title="담당 및 안내" hint="설문·참가자 안내에 자동 반영" />
            <div className="flex flex-col gap-2 -mt-2">
              <Input label="담당 부서" placeholder="예: 학술체육부" value={draft.dept} onChange={e => upd("dept", e.target.value)} />
              <Input label="담당자" placeholder="예: 김바다 (학술체육부장)" value={draft.manager} onChange={e => upd("manager", e.target.value)} />
              <Input label="문의 방법·연락처" placeholder="예: 카카오톡 채널 @swcollege" value={draft.contact} onChange={e => upd("contact", e.target.value)} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">참가자 유의사항</label>
                <AutoHint text="참여 설문 안내 영역에 자동 반영" />
                <textarea rows={2} className="border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1" value={draft.notice} onChange={e => upd("notice", e.target.value)} placeholder="사전에 안내할 유의사항을 입력하세요" />
              </div>
            </div>

            {isActiveSurvey && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-700 leading-relaxed">
                설문 링크가 활성화된 상태에서 일시·장소·참가비를 변경하면 저장 전에 변경 내용을 확인하는 모달이 표시됩니다. 링크는 강제로 비활성화되지 않습니다.
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
            <p className="text-[10px] text-gray-400">신청 기간·승인제 설정은 참여 설문에서</p>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-02")}>취소</Btn>
              <Btn variant="primary" size="sm" onClick={handleSave}>저장</Btn>
            </div>
          </div>

          {showSaveConfirm && (
            <div className="absolute inset-0 bg-black/40 flex items-end z-40">
              <div className="w-full bg-white rounded-t-xl p-5 shadow-2xl">
                <p className="text-sm font-semibold text-gray-900 mb-1">변경 사항을 확인해 주세요</p>
                <p className="text-xs text-gray-500 mb-3">활성 설문에 자동 반영되며 기존 신청 응답은 유지됩니다.</p>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-4 flex flex-col gap-1.5 text-xs text-gray-700">
                  {changedPublic.map(k => (
                    <div key={k} className="flex gap-2">
                      <span className="text-gray-400 w-24 shrink-0">{fieldLabel[k] || k}</span>
                      <span className="text-gray-500 line-through mr-1">{String(eventInfo[k]) || "미입력"}</span>
                      <span className="text-blue-700">→ {String(draft[k]) || "미입력"}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded p-2.5 mb-4 text-xs text-orange-700 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  변경 사항은 기존 신청자에게 별도 공지가 필요할 수 있습니다.
                </div>
                <div className="flex gap-2 justify-end">
                  <Btn variant="secondary" size="sm" onClick={() => setShowSaveConfirm(false)}>계속 편집</Btn>
                  <button className="text-xs text-blue-600 hover:underline mr-1">변경 공지 만들기</button>
                  <Btn variant="primary" size="sm" onClick={handleConfirmSave}>저장 완료</Btn>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </DesktopShell>
  );
}

// ─── EVT-02C 행사 종료 확인 모달 ─────────────────────────────────────────────

function EVT02C() {
  const { navigateTo, setEventLifecycle } = React.useContext(AppContext);
  return (
    <div className="relative h-full">
      <DesktopShell
        activeSidebar="운영"
        breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회"]}
        title="2026 소프트웨어융합대학 체육대회"
        actions={<Btn variant="secondary" size="sm"><Settings className="w-3.5 h-3.5" /> 행사 설정</Btn>}
        tabs={EVENT_TABS}
        activeTab="개요"
      >
        <div className="opacity-30 pointer-events-none">
          <EVT02Content lifecycle="진행 중" />
        </div>
      </DesktopShell>
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[440px] p-8">
          <h3 className="text-base font-semibold text-gray-900 mb-2">행사를 종료할까요?</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            행사 운영은 종료되지만 미완료 업무와 문서를 계속 정리할 수 있습니다.{" "}
            행사 상태는 <span className="font-semibold text-orange-600">'후속 정리 중'</span>으로 변경됩니다.
          </p>
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-02")}>취소</Btn>
            <Btn variant="primary" size="md" onClick={() => { setEventLifecycle("후속 정리 중"); navigateTo("EVT-02D"); }}>행사 종료</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EVT-02D 행사 개요 대시보드 — 후속 정리 중 ───────────────────────────────

function EVT02D() {
  const { navigateTo } = React.useContext(AppContext);
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회"]}
      title="2026 소프트웨어융합대학 체육대회"
      actions={<Btn variant="secondary" size="sm"><Settings className="w-3.5 h-3.5" /> 행사 설정</Btn>}
      tabs={EVENT_TABS}
      activeTab="개요"
    >
      <div className="p-6 flex flex-col gap-5">
        {/* 상태 배지 + 완료 처리 버튼 */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${LIFECYCLE_STYLE["후속 정리 중"].badge}`}>
            후속 정리 중
          </span>
          <Btn variant="primary" size="sm" onClick={() => navigateTo("EVT-02E")}>행사 완료 처리</Btn>
        </div>

        {/* 후속 정리 안내 배너 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800 mb-0.5">행사는 종료되었으며 후속 정리가 진행 중입니다.</p>
            <p className="text-xs text-orange-700">남은 업무와 기록을 확인한 후 행사를 완료 처리할 수 있습니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Left: 후속 정리 현황 */}
          <div className="col-span-1 flex flex-col gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">후속 정리 현황</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: "미완료 업무", value: "3건", color: "text-red-600 bg-red-50 border-red-200", action: "업무 보기" },
                  { label: "정리되지 않은 문서", value: "2건", color: "text-orange-600 bg-orange-50 border-orange-200", action: "문서 보기" },
                  { label: "미작성 회의·결정 기록", value: "1건", color: "text-yellow-700 bg-yellow-50 border-yellow-200", action: "관련 회의 보기" },
                  { label: "확인 필요 참가자", value: "0명", color: "text-green-700 bg-green-50 border-green-200", action: null },
                ].map(({ label, value, color, action }) => (
                  <div key={label} className={`border rounded-lg p-3 flex items-center justify-between ${color.split(" ").slice(1).join(" ")}`}>
                    <div>
                      <p className="text-[10px] text-gray-500">{label}</p>
                      <p className={`text-sm font-bold ${color.split(" ")[0]}`}>{value}</p>
                    </div>
                    {action && <button onClick={() => navigateTo(action === "업무 보기" ? "EVT-TASK-01" : action === "문서 보기" ? "EVT-DOC-01" : "EVT-MEET-01")} className="text-[11px] text-blue-500 hover:text-blue-700">{action} →</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* 기본 정보 카드 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700">행사 기본 정보</p>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  ["행사명", "2026 소프트웨어융합대학 체육대회"],
                  ["일시", "2026. 08. 20 (목) 10:00"],
                  ["장소", "ERICA 체육관"],
                  ["참석자", "186명 (실제 참석)"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-[10px] text-gray-400 w-16 shrink-0 pt-px">{k}</span>
                    <span className="text-xs text-gray-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: 최근 변경 */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">남은 항목 상세</p>
              <div className="flex flex-col divide-y divide-gray-50">
                {[
                  { icon: AlertCircle, color: "text-red-400", title: "미완료 업무 3건", desc: "장비 반납 · 현장 정리 보고 · 결과 보고서 작성", action: "업무 보기" },
                  { icon: FileText, color: "text-orange-400", title: "정리되지 않은 문서 2건", desc: "행사 결과 보고서 · 참가자 명단 최종본", action: "문서 보기" },
                  { icon: Clock, color: "text-yellow-500", title: "미작성 회의·결정 기록 1건", desc: "행사 당일 운영 결정 사항 기록 필요", action: "관련 회의 보기" },
                  { icon: Check, color: "text-green-500", title: "참가자 정보 정리 완료", desc: "186명 실제 참석 확인 완료", action: null },
                ].map(({ icon: Icon, color, title, desc, action }) => (
                  <div key={title} className="flex items-start gap-3 py-2.5">
                    <Icon className={`w-3.5 h-3.5 ${color} shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-800">{title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                    </div>
                    {action && <button onClick={() => navigateTo(action === "업무 보기" ? "EVT-TASK-01" : action === "문서 보기" ? "EVT-DOC-01" : "EVT-MEET-01")} className="text-[11px] text-blue-500 hover:text-blue-700 shrink-0">{action} →</button>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">최근 변경 사항</p>
              <div className="flex flex-col gap-2">
                {[
                  ["오늘 09:10", "장비 반납 업무 담당자 지정"],
                  ["어제 18:40", "실제 참석자 186명 확정"],
                  ["08. 20 22:00", "행사 종료 처리"],
                ].map(([time, desc]) => (
                  <div key={desc} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400 w-28 shrink-0">{time}</span>
                    <span className="text-gray-700">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── EVT-02E 행사 완료 처리 확인 모달 ────────────────────────────────────────

function EVT02E({ hasRemaining = true }: { hasRemaining?: boolean }) {
  const { navigateTo, setEventLifecycle } = React.useContext(AppContext);
  const completeEvent = () => { setEventLifecycle("완료"); navigateTo("REC-01"); };
  return (
    <div className="relative h-full">
      <DesktopShell
        activeSidebar="운영"
        breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회"]}
        title="2026 소프트웨어융합대학 체육대회"
        actions={<Btn variant="secondary" size="sm"><Settings className="w-3.5 h-3.5" /> 행사 설정</Btn>}
        tabs={EVENT_TABS}
        activeTab="개요"
      >
        <div className="opacity-30 pointer-events-none">
          <EVT02Content lifecycle="후속 정리 중" />
        </div>
      </DesktopShell>
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[480px] p-8">
          {hasRemaining ? (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-4">아직 정리되지 않은 항목이 있습니다</h3>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-5">
                <div className="flex flex-col gap-2">
                  {[
                    { icon: AlertCircle, color: "text-red-500", text: "미완료 업무 3건" },
                    { icon: FileText, color: "text-orange-500", text: "정리되지 않은 문서 2건" },
                    { icon: Clock, color: "text-yellow-600", text: "미작성 회의록 1건" },
                  ].map(({ icon: Icon, color, text }) => (
                    <div key={text} className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                      <span className="text-xs text-gray-700">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                완료 처리 후에도 행사 기록은 열람할 수 있습니다. 남은 항목을 확인한 뒤 완료하는 것을 권장합니다.
              </p>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-02D")}>계속 정리하기</Btn>
                <Btn variant="destructive" size="md" onClick={completeEvent}>그래도 완료 처리</Btn>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-2">행사를 완료 처리할까요?</h3>
              <p className="text-sm text-gray-500 mb-6">완료된 행사는 <span className="font-medium text-gray-700">'기록 &gt; 완료된 행사'</span>로 이동합니다.</p>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-02D")}>취소</Btn>
                <Btn variant="primary" size="md" onClick={completeEvent}>완료 처리</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 행사 공통 탭: 관련 회의 · 일정 · 문서 ────────────────────────────────────

function EventWorkspaceShell({
  activeTab, children,
}: {
  activeTab: string;
  children: React.ReactNode;
}) {
  const { eventInfo } = React.useContext(AppContext);
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, activeTab]}
      title={eventInfo.name}
      tabs={EVENT_TABS}
      activeTab={activeTab}
      tabScreens={EVENT_TAB_SCREENS}
    >
      {children}
    </DesktopShell>
  );
}

function EVTMEET01() {
  const { navigateTo, eventInfo, createdMeetings, setSelectedCreatedMeetingId } = React.useContext(AppContext);
  const baseMeetings = [
    { title: "체육대회 운영 점검 회의", date: "2026. 07. 18 (토) 10:00", place: "제1회의실", status: "진행 중", attendees: "참가 8명", screen: "OPS-MEET-05A", variant: "blue" as const },
    { title: "안전 관리 최종 회의", date: "2026. 07. 25 (토) 15:00", place: "학생회실", status: "예정", attendees: "참가 예정 4명", screen: "OPS-MEET-03A", variant: "yellow" as const },
    { title: "참가자 모집 결과 검토", date: "2026. 07. 12 (일) 18:00", place: "온라인 (Discord)", status: "완료", attendees: "참석 6명", screen: "OPS-MEET-07", variant: "green" as const },
  ];
  const createdEventMeetings = createdMeetings
    .filter((meeting) => meeting.group === eventInfo.name)
    .map((meeting) => ({
      id: meeting.id,
      title: meeting.name,
      date: meeting.time,
      place: meeting.place,
      status: meeting.status,
      attendees: `초대 ${meeting.participants}명`,
      screen: "OPS-MEET-03A",
      variant: meeting.status === "완료" || meeting.status === "진행 중" ? "green" as const : meeting.status === "정리 중" ? "yellow" as const : "blue" as const,
    }));
  const meetings = [...baseMeetings, ...createdEventMeetings];
  const countByStatus = (status: string) => meetings.filter((meeting) => meeting.status === status).length;
  return (
    <EventWorkspaceShell activeTab="관련 회의">
      <div className="p-6 flex flex-col gap-5 max-w-5xl">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-3">
          <Users className="w-4 h-4 text-blue-600 mt-0.5" />
          <p className="text-xs text-blue-800">이 행사와 연결된 회의만 모아 봅니다. 회의 생성과 수정 권한은 전체 회의 공간에서 역할에 따라 제공됩니다.</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">관련 회의</h2>
            <p className="text-xs text-gray-500 mt-1">진행 중 {countByStatus("진행 중")}건 · 예정 {countByStatus("예정")}건 · 정리 중 {countByStatus("정리 중")}건 · 완료 {countByStatus("완료")}건</p>
          </div>
          <Btn variant="secondary" size="sm" onClick={() => navigateTo("OPS-MEET-01A")}>전체 회의 보기</Btn>
        </div>
        <div className="flex flex-col gap-3">
          {meetings.map(meeting => (
            <button key={"id" in meeting ? meeting.id : meeting.title} onClick={() => { if ("id" in meeting) { setSelectedCreatedMeetingId(meeting.id); navigateTo("OPS-MEET-03A"); return; } navigateTo(meeting.screen); }} className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2"><Chip label={meeting.status} variant={meeting.variant} /><span className="text-[10px] text-gray-400">행사 연결 회의</span>{"id" in meeting && <Chip label="새로 생성" variant="gray" />}</div>
                  <p className="text-sm font-semibold text-gray-900">{meeting.title}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500"><span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{meeting.date}</span><span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{meeting.place}</span><span>{meeting.attendees}</span></div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 mt-1 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </EventWorkspaceShell>
  );
}

function EVTSCHED01() {
  const { eventInfo, eventTasks, createdMeetings, setSelectedEventTaskId, setSelectedCreatedMeetingId, navigateTo } = React.useContext(AppContext);
  const [filter, setFilter] = useState<"전체" | "이번 주" | "마감" | "회의" | "행사 당일">("전체");
  const eventPeriod = eventInfo.startAt
    ? `${eventInfo.startAt.slice(0, 10).replaceAll("-", ".")} ${eventInfo.startAt.slice(11, 16)}${eventInfo.noEndTime || !eventInfo.endAt ? "부터" : ` ~ ${eventInfo.endAt.slice(11, 16)}`}`
    : "일시 미정";
  const fixedSchedules = [
    { dateValue: new Date("2026-07-20T00:00:00"), date: "07. 20", title: "참여 설문 마감", desc: "신청 현황 및 대기자 확인", kind: "마감", owner: "홍보팀", source: "참여 설문", screen: "EVT-05", tags: ["이번 주", "마감"] },
    { dateValue: new Date("2026-07-25T00:00:00"), date: "07. 25", title: "안전 관리 최종 회의", desc: "관련 회의에서 세부 안건 확인", kind: "회의", owner: "박해랑", source: "관련 회의", screen: "EVT-MEET-01", tags: ["이번 주", "회의"] },
    { dateValue: eventInfo.startAt ? new Date(eventInfo.startAt) : new Date("2099-12-31T00:00:00"), date: eventInfo.startAt ? eventInfo.startAt.slice(5, 10).replace("-", ". ") : "미정", title: eventInfo.name, desc: `${eventPeriod} · ${eventInfo.placeName || "장소 미정"}`, kind: "행사", owner: eventInfo.manager || "미정", source: "행사 기본정보", screen: "EVT-02B", tags: ["행사 당일"] },
  ];
  const taskSchedules = eventTasks.map(task => {
    const dateValue = new Date(`${task.due}T00:00:00`);
    const isThisWeek = task.due >= "2026-07-19" && task.due <= "2026-07-25";
    return {
      dateValue,
      date: task.due.slice(5).replace("-", ". "),
      title: task.name,
      desc: `${task.status}${task.delayed ? " · 지연" : ""} · ${task.description}`,
      kind: "업무",
      owner: task.assignee === "미지정" ? "미지정 · 배정 필요" : task.assignee,
      source: "행사 업무",
      taskId: task.id,
      tags: [...(isThisWeek ? ["이번 주"] : []), "마감"],
    };
  });
  const createdMeetingSchedules = createdMeetings.filter((meeting) => meeting.group === eventInfo.name && meeting.status !== "취소").map((meeting) => {
    const [year, month, day] = meeting.time.split(" ")[0].split(".").map(Number);
    const dateValue = new Date(year, month - 1, day);
    const isThisWeek = meeting.time.slice(0, 10).replaceAll(".", "-") >= "2026-07-19" && meeting.time.slice(0, 10).replaceAll(".", "-") <= "2026-07-25";
    return {
      dateValue,
      date: `${String(month).padStart(2, "0")}. ${String(day).padStart(2, "0")}`,
      title: meeting.name,
      desc: `${meeting.status} · ${meeting.time.slice(11)} · ${meeting.place}`,
      kind: "회의",
      owner: meeting.owner,
      source: "관련 회의",
      createdMeetingId: meeting.id,
      tags: [...(isThisWeek ? ["이번 주"] : []), "회의"],
    };
  });
  const schedules = [
    ...[...fixedSchedules, ...taskSchedules, ...createdMeetingSchedules].sort((a, b) => a.dateValue.getTime() - b.dateValue.getTime()),
    { date: "행사 후", title: "결과 보고·정산 자료 정리", desc: "후속 정리 단계에서 진행", kind: "후속", owner: "미정", source: "행사 업무", screen: "EVT-TASK-01", tags: [] },
  ];
  const visibleSchedules = filter === "전체" ? schedules : schedules.filter(schedule => schedule.tags.includes(filter));
  const openSchedule = (schedule: typeof schedules[number]) => {
    if ("taskId" in schedule && schedule.taskId) {
      setSelectedEventTaskId(schedule.taskId);
      navigateTo("EVT-TASK-02");
      return;
    }
    if ("createdMeetingId" in schedule && schedule.createdMeetingId) {
      setSelectedCreatedMeetingId(schedule.createdMeetingId);
      navigateTo("OPS-MEET-03A");
      return;
    }
    if ("screen" in schedule && schedule.screen) navigateTo(schedule.screen);
  };
  return (
    <EventWorkspaceShell activeTab="일정">
      <div className="p-6 flex flex-col gap-5 max-w-5xl">
        <div className="flex items-center justify-between">
          <div><h2 className="text-sm font-semibold text-gray-900">행사 일정</h2><p className="text-xs text-gray-500 mt-1">업무·회의·행사 기본정보에서 연결된 주요 일정입니다.</p></div>
          <Btn variant="secondary" size="sm" onClick={() => navigateTo("OPS-CAL-01")}>전체 캘린더 보기</Btn>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["전체", "이번 주", "마감", "회의", "행사 당일"] as const).map(item => (
            <button key={item} onClick={() => setFilter(item)} className={`px-3 py-1.5 rounded-full text-xs border ${filter === item ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>{item}</button>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {visibleSchedules.map(schedule => (
            <button key={"taskId" in schedule ? schedule.taskId : "createdMeetingId" in schedule ? schedule.createdMeetingId : schedule.title} onClick={() => openSchedule(schedule)} className="w-full text-left flex gap-5 px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className={`w-16 shrink-0 text-xs font-semibold ${schedule.kind === "행사" ? "text-blue-700" : "text-gray-500"}`}>{schedule.date}</div>
              <div className="w-px bg-gray-200 relative"><span className={`absolute -left-[4px] top-0 w-2 h-2 rounded-full ${schedule.kind === "행사" ? "bg-blue-500" : "bg-gray-300"}`} /></div>
              <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-800">{schedule.title}</p><Chip label={schedule.kind} variant={schedule.kind === "행사" ? "blue" : schedule.kind === "마감" ? "yellow" : "gray"} />{"createdMeetingId" in schedule && <Chip label="새로 생성" variant="gray" />}</div><p className="text-xs text-gray-500 mt-1">{schedule.desc}</p><div className="flex gap-3 mt-2 text-[10px] text-gray-400"><span>담당 · {schedule.owner}</span><span>원본 · {schedule.source}</span></div></div>
              <ChevronRight className="w-4 h-4 text-gray-300 mt-1 shrink-0" />
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">일정은 여기서 중복 수정하지 않습니다. 행사 일시·장소는 기본정보, 회의 일시는 관련 회의, 업무 마감은 행사 업무가 단일 원본입니다.</p>
      </div>
    </EventWorkspaceShell>
  );
}

function EVTDOC01() {
  const { navigateTo } = React.useContext(AppContext);
  const docs = [
    { title: "행사 운영 계획서", category: "기획", status: "확정", updated: "07. 12 · 이수현", desc: "운영 목표, 역할 분담, 당일 진행 순서" },
    { title: "안전 관리 체크리스트", category: "운영", status: "검토 중", updated: "07. 18 · 박해랑", desc: "현장 안전 점검 및 비상 대응 항목" },
    { title: "참가자 명단 최종본", category: "참가자", status: "작성 중", updated: "07. 19 · 김바다", desc: "신청·납부·참석 확인 기준의 최종 명단" },
    { title: "행사 결과 보고서", category: "후속 정리", status: "작성 전", updated: "행사 종료 후", desc: "운영 결과와 정산 자료를 정리하는 문서" },
  ];
  return (
    <EventWorkspaceShell activeTab="문서">
      <div className="p-6 flex flex-col gap-5 max-w-5xl">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-gray-900">행사 문서</h2><p className="text-xs text-gray-500 mt-1">행사 전체 맥락에서 참고하는 문서와 결과물입니다.</p></div><Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-TASK-01")}>업무별 문서 보기</Btn></div>
        <div className="grid grid-cols-2 gap-4">
          {docs.map(doc => (
            <div key={doc.title} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3"><FileText className="w-5 h-5 text-blue-500 shrink-0" /><Chip label={doc.status} variant={doc.status === "확정" ? "green" : doc.status === "검토 중" ? "yellow" : "gray"} /></div>
              <div><p className="text-sm font-semibold text-gray-900">{doc.title}</p><p className="text-xs text-gray-500 mt-1">{doc.desc}</p></div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]"><span className="text-blue-600">{doc.category}</span><span className="text-gray-400">{doc.updated}</span></div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">문서의 작성·검토 권한은 연결된 업무와 행사 운영 역할에 따라 관리합니다.</p>
      </div>
    </EventWorkspaceShell>
  );
}

// ─── OPS-MEET-01A/B 운영 — 전체 회의 ───────────────────────────────────────────

type MeetingListView = "participant" | "facilitator" | "creatorEligible";

function MeetingListScreen({ view = "participant" }: { view?: MeetingListView }) {
  const { navigateTo, createdMeetings, setSelectedCreatedMeetingId, demoDataMode } = React.useContext(AppContext);
  const facilitatorView = view === "facilitator";
  const canCreateMeeting = view === "creatorEligible";
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [sortOrder, setSortOrder] = useState("가까운 순");
  const populatedMeetingGroups = [
    {
      name: "정기·상시 회의",
      count: 2,
      nearest: "07.22 (수) 18:00",
      meetings: [
        { name: "학생회 정기 운영회의", status: "예정", time: "2026.07.22 18:00", place: "학생회실 (A204)", owner: "이수현", participants: 12, agendas: 4, docStatus: "작성 전", relation: "참가자" },
        { name: "7월 예산 검토회의", status: "완료", time: "2026.07.10 14:00", place: "온라인 (Zoom)", owner: "김민준", participants: 5, agendas: 2, docStatus: "정리 완료", relation: "참석" },
      ]
    },
    {
      name: "2026 소프트웨어융합대학 체육대회",
      count: 2,
      nearest: "07.18 (토) 10:00",
      meetings: [
        { name: "체육대회 운영 점검 회의", status: "진행 중", time: "2026.07.18 10:00", place: "제1회의실", owner: "박해랑", participants: 8, agendas: 6, docStatus: "작성 중", relation: facilitatorView ? "진행 권한" : canCreateMeeting ? "참석" : "미참가" },
        { name: "안전 관리 최종 회의", status: "예정", time: "2026.07.25 15:00", place: "학생회실", owner: canCreateMeeting ? "이수현" : "박해랑", participants: 4, agendas: 3, docStatus: "작성 전", relation: facilitatorView ? "진행 권한" : canCreateMeeting ? "회의 생성자" : "참가자" },
      ]
    },
    {
      name: "신입생 환영 행사",
      count: 1,
      nearest: "07.15 (수) 16:00",
      meetings: [
        { name: "신입생 환영 행사 기획회의", status: "정리 중", time: "2026.07.15 16:00", place: "온라인 (Discord)", owner: "이윤슬", participants: 10, agendas: 5, docStatus: facilitatorView ? "정리 필요" : "내용 열람 가능", relation: facilitatorView ? "진행 권한" : canCreateMeeting ? "참석" : "불참" },
      ]
    },
    {
      name: "가을 축제",
      count: 1,
      nearest: "08.05 (수) 13:00",
      meetings: [
        { name: "가을 축제 1차 준비회의", status: "취소", time: "2026.08.05 13:00", place: "미정", owner: "김바다", participants: 15, agendas: 2, docStatus: "취소 사유 등록", relation: "참가자" },
      ]
    }
  ];
  const baseMeetingGroups = demoDataMode === "first-use" ? [] : populatedMeetingGroups;
  const meetingGroups = baseMeetingGroups.map((group) => {
    const additions = createdMeetings.filter((meeting) => meeting.group === group.name);
    return additions.length === 0 ? group : { ...group, count: group.count + additions.length, meetings: [...group.meetings, ...additions] };
  });

  const visibleMeetingGroups = meetingGroups.map((group) => {
    const meetings = group.meetings.filter((meeting) => (statusFilter === "전체" || meeting.status === statusFilter) && meeting.name.includes(keyword.trim())).sort((a, b) => sortOrder === "가까운 순" ? a.time.localeCompare(b.time) : b.time.localeCompare(a.time));
    return { ...group, count: meetings.length, meetings };
  }).filter((group) => group.meetings.length > 0);
  const statusVariant = (s: string) =>
    s === "예정" ? "blue" : s === "진행 중" ? "green" : s === "정리 중" ? "yellow" : s === "완료" ? "gray" : "red";

  const getAction = (status: string, relation: string) => {
    const canFacilitate = relation === "진행 권한" || relation === "회의 생성자";
    if (status === "예정") {
      if (relation === "회의 생성자") return { label: "회의 관리", screen: "OPS-MEET-03B", primary: false };
      if (relation === "진행 권한") return { label: "회의 시작", screen: "OPS-MEET-03C", primary: true };
      return { label: "회의 상세 보기", screen: "OPS-MEET-03A", primary: false };
    }
    if (status === "진행 중") {
      if (canFacilitate) return { label: "회의로 돌아가기", screen: "OPS-MEET-05B", primary: true };
      return { label: relation === "참석" ? "회의로 돌아가기" : "회의 참가", screen: "OPS-MEET-05A", primary: true };
    }
    if (status === "정리 중") {
      if (canFacilitate) return { label: "회의록 정리", screen: "OPS-MEET-06B", primary: true };
      return { label: "회의 내용 보기", screen: "OPS-MEET-06A", primary: false };
    }
    if (status === "완료") return { label: relation === "불참" ? "회의 요약 확인" : "회의록 보기", screen: relation === "불참" ? "OPS-MEET-08" : "OPS-MEET-07", primary: false };
    return { label: "취소 내용 보기", screen: "OPS-MEET-09", primary: false };
  };

  const viewContent = view === "facilitator"
    ? {
        title: "진행 권한자 화면",
        description: "진행 권한이 있는 회의만 시작·진행·정리할 수 있습니다. 새 회의 생성 권한은 별도입니다.",
        count: demoDataMode === "first-use" ? "0건" : "진행 권한 3건",
        box: "bg-indigo-50 border-indigo-100",
        iconBox: "bg-indigo-100",
        iconColor: "text-indigo-600",
        icon: Check,
      }
    : view === "creatorEligible"
      ? {
          title: "회의 생성 가능 화면",
          description: "부서장 권한으로 새 회의를 만들 수 있습니다. 기존 회의 관리는 회의별 관계를 따릅니다.",
          count: demoDataMode === "first-use" ? "0건" : "회의 생성 가능",
          box: "bg-blue-50 border-blue-100",
          iconBox: "bg-blue-100",
          iconColor: "text-blue-600",
          icon: Plus,
        }
      : {
          title: "일반 참가자 화면",
          description: "초대된 회의의 일정과 참가 상태를 확인합니다.",
          count: demoDataMode === "first-use" ? "0건" : "확인 필요한 회의 2건",
          box: "bg-white border-gray-200",
          iconBox: "bg-gray-100",
          iconColor: "text-gray-500",
          icon: User,
        };
  const ViewIcon = viewContent.icon;

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의"]}
      title="회의"
      actions={canCreateMeeting ? <Btn variant="primary" size="sm" onClick={() => navigateTo("OPS-MEET-02")}><Plus className="w-3.5 h-3.5" /> 새 회의 만들기</Btn> : undefined}
    >
      <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">
        <div className={`border rounded-xl px-4 py-3 flex items-center justify-between ${viewContent.box}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${viewContent.iconBox}`}>
              <ViewIcon className={`w-4 h-4 ${viewContent.iconColor}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800">{viewContent.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{viewContent.description}</p>
            </div>
          </div>
          <span className="text-[11px] text-gray-400">{viewContent.count}</span>
        </div>

        {/* 탐색 영역 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="회의명 검색" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-600 focus:outline-none">
              <option value="전체">상태: 전체</option>
              <option>예정</option>
              <option>진행 중</option>
              <option>정리 중</option>
              <option>완료</option><option>취소</option>
            </select>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-600 focus:outline-none">
              <option>가까운 순</option>
              <option>최신 순</option>
            </select>
          </div>
        </div>

        {/* 회의 그룹 리스트 */}
        <div className="flex flex-col gap-6 pb-12">
          {visibleMeetingGroups.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-3">
              {/* 그룹 헤더 */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-bold text-gray-800">{group.name}</h2>
                  <span className="text-xs text-gray-400 font-normal">총 {group.count}건</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>가장 가까운 회의: {group.nearest}</span>
                </div>
              </div>

              {/* 회의 카드 리스트 */}
              <div className="flex flex-col gap-2">
                {group.meetings.map((m, mi) => (
                  <div key={mi} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-blue-300 transition-all cursor-pointer group">
                    <div className="flex items-center gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <Chip label={m.status} variant={statusVariant(m.status)} />
                          <h3 className="text-sm font-bold text-gray-900 truncate">{m.name}</h3>
                          {(m.relation === "회의 생성자" || m.relation === "진행 권한") && <Chip label={m.relation} variant="blue" />}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {m.time}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {m.place}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            {m.owner}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 shrink-0">
                        <div className="flex gap-6 text-center">
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold mb-0.5 uppercase tracking-wider">참가자</p>
                            <p className="text-xs font-bold text-gray-700">{m.participants}명</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold mb-0.5 uppercase tracking-wider">안건</p>
                            <p className="text-xs font-bold text-gray-700">{m.agendas}개</p>
                          </div>
                        </div>
                        <div className="w-28 text-right">
                          <p className="text-[10px] text-gray-400 font-semibold mb-0.5 uppercase tracking-wider">회의록 상태</p>
                          <p className={`text-xs font-bold ${m.docStatus.includes("필요") ? "text-orange-500" : "text-gray-600"}`}>
                            {m.docStatus}
                          </p>
                        </div>
                        {(() => {
                          const action = getAction(m.status, m.relation);
                          return (
                            <Btn
                              variant={action.primary ? "primary" : "secondary"}
                              size="sm"
                              className="min-w-[112px] justify-center"
                              onClick={() => {
                                if (createdMeetings.some((meeting) => meeting.id === m.id)) {
                                  setSelectedCreatedMeetingId(m.id);
                                  navigateTo(m.relation === "회의 생성자" ? "OPS-MEET-03B" : m.relation === "진행 권한" ? "OPS-MEET-03C" : "OPS-MEET-03A");
                                  return;
                                }
                                navigateTo(action.screen);
                              }}
                            >
                              {createdMeetings.some((meeting) => meeting.id === m.id) ? "회의 정보 보기" : action.label}
                            </Btn>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {visibleMeetingGroups.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl py-12 text-center">
              {demoDataMode === "first-use" && !keyword && statusFilter === "전체" ? (
                <>
                  <Calendar className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="mt-3 text-sm font-semibold text-gray-700">아직 등록된 회의가 없습니다</p>
                  <p className="mt-1 text-xs text-gray-400">{canCreateMeeting ? "첫 회의를 만들어 참가자와 안건을 등록해 보세요." : "회의가 만들어지면 일정과 참가 상태를 여기에서 확인할 수 있습니다."}</p>
                  {canCreateMeeting && <Btn variant="primary" size="sm" className="mt-4" onClick={() => navigateTo("OPS-MEET-02")}><Plus className="w-3.5 h-3.5" /> 첫 회의 만들기</Btn>}
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-700">조건에 맞는 회의가 없습니다</p>
                  <button type="button" onClick={() => { setKeyword(""); setStatusFilter("전체"); }} className="mt-2 text-xs text-blue-600">검색·필터 초기화</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </DesktopShell>
  );
}

function OPSMEET01A() {
  return <MeetingListScreen />;
}

function OPSMEET01B() {
  return <MeetingListScreen view="facilitator" />;
}

function OPSMEET01C() {
  return <MeetingListScreen view="creatorEligible" />;
}

// ─── OPS-MEET-02 회의 생성·수정 ────────────────────────────────────────────────

function OPSMEET02() {
  const { navigateTo, setCreatedMeetings, meetingDraft, setMeetingDraft, setDemoDataMode } = React.useContext(AppContext);
  const [meetingType, setMeetingType] = useState<"regular" | "event">(meetingDraft?.meetingType ?? "event");
  // OPS-MEET-01C의 "회의 생성 가능" 시나리오는 이수현(기획부장)의 업무 흐름이다.
  // 화면 간 이동 뒤에도 생성자 표기가 바뀌지 않도록 생성 화면에서 같은 시나리오 사용자를 유지한다.
  const meetingCreator = { name: "이수현", dept: "기획부", role: "부서장" };
  const [meetingForm, setMeetingForm] = useState(meetingDraft?.form ?? {
    event: "2026 소프트웨어융합대학 체육대회",
    name: "체육대회 안전 관리 최종 회의",
    date: "2026-07-25",
    time: "15:00",
    place: "학생회실 (A204)",
  });
  const [purpose, setPurpose] = useState(meetingDraft?.purpose ?? "행사 전 안전 점검 항목과 담당자를 최종 확정합니다.");
  const [draftSaved, setDraftSaved] = useState(false);

  const participants = [
    { name: meetingCreator.name, dept: meetingCreator.dept, role: "회의 생성자", permission: "진행 권한" },
    { name: "박해랑", dept: "운영부", role: "참가자", permission: "진행 권한" },
    { name: "정하늘", dept: "운영부", role: "참가자", permission: "진행 권한" },
    { name: "김민준", dept: "재정부", role: "참가자" },
  ];

  const agendas = [
    {
      title: "행사장 안전 점검 결과",
      description: "사전 현장 점검에서 확인한 위험 요소와 조치 결과를 공유합니다.",
      duration: "20분",
      material: "체육대회_안전점검표.pdf",
    },
    {
      title: "비상 연락망 및 담당자 확정",
      description: "상황별 연락 순서와 현장 담당자를 최종 확정합니다.",
      duration: "15분",
      material: "첨부된 자료 없음",
    },
    {
      title: "행사 당일 안전 인력 배치",
      description: "출입구, 경기장, 대기 구역별 담당 인원을 배치합니다.",
      duration: "25분",
      material: "안전인력_배치초안.xlsx",
    },
  ];

  const sectionTitle = (index: number, title: string, description: string) => (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">
        {index}
      </div>
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
  const createMeeting = () => {
    const name = meetingForm.name.trim();
    const place = meetingForm.place.trim();
    if (!name || !meetingForm.date || !meetingForm.time || !place) return;
    setCreatedMeetings((previous) => [
      {
        id: `MEET-${Date.now()}`,
        group: meetingType === "regular" ? "정기·상시 회의" : meetingForm.event,
        name,
        status: "예정",
        time: `${meetingForm.date.replaceAll("-", ".")} ${meetingForm.time}`,
        place,
        owner: meetingCreator.name,
        participants: participants.length,
        agendas: agendas.length,
        docStatus: "작성 전",
        relation: "회의 생성자",
        agendaTitles: agendas.map((agenda) => agenda.title),
        participantNames: participants.map((participant) => participant.name),
        facilitatorNames: [meetingCreator.name],
        attendance: {},
        agendaRecords: agendas.map((agenda) => ({
          title: agenda.title,
          discussion: "",
          decision: "",
          decisionNone: false,
          taskName: "",
          taskAssignee: meetingCreator.name,
          taskDue: "",
          taskNone: false,
        })),
      },
      ...previous,
    ]);
    setMeetingDraft(null);
    setDemoDataMode("default");
    navigateTo("OPS-MEET-01C");
  };
  const saveDraft = () => {
    setMeetingDraft({ meetingType, form: meetingForm, purpose, savedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) });
    setDraftSaved(true);
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", "새 회의 만들기"]}
      title="새 회의 만들기"
    >
      <div className="h-full overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto p-8 pb-24 flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">회의 정보 입력</h1>
            <p className="text-xs text-gray-500 mt-1">참가자와 안건을 미리 등록하면 회의 진행과 회의록 정리를 한 공간에서 이어갈 수 있습니다.</p>
          </div>

          {meetingDraft && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div><p className="text-xs font-bold text-blue-900">임시 저장한 회의 초안을 이어서 작성하고 있습니다</p><p className="text-[11px] text-blue-700 mt-1">{meetingDraft.savedAt}에 저장됨 · 회의 만들기를 누르기 전까지 다른 참가자에게 표시되지 않습니다.</p></div>
              <Btn variant="text" size="sm" onClick={() => { setMeetingDraft(null); setDraftSaved(false); }}>초안 삭제</Btn>
            </div>
          )}

          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            {sectionTitle(1, "회의 유형", "행사 연결은 선택 사항이며 행사 관련 회의일 때만 연결 행사를 지정합니다.")}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMeetingType("regular")}
                className={`rounded-xl border p-4 text-left transition-colors ${meetingType === "regular" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-bold ${meetingType === "regular" ? "text-blue-700" : "text-gray-800"}`}>정기·상시 회의</p>
                    <p className="text-[11px] text-gray-500 mt-1">학생회 정기회의나 행사와 무관한 조직 회의</p>
                  </div>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${meetingType === "regular" ? "border-blue-600" : "border-gray-300"}`}>
                    {meetingType === "regular" && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </span>
                </div>
              </button>

              <button
                onClick={() => setMeetingType("event")}
                className={`rounded-xl border p-4 text-left transition-colors ${meetingType === "event" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-bold ${meetingType === "event" ? "text-blue-700" : "text-gray-800"}`}>행사 관련 회의</p>
                    <p className="text-[11px] text-gray-500 mt-1">특정 행사 준비와 운영을 위해 진행하는 회의</p>
                  </div>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${meetingType === "event" ? "border-blue-600" : "border-gray-300"}`}>
                    {meetingType === "event" && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </span>
                </div>
              </button>
            </div>

            {meetingType === "event" && (
              <div className="max-w-md">
                <Input
                  label="연결 행사"
                  select
                  required
                  value={meetingForm.event}
                  selectOptions={["2026 소프트웨어융합대학 체육대회", "신입생 환영 행사", "가을 축제"]}
                  onChange={(event) => setMeetingForm((form) => ({ ...form, event: event.target.value }))}
                />
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            {sectionTitle(2, "기본 정보", "회의의 목적과 책임자를 명확하게 기록합니다.")}

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Input label="회의명" required value={meetingForm.name} onChange={(event) => setMeetingForm((form) => ({ ...form, name: event.target.value }))} />
              <Input label="주최자" required value={meetingCreator.name} disabled />
              <Input label="주관 부서" select required value={meetingCreator.dept} selectOptions={["운영부", "기획부", "재정부", "홍보부"]} />
              <Input label="회의 상태" value="예정" disabled hint="새 회의는 예정 상태로 생성됩니다." />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">회의 목적<span className="text-red-500 ml-0.5">*</span></label>
              <textarea
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                className="h-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            {sectionTitle(3, "일정과 장소", "예정 시간을 등록하고 실제 시작·종료 시각은 회의 진행 단계에서 기록합니다.")}

            <div className="grid grid-cols-4 gap-4">
              <Input label="회의 날짜" type="date" required value={meetingForm.date} onChange={(event) => setMeetingForm((form) => ({ ...form, date: event.target.value }))} />
              <Input label="시작 예정 시각" type="time" required value={meetingForm.time} onChange={(event) => setMeetingForm((form) => ({ ...form, time: event.target.value }))} />
              <Input label="종료 예정 시각" type="time" required defaultValue="16:30" />
              <Input label="진행 방식" select required value="오프라인" selectOptions={["오프라인", "온라인"]} />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <Input label="장소" required value={meetingForm.place} onChange={(event) => setMeetingForm((form) => ({ ...form, place: event.target.value }))} />
              <Input label="온라인 링크" placeholder="온라인 회의일 때 입력" disabled hint="오프라인 회의에서는 입력하지 않습니다." />
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between">
              {sectionTitle(4, "참가자와 진행 권한", "참가자를 초대하고 회의를 시작·종료할 진행 권한자를 지정합니다.")}
              <span className="text-xs font-medium text-gray-500">선택됨 {participants.length}명</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  placeholder="이름 또는 부서로 구성원 검색"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <select className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-white">
                <option>전체 부서</option>
                <option>운영부</option>
                <option>기획부</option>
                <option>재정부</option>
                <option>홍보부</option>
              </select>
              <Btn variant="secondary" size="md"><Plus className="w-4 h-4" /> 참가자 추가</Btn>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {participants.map((participant) => (
                <div key={participant.name} className="border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3 bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{participant.name}</p>
                      {participant.role === "회의 생성자" && <Chip label="회의 생성자" variant="gray" />}
                      {participant.permission && <Chip label={participant.permission} variant="blue" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{participant.dept}</p>
                  </div>
                  {participant.role !== "회의 생성자" && (
                    <div className="flex items-center gap-2">
                      <button className={`text-[11px] font-medium ${participant.permission ? "text-red-500" : "text-blue-600"}`}>
                        {participant.permission ? "권한 해제" : "진행 권한 부여"}
                      </button>
                      <button className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                진행 권한자는 회의를 시작·종료하고 안건과 회의록을 정리할 수 있습니다. 다른 사람의 권한을 변경하거나 회의를 취소하는 작업은 회의 생성자만 할 수 있습니다.
              </p>
            </div>
            <p className="text-[11px] text-gray-400">회의록 작성자는 별도로 지정하지 않습니다. 회의에 참가한 구성원은 공동으로 회의록을 작성할 수 있습니다.</p>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              {sectionTitle(5, "안건과 사전 자료", "안건 순서에 따라 회의를 진행하고 안건별 회의록과 결정사항을 기록합니다.")}
              <Btn variant="secondary" size="sm"><Plus className="w-3.5 h-3.5" /> 안건 추가</Btn>
            </div>

            {agendas.map((agenda, index) => (
              <div key={agenda.title} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-300" />
                    <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">{index + 1}</span>
                    <p className="text-sm font-bold text-gray-800">{agenda.title}</p>
                  </div>
                  <button className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-5 grid grid-cols-[1fr_140px] gap-5">
                  <div className="flex flex-col gap-4">
                    <Input label="안건명" required defaultValue={agenda.title} />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-700">안건 설명</label>
                      <textarea
                        defaultValue={agenda.description}
                        className="h-16 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                    </div>
                    <div className="border border-dashed border-gray-300 rounded-lg px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{agenda.material}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">사전 자료</p>
                        </div>
                      </div>
                      <Btn variant="secondary" size="sm"><Upload className="w-3.5 h-3.5" /> 자료 추가</Btn>
                    </div>
                  </div>
                  <div>
                    <Input label="예상 소요 시간" select value={agenda.duration} selectOptions={["10분", "15분", "20분", "25분", "30분", "45분", "60분"]} />
                  </div>
                </div>
              </div>
            ))}
          </section>

          <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between shadow-sm">
            <p className={`text-[11px] ${draftSaved ? "text-green-600 font-medium" : "text-gray-500"}`}>{draftSaved ? "임시 저장되었습니다. 목록에는 표시되지 않습니다." : "임시 저장한 회의는 다른 참가자에게 표시되지 않습니다."}</p>
            <div className="flex items-center gap-2">
              <Btn variant="text" size="md" className="text-gray-500 px-3" onClick={() => navigateTo("OPS-MEET-01C")}>취소</Btn>
              <Btn variant="secondary" size="md" onClick={saveDraft}>임시 저장</Btn>
              <Btn variant="primary" size="md" onClick={createMeeting} disabled={!meetingForm.name.trim() || !meetingForm.date || !meetingForm.time || !meetingForm.place.trim()}><Check className="w-4 h-4" /> 회의 만들기</Btn>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── Shared meeting detail data and components ───────────────────────────────

const MEETING_DETAIL_AGENDAS = [
  {
    title: "행사장 안전 점검 결과",
    duration: "20분",
    status: "논의 완료",
    summary: "본부석 뒤편 전선 구간에 케이블 커버를 추가하고 우천 시 실내 대기 장소를 사용하기로 했습니다.",
    material: "체육대회_안전점검표.pdf",
  },
  {
    title: "비상 연락망 및 담당자 확정",
    duration: "15분",
    status: "진행 중",
    summary: "상황별 최초 연락 담당자와 보고 순서를 확정합니다.",
    material: "비상연락망_초안.xlsx",
  },
  {
    title: "행사 당일 안전 인력 배치",
    duration: "25분",
    status: "대기",
    summary: "출입구, 경기장, 대기 구역별 담당 인원을 배치합니다.",
    material: "안전인력_배치초안.xlsx",
  },
];

const MEETING_AGENDA_RECORDS = [
  {
    discussion: "• 본부석 뒤편 전선 구간이 주요 위험 요소로 확인됨\n• 우천 시 실외 대기 구역 사용이 어려워 대체 공간이 필요함\n• 경기장 출입구 주변에 안전 안내 표지를 추가하기로 의견을 모음",
    decision: "본부석 뒤편 전선 구간에 케이블 커버를 설치하고, 우천 시 학생회관 1층을 대기 장소로 사용합니다.",
    decisionStatus: "확정",
    task: "케이블 커버와 안전 안내 표지 구매",
    assignee: "박해랑",
    due: "07.22까지",
  },
  {
    discussion: "• 응급 상황 발생 시 현장 담당자가 운영본부로 1차 연락\n• 운영본부에서 학생회장과 학교 안전관리팀에 동시 보고\n• 경기별 안전 담당자 연락처를 참가자 안내문에 포함",
    decision: "비상 연락은 현장 담당자 → 운영본부 → 학생회장·학교 안전관리팀 순으로 진행합니다.",
    decisionStatus: "확정",
    task: "비상 연락망 최종본 배포",
    assignee: "정하늘",
    due: "07.23까지",
  },
  {
    discussion: "• 출입구와 경기장별 필요 인원을 확인하는 중\n• 대기 구역 담당 인원은 참가 신청 결과를 본 뒤 확정 필요",
    decision: "",
    decisionStatus: "정리 필요",
    task: "",
    assignee: "",
    due: "",
  },
];

const MEETING_PARTICIPANTS = [
  { name: "박해랑", dept: "운영부", role: "회의 생성자", permission: true, joined: "15:00" },
  { name: "정하늘", dept: "운영부", role: "진행 권한", permission: true, joined: "15:02" },
  { name: "이수현", dept: "기획부", role: "참가자", permission: false, joined: "15:07" },
  { name: "김민준", dept: "재정부", role: "참가자", permission: false, joined: null },
];

function MeetingRoleNotice({ role }: { role: "participant" | "owner" | "facilitator" }) {
  const content = role === "participant"
    ? { title: "일반 참가자 화면", description: "회의 정보를 확인할 수 있지만 회의를 시작하거나 설정을 변경할 수 없습니다.", color: "bg-gray-50 border-gray-200", icon: User }
    : role === "owner"
      ? { title: "회의 생성자 화면", description: "회의 수정·취소와 진행 권한 관리, 회의 시작을 할 수 있습니다.", color: "bg-blue-50 border-blue-100", icon: Settings }
      : { title: "진행 권한자 화면", description: "회의를 시작·종료하고 안건을 진행할 수 있지만 권한이나 회의 정보는 변경할 수 없습니다.", color: "bg-indigo-50 border-indigo-100", icon: Check };
  const Icon = content.icon;
  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${content.color}`}>
      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <div>
        <p className="text-xs font-bold text-gray-800">{content.title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{content.description}</p>
      </div>
    </div>
  );
}

function MeetingSummaryCards({ createdMeeting }: { createdMeeting?: CreatedMeeting }) {
  const cards = createdMeeting ? [
    { label: "예정 일시", value: createdMeeting.time, icon: Calendar },
    { label: "등록 안건", value: `${createdMeeting.agendas}개`, icon: Clock },
    { label: "장소", value: createdMeeting.place, icon: MapPin },
    { label: "초대 인원", value: `${createdMeeting.participants}명`, icon: Users },
  ] : [
    { label: "예정 일시", value: "2026.07.25 15:00", icon: Calendar },
    { label: "예상 시간", value: "1시간 30분", icon: Clock },
    { label: "장소", value: "학생회실 (A204)", icon: MapPin },
    { label: "초대 인원", value: "4명", icon: Users },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">{label}</span>
          </div>
          <p className="text-xs font-bold text-gray-800">{value}</p>
        </div>
      ))}
    </div>
  );
}

function MeetingPeopleCard({ permissionAccess, createdMeeting }: { permissionAccess?: "view" | "manage"; createdMeeting?: CreatedMeeting }) {
  const { navigateTo } = React.useContext(AppContext);
  const people = createdMeeting
    ? createdMeeting.participantNames.map((name) => ({ name, dept: name === createdMeeting.owner ? "회의 생성자" : "초대된 참가자", role: name === createdMeeting.owner ? "회의 생성자" : "참가자", permission: name === createdMeeting.owner, joined: null }))
    : MEETING_PARTICIPANTS;
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">참가자와 진행 권한</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">초대 {createdMeeting ? createdMeeting.participants : 4}명 · 진행 권한 {createdMeeting ? 1 : 2}명</p>
        </div>
        {permissionAccess && (
          <Btn
            variant="secondary"
            size="sm"
            onClick={() => navigateTo(permissionAccess === "manage" ? "OPS-MEET-04B" : "OPS-MEET-04A")}
          >
            {permissionAccess === "manage" ? <Settings className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {permissionAccess === "manage" ? "진행 권한 관리" : "진행 권한 확인"}
          </Btn>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {people.map((person) => (
          <div key={person.name} className="px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">{person.name}</span>
                {person.role === "회의 생성자" && <Chip label="회의 생성자" variant="gray" />}
                {person.permission && <Chip label="진행 권한" variant="blue" />}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{person.dept}</p>
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{createdMeeting ? (createdMeeting.attendance[person.name]?.joinedAt ? `${createdMeeting.attendance[person.name].joinedAt} 참석` : "불참") : person.permission ? "시작·종료 가능" : "일반 참가자"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MeetingAgendaPreview({ createdMeeting }: { createdMeeting?: CreatedMeeting }) {
  const agendas = createdMeeting
    ? createdMeeting.agendaTitles.map((title, index) => ({ title, duration: "예정", summary: "회의 시작 전 등록한 안건입니다.", material: "사전 자료 없음" }))
    : MEETING_DETAIL_AGENDAS;
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">안건과 사전 자료</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">총 {createdMeeting ? createdMeeting.agendas : 3}개 · {createdMeeting ? createdMeeting.status === "정리 중" ? "정리 필요" : createdMeeting.status : "예상 60분"}</p>
        </div>
        <span className="text-[11px] text-gray-400">{createdMeeting ? "사전 자료는 수정 화면에서 추가" : "등록 자료 3개"}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {agendas.map((agenda, index) => (
          <div key={agenda.title} className="px-5 py-4 flex items-start gap-4">
            <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-gray-800">{agenda.title}</p>
                <span className="text-[10px] text-gray-400 shrink-0">{agenda.duration}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{agenda.summary}</p>
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-blue-600">
                <FileText className="w-3 h-3" />
                {agenda.material}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreatedMeetingCleanup({ meetingId, onBack, onCompleted, actor }: { meetingId: string; onBack: () => void; onCompleted: () => void; actor: { name: string; dept: string } }) {
  const { createdMeetings, setCreatedMeetings, recurringTasks, setRecurringTasks } = React.useContext(AppContext);
  const [selectedAgenda, setSelectedAgenda] = useState(0);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const meeting = createdMeetings.find((item) => item.id === meetingId);
  if (!meeting) return null;
  const record = meeting.agendaRecords[selectedAgenda];
  const updateRecord = (patch: Partial<CreatedMeetingAgendaRecord>) => {
    setCreatedMeetings((meetings) => meetings.map((item) => item.id === meeting.id ? {
      ...item,
      agendaRecords: item.agendaRecords.map((agenda, index) => index === selectedAgenda ? { ...agenda, ...patch } : agenda),
    } : item));
  };
  const makeTask = () => {
    if (!record.discussion.trim() || (!record.decisionNone && !record.decision.trim()) || !record.taskName.trim() || !record.taskAssignee || !record.taskDue || record.taskCreatedId) return;
    const highestId = recurringTasks.reduce((highest, task) => Math.max(highest, Number(task.id.replace(/\D/g, "")) || 0), 0);
    const taskId = `R-${String(highestId + 1).padStart(2, "0")}`;
    setRecurringTasks((tasks) => [{
      id: taskId,
      name: record.taskName.trim(),
      dept: actor.dept,
      assignee: record.taskAssignee,
      status: "예정",
      due: record.taskDue,
      cycle: "상시",
      delayed: false,
      description: `${record.discussion.trim()}${record.decisionNone ? "\n결정사항 없음" : `\n결정사항: ${record.decision.trim()}`}`,
      related: [`운영 > 회의 · ${meeting.name}`, `안건 ${selectedAgenda + 1} · ${record.title}`],
      history: [{ date: new Date().toLocaleString("ko-KR"), action: "회의 후속 업무 생성", user: actor.name, note: `${meeting.name} 회의록 정리에서 생성` }],
    }, ...tasks]);
    updateRecord({ taskCreatedId: taskId });
  };
  const taskReady = Boolean(record.discussion.trim() && (record.decisionNone || record.decision.trim()) && record.taskName.trim() && record.taskAssignee && record.taskDue);
  const completedAgendaCount = meeting.agendaRecords.filter((agenda) => Boolean(agenda.discussion.trim()) && (agenda.decisionNone || Boolean(agenda.decision.trim())) && (Boolean(agenda.taskCreatedId) || agenda.taskNone)).length;
  const canComplete = completedAgendaCount === meeting.agendaRecords.length;
  const incompleteAgendaIndexes = meeting.agendaRecords.reduce<number[]>((indexes, agenda, index) => {
    const isComplete = Boolean(agenda.discussion.trim()) && (agenda.decisionNone || Boolean(agenda.decision.trim())) && (Boolean(agenda.taskCreatedId) || agenda.taskNone);
    return isComplete ? indexes : [...indexes, index];
  }, []);
  const nextIncompleteAgenda = incompleteAgendaIndexes[0];
  const completeMeeting = () => {
    if (!canComplete) return;
    const completedAt = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    setCreatedMeetings((meetings) => meetings.map((item) => item.id === meeting.id ? { ...item, status: "완료", docStatus: "정리 완료", completedAt } : item));
    onCompleted();
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", meeting.name, "회의록 정리"]}
      title="회의록 정리"
      actions={<><Btn variant="secondary" size="sm" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5" /> 회의 상세로</Btn>{!canComplete && <span className="text-[10px] text-orange-600">안건 {incompleteAgendaIndexes.length}개를 더 정리해 주세요</span>}<Btn variant="primary" size="sm" disabled={!canComplete} onClick={() => setCompleteConfirmOpen(true)}><Check className="w-3.5 h-3.5" /> 정리 완료</Btn></>}
    >
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-6xl mx-auto p-6 pb-16 flex flex-col gap-5">
          <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-start gap-3">
            <Clock className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2"><p className="text-xs font-bold text-yellow-900">회의록 정리가 필요합니다</p><Chip label={`${completedAgendaCount}/${meeting.agendaRecords.length} 안건 정리`} variant="yellow" /></div>
              <p className="text-[11px] text-yellow-800 mt-1">각 안건의 논의, 결정 또는 없음, 후속 업무 카드 생성 또는 없음을 모두 기록해야 합니다. 생성한 후속 업무는 상시 업무·내 업무·캘린더에 즉시 반영됩니다.</p>
            </div>
          </section>

          <section className={`border rounded-xl p-5 flex items-center justify-between gap-5 ${canComplete ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
            <div>
              <div className="flex items-center gap-2">
                <p className={`text-xs font-bold ${canComplete ? "text-green-900" : "text-gray-900"}`}>{canComplete ? "모든 안건 정리가 완료되었습니다" : `회의록 정리 진행도 ${completedAgendaCount}/${meeting.agendaRecords.length}`}</p>
                <Chip label={canComplete ? "완료 가능" : `${incompleteAgendaIndexes.length}개 안건 남음`} variant={canComplete ? "green" : "yellow"} />
              </div>
              <p className={`text-[11px] mt-1 ${canComplete ? "text-green-800" : "text-gray-500"}`}>{canComplete ? "최종 확인 후 완료된 회의록을 참석자와 불참자에게 제공합니다." : "각 안건에 논의 내용, 결정 또는 없음, 후속 업무 카드 생성 또는 없음을 기록하세요."}</p>
            </div>
            {canComplete ? (
              <Btn variant="primary" size="sm" onClick={() => setCompleteConfirmOpen(true)}><Check className="w-3.5 h-3.5" /> 정리 완료</Btn>
            ) : (
              <Btn variant="secondary" size="sm" onClick={() => setSelectedAgenda(nextIncompleteAgenda)}><ArrowRight className="w-3.5 h-3.5" /> 다음 미완료 안건 정리</Btn>
            )}
          </section>

          {completeConfirmOpen && (
            <section className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between gap-5">
              <div><p className="text-xs font-bold text-green-900">회의록 정리를 완료할까요?</p><p className="text-[11px] text-green-800 mt-1">안건별 논의·결정·후속 업무 처리가 모두 기록되었습니다. 완료하면 회의록이 읽기 전용 완료본으로 제공됩니다.</p></div>
              <div className="flex items-center gap-2 shrink-0"><Btn variant="secondary" size="sm" onClick={() => setCompleteConfirmOpen(false)}>취소</Btn><Btn variant="primary" size="sm" onClick={completeMeeting}><Check className="w-3.5 h-3.5" /> 정리 완료</Btn></div>
            </section>
          )}

          <div className="grid grid-cols-[240px_1fr] gap-5 items-start">
            <aside className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><p className="text-xs font-bold text-gray-800">안건별 정리</p></div>
              <div className="p-2 flex flex-col gap-1">
                {meeting.agendaRecords.map((agenda, index) => {
                  const isDone = Boolean(agenda.discussion.trim()) && (agenda.decisionNone || Boolean(agenda.decision.trim())) && (Boolean(agenda.taskCreatedId) || agenda.taskNone);
                  return <button key={agenda.title} type="button" onClick={() => setSelectedAgenda(index)} className={`text-left rounded-lg px-3 py-3 transition-colors ${selectedAgenda === index ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div className="flex items-center gap-2"><span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${isDone ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{isDone ? <Check className="w-3 h-3" /> : index + 1}</span><p className="text-[11px] font-semibold text-gray-800 truncate flex-1">{agenda.title}</p></div>
                    <p className={`text-[10px] mt-1 ml-7 ${isDone ? "text-green-600" : "text-gray-400"}`}>{agenda.taskCreatedId ? "업무 카드 생성됨" : agenda.taskNone ? "후속 업무 없음" : "정리 필요"}</p>
                  </button>;
                })}
              </div>
            </aside>

            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-6">
              <div><p className="text-[10px] font-semibold text-blue-600 mb-2">안건 {selectedAgenda + 1}</p><h1 className="text-base font-bold text-gray-900">{record.title}</h1></div>
              <section>
                <label className="text-xs font-semibold text-gray-800">논의 내용<span className="text-red-500 ml-0.5">*</span></label>
                <textarea value={record.discussion} onChange={(event) => updateRecord({ discussion: event.target.value })} placeholder="회의에서 논의한 핵심 내용을 정리하세요" className="mt-2 w-full h-28 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </section>
              <section className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between"><label className="text-xs font-semibold text-gray-800">결정사항<span className="text-red-500 ml-0.5">*</span></label><label className="flex items-center gap-2 text-[11px] text-gray-600"><input type="checkbox" checked={record.decisionNone} onChange={(event) => updateRecord({ decisionNone: event.target.checked, decision: event.target.checked ? "" : record.decision })} /> 결정사항 없음</label></div>
                <textarea value={record.decision} disabled={record.decisionNone} onChange={(event) => updateRecord({ decision: event.target.value })} placeholder="확정된 결정사항을 기록하세요" className="mt-2 w-full h-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50" />
              </section>
              <section className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-gray-800">후속 업무</p><p className="text-[10px] text-gray-400 mt-1">업무 카드를 만들면 담당자의 내 업무와 캘린더에 반영됩니다.</p></div><label className="flex items-center gap-2 text-[11px] text-gray-600"><input type="checkbox" checked={record.taskNone} disabled={Boolean(record.taskCreatedId)} onChange={(event) => updateRecord({ taskNone: event.target.checked })} /> 후속 업무 없음</label></div>
                {record.taskNone ? <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-gray-600">이 안건에는 후속 업무가 없음을 기록했습니다.</div> : (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2"><Input label="업무명" required value={record.taskName} disabled={Boolean(record.taskCreatedId)} onChange={(event) => updateRecord({ taskName: event.target.value })} /></div>
                    <Input label="담당자" select required value={record.taskAssignee} disabled={Boolean(record.taskCreatedId)} onChange={(event) => updateRecord({ taskAssignee: event.target.value })} selectOptions={[currentUser.name, ...meeting.participantNames.filter((name) => name !== currentUser.name)]} />
                    <Input label="마감일" type="date" required value={record.taskDue} disabled={Boolean(record.taskCreatedId)} onChange={(event) => updateRecord({ taskDue: event.target.value })} />
                    <div className="col-span-2 flex items-center justify-between border border-blue-100 bg-blue-50 rounded-lg px-4 py-3"><div><p className="text-[11px] font-semibold text-blue-900">{record.taskCreatedId ? "업무 카드가 생성되었습니다" : "상시 업무 카드로 생성"}</p><p className="text-[10px] text-blue-700 mt-1">{record.taskCreatedId ? `${record.taskCreatedId} · 업무 상태 변경은 상시 업무에서 처리합니다.` : "논의와 결정사항을 먼저 입력한 뒤 생성할 수 있습니다."}</p></div>{record.taskCreatedId ? <Chip label="생성 완료" variant="green" /> : <Btn variant="primary" size="sm" disabled={!taskReady} onClick={makeTask}><Plus className="w-3.5 h-3.5" /> 업무 카드 만들기</Btn>}</div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function CreatedMeetingCompletedMinutes({ meetingId, viewer }: { meetingId: string; viewer?: { name: string; dept: string; role: string } }) {
  const { createdMeetings, setCreatedMeetings, recurringTasks, setSelectedRecurringTaskId, navigateTo, currentUser } = React.useContext(AppContext);
  const meeting = createdMeetings.find((item) => item.id === meetingId);
  if (!meeting) return null;
  const meetingViewer = viewer ?? currentUser;
  const source = `운영 > 회의 · ${meeting.name}`;
  const followupTasks = recurringTasks.filter((task) => task.related.includes(source));
  const absentNames = meeting.participantNames.filter((name) => !meeting.attendance[name]?.joinedAt);
  const currentUserAbsent = absentNames.includes(meetingViewer.name);
  const confirmSummary = () => setCreatedMeetings((meetings) => meetings.map((item) => item.id === meeting.id ? { ...item, attendance: { ...item.attendance, [meetingViewer.name]: { ...item.attendance[meetingViewer.name], summaryConfirmedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) } } } : item));
  const openTask = (taskId: string) => { setSelectedRecurringTaskId(taskId); navigateTo("OPS-TASK-01"); };
  const statusVariant = (status: EventTaskStatus) => status === "완료" ? "green" : status === "검토 필요" ? "yellow" : status === "예정" ? "gray" : "blue";
  return (
    <DesktopShell activeSidebar="운영" breadcrumb={["운영", "회의", meeting.name, "완료 회의록"]} title="완료된 회의록" actions={<Btn variant="secondary" size="sm" onClick={() => navigateTo("OPS-MEET-01C")}><ArrowLeft className="w-3.5 h-3.5" /> 회의 목록으로</Btn>}>
      <div className="bg-gray-50 min-h-full"><div className="max-w-6xl mx-auto p-6 pb-16 flex flex-col gap-5">
        <section className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3"><Check className="w-4 h-4 text-green-600 mt-0.5" /><div><div className="flex items-center gap-2"><p className="text-xs font-bold text-green-900">회의록 정리가 완료되었습니다</p><Chip label="완료" variant="green" /></div><p className="text-[11px] text-green-800 mt-1">{meeting.completedAt}에 완료 처리되었습니다. 안건별 기록과 후속 업무는 읽기 전용으로 제공됩니다.</p></div></section>
        {currentUserAbsent && <section className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between gap-4"><div><p className="text-xs font-bold text-orange-900">불참자 요약 확인이 필요합니다</p><p className="text-[11px] text-orange-800 mt-1">회의 핵심 기록과 나에게 배정된 후속 업무를 확인하세요. 확인해도 참석 기록은 바뀌지 않습니다.</p></div>{meeting.attendance[meetingViewer.name]?.summaryConfirmedAt ? <Chip label={`${meeting.attendance[meetingViewer.name].summaryConfirmedAt} 확인`} variant="green" /> : <Btn variant="primary" size="sm" onClick={confirmSummary}><Check className="w-3.5 h-3.5" /> 요약 확인 완료</Btn>}</section>}
        <section className="bg-white border border-gray-200 rounded-xl p-6"><div className="flex items-start justify-between gap-6"><div><div className="flex items-center gap-2 mb-2"><Chip label="완료" variant="green" /><Chip label={meeting.group === "정기·상시 회의" ? "정기·상시 회의" : "행사 관련 회의"} variant="gray" /></div><h1 className="text-lg font-bold text-gray-900">{meeting.name}</h1><p className="text-xs text-gray-500 mt-2">{meeting.time} · {meeting.place}</p></div><div className="text-right"><p className="text-[10px] text-gray-400">후속 업무</p><p className="text-sm font-bold text-gray-800 mt-1">{followupTasks.filter((task) => task.status === "완료").length}/{followupTasks.length} 완료</p></div></div></section>
        <div className="grid grid-cols-[1fr_300px] gap-5 items-start"><div className="flex flex-col gap-4">{meeting.agendaRecords.map((agenda, index) => { const agendaTasks = followupTasks.filter((task) => task.related.includes(`안건 ${index + 1} · ${agenda.title}`)); return <section key={agenda.title} className="bg-white border border-gray-200 rounded-xl p-5"><div className="flex items-center gap-2 mb-3"><span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">{index + 1}</span><h2 className="text-xs font-bold text-gray-800">{agenda.title}</h2></div><div className="text-xs text-gray-600 leading-6 whitespace-pre-wrap">{agenda.discussion}</div><div className="mt-3 bg-green-50 border border-green-100 rounded-lg p-3"><p className="text-[10px] font-semibold text-green-700 mb-1">{agenda.decisionNone ? "결정사항 없음" : "확정된 결정"}</p>{!agenda.decisionNone && <p className="text-xs text-green-900">{agenda.decision}</p>}</div>{agenda.taskNone ? <p className="mt-3 text-[11px] text-gray-500">후속 업무 없음</p> : <div className="mt-3"><p className="text-[10px] font-semibold text-blue-700 mb-2">생성된 후속 업무</p>{agendaTasks.map((task) => <button key={task.id} type="button" onClick={() => openTask(task.id)} className="w-full flex items-center gap-2 text-left border border-blue-100 hover:border-blue-300 rounded-lg px-3 py-2"><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-gray-800 truncate">{task.name}</p><p className="text-[10px] text-gray-500 mt-0.5">{task.assignee} · {task.due.replaceAll("-", ".").slice(5)}까지</p></div><Chip label={task.status} variant={statusVariant(task.status)} /><ExternalLink className="w-3 h-3 text-blue-500" /></button>)}</div>}</section>; })}</div><aside className="bg-white border border-gray-200 rounded-xl p-5"><h2 className="text-xs font-bold text-gray-800">참석 결과</h2><div className="mt-4 flex flex-col gap-3 text-[11px]">{meeting.participantNames.map((name) => <div key={name} className="flex items-center justify-between gap-2"><span className="text-gray-700">{name}</span><Chip label={meeting.attendance[name]?.joinedAt ? `${meeting.attendance[name].joinedAt} 참석` : meeting.attendance[name]?.summaryConfirmedAt ? "불참 · 요약 확인" : "불참"} variant={meeting.attendance[name]?.joinedAt ? "green" : meeting.attendance[name]?.summaryConfirmedAt ? "yellow" : "gray"} /></div>)}</div><div className="mt-5 pt-4 border-t border-gray-100 text-[11px]"><p className="text-gray-400">정리 완료</p><p className="text-gray-700 mt-1">{meeting.completedAt}</p></div></aside></div>
      </div></div>
    </DesktopShell>
  );
}

// ─── OPS-MEET-03A/B/C 예정 회의 상세 ──────────────────────────────────────────

function MeetingScheduledDetail({ role }: { role: "participant" | "owner" | "facilitator" }) {
  const { navigateTo, createdMeetings, selectedCreatedMeetingId, setCreatedMeetings, currentUser } = React.useContext(AppContext);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState("정하늘");
  const [agendaToAdd, setAgendaToAdd] = useState("");
  const createdMeeting = createdMeetings.find((meeting) => meeting.id === selectedCreatedMeetingId);
  const createdMeetingOwnerDept = createdMeeting ? MEMBER_DEPARTMENTS[createdMeeting.owner] ?? "학생회" : "운영부";
  const meetingName = createdMeeting?.name ?? "체육대회 안전 관리 최종 회의";
  const meetingGroup = createdMeeting?.group ?? "2026 소프트웨어융합대학 체육대회";
  const isRegularMeeting = createdMeeting?.group === "정기·상시 회의";
  const owner = role === "owner";
  const facilitator = role === "facilitator";
  const createdMeetingActor = createdMeeting && owner
    ? { name: createdMeeting.owner, dept: createdMeetingOwnerDept, role: "회의 생성자" }
    : currentUser;
  const startCreatedMeeting = () => {
    if (!createdMeeting) return;
    const startedAt = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    setCreatedMeetings((meetings) => meetings.map((meeting) => meeting.id === createdMeeting.id ? { ...meeting, status: "진행 중", docStatus: "작성 중", startedAt, attendance: { ...meeting.attendance, [meeting.owner]: { joinedAt: startedAt } } } : meeting));
    setStartConfirmOpen(false);
  };
  const updateCreatedMeeting = (update: (meeting: CreatedMeeting) => CreatedMeeting) => {
    if (!createdMeeting) return;
    setCreatedMeetings((meetings) => meetings.map((meeting) => meeting.id === createdMeeting.id ? update(meeting) : meeting));
  };
  const joinCreatedMeeting = () => {
    if (!createdMeeting) return;
    const joinedAt = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    updateCreatedMeeting((meeting) => ({ ...meeting, attendance: { ...meeting.attendance, [currentUser.name]: { ...meeting.attendance[currentUser.name], joinedAt } } }));
  };
  const cancelCreatedMeeting = () => updateCreatedMeeting((meeting) => ({ ...meeting, status: "취소", docStatus: "취소됨", cancelledAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) }));
  const endCreatedMeeting = () => {
    if (!createdMeeting) return;
    const endedAt = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    setCreatedMeetings((meetings) => meetings.map((meeting) => meeting.id === createdMeeting.id ? { ...meeting, status: "정리 중", docStatus: "정리 필요", endedAt } : meeting));
    setEndConfirmOpen(false);
  };
  const createdMeetingVariant = createdMeeting?.status === "진행 중" || createdMeeting?.status === "완료" ? "green" : createdMeeting?.status === "정리 중" ? "yellow" : createdMeeting?.status === "취소" ? "red" : "blue";
  if (createdMeeting && cleanupOpen) return <CreatedMeetingCleanup meetingId={createdMeeting.id} onBack={() => setCleanupOpen(false)} onCompleted={() => setCleanupOpen(false)} actor={createdMeetingActor} />;
  if (createdMeeting?.status === "완료") return <CreatedMeetingCompletedMinutes meetingId={createdMeeting.id} viewer={createdMeetingActor} />;
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", meetingName]}
      title={meetingName}
      actions={
        createdMeeting ? (
          createdMeeting.status === "예정"
            ? <><Btn variant="secondary" size="sm" onClick={() => setManageOpen(!manageOpen)}><Settings className="w-3.5 h-3.5" /> 회의 관리</Btn><Btn variant="primary" size="sm" onClick={() => setStartConfirmOpen(true)}><ArrowRight className="w-3.5 h-3.5" /> 회의 시작</Btn></>
            : createdMeeting.status === "진행 중"
              ? <>{createdMeeting.participantNames.includes(currentUser.name) && !createdMeeting.attendance[currentUser.name]?.joinedAt && <Btn variant="secondary" size="sm" onClick={joinCreatedMeeting}><Check className="w-3.5 h-3.5" /> 회의 참가</Btn>}<Btn variant="destructive" size="sm" onClick={() => setEndConfirmOpen(true)}><X className="w-3.5 h-3.5" /> 회의 종료</Btn></>
              : createdMeeting.status === "취소"
                ? <Btn variant="secondary" size="sm" onClick={() => navigateTo("OPS-MEET-01C")}><ArrowLeft className="w-3.5 h-3.5" /> 회의 목록으로</Btn>
              : <Btn variant="primary" size="sm" onClick={() => setCleanupOpen(true)}><FileText className="w-3.5 h-3.5" /> 회의록 정리</Btn>
        ) : role === "participant" ? (
          <Btn variant="secondary" size="sm"><Eye className="w-3.5 h-3.5" /> 예정 회의</Btn>
        ) : (
          <>
            {owner && <Btn variant="secondary" size="sm" onClick={() => navigateTo("OPS-MEET-02")}><Settings className="w-3.5 h-3.5" /> 회의 수정</Btn>}
            <Btn variant="primary" size="sm" onClick={() => navigateTo("OPS-MEET-D01")}><ArrowRight className="w-3.5 h-3.5" /> 회의 시작</Btn>
          </>
        )
      }
    >
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-6xl mx-auto p-6 pb-16 flex flex-col gap-5">
          <MeetingRoleNotice role={createdMeeting ? "owner" : role} />

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Chip label={createdMeeting?.status ?? "예정"} variant={createdMeetingVariant} />
                  <Chip label={isRegularMeeting ? "정기·상시 회의" : "행사 관련 회의"} variant="gray" />
                </div>
                <h1 className="text-lg font-bold text-gray-900">{meetingName}</h1>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-2xl">{createdMeeting ? createdMeeting.status === "취소" ? "이 회의는 취소되었습니다. 취소된 회의는 진행하거나 회의록을 정리할 수 없습니다." : createdMeeting.status === "정리 중" ? "회의가 종료되어 회의록 정리가 필요한 상태입니다." : createdMeeting.status === "진행 중" ? "회의가 진행 중입니다. 종료하면 회의록 정리 단계로 전환됩니다." : "새로 생성한 예정 회의입니다. 시작 전 안건과 초대 인원을 확인할 수 있습니다." : "행사 전 안전 점검 결과를 공유하고 비상 연락망과 현장 안전 인력 배치를 최종 확정합니다."}</p>
                {!isRegularMeeting && <div className="flex items-center gap-2 mt-3 text-[11px] text-blue-600"><ExternalLink className="w-3.5 h-3.5" />{meetingGroup}</div>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400">회의 생성자</p>
                <p className="text-xs font-bold text-gray-800 mt-1">{createdMeeting?.owner ?? "박해랑"} · {createdMeetingOwnerDept}</p>
                <p className="text-[10px] text-gray-400 mt-2">{createdMeeting ? "방금 생성" : "2026.07.17 18:42 수정"}</p>
              </div>
            </div>
          </section>

          <MeetingSummaryCards createdMeeting={createdMeeting} />

          {createdMeeting && manageOpen && createdMeeting.status === "예정" && (
            <section className="bg-white border border-blue-200 rounded-xl p-5 flex flex-col gap-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-gray-900">회의 관리</h2><p className="text-[11px] text-gray-500 mt-1">예정 상태에서만 참가자, 진행 권한, 안건을 변경할 수 있습니다.</p></div><Btn variant="text" size="sm" className="text-red-600" onClick={cancelCreatedMeeting}>회의 취소</Btn></div><div className="grid grid-cols-2 gap-5"><div><div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-gray-800">참가자·진행 권한</p><select value={memberToAdd} onChange={(event) => setMemberToAdd(event.target.value)} className="text-[11px] border border-gray-200 rounded px-2 py-1"><option>정하늘</option><option>이수현</option><option>김민준</option><option>이윤슬</option></select></div><div className="flex flex-col gap-2">{createdMeeting.participantNames.map((name) => <div key={name} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2"><span className="text-xs text-gray-700 flex-1">{name}</span>{createdMeeting.facilitatorNames.includes(name) && <Chip label="진행 권한" variant="blue" />}{name !== createdMeeting.owner && <><button type="button" onClick={() => updateCreatedMeeting((meeting) => ({ ...meeting, facilitatorNames: meeting.facilitatorNames.includes(name) ? meeting.facilitatorNames.filter((item) => item !== name) : [...meeting.facilitatorNames, name] }))} className="text-[10px] text-blue-600">{createdMeeting.facilitatorNames.includes(name) ? "권한 해제" : "권한 부여"}</button><button type="button" onClick={() => updateCreatedMeeting((meeting) => ({ ...meeting, participantNames: meeting.participantNames.filter((item) => item !== name), facilitatorNames: meeting.facilitatorNames.filter((item) => item !== name), participants: meeting.participants - 1 }))} className="text-[10px] text-red-500">제거</button></>}</div>)}<Btn variant="secondary" size="sm" onClick={() => { if (!createdMeeting.participantNames.includes(memberToAdd)) updateCreatedMeeting((meeting) => ({ ...meeting, participantNames: [...meeting.participantNames, memberToAdd], participants: meeting.participants + 1 })); }}>참가자 추가</Btn></div></div><div><p className="text-xs font-semibold text-gray-800 mb-2">안건</p><div className="flex flex-col gap-2">{createdMeeting.agendaRecords.map((agenda, index) => <div key={`${agenda.title}-${index}`} className="flex items-center gap-2"><input value={agenda.title} onChange={(event) => updateCreatedMeeting((meeting) => ({ ...meeting, agendaTitles: meeting.agendaTitles.map((title, i) => i === index ? event.target.value : title), agendaRecords: meeting.agendaRecords.map((item, i) => i === index ? { ...item, title: event.target.value } : item) }))} className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs"/><button type="button" onClick={() => updateCreatedMeeting((meeting) => ({ ...meeting, agendaTitles: meeting.agendaTitles.filter((_, i) => i !== index), agendaRecords: meeting.agendaRecords.filter((_, i) => i !== index), agendas: meeting.agendas - 1 }))} className="text-[10px] text-red-500">삭제</button></div>)}<div className="flex gap-2"><input value={agendaToAdd} onChange={(event) => setAgendaToAdd(event.target.value)} placeholder="새 안건명" className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs"/><Btn variant="secondary" size="sm" onClick={() => { const title = agendaToAdd.trim(); if (!title) return; updateCreatedMeeting((meeting) => ({ ...meeting, agendas: meeting.agendas + 1, agendaTitles: [...meeting.agendaTitles, title], agendaRecords: [...meeting.agendaRecords, { title, discussion: "", decision: "", decisionNone: false, taskName: "", taskAssignee: meeting.owner, taskDue: "", taskNone: false }] })); setAgendaToAdd(""); }}>추가</Btn></div></div></div></div></section>
          )}

          {createdMeeting && startConfirmOpen && (
            <section className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center justify-between gap-5">
              <div>
                <p className="text-xs font-bold text-blue-900">이 회의를 시작할까요?</p>
                <p className="text-[11px] text-blue-700 mt-1">시작하면 상태가 ‘진행 중’으로 바뀌고, 목록의 회의록 상태도 ‘작성 중’으로 표시됩니다.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Btn variant="secondary" size="sm" onClick={() => setStartConfirmOpen(false)}>취소</Btn>
                <Btn variant="primary" size="sm" onClick={startCreatedMeeting}><Check className="w-3.5 h-3.5" /> 회의 시작</Btn>
              </div>
            </section>
          )}

          {createdMeeting && endConfirmOpen && (
            <section className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between gap-5">
              <div>
                <p className="text-xs font-bold text-red-900">이 회의를 종료할까요?</p>
                <p className="text-[11px] text-red-700 mt-1">종료하면 상태가 ‘정리 중’으로 바뀌고, 회의록 상태가 ‘정리 필요’로 표시됩니다. 회의록이 완료되기 전에는 완료 상태가 되지 않습니다.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Btn variant="secondary" size="sm" onClick={() => setEndConfirmOpen(false)}>취소</Btn>
                <Btn variant="destructive" size="sm" onClick={endCreatedMeeting}><Check className="w-3.5 h-3.5" /> 회의 종료</Btn>
              </div>
            </section>
          )}

          {(role === "participant" || createdMeeting) && (
            <div className={`${createdMeeting?.status === "진행 중" ? "bg-green-50 border-green-100" : createdMeeting?.status === "정리 중" ? "bg-yellow-50 border-yellow-100" : createdMeeting?.status === "취소" ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"} border rounded-xl px-5 py-4 flex items-center gap-3`}>
              {createdMeeting?.status === "진행 중" ? <Check className="w-4 h-4 text-green-600 shrink-0" /> : createdMeeting?.status === "정리 중" ? <Clock className="w-4 h-4 text-yellow-600 shrink-0" /> : createdMeeting?.status === "취소" ? <X className="w-4 h-4 text-red-600 shrink-0" /> : <Info className="w-4 h-4 text-blue-600 shrink-0" />}
              <div>
                <p className={`text-xs font-semibold ${createdMeeting?.status === "진행 중" ? "text-green-800" : createdMeeting?.status === "정리 중" ? "text-yellow-800" : createdMeeting?.status === "취소" ? "text-red-800" : "text-blue-800"}`}>{createdMeeting?.status === "진행 중" ? "회의가 진행 중입니다" : createdMeeting?.status === "정리 중" ? "회의록 정리가 필요합니다" : createdMeeting?.status === "취소" ? "회의가 취소되었습니다" : "아직 회의가 시작되지 않았습니다"}</p>
                <p className={`text-[11px] mt-0.5 ${createdMeeting?.status === "진행 중" ? "text-green-700" : createdMeeting?.status === "정리 중" ? "text-yellow-700" : createdMeeting?.status === "취소" ? "text-red-700" : "text-blue-700"}`}>{createdMeeting?.status === "진행 중" ? `${createdMeeting.startedAt}에 회의를 시작했습니다. 현재 상태는 목록에도 즉시 반영됩니다.` : createdMeeting?.status === "정리 중" ? `${createdMeeting.endedAt}에 회의를 종료했습니다. 안건별 결정과 후속 업무를 정리한 뒤 완료 처리할 수 있습니다.` : createdMeeting?.status === "취소" ? `${createdMeeting.cancelledAt}에 회의를 취소했습니다. 목록에는 취소 상태로 보관되며 일정에서는 제외됩니다.` : createdMeeting ? "생성한 회의 정보가 목록과 이 상세 화면에 반영되었습니다. 시작 전 안건과 초대 인원을 확인한 뒤 회의를 시작하세요." : "회의가 시작되면 목록과 이 화면의 버튼이 ‘회의 참가’로 변경됩니다. 이 화면을 확인한 것은 참석으로 기록되지 않습니다."}</p>
              </div>
            </div>
          )}

          {createdMeeting?.status === "진행 중" && (
            <section className="bg-white border border-green-200 rounded-xl px-5 py-4 flex items-center justify-between gap-5">
              <div>
                <p className="text-xs font-bold text-gray-900">회의를 마칠 준비가 되었나요?</p>
                <p className="text-[11px] text-gray-500 mt-1">종료 후 안건별 결정과 후속 업무를 정리해야 회의록을 완료할 수 있습니다.</p>
              </div>
              <Btn variant="destructive" size="sm" onClick={() => setEndConfirmOpen(true)}><X className="w-3.5 h-3.5" /> 회의 종료</Btn>
            </section>
          )}

          {createdMeeting?.status === "정리 중" && (
            <section className="bg-white border border-yellow-200 rounded-xl px-5 py-4 flex items-center justify-between gap-5">
              <div>
                <p className="text-xs font-bold text-gray-900">회의록 정리를 이어가세요</p>
                <p className="text-[11px] text-gray-500 mt-1">모든 안건의 결정 기록과 필요한 후속 업무를 입력하면 완료 처리할 수 있습니다.</p>
              </div>
              <Btn variant="primary" size="sm" onClick={() => setCleanupOpen(true)}><FileText className="w-3.5 h-3.5" /> 회의록 정리</Btn>
            </section>
          )}

          {!createdMeeting && (owner || facilitator) && (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">시작 전 확인</p>
                <p className="text-[11px] text-gray-500 mt-1">현재 예정 시각까지 7일 남았습니다. 안건과 참가자를 확인한 뒤 회의를 시작하세요.</p>
              </div>
              {owner && <Btn variant="text" size="sm" className="text-red-600" onClick={() => navigateTo("OPS-MEET-D04")}>회의 취소</Btn>}
            </div>
          )}

          <div className="grid grid-cols-[1.45fr_0.85fr] gap-5 items-start">
            <MeetingAgendaPreview createdMeeting={createdMeeting} />
            <MeetingPeopleCard createdMeeting={createdMeeting} permissionAccess={createdMeeting ? undefined : owner ? "manage" : facilitator ? "view" : undefined} />
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function OPSMEET03A() { return <MeetingScheduledDetail role="participant" />; }
function OPSMEET03B() { return <MeetingScheduledDetail role="owner" />; }
function OPSMEET03C() { return <MeetingScheduledDetail role="facilitator" />; }

// ─── OPS-MEET-04A/B 회의 진행 권한 현황·관리 ──────────────────────────────────

function MeetingPermissionScreen({ readOnly = false }: { readOnly?: boolean }) {
  const [department, setDepartment] = useState("전체 부서");
  const { navigateTo } = React.useContext(AppContext);
  const members = [
    { name: "정하늘", dept: "운영부", permission: true },
    { name: "이수현", dept: "기획부", permission: false },
    { name: "김민준", dept: "재정부", permission: false },
    { name: "이윤슬", dept: "홍보부", permission: false },
    { name: "김바다", dept: "기획부", permission: false },
  ];
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", "체육대회 안전 관리 최종 회의", readOnly ? "진행 권한 현황" : "진행 권한 관리"]}
      title={readOnly ? "회의 진행 권한 현황" : "회의 진행 권한 관리"}
      actions={
        <Btn
          variant={readOnly ? "secondary" : "primary"}
          size="sm"
          onClick={() => navigateTo(readOnly ? "OPS-MEET-03C" : "OPS-MEET-03B")}
        >
          {readOnly ? <ArrowLeft className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
          {readOnly ? "회의 상세로 돌아가기" : "관리 완료"}
        </Btn>
      }
    >
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-5xl mx-auto p-7 pb-16 flex flex-col gap-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-800">{readOnly ? "진행 권한을 확인하는 읽기 전용 화면입니다" : "이 회의에만 적용되는 권한입니다"}</p>
              <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
                {readOnly
                  ? "누가 이 회의를 진행할 수 있는지와 내 권한 범위를 확인할 수 있습니다. 다른 참가자의 권한을 부여하거나 해제할 수는 없습니다."
                  : "진행 권한자는 회의 시작·종료, 안건 진행, 결정 기록과 회의록 정리를 할 수 있습니다. 회의 수정·취소와 다른 사람의 권한 변경은 회의 생성자만 할 수 있습니다."}
              </p>
            </div>
          </div>

          {readOnly && (
            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">진행 권한 범위</h2>
                  <p className="text-[11px] text-gray-400 mt-1">이 회의의 진행 권한자가 수행할 수 있는 작업</p>
                </div>
                <Chip label="진행 권한 보유" variant="blue" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  ["회의 시작·종료", "가능"],
                  ["안건 진행", "가능"],
                  ["결정·후속 업무 기록", "가능"],
                  ["권한 변경·회의 취소", "불가"],
                ].map(([label, value]) => (
                  <div key={label} className={`border rounded-lg p-3 ${value === "가능" ? "border-green-100 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                    <p className="text-[10px] text-gray-500">{label}</p>
                    <p className={`text-xs font-bold mt-1.5 ${value === "가능" ? "text-green-700" : "text-gray-500"}`}>{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-[10px] font-semibold text-gray-400 mb-3">{readOnly ? "회의 생성자 · 진행 권한자" : "회의 생성자 · 권한 관리 책임자"}</p>
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white border border-blue-100 flex items-center justify-center"><User className="w-4 h-4 text-blue-600" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900">박해랑</p>
                  <Chip label="회의 생성자" variant="gray" />
                  <Chip label="진행 권한" variant="blue" />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">운영부 · 권한 변경 및 회의 관리 가능</p>
              </div>
              <span className="text-[11px] text-gray-400">{readOnly ? "회의 시작·종료 가능" : "필수 권한자"}</span>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">참가자별 진행 권한</h2>
                  <p className="text-[11px] text-gray-400 mt-1">현재 진행 권한자 2명 · 일반 참가자 3명</p>
                </div>
                {readOnly ? <Chip label="읽기 전용" variant="gray" /> : <Chip label="최소 1명 유지" variant="yellow" />}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input placeholder="이름 또는 부서 검색" className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm" />
                  </div>
                  <select value={department} onChange={(event) => setDepartment(event.target.value)} className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-white">
                    {["전체 부서", "운영부", "기획부", "재정부", "홍보부"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {members.map((member) => (
                <div key={member.name} className="px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><User className="w-4 h-4 text-gray-500" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gray-800">{member.name}</p>
                      {member.permission && <Chip label="진행 권한" variant="blue" />}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{member.dept} · 회의 참가자</p>
                  </div>
                  {readOnly ? (
                    <span className="text-[11px] text-gray-400">{member.permission ? "회의 시작·종료 가능" : "일반 참가자"}</span>
                  ) : (
                    <Btn
                      variant={member.permission ? "secondary" : "primary"}
                      size="sm"
                      onClick={member.permission ? undefined : () => navigateTo("OPS-MEET-D03")}
                    >
                      {member.permission ? "권한 해제" : "진행 권한 부여"}
                    </Btn>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DesktopShell>
  );
}

function OPSMEET04A() { return <MeetingPermissionScreen readOnly />; }
function OPSMEET04B() { return <MeetingPermissionScreen />; }

// ─── OPS-MEET-05A/B 진행 중 회의 ──────────────────────────────────────────────

function MeetingLiveScreen({ facilitator = false }: { facilitator?: boolean }) {
  const [selectedAgenda, setSelectedAgenda] = useState(1);
  const { navigateTo } = React.useContext(AppContext);
  const currentAgenda = MEETING_DETAIL_AGENDAS[selectedAgenda];
  const currentRecord = MEETING_AGENDA_RECORDS[selectedAgenda];

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", "체육대회 안전 관리 최종 회의"]}
      title="체육대회 안전 관리 최종 회의"
      actions={
        facilitator ? (
          <Btn variant="destructive" size="sm" onClick={() => navigateTo("OPS-MEET-D02")}><Check className="w-3.5 h-3.5" /> 회의 종료</Btn>
        ) : (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5" /> 참석 처리됨 · 15:07 참가
          </div>
        )
      }
    >
      <div className="bg-gray-50 min-h-full flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Chip label="진행 중" variant="green" />
            <span className="text-xs font-semibold text-gray-700">15:00 시작</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">진행 27분</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">학생회실 (A204)</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-700">3명 참가 중</span>
            <span className="text-[10px] text-gray-400">/ 초대 4명</span>
          </div>
        </div>

        <div className="flex-1 p-5 grid grid-cols-[minmax(0,1fr)_300px] gap-4 min-h-0">
          <main className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col min-w-0">
            <div className="flex-1 overflow-auto">
              <section className="px-7 py-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-blue-600">안건 {selectedAgenda + 1}</span>
                      <Chip label={currentAgenda.status} variant={currentAgenda.status === "진행 중" ? "green" : currentAgenda.status === "논의 완료" ? "gray" : "yellow"} />
                      <span className="text-[10px] text-gray-400">예상 {currentAgenda.duration}</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{currentAgenda.title}</h2>
                    <p className="text-xs text-gray-500 mt-2 leading-6">{currentAgenda.summary}</p>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-blue-600">
                      <FileText className="w-3.5 h-3.5" />
                      {currentAgenda.material}
                      <button className="ml-1 font-medium">열기</button>
                    </div>
                  </div>
                  {facilitator && <Btn variant="secondary" size="sm"><Check className="w-3.5 h-3.5" /> 이 안건 논의 완료</Btn>}
                </div>
              </section>

              <section className="mx-7 border-t border-gray-200 py-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">논의 내용</h3>
                    <p className="text-[10px] text-gray-400 mt-1">참가자가 함께 작성하는 안건별 회의 기록</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <div className="flex -space-x-1">
                      {[1, 2, 3].map((item) => <span key={item} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"><User className="w-3 h-3 text-gray-500" /></span>)}
                    </div>
                    공동 작성 중
                  </div>
                </div>
                <textarea
                  key={`discussion-${selectedAgenda}`}
                  defaultValue={currentRecord.discussion}
                  className="w-full h-56 border border-gray-300 rounded-lg p-5 text-sm text-gray-700 leading-7 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-gray-400">15:24 정하늘 수정 · 자동 저장됨</span>
                  <Btn variant="text" size="sm"><Upload className="w-3.5 h-3.5" /> 자료 첨부</Btn>
                </div>
              </section>

              <section className="mx-7 border-t border-gray-200 py-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">결정사항</h3>
                    <p className="text-[10px] text-gray-400 mt-1">이 안건에서 합의한 결과를 기록합니다.</p>
                  </div>
                  <Btn variant="secondary" size="sm"><Plus className="w-3.5 h-3.5" /> {facilitator ? "결정 추가" : "결정 의견 추가"}</Btn>
                </div>
                {currentRecord.decision ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Chip label={currentRecord.decisionStatus} variant="green" />
                      {facilitator && <button className="text-[10px] font-medium text-blue-600">내용 수정</button>}
                    </div>
                    <p className="text-sm font-semibold text-green-950 leading-6 mt-3">{currentRecord.decision}</p>
                    <p className="text-[10px] text-green-700 mt-2">관련 담당자 · 박해랑, 정하늘</p>
                  </div>
                ) : (
                  <div className="border border-dashed border-orange-300 bg-orange-50 rounded-lg p-5 text-center">
                    <p className="text-xs font-semibold text-orange-800">아직 기록된 결정사항이 없습니다</p>
                    <p className="text-[10px] text-orange-600 mt-1">논의 결과를 기록하거나 ‘결정사항 없음’으로 표시해 주세요.</p>
                  </div>
                )}
              </section>

              <section className="mx-7 border-t border-gray-200 py-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">후속 업무</h3>
                    <p className="text-[10px] text-gray-400 mt-1">이 안건의 결정으로 발생한 업무</p>
                  </div>
                  <Btn variant="secondary" size="sm"><Plus className="w-3.5 h-3.5" /> 업무 만들기</Btn>
                </div>
                {currentRecord.task ? (
                  <div className="border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Clipboard className="w-4 h-4 text-blue-600" /></div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-800">{currentRecord.task}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{currentRecord.assignee} · {currentRecord.due} · 위 결정사항에서 생성</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-blue-500" />
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center text-[11px] text-gray-400">연결된 후속 업무가 없습니다</div>
                )}
              </section>
            </div>
          </main>

          <aside className="flex flex-col gap-4 min-w-0 overflow-auto">
            <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-800">전체 안건</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{selectedAgenda + 1} / 3번째 안건 선택</p>
              </div>
              <div className="p-2 flex flex-col gap-2">
                {MEETING_DETAIL_AGENDAS.map((agenda, index) => {
                  const selected = selectedAgenda === index;
                  return (
                    <button
                      key={agenda.title}
                      onClick={() => setSelectedAgenda(index)}
                      className={`text-left rounded-lg border p-3 transition-colors ${selected ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold ${selected ? "text-blue-600" : "text-gray-400"}`}>안건 {index + 1}</span>
                        <Chip label={agenda.status} variant={agenda.status === "진행 중" ? "green" : agenda.status === "논의 완료" ? "gray" : "yellow"} />
                      </div>
                      <p className="text-xs font-semibold text-gray-800 leading-snug">{agenda.title}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                        <span>결정 {MEETING_AGENDA_RECORDS[index].decision ? "1" : "0"}</span>
                        <span>업무 {MEETING_AGENDA_RECORDS[index].task ? "1" : "0"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {facilitator && (
                <div className="border-t border-gray-100 p-3">
                  <Btn variant="primary" size="sm" className="w-full justify-center">다음 안건 시작</Btn>
                </div>
              )}
            </section>

            <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-bold text-gray-800">참가 현황</h3>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {MEETING_PARTICIPANTS.map((person) => (
                  <div key={person.name} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${person.joined ? "bg-green-500" : "bg-gray-300"}`} />
                    <span className="text-[11px] text-gray-700 flex-1">{person.name}</span>
                    <span className="text-[10px] text-gray-400">{person.joined ? `${person.joined} 참가` : "미참가"}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </DesktopShell>
  );
}

function OPSMEET05A() { return <MeetingLiveScreen />; }
function OPSMEET05B() { return <MeetingLiveScreen facilitator />; }

// ─── OPS-MEET-06A 정리 중 회의 — 일반 참가자 ──────────────────────────────────

function OPSMEET06A() {
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", "신입생 환영 행사 기획회의"]}
      title="신입생 환영 행사 기획회의"
      actions={<Btn variant="secondary" size="sm"><Eye className="w-3.5 h-3.5" /> 읽기 전용</Btn>}
    >
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-6xl mx-auto p-6 pb-16 flex flex-col gap-5">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-start gap-3">
            <Clock className="w-4 h-4 text-yellow-700 mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-yellow-900">회의록을 정리하고 있습니다</p>
                <Chip label="정리 중" variant="yellow" />
                <Chip label="15:07 참석" variant="gray" />
              </div>
              <p className="text-[11px] text-yellow-800 mt-1">현재 내용은 진행 권한자가 수정할 수 있습니다. 정리 완료 후 최종 회의록으로 제공됩니다.</p>
            </div>
          </div>

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold text-blue-600 mb-2">신입생 환영 행사</p>
                <h1 className="text-lg font-bold text-gray-900">신입생 환영 행사 기획회의</h1>
                <p className="text-xs text-gray-500 mt-2">2026.07.15 16:00–17:18 · 온라인 (Discord)</p>
              </div>
              <div className="flex gap-6 text-right">
                <div><p className="text-[10px] text-gray-400">참석</p><p className="text-sm font-bold text-gray-800 mt-1">8명</p></div>
                <div><p className="text-[10px] text-gray-400">불참</p><p className="text-sm font-bold text-gray-800 mt-1">2명</p></div>
                <div><p className="text-[10px] text-gray-400">안건</p><p className="text-sm font-bold text-gray-800 mt-1">5개</p></div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-[1fr_330px] gap-5 items-start">
            <div className="flex flex-col gap-4">
              <section className="bg-white border border-yellow-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-900">회의 요약 초안</h2>
                  <span className="text-[10px] font-medium text-yellow-700">정리 중 · 변경될 수 있음</span>
                </div>
                <p className="text-sm text-gray-700 leading-7">신입생 환영 행사 프로그램 순서와 부서별 준비 범위를 논의했습니다. 장소 답사 후 세부 동선과 무대 운영 계획을 최종 확정할 예정입니다.</p>
              </section>

              {[
                { title: "행사 프로그램 구성", text: "환영 인사, 학과 소개, 아이스브레이킹, 부서별 교류 순으로 진행합니다.", done: true },
                { title: "장소와 참가자 동선", text: "답사 결과를 반영해 입장과 퇴장 동선을 분리하는 방안을 검토합니다.", done: true },
                { title: "부서별 준비 범위", text: "운영부는 현장 운영, 홍보부는 사전 안내와 행사 기록을 담당합니다.", done: false },
              ].map((item, index) => (
                <section key={item.title} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
                    <h3 className="text-xs font-bold text-gray-800">{item.title}</h3>
                    <Chip label={item.done ? "정리됨" : "정리 중"} variant={item.done ? "green" : "yellow"} />
                  </div>
                  <p className="text-xs text-gray-600 leading-6 mt-3">{item.text}</p>
                </section>
              ))}
            </div>

            <aside className="flex flex-col gap-4">
              <section className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-800 mb-3">현재 정리 현황</h3>
                <div className="flex flex-col gap-3">
                  {[
                    ["안건 내용", "2 / 3 정리"],
                    ["의사결정", "2건 확인"],
                    ["후속 업무", "1건 연결"],
                    ["전체 요약", "초안 작성"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">{label}</span>
                      <span className="text-[11px] font-semibold text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-800 mb-3">확정된 결정</h3>
                <div className="border-l-2 border-green-400 pl-3">
                  <p className="text-xs text-gray-700 leading-5">프로그램 순서는 환영 인사 이후 학과 소개와 교류 프로그램 순으로 진행합니다.</p>
                </div>
              </section>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-[11px] text-blue-700 leading-relaxed">참석 기록은 이미 확정되어 있습니다. 이 화면을 다시 열거나 닫아도 참석 상태는 달라지지 않습니다.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── OPS-MEET-06B 회의록 정리 — 진행 권한자 ──────────────────────────────────

type AgendaCleanupState = {
  decisionText: string;
  decisionNone: boolean;
  taskLinked: boolean;
  taskNone: boolean;
  taskName: string;
  taskAssignee: string;
  taskDue: string;
  taskCreatedId?: string;
};

function buildAiSummaryDraft(cleanupStates: AgendaCleanupState[]) {
  return MEETING_DETAIL_AGENDAS.map((agenda, index) => {
    const cleanup = cleanupStates[index];
    const decisionSummary = cleanup.decisionNone
      ? "결정사항 없음으로 정리했습니다."
      : cleanup.decisionText.trim()
        ? `${cleanup.decisionText.trim()}`
        : "아직 정리된 결정사항이 없습니다.";
    const taskTitle = cleanup.taskName;
    const taskAssignee = cleanup.taskAssignee;
    const taskDue = cleanup.taskDue;
    const taskSummary = cleanup.taskNone
      ? "후속 업무 없음으로 정리했습니다."
      : cleanup.taskCreatedId
        ? `후속 업무는 ${taskTitle}(${taskAssignee}, ${taskDue})입니다.`
        : "후속 업무는 아직 업무 카드로 생성되지 않았습니다.";
    return `안건 ${index + 1}(${agenda.title}): ${decisionSummary} ${taskSummary}`;
  }).join("\n");
}

function OPSMEET06B() {
  const { navigateTo, currentUser, recurringTasks, setRecurringTasks, setSelectedRecurringTaskId } = React.useContext(AppContext);
  const [selectedAgenda, setSelectedAgenda] = useState(2);
  const [summarySource, setSummarySource] = useState<"ai" | "manual" | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<"none" | "generating" | "failed" | "review" | "stale" | "confirmed">("none");
  const [summaryGen, setSummaryGen] = useState(0);
  const [cleanupStates, setCleanupStates] = useState<AgendaCleanupState[]>(() =>
    MEETING_AGENDA_RECORDS.map(record => ({
      decisionText: record.decision,
      decisionNone: false,
      taskLinked: Boolean(record.task),
      taskNone: false,
      taskName: record.task || "안전 인력 배치안 확정",
      taskAssignee: record.assignee || "박해랑",
      taskDue: record.due ? `2026-${record.due.replace("까지", "").replace(".", "-")}` : "2026-07-24",
    }))
  );
  const selectedAgendaInfo = MEETING_DETAIL_AGENDAS[selectedAgenda];
  const selectedCleanup = cleanupStates[selectedAgenda];
  const summaryDone = summaryStatus === "confirmed";
  const decisionsDone = cleanupStates.every(state => Boolean(state.decisionText.trim()) || state.decisionNone);
  const tasksDone = cleanupStates.every(state => Boolean(state.taskCreatedId) || state.taskNone);
  const requiredChecklist: [string, boolean][] = [
    ["안건별 논의 내용", true],
    ["결정사항 또는 없음 표시", decisionsDone],
    ["후속 업무 또는 없음 표시", tasksDone],
    ["참가 결과", true],
  ];
  const requiredDoneCount = requiredChecklist.filter(([, done]) => done).length;
  const canComplete = requiredDoneCount === requiredChecklist.length;

  const generateSummary = () => {
    setSummaryStatus("generating");
    window.setTimeout(() => {
      setSummarySource("ai");
      setSummaryGen(g => g + 1);
      setSummaryStatus("review");
    }, 900);
  };
  const markRecordEdited = () => {
    setSummaryStatus(prev => (prev === "review" || prev === "confirmed" ? "stale" : prev));
  };
  const updateCleanup = (index: number, patch: Partial<AgendaCleanupState>) => {
    setCleanupStates(states => states.map((state, stateIndex) => stateIndex === index ? { ...state, ...patch } : state));
    markRecordEdited();
  };
  const createFollowupTask = (index: number) => {
    const cleanup = cleanupStates[index];
    if (cleanup.taskCreatedId || !cleanup.taskName.trim() || !cleanup.taskAssignee || !cleanup.taskDue) return;
    const nextNumber = Math.max(0, ...recurringTasks.map(task => Number(task.id.replace("R-", "")) || 0)) + 1;
    const taskId = `R-${String(nextNumber).padStart(2, "0")}`;
    const task: RecurringTask = {
      id: taskId,
      name: cleanup.taskName.trim(),
      dept: "운영부",
      assignee: cleanup.taskAssignee,
      status: "예정",
      due: cleanup.taskDue,
      cycle: "상시",
      delayed: false,
      description: cleanup.decisionNone ? "회의 안건에서 생성된 후속 업무입니다." : `${cleanup.decisionText.trim()}\n\n회의 안건에서 생성된 후속 업무입니다.`,
      related: ["운영 > 회의 · 체육대회 안전 관리 최종 회의", `안건 ${index + 1} · ${MEETING_DETAIL_AGENDAS[index].title}`],
      history: [{ date: "방금 전", action: "회의 후속 업무 생성", user: currentUser.name, note: "회의록 정리에서 생성됨" }],
    };
    setRecurringTasks(previous => [...previous, task]);
    updateCleanup(index, { taskCreatedId: taskId, taskLinked: true, taskNone: false });
  };
  const openCreatedTask = (taskId: string) => {
    setSelectedRecurringTaskId(taskId);
    navigateTo("OPS-TASK-01");
  };
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", "체육대회 안전 관리 최종 회의", "회의록 정리"]}
      title="회의록 정리"
      actions={
        <div className="flex items-center gap-3">
          {!canComplete && <span className="text-[10px] text-orange-600">안건별 필수 정리를 완료해 주세요</span>}
          <Btn variant="primary" size="sm" disabled={!canComplete} onClick={() => navigateTo("OPS-MEET-07")}>
            <Check className="w-3.5 h-3.5" /> 정리 완료
          </Btn>
        </div>
      }
    >
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-6xl mx-auto p-6 pb-16 flex flex-col gap-5">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-start gap-3">
            <Clock className="w-4 h-4 text-yellow-700 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-yellow-900">회의가 종료되어 정리 중입니다</p>
                <Chip label="정리 중" variant="yellow" />
              </div>
              <p className="text-[11px] text-yellow-800 mt-1">정리 완료 후 참석자에게 최종 회의록이 제공되고, 불참자에게는 회의 요약 확인이 요청됩니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              ["예정", "15:00–16:30"],
              ["실제 진행", "15:00–16:12"],
              ["참석 결과", "3명 참석 · 1명 불참"],
              ["종료 처리", "박해랑 · 16:12"],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-xs font-bold text-gray-800 mt-2">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
            <div className="flex flex-col gap-4 min-w-0">
              <section className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">회의 전체 요약</h2>
                    <p className="text-[10px] text-gray-400 mt-1">안건별 기록을 바탕으로 불참자에게 제공할 요약을 작성합니다.</p>
                  </div>
                  {summaryStatus === "review" && summarySource === "ai" && <Chip label="AI 생성 초안 · 검토 필요" variant="yellow" />}
                  {summaryStatus === "review" && summarySource === "manual" && <Chip label="직접 작성 중" variant="blue" />}
                  {summaryStatus === "failed" && <Chip label="AI 생성 실패" variant="red" />}
                  {summaryStatus === "stale" && <Chip label="원본 변경됨 · 다시 확인 필요" variant="red" />}
                  {summaryStatus === "confirmed" && <Chip label="최종 확인됨" variant="green" />}
                </div>

                {summaryStatus === "none" && (
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <p className="text-xs font-semibold text-gray-700">아직 작성된 전체 요약이 없습니다</p>
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-5">
                      AI 초안은 안건별 논의·결정 기록만 재구성하며, 기록에 없는 결정·담당자·기한을 새로 만들지 않습니다.
                      <br />요약이 없어도 정리 완료가 막히지는 않습니다.
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <Btn variant="primary" size="sm" onClick={generateSummary}><Sparkles className="w-3.5 h-3.5" /> AI로 전체 요약 만들기</Btn>
                      <Btn variant="text" size="sm" onClick={() => { setSummarySource("manual"); setSummaryStatus("review"); }}>직접 작성</Btn>
                      <Btn variant="text" size="sm" onClick={() => setSummaryStatus("failed")}><AlertCircle className="w-3.5 h-3.5" /> 실패 상태 미리보기</Btn>
                    </div>
                  </div>
                )}

                {summaryStatus === "generating" && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-6 flex items-center justify-center gap-2.5">
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                    <p className="text-xs font-medium text-blue-700">안건 1–3의 논의·결정 기록을 재구성하는 중…</p>
                  </div>
                )}

                {summaryStatus === "failed" && (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-5 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-red-900">AI 요약을 만들지 못했습니다</p>
                      <p className="text-[10px] text-red-700 mt-1 leading-5">안건별 원본 기록은 그대로 보존되어 있습니다. 다시 시도하거나 전체 요약을 직접 작성할 수 있으며, 요약 실패는 회의록 정리 완료를 막지 않습니다.</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Btn variant="secondary" size="sm" onClick={generateSummary}><RefreshCw className="w-3 h-3" /> 다시 시도</Btn>
                        <Btn variant="primary" size="sm" onClick={() => { setSummarySource("manual"); setSummaryStatus("review"); }}>직접 작성</Btn>
                      </div>
                    </div>
                  </div>
                )}

                {(summaryStatus === "review" || summaryStatus === "stale" || summaryStatus === "confirmed") && (
                  <>
                    {summaryStatus === "stale" && (
                      <div className="mb-3 bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 flex items-center gap-3">
                        <AlertCircle className="w-4 h-4 text-yellow-700 shrink-0" />
                        <div className="flex-1">
                          <p className="text-[11px] font-bold text-yellow-900">안건 기록이 변경되어 요약이 오래되었을 수 있습니다</p>
                          <p className="text-[10px] text-yellow-800 mt-0.5">다시 생성하거나, 변경 내용이 반영되었는지 직접 검토해 주세요.</p>
                        </div>
                        <Btn variant="secondary" size="sm" onClick={generateSummary}><RefreshCw className="w-3 h-3" /> 다시 생성</Btn>
                        <Btn variant="text" size="sm" onClick={() => setSummaryStatus("review")}>직접 검토</Btn>
                      </div>
                    )}
                    <textarea
                      key={`summary-${summarySource}-${summaryGen}`}
                      defaultValue={summarySource === "ai" ? buildAiSummaryDraft(cleanupStates) : ""}
                      placeholder="회의 전체 요약을 직접 입력하세요."
                      onChange={() => { if (summaryStatus === "confirmed") setSummaryStatus("review"); }}
                      className={`w-full h-44 border rounded-lg p-4 text-sm leading-7 text-gray-700 resize-none focus:outline-none focus:ring-1 ${summaryStatus === "confirmed" ? "border-green-300 focus:ring-green-300" : "border-orange-300 focus:ring-orange-300"}`}
                    />
                    <div className="flex items-center justify-between mt-2">
                      {summaryStatus === "confirmed" ? (
                        <span className="flex items-center gap-1.5 text-[10px] text-green-700"><Check className="w-3 h-3" /> 박해랑 검토 · 16:25 최종 확인 · 내용을 수정하면 다시 검토가 필요합니다</span>
                      ) : (
                        <span className="text-[10px] text-gray-400">
                          {summarySource === "ai" ? "기록에 없는 결정·담당자·기한은 포함하지 않았습니다. 검토 후 최종 확인해 주세요." : "작성 후 최종 확인해 주세요."}
                        </span>
                      )}
                      {summaryStatus === "review" && (
                        <div className="flex items-center gap-2">
                          {summarySource === "ai" && <Btn variant="text" size="sm" onClick={generateSummary}><RefreshCw className="w-3 h-3" /> 다시 생성</Btn>}
                          <Btn variant="primary" size="sm" onClick={() => setSummaryStatus("confirmed")}><Check className="w-3.5 h-3.5" /> 최종 확인</Btn>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>

              {MEETING_DETAIL_AGENDAS.map((agenda, index) => {
                const record = MEETING_AGENDA_RECORDS[index];
                const cleanup = cleanupStates[index];
                const decisionDone = Boolean(cleanup.decisionText.trim()) || cleanup.decisionNone;
                const taskDone = Boolean(cleanup.taskCreatedId) || cleanup.taskNone;
                const agendaDone = decisionDone && taskDone;
                const taskTitle = cleanup.taskName;
                const taskAssignee = cleanup.taskAssignee;
                const taskDue = cleanup.taskDue.replace("2026-", "").replace("-", ".");
                const selected = selectedAgenda === index;
                return (
                  <section
                    key={agenda.title}
                    onClick={() => setSelectedAgenda(index)}
                    className={`bg-white border rounded-xl overflow-hidden cursor-pointer transition-colors ${selected ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}`}
                  >
                    <div className={`px-6 py-4 border-b flex items-start justify-between gap-4 ${selected ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-100"}`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold text-blue-600">안건 {index + 1}</span>
                          <Chip label={agendaDone ? "필수 정리 완료" : "정리 필요"} variant={agendaDone ? "green" : "yellow"} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900">{agenda.title}</h3>
                        <p className="text-[11px] text-gray-500 mt-1">{agenda.summary}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{agenda.duration}</span>
                    </div>

                    <div className="px-6 py-5 flex flex-col gap-5">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">논의 내용</p>
                        <p className="text-xs text-gray-700 leading-6 whitespace-pre-line">{record.discussion}</p>
                      </div>

                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">결정사항</p>
                        {cleanup.decisionNone ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-600">결정사항 없음</p>
                          </div>
                        ) : cleanup.decisionText.trim() ? (
                          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-900 leading-5">{cleanup.decisionText}</p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-orange-600">아직 결정사항이 정리되지 않았습니다. 오른쪽 패널에서 작성하거나 ‘결정사항 없음’을 선택하세요.</p>
                        )}
                      </div>

                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">후속 업무</p>
                        {cleanup.taskNone ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-600">후속 업무 없음</p>
                          </div>
                        ) : taskTitle ? (
                          <div className="flex items-center gap-3">
                            <Clipboard className="w-4 h-4 text-blue-500" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-gray-800">{taskTitle}</p>
                              <p className="text-[10px] text-gray-500 mt-1">{taskAssignee} · {taskDue}</p>
                            </div>
                            {cleanup.taskCreatedId && <button type="button" onClick={(event) => { event.stopPropagation(); openCreatedTask(cleanup.taskCreatedId!); }} aria-label={`${taskTitle} 업무 카드 열기`} className="text-blue-500 hover:text-blue-700"><ExternalLink className="w-3.5 h-3.5" /></button>}
                          </div>
                        ) : (
                          <p className="text-[11px] text-orange-600">후속 업무를 연결하거나 ‘후속 업무 없음’을 선택하세요.</p>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <aside className="sticky top-5 flex flex-col gap-4">
              <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-900">안건별 결정 정리</h2>
                  <p className="text-[11px] text-gray-400 mt-1">안건을 선택해 결정과 후속 업무를 최종 확인합니다.</p>
                </div>
                <div className="p-3 grid grid-cols-3 gap-2 border-b border-gray-100">
                  {MEETING_DETAIL_AGENDAS.map((agenda, index) => {
                    const cleanup = cleanupStates[index];
                    const agendaDone = (Boolean(cleanup.decisionText.trim()) || cleanup.decisionNone) && (Boolean(cleanup.taskCreatedId) || cleanup.taskNone);
                    const selected = selectedAgenda === index;
                    return (
                      <button
                        key={agenda.title}
                        onClick={() => setSelectedAgenda(index)}
                        className={`rounded-lg border px-2 py-3 text-center ${selected ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
                      >
                        <p className={`text-[10px] font-bold ${selected ? "text-blue-600" : "text-gray-500"}`}>안건 {index + 1}</p>
                        <p className={`text-[10px] mt-1 ${agendaDone ? "text-green-600" : "text-orange-600"}`}>{agendaDone ? "정리됨" : "확인 필요"}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="p-5 flex flex-col gap-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Chip label={`안건 ${selectedAgenda + 1}`} variant="blue" />
                      <Chip
                        label={(Boolean(selectedCleanup.decisionText.trim()) || selectedCleanup.decisionNone) && (Boolean(selectedCleanup.taskCreatedId) || selectedCleanup.taskNone) ? "필수 정리 완료" : "필수 정리 필요"}
                        variant={(Boolean(selectedCleanup.decisionText.trim()) || selectedCleanup.decisionNone) && (Boolean(selectedCleanup.taskCreatedId) || selectedCleanup.taskNone) ? "green" : "yellow"}
                      />
                    </div>
                    <p className="text-xs font-bold text-gray-900 mt-2">{selectedAgendaInfo.title}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-800">결정사항</label>
                    <textarea
                      key={`cleanup-decision-${selectedAgenda}`}
                      value={selectedCleanup.decisionText}
                      placeholder="이 안건에서 확정한 내용을 입력하세요."
                      disabled={selectedCleanup.decisionNone}
                      onChange={event => updateCleanup(selectedAgenda, { decisionText: event.target.value, decisionNone: false })}
                      className={`w-full h-28 border rounded-lg p-3 text-xs leading-5 mt-2 resize-none focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 ${Boolean(selectedCleanup.decisionText.trim()) || selectedCleanup.decisionNone ? "border-gray-300" : "border-orange-300 bg-orange-50"}`}
                    />
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-600">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedCleanup.decisionNone}
                        onChange={event => updateCleanup(selectedAgenda, {
                          decisionNone: event.target.checked,
                          decisionText: event.target.checked ? "" : selectedCleanup.decisionText,
                        })}
                      />
                      이 안건은 결정사항 없음
                    </label>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-800">후속 업무</label>
                      {!selectedCleanup.taskLinked && (
                        <Btn variant="text" size="sm" onClick={() => updateCleanup(selectedAgenda, { taskLinked: true, taskNone: false })}>
                          <Plus className="w-3 h-3" /> 업무 연결
                        </Btn>
                      )}
                    </div>
                    {selectedCleanup.taskLinked ? (
                      <div className="border border-gray-200 rounded-lg p-3 mt-2">
                        <div className="flex items-center justify-between gap-3"><p className="text-[10px] text-gray-500">회의 안건에서 생성할 상시 업무</p>{selectedCleanup.taskCreatedId && <Chip label="업무 카드 생성됨" variant="green" />}</div>
                        <div className="flex flex-col gap-2 mt-3">
                          <Input label="업무명" value={selectedCleanup.taskName} disabled={Boolean(selectedCleanup.taskCreatedId)} onChange={event => updateCleanup(selectedAgenda, { taskName: event.target.value })} />
                          <div className="grid grid-cols-2 gap-2">
                            <Input label="담당자" value={selectedCleanup.taskAssignee} disabled={Boolean(selectedCleanup.taskCreatedId)} onChange={event => updateCleanup(selectedAgenda, { taskAssignee: event.target.value })} />
                            <Input label="마감일" type="date" value={selectedCleanup.taskDue} disabled={Boolean(selectedCleanup.taskCreatedId)} onChange={event => updateCleanup(selectedAgenda, { taskDue: event.target.value })} />
                          </div>
                        </div>
                        {selectedCleanup.taskCreatedId ? (
                          <Btn variant="text" size="sm" className="mt-3" onClick={() => openCreatedTask(selectedCleanup.taskCreatedId!)}>생성된 업무 열기 <ExternalLink className="w-3 h-3" /></Btn>
                        ) : (
                          <Btn variant="primary" size="sm" className="mt-3" disabled={!selectedCleanup.taskName.trim() || !selectedCleanup.taskAssignee || !selectedCleanup.taskDue} onClick={() => createFollowupTask(selectedAgenda)}><Clipboard className="w-3.5 h-3.5" /> 업무 카드 만들기</Btn>
                        )}
                      </div>
                    ) : (
                      <div className="border border-dashed border-gray-300 rounded-lg p-3 mt-2 text-center">
                        <p className="text-[10px] text-gray-400">연결된 후속 업무가 없습니다.</p>
                        <label className="mt-2 flex items-center justify-center gap-2 text-[10px] text-gray-500">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedCleanup.taskNone}
                            onChange={event => updateCleanup(selectedAgenda, { taskNone: event.target.checked, taskLinked: false })}
                          />
                          후속 업무 없음
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-800">정리 완료 조건</h3>
                  <span className={`text-[10px] font-semibold ${canComplete ? "text-green-600" : "text-orange-600"}`}>필수 {requiredDoneCount} / 4</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {requiredChecklist.map(([label, done]) => (
                    <div key={String(label)} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center ${done ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
                        {done ? <Check className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      </span>
                      <span className="text-[10px] text-gray-600">{String(label)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2.5 flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center ${summaryDone ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                      {summaryDone ? <Check className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
                    </span>
                    <span className="text-[10px] text-gray-600">회의 전체 요약 <span className="text-gray-400">(선택)</span></span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── OPS-MEET-07/08 완료 회의록과 불참자 요약 확인 ─────────────────────────────

function MeetingCompletedMinutes({ absent = false }: { absent?: boolean }) {
  const { recurringTasks, currentUser, setSelectedRecurringTaskId, navigateTo } = React.useContext(AppContext);
  const [summaryConfirmedAt, setSummaryConfirmedAt] = useState<string | null>(null);
  const meetingSource = "운영 > 회의 · 체육대회 안전 관리 최종 회의";
  const meetingTasks = recurringTasks.filter((task) => task.related.includes(meetingSource));
  const myMeetingTasks = meetingTasks.filter((task) => task.assignee === currentUser.name && task.status !== "완료");
  const completedMeetingTasks = meetingTasks.filter((task) => task.status === "완료");
  const attentionMeetingTasks = meetingTasks.filter((task) => task.status !== "완료" && (task.delayed || task.status === "검토 필요" || task.assignee === "미지정"));
  const taskStatusVariant = (status: EventTaskStatus) => (
    status === "완료" ? "green" : status === "검토 필요" ? "yellow" : status === "예정" ? "gray" : "blue"
  ) as "green" | "yellow" | "gray" | "blue";
  const openTask = (taskId: string) => {
    setSelectedRecurringTaskId(taskId);
    navigateTo("OPS-TASK-01");
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", "체육대회 안전 관리 최종 회의"]}
      title={absent ? "회의 요약 확인" : "완료된 회의록"}
      actions={absent ? (
        <Btn variant={summaryConfirmedAt ? "secondary" : "primary"} size="sm" disabled={Boolean(summaryConfirmedAt)} onClick={() => setSummaryConfirmedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }))}>
          <Check className="w-3.5 h-3.5" /> {summaryConfirmedAt ? "요약 확인 완료" : "회의 요약 확인 완료"}
        </Btn>
      ) : <Btn variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> 회의록 내보내기</Btn>}
    >
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-6xl mx-auto p-6 pb-16 flex flex-col gap-5">
          {absent ? (
            <div className={`${summaryConfirmedAt ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"} border rounded-xl p-5 flex items-start gap-3`}>
              {summaryConfirmedAt ? <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />}
              <div>
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-bold ${summaryConfirmedAt ? "text-green-900" : "text-orange-900"}`}>{summaryConfirmedAt ? "회의 요약 확인을 완료했습니다" : "회의 요약 확인이 필요합니다"}</p>
                  <Chip label="불참" variant="gray" />
                  {summaryConfirmedAt && <Chip label="확인 완료" variant="green" />}
                </div>
                <p className={`text-[11px] mt-1 ${summaryConfirmedAt ? "text-green-800" : "text-orange-800"}`}>{summaryConfirmedAt ? `${currentUser.name}이 ${summaryConfirmedAt}에 회의 요약을 확인했습니다. 확인 기록은 남지만 참석 기록은 불참으로 유지됩니다.` : "회의에 참가하지 않았습니다. 핵심 결정과 나에게 배정된 후속 업무를 확인해 주세요. 확인해도 참석 기록으로 변경되지는 않습니다."}</p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
              <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-green-900">회의록 정리가 완료되었습니다</p>
                  <Chip label="완료" variant="green" />
                  <Chip label="15:07 참석" variant="gray" />
                </div>
                <p className="text-[11px] text-green-800 mt-1">2026.07.25 16:30 박해랑이 최종 정리했습니다.</p>
              </div>
            </div>
          )}

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold text-blue-600 mb-2">2026 소프트웨어융합대학 체육대회</p>
                <h1 className="text-lg font-bold text-gray-900">체육대회 안전 관리 최종 회의</h1>
                <p className="text-xs text-gray-500 mt-2">2026.07.25 15:00–16:12 · 학생회실 (A204)</p>
              </div>
              <div className="flex gap-6 text-right">
                <div><p className="text-[10px] text-gray-400">참석</p><p className="text-sm font-bold text-gray-800 mt-1">3명</p></div>
                <div><p className="text-[10px] text-gray-400">불참</p><p className="text-sm font-bold text-gray-800 mt-1">1명</p></div>
                <div><p className="text-[10px] text-gray-400">결정</p><p className="text-sm font-bold text-gray-800 mt-1">2건</p></div>
                <div><p className="text-[10px] text-gray-400">후속 업무</p><p className="text-sm font-bold text-gray-800 mt-1">{meetingTasks.length === 0 ? "없음" : `${completedMeetingTasks.length}/${meetingTasks.length}`}</p></div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-[1fr_340px] gap-5 items-start">
            <div className="flex flex-col gap-4">
              <section className={`bg-white border rounded-xl p-5 ${absent ? "border-orange-200" : "border-gray-200"}`}>
                <h2 className="text-sm font-bold text-gray-900 mb-3">회의 핵심 요약</h2>
                <p className="text-sm text-gray-700 leading-7">체육대회 안전 점검 결과를 바탕으로 위험 구간 조치 방안을 확정했습니다. 비상 연락은 현장 담당자에서 운영본부를 거쳐 학생회장과 학교 안전관리팀에 보고하며, 경기별 안전 담당자 명단은 7월 23일까지 전체 운영진에게 배포합니다.</p>
              </section>

              {MEETING_DETAIL_AGENDAS.map((agenda, index) => {
                const agendaTasks = meetingTasks.filter((task) => task.related.includes(`안건 ${index + 1} · ${agenda.title}`));
                return (
                  <section key={agenda.title} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
                      <h3 className="text-xs font-bold text-gray-800">{agenda.title}</h3>
                    </div>
                    <p className="text-xs text-gray-600 leading-6">{agenda.summary}</p>
                    {(index === 0 || index === 1) && (
                      <div className="mt-3 bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-green-700 mb-1">확정된 결정</p>
                        <p className="text-xs text-green-900">{index === 0 ? "본부석 뒤편 전선 구간에 케이블 커버를 설치합니다." : "비상 연락망은 운영본부를 중심으로 단일화합니다."}</p>
                      </div>
                    )}
                    {agendaTasks.length > 0 && (
                      <div className="mt-3 border border-blue-100 bg-blue-50/50 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-blue-700 mb-2">생성된 후속 업무</p>
                        <div className="flex flex-col gap-2">
                          {agendaTasks.map((task) => (
                            <button key={task.id} type="button" onClick={() => openTask(task.id)} className="w-full flex items-center gap-2 text-left bg-white border border-blue-100 hover:border-blue-300 rounded-md px-2.5 py-2 transition-colors">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-gray-800 truncate">{task.name}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{task.assignee} · {task.due.replaceAll("-", ".").slice(5)}까지</p>
                              </div>
                              <Chip label={task.status} variant={taskStatusVariant(task.status)} />
                              <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <aside className="flex flex-col gap-4">
              <section className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-800">후속 업무 진행 현황</h3>
                  <Chip label={meetingTasks.length === 0 ? "없음" : `${completedMeetingTasks.length}/${meetingTasks.length} 완료`} variant={meetingTasks.length > 0 && completedMeetingTasks.length === meetingTasks.length ? "green" : "gray"} />
                </div>
                {meetingTasks.length === 0 ? (
                  <p className="text-[11px] text-gray-500 leading-5">회의록 정리에서 생성한 후속 업무 카드가 여기에 표시됩니다.</p>
                ) : attentionMeetingTasks.length === 0 ? (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-[11px] text-green-800 leading-5">확인이나 배정이 필요한 후속 업무가 없습니다. 업무 상태는 상시 업무 카드와 동일하게 반영됩니다.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-medium text-yellow-700">확인 필요 {attentionMeetingTasks.length}건</p>
                    {attentionMeetingTasks.map((task) => (
                      <button key={task.id} type="button" onClick={() => openTask(task.id)} className="w-full text-left border border-yellow-200 hover:border-yellow-400 rounded-lg p-3 transition-colors">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-gray-800 truncate">{task.name}</p>
                            <p className="text-[10px] text-gray-500 mt-1">{task.assignee} · {task.due.replaceAll("-", ".").slice(5)}까지</p>
                          </div>
                          <Chip label={task.assignee === "미지정" ? "미배정" : task.delayed ? "지연" : task.status} variant={task.assignee === "미지정" || task.delayed ? "red" : taskStatusVariant(task.status)} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {absent && (
                <section className="bg-white border-2 border-orange-300 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-900">나에게 배정된 후속 업무</h3>
                    <Chip label={`${myMeetingTasks.length}건`} variant={myMeetingTasks.length > 0 ? "yellow" : "gray"} />
                  </div>
                  {myMeetingTasks.length === 0 ? (
                    <p className="text-[11px] text-gray-500 leading-5">나에게 배정된 미완료 후속 업무가 없습니다.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {myMeetingTasks.map((task) => (
                        <button key={task.id} type="button" onClick={() => openTask(task.id)} className="w-full text-left border border-gray-200 hover:border-orange-300 rounded-lg p-3 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-800 truncate">{task.name}</p>
                              <p className="text-[10px] text-gray-500 mt-1.5">{task.dept} · {task.due.replaceAll("-", ".").slice(5)}까지</p>
                            </div>
                            <Chip label={task.status} variant={taskStatusVariant(task.status)} />
                          </div>
                          <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-blue-600">업무 열기 <ExternalLink className="w-3 h-3" /></span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-800 mb-3">참석 결과</h3>
                <div className="flex flex-col gap-3">
                  {MEETING_PARTICIPANTS.map((person) => (
                    <div key={person.name} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-700 flex-1">{person.name}</span>
                      <Chip label={person.joined ? `${person.joined} 참석` : "불참"} variant={person.joined ? "green" : "gray"} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-800 mb-3">관련 자료</h3>
                <div className="flex flex-col gap-3">
                  {MEETING_DETAIL_AGENDAS.map((agenda) => (
                    <div key={agenda.material} className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[10px] text-gray-600 flex-1 truncate">{agenda.material}</span>
                      <Download className="w-3 h-3 text-gray-400" />
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function OPSMEET07() { return <MeetingCompletedMinutes />; }
function OPSMEET08() { return <MeetingCompletedMinutes absent />; }

// ─── OPS-MEET-09 취소된 회의 상세 ─────────────────────────────────────────────

function OPSMEET09() {
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "회의", "가을 축제 1차 준비회의"]}
      title="가을 축제 1차 준비회의"
    >
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-5xl mx-auto p-7 pb-16 flex flex-col gap-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
            <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-red-900">이 회의는 취소되었습니다</p>
                <Chip label="취소" variant="red" />
              </div>
              <p className="text-[11px] text-red-800 mt-1">행사 일정 확정이 지연되어 기존 회의를 취소하고 날짜를 다시 조율합니다.</p>
            </div>
          </div>

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h1 className="text-lg font-bold text-gray-900">가을 축제 1차 준비회의</h1>
            <p className="text-xs text-gray-500 mt-2">가을 축제 운영 방향과 부서별 준비 범위를 논의할 예정이었습니다.</p>
            <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-100">
              <div><p className="text-[10px] text-gray-400">원래 예정 일시</p><p className="text-xs font-semibold text-gray-800 mt-1">2026.08.05 13:00</p></div>
              <div><p className="text-[10px] text-gray-400">장소</p><p className="text-xs font-semibold text-gray-800 mt-1">미정</p></div>
              <div><p className="text-[10px] text-gray-400">초대 인원</p><p className="text-xs font-semibold text-gray-800 mt-1">15명</p></div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h2 className="text-sm font-bold text-gray-900">취소 기록</h2></div>
            <div className="p-5 grid grid-cols-2 gap-5">
              <div>
                <p className="text-[10px] text-gray-400">취소 사유</p>
                <p className="text-xs text-gray-700 leading-6 mt-2">행사 일정 확정이 지연되어 참가자들이 참석 가능한 새로운 날짜를 조사한 뒤 회의를 다시 만들기로 했습니다.</p>
              </div>
              <div className="border-l border-gray-100 pl-5">
                <p className="text-[10px] text-gray-400">취소 처리</p>
                <p className="text-xs font-semibold text-gray-800 mt-2">김바다 · 기획부</p>
                <p className="text-[11px] text-gray-500 mt-1">2026.07.29 11:20</p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-blue-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-800">대체 회의</p>
              <p className="text-[11px] text-gray-500 mt-1">새로운 일정을 조율한 뒤 ‘가을 축제 운영 방향 회의’가 생성되었습니다.</p>
            </div>
            <Btn variant="secondary" size="sm">새 회의 상세 보기 <ChevronRight className="w-3.5 h-3.5" /></Btn>
          </section>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── Meeting confirmation states ──────────────────────────────────────────────

function MeetingConfirmationScreen({ kind }: { kind: "start" | "end" | "permission" | "cancel" }) {
  const { navigateTo } = React.useContext(AppContext);
  const isEnd = kind === "end";
  const background = isEnd ? <MeetingLiveScreen facilitator /> : kind === "permission" ? <OPSMEET04B /> : <MeetingScheduledDetail role="owner" />;
  const config = {
    start: {
      title: "회의를 시작할까요?",
      description: "시작하면 회의 상태가 ‘진행 중’으로 변경되고 참가자에게 ‘회의 참가’ 버튼이 활성화됩니다.",
      detail: "예정 시간보다 7일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요.",
      confirm: "회의 시작",
      variant: "primary" as const,
      next: "OPS-MEET-05B",
    },
    end: {
      title: "회의를 종료할까요?",
      description: "종료 후 상태는 ‘완료’가 아니라 ‘정리 중’으로 변경됩니다. 회의록과 결정 내용을 확인한 뒤 정리 완료할 수 있습니다.",
      detail: "미완료 안건 1개 · 참석 3명 · 미참가 1명",
      confirm: "회의 종료",
      variant: "destructive" as const,
      next: "OPS-MEET-06B",
    },
    permission: {
      title: "이수현에게 진행 권한을 부여할까요?",
      description: "이 회의에서 회의 시작·종료, 안건 진행, 의사결정 기록과 회의록 정리를 할 수 있게 됩니다.",
      detail: "회의 수정·취소와 다른 참가자의 권한 변경은 할 수 없습니다.",
      confirm: "진행 권한 부여",
      variant: "primary" as const,
      next: "OPS-MEET-04B",
    },
    cancel: {
      title: "회의를 취소할까요?",
      description: "회의는 삭제되지 않고 취소된 기록으로 남습니다. 참가자는 더 이상 회의에 참가할 수 없습니다.",
      detail: "취소 사유를 입력해야 참가자들이 변경 내용을 이해할 수 있습니다.",
      confirm: "회의 취소",
      variant: "destructive" as const,
      next: "OPS-MEET-09",
    },
  }[kind];

  return (
    <div className="relative h-full">
      <div className="absolute inset-0 opacity-25 pointer-events-none overflow-hidden">{background}</div>
      <div className="absolute inset-0 bg-black/45 flex items-center justify-center z-30 p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[500px] overflow-hidden">
          <div className="p-6">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${kind === "cancel" || kind === "end" ? "bg-red-50" : kind === "permission" ? "bg-blue-50" : "bg-green-50"}`}>
              {kind === "cancel" || kind === "end"
                ? <AlertCircle className="w-5 h-5 text-red-600" />
                : kind === "permission"
                  ? <Users className="w-5 h-5 text-blue-600" />
                  : <ArrowRight className="w-5 h-5 text-green-600" />}
            </div>
            <h2 className="text-base font-bold text-gray-900">{config.title}</h2>
            <p className="text-sm text-gray-600 leading-6 mt-2">{config.description}</p>

            <div className={`mt-4 border rounded-lg px-4 py-3 ${kind === "cancel" || kind === "end" ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-200"}`}>
              <p className={`text-[11px] leading-relaxed ${kind === "cancel" || kind === "end" ? "text-red-700" : "text-gray-600"}`}>{config.detail}</p>
            </div>

            {kind === "cancel" && (
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-700">취소 사유<span className="text-red-500 ml-0.5">*</span></label>
                <textarea defaultValue="행사 일정 확정이 지연되어 새로운 날짜를 조사한 뒤 회의를 다시 만들 예정입니다." className="w-full h-20 border border-gray-300 rounded-lg p-3 text-xs mt-1 resize-none" />
              </div>
            )}
          </div>
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-2">
            <Btn variant="secondary" size="md">돌아가기</Btn>
            <Btn variant={config.variant} size="md" onClick={() => navigateTo(config.next)}>{config.confirm}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function OPSMEETD01() { return <MeetingConfirmationScreen kind="start" />; }
function OPSMEETD02() { return <MeetingConfirmationScreen kind="end" />; }
function OPSMEETD03() { return <MeetingConfirmationScreen kind="permission" />; }
function OPSMEETD04() { return <MeetingConfirmationScreen kind="cancel" />; }

// ─── REC-01 기록 > 완료된 행사 목록 ──────────────────────────────────────────

const ARCHIVE_STATUS_STYLE: Record<ArchiveStatus, { variant: "gray" | "yellow" | "blue" | "green"; label: string }> = {
  "미발행": { variant: "gray", label: "인수인계 문서 미발행" },
  "초안": { variant: "yellow", label: "초안" },
  "검토 중": { variant: "blue", label: "검토 중" },
  "발행": { variant: "green", label: "발행" },
};

const DEFAULT_ARCHIVES: ArchiveRecord[] = [
  {
    id: "archive-spring-booth",
    name: "봄 축제 학생회 부스",
    date: "2026. 05. 28",
    manager: "대외협력부",
    owner: "이윤슬",
    completedAt: "2026. 06. 04",
    summary: "참석자 186명 · 부스 4개 운영 · 미완료 없음",
    archiveStatus: "발행",
    version: "v1.0",
    publishedAt: "2026. 06. 04",
    author: "이윤슬",
    performance: { attend: "186명 참석 (신청 210명)", budget: "예산 집행 92%", tasks: "완료 업무 14건" },
    sourceScreen: "EVT-00A",
    draft: { operation: "09:00 설치 → 11:00 개장 → 17:00 철수", good: "부스별 담당자를 미리 2명씩 배치했습니다.", bad: "경품 대기 줄 관리가 미흡했습니다.", improve: "대기 동선과 번호표를 사전에 준비합니다.", improveOwner: "운영부", handover: "부스 배치도와 포스터 원본 파일을 재사용할 수 있습니다.", nextOwner: "대외협력부 부서장", reviewer: "김바다 (회장단)", reviewNote: "발행 승인", reviewState: "승인" },
    versions: ["v1.0"],
    snapshots: [{ version: "v1.0", publishedAt: "2026. 06. 04", draft: { operation: "09:00 설치 → 11:00 개장 → 17:00 철수", good: "부스별 담당자를 미리 2명씩 배치했습니다.", bad: "경품 대기 줄 관리가 미흡했습니다.", improve: "대기 동선과 번호표를 사전에 준비합니다.", improveOwner: "운영부", handover: "부스 배치도와 포스터 원본 파일을 재사용할 수 있습니다.", nextOwner: "대외협력부 부서장", reviewer: "김바다 (회장단)", reviewNote: "발행 승인", reviewState: "승인" } }],
  },
  {
    id: "archive-closing-2025",
    name: "2025 학년도 종강 행사",
    date: "2025. 12. 19",
    manager: "학술체육부",
    owner: "이수현",
    completedAt: "2026. 01. 07",
    summary: "참석자 320명 · 만족도 설문 92% 긍정",
    archiveStatus: "검토 중",
    version: "",
    author: "이수현",
    performance: { attend: "320명 참석 (신청 356명)", budget: "예산 집행 88%", tasks: "완료 업무 21건" },
    sourceScreen: "EVT-00A",
    draft: { operation: "행사 당일 접수·공연·경품 추첨 순으로 운영했으며, 공연 시작 전 안내 인력을 추가 배치했습니다.", good: "부서별 운영 책임자를 사전에 확정해 현장 의사결정이 빨랐습니다.", bad: "퇴장 시간에 안내 인력이 부족했습니다. 원인은 마지막 순환 근무 계획이 없었던 점입니다.", improve: "마감 30분 전부터 퇴장 안내 전담 인력을 배치합니다.", improveOwner: "운영부", handover: "무대 진행 큐시트와 공연팀 연락망을 다음 담당자에게 전달합니다.", nextOwner: "학술체육부 부서장", reviewer: "김바다 (회장단)", reviewNote: "성과 수치와 퇴장 동선 보완안을 확인 중입니다.", reviewState: "대기" },
    versions: [],
    snapshots: [],
  },
  {
    id: "archive-welcome-2025",
    name: "2025 신입생 환영회",
    date: "2025. 03. 14",
    manager: "홍길동",
    owner: "홍길동",
    completedAt: "2025. 03. 28",
    summary: "참석자 210명 · 참여 설문 완료",
    archiveStatus: "미발행",
    version: "",
    author: "홍길동",
    performance: { attend: "210명 참석 (신청 240명)", budget: "예산 집행 95%", tasks: "완료 업무 9건" },
    sourceScreen: "EVT-00A",
    draft: { operation: "", good: "", bad: "", improve: "", improveOwner: "운영부", handover: "", nextOwner: "", reviewer: "김바다 (회장단)", reviewNote: "", reviewState: "대기" },
    versions: [],
    snapshots: [],
  },
];

// ─── REC-02 행사 아카이브 상세 ────────────────────────────────────────────────
// 발행 시점 스냅샷. 원본이 바뀌어도 이 문서는 변하지 않는다.
type ArchiveDocument = {
  name: string;
  period: string;
  dept: string;
  owner: string;
  status: ArchiveStatus;
  version: string;
  publishedAt?: string;
  author: string;
  reviewer: string;
  sections: {
    id: string;
    title: string;
    rows?: [string, string][];
    timeline?: { when: string; what: string; detail: string }[];
    links?: { label: string; value: string; to: string }[];
    retro?: { good: string[]; bad: { point: string; cause: string }[]; improve: { action: string; owner: string }[] };
    handover?: { assets: string[]; partners: [string, string][]; cautions: string[]; next: string };
  }[];
  checklist: { dept: string; items: string[] }[];
};

const ARCHIVE_DOC: ArchiveDocument = {
  name: "봄 축제 학생회 부스",
  period: "2026. 05. 28 (목) 11:00–17:00",
  dept: "대외협력부",
  owner: "이윤슬",
  status: "발행" as ArchiveStatus,
  version: "v1.0",
  publishedAt: "2026. 06. 04",
  author: "이윤슬",
  reviewer: "김바다 (회장단)",
  sections: [
    {
      id: "overview", title: "개요",
      rows: [
        ["행사 목표", "재학생 교류 확대와 학생회 활동 홍보"],
        ["참여 대상", "소프트웨어융합대학 재학생 전체"],
        ["일정·장소", "2026. 05. 28 11:00–17:00 · 한양대 ERICA 잔디밭"],
        ["책임 부서·책임자", "대외협력부 · 이윤슬"],
        ["행사 규모", "부스 4개 · 운영 인력 12명 · 참석 186명"],
      ],
    },
    {
      id: "performance", title: "성과",
      rows: [
        ["신청 대비 참석", "신청 210명 → 참석 186명 (88.6%)"],
        ["만족도", "설문 응답 142건 · 긍정 89%"],
        ["예산 계획 대비 집행", "계획 1,200,000원 → 집행 1,104,000원 (92%)"],
        ["업무 완료", "전체 14건 완료 · 지연 2건"],
      ],
    },
    {
      id: "timeline", title: "타임라인",
      timeline: [
        { when: "04. 12", what: "기획 확정", detail: "부스 4종 구성과 예산 규모를 운영회의에서 승인" },
        { when: "04. 26", what: "주요 의사결정", detail: "우천 대비 실내 대체 장소를 학생회관 1층으로 확정" },
        { when: "05. 08", what: "업무 지연", detail: "현수막 제작이 업체 사정으로 5일 지연 · 대체 업체로 변경" },
        { when: "05. 20", what: "일정 변경", detail: "종료 시각을 16:00 → 17:00으로 연장" },
        { when: "05. 28", what: "행사 진행", detail: "부스 4개 정상 운영 · 참석 186명" },
        { when: "06. 04", what: "행사 종료·정산", detail: "정산 완료 및 완료 처리" },
      ],
    },
    {
      id: "operation", title: "현장 운영",
      rows: [
        ["실제 진행 순서", "09:00 설치 → 11:00 개장 → 14:00 경품 추첨 → 16:30 정리 → 17:00 철수"],
        ["인력 배치", "부스별 2명 · 안내 2명 · 물품 관리 1명 · 총괄 1명"],
        ["돌발 상황", "13시경 강풍으로 배너 2개 전도. 즉시 고정 추가 후 재설치"],
        ["운영 변경", "대기 인원이 몰려 경품 추첨을 30분 앞당김"],
      ],
    },
    {
      id: "source", title: "근거 자료",
      links: [
        { label: "행사 업무", value: "14건 (완료 12 · 지연 2)", to: "EVT-TASK-01" },
        { label: "관련 회의", value: "3건 · 결정 5건", to: "OPS-MEET-07" },
        { label: "행사 문서", value: "8건 (사양서·시안·정산 근거)", to: "EVT-DOC-01" },
        { label: "정산", value: "구매 요청 6건 · 집행 1,104,000원", to: "FIN-LEDGER-01" },
      ],
    },
    {
      id: "retro", title: "회고",
      retro: {
        good: ["부스별 담당자를 미리 2명씩 배치해 공백이 없었다", "우천 대비 장소를 사전에 확정해 당일 혼선이 없었다"],
        bad: [
          { point: "현수막 제작이 5일 지연됐다", cause: "업체 확정을 행사 3주 전에 시작했다" },
          { point: "경품 대기 줄 관리가 미흡했다", cause: "대기 동선을 사전에 정하지 않았다" },
        ],
        improve: [
          { action: "제작물 업체는 행사 6주 전까지 확정한다", owner: "홍보부" },
          { action: "대기 인원이 몰리는 프로그램은 동선과 번호표를 사전에 준비한다", owner: "운영부" },
        ],
      },
    },
    {
      id: "handover", title: "인수인계",
      handover: {
        assets: ["부스 배치도 (재사용 가능)", "참가 안내 포스터 원본 파일", "경품 수령 확인 서식"],
        partners: [["현수막 제작", "한빛기획 · 031-000-0000"], ["경품 납품", "새봄상사 · 031-111-1111"]],
        cautions: ["잔디밭 사용은 총무처 사전 승인이 필요하다 (2주 소요)", "강풍 시 배너 고정 추가가 필수다"],
        next: "다음 담당: 대외협력부 부서장",
      },
    },
  ],
  checklist: [
    { dept: "대외협력부", items: ["장소 사용 승인 절차 확인", "협력처 연락처 갱신"] },
    { dept: "홍보부", items: ["제작물 일정 6주 전 착수", "포스터 원본 파일 인수"] },
    { dept: "운영부", items: ["대기 동선 계획 수립", "현장 물품 목록 점검"] },
  ],
};

const lines = (value: string, fallback: string) => value.trim() ? value.split("\n").filter(Boolean) : [fallback];

function archiveDocumentFor(archive: ArchiveRecord): ArchiveDocument {
  if (archive.id === "archive-spring-booth") {
    return { ...ARCHIVE_DOC, status: archive.archiveStatus, version: archive.version, publishedAt: archive.publishedAt, author: archive.author, reviewer: archive.draft.reviewer };
  }

  const draft = archive.archiveStatus === "발행" ? archive.snapshots[archive.snapshots.length - 1]?.draft ?? archive.draft : archive.draft;
  return {
    name: archive.name,
    period: archive.date,
    dept: archive.manager,
    owner: archive.owner,
    status: archive.archiveStatus,
    version: archive.version,
    publishedAt: archive.publishedAt,
    author: archive.author,
    reviewer: draft.reviewer,
    sections: [
      { id: "overview", title: "개요", rows: [["행사 목표", "행사 기록을 바탕으로 다음 운영을 준비합니다."], ["일정·장소", archive.date], ["책임 부서·책임자", `${archive.manager} · ${archive.owner}`], ["행사 규모", archive.performance.attend]] },
      { id: "performance", title: "성과", rows: [["신청 대비 참석", archive.performance.attend], ["예산 계획 대비 집행", archive.performance.budget], ["업무 완료", archive.performance.tasks]] },
      { id: "timeline", title: "타임라인", timeline: [{ when: archive.date.slice(5).replaceAll(". ", "."), what: "행사 진행", detail: archive.summary }, { when: archive.completedAt.slice(5).replaceAll(". ", "."), what: "행사 완료 처리", detail: "행사 운영을 종료하고 기록 정리를 시작했습니다." }] },
      { id: "operation", title: "현장 운영", rows: [["운영 기록", draft.operation || "작성 전"]] },
      { id: "source", title: "근거 자료", links: [{ label: "행사 업무", value: archive.performance.tasks, to: "EVT-TASK-01" }, { label: "관련 회의", value: "행사 연결 회의 기록", to: "EVT-MEET-01" }, { label: "행사 문서", value: "행사 공용 문서", to: "EVT-DOC-01" }, { label: "정산", value: archive.performance.budget, to: "FIN-LEDGER-01" }] },
      { id: "retro", title: "회고", retro: { good: lines(draft.good, "작성 전"), bad: [{ point: draft.bad || "작성 전", cause: draft.bad ? "작성자가 기록한 원인" : "" }], improve: [{ action: draft.improve || "작성 전", owner: draft.improveOwner }] } },
      { id: "handover", title: "인수인계", handover: { assets: lines(draft.handover, "작성 전"), partners: [], cautions: [], next: draft.nextOwner ? `다음 담당: ${draft.nextOwner}` : "다음 담당자 미지정" } },
    ],
    checklist: [{ dept: archive.manager, items: [draft.nextOwner ? `다음 담당자 ${draft.nextOwner}에게 전달` : "다음 담당자 지정", "관련 문서와 연락처 확인"] }],
  };
}

function REC02() {
  const { navigateTo, currentUser, archives, selectedArchiveId } = React.useContext(AppContext);
  const [activeSection, setActiveSection] = useState("overview");
  const archive = archives.find(item => item.id === selectedArchiveId) ?? archives[0];
  const doc = archiveDocumentFor(archive);
  const canWriteArchive = isEventManager(currentUser);
  const archiveStyle = ARCHIVE_STATUS_STYLE[doc.status];
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(`archive-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <DesktopShell
      activeSidebar="기록"
      breadcrumb={["기록", "완료된 행사", doc.name]}
      title="행사 아카이브"
      actions={canWriteArchive ? <Btn variant="secondary" size="sm" onClick={() => navigateTo("REC-02A")}><FileText className="w-3.5 h-3.5" /> 아카이브 수정</Btn> : undefined}
    >
      <div className="p-6 flex flex-col gap-5">
        {/* 01 문서 헤더 — 기록 신뢰성 정보를 항상 함께 노출 */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Chip label={doc.status === "발행" ? `발행 ${doc.version}` : archiveStyle.label} variant={archiveStyle.variant} />
                <span className="text-[10px] text-gray-400">{doc.period}</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">{doc.name}</h2>
              <p className="text-xs text-gray-500 mt-1.5">{doc.dept} · 책임자 {doc.owner}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-400">{doc.publishedAt ? `발행 ${doc.publishedAt}` : "발행 전"}</p>
              <p className="text-[10px] text-gray-500 mt-1">작성 {doc.author}</p>
              <p className="text-[10px] text-gray-500">검토 {doc.reviewer}</p>
              {archive.versions.length > 1 && <p className="text-[10px] text-gray-400 mt-1">발행 이력 {archive.versions.join(" · ")}</p>}
            </div>
          </div>
        </section>

        {doc.status === "검토 중" && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 flex items-start gap-2">
            <Eye className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div><p className="text-xs font-bold text-blue-900">검토 중 · 확정 전 내용입니다</p><p className="text-[11px] text-blue-800 mt-1">검토 승인 전에는 발행본으로 사용하거나 인수인계 기준으로 확정하지 않습니다.</p></div>
          </div>
        )}

        <div className="grid grid-cols-[180px_minmax(0,1fr)_260px] gap-5 items-start">
          {/* 02 좌측 목차 — 문서 옆 고정, 현재 대목 강조 */}
          <aside className="sticky top-5 bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">목차</p>
            <div className="flex flex-col">
              {doc.sections.map(section => (
                <div key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${activeSection === section.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    {section.title}
                  </button>
                  {section.id === "retro" && (
                    <div className="flex flex-col pl-3">
                      {["잘된 점", "미흡했던 점", "개선안"].map(sub => (
                        <button key={sub} onClick={() => scrollToSection("retro")} className="text-left px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700">{sub}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* 본문 */}
          <div className="flex flex-col gap-4 min-w-0">
            {doc.sections.map(section => (
              <section
                key={section.id}
                id={`archive-${section.id}`}
                className={`bg-white border rounded-xl overflow-hidden ${activeSection === section.id ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-200"}`}
              >
                <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-900">{section.title}</h3>
                </div>
                <div className="px-6 py-5 flex flex-col gap-4">
                  {section.rows && section.rows.map(([label, value]) => (
                    <div key={label} className="flex gap-3">
                      <span className="text-[11px] text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
                      <span className="text-xs text-gray-700 leading-5 flex-1">{value}</span>
                    </div>
                  ))}

                  {section.timeline && section.timeline.map(item => (
                    <div key={item.when} className="flex gap-3">
                      <span className="text-[11px] font-mono text-gray-400 w-12 shrink-0 pt-0.5">{item.when}</span>
                      <div className="flex-1 border-l border-gray-100 pl-3">
                        <p className="text-xs font-semibold text-gray-800">{item.what}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-5">{item.detail}</p>
                      </div>
                    </div>
                  ))}

                  {section.links && (
                    <>
                      {section.links.map(link => (
                        <div key={link.label} className="flex items-center gap-3 border border-gray-100 rounded-lg px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800">{link.label}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{link.value}</p>
                          </div>
                          <button onClick={() => navigateTo(link.to)} className="text-[11px] text-blue-600 hover:text-blue-800 shrink-0">원본 보기 →</button>
                        </div>
                      ))}
                      <p className="text-[10px] text-gray-400">{doc.status === "발행" ? "위 수치는 발행 시점 기준입니다. 원본이 이후 변경되어도 이 문서는 바뀌지 않습니다." : "위 수치는 원본을 바탕으로 작성·검토 중이며, 발행 시점에 고정됩니다."}</p>
                    </>
                  )}

                  {section.retro && (
                    <>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">잘된 점</p>
                        {section.retro.good.map(item => (
                          <div key={item} className="flex gap-2 mb-1.5">
                            <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-700 leading-5">{item}</p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">미흡했던 점</p>
                        {section.retro.bad.map(item => (
                          <div key={item.point} className="mb-2.5">
                            <div className="flex gap-2">
                              <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-gray-700 leading-5">{item.point}</p>
                            </div>
                            <p className="text-[11px] text-gray-500 ml-5.5 pl-0.5">원인 · {item.cause}</p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">다음 행사 개선안</p>
                        {section.retro.improve.map(item => (
                          <div key={item.action} className="flex items-start gap-2 mb-2">
                            <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-700 leading-5 flex-1">{item.action}</p>
                            <Chip label={item.owner} variant="blue" />
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {section.handover && (
                    <>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">재사용 자산</p>
                        {section.handover.assets.map(item => (
                          <p key={item} className="text-xs text-gray-700 leading-6">· {item}</p>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">협력처·담당자</p>
                        {section.handover.partners.map(([target, contact]) => (
                          <div key={target} className="flex gap-3 mb-1">
                            <span className="text-[11px] text-gray-400 w-24 shrink-0">{target}</span>
                            <span className="text-xs text-gray-700">{contact}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">주의사항</p>
                        {section.handover.cautions.map(item => (
                          <p key={item} className="text-xs text-orange-700 leading-6">⚠ {item}</p>
                        ))}
                      </div>
                      <p className="text-[11px] font-semibold text-gray-700 border-t border-gray-100 pt-4">{section.handover.next}</p>
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* 09 우측 인수인계 체크리스트 */}
          <aside className="sticky top-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-800">인수인계 체크리스트</p>
              <p className="text-[10px] text-gray-400 mt-0.5">부서별 확인 항목</p>
            </div>
            <div className="p-4 flex flex-col gap-4">
              {doc.checklist.map(group => (
                <div key={group.dept}>
                  <p className="text-[10px] font-bold text-blue-600 mb-1.5">{group.dept}</p>
                  {group.items.map(item => (
                    <label key={item} className="flex items-start gap-2 mb-1.5">
                      <input type="checkbox" aria-label={`${group.dept} ${item} 확인 상태`} disabled className="rounded border-gray-300 mt-0.5" />
                      <span className="text-[11px] text-gray-600 leading-4">{item}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── REC-02A 아카이브 작성·검토 ───────────────────────────────────────────────

function REC02AContent() {
  const { navigateTo, currentUser, archives, setArchives, selectedArchiveId } = React.useContext(AppContext);
  const [activeSection, setActiveSection] = useState("operation");
  const [saved, setSaved] = useState(false);
  const archive = archives.find(item => item.id === selectedArchiveId) ?? archives.find(item => item.archiveStatus !== "발행") ?? archives[0];
  const canWriteArchive = isEventManager(currentUser);

  if (!archive || !canWriteArchive) {
    return <DesktopShell activeSidebar="기록" breadcrumb={["기록", "완료된 행사"]} title="아카이브 작성·검토"><div className="p-6"><div className="max-w-lg bg-white border border-gray-200 rounded-xl p-6"><h2 className="text-base font-bold text-gray-900">작성 권한이 없습니다</h2><p className="text-sm text-gray-500 mt-2">행사 운영 조직 관리자 또는 회장단만 아카이브를 작성하고 발행할 수 있습니다.</p><Btn variant="secondary" size="sm" onClick={() => navigateTo("REC-01")} className="mt-5">완료 행사 목록으로</Btn></div></div></DesktopShell>;
  }

  const status = archive.archiveStatus;
  const version = archive.version;
  const { operation, good, bad, improve, improveOwner, handover, nextOwner, reviewer, reviewNote } = archive.draft;
  const updateArchive = (updater: (item: ArchiveRecord) => ArchiveRecord) => setArchives(prev => prev.map(item => item.id === archive.id ? updater(item) : item));
  const updateDraft = (patch: Partial<ArchiveDraft>) => updateArchive(item => ({
    ...item,
    archiveStatus: item.archiveStatus === "발행" || item.archiveStatus === "미발행" ? "초안" : item.archiveStatus,
    draft: { ...item.draft, ...patch, reviewState: item.archiveStatus === "발행" ? "대기" : item.draft.reviewState },
  }));
  const setOperation = (value: string) => updateDraft({ operation: value });
  const setGood = (value: string) => updateDraft({ good: value });
  const setBad = (value: string) => updateDraft({ bad: value });
  const setImprove = (value: string) => updateDraft({ improve: value });
  const setImproveOwner = (value: string) => updateDraft({ improveOwner: value });
  const setHandover = (value: string) => updateDraft({ handover: value });
  const setNextOwner = (value: string) => updateDraft({ nextOwner: value });
  const setReviewer = (value: string) => updateDraft({ reviewer: value });
  const setReviewNote = (value: string) => updateDraft({ reviewNote: value });

  // 01 자동 채움 — 행사 데이터에서 가져오며 편집하지 않는다.
  const autoSections = [
    { id: "overview", title: "개요", value: "2025 신입생 환영회 · 2025. 03. 14 · 홍길동 · 참석 210명" },
    { id: "performance", title: "성과", value: "신청 240명 → 참석 210명 (87.5%) · 예산 집행 95% · 완료 업무 9건" },
    { id: "timeline", title: "타임라인", value: "기획 확정 02.10 → 홍보 시작 02.24 → 행사 03.14 → 정산 완료 03.28" },
    { id: "source", title: "근거 자료", value: "업무 9건 · 회의 2건 · 문서 5건 · 구매 요청 4건" },
  ];

  const conditions: [string, boolean][] = [
    ["현장 운영 기록", operation.trim().length > 0],
    ["회고 · 잘된 점", good.trim().length > 0],
    ["회고 · 미흡했던 점과 원인", bad.trim().length > 0],
    ["회고 · 다음 행사 개선안", improve.trim().length > 0],
    ["인수인계 내용", handover.trim().length > 0],
    ["다음 담당자 지정", nextOwner.trim().length > 0],
  ];
  const doneCount = conditions.filter(([, ok]) => ok).length;
  const isComplete = doneCount === conditions.length;
  const reviewerName = reviewer.split(" ")[0];
  const isReviewer = status === "검토 중" && reviewerName === currentUser.name && archive.author !== currentUser.name;
  const canPublish = isComplete && archive.draft.reviewState === "승인";
  const reviewerOptions = Array.from(new Set([`${currentUser.name} (${currentUser.role})`, "김바다 (회장단)", "이수현 (기획부 부서장)", "김민준 (재정부 부서장)"])).filter(option => option.split(" ")[0] !== archive.author);

  const tocItems = [
    ...autoSections.map(s => ({ id: s.id, title: s.title, auto: true, empty: false })),
    { id: "operation", title: "현장 운영", auto: false, empty: !operation.trim() },
    { id: "retro", title: "회고", auto: false, empty: !good.trim() && !bad.trim() && !improve.trim() },
    { id: "handover", title: "인수인계", auto: false, empty: !handover.trim() },
  ];

  const requestReview = () => {
    if (!isComplete) return;
    updateArchive(item => ({ ...item, archiveStatus: "검토 중", draft: { ...item.draft, reviewState: "대기", reviewNote: "" } }));
  };
  const requestRevision = () => {
    if (!isReviewer) return;
    updateArchive(item => ({ ...item, archiveStatus: "초안", draft: { ...item.draft, reviewState: "보완 요청" } }));
  };
  const approveReview = () => {
    if (!isReviewer) return;
    updateArchive(item => ({ ...item, draft: { ...item.draft, reviewState: "승인" } }));
  };
  const publish = () => {
    if (!canPublish) return;
    updateArchive(item => {
      const nextVersion = item.versions.length === 0 ? "v1.0" : `v1.${item.versions.length}`;
      const publishedAt = "2026. 07. 20";
      return { ...item, archiveStatus: "발행", version: nextVersion, publishedAt, versions: [...item.versions, nextVersion], snapshots: [...item.snapshots, { version: nextVersion, publishedAt, draft: item.draft }] };
    });
  };

  const statusStyle = ARCHIVE_STATUS_STYLE[status];
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const targetId = ["overview", "performance", "timeline", "source"].includes(sectionId) ? "overview" : sectionId;
    document.getElementById(`archive-editor-${targetId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <DesktopShell
      activeSidebar="기록"
      breadcrumb={["기록", "완료된 행사", archive.name, "아카이브 작성"]}
      title="아카이브 작성·검토"
      actions={
        <>
          <Chip label={status === "발행" ? `${statusStyle.label} ${version}` : statusStyle.label} variant={statusStyle.variant} />
          <Btn variant="secondary" size="sm" onClick={() => setSaved(true)}>임시 저장</Btn>
          {status !== "발행" && status !== "검토 중" && (
            <Btn variant="secondary" size="sm" onClick={requestReview} className={isComplete ? "" : "opacity-40 cursor-not-allowed"}><Eye className="w-3.5 h-3.5" /> 검토 요청</Btn>
          )}
          {isReviewer && archive.draft.reviewState !== "승인" && <Btn variant="secondary" size="sm" onClick={requestRevision}><RefreshCw className="w-3.5 h-3.5" /> 보완 요청</Btn>}
          {isReviewer && archive.draft.reviewState !== "승인" && <Btn variant="primary" size="sm" onClick={approveReview}><Check className="w-3.5 h-3.5" /> 검토 승인</Btn>}
          {status !== "발행" && archive.draft.reviewState === "승인" && <Btn variant="primary" size="sm" onClick={publish} className={canPublish ? "" : "opacity-40 cursor-not-allowed"}><Check className="w-3.5 h-3.5" /> 발행</Btn>}
        </>
      }
    >
      <div className="p-6 flex flex-col gap-5">
        {status === "발행" ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <Check className="w-4 h-4 text-green-700 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-green-900">아카이브 {version}이 발행되었습니다</p>
              <p className="text-[11px] text-green-800 mt-1">발행 시점의 성과·타임라인·근거 자료가 스냅샷으로 고정되었습니다. 이후 원본이 변경되어도 이 문서는 바뀌지 않습니다.</p>
            </div>
            <Btn variant="secondary" size="sm" onClick={() => navigateTo("REC-02")}>발행본 보기</Btn>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-900">개요·성과·타임라인·근거 자료는 행사 데이터에서 자동으로 채워집니다</p>
              <p className="text-[11px] text-blue-800 mt-1">직접 작성하는 부분은 현장 운영, 회고, 인수인계입니다. 발행하면 자동 채움 수치가 그 시점으로 고정됩니다.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[180px_minmax(0,1fr)_280px] gap-5 items-start">
          {/* 10 좌측 목차 — 작성 전 표시 */}
          <aside className="sticky top-5 bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">목차</p>
            <div className="flex flex-col">
              {tocItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-1 transition-colors ${activeSection === item.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  <span className={item.auto ? "text-gray-400" : ""}>{item.title}</span>
                  {item.empty && <span className="text-[9px] text-orange-500 shrink-0">작성 전</span>}
                  {item.auto && <span className="text-[9px] text-gray-300 shrink-0">자동</span>}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex flex-col gap-4 min-w-0">
            {/* 01 자동 채움 영역 */}
            <section id="archive-editor-overview" className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden scroll-mt-5">
              <div className="px-6 py-3.5 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">자동 채움 영역</h3>
                <span className="text-[10px] text-gray-400">행사 데이터 기준 · 편집 불가</span>
              </div>
              <div className="px-6 py-4 flex flex-col gap-3">
                {autoSections.map(s => (
                  <div key={s.id} className="flex gap-3">
                    <span className="text-[11px] text-gray-400 w-20 shrink-0 pt-0.5">{s.title}</span>
                    <span className="text-xs text-gray-600 leading-5 flex-1">{s.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 02 현장 운영 */}
            <section id="archive-editor-operation" className={`bg-white border rounded-xl overflow-hidden scroll-mt-5 ${activeSection === "operation" ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-200"}`}>
              <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900">현장 운영</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">실제 진행 순서, 인력 배치, 돌발 상황과 대응</p>
              </div>
              <div className="px-6 py-5">
                <textarea
                  value={operation}
                  onChange={e => setOperation(e.target.value)}
                  placeholder="예) 12:00 준비 → 14:00 개회 → 16:30 정리. 안내 3명·접수 2명 배치. 접수 대기가 몰려 접수대를 2개로 늘림."
                  className="w-full h-28 border border-gray-300 rounded-lg p-3 text-xs leading-5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </section>

            {/* 03 회고 */}
            <section id="archive-editor-retro" className={`bg-white border rounded-xl overflow-hidden scroll-mt-5 ${activeSection === "retro" ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-200"}`}>
              <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900">회고</h3>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-800">잘된 점</label>
                  <textarea value={good} onChange={e => setGood(e.target.value)} placeholder="한 줄에 하나씩 작성" className="w-full h-20 border border-gray-300 rounded-lg p-3 text-xs leading-5 mt-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <label className="text-xs font-semibold text-gray-800">미흡했던 점과 원인</label>
                  <textarea value={bad} onChange={e => setBad(e.target.value)} placeholder="예) 접수 대기가 길었다 — 원인: 접수대를 1개만 운영" className="w-full h-20 border border-gray-300 rounded-lg p-3 text-xs leading-5 mt-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <label className="text-xs font-semibold text-gray-800">다음 행사 개선안</label>
                  <textarea value={improve} onChange={e => setImprove(e.target.value)} placeholder="다음 행사에서 실제로 할 수 있는 행동으로 작성" className="w-full h-20 border border-gray-300 rounded-lg p-3 text-xs leading-5 mt-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-gray-500">담당 부서</span>
                    <select value={improveOwner} onChange={e => setImproveOwner(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-[11px] text-gray-700">
                      {["운영부", "기획부", "홍보부", "재정부", "대외협력부"].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* 04 인수인계 */}
            <section id="archive-editor-handover" className={`bg-white border rounded-xl overflow-hidden scroll-mt-5 ${activeSection === "handover" ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-200"}`}>
              <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900">인수인계</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">재사용 자산, 협력처·담당자, 부서별 체크리스트, 주의사항</p>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <textarea
                  value={handover}
                  onChange={e => setHandover(e.target.value)}
                  placeholder="예) 안내 포스터 원본 파일 재사용 가능 / 다과 납품: 새봄상사 031-111-1111 / 강당 사용은 2주 전 승인 필요"
                  className="w-full h-24 border border-gray-300 rounded-lg p-3 text-xs leading-5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="border-t border-gray-100 pt-4">
                  <Input label="다음 담당자" placeholder="예: 기획부 부서장" value={nextOwner} onChange={e => setNextOwner(e.target.value)} />
                </div>
              </div>
            </section>
          </div>

          {/* 05~07 발행 조건·검토 */}
          <aside className="sticky top-5 flex flex-col gap-4">
            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-800">발행 조건</h3>
                <span className={`text-[10px] font-semibold ${canPublish ? "text-green-600" : "text-orange-600"}`}>{doneCount} / {conditions.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {conditions.map(([label, ok]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${ok ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
                      {ok ? <Check className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                    </span>
                    <span className="text-[10px] text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
              {!canPublish && <p className="text-[10px] text-orange-600 mt-3">조건을 모두 충족해야 발행할 수 있습니다.</p>}
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-gray-800">검토</h3>
              <div>
                <label className="text-[11px] text-gray-500">검토자</label>
                <select value={reviewer} disabled={status === "검토 중" || status === "발행"} onChange={e => setReviewer(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] text-gray-700 mt-1 disabled:bg-gray-50 disabled:text-gray-400">
                  {reviewerOptions.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-500">검토 의견</label>
                <textarea value={reviewNote} readOnly={!isReviewer} onChange={e => setReviewNote(e.target.value)} placeholder={isReviewer ? "검토자가 남기는 의견" : "검토 의견이 여기에 표시됩니다."} className="w-full h-20 border border-gray-200 rounded p-2 text-[11px] leading-4 mt-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 read-only:bg-gray-50 read-only:text-gray-500" />
              </div>
              {status === "검토 중" && (
                <p className="text-[10px] text-blue-600">{reviewer} 검토 대기 중입니다.</p>
              )}
            </section>

            {saved && status !== "발행" && (
              <p className="text-[10px] text-gray-400 text-center">초안으로 임시 저장되었습니다.</p>
            )}
          </aside>
        </div>
      </div>
    </DesktopShell>
  );
}

function REC02A() {
  const context = React.useContext(AppContext);
  return (
    <AppContext.Provider value={{
      ...context,
      selectedArchiveId: context.selectedArchiveId ?? "archive-welcome-2025",
      currentUser: { name: "김바다", dept: "학술체육부", role: "회장단" },
    }}>
      <REC02AContent />
    </AppContext.Provider>
  );
}

function REC01() {
  const { navigateTo, currentUser, archives, setSelectedArchiveId, demoDataMode } = React.useContext(AppContext);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"completed" | "event">("completed");
  const visibleArchives = demoDataMode === "first-use" ? [] : archives;
  const filtered = visibleArchives.filter(e => e.name.includes(search)).sort((a, b) => {
    const aDate = sort === "completed" ? a.completedAt : a.date;
    const bDate = sort === "completed" ? b.completedAt : b.date;
    return bDate.localeCompare(aDate);
  });
  const canWriteArchive = isEventManager(currentUser);
  const unpublishedCount = visibleArchives.filter(e => e.archiveStatus !== "발행").length;

  const openArchive = (evt: ArchiveRecord) => {
    setSelectedArchiveId(evt.id);
    // 발행·검토 중은 열람 화면, 미발행·초안은 권한자만 작성 화면으로 보낸다.
    if (evt.archiveStatus === "발행" || evt.archiveStatus === "검토 중") navigateTo("REC-02");
    else if (canWriteArchive) navigateTo("REC-02A");
  };
  return (
    <DesktopShell
      activeSidebar="기록"
      breadcrumb={["기록", "완료된 행사"]}
      title="완료된 행사"
      actions={<></>}
    >
      <div className="p-6 flex flex-col gap-5">
        <p className="text-sm text-gray-500">완료 처리된 행사의 기록과 인수인계 문서를 열람합니다. 내용을 수정하려면 별도 권한이 필요합니다.</p>

        {unpublishedCount > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 w-fit">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-medium text-orange-800">인수인계 문서 미발행 {unpublishedCount}건</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="행사명 검색"
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="ml-auto">
            <select value={sort} onChange={event => setSort(event.target.value as "completed" | "event")} className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 focus:outline-none">
              <option value="completed">완료 처리일순</option>
              <option value="event">행사 일시순</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            {demoDataMode === "first-use" && !search ? <FileText className="w-8 h-8 text-gray-300" /> : <Search className="w-8 h-8 text-gray-300" />}
            <p className="text-sm text-gray-500">{demoDataMode === "first-use" && !search ? "아직 완료된 행사가 없습니다" : "검색 결과가 없습니다"}</p>
            {demoDataMode === "first-use" && !search && <p className="text-xs text-gray-400">행사가 완료되면 기록과 인수인계 문서가 여기에 쌓입니다.</p>}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-3 max-w-3xl">
            {filtered.map(evt => {
              const archive = ARCHIVE_STATUS_STYLE[evt.archiveStatus];
              const readable = evt.archiveStatus === "발행" || evt.archiveStatus === "검토 중";
              return (
                <div key={evt.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${LIFECYCLE_STYLE["완료"].badge}`}>
                          완료
                        </span>
                        <Chip label={evt.archiveStatus === "발행" ? `${archive.label} ${evt.version}` : archive.label} variant={archive.variant} />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2 truncate">{evt.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {evt.date}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {evt.manager}
                        </div>
                      </div>
                      {/* 성과 요약 — 발행본이 있으면 발행 시점 수치 */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {[evt.performance.attend, evt.performance.budget, evt.performance.tasks].map(item => (
                          <span key={item} className="text-[10px] text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-1">{item}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400">완료 처리 {evt.completedAt}</p>
                    </div>
                    {readable || canWriteArchive ? (
                      <button onClick={() => openArchive(evt)} className="text-[11px] text-blue-500 hover:text-blue-700 shrink-0 mt-1">
                        {readable ? "상세 보기 →" : "아카이브 작성 →"}
                      </button>
                    ) : (
                      <span className="max-w-[160px] text-right text-[10px] leading-4 text-gray-400 shrink-0 mt-1">
                        인수인계 문서가 아직 발행되지 않았습니다
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DesktopShell>
  );
}

function EVT03C() {
  const { navigateTo } = React.useContext(AppContext);
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "체육대회", "인원 관리"]}
      title="2026 소프트웨어융합대학 체육대회"
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          {/* Inner tabs */}
          <div className="flex gap-0 border-b border-gray-200 mb-6">
            {["운영 조직", "행사 참가자"].map(t => (
              <button key={t} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "운영 조직" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500"}`}>{t}</button>
            ))}
          </div>

          <div className="max-w-md mx-auto mt-16 text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">아직 운영 조직이 구성되지 않았습니다</p>
              <p className="text-xs text-gray-500 mt-2 leading-5">
                기본 학생회 조직을 불러오거나 참여 부서만 선택해 시작할 수 있습니다.
                <br />행사 운영 조직은 기본 조직과 별개의 데이터입니다.
              </p>
            </div>
            <Btn variant="primary" size="md" onClick={() => navigateTo("EVT-01")}><Plus className="w-4 h-4" /> 운영 조직 구성하기</Btn>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function EVT04C() {
  const { navigateTo } = React.useContext(AppContext);
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "체육대회", "인원 관리"]}
      title="2026 소프트웨어융합대학 체육대회"
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          {/* Inner tabs */}
          <div className="flex gap-0 border-b border-gray-200 mb-6">
            {["운영 조직", "행사 참가자"].map(t => (
              <button key={t} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "행사 참가자" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500"}`}>{t}</button>
            ))}
          </div>

          <div className="max-w-md mx-auto mt-16 text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Clipboard className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">아직 참가 신청자가 없습니다</p>
              <p className="text-xs text-gray-500 mt-2 leading-5">
                참여 설문을 만들어 모집을 시작하세요.
                <br />외부 학생은 가입 없이 모바일 웹으로 신청합니다.
              </p>
            </div>
            <Btn variant="primary" size="md" onClick={() => navigateTo("EVT-05")}><Plus className="w-4 h-4" /> 참여 설문 만들기</Btn>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function EVT03A() {
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "체육대회", "인원 관리"]}
      title="2026 소프트웨어융합대학 체육대회"
      actions={<><Btn variant="secondary" size="sm">수정</Btn></>}
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          {/* Inner tabs */}
          <div className="flex gap-0 border-b border-gray-200 mb-6">
            {["운영 조직", "행사 참가자"].map(t => (
              <button key={t} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "운영 조직" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500"}`}>{t}</button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-0">
            <EventLeaderCard />
            <OrgStem />
            <OrgBranch>
              {[
                { name: "운영팀", leader: "이윤슬", mems: [members[0], members[1]] },
                { name: "홍보팀", leader: undefined, mems: [members[2]] },
                { name: "현장팀", leader: "정하늘", mems: [members[3]] },
              ].map(({ name, leader, mems }) => (
                <DeptCard key={name} name={name} leader={leader} members={mems} />
              ))}
            </OrgBranch>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function EVT03B() {
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "체육대회", "인원 관리"]}
      title="2026 소프트웨어융합대학 체육대회"
      actions={<><Btn variant="primary" size="sm">완료</Btn></>}
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex gap-0 border-b border-gray-200 mb-6">
            {["운영 조직", "행사 참가자"].map(t => (
              <button key={t} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "운영 조직" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500"}`}>{t}</button>
            ))}
          </div>

          {/* Warning for team lead */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2 mb-5">
            <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700">행사 책임자를 바로 제거할 수 없습니다. 새 책임자를 먼저 지정해 주세요.</p>
          </div>

          <div className="flex flex-col items-center gap-0">
            <EventLeaderCard editMode />
            <OrgStem />
            <OrgBranch>
              {[
                { name: "운영팀", leader: "이윤슬", mems: [members[0], members[1]] },
                { name: "홍보팀", leader: undefined, mems: [members[2]] },
                { name: "현장팀", leader: "정하늘", mems: [members[3]] },
              ].map(({ name, leader, mems }) => (
                <DeptCard key={name} name={name} leader={leader} members={mems} editMode />
              ))}
              <DeptCard name="" members={[]} addDept />
            </OrgBranch>
          </div>
        </div>

        {/* Available panel */}
        <aside className="w-64 border-l border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">추가 가능한 구성원</p>
            <p className="text-xs text-gray-400">기본 조직에서 불러옴</p>
          </div>
          <div className="flex-1 overflow-auto p-3 flex flex-wrap gap-2 content-start">
            <MemberCard name="정하늘" dept="컴퓨터학부" grade="3학년" addable />
            <MemberCard name="박해랑" dept="컴퓨터학부" grade="2학년" addable />
          </div>
        </aside>
      </div>
    </DesktopShell>
  );
}

const participantRows = [
  { name: "김학생", id: "2022111111", dept: "컴퓨터학부", apply: "신청 완료", payment: "납부 확인", attend: "미확인", warn: true },
  { name: "이수강", id: "2023222222", dept: "ICT융합학부", apply: "신청 완료", payment: "미납", attend: "미확인", warn: true },
  { name: "박참여", id: "2021333333", dept: "인공지능학과", apply: "신청 완료", payment: "납부 확인", attend: "참석", warn: true },
  { name: "최대기", id: "2024444444", dept: "컴퓨터학부", apply: "대기 중", payment: "미확인", attend: "미확인", warn: true },
  { name: "강신청", id: "2022555555", dept: "컴퓨터학부", apply: "신청 완료", payment: "납부 확인", attend: "불참", warn: true },
  { name: "윤확인", id: "2023666666", dept: "컴퓨터학부", apply: "신청 완료", payment: "미확인", attend: "미확인", warn: true },
];

function EVT04({ onOpenQR }: { onOpenQR?: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const { currentUser, eventWorkspaceFilter, setEventWorkspaceFilter } = React.useContext(AppContext);
  const canManage = isEventManager(currentUser);
  const visibleRows = eventWorkspaceFilter === "participantReview" ? participantRows.filter(row => row.warn) : participantRows;
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "체육대회", "인원 관리"]}
      title="2026 소프트웨어융합대학 체육대회"
      actions={canManage ? <>
        <Btn variant="secondary" size="sm">참여 희망 조사 생성</Btn>
        <Btn variant="secondary" size="sm" onClick={onOpenQR}><QrCode className="w-3.5 h-3.5" /> 참석 확인 QR</Btn>
        <Btn variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> 명단 내보내기</Btn>
      </> : undefined}
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="p-6 flex flex-col gap-4">
        <div className="flex gap-0 border-b border-gray-200">
          {["운영 조직", "행사 참가자"].map(t => (
            <button key={t} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "행사 참가자" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500"}`}>{t}</button>
          ))}
        </div>

        {eventWorkspaceFilter === "participantReview" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-xs text-yellow-800 font-medium">확인 필요 참가자 6명만 보고 있습니다.</span>
            <button onClick={() => setEventWorkspaceFilter(null)} className="ml-auto text-xs text-yellow-700 hover:underline">필터 해제</button>
          </div>
        )}

        {/* Action bar when selected */}
        {selected.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs text-blue-700 font-medium">{selected.length}명 선택됨</span>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm">참석 처리</Btn>
              <Btn variant="secondary" size="sm">불참 처리</Btn>
              <Btn variant="secondary" size="sm">납부 확인</Btn>
            </div>
            <button className="ml-auto text-blue-400 hover:text-blue-600" onClick={() => setSelected([])}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-gray-200 rounded px-3 py-1.5 bg-white w-52">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input placeholder="이름, 학번 검색" className="text-xs outline-none placeholder-gray-400 flex-1" />
          </div>
          {["신청 상태", "입금 상태", "참석 상태", "학부·학과"].map(f => (
            <div key={f} className="relative">
              <select className="border border-gray-200 rounded px-3 py-1.5 text-xs bg-white appearance-none pr-7">
                <option>{f}</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 w-8"><input type="checkbox" className="rounded" /></th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">이름</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">학번</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">소속</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">신청 상태</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">입금 상태</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">참석 상태</th>
                <th className="px-3 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => (
                <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${r.warn ? "bg-yellow-50" : ""}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" className="rounded" checked={selected.includes(i)} onChange={() => setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])} />
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900 flex items-center gap-1">
                    {r.name}
                    {r.warn && <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-gray-600">{r.id}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{r.dept}</td>
                  <td className="px-3 py-2.5">
                    <Chip label={r.apply} variant={r.apply === "신청 완료" ? "blue" : "gray"} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Chip label={r.payment} variant={r.payment === "납부 확인" ? "green" : r.payment === "미납" ? "red" : "gray"} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Chip label={r.attend} variant={r.attend === "참석" ? "green" : r.attend === "불참" ? "red" : "gray"} />
                  </td>
                  <td className="px-3 py-2.5">
                    <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>총 5명</span>
          <div className="flex gap-1">
            <button className="px-2 py-1 border border-gray-200 rounded text-gray-400">이전</button>
            <button className="px-2 py-1 border border-blue-500 rounded bg-blue-50 text-blue-700">1</button>
            <button className="px-2 py-1 border border-gray-200 rounded text-gray-600">다음</button>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function EVT04B({ onClose }: { onClose?: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[440px] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">참석 확인 QR</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 flex flex-col items-center gap-5">
          {/* QR placeholder */}
          <div className="w-48 h-48 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <QrCode className="w-16 h-16 text-gray-300" />
              <p className="text-xs text-gray-400">QR 코드</p>
            </div>
          </div>

          <Chip label="활성 중" variant="green" />

          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 shrink-0">시작</span>
              <input type="datetime-local" className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-xs" defaultValue="2026-08-20T09:30" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 shrink-0">종료</span>
              <input type="datetime-local" className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-xs" defaultValue="2026-08-20T11:00" />
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">참가자는 휴대폰 기본 카메라로 촬영합니다. 로그인이나 앱 설치가 필요 없습니다.</p>

          <div className="flex gap-2 w-full">
            <Btn variant="secondary" size="sm" className="flex-1 justify-center"><Download className="w-3.5 h-3.5" /> QR 다운로드</Btn>
            <Btn variant="secondary" size="sm" className="flex-1 justify-center"><RefreshCw className="w-3.5 h-3.5" /> 재생성</Btn>
            <Btn variant="destructive" size="sm" className="flex-1 justify-center">비활성화</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function EVT05() {
  const { eventInfo, surveySettings, setSurveySettings, navigateTo } = React.useContext(AppContext);
  const [selectedQ, setSelectedQ] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(true);
  const recruitRef = React.useRef<HTMLDivElement>(null);
  const endAtRef = React.useRef<HTMLInputElement>(null);

  const upd = <K extends keyof SurveySettings>(k: K, v: SurveySettings[K]) =>
    setSurveySettings(s => ({ ...s, [k]: v }));

  // ── Derived values ──
  const feeDisplay =
    eventInfo.feeType === "무료" ? "무료" :
    eventInfo.feeType === "정액 유료" ? (eventInfo.feeAmount || "금액 미입력") :
    eventInfo.feeType === "학생회비 조건부" ? `납부자 ${eventInfo.feePaidAmount === "0" ? "무료" : eventInfo.feePaidAmount + "원"} / 미납자 ${eventInfo.feeUnpaidAmount}원` :
    "미정";

  const hasName = surveySettings.questions.some(q => q.q === "이름" && q.required);
  const hasStudentId = surveySettings.questions.some(q => q.q === "학번" && q.required);
  const hasPrivacy = surveySettings.questions.some(q => q.type === "개인정보 동의");

  // ── Activation condition computation ──
  type CondItem = { label: string; done: boolean; missing?: string; location: string; actionLabel: string; action?: () => void };

  const basicConds: CondItem[] = [
    { label: "행사명", done: !!eventInfo.name.trim(), missing: "행사명을 입력하세요", location: "행사 기본정보", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    { label: "시작 일시", done: !!eventInfo.startAt, missing: "시작 일시를 입력하세요", location: "행사 기본정보 → 일시", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    { label: "종료 일시", done: eventInfo.noEndTime || !!eventInfo.endAt, missing: "종료 일시를 입력하거나 미정을 선택하세요", location: "행사 기본정보 → 일시", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    { label: "장소", done: !eventInfo.placeConfirmed || !!eventInfo.placeName.trim(), missing: "장소명을 입력하거나 미정을 선택하세요", location: "행사 기본정보 → 장소", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    { label: "참가 대상", done: !!eventInfo.target.trim(), missing: "참가 대상을 입력하세요", location: "행사 기본정보 → 참여 정보", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    { label: "참가비 유형", done: eventInfo.feeType !== "미정", missing: "참가비 유형을 선택하세요", location: "행사 기본정보 → 참여 정보", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    ...(eventInfo.feeType === "정액 유료" ? [
      { label: "참가비 금액·결제 안내", done: !!eventInfo.feeAmount.trim() && !!eventInfo.feePayment.trim(), missing: "금액과 결제 안내를 입력하세요", location: "행사 기본정보 → 참가비(정액 유료)", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    ] : []),
    ...(eventInfo.feeType === "학생회비 조건부" ? [
      { label: "납부자·미납자 금액·결제 안내", done: !!eventInfo.feeUnpaidAmount.trim() && !!eventInfo.feePayment.trim(), missing: "금액과 결제 안내를 입력하세요", location: "행사 기본정보 → 참가비(학생회비 조건부)", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    ] : []),
    { label: "행사 정원 유형", done: eventInfo.capacityType !== "미정", missing: "행사 정원 유형을 선택하세요", location: "행사 기본정보 → 참여 정보", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    ...(eventInfo.capacityType === "인원제한" ? [
      { label: "정원 인원", done: !!eventInfo.capacityCount && Number(eventInfo.capacityCount) > 0, missing: "정원 인원을 입력하세요", location: "행사 기본정보 → 행사 정원", actionLabel: "기본정보에서 수정", action: () => navigateTo("EVT-02B") },
    ] : []),
  ];

  const surveyConds: CondItem[] = [
    {
      label: "신청 마감 일시", done: !!surveySettings.endAt,
      missing: "신청 마감 일시가 설정되지 않았습니다", location: "모집 설정",
      actionLabel: "모집 설정에서 입력",
      action: () => { recruitRef.current?.scrollIntoView({ behavior: "smooth" }); setTimeout(() => endAtRef.current?.focus(), 300); },
    },
    {
      label: "신청 시작·마감 순서",
      done: !surveySettings.startAt || !surveySettings.endAt || surveySettings.startAt < surveySettings.endAt,
      missing: "마감 일시가 시작 일시보다 앞에 있습니다", location: "모집 설정",
      actionLabel: "모집 설정에서 수정",
      action: () => recruitRef.current?.scrollIntoView({ behavior: "smooth" }),
    },
    { label: "신청 방식", done: !!surveySettings.method, location: "모집 설정", actionLabel: "모집 설정에서 확인" },
    { label: "이름 필수 문항", done: hasName, missing: "이름 문항이 없거나 필수가 아닙니다", location: "설문 문항", actionLabel: "문항 확인" },
    { label: "학번 필수 문항", done: hasStudentId, missing: "학번 문항이 없거나 필수가 아닙니다", location: "설문 문항", actionLabel: "문항 확인" },
    { label: "개인정보 수집·이용 동의", done: hasPrivacy, missing: "개인정보 동의 문항이 없습니다", location: "설문 문항", actionLabel: "문항 추가" },
    ...(surveySettings.useHakbi ? [
      { label: "학생회비 대조용 식별 문항", done: hasName && hasStudentId, missing: "학생회비 대조를 위해 이름·학번이 필수 문항이어야 합니다", location: "설문 문항", actionLabel: "문항 확인" },
    ] : []),
  ];

  const allConds = [...basicConds, ...surveyConds];
  const missingCount = allConds.filter(c => !c.done).length;
  const allDone = missingCount === 0;

  const CheckRow = ({ item }: { item: CondItem }) => (
    <div className={`flex items-start gap-3 py-2 border-b border-gray-50 last:border-0 ${!item.done ? "bg-red-50 -mx-3 px-3 rounded" : ""}`}>
      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${item.done ? "bg-green-500" : "bg-red-100 border border-red-300"}`}>
        {item.done ? <Check className="w-2.5 h-2.5 text-white" /> : <X className="w-2.5 h-2.5 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${item.done ? "text-gray-700" : "text-red-700"}`}>{item.label}</p>
        {!item.done && item.missing && <p className="text-[10px] text-red-500 mt-0.5">{item.missing}</p>}
        {!item.done && <p className="text-[10px] text-gray-400">입력 위치: {item.location}</p>}
      </div>
      {!item.done && item.action && (
        <button onClick={item.action} className="text-[11px] text-blue-600 hover:text-blue-800 shrink-0 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded">{item.actionLabel} →</button>
      )}
    </div>
  );

  const handleActivate = () => {
    if (!allDone) return;
    setSurveySettings(s => ({ ...s, status: "활성" }));
    navigateTo("EVT-04");
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "참여 설문"]}
      title="참여 설문 생성·관리"
      actions={<>
        <Chip label={surveySettings.status} variant={surveySettings.status === "활성" ? "green" : "gray"} />
        <Btn variant="secondary" size="sm"><Eye className="w-3.5 h-3.5" /> 미리보기</Btn>
        <div className="relative inline-flex items-center">
          <button
            onClick={handleActivate}
            disabled={!allDone}
            aria-disabled={!allDone}
            title={!allDone ? `활성화 조건 미충족 ${missingCount}개` : "설문 링크 활성화"}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${allDone ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer" : "bg-blue-200 text-blue-400 cursor-not-allowed"}`}
          >
            {surveySettings.status === "활성" ? "링크 활성화됨" : "설문 링크 활성화"}
          </button>
          {!allDone && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{missingCount}</span>
          )}
        </div>
      </>}
    >
      <div className="flex h-full">
        <div className="flex-1 overflow-auto">
          <div className="p-6 flex flex-col gap-4">

            {/* 행사 기본정보 요약 */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors" onClick={() => setInfoOpen(v => !v)}>
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  <p className="text-xs font-semibold text-gray-700">행사 기본정보 <span className="text-[10px] font-normal text-gray-400 ml-1">행사 기본정보에서 자동 반영</span></p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${infoOpen ? "rotate-180" : ""}`} />
              </button>
              {infoOpen && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
                    {[
                      ["행사명", eventInfo.name || "미정"],
                      ["행사 일시", eventInfo.startAt ? `${eventInfo.startAt.replace("T", " ")} ~` : "미정"],
                      ["장소", eventInfo.placeConfirmed ? (eventInfo.placeName || "미정") : "미정"],
                      ["참가 대상", eventInfo.target || "미정"],
                      ["참가비", feeDisplay],
                      ["행사 정원", eventInfo.capacityType === "제한없음" ? "제한 없음" : eventInfo.capacityType === "인원제한" ? `${eventInfo.capacityCount}명` : "미정"],
                      ["담당자", eventInfo.manager || "미정"],
                      ["문의", eventInfo.contact || "미정"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-2 min-w-0">
                        <span className="text-[10px] text-gray-400 w-16 shrink-0 pt-px">{k}</span>
                        <span className="text-[11px] text-gray-700 break-words min-w-0">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                    <button onClick={() => navigateTo("EVT-02B")} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> 행사 기본정보에서 수정
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 모집 설정 */}
            <div ref={recruitRef} className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">모집 설정 <span className="text-[10px] font-normal text-gray-400">참여 설문에서 관리</span></p>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-700">신청 기간 <span className="text-red-500">*</span></label>
                  <div className="flex gap-2 items-center">
                    <input type="datetime-local" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" value={surveySettings.startAt} onChange={e => upd("startAt", e.target.value)} />
                    <span className="text-xs text-gray-400">~</span>
                    <div className="flex-1 relative">
                      <input ref={endAtRef} type="datetime-local" className={`w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${!surveySettings.endAt ? "border-red-300 bg-red-50 focus:ring-red-400" : "border-gray-300 focus:ring-blue-500"}`} value={surveySettings.endAt} onChange={e => upd("endAt", e.target.value)} />
                      {!surveySettings.endAt && <div className="absolute right-2 top-1.5"><AlertCircle className="w-3 h-3 text-red-400" /></div>}
                    </div>
                  </div>
                  {!surveySettings.endAt && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 신청 마감 일시를 입력해야 링크를 활성화할 수 있습니다</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-700">신청 방식</label>
                  <div className="flex gap-2">
                    {(["선착순", "관리자승인"] as RecruitMethod[]).map(v => (
                      <button key={v} onClick={() => upd("method", v)} className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${surveySettings.method === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                        {v === "관리자승인" ? "관리자 승인" : v}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={surveySettings.useWaiting} onChange={e => upd("useWaiting", e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300" disabled={eventInfo.capacityType !== "인원제한"} />
                  <span className={`text-xs ${eventInfo.capacityType !== "인원제한" ? "text-gray-400" : "text-gray-700"}`}>정원 초과 시 대기 신청 운영</span>
                  {eventInfo.capacityType !== "인원제한" && <span className="text-[10px] text-gray-400">(인원 제한 설정 시 사용 가능)</span>}
                </label>

                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={surveySettings.useHakbi} onChange={e => upd("useHakbi", e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300" />
                    <span className="text-xs text-gray-700">학생회비 납부 여부 대조</span>
                  </label>
                  {surveySettings.useHakbi && (
                    <div className="bg-blue-50 border border-blue-100 rounded p-2.5 text-xs text-blue-700 flex items-start gap-2 ml-5">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      이름·학번 문항이 설문에 포함되어 있어야 합니다. 명단 불일치 신청자는 "확인 필요"로 분류됩니다.
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-700">신청 완료 안내 문구</label>
                  <textarea rows={2} className="border border-gray-300 rounded px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" value={surveySettings.completionMsg} onChange={e => upd("completionMsg", e.target.value)} placeholder="예: 신청이 완료되었습니다. 행사 당일 QR을 준비해 주세요." />
                </div>
              </div>
            </div>

            {/* 링크 활성화 조건 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700">설문 링크 활성화 조건</p>
                {!allDone && <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">미충족 {missingCount}개</span>}
                {allDone && <span className="text-[11px] text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded">모두 충족</span>}
              </div>
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">행사 기본정보</p>
                <div className="flex flex-col">{basicConds.map(item => <CheckRow key={item.label} item={item} />)}</div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">참여 설문 설정</p>
                <div className="flex flex-col">{surveyConds.map(item => <CheckRow key={item.label} item={item} />)}</div>
              </div>
            </div>

            {/* 설문 문항 */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-700">설문 문항</p>
              {surveySettings.questions.map((q) => (
                <div key={q.id} onClick={() => setSelectedQ(q.id)} className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedQ === q.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className={`w-4 h-4 ${q.locked ? "text-gray-200" : "text-gray-300"}`} />
                      <span className="text-sm font-medium text-gray-800">{q.q}</span>
                      {q.locked && <Chip label="필수 · 삭제 불가" variant="gray" />}
                      {!q.locked && q.required && <Chip label="필수" variant="blue" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Chip label={q.type} variant="default" />
                      {!q.locked && !(surveySettings.useHakbi && (q.q === "이름" || q.q === "학번")) && (
                        <button onClick={e => { e.stopPropagation(); setSurveySettings(s => ({ ...s, questions: s.questions.filter(x => x.id !== q.id) })); }} className="text-gray-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex items-center justify-center gap-2 flex-wrap">
              <p className="text-xs text-gray-400 font-medium">질문 추가</p>
              <div className="flex gap-2 flex-wrap">
                {["단답형", "객관식", "체크박스", "개인정보 동의"].map(t => (
                  <button key={t} onClick={() => setSurveySettings(s => ({ ...s, questions: [...s.questions, { id: Date.now(), q: t === "개인정보 동의" ? "개인정보 동의" : "새 질문", type: t, required: false, locked: false }] }))} className="px-2 py-1 text-xs border border-gray-200 rounded bg-white text-gray-600 hover:border-gray-300">{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="w-72 border-l border-gray-200 bg-white overflow-auto shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">질문 설정</p>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {selectedQ !== null && (() => {
              const q = surveySettings.questions.find(x => x.id === selectedQ);
              if (!q) return null;
              return (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-700">질문 텍스트</label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" value={q.q} disabled={q.locked} onChange={e => setSurveySettings(s => ({ ...s, questions: s.questions.map(x => x.id === q.id ? { ...x, q: e.target.value } : x) }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-700">질문 유형</label>
                    <div className="relative">
                      <select disabled={q.locked} value={q.type} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8 disabled:bg-gray-50" onChange={e => setSurveySettings(s => ({ ...s, questions: s.questions.map(x => x.id === q.id ? { ...x, type: e.target.value } : x) }))}>
                        <option>단답형</option><option>객관식</option><option>체크박스</option><option>개인정보 동의</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">필수 응답</label>
                    <button
                      onClick={() => {
                        if (q.locked || (surveySettings.useHakbi && (q.q === "이름" || q.q === "학번"))) return;
                        setSurveySettings(s => ({ ...s, questions: s.questions.map(x => x.id === q.id ? { ...x, required: !x.required } : x) }));
                      }}
                      className={`w-9 h-5 rounded-full relative ${q.required ? "bg-blue-500" : "bg-gray-200"}`}
                    >
                      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 shadow transition-all ${q.required ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </aside>
      </div>
    </DesktopShell>
  );
}

function EVT05B() {
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "체육대회", "참여 설문"]}
      title="참여 설문 생성·관리"
      actions={<><Chip label="활성" variant="green" /></>}
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="flex items-center justify-center h-full">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[540px] p-0 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 px-6 py-4">
            <h3 className="text-sm font-semibold text-red-900 mb-0.5">새 설문으로 교체하시겠어요?</h3>
            <p className="text-xs text-red-700">응답이 존재하는 설문은 직접 수정할 수 없습니다.</p>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["현재 설문 응답자", "84명"],
                ["영향받는 응답자", "84명 (재응답 필요)"],
              ].map(([k, v]) => (
                <div key={k} className="border border-gray-200 rounded p-3">
                  <p className="text-[10px] text-gray-400">{k}</p>
                  <p className="text-sm font-bold text-gray-800">{v}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 text-xs text-gray-600">
              {[
                "기존 설문은 '교체됨' 상태로 변경됩니다.",
                "기존 응답자 데이터는 삭제되지 않고 보관됩니다.",
                "기존 응답자는 새 설문에 다시 응답해야 합니다.",
                "기존 링크에서는 새 설문으로 이동 버튼이 표시됩니다.",
              ].map(s => (
                <div key={s} className="flex items-start gap-2">
                  <span className="text-orange-400 shrink-0">•</span>
                  {s}
                </div>
              ))}
            </div>

            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 mb-2">새 설문 초안 생성 방식</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: "기존 질문 복사해서 시작", desc: "질문 구조만 복사. 응답 데이터는 복사하지 않습니다.", checked: true },
                  { label: "빈 설문으로 시작", desc: "기본 질문(이름·학번 포함)만 포함한 새 초안.", checked: false },
                ].map(({ label, desc, checked }) => (
                  <label key={label} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-gray-100">
                    <div className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${checked ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                      {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{label}</p>
                      <p className="text-[10px] text-gray-400">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <Btn variant="secondary" size="sm">취소</Btn>
            <Btn variant="destructive" size="sm">기존 설문 종료 후 새 설문 초안 만들기</Btn>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── Mobile External Screens ──────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center py-8 bg-gray-100 min-h-full">
      <div className="w-[390px] bg-white shadow-2xl rounded-3xl overflow-hidden flex flex-col" style={{ minHeight: 844 }}>
        {/* Status bar */}
        <div className="bg-white px-6 py-2.5 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-gray-900">9:41</span>
          <div className="flex gap-1">
            <div className="w-4 h-2 bg-gray-800 rounded-sm" />
            <div className="w-3 h-2 bg-gray-800 rounded-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Finance Components ──────────────────────────────────────────────────────

// ─── FIN-LEDGER-01 사용 내역 ──────────────────────────────────────────────────

const LEDGER_ROWS = [
  { date: "07.17", title: "케이블 커버 6m 외 1건", target: "2026 체육대회", dept: "운영부", budgetLine: "안전·설비", amount: 84000, evidence: "완료" },
  { date: "07.16", title: "안전 안내 표지 제작", target: "2026 체육대회", dept: "운영부", budgetLine: "인쇄·제작", amount: 45000, evidence: "누락" },
  { date: "07.15", title: "현수막 제작 (본부석)", target: "2026 체육대회", dept: "홍보부", budgetLine: "인쇄·제작", amount: 120000, evidence: "완료" },
  { date: "07.14", title: "진행요원 교육 다과", target: "2026 체육대회", dept: "운영부", budgetLine: "회의·운영비", amount: 32000, evidence: "완료" },
  { date: "07.11", title: "웰컴 키트 견본 구매", target: "신입생 환영 행사", dept: "기획부", budgetLine: "물품 구매", amount: 58000, evidence: "확인 중" },
  { date: "07.10", title: "구급약품 세트", target: "2026 체육대회", dept: "운영부", budgetLine: "안전·설비", amount: 67000, evidence: "완료" },
  { date: "07.08", title: "정기 운영회의 간식", target: "운영 (상시)", dept: "운영부", budgetLine: "회의·운영비", amount: 21000, evidence: "완료" },
  { date: "07.05", title: "SNS 광고 집행", target: "신입생 환영 행사", dept: "홍보부", budgetLine: "홍보비", amount: 90000, evidence: "누락" },
  { date: "07.03", title: "사무용품 (A4·토너)", target: "운영 (상시)", dept: "운영부", budgetLine: "사무·비품", amount: 43000, evidence: "완료" },
  { date: "07.01", title: "회계 장부 바인더", target: "운영 (상시)", dept: "재정부", budgetLine: "사무·비품", amount: 15000, evidence: "완료" },
];

function FINLEDGER01() {
  return (
    <DesktopShell
      activeSidebar="재정"
      breadcrumb={["재정", "사용 내역"]}
      title="사용 내역"
    >
      <div className="p-6 flex flex-col gap-5">
        <p className="text-sm text-gray-500">학생회 예산이 언제, 어디에 사용되었는지 열람합니다. 모든 구성원이 볼 수 있습니다.</p>

        {/* 요약 카드 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            ["이번 학기 총 지출", "3,842,000원", "text-gray-900"],
            ["7월 지출", "1,286,000원", "text-gray-900"],
            ["증빙 완료", "42건 중 37건", "text-gray-900"],
            ["증빙 누락", "5건", "text-red-600"],
          ].map(([label, value, cls]) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className={`text-sm font-bold mt-2 ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 border border-gray-200 rounded px-2.5 py-1.5 bg-white min-w-[180px]">
            <Search className="w-3 h-3 text-gray-400" />
            <span className="text-[11px] text-gray-300">내역·행사 검색</span>
          </div>
          {["2026년 7월", "전체 행사", "전체 부서", "전체 예산 항목"].map(f => (
            <div key={f} className="flex items-center gap-1 border border-gray-200 rounded px-2.5 py-1.5 text-[11px] text-gray-500 bg-white">
              {f} <ChevronDown className="w-3 h-3 ml-0.5 text-gray-400" />
            </div>
          ))}
        </div>

        {/* 사용 내역 테이블 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">일자</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">내역</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">행사·사용처</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">부서</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">예산 항목</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">금액</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-center">증빙</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {LEDGER_ROWS.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{row.date}</td>
                    <td className="px-5 py-3 text-xs font-medium text-gray-800">{row.title}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{row.target}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{row.dept}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{row.budgetLine}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-900 text-right font-mono">{row.amount.toLocaleString()}원</td>
                    <td className="px-5 py-3 text-center">
                      <Chip label={row.evidence} variant={row.evidence === "완료" ? "green" : row.evidence === "누락" ? "red" : "yellow"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[10px] text-gray-400">2026년 7월 · 총 42건 중 최근 10건 표시</p>
            <p className="text-[10px] text-gray-400">증빙 처리와 정산은 재정부·회장단이 증빙 관리에서 진행합니다.</p>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function FINWORK01() {
  const { navigateTo, purchaseRequests, demoDataMode } = React.useContext(AppContext);
  const [activeFilter, setActiveFilter] = useState<"전체" | "검토 필요" | "구매 필요" | "증빙 필요">("전체");
  const [search, setSearch] = useState("");
  const visiblePurchaseRequests = demoDataMode === "first-use" ? [] : purchaseRequests;
  // 제출된 구매 요청을 그대로 사용한다. 새 요청도 즉시 검토 대기열에 나타난다.
  const countByStatus = (statuses: string[]) => visiblePurchaseRequests.filter(req => statuses.includes(req.status)).length;
  const summary = [
    { label: "검토 대기", value: `${countByStatus(["검토 대기", "재검토 대기"])}건`, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "보완 요청", value: `${countByStatus(["보완 요청"])}건`, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "구매 필요", value: `${countByStatus(["승인", "부분 승인", "승인 완료", "구매 필요"])}건`, color: "text-red-600", bg: "bg-red-50" },
    { label: "증빙 필요", value: `${countByStatus(["증빙 필요"])}건`, color: "text-gray-900", bg: "bg-gray-100" },
  ];
  const matchesFilter = (request: PurchaseRequest) => {
    if (activeFilter === "검토 필요") return ["검토 대기", "재검토 대기"].includes(request.status);
    if (activeFilter === "구매 필요") return ["승인", "부분 승인", "승인 완료", "구매 필요"].includes(request.status);
    if (activeFilter === "증빙 필요") return request.status === "증빙 필요";
    return true;
  };
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRequests = visiblePurchaseRequests.filter(request =>
    matchesFilter(request) &&
    (!normalizedSearch || `${request.title} ${request.event}`.toLowerCase().includes(normalizedSearch))
  );

  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" },
      activeSidebar: "재정"
    }}>
      <DesktopShell
        breadcrumb={["재정", "구매 요청"]}
        title="구매 요청"
        actions={<Btn variant="secondary" size="sm" onClick={() => navigateTo("FIN-EVID-01")}><FileText className="w-3.5 h-3.5" /> 증빙 관리</Btn>}
      >
        <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">
          <p className="text-sm text-gray-500 -mb-1">학생회 전체와 각 행사의 구매 요청을 한 곳에서 확인합니다. 행사 맥락의 처리는 각 행사의 재정 탭에서, 증빙·정산은 증빙 관리에서 진행합니다.</p>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            {summary.map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] text-gray-400 font-medium mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex gap-4">
                {(["전체", "검토 필요", "구매 필요", "증빙 필요"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={activeFilter === t}
                    onClick={() => setActiveFilter(t)}
                    className={`text-sm font-semibold ${activeFilter === t ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="요청 제목, 행사명 검색" className="text-xs outline-none bg-transparent" />
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-400">행사명</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-400">요청 제목</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-400 text-right">요청액</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-400 text-center">상태</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-400">담당자</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-gray-400">필요일</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRequests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigateTo("FIN-REV-01")}>
                    <td className="px-5 py-4 text-xs text-gray-500">{req.event}</td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">{req.title}</td>
                    <td className="px-5 py-4 text-sm text-gray-900 text-right font-mono">{req.totalEstimatedAmount.toLocaleString()}원</td>
                    <td className="px-5 py-4 text-center">
                      <Chip label={req.status} variant={req.status === "검토 대기" || req.status === "재검토 대기" ? "blue" : req.status === "보완 요청" ? "yellow" : req.status === "증빙 필요" ? "red" : req.status === "정산 완료" ? "gray" : "green"} />
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">{req.requester}</td>
                    <td className="px-5 py-4 text-xs text-gray-500 font-mono">{req.neededDate.slice(5).replace("-", ".")}</td>
                    <td className="px-3 py-4 text-right"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                  </tr>
                ))}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <p className="text-sm font-semibold text-gray-600">{demoDataMode === "first-use" && activeFilter === "전체" && !search ? "아직 제출된 구매 요청이 없습니다" : "조건에 맞는 구매 요청이 없습니다"}</p>
                      {demoDataMode === "first-use" && activeFilter === "전체" && !search ? (
                        <p className="mt-2 text-xs text-gray-400">구성원이 구매 요청을 제출하면 검토할 항목이 여기에 표시됩니다.</p>
                      ) : (
                        <button type="button" onClick={() => { setActiveFilter("전체"); setSearch(""); }} className="mt-2 text-xs text-blue-600 hover:text-blue-700">필터·검색 초기화</button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DesktopShell>
    </AppContext.Provider>
  );
}

function EVTFIN01() {
  const { navigateTo, purchaseRequests, currentUser } = React.useContext(AppContext);
  const [view, setView] = useState<"step" | "list">("list");

  const summary = [
    { label: "배정 예산", value: "3,000,000", sub: "원" },
    { label: "승인·집행 예정액", value: "1,100,000", sub: "원" },
    { label: "실제 지출액", value: "950,000", sub: "원" },
    { label: "사용 가능액", value: "950,000", sub: "원", color: "blue" },
  ];

  const steps = ["검토 필요", "구매 필요", "증빙 필요", "정산 완료"];
  const pendingCount = purchaseRequests.filter(r => r.status === "검토 대기").length;
  const canReviewPurchase = canManageFinance(currentUser);
  const openPurchaseRequest = () => navigateTo(canReviewPurchase ? "FIN-REV-01" : "FIN-REQ-02");

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회", "재정"]}
      title="행사 재정 — 개요"
      tabs={EVENT_TABS}
      activeTab="재정"
      actions={
        <>
          <Btn variant="secondary" size="sm" onClick={() => navigateTo("MY-REQ-01")}><User className="w-3.5 h-3.5" /> 내 구매 요청</Btn>
          <Btn variant="primary" size="sm" onClick={() => navigateTo("FIN-REQ-01")}><Plus className="w-3.5 h-3.5" /> 새 구매 요청</Btn>
        </>
      }
    >
      <div className="p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
           <div className="grid grid-cols-4 gap-4 flex-1">
            {summary.map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] font-medium text-gray-500 mb-1">{s.label}</p>
                <div className="flex items-baseline gap-0.5">
                  <span className={`text-lg font-bold ${s.color === "blue" ? "text-blue-600" : "text-gray-900"}`}>{s.value}</span>
                  <span className="text-[10px] text-gray-400">{s.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-gray-200 shrink-0">
          <div className="flex gap-4">
            <button onClick={() => setView("step")} className={`px-2 py-3 text-sm font-medium border-b-2 transition-colors ${view === "step" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"}`}>처리 단계</button>
            <button onClick={() => setView("list")} className={`px-2 py-3 text-sm font-medium border-b-2 transition-colors ${view === "list" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"}`}>전체 목록</button>
          </div>
          <div className="flex items-center gap-2 mb-[-1px]">
            <span className="text-xs text-gray-500">검토 대기</span>
            <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
          </div>
        </div>

        {view === "step" && (
          <div className="flex gap-4 items-start overflow-x-auto pb-4 custom-scrollbar">
            {steps.map(step => (
              <div key={step} className="flex flex-col gap-3 min-w-[280px]">
                <p className="text-xs font-semibold text-gray-600 px-1">{step}</p>
                <div className="flex flex-col gap-3 min-h-[400px] bg-gray-100/50 rounded-xl p-2 border border-dashed border-gray-200">
                  {purchaseRequests.filter(req => {
                    if (step === "검토 필요") return req.status === "검토 대기" || req.status === "보완 요청" || req.status === "재검토 대기";
                    if (step === "구매 필요") return req.status === "승인" || req.status === "부분 승인" || req.status === "승인 완료";
                    if (step === "증빙 필요") return req.status === "증빙 필요";
                    if (step === "정산 완료") return req.status === "정산 완료";
                    return false;
                  }).map(req => (
                    <button type="button" key={req.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:border-blue-400 transition-all cursor-pointer text-left" onClick={openPurchaseRequest}>
                      <div className="flex items-center justify-between mb-2.5">
                        <Chip label={req.dept} variant="gray" />
                        <span className="text-[10px] text-gray-400">{req.neededDate}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 mb-1 leading-tight">{req.title}</p>
                      <p className="text-[10px] text-gray-500 line-clamp-1 mb-3">품목 {req.items.length}개 · {req.items.map(i => i.name).join(", ")}</p>
                      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
                        <span className="text-xs font-bold text-gray-900">{req.totalEstimatedAmount.toLocaleString()}원</span>
                        <Chip label={req.status} variant={req.status === "보완 요청" || req.status === "재검토 대기" ? "yellow" : req.status === "승인 완료" ? "green" : "blue"} />
                      </div>
                    </button>
                  ))}
                  {purchaseRequests.filter(req => {
                    if (step === "검토 필요") return req.status === "검토 대기" || req.status === "보완 요청" || req.status === "재검토 대기";
                    if (step === "구매 필요") return req.status === "승인" || req.status === "부분 승인" || req.status === "승인 완료";
                    if (step === "증빙 필요") return req.status === "증빙 필요";
                    if (step === "정산 완료") return req.status === "정산 완료";
                    return false;
                  }).length === 0 && (
                    <p className="text-[10px] text-gray-400 text-center py-12">항목 없음</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "list" && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                  <th className="px-4 py-3 font-medium">요청일</th>
                  <th className="px-4 py-3 font-medium">구매 요청명</th>
                  <th className="px-4 py-3 font-medium">요청 부서</th>
                  <th className="px-4 py-3 font-medium text-right">전체 요청액</th>
                  <th className="px-4 py-3 font-medium text-center">현재 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchaseRequests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 cursor-pointer" onClick={openPurchaseRequest}>
                    <td className="px-4 py-3 text-gray-500 font-mono">2026-03-01</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                       <div className="flex items-center gap-2">
                        {req.title}
                        {req.priority === "긴급" && <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 px-1 rounded">긴급</span>}
                       </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.dept}</td>
                    <td className="px-4 py-3 font-bold text-gray-900 text-right">{req.totalEstimatedAmount.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center"><Chip label={req.status} variant={req.status === "승인 완료" ? "green" : "blue"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DesktopShell>
  );
}

function FINREQ01() {
  const { navigateTo, purchaseRequests, setPurchaseRequests, currentUser, purchaseRequestDraft, setPurchaseRequestDraft, setDemoDataMode } = React.useContext(AppContext);
  const [title, setTitle] = useState(purchaseRequestDraft?.title ?? "체육대회 운영 물품");
  const today = formatDateInput(new Date());
  const [neededDate, setNeededDate] = useState(() => purchaseRequestDraft?.neededDate ?? getDefaultNeededDate());
  const neededDateInputRef = React.useRef<HTMLInputElement>(null);
  const [purpose, setPurpose] = useState(purchaseRequestDraft?.purpose ?? "행사 당일 운영 및 물품 관리");
  const [priority, setPriority] = useState<"보통" | "긴급">(purchaseRequestDraft?.priority ?? "보통");
  const [items, setItems] = useState<PurchaseDraftItem[]>(purchaseRequestDraft?.items ?? [
    { id: 1, name: "박스테이프", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 5, unit: "개", estimatedUnitPrice: 2000, estimatedTotalPrice: 10000, details: {}, quoteStatus: "미요청" },
    { id: 2, name: "생수 500ml", category: "식음료", budgetLine: "식비", purchaseType: "일반 구매", quantity: 10, unit: "박스", estimatedUnitPrice: 5000, estimatedTotalPrice: 50000, details: {}, quoteStatus: "미요청" },
    { id: 3, name: "이름표 용지", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 200, unit: "장", estimatedUnitPrice: 300, estimatedTotalPrice: 60000, details: {}, quoteStatus: "미요청" },
    { id: 4, name: "유성 마커", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 10, unit: "개", estimatedUnitPrice: 1500, estimatedTotalPrice: 15000, details: {}, quoteStatus: "미요청" },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftSaved, setDraftSaved] = useState(false);

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.estimatedUnitPrice), 0);

  const addItem = () => setItems([...items, { id: Date.now(), name: "", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 1, unit: "개", estimatedUnitPrice: 0, estimatedTotalPrice: 0, details: {}, quoteStatus: "미요청" }]);
  const removeItem = (id: number) => setItems(items.filter(i => i.id !== id));

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "estimatedUnitPrice") {
           updated.estimatedTotalPrice = updated.quantity * updated.estimatedUnitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleTypeChange = (id: number, type: any) => {
    updateItem(id, "purchaseType", type);
    updateItem(id, "details", {}); // Reset details when type changes
  };

  const validate = (submittedNeededDate = neededDate) => {
    const newErrors: Record<string, string> = {};
    if (!title) newErrors.title = "요청 제목을 입력해 주세요.";
    if (!submittedNeededDate) newErrors.neededDate = "필요한 날짜를 선택해 주세요.";
    else if (submittedNeededDate < today) newErrors.neededDate = "오늘 이전 날짜는 선택할 수 없습니다.";
    if (!purpose) newErrors.purpose = "구매 목적을 입력해 주세요.";
    if (items.length === 0) newErrors.items = "최소 한 개 이상의 품목을 등록해야 합니다.";

    items.forEach((item, idx) => {
      if (!item.name) newErrors[`item_${item.id}_name`] = "품목명을 입력해 주세요.";
      if (!item.quantity || item.quantity <= 0) newErrors[`item_${item.id}_qty`] = "수량을 입력해 주세요.";
      if (!item.unit) newErrors[`item_${item.id}_unit`] = "단위를 입력해 주세요.";
      if (!item.estimatedUnitPrice || item.estimatedUnitPrice <= 0) newErrors[`item_${item.id}_price`] = "단가를 입력해 주세요.";
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    const submittedNeededDate = neededDateInputRef.current?.value ?? neededDate;
    if (validate(submittedNeededDate)) {
      const requestNumber = `REQ-${String(purchaseRequests.length + 1).padStart(3, "0")}`;
      setPurchaseRequests(prev => [{
        id: requestNumber,
        title: title.trim(),
        event: "2026 소프트웨어융합대학 체육대회",
        dept: currentUser.dept,
        requester: currentUser.name,
        purpose: purpose.trim(),
        neededDate: submittedNeededDate,
        priority,
        totalEstimatedAmount: totalAmount,
        status: "검토 대기",
        items: items.map(item => ({ ...item, status: "검토 대기" })),
        history: [
          { date: "2026-07-19 12:00", action: "요청 생성", user: currentUser.name },
          { date: "2026-07-19 12:00", action: "검토 요청 제출", user: currentUser.name },
        ],
      }, ...prev]);
      setPurchaseRequestDraft(null);
      setDemoDataMode("default");
      navigateTo("MY-REQ-01");
    } else {
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0];
      const el = document.getElementById(firstErrorKey);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  const saveDraft = () => {
    setPurchaseRequestDraft({ title, neededDate, purpose, priority, items, savedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) });
    setDraftSaved(true);
  };

  return (
    <DesktopShell activeSidebar="운영" title="구매 요청 작성·수정" breadcrumb={["운영", "행사", "2026 체육대회", "재정", "구매 요청 작성"]}>
      <div className="flex h-full bg-gray-50 overflow-hidden">
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-20">
            {/* Header / Correction Info */}
            <div className="flex flex-col gap-2">
               <h1 className="text-xl font-bold text-gray-900">구매 요청서 작성</h1>
               <p className="text-xs text-gray-500">행사 운영에 필요한 물품 또는 용역의 구매를 요청합니다.</p>
            </div>

            {purchaseRequestDraft && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div><p className="text-xs font-bold text-blue-900">임시 저장한 구매 요청을 이어서 작성하고 있습니다</p><p className="text-[11px] text-blue-700 mt-1">{purchaseRequestDraft.savedAt}에 저장됨 · 제출 전에는 재정부 검토 목록에 표시되지 않습니다.</p></div>
                <Btn variant="text" size="sm" onClick={() => { setPurchaseRequestDraft(null); setDraftSaved(false); }}>초안 삭제</Btn>
              </div>
            )}

            {/* Basic Info */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 bg-blue-600 rounded-full" />
                <h2 className="text-sm font-bold text-gray-800">기본 요청 정보</h2>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div id="title">
                  <Input label="요청 제목" value={title} onChange={e => setTitle(e.target.value)} required error={errors.title} />
                  {errors.title && <p className="text-[10px] text-red-500 mt-1">{errors.title}</p>}
                </div>
                <Input label="요청 부서" value="운영부" disabled hint="작성자의 소속 부서로 고정됩니다." />
                <div id="neededDate" className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-700">필요한 날짜<span className="text-red-500 ml-0.5">*</span></label>
                  <input
                    ref={neededDateInputRef}
                    type="date"
                    min={today}
                    value={neededDate}
                    onChange={e => {
                      setNeededDate(e.target.value);
                      if (errors.neededDate) setErrors(current => ({ ...current, neededDate: "" }));
                    }}
                    className={`border ${errors.neededDate ? "border-red-500 bg-red-50" : "border-gray-300"} rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500`}
                  />
                  {errors.neededDate && <p className="text-[10px] text-red-500 mt-1">{errors.neededDate}</p>}
                </div>
                <Input label="우선순위" select selectOptions={["보통", "긴급"]} value={priority} onChange={e => setPriority(e.target.value)} />
              </div>
              <div id="purpose" className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">구매 목적<span className="text-red-500 ml-0.5">*</span></label>
                <textarea
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className={`border ${errors.purpose ? "border-red-500 bg-red-50" : "border-gray-300"} rounded px-3 py-2 text-sm h-20 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                  placeholder="예산을 사용하는 구체적인 이유와 용도를 설명해 주세요."
                />
                {errors.purpose && <p className="text-[10px] text-red-500 mt-1">{errors.purpose}</p>}
              </div>
            </div>

            {/* Item List */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h2 className="text-sm font-bold text-gray-800">품목 리스트</h2>
                  <span className="text-[11px] text-gray-400 font-normal ml-1">총 {items.length}개 품목</span>
                </div>
                <Btn variant="secondary" size="sm" onClick={addItem}><Plus className="w-3.5 h-3.5" /> 품목 추가</Btn>
              </div>

              {errors.items && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs font-medium">{errors.items}</div>}

              <div className="flex flex-col gap-4">
                {items.map((item, idx) => (
                  <div key={item.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden group">
                    <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                        <span className="text-[11px] font-bold text-gray-600">{item.name || "새 품목"}</span>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-5 flex flex-col gap-5">
                      <div className="grid grid-cols-3 gap-5">
                        <div id={`item_${item.id}_name`}>
                          <Input label="품목명" value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} placeholder="예: 박스테이프" required error={errors[`item_${item.id}_name`]} />
                        </div>
                        <Input label="품목 카테고리" select selectOptions={["운영 물품", "제작·굿즈", "식음료", "인쇄물", "대여", "용역", "기타"]} value={item.category} onChange={e => updateItem(item.id, "category", e.target.value)} required />
                        <Input label="예산 항목" select selectOptions={["행사 운영비", "홍보비", "식비", "시설·장비비", "예비비"]} value={item.budgetLine} onChange={e => updateItem(item.id, "budgetLine", e.target.value)} required />
                      </div>

                      <div className="grid grid-cols-4 gap-5 items-end">
                        <Input label="구매 유형" select selectOptions={["일반 구매", "제작·인쇄", "대여·용역"]} value={item.purchaseType} onChange={e => handleTypeChange(item.id, e.target.value)} required />
                        <div className="grid grid-cols-2 gap-2">
                           <Input label="수량" type="number" value={String(item.quantity)} onChange={e => updateItem(item.id, "quantity", Number(e.target.value))} required />
                           <Input label="단위" placeholder="개" value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)} required />
                        </div>
                        <Input label="예상 단가" type="number" value={String(item.estimatedUnitPrice)} onChange={e => updateItem(item.id, "estimatedUnitPrice", Number(e.target.value))} placeholder="0" required />
                        <div className="bg-blue-50 rounded border border-blue-100 px-3 py-2 h-[38px] flex flex-col justify-center">
                          <p className="text-[9px] text-blue-500 leading-none mb-1 font-semibold uppercase tracking-wider">품목 총액</p>
                          <p className="text-sm font-bold text-blue-700 leading-none">{(item.quantity * item.estimatedUnitPrice).toLocaleString()}원</p>
                        </div>
                      </div>

                      {/* Conditional Detail Inputs */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">유형별 상세 정보</p>

                        {item.purchaseType === "일반 구매" && (
                          <div className="grid grid-cols-2 gap-4">
                            <Input label="판매처 또는 쇼핑몰" placeholder="예: 쿠팡, 네이버쇼핑 등" />
                            <Input label="상품 URL" placeholder="https://..." />
                            <Input label="상품 옵션 또는 규격" placeholder="예: 검정 / 대형 / 50m" />
                            <Input label="배송 요청사항" placeholder="특이사항 입력" />
                          </div>
                        )}

                        {item.purchaseType === "제작·인쇄" && (
                          <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-3 gap-4">
                              <Input label="제작물 종류" placeholder="예: 현수막, 굿즈 등" />
                              <Input label="사이즈 또는 규격" placeholder="예: 500x90cm" />
                              <Input label="색상" placeholder="예: 배경색 파랑" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-medium text-gray-700">옵션별 수량 (예: M-10개, L-20개)</label>
                                <textarea className="border border-gray-300 rounded px-3 py-2 text-xs h-16 bg-white" placeholder="사이즈·색상 조합별 수량을 입력하세요." />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <Input label="인쇄 방식" placeholder="예: 실사출력" />
                                <div className="flex flex-col gap-1">
                                  <label className="text-[11px] font-medium text-gray-700">납품 희망일</label>
                                  <input type="date" className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white" />
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-gray-700">디자인 파일</label>
                                <Btn variant="secondary" className="bg-white"><Upload className="w-3 h-3" /> 파일 업로드</Btn>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-gray-700">참고 이미지</label>
                                <Btn variant="secondary" className="bg-white"><Upload className="w-3 h-3" /> 파일 업로드</Btn>
                              </div>
                              <Input label="제작 요청사항" placeholder="특이사항 입력" />
                            </div>
                          </div>
                        )}

                        {item.purchaseType === "대여·용역" && (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                             <Input label="업체 또는 제공자" placeholder="예: 바다렌탈" />
                             <Input label="수행 장소" placeholder="예: 학교 정문 앞" />
                             <div className="grid grid-cols-2 gap-3">
                               <div className="flex flex-col gap-1">
                                 <label className="text-[11px] font-medium text-gray-700">수령/시작 일시</label>
                                 <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white" />
                               </div>
                               <div className="flex flex-col gap-1">
                                 <label className="text-[11px] font-medium text-gray-700">반납/종료 일시</label>
                                 <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white" />
                               </div>
                             </div>
                             <Input label="담당자 연락처" placeholder="예: 010-1234-5678" />
                             <div className="col-span-2">
                               <Input label="용역 포함 항목 및 요청사항" placeholder="설치, 철거 포함 여부 등 기재" />
                             </div>
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[11px] font-medium text-gray-700">견적서 확보 상태</label>
                              <div className="flex gap-2">
                                {["미요청", "요청 중", "수령 완료"].map(s => (
                                  <button
                                    key={s}
                                    onClick={() => updateItem(item.id, "quoteStatus", s)}
                                    className={`px-3 py-1.5 rounded border text-[10px] font-medium transition-all ${item.quoteStatus === s ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {item.quoteStatus === "수령 완료" && (
                              <div className="grid grid-cols-2 gap-3 flex-[2]">
                                <Input label="견적 업체" placeholder="업체명" />
                                <Input label="견적 금액" type="number" placeholder="0" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Summary Panel */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-[-4px_0_15px_rgba(0,0,0,0.02)]">
          <div className="p-6 flex flex-col gap-6 h-full">
             <div className="flex flex-col gap-1">
               <h3 className="text-sm font-bold text-gray-800">요청 요약</h3>
               <p className="text-[10px] text-gray-400">제출 전 최종 내용을 확인하세요.</p>
             </div>

             <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                   <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">전체 예상 금액</p>
                   <p className="text-2xl font-bold text-blue-600">{totalAmount.toLocaleString()}<span className="text-sm font-medium ml-0.5 text-blue-500">원</span></p>
                </div>
                <div className="border-t border-gray-200 pt-4 flex flex-col gap-2.5">
                   <div className="flex justify-between text-xs">
                     <span className="text-gray-500">총 품목 수</span>
                     <span className="font-bold text-gray-800">{items.length}개</span>
                   </div>
                   <div className="flex justify-between text-xs">
                     <span className="text-gray-500">우선순위</span>
                     <span className={`font-bold ${priority === "긴급" ? "text-red-500" : "text-gray-800"}`}>{priority}</span>
                   </div>
                   <div className="flex justify-between text-xs">
                     <span className="text-gray-500">희망 기한</span>
                     <span className="font-bold text-gray-800">{neededDate || "미지정"}</span>
                   </div>
                </div>
             </div>

             <div className="mt-auto flex flex-col gap-2">
                <Btn variant="primary" size="md" className="w-full justify-center py-3" onClick={handleSubmit}>구매 요청 제출</Btn>
                <Btn variant="secondary" size="md" className="w-full justify-center" onClick={saveDraft}>임시 저장</Btn>
                <Btn variant="text" size="sm" className="w-full justify-center text-gray-400" onClick={() => navigateTo("MY-REQ-01")}>취소</Btn>
             </div>

             <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <p className={`text-[10px] leading-relaxed ${draftSaved ? "text-green-700 font-medium" : "text-blue-700"}`}>{draftSaved ? "임시 저장되었습니다. 제출 전에는 재정부 검토 목록에 표시되지 않습니다." : "제출된 요청은 재정부의 검토 후 구매가 진행됩니다. 보완 요청이 있을 경우 '내 업무'에서 확인할 수 있습니다."}</p>
                </div>
             </div>
          </div>
        </aside>
      </div>
    </DesktopShell>
  );
}

function FINREV01() {
  const { navigateTo, purchaseRequests, setPurchaseRequests } = React.useContext(AppContext);
  const sourceReq = purchaseRequests.find(r => r.id === "REQ-001") || purchaseRequests[0];

  const [currentTab, setCurrentTab] = useState("품목 검토");
  const [showModal, setShowModal] = useState(false);

  type ItemReview = {
    status: "검토 대기" | "승인" | "보완 요청" | "반려";
    approvedAmount: number;
    rejectionReason: string;
  };

  const [reviews, setReviews] = useState<Record<number, ItemReview>>(() => {
    const map: Record<number, ItemReview> = {};
    sourceReq.items.forEach(item => {
      map[item.id] = {
        status: item.status as ItemReview["status"],
        approvedAmount: item.estimatedTotalPrice,
        rejectionReason: "",
      };
    });
    return map;
  });

  const [supplementReasons, setSupplementReasons] = useState<Record<number, string>>({});

  const setItemStatus = (id: number, status: ItemReview["status"]) =>
    setReviews(prev => ({ ...prev, [id]: { ...prev[id], status } }));

  const setItemApprovedAmount = (id: number, amount: number) =>
    setReviews(prev => ({ ...prev, [id]: { ...prev[id], approvedAmount: amount } }));

  const setItemRejectionReason = (id: number, reason: string) =>
    setReviews(prev => ({ ...prev, [id]: { ...prev[id], rejectionReason: reason } }));

  const getOverallStatus = (): string => {
    const statuses = sourceReq.items.map(item => reviews[item.id]?.status ?? "검토 대기");
    if (statuses.some(s => s === "검토 대기")) return "최종 처리 불가";
    if (statuses.every(s => s === "승인")) return "승인 완료";
    if (statuses.every(s => s === "반려")) return "반려";
    if (statuses.some(s => s === "보완 요청")) return "보완 요청";
    if (statuses.some(s => s === "승인") && statuses.some(s => s === "반려")) return "부분 승인";
    return "승인 완료";
  };

  const overallStatus = getOverallStatus();
  const unreviewedCount = sourceReq.items.filter(item => (reviews[item.id]?.status ?? "검토 대기") === "검토 대기").length;
  const supplementItems = sourceReq.items.filter(item => reviews[item.id]?.status === "보완 요청");
  const totalAmount = sourceReq.items.reduce((sum, item) => sum + item.estimatedTotalPrice, 0);

  const getSubmitBtnLabel = () => {
    if (overallStatus === "최종 처리 불가") return "최종 처리";
    if (overallStatus === "승인 완료") return "승인 완료 처리";
    if (overallStatus === "보완 요청") return "보완 요청 발송";
    if (overallStatus === "부분 승인") return "부분 승인 처리";
    if (overallStatus === "반려") return "반려 처리";
    return "최종 처리";
  };

  const getSubmitBtnColor = () => {
    if (overallStatus === "보완 요청") return "bg-yellow-500 border-yellow-500 hover:bg-yellow-600";
    if (overallStatus === "반려") return "bg-red-600 border-red-600 hover:bg-red-700";
    return "";
  };

  const commitFinalStatus = (status: FinanceStatus | "부분 승인") => {
    setPurchaseRequests(prev => prev.map(r =>
      r.id === sourceReq.id
        ? {
            ...r,
            status,
            items: r.items.map(item => ({
              ...item,
              status: reviews[item.id]?.status ?? item.status,
            })),
          }
        : r
    ));
    navigateTo("FIN-WORK-01");
  };

  const handleFinalAction = () => {
    if (overallStatus === "보완 요청") {
      const init: Record<number, string> = {};
      supplementItems.forEach(item => { init[item.id] = ""; });
      setSupplementReasons(init);
      setShowModal(true);
    } else {
      const statusMap: Record<string, FinanceStatus | "부분 승인"> = {
        "승인 완료": "승인",
        "반려": "반려",
        "부분 승인": "부분 승인",
      };
      const finalStatus: FinanceStatus | "부분 승인" = statusMap[overallStatus] ?? "검토 대기";
      commitFinalStatus(finalStatus);
    }
  };

  const handleSupplementSend = () => {
    commitFinalStatus("보완 요청");
    setShowModal(false);
  };

  const allSupplementReasonsProvided =
    supplementItems.length > 0 &&
    supplementItems.every(item => supplementReasons[item.id]?.trim());

  const chipVariant = (s: string) =>
    s === "보완 요청" ? "yellow" : s === "승인 완료" ? "green" : s === "반려" ? "red" : s === "부분 승인" ? "blue" : "gray";

  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" },
      activeSidebar: "재정"
    }}>
      <DesktopShell title="구매 요청 검토" breadcrumb={["재정", "구매 요청", "구매 요청 검토"]}>
        <div className="flex h-full bg-gray-50 overflow-hidden">
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-20">
              {/* Request Summary Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-mono tracking-wider">{sourceReq.id}</span>
                      <Chip label={overallStatus} variant={chipVariant(overallStatus)} />
                      {sourceReq.priority === "긴급" && <Chip label="긴급" variant="red" />}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">구매 요청 검토</h2>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right border-r border-gray-100 pr-8">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">전체 요청액</p>
                      <p className="text-xl font-bold text-gray-900">{totalAmount.toLocaleString()}원</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">예산 사용 가능액</p>
                      <p className="text-xl font-bold text-blue-600">950,000원</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-x-8 gap-y-6 border-t border-gray-100 pt-6">
                  {[
                    ["행사명", sourceReq.event],
                    ["요청 부서", sourceReq.dept],
                    ["요청자", sourceReq.requester],
                    ["필요한 날짜", sourceReq.neededDate],
                    ["요청일", sourceReq.history[0]?.date?.slice(0, 10) ?? ""],
                    ["구매 목적", sourceReq.purpose],
                  ].map(([k, v]) => (
                    <div key={k} className={k === "구매 목적" ? "col-span-4" : "col-span-1"}>
                      <p className="text-[10px] text-gray-400 font-semibold mb-1">{k}</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                <div className="px-6 border-b border-gray-100 flex items-center gap-8 shrink-0">
                  {["요청 정보", "품목 검토", "첨부파일", "처리 기록"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setCurrentTab(t)}
                      className={`text-sm font-semibold py-4 -mb-px border-b-2 transition-all ${currentTab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="flex-1">
                  {currentTab === "품목 검토" && (
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                          <th className="px-6 py-3">품목 정보</th>
                          <th className="px-6 py-3">수량</th>
                          <th className="px-6 py-3 text-right">요청액</th>
                          <th className="px-6 py-3 text-center">승인액</th>
                          <th className="px-6 py-3 text-right">검토 결과</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sourceReq.items.map(item => {
                          const review = reviews[item.id] ?? { status: "검토 대기" as const, approvedAmount: item.estimatedTotalPrice, rejectionReason: "" };
                          return (
                            <tr key={item.id} className="hover:bg-gray-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-gray-800 mb-0.5">{item.name}</p>
                                <p className="text-[10px] text-gray-400 font-medium">{item.category} · {item.budgetLine}</p>
                                <p className="text-[9px] bg-gray-100 text-gray-500 px-1 rounded inline-block mt-1">{item.purchaseType}</p>
                              </td>
                              <td className="px-6 py-4 text-gray-600 font-medium">{item.quantity}{item.unit}</td>
                              <td className="px-6 py-4 text-right text-gray-600 font-mono">{item.estimatedTotalPrice.toLocaleString()}원</td>
                              <td className="px-6 py-4">
                                <div className="flex justify-center">
                                  <input
                                    type="number"
                                    value={review.approvedAmount}
                                    onChange={e => setItemApprovedAmount(item.id, Number(e.target.value))}
                                    className="border border-gray-200 rounded px-2 py-1.5 w-28 text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex gap-1">
                                    {([
                                      { l: "승인", v: "승인" as const, c: "green" },
                                      { l: "보완", v: "보완 요청" as const, c: "yellow" },
                                      { l: "반려", v: "반려" as const, c: "red" },
                                    ]).map(s => (
                                      <button
                                        key={s.l}
                                        onClick={() => setItemStatus(item.id, s.v)}
                                        className={`px-3 py-1.5 rounded border text-[10px] font-bold transition-all ${review.status === s.v
                                          ? s.c === "green" ? "bg-green-600 text-white border-green-600"
                                            : s.c === "yellow" ? "bg-yellow-500 text-white border-yellow-500"
                                            : "bg-red-600 text-white border-red-600"
                                          : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"}`}
                                      >
                                        {s.l}
                                      </button>
                                    ))}
                                  </div>
                                  {review.status === "반려" && (
                                    <input
                                      type="text"
                                      value={review.rejectionReason}
                                      onChange={e => setItemRejectionReason(item.id, e.target.value)}
                                      placeholder="반려 사유 (필수)"
                                      className="border border-red-200 rounded px-2 py-1 w-48 text-[10px] placeholder-red-300 focus:outline-none focus:ring-1 focus:ring-red-400"
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {currentTab === "요청 정보" && (
                    <div className="p-8 text-gray-400 text-center py-20 italic">요청 상세 입력 필드가 여기에 표시됩니다.</div>
                  )}
                  {currentTab === "첨부파일" && (
                    <div className="p-8 text-gray-400 text-center py-20 italic">첨부된 견적서 및 증빙 서류가 여기에 표시됩니다.</div>
                  )}
                  {currentTab === "처리 기록" && (
                    <div className="p-8 flex flex-col gap-6">
                      {sourceReq.history.map((h, i) => (
                        <div key={i} className="flex gap-4 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-gray-800">{h.action}</p>
                            <p className="text-[10px] text-gray-400">{h.user} · {h.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <Btn variant="secondary" size="md" onClick={() => navigateTo("FIN-WORK-01")}><ArrowLeft className="w-4 h-4" /> 목록으로</Btn>
                <div className="flex items-center gap-4">
                  {unreviewedCount > 0 && (
                    <span className="text-xs text-orange-600 font-medium">미검토 품목이 {unreviewedCount}개 있습니다.</span>
                  )}
                  <Btn
                    variant="primary"
                    size="md"
                    disabled={unreviewedCount > 0}
                    onClick={handleFinalAction}
                    className={`px-8 ${getSubmitBtnColor()}`}
                  >
                    {getSubmitBtnLabel()}
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showModal && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col">
              <div className="bg-yellow-50 px-8 py-4 border-b border-yellow-100 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold text-yellow-800">보완 요청 발송</h3>
                <button onClick={() => setShowModal(false)} className="text-yellow-600 hover:text-yellow-800"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-8 flex flex-col gap-5 overflow-auto">
                <p className="text-[11px] text-gray-500">보완 대상 품목({supplementItems.length})에 대한 사유를 각각 입력하세요.</p>
                {supplementItems.map(item => (
                  <div key={item.id} className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      {item.name}<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <textarea
                      value={supplementReasons[item.id] ?? ""}
                      onChange={e => setSupplementReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-4 py-3 text-sm h-20 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all resize-none"
                      placeholder={`'${item.name}' 보완 사유를 구체적으로 입력하세요.`}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700">재제출 기한</label>
                  <input type="date" className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-gray-50 focus:outline-none" />
                </div>
              </div>
              <div className="px-8 py-6 bg-gray-50 flex justify-end gap-3 border-t border-gray-100 shrink-0">
                <Btn variant="secondary" size="md" onClick={() => setShowModal(false)}>취소</Btn>
                <Btn
                  variant="primary"
                  size="md"
                  disabled={!allSupplementReasonsProvided}
                  className="bg-yellow-600 hover:bg-yellow-700 border-yellow-600 px-8"
                  onClick={handleSupplementSend}
                >
                  보완 요청 발송
                </Btn>
              </div>
            </div>
          </div>
        )}
      </DesktopShell>
    </AppContext.Provider>
  );
}

function EXT02A() {

  const { eventInfo, surveySettings } = React.useContext(AppContext);
  const feeDisplay =
    eventInfo.feeType === "무료" ? "무료" :
    eventInfo.feeType === "정액 유료" ? (eventInfo.feeAmount || "금액 미입력") :
    eventInfo.feeType === "학생회비 조건부" ? `납부자 ${eventInfo.feePaidAmount === "0" ? "무료" : eventInfo.feePaidAmount + "원"} / 미납자 ${eventInfo.feeUnpaidAmount}원` :
    "미정";

  const capacityDisplay = eventInfo.capacityType === "제한없음" ? "" : eventInfo.capacityType === "인원제한" ? ` · ${eventInfo.capacityCount}명` : "";

  const deadlineDisplay = surveySettings.endAt ? surveySettings.endAt.slice(5, 10).replace("-", ".") : null;

  return (
    <PhoneFrame>
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">V</span>
          </div>
          <span className="text-xs font-semibold text-gray-700">Vada</span>
        </div>
        <h1 className="text-base font-bold text-gray-900 leading-snug break-keep">{eventInfo.name || "행사명 미입력"}</h1>
        <div className="flex flex-col gap-1.5 mt-2">
          {[
            [Calendar, eventInfo.startAt ? eventInfo.startAt.replace("T", " ") : "일시 미정"],
            [MapPin, eventInfo.placeConfirmed && eventInfo.placeName ? eventInfo.placeName : "장소 미정"],
            [Users, eventInfo.target || "참가 대상 미정"],
          ].map(([Icon, text], i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-gray-400"><Icon className="w-3.5 h-3.5" /></span>
              <span className="text-xs text-gray-600 break-keep">{text as string}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {feeDisplay !== "미정" && <Chip label={`참가비 ${feeDisplay}`} variant="blue" />}
          {(surveySettings.status === "활성") && <Chip label={`모집 중${capacityDisplay}`} variant="green" />}
          {deadlineDisplay && <Chip label={`마감 ${deadlineDisplay}`} variant="yellow" />}
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        <p className="text-xs text-gray-500 leading-relaxed">아래 정보를 입력하고 참여 신청을 완료해 주세요.</p>

        {[
          { label: "이름", placeholder: "김바다", required: true },
          { label: "학번", placeholder: "2022123456", required: true },
        ].map(({ label, placeholder, required }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500">*</span>}</label>
            <input placeholder={placeholder} className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 bg-white" />
          </div>
        ))}

        {[
          { label: "단과대학", opts: ["소프트웨어융합대학"] },
          { label: "학부·학과", opts: ["컴퓨터학부"] },
          { label: "학년", opts: ["1학년", "2학년", "3학년", "4학년"] },
        ].map(({ label, opts }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{label}<span className="text-red-500">*</span></label>
            <div className="relative">
              <select className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white appearance-none pr-10">
                <option value="">선택</option>
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">참가 동기 (선택)</label>
          <textarea rows={3} placeholder="간단히 적어주세요" className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 resize-none" />
        </div>

        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-1">개인정보 수집 동의<span className="text-red-500">*</span></p>
          <p className="text-xs text-gray-500 mb-3">이름, 학번 등의 정보는 행사 운영 목적으로만 사용되며, 행사 종료 후 파기됩니다.</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-300 w-4 h-4" />
            <span className="text-sm text-gray-700">동의합니다</span>
          </label>
        </div>
      </div>

      <div className="px-5 pb-8 pt-2">
        <button className="w-full bg-blue-600 text-white rounded-xl py-4 text-sm font-semibold">참여 신청하기</button>
      </div>
    </PhoneFrame>
  );
}

function EXT02B() {
  return (
    <PhoneFrame>
      <div className="flex flex-col items-center justify-center px-8 py-16 text-center gap-5">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">참여 신청이 완료되었습니다</h1>
          <p className="text-sm text-gray-500">2026 소프트웨어융합대학 체육대회</p>
          <p className="text-sm text-gray-700 font-medium mt-1">신청자: 김바다</p>
        </div>

        <div className="w-full border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">참가비</p>
          <p className="text-base font-semibold text-gray-900">관리자 확인 중</p>
          <p className="text-xs text-gray-400 mt-1">학생회비 납부 여부 확인 후 결정됩니다.</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 w-full text-left">
          <p className="text-xs font-medium text-gray-700 mb-1">안내 사항</p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>· 신청 내용은 마감 전까지 운영진에게 문의하면 수정 가능합니다.</li>
            <li>· 문의: @sw_student_council (인스타그램)</li>
          </ul>
        </div>
      </div>
    </PhoneFrame>
  );
}

function EXT02C() {
  const states = [
    { title: "모집 전", desc: "참가 신청이 아직 시작되지 않았습니다.", color: "bg-gray-100", textColor: "text-gray-600", showNewLink: false },
    { title: "모집 마감", desc: "참가 신청이 종료되었습니다.", color: "bg-gray-100", textColor: "text-gray-600", showNewLink: false },
    { title: "정원 마감", desc: "신청 정원이 모두 찼습니다.", color: "bg-orange-50", textColor: "text-orange-600", showNewLink: false },
    { title: "링크 비활성화", desc: "이 링크는 더 이상 사용할 수 없습니다.", color: "bg-red-50", textColor: "text-red-600", showNewLink: false },
    { title: "기존 설문 종료 · 새 설문으로 교체됨", desc: "이 참여 조사는 종료되었습니다. 새로 진행 중인 참여 조사에 다시 응답해 주세요.", color: "bg-yellow-50", textColor: "text-yellow-700", showNewLink: true },
  ];
  return (
    <PhoneFrame>
      <div className="px-5 py-8 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">설문 예외·종료 상태</p>
        {states.map(({ title, desc, color, textColor, showNewLink }) => (
          <div key={title} className={`${color} rounded-xl p-5 flex flex-col items-center text-center gap-3`}>
            <AlertCircle className={`w-8 h-8 ${textColor}`} />
            <div>
              <p className={`text-sm font-semibold ${textColor}`}>{title}</p>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
            {showNewLink ? (
              <button className="text-xs font-semibold bg-yellow-500 text-white rounded-lg px-5 py-2 mt-1">
                새 설문으로 이동 →
              </button>
            ) : (
              <button className={`text-xs font-medium ${textColor} border border-current rounded-lg px-4 py-1.5 mt-1`}>
                돌아가기
              </button>
            )}
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

function EXT01A() {
  return (
    <PhoneFrame>
      <div className="px-5 py-8 flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">V</span>
          </div>
          <span className="text-xs font-semibold text-gray-700">참석 확인</span>
        </div>

        <div>
          <h1 className="text-base font-bold text-gray-900 leading-snug mb-2">2026 소프트웨어융합대학 체육대회</h1>
          <div className="flex items-center gap-2">
            <Chip label="체크인 가능" variant="green" />
            <span className="text-xs text-gray-500">09:30 ~ 11:00</span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-600">참가 신청 시 입력한 이름과 학번을 정확히 입력해 주세요.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">이름<span className="text-red-500">*</span></label>
            <input placeholder="김바다" className="border border-gray-300 rounded-xl px-4 py-4 text-sm text-gray-800 placeholder-gray-300 bg-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">학번<span className="text-red-500">*</span></label>
            <input placeholder="2022123456" type="number" className="border border-gray-300 rounded-xl px-4 py-4 text-sm text-gray-800 placeholder-gray-300 bg-white" />
          </div>
        </div>

        <button className="w-full bg-blue-600 text-white rounded-xl py-4 text-sm font-semibold mt-auto">참석 확인</button>
      </div>
    </PhoneFrame>
  );
}

function EXT01B() {
  const results = [
    { icon: Check, bg: "bg-green-100", iconColor: "text-green-600", title: "참석 완료", desc: "2026. 08. 20 09:47 체크인되었습니다.", badge: "green" as const },
    { icon: AlertCircle, bg: "bg-yellow-100", iconColor: "text-yellow-600", title: "참가자 명단 불일치", desc: "입력하신 정보가 명단에 없습니다. 운영진에게 문의해 주세요.", badge: "yellow" as const },
    { icon: Info, bg: "bg-blue-100", iconColor: "text-blue-600", title: "이미 참석 처리됨", desc: "이미 참석 확인이 완료된 상태입니다.", badge: "blue" as const },
    { icon: X, bg: "bg-red-100", iconColor: "text-red-600", title: "조건 미충족", desc: "참가비 미납 또는 신청 미완료 상태입니다.", badge: "red" as const },
    { icon: Clock, bg: "bg-gray-100", iconColor: "text-gray-500", title: "체크인 시간 전·후", desc: "체크인 가능 시간이 아닙니다. (09:30 ~ 11:00)", badge: "gray" as const },
    { icon: X, bg: "bg-gray-100", iconColor: "text-gray-500", title: "비활성화된 QR", desc: "이 QR은 더 이상 사용할 수 없습니다.", badge: "gray" as const },
  ];
  return (
    <PhoneFrame>
      <div className="px-5 py-6 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">참석 확인 결과</p>
        {results.map(({ icon: Icon, bg, iconColor, title, desc, badge }) => (
          <div key={title} className="border border-gray-200 rounded-xl p-5 flex flex-col items-center text-center gap-3">
            <div className={`w-14 h-14 ${bg} rounded-full flex items-center justify-center`}>
              <Icon className={`w-7 h-7 ${iconColor}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

// ─── New Finance Flow Screens ─────────────────────────────────────────────────

function MY01() {
  type TaskItem = {
    id: string; name: string; event: string; dept: string; due: string; dueColor: string;
    status: string; statusVariant: "yellow"|"red"|"blue"|"gray"|"green";
    nextAction?: string;
    doc?: { rel: string; name: string };
    screen?: string;
    source?: "event" | "recurring";
    sourceTaskId?: string;
  };
  type MyTaskTab = "todo" | "doing" | "done";
  const { navigateTo, currentUser, eventTasks, recurringTasks, setSelectedEventTaskId, setSelectedRecurringTaskId } = React.useContext(AppContext);
  const [activeTab, setActiveTab] = useState<MyTaskTab>("todo");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"all" | "event" | "recurring">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EventTaskStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const statusVariantFor = (status: EventTaskStatus): TaskItem["statusVariant"] => (
    status === "완료" ? "green" : status === "검토 필요" ? "yellow" : status === "진행 중" ? "blue" : "gray"
  );
  const nextActionFor = (status: EventTaskStatus) => (
    status === "검토 필요" ? "검토 의견을 확인하고 처리 내용을 기록" :
    status === "진행 중" ? "업무 상세에서 진행 상태와 처리 내용을 업데이트" :
    status === "예정" ? "업무 상세에서 시작 준비와 담당 내용을 확인" : "처리 완료"
  );
  const taskItemFrom = (task: EventTask | RecurringTask, source: "event" | "recurring"): TaskItem => ({
    id: `${source}-${task.id}`,
    name: task.name,
    event: source === "event" ? "2026 소프트웨어융합대학 체육대회" : "상시 업무",
    dept: task.dept,
    due: task.due === "상시" ? "상시" : `${task.due.slice(5).replace("-", ".")}${task.status === "완료" ? " 완료" : ""}`,
    dueColor: task.delayed ? "text-red-600 font-semibold" : task.status === "완료" ? "text-gray-400" : "text-gray-600",
    status: task.status,
    statusVariant: statusVariantFor(task.status),
    nextAction: nextActionFor(task.status),
    doc: source === "event" && task.hasDoc ? { rel: "연결 문서", name: task.deliverable ?? `${task.name} 관련 문서` } : undefined,
    source,
    sourceTaskId: task.id,
  });
  const assignedTasks = [
    ...eventTasks.filter(task => task.assignee === currentUser.name).map(task => taskItemFrom(task, "event")),
    ...recurringTasks.filter(task => task.assignee === currentUser.name).map(task => taskItemFrom(task, "recurring")),
  ];
  const matchesFilter = (task: TaskItem) => (
    (scopeFilter === "all" || task.source === scopeFilter) &&
    (statusFilter === "all" || task.status === statusFilter) &&
    (!searchQuery.trim() || `${task.name} ${task.event} ${task.dept}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
  );
  const filteredTasks = assignedTasks.filter(matchesFilter);
  const delayedTasks = assignedTasks.filter(task => task.dueColor.includes("text-red"));
  const reviewTasks = assignedTasks.filter(task => task.status === "검토 필요");
  const todoSections: { label: string; labelColor: string; tasks: TaskItem[] }[] = [
    { label: "확인 필요", labelColor: "text-red-600", tasks: filteredTasks.filter(task => task.status === "검토 필요" || task.dueColor.includes("text-red")) },
    { label: "예정", labelColor: "text-gray-600", tasks: filteredTasks.filter(task => task.status === "예정" && !task.dueColor.includes("text-red")) },
  ].filter(section => section.tasks.length > 0);
  const doingTasks = filteredTasks.filter(task => task.status === "진행 중");
  const doneTasks = filteredTasks.filter(task => task.status === "완료");

  const todoCount = todoSections.reduce((n, sec) => n + sec.tasks.length, 0);

  const renderTask = (t: TaskItem) => (
    <button
      type="button"
      key={t.id}
      onClick={() => setSelectedTask(t)}
      aria-label={`${t.name} 상세 보기`}
      className={`${taskCardClass(t.dept)} text-left w-full flex items-start gap-3 hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300`}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* 업무명 + 상태 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 leading-snug">{t.name}</span>
          <DepartmentChip dept={t.dept} />
          <Chip label={t.status} variant={t.statusVariant} />
        </div>
        {/* 다음 행동 */}
        {t.nextAction && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-400 shrink-0">다음 행동</span>
            <span className="text-xs text-gray-700">{t.nextAction}</span>
          </div>
        )}
        {/* 행사 · 마감 · 문서 */}
        <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
          <span>{t.event}</span>
          <span className="text-gray-300">·</span>
          <span className={t.dueColor}>{t.due}</span>
          {t.doc && (
            <>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1 text-gray-500">
                <FileText className="w-3 h-3" />
                <span className="text-gray-400">{t.doc.rel}</span>
                <span className="text-gray-600 font-medium">{t.doc.name}</span>
              </span>
            </>
          )}
        </div>
      </div>
      {(t.screen || t.source) && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 self-center" />}
    </button>
  );
  const openLinkedTask = (task: TaskItem) => {
    setSelectedTask(null);
    if (task.source === "event" && task.sourceTaskId) {
      setSelectedEventTaskId(task.sourceTaskId);
      navigateTo("EVT-TASK-02");
      return;
    }
    if (task.source === "recurring") {
      setSelectedRecurringTaskId(task.sourceTaskId ?? null);
      navigateTo("OPS-TASK-01");
      return;
    }
    if (task.screen) navigateTo(task.screen);
  };

  return (
    <DesktopShell activeSidebar="내 업무" breadcrumb={["내 업무"]} title="내 업무">
      <div className="p-6 flex flex-col gap-4 max-w-5xl mx-auto pb-12">

        {/* 설명 */}
        <p className="text-sm text-gray-500">여러 행사와 조직 활동에서 내가 처리할 업무를 확인합니다.</p>

        {/* 요약 칩 */}
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-700">지연 {delayedTasks.length}건</span>
          </div>
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-medium text-orange-800">해야 할 업무 {todoCount}건</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-800">검토 필요 {reviewTasks.length}건</span>
          </div>
        </div>

        {/* 상태 탭 */}
        <div className="flex gap-0 border-b border-gray-200">
          {([
            ["todo", "해야 할 업무", todoCount],
            ["doing", "진행 중인 업무", doingTasks.length],
            ["done", "완료된 업무", doneTasks.length],
          ] as [MyTaskTab, string, number][]).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 ${activeTab === key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === key ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>{count}</span>
            </button>
          ))}
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2">
          <select aria-label="업무 범위 필터" value={scopeFilter} onChange={event => setScopeFilter(event.target.value as "all" | "event" | "recurring")} className="border border-gray-200 rounded px-2.5 py-1.5 text-[11px] text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="all">전체 행사</option><option value="event">체육대회</option><option value="recurring">상시 업무</option>
          </select>
          <select aria-label="업무 상태 필터" value={statusFilter} onChange={event => setStatusFilter(event.target.value as "all" | EventTaskStatus)} className="border border-gray-200 rounded px-2.5 py-1.5 text-[11px] text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="all">전체 상태</option><option>예정</option><option>진행 중</option><option>검토 필요</option><option>완료</option>
          </select>
          <label className="flex items-center gap-1.5 border border-gray-200 rounded px-2.5 py-1.5 bg-white ml-auto">
            <Search className="w-3 h-3 text-gray-400" />
            <input aria-label="업무 검색" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="업무 검색" className="w-28 text-[11px] text-gray-700 placeholder:text-gray-300 outline-none" />
          </label>
        </div>

        {/* 해야 할 업무 — 마감 기준 그룹 */}
        {activeTab === "todo" && todoSections.map(sec => (
          <div key={sec.label}>
            <p className={`text-[11px] font-bold tracking-widest uppercase mb-2 ${sec.labelColor}`}>{sec.label}</p>
            <div className="flex flex-col gap-2">
              {sec.tasks.map(renderTask)}
            </div>
          </div>
        ))}

        {/* 진행 중인 업무 */}
        {activeTab === "doing" && (
          <div className="flex flex-col gap-2">
            {doingTasks.map(renderTask)}
          </div>
        )}

        {/* 완료된 업무 */}
        {activeTab === "done" && (
          <div className="flex flex-col gap-2">
            {doneTasks.map(renderTask)}
          </div>
        )}
        {((activeTab === "todo" && todoSections.length === 0) || (activeTab === "doing" && doingTasks.length === 0) || (activeTab === "done" && doneTasks.length === 0)) && (
          <div className="border border-dashed border-gray-200 rounded-xl py-12 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium text-gray-500">조건에 맞는 업무가 없습니다.</p>
            <button type="button" onClick={() => { setScopeFilter("all"); setStatusFilter("all"); setSearchQuery(""); }} className="text-xs text-blue-600 hover:text-blue-800">필터 초기화</button>
          </div>
        )}
      </div>
      {selectedTask && (
        <>
          <button type="button" aria-label="내 업무 상세 패널 닫기" className="fixed inset-0 z-40 bg-slate-900/20" onClick={() => setSelectedTask(null)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-[380px] bg-white border-l border-gray-200 shadow-2xl flex flex-col" aria-label="내 업무 상세 패널">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4"><div><p className="text-[10px] font-mono text-gray-400 mb-1">{selectedTask.id}</p><h2 className="text-base font-bold text-gray-900 leading-snug">{selectedTask.name}</h2></div><button type="button" onClick={() => setSelectedTask(null)} aria-label="닫기" className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-md"><X className="w-5 h-5" /></button></div>
            <div className="p-6 flex flex-col gap-6 overflow-y-auto">
              <div className="flex items-center gap-2 flex-wrap"><DepartmentChip dept={selectedTask.dept} /><Chip label={selectedTask.status} variant={selectedTask.statusVariant} /></div>
              <section><p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">다음 행동</p><p className="text-sm text-gray-700 leading-6">{selectedTask.nextAction ?? "현재 완료된 업무입니다."}</p></section>
              <section className="grid grid-cols-2 gap-px border border-gray-200 rounded-lg overflow-hidden bg-gray-200"><div className="bg-white p-3"><p className="text-[10px] text-gray-400 mb-1">행사·업무 영역</p><p className="text-xs font-semibold text-gray-800">{selectedTask.event}</p></div><div className="bg-white p-3"><p className="text-[10px] text-gray-400 mb-1">마감일</p><p className={`text-xs font-semibold ${selectedTask.dueColor}`}>{selectedTask.due}</p></div></section>
              {selectedTask.doc && <section><p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">연결 문서</p><div className="border border-gray-200 rounded-lg px-3 py-2.5 flex items-center gap-2 text-xs text-gray-700"><FileText className="w-3.5 h-3.5 text-gray-400" />{selectedTask.doc.name}</div></section>}
            </div>
            <div className="mt-auto p-6 border-t border-gray-100 bg-gray-50 flex gap-2">
              <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setSelectedTask(null)}>닫기</Btn>
              {(selectedTask.source || selectedTask.screen) && <Btn variant="primary" className="flex-1 justify-center" onClick={() => openLinkedTask(selectedTask)}>{selectedTask.source === "event" ? "행사 업무 상세 열기" : selectedTask.source === "recurring" ? "상시 업무 보드 열기" : "처리 화면 열기"}</Btn>}
            </div>
          </aside>
        </>
      )}
    </DesktopShell>
  );
}

function MYREQ01() {
  const { navigateTo, purchaseRequests, currentUser } = React.useContext(AppContext);
  const myRequests = purchaseRequests.filter(request => request.requester === currentUser.name);
  const statCards = [
    { label: "검토 대기", count: myRequests.filter(r => r.status === "검토 대기").length, color: "text-blue-600 bg-blue-50" },
    { label: "보완 필요", count: myRequests.filter(r => r.status === "보완 요청").length, color: "text-yellow-700 bg-yellow-50" },
    { label: "승인 완료", count: myRequests.filter(r => r.status === "승인" || r.status === "부분 승인").length, color: "text-green-700 bg-green-50" },
    { label: "구매 진행", count: myRequests.filter(r => r.status === "구매 필요" || r.status === "증빙 필요").length, color: "text-purple-700 bg-purple-50" },
    { label: "처리 완료", count: myRequests.filter(r => r.status === "정산 완료").length, color: "text-gray-600 bg-gray-100" },
  ];
  const displayStatus = (status: PurchaseRequest["status"]) => status === "보완 요청" ? "보완 필요" : status === "승인" ? "승인 완료" : status === "구매 필요" ? "구매 진행" : status;
  const statusVariant = (status: PurchaseRequest["status"]) => status === "보완 요청" ? "yellow" as const : status === "승인" || status === "정산 완료" ? "green" as const : status === "반려" ? "red" as const : status === "구매 필요" || status === "증빙 필요" ? "blue" as const : "blue" as const;
  const btnLabel = (status: PurchaseRequest["status"]) => status === "보완 요청" ? "보완하기" : "상태 확인";
  const btnStyle = (status: PurchaseRequest["status"]) => status === "보완 요청"
    ? "bg-yellow-500 text-white px-3 py-1.5 rounded text-[10px] font-bold"
    : "border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-[10px] font-medium";

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회", "재정", "내 구매 요청"]}
      title="2026 소프트웨어융합대학 체육대회"
      tabs={EVENT_TABS}
      activeTab="재정"
    >
      <div className="p-8 flex flex-col gap-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigateTo("EVT-FIN-01")} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></button>
              <h2 className="text-lg font-bold text-gray-900">내 구매 요청</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">이 행사에서 내가 제출한 구매 요청 · {currentUser.name} · {currentUser.dept} · {currentUser.role}</p>
          </div>
          <button onClick={() => navigateTo("FIN-REQ-01")} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Plus className="w-4 h-4" /> 새 구매 요청
          </button>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {statCards.map(c => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color.split(" ")[0]}`}>{c.count}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                <th className="px-5 py-3">요청 번호</th>
                <th className="px-5 py-3">요청 제목</th>
                <th className="px-5 py-3 text-right">요청액</th>
                <th className="px-5 py-3 text-center">품목 수</th>
                <th className="px-5 py-3">요청일</th>
                <th className="px-5 py-3">필요한 날짜</th>
                <th className="px-5 py-3">상태</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {myRequests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-gray-400">{r.id}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-800">{r.title}</p>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-gray-700">{r.totalEstimatedAmount.toLocaleString()}원</td>
                  <td className="px-5 py-3 text-center text-gray-600">{r.items.length}종</td>
                  <td className="px-5 py-3 text-gray-500">{r.history[0]?.date.slice(0, 10) ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500">{r.neededDate}</td>
                  <td className="px-5 py-3"><Chip label={displayStatus(r.status)} variant={statusVariant(r.status)} /></td>
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => navigateTo(r.status === "보완 요청" ? "FIN-SUP-01" : "FIN-REQ-02")} className={btnStyle(r.status)}>{btnLabel(r.status)}</button>
                  </td>
                </tr>
              ))}
              {myRequests.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-xs text-gray-400">아직 제출한 구매 요청이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </DesktopShell>
  );
}

function FINREQ02() {
  const steps = ["요청 제출", "재정부 검토", "구매·발주", "결제·증빙", "처리 완료"];
  const currentStep = 1;
  const items = [
    { name: "박스테이프", qty: "5개", reqAmt: 10000, status: "승인", statusVariant: "green" as const },
    { name: "생수 500ml", qty: "10박스", reqAmt: 50000, status: "승인", statusVariant: "green" as const },
    { name: "이름표 용지", qty: "200장", reqAmt: 60000, status: "보완 필요", statusVariant: "yellow" as const },
    { name: "유성 마커", qty: "10개", reqAmt: 15000, status: "승인", statusVariant: "green" as const },
  ];
  const history = [
    { date: "2026-03-01 10:05", action: "제출", user: "박해랑" },
    { date: "2026-03-02 09:30", action: "재정부 검토 시작", user: "김바다" },
    { date: "2026-03-03 14:00", action: "보완 요청 발송", user: "김바다" },
  ];

  return (
    <DesktopShell activeSidebar="운영" title="구매 요청 상세" breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회", "재정", "내 구매 요청", "REQ-001"]}>
      <div className="p-8 flex flex-col gap-6 max-w-5xl mx-auto pb-20">
        {/* 진행 단계 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-0">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${i < currentStep ? "bg-blue-600 text-white" : i === currentStep ? "bg-yellow-400 text-white" : "bg-gray-100 text-gray-400"}`}>
                    {i < currentStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <p className={`text-[10px] font-semibold ${i === currentStep ? "text-yellow-600" : i < currentStep ? "text-blue-600" : "text-gray-400"}`}>{s}</p>
                </div>
                {i < steps.length - 1 && <div className={`h-px w-8 mb-4 ${i < currentStep ? "bg-blue-300" : "bg-gray-200"}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-mono">REQ-001</span>
                <Chip label="보완 요청" variant="yellow" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">체육대회 운영 물품 4종</h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-semibold mb-0.5">전체 요청액</p>
              <p className="text-xl font-bold text-gray-900">135,000원</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-x-8 gap-y-4 border-t border-gray-100 pt-5 text-xs">
            {[["행사명", "2026 소프트웨어융합대학 체육대회"], ["요청 부서", "운영부"], ["요청자", "박해랑"], ["필요한 날짜", "2026-03-15"]].map(([k, v]) => (
              <div key={k}><p className="text-[10px] text-gray-400 font-semibold mb-0.5">{k}</p><p className="text-gray-700">{v}</p></div>
            ))}
          </div>
        </div>

        {/* 품목별 처리 결과 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">품목별 처리 결과</h3>
            <button className="text-[11px] bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded font-semibold">보완 내용 확인</button>
          </div>
          <table className="w-full text-xs text-left">
            <thead><tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
              <th className="px-6 py-3">품목</th>
              <th className="px-6 py-3">수량</th>
              <th className="px-6 py-3 text-right">요청액</th>
              <th className="px-6 py-3">처리 결과</th>
              <th className="px-6 py-3">재정부 전달사항</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.name} className="hover:bg-gray-50/30">
                  <td className="px-6 py-3 font-semibold text-gray-800">{item.name}</td>
                  <td className="px-6 py-3 text-gray-500">{item.qty}</td>
                  <td className="px-6 py-3 text-right font-mono text-gray-600">{item.reqAmt.toLocaleString()}원</td>
                  <td className="px-6 py-3"><Chip label={item.status} variant={item.statusVariant} /></td>
                  <td className="px-6 py-3 text-gray-500">{item.status === "보완 필요" ? "규격·수량 확인 후 견적서 재첨부 요망" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 처리 기록 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">처리 기록</h3>
          <div className="flex flex-col gap-4">
            {history.map((h, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div><p className="text-xs font-semibold text-gray-800">{h.action}</p><p className="text-[10px] text-gray-400">{h.user} · {h.date}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function FINSUP01() {
  const { purchaseSupplementDraft, setPurchaseSupplementDraft } = React.useContext(AppContext);
  const [supplement, setSupplement] = useState(() => ({
    size: purchaseSupplementDraft?.size ?? "",
    color: purchaseSupplementDraft?.color ?? "",
    printPosition: purchaseSupplementDraft?.printPosition ?? "",
    quantityOption: purchaseSupplementDraft?.quantityOption ?? "",
  }));
  const [draftSaved, setDraftSaved] = useState(false);
  const updateSupplement = (key: keyof typeof supplement, value: string) => setSupplement((current) => ({ ...current, [key]: value }));
  const saveDraft = () => {
    setPurchaseSupplementDraft({ ...supplement, savedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) });
    setDraftSaved(true);
  };
  return (
    <DesktopShell activeSidebar="운영" title="보완 요청 확인·재제출" breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회", "재정", "내 구매 요청", "REQ-001", "보완 재제출"]}>
      <div className="p-8 flex flex-col gap-6 max-w-4xl mx-auto pb-20">
        {/* 보완 요청 배너 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-yellow-800 mb-0.5">보완 요청</p>
            <p className="text-xs text-yellow-700">재정부에서 아래 품목에 대한 보완을 요청했습니다. 내용을 확인하고 수정 후 재제출하세요.</p>
            <div className="flex gap-6 mt-3 text-[11px] text-yellow-700">
              <span><span className="font-semibold">요청 담당자</span> 김바다</span>
              <span><span className="font-semibold">보완 요청일</span> 2026-03-03</span>
              <span><span className="font-semibold">재제출 권장 기한</span> 2026-03-07</span>
            </div>
          </div>
        </div>

        {purchaseSupplementDraft && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div><p className="text-xs font-bold text-blue-900">임시 저장한 보완 내용을 이어서 작성하고 있습니다</p><p className="text-[11px] text-blue-700 mt-1">{purchaseSupplementDraft.savedAt}에 저장됨 · 재제출 전에는 요청 상태가 바뀌지 않습니다.</p></div>
            <Btn variant="text" size="sm" onClick={() => { setPurchaseSupplementDraft(null); setDraftSaved(false); }}>초안 삭제</Btn>
          </div>
        )}

        {/* 보완 품목 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">보완 품목 — 이름표 용지</h3>
            <p className="text-xs text-gray-500 mt-0.5">제작·인쇄 · 홍보비</p>
          </div>

          <div className="p-6 flex flex-col gap-6">
            {/* 보완 사유 */}
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
              <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-1.5">보완 사유</p>
              <p className="text-xs text-yellow-800 leading-relaxed">규격과 인쇄 사양이 누락되었습니다. 정확한 사이즈, 색상, 인쇄 위치를 명시하고 업체 견적서를 첨부해 주세요. 200장 기준 최소 2개 이상 업체 견적서 필요합니다.</p>
            </div>

            {/* 기존 입력 내용 */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">기존 입력 내용</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                {[["품목명", "이름표 용지"], ["수량", "200장"], ["단가(추정)", "300원"], ["합계(추정)", "60,000원"], ["예산 항목", "행사 운영비"]].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">{k}</p>
                    <p className="font-semibold text-gray-700">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 수정 영역 */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">수정 내용 입력</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "사이즈·규격", key: "size" as const, placeholder: "예: A4 (210×297mm)" },
                  { label: "색상", key: "color" as const, placeholder: "예: 단색(검정)" },
                  { label: "인쇄 위치", key: "printPosition" as const, placeholder: "예: 전면 단면 인쇄" },
                  { label: "옵션별 수량", key: "quantityOption" as const, placeholder: "예: 기본형 200매" },
                ].map(f => (
                  <div key={f.label} className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-600">{f.label}</label>
                    <input className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-white" value={supplement[f.key]} onChange={(event) => updateSupplement(f.key, event.target.value)} placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
            </div>

            {/* 파일 첨부 */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">파일 첨부</p>
              <div className="grid grid-cols-3 gap-3">
                {["디자인 파일", "인쇄 파일", "견적서"].map(label => (
                  <div key={label} className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 text-center">
                    <Upload className="w-5 h-5 text-gray-300" />
                    <p className="text-[10px] font-semibold text-gray-400">{label}</p>
                    <p className="text-[9px] text-gray-300">클릭하여 파일 추가</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {draftSaved && <span className="self-center text-[11px] text-green-600 font-medium">임시 저장되었습니다</span>}
          <button className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-lg text-sm font-medium" onClick={saveDraft}>임시 저장</button>
          <button className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold">수정 내용 재제출</button>
        </div>
      </div>
    </DesktopShell>
  );
}

function FINPROC01() {
  const orders = [
    {
      vendor: "다이소 온라인몰", items: [
        { name: "박스테이프", qty: "5개", approvedAmt: 10000, orderStatus: "주문 완료", deliveryDate: "2026-03-12", deliveryStatus: "배송 중" },
        { name: "유성 마커", qty: "10개", approvedAmt: 15000, orderStatus: "주문 완료", deliveryDate: "2026-03-12", deliveryStatus: "배송 중" },
      ], orderAmt: 25000, orderedBy: "김바다", orderDate: "2026-03-08",
    },
    {
      vendor: "마켓컬리 B2B", items: [
        { name: "생수 500ml", qty: "10박스", approvedAmt: 50000, orderStatus: "주문 완료", deliveryDate: "2026-03-15", deliveryStatus: "배송 예정" },
      ], orderAmt: 50000, orderedBy: "김바다", orderDate: "2026-03-10",
    },
    {
      vendor: "인쇄업체 A (제작 발주)", items: [
        { name: "이름표 용지 (제작)", qty: "200장", approvedAmt: 60000, orderStatus: "품절·변경 필요", deliveryDate: "—", deliveryStatus: "—" },
      ], orderAmt: 60000, orderedBy: "—", orderDate: "—",
    },
  ];

  const statusStyle = (s: string) => s === "주문 완료" ? "text-green-700 bg-green-50" : s === "품절·변경 필요" ? "text-red-700 bg-red-50" : "text-gray-500 bg-gray-100";
  const deliveryStyle = (s: string) => s === "배송 중" ? "text-blue-700" : s === "배송 예정" ? "text-gray-500" : "text-red-500";

  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" },
      activeSidebar: "재정"
    }}>
      <DesktopShell title="구매·발주 처리" breadcrumb={["재정", "구매 요청", "구매·발주 처리"]}>
        <div className="p-8 flex flex-col gap-6 max-w-5xl mx-auto pb-20">
          {/* 요약 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-gray-400">REQ-001</span>
                  <Chip label="구매 진행 중" variant="blue" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">체육대회 운영 물품 4종</h2>
                <p className="text-xs text-gray-500 mt-1">운영부 · 박해랑 · 필요한 날짜 2026-03-15</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-semibold mb-0.5">승인된 전체 금액</p>
                <p className="text-xl font-bold text-gray-900">135,000원</p>
              </div>
            </div>
          </div>

          {/* 업체별 주문 묶음 */}
          {orders.map((order, oi) => (
            <div key={oi} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <p className="text-xs font-bold text-gray-700">{order.vendor}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">주문일 {order.orderDate} · 담당 {order.orderedBy}</p>
                </div>
                <p className="text-sm font-bold text-gray-900">{order.orderAmt.toLocaleString()}원</p>
              </div>
              <table className="w-full text-xs text-left">
                <thead><tr className="border-b border-gray-100 text-gray-400 font-medium">
                  <th className="px-6 py-2.5">품목</th>
                  <th className="px-6 py-2.5">수량</th>
                  <th className="px-6 py-2.5 text-right">승인액</th>
                  <th className="px-6 py-2.5">주문 상태</th>
                  <th className="px-6 py-2.5">예상 배송일</th>
                  <th className="px-6 py-2.5">배송 상태</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {order.items.map(item => (
                    <tr key={item.name} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-6 py-3 font-semibold text-gray-800">{item.name}</td>
                      <td className="px-6 py-3 text-gray-500">{item.qty}</td>
                      <td className="px-6 py-3 text-right font-mono text-gray-600">{item.approvedAmt.toLocaleString()}원</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${statusStyle(item.orderStatus)}`}>{item.orderStatus}</span>
                      </td>
                      <td className="px-6 py-3 text-gray-500">{item.deliveryDate}</td>
                      <td className={`px-6 py-3 font-semibold text-[11px] ${deliveryStyle(item.deliveryStatus)}`}>{item.deliveryStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="flex justify-end">
            <button className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold">결제·증빙 단계로 이동</button>
          </div>
        </div>
      </DesktopShell>
    </AppContext.Provider>
  );
}

function FINEVID01() {
  const payments = [
    {
      id: "PAY-001", vendor: "다이소 온라인몰", paidDate: "2026-03-08", paidBy: "김바다", method: "법인카드",
      approvedAmt: 25000, actualAmt: 24500, diffNote: "실결제액이 승인액보다 500원 적음",
      items: ["박스테이프", "유성 마커"],
      docs: [
        { label: "영수증", status: "등록 완료", statusVariant: "green" as const },
        { label: "거래명세서", status: "등록 완료", statusVariant: "green" as const },
      ],
    },
    {
      id: "PAY-002", vendor: "마켓컬리 B2B", paidDate: "2026-03-10", paidBy: "김바다", method: "계좌이체",
      approvedAmt: 50000, actualAmt: 50000, diffNote: "",
      items: ["생수 500ml"],
      docs: [
        { label: "영수증", status: "누락", statusVariant: "red" as const },
        { label: "거래명세서", status: "등록 완료", statusVariant: "green" as const },
      ],
    },
    {
      id: "PAY-003", vendor: "인쇄업체 A", paidDate: "2026-03-13", paidBy: "김바다", method: "계좌이체",
      approvedAmt: 60000, actualAmt: 63000, diffNote: "견적서 대비 최종 납품가 3,000원 초과",
      items: ["이름표 용지 (제작)"],
      docs: [
        { label: "견적서", status: "등록 완료", statusVariant: "green" as const },
        { label: "거래명세서", status: "등록 완료", statusVariant: "green" as const },
        { label: "세금계산서", status: "누락", statusVariant: "red" as const },
      ],
    },
  ];

  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" },
      activeSidebar: "재정"
    }}>
      <DesktopShell title="결제·증빙 정리" breadcrumb={["재정", "증빙 관리", "결제·증빙 정리"]}>
        <div className="p-8 flex flex-col gap-6 max-w-5xl mx-auto pb-20">
          {/* 요약 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono text-gray-400">REQ-001</span>
                <Chip label="증빙 정리 중" variant="yellow" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">체육대회 운영 물품 4종</h2>
              <p className="text-xs text-gray-500 mt-1">운영부 · 박해랑</p>
            </div>
            <div className="flex gap-8 text-right">
              <div><p className="text-[10px] text-gray-400 font-semibold mb-0.5">승인 금액</p><p className="text-base font-bold text-gray-800">135,000원</p></div>
              <div><p className="text-[10px] text-gray-400 font-semibold mb-0.5">실결제 합계</p><p className="text-base font-bold text-blue-700">137,500원</p></div>
            </div>
          </div>

          {/* 결제 내역별 카드 */}
          {payments.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-700">{p.vendor}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">결제일 {p.paidDate} · 결제자 {p.paidBy} · {p.method}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">승인 {p.approvedAmt.toLocaleString()}원 → 실결제 <span className={p.actualAmt !== p.approvedAmt ? "text-red-600 font-bold" : "text-green-700 font-bold"}>{p.actualAmt.toLocaleString()}원</span></p>
                  {p.diffNote && <p className="text-[10px] text-red-500 mt-0.5">{p.diffNote}</p>}
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">연결된 품목</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.items.map(item => <span key={item} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-medium">{item}</span>)}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">증빙 서류</p>
                  <div className="flex flex-col gap-2">
                    {p.docs.map(doc => (
                      <div key={doc.label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{doc.label}</span>
                        <Chip label={doc.status} variant={doc.statusVariant} />
                      </div>
                    ))}
                    <button className="mt-1 border border-dashed border-gray-200 rounded px-3 py-1.5 text-[10px] text-gray-400 text-left flex items-center gap-1.5">
                      <Upload className="w-3 h-3" /> 파일 추가
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-3">
            <button className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-lg text-sm font-medium">저장</button>
            <button className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold">처리 완료</button>
          </div>
        </div>
      </DesktopShell>
    </AppContext.Provider>
  );
}

// ─── OPS-CAL-01 캘린더 — 월간 일정 ────────────────────────────────────────────

type CalendarEvent = {
  year: number;
  month: number;
  day: number;
  type: "행사" | "회의" | "마감";
  label: string;
  source?: "eventTask" | "recurringTask" | "createdMeeting";
  sourceTaskId?: string;
  sourceMeetingId?: string;
};

const CAL_EVENTS: CalendarEvent[] = [
  { year: 2026, month: 6, day: 20, type: "마감", label: "체육대회 참가 신청 마감" },
  { year: 2026, month: 6, day: 22, type: "회의", label: "정기 운영회의" },
  { year: 2026, month: 6, day: 23, type: "마감", label: "비상 연락망 최종본 배포" },
  { year: 2026, month: 6, day: 28, type: "회의", label: "신입생 환영 기획회의 2차" },
  { year: 2026, month: 6, day: 31, type: "행사", label: "행사장 사전 답사" },
];

const CAL_TYPE_STYLE: Record<string, string> = {
  행사: "bg-blue-50 text-blue-700 border-blue-100",
  회의: "bg-green-50 text-green-700 border-green-100",
  마감: "bg-orange-50 text-orange-700 border-orange-100",
};

function OPSCAL01() {
  const { navigateTo, calendarFocus, eventTasks, recurringTasks, createdMeetings, setSelectedEventTaskId, setSelectedRecurringTaskId, setSelectedCreatedMeetingId } = React.useContext(AppContext);
  const [typeFilter, setTypeFilter] = useState("전체");
  const [month, setMonth] = useState(() => new Date(2026, calendarFocus?.month ?? 6, 1));
  const taskDeadlineEvents: CalendarEvent[] = [
    ...eventTasks.filter(task => task.due !== "상시" && task.status !== "완료").map(task => {
      const due = new Date(`${task.due}T00:00:00`);
      return { year: due.getFullYear(), month: due.getMonth(), day: due.getDate(), type: "마감" as const, label: task.name, source: "eventTask" as const, sourceTaskId: task.id };
    }),
    ...recurringTasks.filter(task => task.due !== "상시" && task.status !== "완료").map(task => {
      const due = new Date(`${task.due}T00:00:00`);
      return { year: due.getFullYear(), month: due.getMonth(), day: due.getDate(), type: "마감" as const, label: task.name, source: "recurringTask" as const, sourceTaskId: task.id };
    }),
  ];
  const createdMeetingEvents: CalendarEvent[] = createdMeetings.filter((meeting) => meeting.status !== "취소").map((meeting) => {
    const [year, meetingMonth, day] = meeting.time.split(" ")[0].split(".").map(Number);
    return { year, month: meetingMonth - 1, day, type: "회의" as const, label: meeting.name, source: "createdMeeting" as const, sourceMeetingId: meeting.id };
  });
  const monthlyEvents = [...CAL_EVENTS, ...taskDeadlineEvents, ...createdMeetingEvents].filter(event => event.year === month.getFullYear() && event.month === month.getMonth());
  const visibleEvents = monthlyEvents.filter(event => typeFilter === "전체" || event.type === typeFilter);
  const isReferenceMonth = month.getFullYear() === 2026 && month.getMonth() === 6;
  const weekEvents = isReferenceMonth ? monthlyEvents.filter(event => event.day >= 19 && event.day <= 25) : monthlyEvents;
  const today = isReferenceMonth ? 19 : null;
  const focusedDay = calendarFocus && month.getMonth() === calendarFocus.month ? calendarFocus.day : null;
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const changeMonth = (amount: number) => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
  const openEvent = (event: CalendarEvent) => {
    if (event.source === "eventTask" && event.sourceTaskId) {
      setSelectedEventTaskId(event.sourceTaskId);
      navigateTo("EVT-TASK-02");
      return;
    }
    if (event.source === "recurringTask" && event.sourceTaskId) {
      setSelectedRecurringTaskId(event.sourceTaskId);
      navigateTo("OPS-TASK-01");
      return;
    }
    if (event.source === "createdMeeting" && event.sourceMeetingId) {
      setSelectedCreatedMeetingId(event.sourceMeetingId);
      navigateTo("OPS-MEET-03A");
      return;
    }
    navigateTo(event.type === "회의" ? "OPS-MEET-01A" : event.type === "행사" ? "EVT-00A" : "EVT-TASK-01");
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "캘린더"]}
      title="캘린더"
    >
      <div className="p-6 flex flex-col gap-5">
        <p className="text-sm text-gray-500">학생회의 행사·회의·마감 일정을 한 화면에서 확인합니다.</p>
        {calendarFocus && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs text-blue-800"><span className="font-bold">홈에서 선택한 일정</span> · {calendarFocus.label}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="이전 달" onClick={() => changeMonth(-1)} className="w-7 h-7 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:bg-gray-50"><ArrowLeft className="w-3.5 h-3.5" /></button>
            <span className="text-sm font-bold text-gray-900">{month.getFullYear()}년 {month.getMonth() + 1}월</span>
            <button type="button" aria-label="다음 달" onClick={() => changeMonth(1)} className="w-7 h-7 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:bg-gray-50"><ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {["전체", "행사", "회의", "마감"].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${typeFilter === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
          {/* 월간 그리드 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
              {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                <p key={d} className={`px-2 py-2 text-[10px] font-bold text-center ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</p>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => (
                <div key={i} className={`min-h-[84px] border-b border-r border-gray-50 p-1.5 ${day === null ? "bg-gray-50/50" : ""}`}>
                  {day !== null && (
                    <>
                      <p className={`text-[10px] font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${day === focusedDay ? "bg-indigo-600 text-white ring-2 ring-indigo-200" : day === today ? "bg-blue-600 text-white" : i % 7 === 0 ? "text-red-400" : i % 7 === 6 ? "text-blue-400" : "text-gray-500"}`}>{day}</p>
                      <div className="flex flex-col gap-1">
                        {visibleEvents.filter(e => e.day === day).map(e => (
                          <button type="button" onClick={() => openEvent(e)} key={`${e.sourceTaskId ?? e.sourceMeetingId ?? e.label}-${e.day}`} className={`w-full text-left text-[9px] font-medium border rounded px-1 py-0.5 leading-tight truncate hover:brightness-95 ${CAL_TYPE_STYLE[e.type]}`}>{e.label}</button>
                        ))}
                        {day === focusedDay && !isReferenceMonth && calendarFocus && <p className="text-[9px] font-medium border rounded px-1 py-0.5 leading-tight truncate bg-indigo-50 text-indigo-700 border-indigo-100">{calendarFocus.label}</p>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 이번 주 일정 */}
          <aside className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-800">이번 주 일정</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{isReferenceMonth ? "07.19 (일) – 07.25 (토) · 오늘 07.19" : "선택한 달의 일정"}</p>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {weekEvents.filter(e => typeFilter === "전체" || e.type === typeFilter).map(e => (
                <button type="button" onClick={() => openEvent(e)} key={`${e.sourceTaskId ?? e.sourceMeetingId ?? e.label}-${e.day}`} className="w-full text-left border border-gray-100 rounded-lg p-3 hover:border-blue-300">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-medium border rounded px-1.5 py-0.5 ${CAL_TYPE_STYLE[e.type]}`}>{e.type}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{String(e.month + 1).padStart(2, "0")}.{String(e.day).padStart(2, "0")}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{e.label}</p>
                </button>
              ))}
              {weekEvents.filter(e => typeFilter === "전체" || e.type === typeFilter).length === 0 && <p className="text-xs text-gray-400 text-center py-8">이 달에는 표시할 일정이 없습니다.</p>}
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 leading-4">회의 생성은 운영 &gt; 회의, 행사 일정은 각 행사의 일정 탭에서 관리합니다.</p>
            </div>
          </aside>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── OPS-TASK-01 상시 업무 — 칸반 보드 ────────────────────────────────────────

function OPSTASK01() {
  const { currentUser, recurringTasks, setRecurringTasks, selectedRecurringTaskId, setSelectedRecurringTaskId, demoDataMode, setDemoDataMode } = React.useContext(AppContext);
  const tasks = demoDataMode === "first-use" ? [] : recurringTasks;
  const [viewMode, setViewMode] = useState<"all" | "mine">("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assigneeToAssign, setAssigneeToAssign] = useState("박해랑");
  const [showCreate, setShowCreate] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    name: "", dept: currentUser.dept, assignee: currentUser.name, due: "2026-07-31",
    cycle: "매주", status: "예정", description: "", relatedText: "",
  });

  React.useEffect(() => {
    if (!selectedRecurringTaskId) return;
    setSelectedTaskId(selectedRecurringTaskId);
    setSelectedRecurringTaskId(null);
  }, [selectedRecurringTaskId, setSelectedRecurringTaskId]);

  const myTasks = tasks.filter(t => t.assignee === currentUser.name);
  const delayedTasks = tasks.filter(t => t.delayed);
  const reviewTasks = tasks.filter(t => t.status === "검토 필요");
  const unassignedTasks = tasks.filter(t => t.assignee === "미지정");
  const visibleTasks = viewMode === "mine" ? myTasks : tasks;
  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const columns = ["예정", "진행 중", "검토 필요", "완료"];
  const assignTask = () => {
    if (!selectedTask) return;
    setRecurringTasks(prev => prev.map(task => task.id === selectedTask.id ? {
      ...task,
      assignee: assigneeToAssign,
      history: [...(task.history ?? []), { date: "방금 전", action: "담당자 배정", user: currentUser.name, note: `${assigneeToAssign}에게 업무를 배정했습니다.` }],
    } : task));
  };
  const updateStatus = (status: EventTaskStatus, note: string) => {
    if (!selectedTask) return;
    setRecurringTasks(prev => prev.map(task => task.id === selectedTask.id ? {
      ...task,
      status,
      delayed: status === "완료" ? false : task.delayed,
      history: [...(task.history ?? []), { date: "방금 전", action: `상태 변경 — ${status}`, user: currentUser.name, note }],
    } : task));
    setShowStatusDialog(false);
  };
  const createTask = () => {
    if (!newTask.name.trim() || !newTask.description.trim() || !newTask.due) return;
    const task = {
      id: `R-${String(recurringTasks.length + 1).padStart(2, "0")}`,
      name: newTask.name.trim(),
      dept: newTask.dept,
      assignee: newTask.assignee || "미지정",
      status: newTask.status,
      due: newTask.cycle === "상시" ? "상시" : newTask.due,
      cycle: newTask.cycle,
      delayed: false,
      description: newTask.description.trim(),
      related: newTask.relatedText.split(",").map(item => item.trim()).filter(Boolean).length > 0 ? newTask.relatedText.split(",").map(item => item.trim()).filter(Boolean) : ["운영 > 상시 업무"],
      history: [{ date: "방금 전", action: "업무 생성", user: currentUser.name }],
    };
    setRecurringTasks(prev => [...prev, task as RecurringTask]);
    setDemoDataMode("default");
    setShowCreate(false);
    setSelectedTaskId(task.id);
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "상시 업무"]}
      title="상시 업무"
      actions={<Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> 업무 추가</Btn>}
    >
      <div className="p-6 flex flex-col gap-5">
        <p className="text-sm text-gray-500">행사에 속하지 않는 학생회 반복·운영 업무를 부서와 함께 관리합니다.</p>

        {/* 상단 요약 칩 */}
        <div className="flex gap-3">
          {delayedTasks.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-700">지연 {delayedTasks.length}건</span>
            </div>
          )}
          {reviewTasks.length > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-800">검토 필요 {reviewTasks.length}건</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-800">내 담당 {myTasks.length}건</span>
          </div>
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-700">담당자 없음 {unassignedTasks.length}건</span>
          </div>
          <div className="ml-auto flex bg-gray-100 rounded-lg p-0.5">
            {(["all", "mine"] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${viewMode === mode ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>{mode === "all" ? "전체 업무" : "내 업무"}</button>
            ))}
          </div>
        </div>

        {/* 칸반 보드 */}
        {tasks.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl py-10 text-center">
            <Clipboard className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="mt-3 text-sm font-semibold text-gray-700">아직 등록된 상시 업무가 없습니다</p>
            <p className="mt-1 text-xs text-gray-400">반복해서 관리할 첫 업무를 추가해 보세요.</p>
            <Btn variant="primary" size="sm" className="mt-4" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> 첫 업무 추가</Btn>
          </div>
        )}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(col => (
            <div key={col} className="flex flex-col gap-3 min-w-[260px] flex-1 bg-gray-100/50 rounded-xl p-3 border border-gray-200/50">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{col}</span>
                <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">
                  {visibleTasks.filter(t => t.status === col).length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {visibleTasks.filter(t => t.status === col).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`${taskCardClass(t.dept, t.assignee === "미지정")} text-left w-full hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300`}
                    aria-label={`${t.name} 상세 보기`}
                  >
                    <p className="text-xs font-bold text-gray-800 mb-2 leading-tight">{t.name}</p>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <DepartmentChip dept={t.dept} />
                      <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-medium">{t.cycle}</span>
                      {t.delayed && <Chip label="지연" variant="red" />}
                      {t.status === "검토 필요" && <Chip label="검토 필요" variant="yellow" />}
                      <span className={`text-[10px] ${t.assignee === "미지정" ? "text-red-600 font-semibold" : "text-gray-400"}`}>{t.assignee === "미지정" ? "담당자 없음 · 배정 필요" : t.assignee}</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className={`flex items-center gap-1.5 text-[10px] ${t.delayed ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                        <Calendar className="w-3 h-3" />
                        {t.due}{t.delayed && " · 지연"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selectedTask && (
          <>
            <button
              type="button"
              aria-label="업무 상세 패널 닫기"
              className="fixed inset-0 z-40 bg-slate-900/20"
              onClick={() => setSelectedTaskId(null)}
            />
            <aside className="fixed inset-y-0 right-0 z-50 w-[380px] bg-white border-l border-gray-200 shadow-2xl flex flex-col" aria-label="상시 업무 상세 패널">
              <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-mono text-gray-400 mb-1">{selectedTask.id}</p>
                  <h2 className="text-base font-bold text-gray-900 leading-snug">{selectedTask.name}</h2>
                </div>
                <button type="button" onClick={() => setSelectedTaskId(null)} className="p-1.5 -mr-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="닫기">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex flex-col gap-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <DepartmentChip dept={selectedTask.dept} />
                  <Chip label={selectedTask.status} variant={selectedTask.status === "검토 필요" ? "yellow" : selectedTask.status === "완료" ? "green" : "blue"} />
                  <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-medium">{selectedTask.cycle}</span>
                  {selectedTask.delayed && <Chip label="지연" variant="red" />}
                </div>

                <section>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">업무 설명</p>
                  <p className="text-sm text-gray-700 leading-6">{selectedTask.description}</p>
                </section>

                <section className="grid grid-cols-2 gap-px border border-gray-200 rounded-lg overflow-hidden bg-gray-200">
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-gray-400 mb-1">담당자</p>
                    <p className={`text-xs font-semibold ${selectedTask.assignee === "미지정" ? "text-red-600" : "text-gray-800"}`}>{selectedTask.assignee === "미지정" ? "미지정 · 배정 필요" : selectedTask.assignee}</p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-gray-400 mb-1">마감일</p>
                    <p className={`text-xs font-semibold ${selectedTask.delayed ? "text-red-600" : "text-gray-800"}`}>{selectedTask.due}{selectedTask.delayed && " · 지연"}</p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-gray-400 mb-1">담당 부서</p>
                    <p className="text-xs font-semibold text-gray-800">{selectedTask.dept}</p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-gray-400 mb-1">반복 주기</p>
                    <p className="text-xs font-semibold text-gray-800">{selectedTask.cycle}</p>
                  </div>
                </section>

                {selectedTask.assignee === "미지정" && (
                  <section className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-xs font-bold text-red-800">담당자 배정 필요</p>
                    <p className="text-[11px] text-red-700 mt-1">배정하면 해당 담당자의 내 업무에서 바로 확인할 수 있습니다.</p>
                    <div className="flex gap-2 mt-3">
                      <select aria-label="담당자 선택" value={assigneeToAssign} onChange={e => setAssigneeToAssign(e.target.value)} className="flex-1 bg-white border border-red-200 rounded-lg px-3 py-2 text-xs text-gray-700">
                        {["박해랑", "정하늘", "이수현", "이윤슬", "김민준", "김바다"].map(member => <option key={member}>{member}</option>)}
                      </select>
                      <Btn variant="primary" size="sm" onClick={assignTask}><User className="w-3.5 h-3.5" /> 담당자 배정</Btn>
                    </div>
                  </section>
                )}

                <section>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">연결된 항목</p>
                  <div className="flex flex-col gap-2">
                    {selectedTask.related.map(item => (
                      <div key={item} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-700">
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">처리 기록</p>
                  <div className="flex flex-col gap-2">
                    {(selectedTask.history ?? []).length > 0 ? [...(selectedTask.history ?? [])].reverse().map((record, index) => (
                      <div key={`${record.date}-${index}`} className="border border-gray-200 rounded-lg px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-gray-800">{record.action}</p><span className="text-[10px] text-gray-400 shrink-0">{record.date}</span></div>
                        <p className="text-[10px] text-gray-500 mt-1">{record.user}</p>
                        {record.note && <p className="text-xs text-gray-600 leading-5 mt-2">{record.note}</p>}
                      </div>
                    )) : <p className="border border-dashed border-gray-200 rounded-lg px-3 py-4 text-xs text-gray-400 text-center">아직 기록된 처리 내용이 없습니다.</p>}
                  </div>
                </section>
              </div>

              <div className="mt-auto px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500 leading-4">업무 정보는 읽기 전용이며, 담당자 배정과 상태 변경은 이 패널에서 처리할 수 있습니다.</p>
                <Btn variant="secondary" size="sm" className="shrink-0" onClick={() => setShowStatusDialog(true)}><RefreshCw className="w-3.5 h-3.5" /> 상태 변경</Btn>
              </div>
            </aside>
          </>
        )}
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div><h2 className="text-base font-bold text-gray-900">상시 업무 추가</h2><p className="text-xs text-gray-500 mt-1">반복 주기와 담당·연결 맥락을 함께 정해, 다음 주기에도 일관되게 관리합니다.</p></div>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="상시 업무 추가 닫기" className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">업무 정의</p>
                <Input label="업무명" value={newTask.name} onChange={e => setNewTask(prev => ({ ...prev, name: e.target.value }))} placeholder="예: 월간 비품 재고 점검" required />
                <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-700">업무 설명<span className="text-red-500 ml-0.5">*</span></label><textarea value={newTask.description} onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm h-24" placeholder="점검 범위, 처리 방식, 공유해야 할 내용을 구체적으로 적어주세요." /></div>
              </section>
              <section className="pt-5 border-t border-gray-100 grid grid-cols-2 gap-4">
                <p className="col-span-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">담당·주기·상태</p>
                <Input label="담당 부서" select selectOptions={["기획부", "운영부", "재정부", "홍보부"]} value={newTask.dept} onChange={e => setNewTask(prev => ({ ...prev, dept: e.target.value }))} />
                <Input label="담당자" select selectOptions={["박해랑", "정하늘", "이수현", "이윤슬", "김민준", "김바다", "미지정"]} value={newTask.assignee} onChange={e => setNewTask(prev => ({ ...prev, assignee: e.target.value }))} />
                <Input label="반복 주기" select selectOptions={["매주", "매월", "상시"]} value={newTask.cycle} onChange={e => setNewTask(prev => ({ ...prev, cycle: e.target.value }))} />
                <Input label="초기 상태" select selectOptions={["예정", "진행 중", "검토 필요", "완료"]} value={newTask.status} onChange={e => setNewTask(prev => ({ ...prev, status: e.target.value }))} />
                <Input label="첫 마감일" type="date" value={newTask.due} onChange={e => setNewTask(prev => ({ ...prev, due: e.target.value }))} hint={newTask.cycle === "상시" ? "상시 업무도 첫 점검일을 기록합니다." : undefined} required />
              </section>
              <section className="pt-5 border-t border-gray-100 flex flex-col gap-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">연결 맥락</p>
                <label className="text-xs font-medium text-gray-700">연결된 항목</label>
                <textarea value={newTask.relatedText} onChange={e => setNewTask(prev => ({ ...prev, relatedText: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm h-16" placeholder="회의, 문서, 재정 항목 등을 쉼표(,)로 구분해 입력하세요." />
                <p className="text-[10px] text-gray-400">예: 주간 운영회의, 비품 관리대장, 재정 &gt; 사용 내역</p>
              </section>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100"><Btn variant="secondary" onClick={() => setShowCreate(false)}>취소</Btn><Btn variant="primary" onClick={createTask} disabled={!newTask.name.trim() || !newTask.description.trim() || !newTask.due}>업무 추가</Btn></div>
            </div>
          </div>
        </div>
      )}
      {showStatusDialog && selectedTask && <TaskStatusDialog taskName={selectedTask.name} currentStatus={selectedTask.status} onClose={() => setShowStatusDialog(false)} onSubmit={updateStatus} />}
    </DesktopShell>
  );
}

function EVTTASK01() {
  const { eventWorkspaceFilter, setEventWorkspaceFilter, currentUser, eventTasks, setEventTasks, setSelectedEventTaskId, navigateTo } = React.useContext(AppContext);
  const [viewMode, setViewMode] = useState<"all" | "mine">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({
    name: "", dept: currentUser.dept, assignee: currentUser.name, due: "2026-07-25",
    priority: "보통" as EventTask["priority"], status: "예정" as EventTaskStatus,
    description: "", completionCriteria: "", deliverable: "문서", reviewRequired: false, relatedText: "",
  });
  const tasks = eventTasks;

  const myTasks = tasks.filter(t => t.assignee === currentUser.name);
  const delayedTasks = tasks.filter(t => t.delayed);
  const reviewTasks = tasks.filter(t => t.status === "검토 필요");
  const completedTasks = tasks.filter(t => t.status === "완료");
  const contextFilteredTasks = eventWorkspaceFilter === "unassignedTasks" ? tasks.filter(t => t.assignee === "미지정") : tasks;
  const visibleTasks = viewMode === "mine" ? contextFilteredTasks.filter(t => t.assignee === currentUser.name) : contextFilteredTasks;

  const columns = ["예정", "진행 중", "검토 필요", "완료"];

  const openTask = (taskId: string) => {
    setSelectedEventTaskId(taskId);
    navigateTo("EVT-TASK-02");
  };

  const createTask = () => {
    if (!newTask.name.trim() || !newTask.description.trim() || !newTask.completionCriteria.trim()) return;
    const task: EventTask = {
      id: `T-${String(tasks.length + 1).padStart(2, "0")}`,
      name: newTask.name.trim(),
      dept: newTask.dept,
      assignee: newTask.assignee.trim() || "미지정",
      status: newTask.status,
      due: newTask.due,
      priority: newTask.priority,
      hasDoc: newTask.deliverable !== "없음",
      delayed: false,
      description: newTask.description.trim(),
      related: newTask.relatedText.split(",").map(item => item.trim()).filter(Boolean).length > 0 ? newTask.relatedText.split(",").map(item => item.trim()).filter(Boolean) : ["행사 업무"],
      completionCriteria: newTask.completionCriteria.trim(),
      deliverable: newTask.deliverable,
      reviewRequired: newTask.reviewRequired,
    };
    setEventTasks(prev => [...prev, task]);
    setShowCreate(false);
    openTask(task.id);
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회", "업무"]}
      title="2026 소프트웨어융합대학 체육대회"
      tabs={EVENT_TABS}
      activeTab="업무"
      actions={<Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> 업무 추가</Btn>}
    >
      <div className="p-6 flex flex-col gap-5">
        {/* 행사 정보 배너 */}
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-bold text-gray-900">2026 소프트웨어융합대학 체육대회</p>
            <p className="text-xs text-gray-500 mt-0.5">행사일 2026-08-20 · ERICA 체육관</p>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-[10px] text-gray-400">D-DAY</p>
              <p className="text-xl font-bold text-blue-600">D-33</p>
            </div>
            <div className="border-l border-gray-100 pl-6">
              <p className="text-[10px] text-gray-400 mb-1">전체 진행 현황</p>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(completedTasks.length / tasks.length) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-700">{completedTasks.length} / {tasks.length} 완료</span>
              </div>
            </div>
          </div>
        </div>

        {/* 상단 요약 칩 */}
        <div className="flex gap-3">
          {delayedTasks.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-700">지연 {delayedTasks.length}건</span>
            </div>
          )}
          {reviewTasks.length > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-800">검토 필요 {reviewTasks.length}건</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-800">내 담당 {myTasks.length}건</span>
          </div>
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-700">담당자 없음 2건</span>
          </div>
          <div className="ml-auto flex bg-gray-100 rounded-lg p-0.5">
            {(["all", "mine"] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${viewMode === mode ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}>{mode === "all" ? "전체 업무" : "내 업무"}</button>
            ))}
          </div>
        </div>

        {eventWorkspaceFilter === "unassignedTasks" && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-red-800 font-medium">담당자 없는 업무 2건만 보고 있습니다.</span>
            <button onClick={() => setEventWorkspaceFilter(null)} className="ml-auto text-xs text-red-700 hover:underline">필터 해제</button>
          </div>
        )}

        {/* 칸반 보드 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-gray-800">행사 업무 — 칸반 보드</h1>
            <span className="text-[10px] text-gray-400">부서 색상선 · 상태 배지는 별도 표시</span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 h-[500px]">
            {columns.map(col => (
              <div key={col} className="flex flex-col gap-3 min-w-[260px] flex-1 bg-gray-100/50 rounded-xl p-3 border border-gray-200/50">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{col}</span>
                  <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">
                    {visibleTasks.filter(t => t.status === col).length}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {visibleTasks.filter(t => t.status === col).map(t => (
                    <button key={t.id} type="button" onClick={() => openTask(t.id)} aria-label={`${t.name} 상세 보기`} className={`${taskCardClass(t.dept, t.assignee === "미지정")} text-left w-full hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300`}>
                      <p className="text-xs font-bold text-gray-800 mb-2 leading-tight">{t.name}</p>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <DepartmentChip dept={t.dept} />
                        {t.delayed && <Chip label="지연" variant="red" />}
                        {t.status === "검토 필요" && <Chip label="검토 필요" variant="yellow" />}
                        <span className={`text-[10px] ${t.assignee === "미지정" ? "text-red-600 font-semibold" : "text-gray-400"}`}>{t.assignee === "미지정" ? "담당자 없음 · 배정 필요" : t.assignee}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                        <div className={`flex items-center gap-1.5 text-[10px] ${t.delayed ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                          <Calendar className="w-3 h-3" />
                          {t.due}{t.delayed && " · 지연"}
                        </div>
                        {t.hasDoc && <FileText className="w-3.5 h-3.5 text-gray-300" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div><h2 className="text-base font-bold text-gray-900">행사 업무 추가</h2><p className="text-xs text-gray-500 mt-1">업무의 목적·완료 기준·결과물을 함께 정의해, 담당자가 바로 실행할 수 있게 만듭니다.</p></div>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="업무 추가 닫기" className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">업무 정의</p>
                <Input label="업무명" value={newTask.name} onChange={e => setNewTask(prev => ({ ...prev, name: e.target.value }))} placeholder="예: 현장 안내 인력 배정" required />
                <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-700">업무 설명<span className="text-red-500 ml-0.5">*</span></label><textarea value={newTask.description} onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm h-20" placeholder="왜 필요한 업무인지와 담당자가 해야 할 일을 구체적으로 적어주세요." /></div>
                <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-700">완료 기준<span className="text-red-500 ml-0.5">*</span></label><textarea value={newTask.completionCriteria} onChange={e => setNewTask(prev => ({ ...prev, completionCriteria: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm h-20" placeholder="예: 안내 인력 12명 확정 후 연락처와 배치표를 운영 회의에 공유" /></div>
              </section>
              <section className="pt-5 border-t border-gray-100 flex flex-col gap-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">담당·일정·상태</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="담당 부서" select selectOptions={["기획부", "운영부", "재정부", "홍보부"]} value={newTask.dept} onChange={e => setNewTask(prev => ({ ...prev, dept: e.target.value }))} />
                  <Input label="담당자" select selectOptions={["박해랑", "정하늘", "이수현", "이윤슬", "김민준", "김바다", "미지정"]} value={newTask.assignee} onChange={e => setNewTask(prev => ({ ...prev, assignee: e.target.value }))} hint="추후 상세 화면에서 다시 배정할 수 있습니다." />
                  <Input label="마감일" type="date" value={newTask.due} onChange={e => setNewTask(prev => ({ ...prev, due: e.target.value }))} required />
                  <Input label="초기 상태" select selectOptions={["예정", "진행 중", "검토 필요", "완료"]} value={newTask.status} onChange={e => setNewTask(prev => ({ ...prev, status: e.target.value as EventTaskStatus }))} />
                  <Input label="우선순위" select selectOptions={["보통", "높음"]} value={newTask.priority} onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value as EventTask["priority"] }))} />
                  <Input label="결과물 유형" select selectOptions={["문서", "파일", "구매 요청", "회의 결정", "없음"]} value={newTask.deliverable} onChange={e => setNewTask(prev => ({ ...prev, deliverable: e.target.value }))} />
                </div>
              </section>
              <section className="pt-5 border-t border-gray-100 flex flex-col gap-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">연결 맥락</p>
                <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-700">연결된 항목</label><textarea value={newTask.relatedText} onChange={e => setNewTask(prev => ({ ...prev, relatedText: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm h-16" placeholder="문서, 회의, 구매 요청 등을 쉼표(,)로 구분해 입력하세요." /><p className="text-[10px] text-gray-400">예: 안전 점검표, 운영 점검 회의, 물품 구매 요청</p></div>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" checked={newTask.reviewRequired} onChange={e => setNewTask(prev => ({ ...prev, reviewRequired: e.target.checked }))} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />결과물 제출 후 검토가 필요합니다.</label>
              </section>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100"><Btn variant="secondary" onClick={() => setShowCreate(false)}>취소</Btn><Btn variant="primary" onClick={createTask} disabled={!newTask.name.trim() || !newTask.description.trim() || !newTask.completionCriteria.trim()}>업무 추가</Btn></div>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
}

function EVTTASK02() {
  const { eventTasks, setEventTasks, selectedEventTaskId, navigateTo, currentUser } = React.useContext(AppContext);
  const [activeTab, setActiveTab] = useState("관련 문서·결과물");
  const [assigneeToAssign, setAssigneeToAssign] = useState("박해랑");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const task = eventTasks.find(item => item.id === selectedEventTaskId) ?? eventTasks.find(item => item.id === "T-03") ?? eventTasks[0];
  const statusVariant = task.status === "완료" ? "green" : task.status === "검토 필요" ? "yellow" : task.status === "예정" ? "gray" : "blue";
  const availableAssignees = ["박해랑", "정하늘", "이수현", "이윤슬", "김민준", "김바다"];
  const assignTask = () => setEventTasks(prev => prev.map(item => item.id === task.id ? { ...item, assignee: assigneeToAssign } : item));
  const updateStatus = (status: EventTaskStatus, note: string) => {
    setEventTasks(prev => prev.map(item => item.id === task.id ? {
      ...item,
      status,
      delayed: status === "완료" ? false : item.delayed,
      history: [...(item.history ?? []), { date: "방금 전", action: `상태 변경 — ${status}`, user: currentUser.name, note }],
    } : item));
    setShowStatusDialog(false);
  };

  const officialDocs: EventTaskOfficialDoc[] = task.officialDocs ?? task.related.map(name => ({
    name,
    lastModified: "연결 항목에서 확인",
    status: "참고",
    preview: `${task.name} 업무에 연결된 공식 참고 자료입니다.`,
  }));
  const workDocs = task.workDocs ?? [];
  const reviewInfo: EventTaskReviewInfo = task.reviewInfo ?? {
    submitStatus: workDocs.length > 0 ? "작성 중" : "미제출",
    reviewComment: workDocs.length > 0 ? "등록된 검토 의견이 없습니다." : "제출된 결과물이 없어 검토가 시작되지 않았습니다.",
    needsRevision: false,
    isOfficial: task.status === "완료",
  };
  const reviewBoxStyle = reviewInfo.needsRevision
    ? "border-yellow-200 bg-yellow-50"
    : reviewInfo.submitStatus === "미제출"
      ? "border-gray-200 bg-gray-50"
      : "border-blue-200 bg-blue-50";

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", "2026 소프트웨어융합대학 체육대회", "업무", "업무 상세"]}
      title="업무 상세 — 관련 문서·결과물"
      actions={<><Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-TASK-01")}><ArrowLeft className="w-3.5 h-3.5" /> 업무 보드로</Btn><Btn variant="primary" size="sm" onClick={() => setShowStatusDialog(true)}><RefreshCw className="w-3.5 h-3.5" /> 상태 변경</Btn></>}
    >
      <div className="flex h-full overflow-hidden">
        {/* 본문 */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-20">

            {/* 업무 정보 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-gray-400">{task.id}</span>
                    <Chip label={task.status} variant={statusVariant} />
                    <Chip label={task.priority} variant={task.priority === "높음" ? "red" : "gray"} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{task.name}</h2>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-x-8 gap-y-4 border-t border-gray-100 pt-5">
                {[
                  ["담당자", task.assignee === "미지정" ? "미지정 · 배정 필요" : task.assignee],
                  ["담당 부서", task.dept],
                  ["업무 상태", task.status],
                  ["마감일", `${task.due}${task.delayed ? " · 지연" : ""}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-gray-400 font-semibold mb-1">{k}</p>
                    <p className="text-xs text-gray-700">{v}</p>
                  </div>
                ))}
                <div className="col-span-4">
                  <p className="text-[10px] text-gray-400 font-semibold mb-1">업무 설명</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{task.description}</p>
                </div>
              </div>
              {(task.completionCriteria || task.deliverable || task.reviewRequired || task.related.length > 0) && (
                <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-400 font-semibold mb-1">완료 기준</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{task.completionCriteria ?? "완료 기준이 아직 등록되지 않았습니다."}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold mb-1.5">예상 결과물</p>
                    <span className="inline-flex bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-1 text-[10px] font-medium">{task.deliverable ?? (task.hasDoc ? "문서·파일" : "없음")}</span>
                    {task.reviewRequired && <span className="ml-1.5 inline-flex bg-yellow-50 text-yellow-700 border border-yellow-100 rounded px-2 py-1 text-[10px] font-medium">제출 후 검토</span>}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold mb-1.5">연결된 항목</p>
                    <div className="flex flex-wrap gap-1.5">{task.related.map(item => <span key={item} className="bg-gray-100 text-gray-600 rounded px-2 py-1 text-[10px] font-medium">{item}</span>)}</div>
                  </div>
                </div>
              )}
              {task.assignee === "미지정" && (
                <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-4 flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-800">담당자 배정 필요</p>
                    <p className="text-[11px] text-red-700 mt-1">업무가 배정되기 전에는 개인 업무 목록에 표시되지 않습니다.</p>
                    <select aria-label="담당자 선택" value={assigneeToAssign} onChange={e => setAssigneeToAssign(e.target.value)} className="mt-3 w-full bg-white border border-red-200 rounded-lg px-3 py-2 text-xs text-gray-700">
                      {availableAssignees.map(member => <option key={member}>{member}</option>)}
                    </select>
                  </div>
                  <Btn variant="primary" size="sm" onClick={assignTask}><User className="w-3.5 h-3.5" /> 담당자 배정</Btn>
                </div>
              )}
            </div>

            {/* 탭 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 border-b border-gray-100 flex items-center gap-6">
                {["관련 문서·결과물", "처리 기록"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-4 text-sm font-semibold border-b-2 transition-all -mb-px ${activeTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "관련 문서·결과물" && (
                <div className="p-6 flex flex-col gap-8">
                  {/* 공식 문서 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-bold text-gray-700">공식 참고 문서</p>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">행사 공용 원본 · 여러 업무에서 공유</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {officialDocs.map(doc => (
                        <div key={doc.name} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{doc.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{doc.preview}</p>
                              <p className="text-[10px] text-gray-400 mt-1">최종 수정일 {doc.lastModified}</p>
                            </div>
                          </div>
                          <Chip label={doc.status} variant={doc.status === "확정" ? "green" : doc.status === "검토 중" ? "yellow" : "gray"} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 작업 문서 및 결과물 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-bold text-gray-700">작업 문서 및 결과물</p>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">이 업무에서 작성 중</span>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-medium">
                            <th className="px-4 py-2.5">파일·문서명</th>
                            <th className="px-4 py-2.5">유형</th>
                            <th className="px-4 py-2.5 text-center">검토 상태</th>
                            <th className="px-4 py-2.5 text-center">공식 문서 반영</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {workDocs.map(d => (
                            <tr key={d.name} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                              <td className="px-4 py-3 text-gray-500">{d.type}</td>
                              <td className="px-4 py-3 text-center">
                                <Chip label={d.reviewStatus} variant={d.reviewStatus === "승인" ? "green" : d.reviewStatus === "검토 중" ? "yellow" : "gray"} />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-[10px] text-gray-400">미반영</span>
                              </td>
                            </tr>
                          ))}
                          {workDocs.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center">
                                <p className="text-xs font-semibold text-gray-600">아직 등록된 작업 문서나 결과물이 없습니다</p>
                                <p className="text-[10px] text-gray-400 mt-1">이 업무에 필요한 결과물이 생기면 여기에서 추가할 수 있습니다.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      <div className="px-4 py-3 border-t border-dashed border-gray-100">
                        <button className="text-[10px] text-gray-400 flex items-center gap-1.5 hover:text-gray-600">
                          <Upload className="w-3 h-3" /> 파일 추가
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 검토 영역 */}
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-3">검토 현황</p>
                    <div className={`border rounded-lg p-5 flex flex-col gap-3 ${reviewBoxStyle}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-semibold">제출 상태</span>
                          <Chip label={reviewInfo.submitStatus} variant={reviewInfo.submitStatus === "미제출" ? "gray" : "blue"} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-semibold">공식 결과 확정</span>
                          <Chip label={reviewInfo.isOfficial ? "확정됨" : "미확정"} variant={reviewInfo.isOfficial ? "green" : "gray"} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-semibold mb-1">검토 의견</p>
                        <p className={`text-xs leading-relaxed ${reviewInfo.needsRevision ? "text-yellow-800" : "text-gray-600"}`}>{reviewInfo.reviewComment}</p>
                      </div>
                      {reviewInfo.needsRevision && (
                        <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" /> 수정 후 재제출이 필요합니다.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "처리 기록" && (
                <div className="p-6 flex flex-col gap-4">
                  {[
                    { date: "2026-07-12", action: "업무 생성", user: "이수현" },
                    { date: "2026-07-14", action: task.assignee === "미지정" ? "담당자 배정 대기" : `담당자 지정 — ${task.assignee}`, user: "이수현" },
                    { date: "2026-07-17", action: `${task.status} 상태로 업데이트`, user: task.assignee === "미지정" ? "운영 조직" : task.assignee },
                    ...(task.history ?? []),
                  ].map((h, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-gray-800">{h.action}</p>
                        <p className="text-[10px] text-gray-400">{h.user} · {h.date}</p>
                        {h.note && <p className="text-[11px] text-gray-600 mt-1 leading-5">{h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showStatusDialog && <TaskStatusDialog taskName={task.name} currentStatus={task.status} onClose={() => setShowStatusDialog(false)} onSubmit={updateStatus} />}
    </DesktopShell>
  );
}

// ─── Wrapper screens with modals ─────────────────────────────────────────────

function ORG07WithModal({ which }: { which: "B" | null }) {
  const [modal, setModal] = useState<"B" | null>(which);
  return (
    <div className="relative h-full">
      <ORG07A onOpenB={() => setModal("B")} />
      {modal === "B" && <ORG07B onClose={() => setModal(null)} />}
    </div>
  );
}

function EVT04WithQR() {
  const [qrOpen, setQrOpen] = useState(false);
  return (
    <div className="relative h-full">
      <EVT04 onOpenQR={() => setQrOpen(true)} />
      {qrOpen && <EVT04B onClose={() => setQrOpen(false)} />}
    </div>
  );
}

function ORG03CWithDialog() {
  return <ORG03C />;
}

// ─── Screen Registry ──────────────────────────────────────────────────────────

const SCREEN_COMPONENTS: Record<string, React.ComponentType> = {
  "HOME-01": HOME01,
  "OPS-00": OPS00,
  "ORG-00": ORG00,
  "ONB-01": ONB01,
  "ONB-02": ONB02,
  "INV-00": ONB03,
  "ORG-01": ORG01,
  "ORG-02": ORG02,
  "INV-01": INV01,
  "ORG-03A": ORG03A,
  "ORG-03B": ORG03B,
  "ORG-03C": ORG03CWithDialog,
  "ORG-07A": () => <ORG07WithModal which={null} />,
  "ORG-07B": () => <ORG07WithModal which="B" />,
  "ORG-04": ORG04,
  "ORG-04B": ORG04B,
  "EVT-00A": EVT00A,
  "EVT-00A2": EVT00A2,
  "EVT-00B": EVT00B,
  "EVT-01": EVT01,
  "EVT-02": EVT02,
  "EVT-02B": EVT02B,
  "EVT-02C": EVT02C,
  "EVT-02D": EVT02D,
  "EVT-02E": EVT02E,
  "EVT-03C": EVT03C,
  "EVT-04C": EVT04C,
  "EVT-03A": EVT03A,
  "EVT-03B": EVT03B,
  "EVT-04": EVT04WithQR,
  "EVT-04B": () => {
    const [open, setOpen] = useState(true);
    return (
      <div className="relative h-full">
        <EVT04 onOpenQR={() => setOpen(true)} />
        {open && <EVT04B onClose={() => setOpen(false)} />}
      </div>
    );
  },
  "EVT-05": EVT05,
  "EVT-05B": EVT05B,
  "EVT-MEET-01": EVTMEET01,
  "EVT-SCHED-01": EVTSCHED01,
  "EVT-DOC-01": EVTDOC01,
  "REC-01": REC01,
  "REC-02": REC02,
  "REC-02A": REC02A,
  "FIN-00": FIN00,
  "FIN-WORK-01": FINWORK01,
  "MY-01": MY01,
  "MY-REQ-01": MYREQ01,
  "EVT-FIN-01": EVTFIN01,
  "FIN-REQ-01": FINREQ01,
  "FIN-REQ-02": FINREQ02,
  "FIN-SUP-01": FINSUP01,
  "FIN-REV-01": FINREV01,
  "FIN-PROC-01": FINPROC01,
  "FIN-EVID-01": FINEVID01,
  "FIN-LEDGER-01": FINLEDGER01,
  "EVT-TASK-01": EVTTASK01,
  "EVT-TASK-02": EVTTASK02,
  "OPS-TASK-01": OPSTASK01,
  "OPS-CAL-01": OPSCAL01,
  "OPS-MEET-01A": OPSMEET01A,
  "OPS-MEET-01B": OPSMEET01B,
  "OPS-MEET-01C": OPSMEET01C,
  "OPS-MEET-02": OPSMEET02,
  "OPS-MEET-03A": OPSMEET03A,
  "OPS-MEET-03B": OPSMEET03B,
  "OPS-MEET-03C": OPSMEET03C,
  "OPS-MEET-04A": OPSMEET04A,
  "OPS-MEET-04B": OPSMEET04B,
  "OPS-MEET-05A": OPSMEET05A,
  "OPS-MEET-05B": OPSMEET05B,
  "OPS-MEET-06A": OPSMEET06A,
  "OPS-MEET-06B": OPSMEET06B,
  "OPS-MEET-07": OPSMEET07,
  "OPS-MEET-08": OPSMEET08,
  "OPS-MEET-09": OPSMEET09,
  "OPS-MEET-D01": OPSMEETD01,
  "OPS-MEET-D02": OPSMEETD02,
  "OPS-MEET-D03": OPSMEETD03,
  "OPS-MEET-D04": OPSMEETD04,
  "EXT-02A": EXT02A,
  "EXT-02B": EXT02B,
  "EXT-02C": EXT02C,
  "EXT-01A": EXT01A,
  "EXT-01B": EXT01B,
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeScreen, setActiveScreen] = useState("ONB-01");
  const [navOpen, setNavOpen] = useState(true);
  const [specMode, setSpecMode] = useState(false);
  const [eventInfo, setEventInfo] = useState<EventInfo>(DEFAULT_EVENT_INFO);
  const [eventLifecycle, setEventLifecycle] = useState<EventLifecycle>("기획 중");
  const [eventWorkspaceFilter, setEventWorkspaceFilter] = useState<EventWorkspaceFilter>(null);
  const [calendarFocus, setCalendarFocus] = useState<CalendarFocus>(null);
  const [surveySettings, setSurveySettings] = useState<SurveySettings>(DEFAULT_SURVEY_SETTINGS);
  const [eventTasks, setEventTasks] = useState<EventTask[]>(DEFAULT_EVENT_TASKS);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>(DEFAULT_RECURRING_TASKS);
  const [createdMeetings, setCreatedMeetings] = useState<CreatedMeeting[]>([]);
  const [createdEvents, setCreatedEvents] = useState<CreatedEvent[]>([]);
  const [selectedCreatedMeetingId, setSelectedCreatedMeetingId] = useState<string | null>(null);
  const [selectedRecurringTaskId, setSelectedRecurringTaskId] = useState<string | null>(null);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [archives, setArchives] = useState<ArchiveRecord[]>(DEFAULT_ARCHIVES);
  const [selectedEventTaskId, setSelectedEventTaskId] = useState<string | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>(DEFAULT_PURCHASE_REQUESTS);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft | null>(() => loadDraft<MeetingDraft>(DRAFT_STORAGE_KEYS.meeting));
  const [purchaseRequestDraft, setPurchaseRequestDraft] = useState<PurchaseRequestDraft | null>(() => loadDraft<PurchaseRequestDraft>(DRAFT_STORAGE_KEYS.purchaseRequest));
  const [purchaseSupplementDraft, setPurchaseSupplementDraft] = useState<PurchaseSupplementDraft | null>(() => loadDraft<PurchaseSupplementDraft>(DRAFT_STORAGE_KEYS.purchaseSupplement));
  const [organizationMemberRoles, setOrganizationMemberRoles] = useState<OrganizationMemberRole[]>(DEFAULT_ORGANIZATION_MEMBER_ROLES);
  const [demoDataMode, setDemoDataMode] = useState<DemoDataMode>("default");

  useEffect(() => {
    if (meetingDraft) window.localStorage.setItem(DRAFT_STORAGE_KEYS.meeting, JSON.stringify(meetingDraft));
    else window.localStorage.removeItem(DRAFT_STORAGE_KEYS.meeting);
  }, [meetingDraft]);

  useEffect(() => {
    if (purchaseRequestDraft) window.localStorage.setItem(DRAFT_STORAGE_KEYS.purchaseRequest, JSON.stringify(purchaseRequestDraft));
    else window.localStorage.removeItem(DRAFT_STORAGE_KEYS.purchaseRequest);
  }, [purchaseRequestDraft]);

  useEffect(() => {
    if (purchaseSupplementDraft) window.localStorage.setItem(DRAFT_STORAGE_KEYS.purchaseSupplement, JSON.stringify(purchaseSupplementDraft));
    else window.localStorage.removeItem(DRAFT_STORAGE_KEYS.purchaseSupplement);
  }, [purchaseSupplementDraft]);

  const groups = [...new Set(SCREENS.map(s => s.group))];
  const ActiveComponent = SCREEN_COMPONENTS[activeScreen];
  const activeInfo = SCREENS.find(s => s.id === activeScreen);
  const specDef = SPEC_DATA[activeScreen];

  return (
    <AppContext.Provider value={{
      eventInfo, setEventInfo,
      eventLifecycle, setEventLifecycle,
      eventWorkspaceFilter, setEventWorkspaceFilter,
      calendarFocus, setCalendarFocus,
      surveySettings, setSurveySettings,
      eventTasks, setEventTasks,
      recurringTasks, setRecurringTasks,
      createdMeetings, setCreatedMeetings,
      createdEvents, setCreatedEvents,
      selectedCreatedMeetingId, setSelectedCreatedMeetingId,
      selectedRecurringTaskId, setSelectedRecurringTaskId,
      selectedArchiveId, setSelectedArchiveId,
      archives, setArchives,
      selectedEventTaskId, setSelectedEventTaskId,
      purchaseRequests, setPurchaseRequests,
      meetingDraft, setMeetingDraft,
      purchaseRequestDraft, setPurchaseRequestDraft,
      purchaseSupplementDraft, setPurchaseSupplementDraft,
      organizationMemberRoles, setOrganizationMemberRoles,
      demoDataMode, setDemoDataMode,
      navigateTo: setActiveScreen,
      currentUser: { name: "박해랑", dept: "운영부", role: organizationMemberRoles.find(member => member.name === "박해랑")?.role ?? "부원" },
      activeSidebar: undefined
    }}>
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* Navigator */}
      <div className={`${navOpen ? "w-64" : "w-0"} transition-all duration-200 overflow-hidden shrink-0 flex flex-col bg-white border-r border-gray-200`}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-bold text-gray-800">Vada 와이어프레임</p>
            <p className="text-[10px] text-gray-400">{SCREENS.length}개 화면</p>
          </div>
          <button onClick={() => setNavOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {groups.map(group => (
            <div key={group} className="mb-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{group}</p>
              {SCREENS.filter(s => s.group === group).map(screen => (
                <button
                  key={screen.id}
                  onClick={() => setActiveScreen(screen.id)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-2 transition-colors ${activeScreen === screen.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {screen.mobile && <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1 py-0.5 font-mono shrink-0">M</span>}
                  <span className="text-xs">
                    <span className={`font-mono text-[10px] mr-1.5 ${activeScreen === screen.id ? "text-blue-500" : "text-gray-400"}`}>{screen.id}</span>
                    {screen.label}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="h-10 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
          {!navOpen && (
            <button onClick={() => setNavOpen(true)} className="text-gray-500 hover:text-gray-700">
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="font-mono text-gray-400">{activeInfo?.id}</span>
            <span className="text-gray-300">/</span>
            <span>{activeInfo?.label}</span>
            {activeInfo?.mobile && <Chip label="모바일" variant="blue" />}
            {specMode && specDef && <SpecStateChip label={specDef.stateChip} />}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <select
              aria-label="와이어프레임 샘플 데이터 상태"
              value={demoDataMode}
              onChange={event => setDemoDataMode(event.target.value as DemoDataMode)}
              className="text-xs px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-500 focus:outline-none"
            >
              <option value="default">샘플: 기본 데이터</option>
              <option value="first-use">샘플: 첫 사용 · 빈 상태</option>
            </select>
            {/* Spec mode toggle */}
            <button
              onClick={() => setSpecMode(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded border transition-colors ${
                specMode
                  ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                  : "text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              화면정의서
            </button>

            <div className="flex gap-1">
              {SCREENS.findIndex(s => s.id === activeScreen) > 0 && (
                <button
                  onClick={() => setActiveScreen(SCREENS[SCREENS.findIndex(s => s.id === activeScreen) - 1].id)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> 이전
                </button>
              )}
              {SCREENS.findIndex(s => s.id === activeScreen) < SCREENS.length - 1 && (
                <button
                  onClick={() => setActiveScreen(SCREENS[SCREENS.findIndex(s => s.id === activeScreen) + 1].id)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50"
                >
                  다음 <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Screen + Spec Panel */}
        <div className={`flex-1 flex overflow-hidden ${activeInfo?.mobile ? "bg-gray-200" : "bg-gray-50"}`}>
          <div className="flex-1 overflow-auto">
            {ActiveComponent && <ActiveComponent />}
          </div>
          {specMode && <SpecPanel screenId={activeScreen} />}
        </div>
      </div>
    </div>
    </AppContext.Provider>
  );
}
