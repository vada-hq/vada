import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  GripVertical, Plus, X, ChevronRight, ChevronDown, Search, Download,
  Copy, RefreshCw, QrCode, Check, AlertCircle, Clock, User, Users,
  Calendar, MapPin, ArrowLeft, ArrowRight, FileText, Settings, Home,
  BarChart2, Clipboard, Menu, ExternalLink, MoreHorizontal, Upload, Eye,
  Minus, Star, Info, Sparkles, MessageSquare, Paperclip
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
  { id: "HOME-01K", label: "홈 — 끼룩이 브리핑", group: "홈" },
  { id: "MY-01", label: "내 업무", group: "내 업무" },
  { id: "OPS-00", label: "운영 홈 — 업무·회의·행사·캘린더", group: "운영 홈" },
  { id: "OPS-TASK-01", label: "상시 업무 — 칸반 보드", group: "운영 — 상시 업무" },
  { id: "OPS-MEET-01A", label: "전체 회의 — 일반 참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-01B", label: "전체 회의 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-01C", label: "전체 회의 — 회의 생성 가능", group: "운영 — 회의" },
  { id: "OPS-MEET-01D", label: "전체 회의 — 미참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-02", label: "회의 생성·수정", group: "운영 — 회의" },
  { id: "OPS-MEET-03A", label: "예정 회의 상세 — 일반 참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-03B", label: "예정 회의 관리 — 생성자", group: "운영 — 회의" },
  { id: "OPS-MEET-03C", label: "예정 회의 상세 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-04B", label: "진행 권한 관리 — 회의 생성자", group: "운영 — 회의" },
  { id: "OPS-MEET-05A", label: "진행 중 회의 — 일반 참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-05B", label: "진행 중 회의 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-06A", label: "정리 중 회의 — 일반 참가자", group: "운영 — 회의" },
  { id: "OPS-MEET-06B", label: "회의록 정리 — 진행 권한자", group: "운영 — 회의" },
  { id: "OPS-MEET-07", label: "완료 회의록 — 참석자", group: "운영 — 회의" },
  { id: "OPS-MEET-08", label: "회의 요약 확인 — 불참자", group: "운영 — 회의" },
  { id: "OPS-MEET-09", label: "취소된 회의 상세", group: "운영 — 회의" },
  { id: "OPS-MEET-D01", label: "회의 시작 확인", group: "운영 — 회의 · 확인 모달" },
  { id: "OPS-MEET-D02", label: "회의 종료 확인", group: "운영 — 회의 · 확인 모달" },
  { id: "OPS-MEET-D03", label: "진행 권한 부여 확인", group: "운영 — 회의 · 확인 모달" },
  { id: "OPS-MEET-D04", label: "회의 취소 확인", group: "운영 — 회의 · 확인 모달" },
  { id: "EVT-00A", label: "행사 목록 — 일반 구성원", group: "운영 — 행사 · 목록·개요" },
  { id: "EVT-00A2", label: "행사 목록 — 운영진", group: "운영 — 행사 · 목록·개요" },
  { id: "EVT-00B", label: "새 행사 만들기 모달", group: "운영 — 행사 · 목록·개요" },
  { id: "EVT-02", label: "행사 개요 — 기획 중", group: "운영 — 행사 · 목록·개요" },
  { id: "EVT-02B", label: "행사 정보 편집 패널", group: "운영 — 행사 · 목록·개요" },
  { id: "EVT-02C", label: "행사 종료 확인 모달", group: "운영 — 행사 · 목록·개요" },
  { id: "EVT-02D", label: "행사 개요 — 후속 정리 중", group: "운영 — 행사 · 목록·개요" },
  { id: "EVT-02E", label: "행사 완료 처리 확인 모달", group: "운영 — 행사 · 목록·개요" },
  { id: "EVT-TASK-01", label: "행사 업무 — 칸반 보드", group: "운영 — 행사 · 협업(업무·문서·회의·일정)" },
  { id: "EVT-TASK-02", label: "업무 상세 — 관련 문서·결과물", group: "운영 — 행사 · 협업(업무·문서·회의·일정)" },
  { id: "EVT-DOC-01", label: "행사 문서", group: "운영 — 행사 · 협업(업무·문서·회의·일정)" },
  { id: "EVT-MEET-01", label: "행사 관련 회의", group: "운영 — 행사 · 협업(업무·문서·회의·일정)" },
  { id: "EVT-SCHED-01", label: "행사 일정", group: "운영 — 행사 · 협업(업무·문서·회의·일정)" },
  { id: "EVT-03C", label: "운영 조직 — 빈 상태", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-01", label: "행사 운영 조직 설정", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-03A", label: "운영 조직 — 보기", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-03B", label: "운영 조직 — 수정", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-04C", label: "행사 참가자 — 빈 상태", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-04", label: "행사 참가자 명단", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-04B", label: "QR 참석 확인 모달", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-05", label: "참여 설문 생성·관리", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-05B", label: "기존 설문 교체 모달", group: "운영 — 행사 · 인원·설문" },
  { id: "EVT-FIN-01", label: "행사 재정 — 개요 · 일반 구성원", group: "운영 — 행사 · 재정" },
  { id: "EVT-FIN-01B", label: "행사 재정 — 개요 · 재정부", group: "운영 — 행사 · 재정" },
  { id: "MY-REQ-01", label: "내 구매 요청 — 행사 재정", group: "운영 — 행사 · 재정" },
  { id: "FIN-REQ-01B", label: "구매 요청 작성·수정 — 홍보부 부서장", group: "운영 — 행사 · 재정" },
  { id: "FIN-REQ-02", label: "구매 요청 상세·진행 상태", group: "운영 — 행사 · 재정" },
  { id: "FIN-SUP-01B", label: "보완 요청 확인·재제출 — 홍보부 부서장", group: "운영 — 행사 · 재정" },
  { id: "FIN-REV-01", label: "구매 요청 검토", group: "운영 — 행사 · 재정" },
  { id: "FIN-REV-01B", label: "구매 요청 재검토 — 보완 재제출", group: "운영 — 행사 · 재정" },
  { id: "FIN-PROC-01", label: "구매·발주 처리", group: "운영 — 행사 · 재정" },
  { id: "FIN-EVID-01", label: "결제·증빙 정리", group: "운영 — 행사 · 재정" },
  { id: "OPS-CAL-01", label: "캘린더 — 월간 일정", group: "운영 — 캘린더" },
  { id: "FIN-00", label: "전체 재정 현황", group: "재정 (전체)" },
  { id: "FIN-00B", label: "전체 재정 현황 — 재정부", group: "재정 (전체)" },
  { id: "FIN-LEDGER-01", label: "사용 내역", group: "재정 (전체)" },
  { id: "REC-01", label: "완료된 행사 목록", group: "기록" },
  { id: "REC-02", label: "행사 아카이브 상세", group: "기록" },
  { id: "REC-02A", label: "아카이브 작성·검토", group: "기록" },
  { id: "ORG-00", label: "조직 관리 홈", group: "조직 관리" },
  { id: "ORG-03A", label: "조직 관리 — 보기", group: "조직 관리" },
  { id: "ORG-03B", label: "조직 관리 — 수정", group: "조직 관리" },
  { id: "ORG-03C", label: "구성원 초대 패널", group: "조직 관리" },
  { id: "ORG-07A", label: "학생 명단 관리", group: "조직 관리" },
  { id: "ORG-07B", label: "학생 명단 업로드·갱신 모달", group: "조직 관리" },
  { id: "ORG-07C", label: "학생회비 납부 명단 업로드 모달", group: "조직 관리" },
  { id: "ORG-04", label: "역할 및 권한", group: "조직 관리" },
  { id: "ORG-04B", label: "역할 및 권한 관리 — 회장단", group: "조직 관리" },
  { id: "MSG-01", label: "메시지 — 방 목록·시작 전", group: "메시지" },
  { id: "MSG-02", label: "새 메시지 방 만들기", group: "메시지" },
  { id: "MSG-03", label: "대화 화면", group: "메시지" },
  { id: "EXT-02A", label: "외부 참여 설문", group: "외부 참여", mobile: true },
  { id: "EXT-02B", label: "참여 신청 완료", group: "외부 참여", mobile: true },
  { id: "EXT-02C", label: "설문 예외·종료 상태", group: "외부 참여", mobile: true },
  { id: "EXT-01A", label: "QR 참석 확인", group: "외부 참여", mobile: true },
  { id: "EXT-01B", label: "참석 확인 결과", group: "외부 참여", mobile: true },
];

// ─── Shared Event State ───────────────────────────────────────────────────────

type FeeType = "무료" | "정액 유료" | "학생회비 조건부" | "미정";
type CapacityType = "제한없음" | "인원제한" | "미정";
type SurveyStatus = "미생성" | "초안" | "활성" | "종료" | "교체됨";
type RecruitMethod = "선착순" | "관리자승인";

type FinanceStatus = "검토 대기" | "재검토 대기" | "승인" | "보완 요청" | "반려" | "구매 필요" | "증빙 필요" | "정산 완료" | "요청 취소";
type PurchaseOrderStatus = "해당 없음" | "주문 대기" | "주문 완료" | "구매 불가" | "주문 취소";
type PurchaseFulfillmentStatus = "해당 없음" | "배송 대기" | "배송 중" | "수령 확인 필요" | "수령 완료" | "이행 대기" | "이행 중" | "반납 확인 필요" | "이행 완료";
type PurchaseEvidenceStatus = "해당 없음" | "증빙 필요" | "증빙 정리 중" | "증빙 완료";

// ─── 구매 실행분 모델 (공식문서 2.1~2.3, 실행분 전면 도입) ──────────────────
// 실행분: 주문·수령/이행·증빙·환불의 원본 단위. 품목:실행분 = 1:1로 시작한다.
// 실행분이 2개 이상이 되는 경우: (1) 주문 취소 후 재주문, (2) 주문 단계의 부분 주문(일부 수량만 주문 완료 + 남은 수량 새 주문 대기)으로 분할. 부분 수령·부분 반환에 따른 분할은 보류(8.2·15장).
type ExecutionOrderStatus = "주문 대기" | "주문 완료" | "구매 불가" | "주문 취소";
type ExecutionReceiptStatus = "해당 없음" | "배송 대기" | "배송 중" | "수령 확인 필요" | "수령 완료";
// 대여·용역 이행: 대여는 이행 중(대여·사용) 후 반납 확인 필요를 거쳐 이행 완료(반납·회수 완료), 용역은 반납이 없어 이 단계를 건너뛴다.
type ExecutionServiceStatus = "해당 없음" | "이행 대기" | "이행 중" | "반납 확인 필요" | "이행 완료";
type ExecutionEvidenceStatus = "해당 없음" | "증빙 필요" | "증빙 정리 중" | "증빙 완료";
type RefundResult = "미확정" | "전액 환불" | "일부 환불" | "환불 없음";

// 구매 승인 묶음: 한 요청에서 같은 시점에 구매 진행이 허용된 승인 품목의 묶음 (생성 후 구성 불변)
type ApprovalBundle = {
  id: string;
  requestId: string;
  itemIds: number[];
  createdAt: string;
  withdrawn?: boolean; // 주문 전 전체 철회 (철회됨)
};

// 증빙 묶음: 구매처·결제·영수증 기준으로 실행분을 재구성해 정리한 단위. 완료 후 다시 열람할 수 있는 레코드로 저장한다.
// (요청·승인 묶음과 무관하게 실제 거래가 같으면 함께 묶이므로, 증빙 아카이브는 요청 단위가 아닌 별도 레코드로 보관한다.)
type EvidenceBundle = {
  id: string;
  eventId: string;
  vendor: string;
  method: string;
  receiptNo?: string;
  actualAmount: number;
  completedAt: string;
  completedBy: string;
  executions: { execId: string; requestId: string; itemName: string; amount: number }[];
};

// 증빙 묶음 임시 저장(초안): 완료 전 작성 중인 증빙 묶음. 담긴 실행분은 `증빙 정리 중`으로 표시된다. 행사당 하나로 관리한다.
type EvidenceDraft = {
  id: string;
  eventId: string;
  execIds: string[];
  vendor: string;
  method: string;
  receiptNo: string;
  actualAmount: string;
  checks: Record<string, boolean>;
  savedAt: string;
};

type PurchaseExecution = {
  id: string;
  itemId: number;
  quantity?: number;              // 이 실행분이 담당하는 수량. 없으면 품목 전체 수량(부분 주문 분할 시에만 명시)
  approvalBundleId?: string;
  orderStatus: ExecutionOrderStatus;
  receiptStatus: ExecutionReceiptStatus;   // 물품·제작물
  serviceStatus: ExecutionServiceStatus;   // 대여·용역
  evidenceStatus: ExecutionEvidenceStatus;
  paid?: boolean;                 // 결제 여부 (주문 취소 후속 계산용)
  refundResult?: RefundResult;    // 환불 결과 (환불 대기/확인은 이 값에서 계산)
  cancelNetSpend?: number;        // 취소 순지출액
  reorderOfExecutionId?: string;  // 이 실행분이 재주문한 원래 취소 실행분
  reorderDeclined?: boolean;      // 취소 실행분을 재주문하지 않기로 종결(재주문 판단 종료)
  receiptIssue?: boolean;         // 수령 문제 있음 (보조 표시)
  returned?: boolean;             // 수령 완료 후 물품 반환 기록 (환불 추적)
  cancelRequested?: boolean;      // 요청자의 주문 취소 요청(재정부 확정 대기)
  cancelReason?: string;          // 주문 취소 요청 사유
};

type PurchaseItem = {
  id: number;
  name: string;
  category: string;
  budgetLine: string;
  purchaseType: "일반 구매" | "제작·인쇄" | "대여" | "용역";
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotalPrice: number;
  status: "검토 대기" | "승인" | "보완 요청" | "반려" | "요청 취소";
  orderStatus?: PurchaseOrderStatus;
  fulfillmentStatus?: PurchaseFulfillmentStatus;
  evidenceStatus?: PurchaseEvidenceStatus;
  // 실행분 전면 도입 마이그레이션용. 있으면 실행분 기반으로 계산하고, 없으면 위 필드에서 실행분 1개를 파생한다.
  executions?: PurchaseExecution[];
  agreedForPurchase?: boolean; // 승인 후 구매 진행 동의(선진행 동의) 완료 여부. false면 동의 대기, 미설정/true면 진행.
  expectedDate?: string;
  financeOwner?: string;
  priceEvidence?: string;
  supplementReason?: string;
  rejectionReason?: string;
  requestCancelReason?: string; // 요청자가 품목을 주문 전 취소한 사유
  details: any;
};

type PurchaseSupplementFieldChange = {
  label: string;
  before: string;
  after: string;
};

type PurchaseSupplementItemSubmission = {
  itemId: number;
  itemName: string;
  reason: string;
  fields: PurchaseSupplementFieldChange[];
  beforeAttachments: string[];
  afterAttachments: string[];
};

type PurchaseSupplementSubmission = {
  id: string;
  requestedAt: string;
  requestedBy: string;
  submittedAt: string;
  submittedBy: string;
  items: PurchaseSupplementItemSubmission[];
};

type PurchaseRequest = {
  id: string;
  // 소유 행사의 안정적 식별자. 행사 재정은 이 값으로 필터링하며 행사명 문자열로 연결하지 않는다.
  eventId: string;
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
  supplementSubmissions?: PurchaseSupplementSubmission[];
  approvalBundles?: ApprovalBundle[];
  orderCompletedBy?: string;
  actualAmount?: number;
};

type GeneralPurchaseProgress = "검토 중" | "보완 필요" | "보완 중" | "구매 진행 동의 대기" | "구매 준비" | "주문 완료" | "배송 중" | "이행 중" | "수령 완료" | "이행 완료" | "정산 중" | "처리 완료" | "반려" | "구매 불가" | "주문 취소" | "요청 취소";
type FinancePurchaseProgress = "검토 대기" | "보완 응답 대기" | "재검토 대기" | "선진행 동의 대기" | "주문 대기" | "재주문 보류" | "재주문 판단" | "주문 완료" | "배송 대기" | "배송 중" | "이행 대기" | "이행 중" | "반납 확인 필요" | "주문 취소 요청 확인" | "수령 확인 필요" | "환불 대기" | "환불 확인" | "증빙 필요" | "증빙 정리 중" | "정산 완료" | "구매 불가 처리 필요" | "주문 취소" | "반려" | "요청 취소";

function getGeneralPurchaseProgress(request: PurchaseRequest, item: PurchaseItem, currentUserName: string): GeneralPurchaseProgress {
  if (request.status === "요청 취소" || item.status === "요청 취소") return "요청 취소";
  if (item.orderStatus === "구매 불가") return "구매 불가";
  if (item.orderStatus === "주문 취소") return "주문 취소";
  if (item.status === "반려" || request.status === "반려") return "반려";
  if (item.status === "보완 요청") return request.requester === currentUserName ? "보완 필요" : "보완 중"; // 품목 단위. 요청에 보완 품목이 섞여도 승인 품목은 각자 진행
  if (item.status !== "승인") return "검토 중";
  if (item.agreedForPurchase === false) return "구매 진행 동의 대기";
  if (item.evidenceStatus === "증빙 완료" || request.status === "정산 완료") return "처리 완료";
  if (item.evidenceStatus === "증빙 필요" || item.evidenceStatus === "증빙 정리 중" || request.status === "증빙 필요") return "정산 중";
  if (item.fulfillmentStatus === "수령 완료") return "수령 완료";
  if (item.fulfillmentStatus === "이행 완료") return "이행 완료";
  if (["배송 중", "수령 확인 필요"].includes(item.fulfillmentStatus ?? "")) return "배송 중";
  if (["이행 중", "반납 확인 필요"].includes(item.fulfillmentStatus ?? "")) return "이행 중";
  if (item.orderStatus === "주문 완료") return "주문 완료";
  return "구매 준비";
}

function getFinancePurchaseProgress(request: PurchaseRequest, item: PurchaseItem): FinancePurchaseProgress {
  if (request.status === "요청 취소" || item.status === "요청 취소") return "요청 취소";
  if (item.orderStatus === "구매 불가") return "구매 불가 처리 필요";
  if (item.orderStatus === "주문 취소") return "주문 취소";
  if (item.status === "반려" || request.status === "반려") return "반려";
  if (item.status === "보완 요청") return "보완 응답 대기"; // 품목 단위. 보완 품목만 여기로, 같은 요청의 승인 품목은 아래에서 선진행 동의 대기로 계산
  if (request.status === "재검토 대기" && item.status !== "승인") return "재검토 대기";
  if (item.status !== "승인") return "검토 대기"; // 검토는 대기 → 결정(승인/보완/반려) 단발. 별도 '검토 중' 단계는 두지 않음(financeOwner는 담당 표시용)
  if (item.agreedForPurchase === false) return "선진행 동의 대기";
  if (item.evidenceStatus === "증빙 완료" || request.status === "정산 완료") return "정산 완료";
  if (item.evidenceStatus === "증빙 정리 중") return "증빙 정리 중";
  if (item.evidenceStatus === "증빙 필요" || request.status === "증빙 필요" || item.fulfillmentStatus === "수령 완료" || item.fulfillmentStatus === "이행 완료") return "증빙 필요";
  if (item.fulfillmentStatus === "수령 확인 필요") return "수령 확인 필요";
  if (item.fulfillmentStatus === "배송 중") return "배송 중";
  if (item.fulfillmentStatus === "반납 확인 필요") return "반납 확인 필요";
  if (item.fulfillmentStatus === "이행 중") return "이행 중";
  if (item.fulfillmentStatus === "이행 대기") return "이행 대기";
  if (item.fulfillmentStatus === "배송 대기") return "배송 대기";
  if (item.orderStatus === "주문 완료") return "주문 완료";
  return "주문 대기";
}

// 실행분 파생 (마이그레이션): item.executions가 있으면 그대로 사용하고,
// 없으면 승인된 품목의 현재 원본 필드에서 초기 실행분 1개를 만든다. (품목:실행분 = 1:1)
function getExecutions(item: PurchaseItem): PurchaseExecution[] {
  if (item.executions && item.executions.length > 0) return item.executions;
  if (item.status !== "승인") return [];
  if (item.agreedForPurchase === false) return []; // 구매 진행 동의(선진행 동의) 전에는 실행분이 없다
  const f = item.fulfillmentStatus ?? "해당 없음";
  const receiptStatus: ExecutionReceiptStatus = ["배송 대기", "배송 중", "수령 확인 필요", "수령 완료"].includes(f) ? (f as ExecutionReceiptStatus) : "해당 없음";
  const serviceStatus: ExecutionServiceStatus = ["이행 대기", "이행 중", "반납 확인 필요", "이행 완료"].includes(f) ? (f as ExecutionServiceStatus) : "해당 없음";
  const orderStatus: ExecutionOrderStatus = item.orderStatus && item.orderStatus !== "해당 없음" ? (item.orderStatus as ExecutionOrderStatus) : "주문 대기";
  return [{
    id: `${item.id}-EX1`,
    itemId: item.id,
    orderStatus,
    receiptStatus,
    serviceStatus,
    evidenceStatus: (item.evidenceStatus ?? "해당 없음") as ExecutionEvidenceStatus,
  }];
}

// 실행분 단위 대표 진행 상태(일반 사용자) — 품목이 승인되어 실행분이 생긴 뒤의 계산
function getGeneralProgressForExecution(ex: PurchaseExecution): GeneralPurchaseProgress {
  if (ex.orderStatus === "구매 불가") return "구매 불가";
  if (ex.orderStatus === "주문 취소") return "주문 취소";
  if (ex.evidenceStatus === "증빙 완료") return "처리 완료";
  if (ex.evidenceStatus === "증빙 필요" || ex.evidenceStatus === "증빙 정리 중") return "정산 중";
  if (ex.receiptStatus === "수령 완료") return "수령 완료";
  if (ex.serviceStatus === "이행 완료") return "이행 완료";
  if (ex.receiptStatus === "배송 중" || ex.receiptStatus === "수령 확인 필요") return "배송 중";
  if (ex.serviceStatus === "이행 중" || ex.serviceStatus === "반납 확인 필요") return "이행 중";
  if (ex.orderStatus === "주문 완료") return "주문 완료";
  return "구매 준비";
}

// 실행분 단위 재정부 처리 단계 — 다음 미완료 업무를 계산 (환불·재주문 포함)
function getFinanceStageForExecution(ex: PurchaseExecution, siblings: PurchaseExecution[]): FinancePurchaseProgress {
  // 물품 반환: 반환의 환불 결과가 미확정이면 환불 대기(주문 취소와 같은 환불 계산을 재사용, 8.11)
  if (ex.returned && (ex.refundResult ?? "미확정") === "미확정") return "환불 대기";
  // 주문 취소 실행분: 환불·취소 비용 증빙·재주문 후속 업무를 계산 (원본 주문 취소는 처리 단계명으로 쓰지 않음)
  if (ex.orderStatus === "주문 취소") {
    if (ex.paid && (ex.refundResult ?? "미확정") === "미확정") return "환불 대기";
    if (ex.evidenceStatus === "증빙 정리 중") return "증빙 정리 중";
    if (ex.evidenceStatus === "증빙 필요") return "증빙 필요";
    // 환불·증빙 정리 완료 후, 재주문했거나(재주문 실행분 존재) 재주문 안 함으로 종결하면 활성 처리에서 제외한다.
    if (siblings.some(e => e.reorderOfExecutionId === ex.id) || ex.reorderDeclined) return "정산 완료";
    return "재주문 판단";
  }
  // 재주문 실행분: 원래 취소 실행분의 환불·증빙 차단 조건이 남아 있으면 재주문 보류
  if (ex.reorderOfExecutionId && ex.orderStatus === "주문 대기") {
    const origin = siblings.find(e => e.id === ex.reorderOfExecutionId);
    const blocked = !!origin && ((origin.paid && (origin.refundResult ?? "미확정") === "미확정") || origin.evidenceStatus === "증빙 필요" || origin.evidenceStatus === "증빙 정리 중");
    if (blocked) return "재주문 보류";
  }
  if (ex.orderStatus === "구매 불가") return "구매 불가 처리 필요";
  if (ex.evidenceStatus === "증빙 완료") return "정산 완료";
  if (ex.evidenceStatus === "증빙 정리 중") return "증빙 정리 중";
  if (ex.evidenceStatus === "증빙 필요" || ex.receiptStatus === "수령 완료" || ex.serviceStatus === "이행 완료") return "증빙 필요";
  if (ex.receiptStatus === "수령 확인 필요") return "수령 확인 필요";
  // 요청자의 유효한 주문 취소 요청은 기존 배송 대기·배송 중·이행 대기·이행 중보다 우선한다(기준 문서 11.3). 외부 취소가 성립하면 orderStatus가 "주문 취소"로 바뀌어 위에서 처리된다.
  if (ex.cancelRequested) return "주문 취소 요청 확인";
  if (ex.receiptStatus === "배송 중") return "배송 중";
  if (ex.serviceStatus === "반납 확인 필요") return "반납 확인 필요";
  if (ex.serviceStatus === "이행 중") return "이행 중";
  if (ex.serviceStatus === "이행 대기") return "이행 대기";
  if (ex.receiptStatus === "배송 대기") return "배송 대기";
  if (ex.orderStatus === "주문 완료") return "주문 완료";
  return "주문 대기";
}

// ── 실행분 상태 전환 공용 헬퍼 ──
// EVT-FIN 처리 단계 보드의 '빠른 처리 팝오버'에서 쓴다. 전환 규칙은 FIN-PROC-01의 동명 핸들러와 동일하게 유지한다(수정 시 함께 반영).
type SetPurchaseRequests = React.Dispatch<React.SetStateAction<PurchaseRequest[]>>;
function mutateExecution(setPR: SetPurchaseRequests, requestId: string, itemId: number, execId: string, action: string, fn: (ex: PurchaseExecution) => PurchaseExecution) {
  setPR(previous => previous.map(r => r.id !== requestId ? r : {
    ...r,
    items: r.items.map(it => it.id !== itemId ? it : { ...it, executions: getExecutions({ ...it, status: "승인" }).map(ex => ex.id === execId ? fn(ex) : ex) }),
    history: [...r.history, { date: "2026-08-01 10:10", action, user: "김민준" }],
  }));
}
function execOrder(setPR: SetPurchaseRequests, requestId: string, item: PurchaseItem, execId: string) {
  const isService = item.purchaseType === "대여" || item.purchaseType === "용역";
  mutateExecution(setPR, requestId, item.id, execId, "주문 완료", ex => ({ ...ex, orderStatus: "주문 완료", receiptStatus: (isService ? "해당 없음" : "배송 대기") as ExecutionReceiptStatus, serviceStatus: (isService ? "이행 대기" : "해당 없음") as ExecutionServiceStatus }));
}
// 실행분이 여러 개(부분 주문 분할·재주문)인 품목에서 실행분 순번(1-based). 1개뿐이면 null(넘버링 없음).
function execSeq(item: PurchaseItem, ex: PurchaseExecution): number | null {
  const execs = getExecutions(item);
  if (execs.length <= 1) return null;
  const i = execs.findIndex(e => e.id === ex.id);
  return i >= 0 ? i + 1 : null;
}
// 실행분이 담당하는 수량과 금액(수량 미지정이면 품목 전체 수량 기준)
function execQuantityOf(item: PurchaseItem, ex: PurchaseExecution): number { return ex.quantity ?? item.quantity; }
function execAmountOf(item: PurchaseItem, ex: PurchaseExecution): number { return execQuantityOf(item, ex) * item.estimatedUnitPrice; }
// 부분 주문: 주문 대기 실행분을 지정 수량만 주문 완료로 전환하고, 남은 수량은 새 주문 대기 실행분으로 분할한다.
function execOrderQty(setPR: SetPurchaseRequests, requestId: string, item: PurchaseItem, execId: string, orderQty: number) {
  const isService = item.purchaseType === "대여" || item.purchaseType === "용역";
  const execs0 = getExecutions({ ...item, status: "승인" });
  const targetQty = execs0.find(e => e.id === execId)?.quantity ?? item.quantity;
  const q = Math.min(Math.max(1, Math.round(orderQty || 0)), targetQty);
  setPR(previous => previous.map(r => {
    if (r.id !== requestId) return r;
    return {
      ...r,
      items: r.items.map(it => {
        if (it.id !== item.id) return it;
        const execs = getExecutions({ ...it, status: "승인" });
        const ordered = execs.map(ex => ex.id === execId ? { ...ex, quantity: q, orderStatus: "주문 완료" as ExecutionOrderStatus, receiptStatus: (isService ? "해당 없음" : "배송 대기") as ExecutionReceiptStatus, serviceStatus: (isService ? "이행 대기" : "해당 없음") as ExecutionServiceStatus } : ex);
        if (q >= targetQty) return { ...it, executions: ordered };
        const newExec: PurchaseExecution = { id: `${it.id}-P${execs.length + 1}`, itemId: it.id, quantity: targetQty - q, orderStatus: "주문 대기", receiptStatus: "해당 없음", serviceStatus: "해당 없음", evidenceStatus: "해당 없음" };
        return { ...it, executions: [...ordered, newExec] };
      }),
      history: [...r.history, { date: "2026-08-01 10:00", action: q >= targetQty ? `주문 완료 · ${item.name} ${q}${item.unit}` : `부분 주문 · ${item.name} ${q}/${targetQty}${item.unit} (남은 ${targetQty - q}${item.unit} 주문 대기)`, user: "김민준" }],
    };
  }));
}
function execMarkOutOfStock(setPR: SetPurchaseRequests, requestId: string, item: PurchaseItem, execId: string) {
  mutateExecution(setPR, requestId, item.id, execId, "구매 불가(품절) 처리", ex => ({ ...ex, orderStatus: "구매 불가" }));
}
function execAdvanceFulfillment(setPR: SetPurchaseRequests, requestId: string, item: PurchaseItem, execId: string) {
  const isRental = item.purchaseType === "대여"; // 용역은 반납 단계를 건너뛴다
  mutateExecution(setPR, requestId, item.id, execId, "배송·수령·이행 단계 진행", ex => {
    if (ex.serviceStatus !== "해당 없음") {
      const next = (ex.serviceStatus === "이행 대기" ? "이행 중" : ex.serviceStatus === "이행 중" ? (isRental ? "반납 확인 필요" : "이행 완료") : "이행 완료") as ExecutionServiceStatus;
      return { ...ex, serviceStatus: next, evidenceStatus: next === "이행 완료" ? "증빙 필요" as ExecutionEvidenceStatus : ex.evidenceStatus };
    }
    const next = (ex.receiptStatus === "배송 대기" ? "배송 중" : ex.receiptStatus === "배송 중" ? "수령 확인 필요" : "수령 완료") as ExecutionReceiptStatus;
    return { ...ex, receiptStatus: next, receiptIssue: next === "수령 완료" ? false : ex.receiptIssue, evidenceStatus: next === "수령 완료" ? "증빙 필요" as ExecutionEvidenceStatus : ex.evidenceStatus };
  });
}
function execConfirmCancel(setPR: SetPurchaseRequests, requestId: string, item: PurchaseItem, execId: string) {
  mutateExecution(setPR, requestId, item.id, execId, "주문 취소 처리", ex => ({ ...ex, orderStatus: "주문 취소", paid: true, refundResult: "미확정", cancelRequested: false }));
}
function execConfirmRefund(setPR: SetPurchaseRequests, requestId: string, item: PurchaseItem, execId: string, result: RefundResult) {
  mutateExecution(setPR, requestId, item.id, execId, `환불 확인 · ${result}`, ex => ({ ...ex, refundResult: result, evidenceStatus: (result !== "전액 환불" || ex.returned) ? "증빙 필요" as ExecutionEvidenceStatus : ex.evidenceStatus }));
}
// 재주문 실행분 생성: 취소 실행분을 원본으로 하는 새 주문 대기 실행분을 만든다.
function execReorder(setPR: SetPurchaseRequests, requestId: string, item: PurchaseItem, execId: string) {
  setPR(previous => previous.map(r => r.id !== requestId ? r : {
    ...r,
    items: r.items.map(it => {
      if (it.id !== item.id) return it;
      const execs = getExecutions({ ...it, status: "승인" });
      const newEx: PurchaseExecution = { id: `${it.id}-RE${execs.length + 1}`, itemId: it.id, orderStatus: "주문 대기", receiptStatus: "해당 없음", serviceStatus: "해당 없음", evidenceStatus: "해당 없음", reorderOfExecutionId: execId };
      return { ...it, executions: [...execs, newEx] };
    }),
    history: [...r.history, { date: "2026-08-01 10:00", action: `재주문 실행분 생성 · ${item.name}`, user: "김민준" }],
  }));
}
// 재주문 안 함: 취소 실행분의 재주문 판단을 종결해 활성 처리에서 제외한다.
function execDeclineReorder(setPR: SetPurchaseRequests, requestId: string, item: PurchaseItem, execId: string) {
  mutateExecution(setPR, requestId, item.id, execId, `재주문 안 함 · ${item.name}`, ex => ({ ...ex, reorderDeclined: true }));
}
// 선진행 동의(구매 진행 동의): 승인 품목을 구매 승인 묶음에 넣어 주문 대기로 진행시킨다. 부분 승인에서 남은 보완 품목과 함께 대기하던 승인 품목을 진행할 때 쓴다.
function execAgree(setPR: SetPurchaseRequests, requestId: string, itemId: number) {
  setPR(previous => previous.map(r => r.id !== requestId ? r : {
    ...r,
    items: r.items.map(it => it.id === itemId && it.status === "승인" ? { ...it, agreedForPurchase: true } : it),
    history: [...r.history, { date: "2026-08-01 09:50", action: "구매 진행 동의 처리 · 구매 승인 묶음 생성", user: "김민준" }],
  }));
}
// 대여·용역 다음 단계 라벨(대여는 반납 확인 필요를 거침).
function nextFulfillLabel(ex: PurchaseExecution, isRental: boolean) {
  if (ex.serviceStatus !== "해당 없음") return ex.serviceStatus === "이행 대기" ? "이행 시작" : ex.serviceStatus === "이행 중" ? (isRental ? "반납 확인 요청" : "이행 완료 확인") : "반납 확인·이행 완료";
  return ex.receiptStatus === "배송 대기" ? "배송 시작" : ex.receiptStatus === "배송 중" ? "물품 도착" : "수령 확인";
}

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
  // 원본 행사의 안정적 식별자. 완료 기록 중복 판정은 행사명이 아니라 이 값으로 한다.
  eventId: string;
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

// 행사별 운영 조직. 기본 학생회 조직과 별개이며 행사 레코드에 저장된다.
type EventOrgMember = { name: string; dept: string; grade: string };
type EventOrgTeam = { name: string; leader?: string; members: EventOrgMember[] };
type EventOrganization = {
  leader: string;        // 행사 책임자 이름
  leaderDept: string;
  leaderGrade: string;
  mode: "import" | "select" | "empty";
  teams: EventOrgTeam[];
};

// 행사 워크스페이스의 단일 기준. 행사명은 EventInfo.name에서 수정될 수 있으므로
// 식별·중복 판정에는 변하지 않는 id만 사용한다.
type EventRecord = {
  id: string;
  info: EventInfo;
  lifecycle: EventLifecycle;
  tasks: EventTask[];
  surveySettings: SurveySettings;
  createdAt: string;
  // 행사별 운영 조직. 저장 전에는 undefined이며, EVT-03A는 이 값 유무로 빈 상태를 판정한다.
  organization?: EventOrganization;
  // 행사 목록 카드 표시용 보조값. 핵심 데이터로 파생하기 어려운 표시 문구만 담는다.
  listMeta: { updatedAt: string; highlights: string[]; followUpItems?: string };
};

type CreatedMeeting = {
  id: string;
  // 행사 관련 회의의 소유 행사 식별자. 관련 회의 탭은 이 값으로 필터링한다(행사명 대신).
  eventId?: string;
  group: string;
  name: string;
  status: "예정" | "진행 중" | "정리 중" | "완료" | "취소";
  time: string;
  place: string;
  owner: string;
  participants: number;
  agendas: number;
  docStatus: "작성 전" | "작성 중" | "정리 필요" | "정리 완료" | "취소됨";
  // 비공개 회의는 선정된 참가자(participantNames)와 생성자에게만 목록에 노출한다.
  visibility: "public" | "private";
  // 진행 방식. 혼합은 현장 참석과 온라인 접속을 함께 제공한다.
  mode: MeetingMode;
  onlineLink?: string;
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

function getCreatedMeetingScreen(
  meeting: CreatedMeeting,
  currentUser: { name: string }
) {
  const isOwner = meeting.owner === currentUser.name;
  const canFacilitate = isOwner || meeting.facilitatorNames.includes(currentUser.name);

  if (meeting.status === "예정") return isOwner ? "OPS-MEET-03B" : canFacilitate ? "OPS-MEET-03C" : "OPS-MEET-03A";
  if (meeting.status === "진행 중") return canFacilitate ? "OPS-MEET-05B" : "OPS-MEET-05A";
  if (meeting.status === "정리 중") return canFacilitate ? "OPS-MEET-06B" : "OPS-MEET-06A";
  if (meeting.status === "완료") return meeting.attendance[currentUser.name]?.joinedAt ? "OPS-MEET-07" : "OPS-MEET-08";
  return "OPS-MEET-09";
}

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

type MeetingMode = "오프라인" | "온라인" | "혼합";

type MeetingDraft = {
  meetingType: "regular" | "event";
  form: { event: string; name: string; date: string; time: string; place: string };
  purpose: string;
  isPrivate?: boolean;
  mode?: MeetingMode;
  onlineLink?: string;
  savedAt: string;
};

type OrganizationRole = "회장단" | "부서장" | "부원";
// 기본 역할(회장단·부서장·부원)과 별개인 행사별 맥락 역할. 선택한 행사에서만 의미가 있다.
type EventContextRole = "행사 운영 조직 관리자" | "행사 운영 조직 구성원";
type OrganizationMemberRole = {
  name: string;
  dept: string;
  role: OrganizationRole;
};

type DemoDataMode = "default" | "first-use";

// 메시지 방: 조직도(부서)와 개별 구성원을 함께 선택해 만든다.
// scope는 `일반` 또는 행사명이며, 방 목록을 묶는 분류로만 쓴다.
// 백엔드가 없으므로 첨부는 파일명과 용량만 기록한다. 실제 업로드·보관은 하지 않는다.
// 이미지에 한해 브라우저 로컬 미리보기 URL을 만들어 썸네일을 보여준다.
type ChatAttachment = {
  name: string;
  size: string;
  previewUrl?: string;
};

type ChatMessage = {
  id: string;
  sender: string;      // "system"이면 안내 문구로 표시한다
  text: string;
  at: string;
  attachments?: ChatAttachment[];
};

type MessageRoom = {
  id: string;
  name: string;
  scope: string;
  depts: string[];
  members: string[];
  createdBy: string;
  createdAt: string;
  messages: ChatMessage[];
  unreadCount: number;
};

const DEFAULT_ORGANIZATION_MEMBER_ROLES: OrganizationMemberRole[] = [
  { name: "김바다", dept: "학술체육부", role: "회장단" },
  { name: "이수현", dept: "기획부", role: "부서장" },
  { name: "이윤슬", dept: "홍보부", role: "부원" },
  { name: "김민석", dept: "홍보부", role: "부서장" },
  { name: "김민준", dept: "재정부", role: "부서장" },
  { name: "박해랑", dept: "운영부", role: "부서장" },
  { name: "정하늘", dept: "운영부", role: "부원" },
  { name: "박민수", dept: "기획부", role: "부원" },
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatClockTime(date: Date) {
  const hours = date.getHours();
  const period = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${displayHour}:${String(date.getMinutes()).padStart(2, "0")}`;
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
  "김민석": "홍보부",
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

// 세부 데이터가 아직 없는 행사의 기본정보. 다른 행사 수치를 복사하지 않고 미정·빈 값으로 둔다.
const makeEmptyEventInfo = (name: string): EventInfo => ({
  name,
  intro: "",
  purpose: "",
  startAt: "",
  endAt: "",
  noEndTime: false,
  placeConfirmed: false,
  placeName: "",
  placeAddress: "",
  placeDetail: "",
  target: "",
  feeType: "미정",
  feeAmount: "",
  feePayment: "",
  feePaidAmount: "",
  feeUnpaidAmount: "",
  capacityType: "미정",
  capacityCount: "",
  dept: "",
  manager: "",
  contact: "",
  notice: "",
});

// 설문이 아직 없는 행사의 기본값. 상태는 미생성이며 신청 수치는 0이다.
const EMPTY_SURVEY_SETTINGS: SurveySettings = {
  startAt: "",
  endAt: "",
  method: "선착순",
  useWaiting: false,
  useHakbi: false,
  completionMsg: "",
  questions: [],
  status: "미생성",
  responseCount: 0,
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
  eventOrganization: EventOrganization | undefined;
  setEventOrganization: React.Dispatch<React.SetStateAction<EventOrganization | undefined>>;
  eventTasks: EventTask[];
  setEventTasks: React.Dispatch<React.SetStateAction<EventTask[]>>;
  recurringTasks: RecurringTask[];
  setRecurringTasks: React.Dispatch<React.SetStateAction<RecurringTask[]>>;
  createdMeetings: CreatedMeeting[];
  setCreatedMeetings: React.Dispatch<React.SetStateAction<CreatedMeeting[]>>;
  eventRecords: EventRecord[];
  setEventRecords: React.Dispatch<React.SetStateAction<EventRecord[]>>;
  selectedEventId: string;
  setSelectedEventId: React.Dispatch<React.SetStateAction<string>>;
  selectedCreatedMeetingId: string | null;
  setSelectedCreatedMeetingId: React.Dispatch<React.SetStateAction<string | null>>;
  // 진행 중 회의를 미참가자 자격으로 열람 참여했는지 여부. 참여 화면의 미참가자 표시에 쓴다.
  meetingJoinAsNonParticipant: boolean;
  setMeetingJoinAsNonParticipant: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRecurringTaskId: string | null;
  setSelectedRecurringTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedArchiveId: string | null;
  setSelectedArchiveId: React.Dispatch<React.SetStateAction<string | null>>;
  archives: ArchiveRecord[];
  setArchives: React.Dispatch<React.SetStateAction<ArchiveRecord[]>>;
  evidenceBundles: EvidenceBundle[];
  setEvidenceBundles: React.Dispatch<React.SetStateAction<EvidenceBundle[]>>;
  evidenceDrafts: EvidenceDraft[];
  setEvidenceDrafts: React.Dispatch<React.SetStateAction<EvidenceDraft[]>>;
  selectedEventTaskId: string | null;
  setSelectedEventTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  purchaseRequests: PurchaseRequest[];
  setPurchaseRequests: React.Dispatch<React.SetStateAction<PurchaseRequest[]>>;
  selectedPurchaseRequestId: string | null;
  setSelectedPurchaseRequestId: React.Dispatch<React.SetStateAction<string | null>>;
  meetingDraft: MeetingDraft | null;
  setMeetingDraft: React.Dispatch<React.SetStateAction<MeetingDraft | null>>;
  purchaseRequestDraft: PurchaseRequestDraft | null;
  setPurchaseRequestDraft: React.Dispatch<React.SetStateAction<PurchaseRequestDraft | null>>;
  purchaseSupplementDraft: PurchaseSupplementDraft | null;
  setPurchaseSupplementDraft: React.Dispatch<React.SetStateAction<PurchaseSupplementDraft | null>>;
  organizationMemberRoles: OrganizationMemberRole[];
  setOrganizationMemberRoles: React.Dispatch<React.SetStateAction<OrganizationMemberRole[]>>;
  messageRooms: MessageRoom[];
  setMessageRooms: React.Dispatch<React.SetStateAction<MessageRoom[]>>;
  selectedMessageRoomId: string | null;
  setSelectedMessageRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  demoDataMode: DemoDataMode;
  setDemoDataMode: React.Dispatch<React.SetStateAction<DemoDataMode>>;
  navigateTo: (screenId: string) => void;
  currentUser: { name: string; dept: string; role: string; eventRole?: EventContextRole };
  activeSidebar?: string;
};

// 대표 행사(체육대회) id. 와이어프레임 화면 목록에서 EVT-02를 직접 열 때의 기본 선택이며,
// 기존 체육대회 샘플 데이터(구매 요청·회의·문서·조직·참가자)의 소유 행사 식별자다.
const SPORTS_EVENT_ID = "EVT-SPORTS";

// 행사 예산 기본값(체육대회). FIN-REV의 예산 초과 판정과 EVT-FIN 예산 현황이 같은 기준을 쓴다.
const DEFAULT_BUDGET_LINES = [
  { name: "행사 운영비", allocated: 1500000, actual: 520000 },
  { name: "홍보비", allocated: 800000, actual: 260000 },
  { name: "식비", allocated: 700000, actual: 170000 },
];

const DEFAULT_PURCHASE_REQUESTS: PurchaseRequest[] = [
  {
    id: "REQ-001",
    eventId: SPORTS_EVENT_ID,
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
      { id: 1, name: "박스테이프", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 5, unit: "개", estimatedUnitPrice: 2000, estimatedTotalPrice: 10000, status: "검토 대기", priceEvidence: "다이소 온라인몰 상품 링크", details: {} },
      { id: 2, name: "생수 500ml", category: "식음료", budgetLine: "식비", purchaseType: "일반 구매", quantity: 10, unit: "박스", estimatedUnitPrice: 5000, estimatedTotalPrice: 50000, status: "검토 대기", priceEvidence: "마켓컬리 B2B 상품 정보", details: {} },
      { id: 3, name: "이름표 용지", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "제작·인쇄", quantity: 200, unit: "장", estimatedUnitPrice: 300, estimatedTotalPrice: 60000, status: "검토 대기", priceEvidence: "인쇄업체 A 견적서.pdf", details: {} },
      { id: 4, name: "유성 마커", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 10, unit: "개", estimatedUnitPrice: 1500, estimatedTotalPrice: 15000, status: "검토 대기", priceEvidence: "다이소 온라인몰 상품 링크", details: {} },
    ],
    history: [
      { date: "2026-03-01 10:00", action: "요청 생성", user: "박해랑" },
      { date: "2026-03-01 10:05", action: "제출", user: "박해랑" },
    ]
  },
  {
    id: "REQ-002",
    eventId: SPORTS_EVENT_ID,
    title: "현수막 A형 제작",
    event: "2026 소프트웨어융합대학 체육대회",
    dept: "홍보부",
    requester: "김민석",
    purpose: "행사장 메인 무대 설치",
    neededDate: "2026-03-14",
    priority: "긴급",
    totalEstimatedAmount: 180000,
    status: "보완 요청",
    items: [
      { id: 5, name: "메인 현수막", category: "제작·굿즈", budgetLine: "홍보비", purchaseType: "제작·인쇄", quantity: 1, unit: "개", estimatedUnitPrice: 180000, estimatedTotalPrice: 180000, status: "보완 요청", priceEvidence: "현수막 견적서.pdf", supplementReason: "규격과 인쇄 사양을 보완하고 업체 견적서를 다시 확인해 주세요.", details: { 규격: "500*90", 소재: "부직포" } },
    ],
    history: [
      { date: "2026-03-02 14:00", action: "요청 생성", user: "김민석" },
      { date: "2026-03-03 09:00", action: "보완 요청", user: "김바다" },
    ]
  },
  {
    // 실행분 모델 예시: 승인 후 주문 취소 → 재주문 실행분 생성으로 한 품목이 실행분 2개로 나뉜다.
    id: "REQ-003",
    eventId: SPORTS_EVENT_ID,
    title: "운영진 단체 티셔츠",
    event: "2026 소프트웨어융합대학 체육대회",
    dept: "홍보부",
    requester: "김민석",
    purpose: "운영진 식별용 단체 티셔츠 제작",
    neededDate: "2026-03-13",
    priority: "보통",
    totalEstimatedAmount: 120000,
    status: "구매 필요",
    items: [
      {
        id: 6, name: "운영 티셔츠", category: "제작·굿즈", budgetLine: "홍보비", purchaseType: "제작·인쇄",
        quantity: 30, unit: "장", estimatedUnitPrice: 4000, estimatedTotalPrice: 120000,
        status: "승인", financeOwner: "김민준", priceEvidence: "티셔츠 견적서.pdf", details: {},
        executions: [
          { id: "6-EX1", itemId: 6, orderStatus: "주문 취소", receiptStatus: "해당 없음", serviceStatus: "해당 없음", evidenceStatus: "해당 없음", paid: true, refundResult: "미확정" },
          { id: "6-EX2", itemId: 6, orderStatus: "주문 대기", receiptStatus: "해당 없음", serviceStatus: "해당 없음", evidenceStatus: "해당 없음", reorderOfExecutionId: "6-EX1" },
        ],
      },
    ],
    history: [
      { date: "2026-03-04 11:00", action: "요청 생성", user: "김민석" },
      { date: "2026-03-05 09:00", action: "승인", user: "김민준" },
      { date: "2026-03-08 14:00", action: "주문 취소·재주문 준비", user: "김민준" },
    ]
  },
  {
    // 증빙 묶음 예시: 수령 완료 후 증빙 필요 실행분 (FIN-EVID-01에서 구매처·영수증 기준으로 묶는다)
    id: "REQ-004",
    eventId: SPORTS_EVENT_ID,
    title: "배너 거치대",
    event: "2026 소프트웨어융합대학 체육대회",
    dept: "운영부",
    requester: "박해랑",
    purpose: "행사장 배너 설치용 거치대",
    neededDate: "2026-03-12",
    priority: "보통",
    totalEstimatedAmount: 80000,
    status: "증빙 필요",
    items: [
      { id: 7, name: "배너 거치대", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 4, unit: "개", estimatedUnitPrice: 20000, estimatedTotalPrice: 80000, status: "승인", financeOwner: "김민준", orderStatus: "주문 완료", fulfillmentStatus: "수령 완료", evidenceStatus: "증빙 필요", priceEvidence: "거치대 견적.pdf", details: {} },
    ],
    history: [
      { date: "2026-03-05 10:00", action: "요청 생성", user: "박해랑" },
      { date: "2026-03-06 09:00", action: "승인", user: "김민준" },
      { date: "2026-03-11 14:00", action: "수령 완료 확인", user: "김민준" },
    ]
  },
  {
    // 배송 중 예시: 요청자(박해랑)가 주문 취소 요청 가능, 배송 중→수령 확인 필요→수령 완료 단계 시연
    id: "REQ-005",
    eventId: SPORTS_EVENT_ID,
    title: "행사 진행요원 조끼",
    event: "2026 소프트웨어융합대학 체육대회",
    dept: "운영부",
    requester: "박해랑",
    purpose: "진행요원 식별용 조끼",
    neededDate: "2026-03-14",
    priority: "보통",
    totalEstimatedAmount: 90000,
    status: "구매 필요",
    items: [
      { id: 8, name: "진행요원 조끼", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 15, unit: "개", estimatedUnitPrice: 6000, estimatedTotalPrice: 90000, status: "승인", financeOwner: "김민준", orderStatus: "주문 완료", fulfillmentStatus: "배송 중", evidenceStatus: "해당 없음", priceEvidence: "조끼 견적.pdf", details: {} },
    ],
    history: [
      { date: "2026-03-05 11:00", action: "요청 생성", user: "박해랑" },
      { date: "2026-03-06 10:00", action: "승인", user: "김민준" },
      { date: "2026-03-10 09:00", action: "주문 완료", user: "김민준" },
    ]
  },
  {
    // 대여·용역 예시: 대여(반납 흐름)와 용역(반납 없음)을 함께 시연
    id: "REQ-006",
    eventId: SPORTS_EVENT_ID,
    title: "행사 장비 대여·용역",
    event: "2026 소프트웨어융합대학 체육대회",
    dept: "운영부",
    requester: "박해랑",
    purpose: "행사 당일 음향·그늘막·무전 장비 대여와 무대 설치 용역",
    neededDate: "2026-03-14",
    priority: "보통",
    totalEstimatedAmount: 578000,
    status: "구매 필요",
    items: [
      { id: 9, name: "앰프·스피커 세트 대여", category: "장비 대여", budgetLine: "행사 운영비", purchaseType: "대여", quantity: 1, unit: "세트", estimatedUnitPrice: 150000, estimatedTotalPrice: 150000, status: "승인", financeOwner: "김민준", orderStatus: "주문 완료", fulfillmentStatus: "이행 대기", evidenceStatus: "해당 없음", priceEvidence: "음향 대여 견적.pdf", details: {} },
      { id: 10, name: "그늘막 천막(3x3m) 대여", category: "장비 대여", budgetLine: "행사 운영비", purchaseType: "대여", quantity: 2, unit: "동", estimatedUnitPrice: 40000, estimatedTotalPrice: 80000, status: "승인", financeOwner: "김민준", orderStatus: "주문 완료", fulfillmentStatus: "이행 중", evidenceStatus: "해당 없음", priceEvidence: "천막 대여 견적.pdf", details: {} },
      { id: 11, name: "무전기 세트 대여", category: "장비 대여", budgetLine: "행사 운영비", purchaseType: "대여", quantity: 6, unit: "대", estimatedUnitPrice: 8000, estimatedTotalPrice: 48000, status: "승인", financeOwner: "김민준", orderStatus: "주문 완료", fulfillmentStatus: "반납 확인 필요", evidenceStatus: "해당 없음", priceEvidence: "무전기 대여 견적.pdf", details: {} },
      { id: 12, name: "무대 설치·철거 용역", category: "용역", budgetLine: "행사 운영비", purchaseType: "용역", quantity: 1, unit: "건", estimatedUnitPrice: 300000, estimatedTotalPrice: 300000, status: "승인", financeOwner: "김민준", orderStatus: "주문 완료", fulfillmentStatus: "이행 중", evidenceStatus: "해당 없음", priceEvidence: "무대 설치 견적.pdf", details: {} },
    ],
    history: [
      { date: "2026-03-05 13:00", action: "요청 생성", user: "박해랑" },
      { date: "2026-03-06 11:00", action: "승인", user: "김민준" },
      { date: "2026-03-10 10:00", action: "주문 완료", user: "김민준" },
      { date: "2026-03-12 09:00", action: "천막 대여 이행 시작·무대 용역 착수", user: "김민준" },
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

// 행사별로 분리된 단일 기준 데이터. 목록·워크스페이스·완료 기록이 모두 이 레코드를 참조한다.
const DEFAULT_EVENT_RECORDS: EventRecord[] = [
  {
    id: SPORTS_EVENT_ID,
    info: DEFAULT_EVENT_INFO,
    lifecycle: "기획 중",
    tasks: DEFAULT_EVENT_TASKS,
    surveySettings: DEFAULT_SURVEY_SETTINGS,
    createdAt: "오늘 10:30",
    // 체육대회 표본 운영 조직. SPORTS_EVENT_ID에만 연결한다.
    organization: {
      leader: "김바다", leaderDept: "컴퓨터학부", leaderGrade: "3학년", mode: "import",
      teams: [
        { name: "운영팀", leader: "이윤슬", members: [{ name: "김바다", dept: "컴퓨터학부", grade: "3학년" }, { name: "박해수", dept: "컴퓨터학부", grade: "2학년" }] },
        { name: "홍보팀", members: [{ name: "이윤슬", dept: "ICT융합학부", grade: "4학년" }] },
        { name: "현장팀", leader: "정하늘", members: [{ name: "정하늘", dept: "컴퓨터학부", grade: "3학년" }] },
      ],
    },
    listMeta: { updatedAt: "오늘 10:30", highlights: ["신청자 142/200명", "명단 확인 필요 6명"] },
  },
  {
    id: "EVT-WELCOME",
    info: makeEmptyEventInfo("2026 신입생 환영 행사"),
    lifecycle: "기획 중",
    tasks: [],
    surveySettings: EMPTY_SURVEY_SETTINGS,
    createdAt: "어제 16:20",
    listMeta: { updatedAt: "어제 16:20", highlights: ["기본 정보 입력 필요"] },
  },
  {
    id: "EVT-SPRING",
    info: { ...makeEmptyEventInfo("봄 축제 학생회 부스"), startAt: "2026-05-28", placeConfirmed: true, placeName: "한양대 ERICA 잔디밭", dept: "대외협력부" },
    lifecycle: "후속 정리 중",
    tasks: [],
    surveySettings: EMPTY_SURVEY_SETTINGS,
    createdAt: "2026. 06. 02",
    listMeta: { updatedAt: "2026. 06. 02", highlights: ["실제 참석자 186명"], followUpItems: "미완료 업무 3건 · 미정리 문서 2건" },
  },
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
  eventOrganization: DEFAULT_EVENT_RECORDS[0].organization,
  setEventOrganization: () => {},
  eventTasks: DEFAULT_EVENT_TASKS,
  setEventTasks: () => {},
  recurringTasks: DEFAULT_RECURRING_TASKS,
  setRecurringTasks: () => {},
  createdMeetings: [],
  eventRecords: DEFAULT_EVENT_RECORDS,
  setEventRecords: () => {},
  selectedEventId: SPORTS_EVENT_ID,
  setSelectedEventId: () => {},
  setCreatedMeetings: () => {},
  selectedCreatedMeetingId: null,
  setSelectedCreatedMeetingId: () => {},
  meetingJoinAsNonParticipant: false,
  setMeetingJoinAsNonParticipant: () => {},
  selectedRecurringTaskId: null,
  setSelectedRecurringTaskId: () => {},
  selectedArchiveId: null,
  setSelectedArchiveId: () => {},
  archives: [],
  setArchives: () => {},
  evidenceBundles: [],
  setEvidenceBundles: () => {},
  evidenceDrafts: [],
  setEvidenceDrafts: () => {},
  selectedEventTaskId: null,
  setSelectedEventTaskId: () => {},
  purchaseRequests: DEFAULT_PURCHASE_REQUESTS,
  setPurchaseRequests: () => {},
  selectedPurchaseRequestId: null,
  setSelectedPurchaseRequestId: () => {},
  meetingDraft: null,
  setMeetingDraft: () => {},
  purchaseRequestDraft: null,
  setPurchaseRequestDraft: () => {},
  purchaseSupplementDraft: null,
  setPurchaseSupplementDraft: () => {},
  organizationMemberRoles: DEFAULT_ORGANIZATION_MEMBER_ROLES,
  setOrganizationMemberRoles: () => {},
  messageRooms: [],
  setMessageRooms: () => {},
  selectedMessageRoomId: null,
  setSelectedMessageRoomId: () => {},
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
      { num: "02", element: "회의 카드", description: "이름, 일시·장소, 참가 현황, 안건 수, 나와의 관계(참가자·미참가)를 표시한다. 생성된 예정 회의도 같은 그룹에 즉시 추가되며, 카드에서 해당 회의 정보를 연다.", constraint: "비공개 회의는 `비공개` 칩을 함께 표시한다" },
      { num: "03", element: "상태별 버튼", description: "예정=회의 상세 보기, 진행 중·미참가=회의 참가, 진행 중·참가=회의로 돌아가기, 완료·참석=회의록 보기, 완료·불참=회의 요약 확인.", constraint: "핸드오프 버튼 규칙 고정. 진행 중·미참가에서 회의 참가를 누르면 `참가자가 아닙니다. 그래도 참여하시겠습니까?` 확인을 거친다" },
      { num: "04", element: "비공개 회의 노출", description: "비공개 회의는 선정된 참가자와 생성자에게만 목록에 표시하고, 그 외 구성원의 전체 회의 목록에서는 제외한다." },
      { num: "05", element: "새 회의 만들기", description: "이 화면에는 노출하지 않는다.", constraint: "회의 생성은 회장단·부서장만 (권한 매트릭스)" },
    ],
    exceptions: ["회의 시작·종료·권한 관리 버튼은 일반 참가자에게 노출하지 않는다", "비공개 회의는 참가자로 선정되지 않은 구성원에게 목록·상세를 노출하지 않는다"],
    nextScreens: ["OPS-MEET-03A 예정 상세", "OPS-MEET-05A 진행 중", "OPS-MEET-07 회의록", "OPS-MEET-08 요약 확인"],
  },
  "OPS-MEET-01B": {
    id: "OPS-MEET-01B", name: "전체 회의 — 진행 권한자", stateChip: "기본",
    purpose: "진행 권한이 있는 회의를 구분해 확인하고, 해당 회의의 시작·진행·정리 화면으로 이동한다.",
    users: "진행 권한자",
    entryPath: "사이드바 운영 → 회의",
    functions: [
      { num: "01", element: "목록·필터", description: "01A와 동일한 목록 구조." },
      { num: "02", element: "진행 권한 행동", description: "예정=회의 시작, 진행 중=회의로 돌아가기, 정리 중=회의록 정리로 이동한다.", constraint: "진행 권한이 있는 회의에만 적용" },
      { num: "03", element: "관계 칩", description: "진행 권한 보유 여부를 회의 카드별로 표시한다." },
      { num: "04", element: "새 회의 만들기", description: "이 화면에는 노출하지 않는다.", constraint: "진행 권한만으로 회의를 생성할 수 없음" },
    ],
    exceptions: ["진행 권한자는 다른 사람의 권한을 변경하거나 회의 정보를 수정·취소할 수 없다"],
    nextScreens: ["OPS-MEET-03C 예정 상세", "OPS-MEET-05B 진행 중", "OPS-MEET-06B 회의록 정리", "OPS-MEET-07 완료 회의록", "OPS-MEET-08 회의 요약 확인"],
  },
  "OPS-MEET-01C": {
    id: "OPS-MEET-01C", name: "전체 회의 — 회의 생성 가능", stateChip: "기본",
    purpose: "회의 생성 권한이 있는 사용자가 전체 회의를 확인하고 새 회의를 만든다.",
    users: "회장단 · 부서장",
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
  "OPS-MEET-01D": {
    id: "OPS-MEET-01D", name: "전체 회의 — 미참가자", stateChip: "기본",
    purpose: "참가자로 초대되지 않은 구성원(박민수, 기획부 부원) 관점에서 전체 회의를 확인하고, 진행 중 회의에 확인을 거쳐 열람 참여한다.",
    users: "미참가자 (박민수 · 기획부 부원)",
    entryPath: "사이드바 운영 → 회의",
    functions: [
      { num: "01", element: "목록·필터", description: "01A와 동일한 목록 구조. 초대되지 않은 회의는 관계가 미참가·불참으로 표시된다." },
      { num: "02", element: "미참가 참가 확인", description: "진행 중·미참가 회의에서 회의 참가를 누르면 `참가자가 아닙니다. 그래도 참여하시겠습니까?` 확인을 거쳐 진행 중 회의로 이동한다." },
      { num: "03", element: "비공개 회의 제외", description: "박민수가 참가자로 선정되지 않은 비공개 회의는 목록에 표시하지 않는다." },
      { num: "04", element: "열람 참여 표시", description: "확인 후 진행 중 회의에 들어가면 참석 처리 대신 `미참가자` 표시와 참가 현황의 미참가자 항목으로 구분된다." },
    ],
    exceptions: ["회의 시작·종료·권한 관리 버튼을 노출하지 않는다", "열람 참여는 참석 처리가 아니다"],
    nextScreens: ["OPS-MEET-05A 진행 중 회의(열람 참여)", "OPS-MEET-03A 예정 상세", "OPS-MEET-08 완료 요약"],
  },
  "OPS-MEET-02": {
    id: "OPS-MEET-02", name: "회의 생성·수정", stateChip: "작성",
    purpose: "새 회의를 만들거나 예정 회의의 정보를 수정한다.",
    users: "회장단 · 부서장",
    entryPath: "회의 목록(01C) → 새 회의 만들기 / 예정 회의 관리(03B) → 수정",
    functions: [
      { num: "01", element: "기본 정보", description: "회의 이름, 일시, 장소를 입력한다." },
      { num: "02", element: "진행 방식", description: "오프라인·온라인·혼합 중에서 고른다. 온라인·혼합은 온라인 링크를 입력하며, 혼합은 현장 장소와 온라인 접속을 함께 제공한다. 목록 카드에 온라인·혼합 방식을 칩으로 표시한다." },
      { num: "03", element: "참가자 초대", description: "구성원을 검색해 초대 목록을 구성한다." },
      { num: "04", element: "비공개 회의 설정", description: "비공개 토글을 켜면 선정한 참가자와 생성자에게만 회의 목록에 노출된다. 기본값은 공개이며 상태를 문구로 안내한다." },
      { num: "05", element: "안건 구성", description: "안건 제목, 예상 시간, 관련 자료를 추가·정렬한다." },
      { num: "06", element: "회의 만들기", description: "필수값(회의명·일시·장소)을 확인해 예정 회의를 생성하고 권한자용 회의 목록에 즉시 추가한다.", constraint: "생성자는 자동으로 진행 권한자가 된다. 생성 결과는 로컬 상태 데모로 목록에만 반영된다" },
    ],
    exceptions: ["회의명·일시·장소 등 필수값이 없으면 회의를 생성하지 않는다", "임시 저장 초안은 회의 목록과 참가자에게 노출하지 않는다", "비공개 회의는 선정된 참가자와 생성자에게만 노출한다", "회의 생성은 회장단·부서장만 하고, 이미 만든 회의의 수정은 그 회의의 생성자만 한다"],
    nextScreens: ["OPS-MEET-01C 회의 생성 가능 목록", "OPS-MEET-03B 예정 회의 관리"],
  },
  "OPS-MEET-03A": {
    id: "OPS-MEET-03A", name: "예정 회의 상세 — 일반 참가자", stateChip: "예정",
    purpose: "예정 회의의 정보, 안건, 참가 현황을 확인한다.",
    users: "회의 참가자",
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
      { num: "04", element: "회의 시작", description: "OPS-MEET-D01 시작 확인을 거쳐 회의를 진행 중으로 전환한다.", constraint: "생성자는 기본 진행 권한자로서 시작할 수 있다" },
    ],
    exceptions: ["회의 생성자가 아니면 참가자·안건·진행 권한 관리 기능을 노출하지 않는다", "회의 시작 이후에는 예정 정보와 권한 구성을 수정할 수 없다"],
    nextScreens: ["OPS-MEET-02 수정", "OPS-MEET-04B 진행 권한 관리", "OPS-MEET-D04 취소 확인", "OPS-MEET-D01 시작 확인"],
  },
  "OPS-MEET-03C": {
    id: "OPS-MEET-03C", name: "예정 회의 상세 — 진행 권한자", stateChip: "예정",
    purpose: "진행 권한자가 회의 시작 전 정보를 확인하고 회의를 시작한다.",
    users: "진행 권한자",
    entryPath: "회의 목록 → 예정 회의(진행 권한 보유)",
    functions: [
      { num: "01", element: "회의 시작", description: "OPS-MEET-D01 시작 확인을 거쳐 회의를 진행 중으로 전환한다." },
      { num: "02", element: "진행 권한 현황(읽기 전용)", description: "`참가자와 진행 권한` 카드에 진행 권한 보유자를 인라인으로 표시하고, 권한 부여·해제는 회의 생성자만 가능함을 안내한다. 별도 화면으로 이동하지 않는다.", constraint: "진행 권한자는 다른 사람의 권한을 변경할 수 없다. 부여·해제 버튼을 노출하지 않는다" },
      { num: "03", element: "안건·참가 확인", description: "03A와 동일한 정보 열람." },
    ],
    exceptions: ["진행 권한이 회수되었거나 회의가 취소된 경우 시작할 수 없다", "진행 권한만으로 다른 참가자의 권한을 변경할 수 없다"],
    nextScreens: ["OPS-MEET-D01 시작 확인"],
  },
  "OPS-MEET-04B": {
    id: "OPS-MEET-04B", name: "진행 권한 관리 — 회의 생성자", stateChip: "기본",
    purpose: "회의 생성자가 참가자에게 진행 권한을 부여하거나 해제한다.",
    users: "회의 생성자",
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
    users: "회의 참가자",
    entryPath: "회의 목록 → 회의 참가 / 회의로 돌아가기",
    functions: [
      { num: "01", element: "2열 구조", description: "왼쪽은 선택한 안건의 회의록 문서, 오른쪽은 전체 안건과 참가 현황." },
      { num: "02", element: "안건 전환", description: "안건 선택 시 논의 내용·결정사항·후속 업무가 함께 전환된다.", constraint: "네 영역은 안건에 귀속된 하나의 데이터 단위" },
      { num: "03", element: "논의 내용 공동 작성", description: "참가자 전원이 안건별 기록을 작성한다." },
      { num: "04", element: "결정 의견 추가", description: "의견만 제안한다. 확정·수정은 진행 권한자." },
      { num: "05", element: "참석 표시", description: "첫 참가 시각을 기록하고 참석 처리됨을 표시한다.", constraint: "미참가자가 확인을 거쳐 열람 참여한 경우 참석 처리됨 대신 `미참가자 · 열람 참여 중`과 상단 `미참가자` 칩을 표시한다" },
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
    users: "회의 참가자",
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
      { num: "03", element: "참석 결과", description: "참석·불참 기록을 표시한다.", constraint: "미참가자가 열람 참여한 경우 참석·불참 집계와 분리해 `미참가자 · 열람` 항목으로 표시한다" },
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
    users: "회의 참가자",
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
    entryPath: "OPS-MEET-03B·03C → 회의 시작",
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
      { num: "01", element: "요약 카드", description: "진행 중 행사, 예정 행사, 이번 주 주요 일정, 모든 행사 업무의 지연·담당자 미지정 건수를 계산해 표시하고 대상 화면으로 이동한다." },
      { num: "02", element: "진행 중·예정 행사", description: "행사별 준비율과 행사 업무의 지연·담당자 없는 업무 경고를 표시하며 행사 업무로 이동한다." },
      { num: "03", element: "다가오는 주요 일정", description: "행사·상시 업무의 미완료 마감, 행사 일정, 취소되지 않은 생성 회의를 날짜순으로 표시한다. 이번 주 주요 일정 수치도 같은 데이터에서 계산하며, 일정 행을 누르면 통합 캘린더가 해당 월·날짜와 선택한 일정을 강조해 연다." },
      { num: "04", element: "조직 주요 알림", description: "행사 업무의 지연·담당자 미지정 건수, 증빙 서류 누락, 참가자 명단 확인 필요 건수를 표시한다. 세 항목을 누르면 각각의 작은 선택 박스를 열고, 선택한 항목의 처리 화면으로 이동한다. 선택 박스는 닫기 또는 화면의 다른 부분을 누르면 닫힌다." },
      { num: "05", element: "전체 재정 요약", description: "예산 사용률과 승인·집행 예정, 증빙 누락을 요약한다.", constraint: "홈은 내 업무의 상위 공간이 아니다" },
      { num: "06", element: "내 담당 업무 요약", description: "행사·상시 업무에서 현재 사용자에게 배정된 미완료 업무 수를 표시하고 내 업무로 이동한다." },
    ],
    exceptions: ["연결 데이터가 없으면 임의 수치를 만들지 않고 0건·빈 상태로 표시한다", "권한이 없는 사용자의 관리 전용 바로가기를 노출하지 않는다"],
    nextScreens: ["FIN-00 전체 재정 현황", "MY-01 내 업무", "EVT-TASK-01 행사 업무", "OPS-CAL-01 통합 캘린더"],
  },
  "HOME-01K": {
    id: "HOME-01K", name: "홈 — 끼룩이 브리핑", stateChip: "검토안",
    purpose: "HOME-01의 운영 요약 위에 마스코트 끼룩이의 브리핑 배너를 얹어, 지금 확인해야 할 항목을 문장으로 먼저 알려준다.",
    users: "전 구성원",
    entryPath: "사이드바 홈 (HOME-01 대체 검토안)",
    functions: [
      { num: "01", element: "끼룩이 브리핑 배너", description: "요약 카드 위에 배치한다. 캐릭터와 말풍선, 화자 표시 `끼룩이가 알려드려요`로 구성하며, 홈이 이미 계산한 지연·미지정·임박 일정·이번 주 일정 수치를 문장으로 엮어 최대 2줄만 말한다.", constraint: "새로운 수치나 판단을 만들지 않는다. 표시하는 모든 값은 기존 홈 데이터와 동일해야 한다" },
      { num: "02", element: "우선순위 규칙", description: "지연 업무 → 담당자 미지정 → 읽지 않은 메시지 → 3일 이내 임박 일정 → 이번 주 일정 순으로 최대 2건만 고른다. 해당 없으면 평온 문안을 표시한다." },
      { num: "02B", element: "메시지 알림", description: "읽지 않은 메시지가 있으면 담백한 톤으로 건수를 알리고 메시지로 이동한다. 방이 여러 개면 `N개 방에 M건`으로, 하나면 건수만 표시한다.", constraint: "안 읽은 메시지 수는 실제 메시지 방 데이터에서 계산한다" },
      { num: "03", element: "톤 3단계", description: "지연·미지정은 사무적 톤에 `확인 중` 표정, 일반 알림과 평온·빈 상태는 친근한 톤에 `안녕` 표정을 쓴다. `생각 중` 표정은 AI 처리 중 상태에만 쓴다.", constraint: "재정·지연 항목에 마스코트 말투를 쓰지 않는다. 경고 톤에서는 화자 표시의 느낌표를 뺀다" },
      { num: "04", element: "바로가기", description: "브리핑이 지목한 항목의 처리 화면으로 이동한다. 담당자 미지정은 행사 업무의 미지정 필터를 적용한다.", constraint: "부원에게는 담당자 배정 표현 대신 목록 보기로 표시한다" },
      { num: "05", element: "빈 상태", description: "행사·업무 데이터가 없으면 수치 대신 첫 행사 생성 안내를 표시한다." },
      { num: "06", element: "가벼운 본문", description: "브리핑에 무게를 싣기 위해 HOME-01보다 본문을 줄인다. 최근 활동은 표시하지 않고, 다가오는 주요 일정은 3건까지만 부서명 없이 압축한다.", constraint: "끼룩이가 이미 말한 항목은 중복 표시하지 않는다. 요약 카드에서 `확인 필요`를, 조직 주요 알림에서 지연·담당자 미지정 행을 제외한다" },
    ],
    exceptions: ["연결 데이터가 없으면 임의 수치를 만들지 않고 0건·빈 상태로 표시한다", "홈은 내 업무의 상위 공간이 아니므로 브리핑에서 개인 업무 건수를 말하지 않는다", "권한이 없는 사용자의 관리 전용 바로가기를 노출하지 않는다"],
    nextScreens: ["EVT-TASK-01 행사 업무", "OPS-CAL-01 통합 캘린더", "HOME-01 홈"],
  },
  "MSG-01": {
    id: "MSG-01", name: "메시지 — 방 목록·시작 전", stateChip: "기본",
    purpose: "학생회 구성원 간 소통 방을 모아 보고, 아직 방이 없으면 첫 방 생성을 안내한다.",
    users: "전 구성원",
    entryPath: "사이드바 메시지",
    functions: [
      { num: "01", element: "빈 상태", description: "방이 하나도 없으면 목록 대신 안내와 `새 메시지 방 만들기`만 표시한다.", constraint: "임의의 예시 방을 만들어 두지 않는다" },
      { num: "02", element: "방 목록", description: "방이 있으면 분류(일반·행사별)로 묶어 표시한다. 방마다 이름, 참여 대상 칩, 참여 인원 수, 만든 사람과 만든 날짜를 보여준다." },
      { num: "03", element: "참여 대상 표시", description: "부서 단위 선택은 `○○부 전체` 칩으로, 개별 선택은 이름 칩으로 구분해 표시한다." },
      { num: "04", element: "새 메시지 방", description: "MSG-02 방 만들기 모달을 연다.", constraint: "전 구성원이 만들 수 있다" },
    ],
    exceptions: ["연결 데이터가 없으면 임의 목록을 만들지 않고 빈 상태로 표시한다", "방을 누르면 MSG-03 대화 화면을 연다"],
    nextScreens: ["MSG-02 새 메시지 방 만들기", "MSG-03 대화 화면"],
  },
  "MSG-03": {
    id: "MSG-03", name: "대화 화면", stateChip: "기본",
    purpose: "선택한 메시지 방의 대화를 확인하고 메시지를 보낸다.",
    users: "방 참여자",
    entryPath: "메시지 > 방 선택",
    functions: [
      { num: "01", element: "방 목록", description: "왼쪽에 참여 중인 방을 분류·마지막 메시지·안 읽은 수와 함께 표시하고, 선택한 방을 강조한다. `전체 보기`로 MSG-01로 돌아간다." },
      { num: "02", element: "대화 헤더", description: "방 이름, 분류 칩, 참여 인원 수와 참여자 이름을 표시한다." },
      { num: "03", element: "메시지 목록", description: "내가 보낸 메시지는 오른쪽 파란 말풍선으로, 다른 사람의 메시지는 왼쪽에 아바타·이름과 함께 표시한다. 방 생성 같은 안내는 가운데 정렬한 회색 문구로 구분한다." },
      { num: "04", element: "메시지 입력", description: "입력 후 `보내기` 또는 Enter로 전송한다. 보낸 메시지는 즉시 목록과 방 목록의 마지막 메시지에 반영된다.", constraint: "본문과 첨부가 모두 비어 있으면 보낼 수 없다" },
      { num: "04B", element: "파일 첨부", description: "클립 버튼으로 파일을 여러 개 고른다. 고른 파일은 입력창 위에 칩으로 쌓이고 X로 뺄 수 있다. 본문 없이 첨부만 보낼 수도 있으며, 방 목록 미리보기에는 `파일 N개`로 요약한다.", constraint: "메시지 첨부는 대화 공유용이며 정산 증빙이 아니다. 증빙 등록은 재정 화면에서만 한다. 백엔드가 없으므로 파일명과 용량만 기록하고 실제 업로드·보관은 하지 않는다" },
      { num: "04C", element: "이미지 미리보기", description: "이미지 파일은 대기 칩과 말풍선 모두에서 썸네일로 보여주고, 이미지가 아닌 파일은 문서 아이콘과 파일명·용량 카드로 보여준다.", constraint: "미리보기는 브라우저 로컬에서만 만들며 서버에 올리지 않는다" },
      { num: "05", element: "읽음 처리", description: "방을 열면 그 방의 안 읽은 수를 0으로 지우고, 방 목록과 홈 끼룩이 브리핑의 메시지 알림에 즉시 반영한다." },
      { num: "06", element: "인원 추가", description: "헤더의 `인원 추가`를 누르면 아직 참여하지 않은 구성원만 소속·역할과 함께 목록으로 보여준다. 선택해 추가하면 참여자에 반영하고 초대 안내를 대화에 남긴다.", constraint: "이미 참여 중인 구성원은 목록에 넣지 않으며, 추가할 사람이 없으면 그 사실을 문구로 알린다" },
      { num: "07", element: "방 나가기", description: "확인 후 참여자에서 본인을 제외하고 방 목록으로 돌아간다. 부서 단위로 참여 중이었다면 그 부서를 개별 인원으로 펼친 뒤 본인만 제외한다. 남은 참여자에게는 나갔다는 안내를 대화에 남긴다.", constraint: "남은 참여자가 없으면 방과 대화 기록이 함께 삭제되며, 확인 문구에서 이 사실을 미리 알린다" },
    ],
    exceptions: ["방이 하나도 없으면 대화 대신 방 만들기 안내를 표시한다", "이 화면은 백엔드 없는 로컬 상태 데모이며 실제 실시간 수신은 구현하지 않는다", "방을 만들면 데모 확인용으로 안내 문구와 상대방의 첫 메시지가 들어가고 안 읽음 1건으로 시작한다"],
    nextScreens: ["MSG-01 메시지 방 목록"],
  },
  "MSG-02": {
    id: "MSG-02", name: "새 메시지 방 만들기", stateChip: "모달 열림",
    purpose: "학생회 조직도를 그대로 사용해 부서 단위와 개인 단위를 함께 골라 메시지 방을 만든다.",
    users: "전 구성원",
    entryPath: "메시지 > 새 메시지 방 만들기",
    functions: [
      { num: "01", element: "분류 선택", description: "`일반` 또는 행사 중 하나를 고른다. 일반은 행사와 무관한 학생회 내부 소통이며, 선택한 분류는 방 목록의 묶음 기준이 된다.", constraint: "행사 워크스페이스의 탭 구성은 바꾸지 않는다" },
      { num: "02", element: "방 이름", description: "선택 입력이다. 입력하면 그 값을 그대로 쓰고, 비워 두면 만들 때 선택한 대상에서 자동으로 생성한다. 자동 생성 규칙은 대표 대상 하나(부서를 먼저, 없으면 개인)를 앞에 두고 나머지 인원 수를 붙이는 `○○ 외 N명` 형식이며, 나머지가 없으면 대표 대상만 쓴다. 예를 들어 기획부 1명과 홍보부 1명을 고르면 `기획부 외 1명`, 2명인 운영부만 고르면 `운영부`가 된다. 입력란이 비어 있는 동안에는 자동 생성될 이름을 미리 보여준다.", constraint: "구성원을 추가해도 입력란을 자동으로 채우지 않는다. 선택 결과는 `구성원`에서만 확인한다" },
      { num: "02B", element: "구성원", description: "방 이름 아래에서 현재 선택한 대상을 보여준다. 부서 단위는 사람 아이콘이 붙은 파란 칩 `○○부 전체`로, 개인은 아바타가 붙은 흰 칩으로 형태를 구분한다. 칩의 X로 바로 뺄 수 있고, 비어 있으면 선택 안내를 표시한다." },
      { num: "03", element: "부서 선택", description: "조직도의 부서를 체크하면 그 부서 전원이 대상이 된다. 부서명 옆에 소속 인원 수를 표시한다." },
      { num: "04", element: "구성원 펼치기", description: "부서 오른쪽 돋보기를 누르면 아래로 부서원 목록이 펼쳐지고, 이름 옆 체크박스로 개인을 고른다. 한 명이면 개인 대화, 여러 명이면 그룹 대화가 된다.", constraint: "부서 전체가 선택된 경우 그 부서의 개별 체크박스는 선택된 상태로 잠근다" },
      { num: "05", element: "이름 검색", description: "이름을 입력하면 일치하는 구성원이 있는 부서만 남기고 자동으로 펼쳐 해당 구성원만 보여준다. 결과가 없으면 안내 문구를 표시한다." },
      { num: "06", element: "선택 요약·생성", description: "하단에 부서 수, 개인 수, 중복을 제외한 총 인원 수를 표시한다.", constraint: "대상이 한 명도 없을 때만 `방 만들기`를 비활성화한다. 방 이름이 비어 있는 것은 생성을 막지 않는다" },
    ],
    exceptions: ["부서 전체 선택과 같은 부서의 개별 선택은 중복되지 않도록 정리한다", "부서와 개인을 함께 선택할 수 있다", "총 인원 수는 중복을 제외하고 계산한다", "방 이름을 비운 채 만들면 `○○ 외 N명` 규칙으로 자동 생성한 이름을 저장한다"],
    nextScreens: ["MSG-01 메시지 방 목록"],
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
      { num: "03", element: "보완하기", description: "보완 필요 요청은 FIN-SUP-01B 재제출로 이동한다." },
      { num: "04", element: "새 구매 요청", description: "FIN-REQ-01B 작성으로 이동한다.", constraint: "재정부·부서장에게만 노출" },
    ],
    exceptions: ["내가 요청한 항목이 없으면 빈 상태로 표시한다", "다른 요청자의 구매 요청과 보완 내용을 노출하지 않는다"],
    nextScreens: ["FIN-SUP-01B 보완 재제출", "FIN-REQ-01B 구매 요청 작성", "EVT-FIN-01 행사 재정"],
  },
  "FIN-REQ-02": {
    id: "FIN-REQ-02", name: "구매 요청 상세·진행 상태", stateChip: "기본",
    purpose: "제출한 구매 요청의 품목별 상태와 처리 이력을 단계로 확인한다.",
    users: "전 구성원 (조회)",
    entryPath: "내 구매 요청 → 상태 확인",
    functions: [
      { num: "01", element: "진행 단계", description: "요청 제출 → 재정부 검토 → 구매·발주 → 결제·증빙 → 처리 완료 단계를 표시한다." },
      { num: "02", element: "품목별 상태", description: "품목 단위로 승인·보완 필요를 구분해 표시한다.", constraint: "부분 승인 존재" },
      { num: "03", element: "처리 이력", description: "제출, 검토 시작, 보완 요청 발송 등 이력을 시간순으로 표시한다." },
      { num: "04", element: "주문 취소 요청", description: "요청자 본인이 주문 완료된 개별 실행분의 취소를 사유 모달과 함께 요청한다. 요청하면 `취소 요청됨 · 재정부 확인 대기`로 표시되고, 재정부가 확정하면 주문 취소·환불 흐름으로 이어진다.", constraint: "요청자 본인에게만 노출하며 수령·이행 완료 전 실행분만 대상" },
      { num: "05", element: "요청 취소(품목 단위)", description: "요청자가 주문 완료 전 개별 품목(검토 대기·보완 요청·미주문 승인)을 사유 모달과 함께 취소한다. 취소한 품목은 상태가 `요청 취소`가 되어 요청 아카이브(전체 요청)엔 취소 기록으로 남고, 승인 묶음 생성 시 자동 제외되며 승인·예산 예약이 있으면 해제된다.", constraint: "요청자 본인(재정부·부서장)에게만 노출. 이미 주문된 실행분이 있는 품목은 요청 취소 대신 개별 주문 취소 요청을 사용한다" },
    ],
    exceptions: ["요청자와 재정부 외 사용자는 민감한 구매 세부정보를 수정할 수 없다", "보완 요청 상태가 아니면 재제출 행동을 노출하지 않는다"],
    nextScreens: ["FIN-SUP-01B 보완 재제출"],
  },
  "FIN-SUP-01B": {
    id: "FIN-SUP-01B", name: "보완 요청 확인·재제출 — 홍보부 부서장", stateChip: "권한 보유",
    purpose: "보완 요청을 받은 홍보부 부서장 김민석이 요청 사항을 수정해 재제출한다.",
    users: "요청자 본인 · 부서장 (김민석)",
    entryPath: "내 구매 요청 → 보완하기 (홍보부 부서장)",
    functions: [
      { num: "01", element: "보완 요청 안내", description: "재정부가 남긴 보완 사유를 표시한다." },
      { num: "02", element: "보완 품목 수정", description: "규격, 색상, 인쇄 위치, 옵션별 수량과 첨부 파일을 수정한다." },
      { num: "03", element: "재제출", description: "필수 보완 항목을 모두 입력하면 재검토 대기 상태로 바꾸고 새 처리 이력을 추가한다." },
    ],
    exceptions: ["부서장이더라도 해당 구매 요청의 요청자 본인이 아니면 재제출할 수 없다", "재제출 후 기존 검토 이력을 덮어쓰지 않는다"],
    nextScreens: ["FIN-REQ-02 진행 상태"],
  },
  "FIN-PROC-01": {
    id: "FIN-PROC-01", name: "구매·발주 처리", stateChip: "구매 필요",
    purpose: "승인된 요청의 품목을 구매처별로 발주하고 주문·배송 상태를 관리한다.",
    users: "재정부",
    entryPath: "행사 > 재정 → 구매 필요 건",
    functions: [
      { num: "01", element: "구매 실행분 목록", description: "이 요청의 품목을 구매 실행분 단위로 표로 표시하고, 실행분별 주문·수령/이행·증빙 상태를 함께 보여준다. 재주문 실행분은 재주문 배지로 구분한다.", constraint: "주문/수령/이행/증빙은 실행분의 원본 상태에서 표시한다" },
      { num: "02", element: "주문·수령·이행 상태", description: "주문 대기·주문 완료·구매 불가·주문 취소의 주문 상태와, 물품의 배송 대기·배송 중·수령 확인 필요·수령 완료, 대여·용역의 이행 대기·이행 중·반납 확인 필요·이행 완료 상태를 실행분 단위로 관리한다. 대여는 이행 중에서 반납 확인 요청으로 반납 확인 필요로 넘기고, 반납이 없는 용역은 반납 없이 이행 완료로 바로 처리한다.", constraint: "주문 시 수량을 나눠 부분 주문하면 주문 완료 실행분과 남은 주문 대기 실행분으로 분할된다(실행분 quantity)" },
      { num: "02B", element: "부분 주문 수량 분할", description: "주문 대기 실행분의 ‘주문’ 버튼에서 주문 수량을 입력한다. 전체보다 적게 주문하면 지정 수량만 주문 완료로 전환되고 남은 수량은 새 주문 대기 실행분으로 자동 분할된다. 실행분별 수량과 승인액(수량×단가)을 함께 표시한다.", constraint: "부분 수령·부분 반환에 따른 분할은 현재 범위에서 제외(15장)" },
      { num: "03", element: "품절·취소·환불·재주문 처리", description: "품절 품목은 구매 불가로 표시하고 품절 사유 반려·예약 해제로 처리한다. 주문 취소는 요청자의 취소 요청을 재정부가 확정하거나(취소 요청 확정), 판매자 취소 등 외부 취소를 재정부가 직접 기록한다(외부 취소 기록). 취소 후 실행분별 환불 확인·재주문 액션으로 후속 업무를 처리한다(환불 대기 → 환불 확인 → 재주문 판단). 재주문 판단에서 재주문(새 실행분 생성) 또는 재주문 안 함을 선택하면 취소 실행분은 종결되어 활성 처리에서 제외된다.", constraint: "재주문 판단은 결정(재주문/재주문 안 함) 후 종결되며 활성 칸반에 남지 않는다" },
    ],
    exceptions: ["승인되지 않은 품목은 구매·발주 처리할 수 없다", "재정부 외 사용자에게 구매 처리 기능을 노출하지 않는다"],
    nextScreens: ["FIN-EVID-01 결제·증빙 정리"],
  },
  "FIN-EVID-01": {
    id: "FIN-EVID-01", name: "결제·증빙 정리", stateChip: "증빙 필요",
    purpose: "결제 수단과 증빙 서류를 등록해 지출 건을 정산 완료로 만든다.",
    users: "재정부",
    entryPath: "행사 > 재정 → 증빙 필요 건",
    functions: [
      { num: "01", element: "결제 정보", description: "법인카드, 계좌이체 등 결제 수단과 결제자를 기록한다." },
      { num: "02", element: "증빙 묶음", description: "같은 구매처·결제·영수증에 속하는 구매 실행분을 다시 선택해 하나의 증빙 묶음으로 묶는다. 서로 다른 구매 요청·승인 묶음의 실행분도 실제 거래가 같으면 함께 묶을 수 있으며, 영수증·물품 사진·사용 사진·거래 내역·통장 사본·카드 사진·구매 사유를 등록한다.", constraint: "증빙 묶음은 요청 단위가 아니라 실행분 재구성 단위다" },
      { num: "03", element: "증빙 완료", description: "필수 증빙과 실제 구매 금액이 갖춰지면 실제 지출로 반영하고, 완료된 증빙 묶음을 레코드로 저장해 행사 재정 개요의 기록 > 증빙 묶음에서 다시 열람할 수 있게 한다.", constraint: "감사보고서류 기능은 어떤 형태로도 추가 금지" },
    ],
    exceptions: ["결제 정보나 필수 증빙이 누락되면 증빙 완료할 수 없다", "재정부 외 사용자는 증빙 상태를 변경할 수 없다"],
    nextScreens: ["FIN-LEDGER-01 사용 내역", "EVT-FIN-01B 기록 > 증빙 묶음"],
  },
  "EVT-TASK-01": {
    id: "EVT-TASK-01", name: "행사 업무 — 칸반 보드", stateChip: "기본",
    purpose: "행사 참가자 전원이 행사 업무를 칸반으로 함께 관리한다.",
    users: "행사 참가자 전원",
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
    purpose: "이 행사 맥락의 예산 현황과 품목별 구매 진행을 확인하고, 재정부는 별도의 처리 업무를 수행한다.",
    users: "전 구성원 (예산·품목 진행 열람). 처리 단계와 처리 진입은 재정부",
    entryPath: "행사 > 재정 탭",
    functions: [
      { num: "01", element: "예산 요약·조정", description: "배정 예산, 승인 예약액, 실제 지출액, 사용 가능액을 표시하고 재정부는 항목 간 조정 이력을 남긴다." },
      { num: "02", element: "하위 메뉴 그룹(작업 보드·기록)", description: "재정부에게만 탭을 두 묶음으로 나눈다. [작업 보드]는 진행 중 업무 칸반(품목 현황·처리 단계), [기록]은 요청·묶음 단위 아카이브(구매 요청·승인 묶음·증빙 묶음)다. 일반 구성원·부서장에게는 처리 단계와 기록 그룹을 노출하지 않고 품목 현황만 보이며, 본인 요청 열람은 내 구매 요청(MY-REQ-01)으로 한다.", constraint: "기록·처리 단계는 재정부 전용. ‘아카이브’ 명칭은 행사 아카이브와 겹치지 않도록 ‘기록’으로 묶고, 묶음(📦)과 개별(▪)의 경계를 시각적으로 구분한다" },
      { num: "03", element: "품목 현황 칸반보드", description: "일반 구성원과 부서장에게 기본으로 표시한다. 품목 카드를 확인 필요, 검토 중, 구매 준비, 주문 완료, 진행 중, 수령·이행 완료, 정산 중, 처리 완료 열로 나누어 보여준다. 카드의 대표 상태는 구매 유형에 따라 물품은 배송 중·수령 완료, 대여·용역은 이행 중·이행 완료로 표시한다. ‘전체 요청 / 내 요청’ 필터로 내가 요청한 구매 품목만 볼 수 있다. 한 열에서 같은 구매 요청(REQ)의 카드가 2개 이상이면 반쯤 겹친 스택(📦 N)으로 묶고, 마우스를 올리면 개별 카드로 펼쳐지고 묶음 밖으로 커서가 나가면(또는 바깥 클릭 시) 다시 접힌다.", constraint: "대표 진행 상태는 검토·주문·수령·이행·증빙 상태의 단일 원본에서 계산하며 별도로 저장하지 않는다. 내 요청 필터는 요청자 기준으로만 거른다. 같은 요청 카드 스택은 표시 방식일 뿐 상태·집계를 바꾸지 않는다" },
      { num: "04", element: "재정부 처리 단계", description: "재정부에만 기본으로 표시한다. 요청 검토·구매 준비·물품 배송·수령·대여 이행·용역 이행·환불·증빙의 7개 업무 영역으로 나누고, 각 영역 안에서 다음 처리해야 할 실행분을 처리 단계 열별로 보여준다. 정산 완료·반려는 활성 처리에서 제외한다.", constraint: "일반 구성원에게는 재정부 내부 처리 대기열을 노출하지 않는다. 처리 단계는 실행분 원본 상태에서 계산하며 별도 저장하지 않는다" },
      { num: "05", element: "기록 · 구매 요청 (재정부 전용)", description: "이 행사의 구매 요청을 요청 단위(▪)로 표시한다. 취소된 품목도 요청 기록에 남는다. 행을 누르면 품목별 상세로 이동한다.", constraint: "재정부 전용. 일반 구성원·부서장은 내 구매 요청(MY-REQ-01)에서 본인 요청만 열람한다" },
      { num: "06", element: "기록 · 승인 묶음 (재정부 전용)", description: "선진행 동의된 승인 품목을 요청별 묶음(📦)으로 보여준다. 각 묶음 안에 개별 품목(▪)과 진행 상태가 들어간다. 요청 취소·미동의 품목은 묶음에서 자동 제외된다. 파생 표시이며 별도 저장하지 않는다.", constraint: "재정부 전용" },
      { num: "07", element: "기록 · 증빙 묶음 (재정부 전용)", description: "완료되어 저장된 증빙 묶음(📦)을 행사 기준으로 열람한다. 구매처·결제·영수증·실제 지출과 담긴 개별 실행분(▪)을 보여준다. 서로 다른 요청·승인 묶음의 실행분도 같은 거래면 한 묶음에 담긴다.", constraint: "재정부 전용(기준 문서: 증빙 아카이브 원본은 재정부 열람). 증빙 묶음은 완료 시 레코드로 저장되어 다시 열람할 수 있다" },
      { num: "08", element: "내 구매 요청", description: "MY-REQ-01로 이동한다 (2026-07-19 위치 확정)." },
      { num: "09", element: "새 구매 요청", description: "재정부·부서장에게만 FIN-REQ-01B 작성 진입점을 표시한다." },
    ],
    exceptions: ["구매 요청이 없으면 품목·요청 목록과 단계별 건수에 빈 상태를 표시한다", "보완 상태는 요청자에게 ‘보완 필요’, 다른 구성원에게 ‘보완 중’으로 표시한다", "주문 완료를 수령 완료로 간주하지 않으며 배송 완료 후에도 재정부의 수령 확인이 필요하다"],
    nextScreens: ["MY-REQ-01 내 구매 요청", "FIN-REQ-01B 작성", "FIN-REV-01 검토"],
  },
  "EVT-FIN-01B": {
    id: "EVT-FIN-01B", name: "행사 재정 — 개요 · 재정부", stateChip: "재정부",
    purpose: "재정부가 이 행사의 다음 재정 처리 업무와 품목별 진행 상태를 함께 확인한다.",
    users: "재정부",
    entryPath: "행사 > 재정 탭 (재정부)",
    functions: [
      { num: "01", element: "하위 메뉴 그룹(작업 보드·기록)", description: "탭을 [작업 보드](품목 현황·처리 단계)와 [기록](구매 요청·승인 묶음·증빙 묶음) 두 묶음으로 나눈다. 기본 진입은 작업 보드의 처리 단계다.", constraint: "기록 탭은 요청·묶음 단위 아카이브로, 묶음(📦)과 개별(▪)의 경계를 시각적으로 구분한다" },
      { num: "02", element: "처리 단계 7개 업무 영역", description: "요청 검토·구매 준비·물품 배송·수령·대여 이행·용역 이행·환불·증빙의 7개 업무 영역을 하위 메뉴(영역 탭)로 전환하며, 선택한 영역의 처리 단계 칸반만 표시한다. 구매 준비는 선진행 동의 대기·주문 대기·재주문 보류·구매 불가 처리 필요, 환불은 환불 대기·환불 확인·재주문 판단으로 구성한다(취소 실행분의 환불 확인 직후 재주문 판단이 이어지므로 환불 영역에 둔다). 물품 배송·수령은 배송 대기→배송 중→수령 확인 필요, 대여 이행은 이행 대기→이행 중→반납 확인 필요→이행 완료, 용역 이행은 이행 대기→이행 중→이행 완료(반납 없음)로 구성하며, 주문 취소 요청 확인은 해당 실행분의 구매 유형(물품/대여/용역) 영역에 표시한다. 각 영역 안에서 정상 진행 흐름 열(순차, → 연결)과 예외·후속 열(보완 응답 대기·재검토 대기·재주문 보류·구매 불가 처리 필요·주문 취소 요청 확인·재주문 판단)을 구분해, 예외·후속 열은 구분선 뒤에 호박색 테두리와 ‘예외’ 태그로 시각 분리한다. 한 열에서 같은 구매 요청(REQ)의 카드가 2개 이상이면 반쯤 겹친 스택(📦 N)으로 묶고, 마우스를 올리면 개별 카드로 펼쳐지고 묶음 밖으로 커서가 나가면(또는 바깥 클릭 시) 접힌다.", constraint: "영역별 카운트 배지로 각 영역의 미완료 업무 수를 함께 표시한다. 배송·수령·이행을 구매 유형에 따라 물품·대여·용역 세 영역으로 나눈다. 대여의 반납은 반납 확인 필요 단계로 처리하고 보증금은 증빙·실제 지출 흐름으로 흡수한다. 정상 흐름과 예외·후속 열을 시각적으로 구분한다. 같은 요청 카드 스택은 표시 방식일 뿐 상태·집계를 바꾸지 않는다" },
      { num: "03", element: "카드 빠른 처리 팝오버", description: "처리 단계 보드의 실행분 카드를 누르면 옆에 작은 팝오버가 열려 그 단계의 유효한 다음 액션만 바로 처리한다(구매 진행 동의, 주문 완료·구매 불가, 배송·수령·이행 단계 진행, 취소 요청 확정, 환불 확인 전액·일부·없음). 증빙 필요·정리 중은 ‘증빙 처리하기’로 결제·증빙 정리(FIN-EVID-01)에 직행하고, 검토·재주문 등은 상세보기로 해당 화면에서 처리한다.", constraint: "상태 전이 규칙을 지키기 위해 임의 상태 선택이 아닌 다음 액션만 노출한다. 처리 시 담당자·시각을 기록한다" },
      { num: "04", element: "품목 현황 칸반보드 전환", description: "품목의 대표 진행 단계별 칸반보드로 전환한다. 재정부가 보는 카드에는 일반 구성원용 상태와 재정부 세부 처리 상태를 함께 표시한다. ‘전체 요청 / 내 요청’ 필터로 내가 요청한 품목만 볼 수 있다." },
      { num: "05", element: "기록(구매 요청·승인 묶음·증빙 묶음)", description: "요청 단위(구매 요청), 요청 내 승인 품목 묶음(승인 묶음, 파생), 구매처·영수증 기준 실행분 재구성(증빙 묶음, 저장 레코드)을 각각의 하위 탭에서 열람한다.", constraint: "승인 묶음은 파생 표시, 증빙 묶음은 완료 시 저장되어 재열람된다" },
      { num: "06", element: "예산 조정", description: "사용 가능 예산만 항목 사이에서 이동하고 처리자·시각·사유를 남긴다." },
      { num: "07", element: "처리 화면 진입", description: "요청 상태에 따라 이동한다. 검토 대기는 구매 요청 검토(FIN-REV-01), 보완 요청(보완 응답 대기)·재검토 대기는 보완 재검토(FIN-REV-01B), 승인·구매 필요는 구매·발주(FIN-PROC-01), 증빙 필요는 결제·증빙 정리(FIN-EVID-01)로 연결한다. 상단 액션 바의 ‘증빙 정리’ 버튼(재정부 전용)으로 FIN-EVID-01에 상시 직행할 수 있다." },
    ],
    exceptions: ["재정부 소속이 아니면 이 변형의 처리 단계와 예산 조정 행동을 사용할 수 없다", "처리 단계와 품목 현황은 같은 원본 상태에서 계산한다"],
    nextScreens: ["FIN-REV-01 검토", "FIN-PROC-01 구매·발주", "FIN-EVID-01 증빙"],
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
      { num: "05", element: "전체 캘린더 보기", description: "행사·회의·마감 통합 월간 캘린더(OPS-CAL-01)로 이동하며, 이 행사의 대표 시점(행사 당일 우선, 없으면 가장 이른 일정)을 calendarFocus로 넘겨 달력에서 선택 행사의 일정을 바로 식별하게 한다.", constraint: "홈에서 쓰는 calendarFocus 강조 동작과 동일한 상태를 공유" },
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
      { num: "01", element: "문서 현황 요약·상태 필터", description: "전체 문서 수와 작성 중·검토 중 수를 요약하고, 상태별로 목록을 좁혀 본다." },
      { num: "02", element: "문서 목록", description: "한 열 목록에서 분류, 문서명, 한 줄 설명, 작성 상태, 최근 갱신 정보를 읽기 쉽게 표시한다." },
    ],
    exceptions: ["문서 업로드·작성·검토 버튼은 이 화면에서 제공하지 않는다. 역할별 권한은 연결된 업무와 행사 운영 역할에서 판단한다."],
  },
  // ─── 신규 화면 정의서 (2026-07-19) ──────────────────────────────────────────
  "OPS-00": {
    id: "OPS-00", name: "운영 홈 — 업무·회의·행사·캘린더", stateChip: "기본",
    purpose: "학생회 운영의 네 하위 공간 중 필요한 업무 영역을 선택하는 진입 허브.",
    users: "재정부 · 부서장",
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
      { num: "01", element: "월간 그리드", description: "요일별 날짜와 행사·회의·마감 일정을 표시하고 오늘을 강조한다. 행사·상시 업무의 미완료 마감일, 생성 회의의 실제 예정 일시, 선택 행사의 행사 당일 항목도 자동으로 반영하며, 이전·다음 달로 이동할 수 있다. 홈 또는 행사 일정(EVT-SCHED-01)에서 넘어온 calendarFocus가 있으면 해당 날짜와 안내 배너로 강조한다." },
      { num: "02", element: "유형 필터·색상 범례", description: "전체·행사·회의·마감으로 표시 항목을 거르고, 행사=초록·회의=보라·마감=주황의 고정 색상과 범례로 일정 유형을 구분한다." },
      { num: "03", element: "이번 주 일정 패널", description: "이번 주 일정을 목록으로 표시하고 일정 유형에 맞는 원본 업무·회의·행사로 이동한다. 업무 마감은 원래 행사 업무 상세 또는 상시 업무 상세 패널로, 생성 회의는 해당 회의의 상세 또는 완료 회의록으로 이동한다." },
      { num: "04", element: "행사 일정 보기 보조 행동", description: "eventId가 있는 일정(고정 행사 샘플·행사 업무 마감·행사에 연결된 생성 회의·행사 당일)에는 주 이동과 별도로 행사 일정 보기 보조 버튼을 제공해, 소유 행사를 선택하고 해당 행사의 일정 탭(EVT-SCHED-01)으로 이동한다. 상시 업무·조직 일정에는 제공하지 않는다.", constraint: "주 이동(업무·회의·행사 목록)과 별도 버튼으로 두어 버튼 중첩을 만들지 않음" },
      { num: "05", element: "일정 생성 없음", description: "캘린더는 열람 전용이다.", constraint: "회의는 운영>회의, 행사 일정은 각 행사의 일정 탭에서 생성" },
    ],
    exceptions: ["일정이 없으면 빈 월간 그리드와 안내를 표시하고 임의 일정을 만들지 않는다", "취소된 회의와 완료된 업무 마감은 다가오는 일정에서 제외한다"],
    nextScreens: ["EVT-SCHED-01 행사 일정", "EVT-TASK-02 행사 업무 상세", "OPS-TASK-01 상시 업무", "OPS-MEET-01A 전체 회의", "EVT-00A 행사 목록"],
  },
  "FIN-LEDGER-01": {
    id: "FIN-LEDGER-01", name: "사용 내역", stateChip: "기본",
    purpose: "학생회 예산이 언제, 어디에 사용되었는지 시간순으로 열람한다.",
    users: "전 구성원 (열람 전용)",
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
      { num: "02", element: "기능 영역별 권한 표", description: "재정·회의·행사·조직·학생 명단 영역의 권한을 회장단·부서장·부원 열로 표시한다. 가능·조건부(재정부만 등)·불가(—)로 구분한다.", constraint: "2026-07-19 확정된 권한 매트릭스가 단일 기준이다. 화면에 새 권한 규칙이 생기면 이 표에도 같은 작업에서 행을 추가한다" },
      { num: "03", element: "맥락 역할 안내", description: "회의 진행 권한자·생성자, 행사 운영 조직 역할의 부여 규칙을 설명하고, 권한 표에 쓰인 `행사 조직만`과 `행사 조직 관리자만`의 뜻을 함께 정의한다. 행사 조직 관리자도 행사를 최종 완료 처리할 수 없으며 행사 완료 처리는 회장단만 가능함을 명시한다." },
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
    exceptions: ["회장단이 아닌 사용자는 권한 변경 화면에 진입할 수 없다", "마지막 회장단을 다른 역할로 변경하거나 같은 역할 변경을 중복 적용할 수 없다", "회장단만 진입할 수 있는 역할 변경 화면이다. 검토용으로 회장단 사용자를 주입한다"],
  },
  "EVT-00A2": {
    id: "EVT-00A2", name: "행사 목록 — 운영진", stateChip: "기본",
    purpose: "운영진 관점의 행사 목록. 새 행사 생성으로 진입한다.",
    users: "회장단 · 부서장",
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
    purpose: "내 프로필에 표시될 학적 정보를 등록한다.",
    users: "가입한 모든 사용자",
    entryPath: "회원가입 완료 → 본인 소속 입력",
    preconditions: "로그인 또는 회원가입 완료",
    functions: [
      { num: "01", element: "진행 단계", description: "`기본 설정 1 / 2`를 표시하고, 다음 단계가 시작 방식 선택임을 버튼과 안내 문구로 알린다." },
      { num: "02", element: "학교 검색", description: "학교명을 검색해 선택한다. 캠퍼스는 학교명에 포함한다 (예: 한양대학교 ERICA)." },
      { num: "03", element: "단과대학 검색", description: "학교 선택 후 활성화한다. 선택한 학교에 속한 단과대학만 검색 결과로 표시한다." },
      { num: "04", element: "학부·학과 검색", description: "단과대학 선택 후 활성화한다. 선택한 단과대학에 속한 학부·학과만 검색 결과로 표시한다." },
      { num: "05", element: "검색 결과 없음·직접 입력", description: "학교·단과대학·학부·학과 검색 결과가 없을 때만 직접 입력으로 사용할 수 있다.", constraint: "기본 화면에 직접 입력 링크를 반복 노출하지 않는다" },
      { num: "06", element: "기본 프로필", description: "이름과 학번을 먼저 묶어 입력한다. 학번은 학생 식별 기준이므로 필수 입력이다." },
      { num: "07", element: "현재 학년", description: "학적 정보 묶음의 마지막에 현재 학년을 선택한다." },
      { num: "08", element: "다음: 시작 방식 선택", description: "필수값 검증 후 ONB-02로 이동한다.", constraint: "누락 시 오류를 표시하고 이동하지 않는다" },
    ],
    exceptions: ["개인 소속과 학생회 대표 범위는 별도 데이터", "목록에 없는 소속은 직접 입력 가능"],
    nextScreens: ["ONB-02 시작 방식 선택"],
  },
  "INV-00": {
    id: "INV-00", name: "초대 코드 입력", stateChip: "기본",
    purpose: "초대 코드를 입력해 참여할 학생회를 확인한다.",
    users: "가입한 모든 사용자",
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
    users: "가입한 모든 사용자",
    entryPath: "ONB-01 → 시작 방식 선택",
    functions: [
      { num: "01", element: "새 학생회 만들기", description: "ORG-01 새 학생회 생성으로 이동한다." },
      { num: "02", element: "초대받은 학생회 참여하기", description: "초대 링크 또는 참여 정보 확인 흐름으로 이동한다." },
      { num: "03", element: "진행 단계", description: "온보딩 2/2를 표시한다." },
    ],
    exceptions: ["초대 링크로 직접 접속한 경우 ONB-02를 건너뛰고 INV-01로 이동", "다른 학생회에 이미 참여 중인 경우 참여 제한 안내"],
    nextScreens: ["ORG-01 새 학생회 생성", "INV-00 초대 코드 입력"],
  },
  "ORG-01": {
    id: "ORG-01", name: "새 학생회 생성", stateChip: "기본",
    purpose: "새 학생회의 기본 정보와 관리 범위를 설정한다.",
    users: "가입한 모든 사용자",
    entryPath: "ONB-02 → 새 학생회 만들기",
    functions: [
      { num: "01", element: "진행 단계", description: "`기본 정보 1 / 2`를 표시하고 다음 단계가 조직 구조 설정임을 안내한다." },
      { num: "02", element: "학생회 유형", description: "총학생회, 단과대 학생회, 학부·학과 학생회, 기타 중 하나를 선택한다." },
      { num: "03", element: "유형별 대표 범위", description: "총학생회는 학교만, 단과대 학생회는 학교·단과대학, 학부·학과 학생회는 학교·단과대학·학부·학과를 검색해 선택한다. 기타는 대표 범위를 자유 입력한다.", constraint: "유형 변경 시 기존 대표 범위 입력을 초기화하며, 이후 학생 명단 관리 범위를 결정" },
      { num: "04", element: "학생회명", description: "공식 학생회 이름을 입력한다. (예: 제12대 소프트웨어융합대학 학생회)" },
      { num: "05", element: "운영 연도", description: "연도 단위 selector로 제공한다. 기본값은 현재 연도.", constraint: "기수·임기명, 시작일·종료일 입력 없음" },
      { num: "06", element: "추천값 안내", description: "개인 소속을 추천값으로만 표시하고 대표 범위로 강제하지 않는다." },
      { num: "07", element: "다음: 조직 구조 설정", description: "입력값을 저장하고 ORG-02로 이동한다. 버튼 아래에 다음 단계에서 기본 조직 또는 빈 조직을 선택하고 부서를 구성함을 안내한다." },
    ],
    exceptions: ["필수 학생회 정보가 없거나 중복된 학생회명인 경우 생성하지 않는다", "생성 취소 시 부분 입력 조직을 남기지 않는다"],
    nextScreens: ["ORG-02 조직 구조 설정"],
  },
  "ORG-02": {
    id: "ORG-02", name: "조직 구조 설정", stateChip: "기본",
    purpose: "학생회 생성 직후 회장단과 부서의 기본 구조를 만든다.",
    users: "가입한 모든 사용자",
    entryPath: "ORG-01 → 조직 구조 설정",
    functions: [
      { num: "01", element: "진행 단계", description: "`조직 구조 설정 2 / 2`를 표시한다." },
      { num: "02", element: "시작 방식", description: "`기본 조직`과 `빈 조직` 두 가지를 설명과 함께 카드로 제시하고 하나를 선택한다. 기본 조직은 `일반적인 학생회 조직을 생성합니다`, 빈 조직은 `회장단만 생성하고 필요한 부서를 직접 추가합니다`로 안내한다.", constraint: "템플릿 선택지는 제공하지 않는다" },
      { num: "02B", element: "빈 조직 상태", description: "빈 조직을 선택하면 부서 카드를 두지 않고 부서 추가 카드만 남긴다. 안내 문구도 부서를 직접 만들도록 바꾼다.", constraint: "회장단 카드 자체는 두 방식 모두에서 항상 표시한다. 두 방식의 차이는 기본 부서의 유무뿐이다" },
      { num: "03", element: "회장단 조직 카드", description: "조직도 최상단에 위치한 조직 카드. 이 단계에서는 구성원 없이 카드만 만들고 `구성원은 다음 단계에서 배정합니다`를 표시한다.", constraint: "이 화면은 조직 구조만 만드는 단계이므로 아직 초대되지 않은 구성원을 배치하지 않는다. 구성원 추가 버튼도 노출하지 않으며, 배정은 구성원 초대 이후 조직 관리에서 한다" },
      { num: "04", element: "부서 카드", description: "기획부, 홍보부, 디자인부 등 부서 구조를 표시한다. 구성원 배정은 다음 단계에서 진행." },
      { num: "05", element: "부서 추가", description: "＋ 부서 추가 버튼으로 새 부서를 만든다." },
      { num: "06", element: "부서 카드 … 메뉴", description: "각 부서 카드 우측 상단 … 버튼을 클릭하면 '부서명 수정', '부서 삭제' 메뉴가 나타난다.", constraint: "부서명 수정은 인라인 편집. Enter 저장, Esc 취소. 공백·중복 오류. 삭제는 확인 dialog 필요" },
      { num: "07", element: "조직 만들기", description: "설정한 구조를 저장하고 ORG-03 조직 관리 메인으로 이동한다." },
    ],
    exceptions: ["최소 하나의 운영 조직과 회장단 책임자를 지정하기 전에는 설정을 완료할 수 없다", "같은 구성원을 중복 책임자로 등록하지 않는다"],
    nextScreens: ["ORG-03A 조직 관리 메인"],
  },
  "INV-01": {
    id: "INV-01", name: "초대받은 학생회 확인", stateChip: "기본",
    purpose: "초대받은 학생회 정보를 확인하고, 초대 링크로 처음 접속한 사용자의 소속 입력 후 참여를 확정한다.",
    users: "가입한 모든 사용자",
    entryPath: "초대 코드 확인 또는 초대 링크 → 로그인·가입",
    functions: [
      { num: "01", element: "학생회 정보", description: "학생회명, 유형, 대표 범위, 운영 연도를 표시한다." },
      { num: "02", element: "본인 소속 입력", description: "초대 링크로 처음 접속한 사용자는 학교·단과대학·학부·학과·학년·학번을 입력한다. 기존 프로필이 있으면 저장된 소속을 표시한다." },
      { num: "03", element: "학생회 참여하기", description: "필수 소속 정보를 확인한 뒤 미배정 구성원으로 추가하고 학생회 홈으로 이동한다." },
      { num: "04", element: "참여하지 않기", description: "참여 처리 없이 거절 안내를 표시하고 처음 화면으로 돌아갈 수 있다." },
    ],
    exceptions: ["만료·사용 완료·잘못된 초대는 참여할 수 없다", "필수 소속 정보가 없으면 참여·홈 이동을 허용하지 않는다", "소속 부서가 미배정이면 임의 부서에 자동 배치하지 않는다"],
    nextScreens: ["HOME-01 학생회 홈"],
  },
  "ORG-03A": {
    id: "ORG-03A", name: "조직 관리 — 보기", stateChip: "기본",
    purpose: "학생회 전체 조직과 구성원의 현재 배치 상태를 확인한다.",
    users: "전 구성원 (열람)",
    entryPath: "사이드바 조직 관리 → 부서 및 구성원",
    functions: [
      { num: "01", element: "회장단 카드", description: "조직도 최상단에 위치. 회장·부학생회장 등 여러 구성원 카드를 포함. 클릭 시 상세 팝오버." },
      { num: "02", element: "부서 카드", description: "부서장, 부원 수, 구성원 카드를 표시. 부서장 없으면 ＋ 부서장 지정 표시." },
      { num: "03", element: "구성원 카드", description: "이름, 학부·학과, 학년 표시. 클릭 시 상세 팝오버 열림.", constraint: "팝오버에서 부서 이동 가능" },
      { num: "04", element: "수정 버튼", description: "수정 모드(ORG-03B)로 전환한다.", constraint: "회장단만 노출한다. 부서장·부원에게는 버튼을 비활성화가 아니라 표시하지 않는다" },
      { num: "05", element: "구성원 초대 버튼", description: "초대 링크 UI(ORG-03C)로 전환한다.", constraint: "회장단·부서장만 노출한다. 부서장은 자기 부서만 초대할 수 있다" },
    ],
    exceptions: ["조직 정보가 없으면 빈 상태와 설정 진입을 제공한다", "보기 모드에서는 미배정 구성원을 표시하지 않는다", "편집 권한이 없는 구성원에게 수정·초대 행동을 노출하지 않는다"],
    nextScreens: ["ORG-03B 수정 모드", "ORG-03C 초대 패널"],
  },
  "ORG-03B": {
    id: "ORG-03B", name: "조직 관리 — 수정", stateChip: "수정 모드",
    purpose: "구성원과 부서 구조를 같은 화면에서 수정한다.",
    users: "회장단",
    entryPath: "ORG-03A → 수정 버튼",
    functions: [
      { num: "01", element: "완료 버튼", description: "수정 내용을 저장하고 보기 모드(ORG-03A)로 복귀." },
      { num: "02", element: "미배정 구성원 패널", description: "수정 모드에 진입하면 오른쪽에 항상 표시한다. 미배정 구성원을 검색하고 부서로 드래그한다.", constraint: "드래그 중에도 카드 크기·형태 유지" },
      { num: "03", element: "구성원 제거 (－)", description: "부서 카드의 － 클릭 시 확인 dialog. 제거 시 미배정으로 이동하며 실행 취소 toast 제공." },
      { num: "04", element: "미배정 구성원 삭제", description: "미배정 패널의 삭제를 누르면 확인 dialog 후 학생회 구성원에서 제거한다.", constraint: "부서 배정 해제와 달리 조직도와 구성원 목록에서 제거한다" },
      { num: "05", element: "부서 추가·수정·삭제", description: "별도 페이지 없이 현재 조직도에서 처리한다." },
      { num: "06", element: "부서장 지정", description: "구성원을 부서장으로 임명 전 확인 dialog 표시." },
      { num: "07", element: "회장단 수정", description: "회장단 카드 내부에서도 구성원 추가·이동·제거 가능. 제거를 누르면 회장단 제외·미배정 이동 영향을 설명하는 확인 modal을 표시한다.", constraint: "마지막 회장단은 제거할 수 없으며 먼저 다른 구성원을 회장단으로 지정하도록 안내한다" },
      { num: "08", element: "구성원 초대 버튼", description: "헤더의 구성원 초대를 누르면 ORG-03C 초대 패널로 이동한다." },
    ],
    exceptions: ["마지막 회장단 또는 필수 조직 단위를 삭제할 수 없다", "저장하지 않고 나가면 변경 내용을 조직도에 반영하지 않는다", "회장단만 진입할 수 있는 수정 모드다. 검토용으로 회장단 사용자를 주입한다"],
    nextScreens: ["ORG-03A 보기 모드 (완료)"],
  },
  "ORG-03C": {
    id: "ORG-03C", name: "구성원 초대 패널", stateChip: "패널 열림",
    purpose: "학생회 공용 초대 링크를 관리한다.",
    users: "회장단 · 부서장",
    entryPath: "ORG-03A 또는 ORG-03B → 구성원 초대 버튼",
    functions: [
      { num: "01", element: "초대 정보 상태", description: "초대 정보의 활성 상태, 현재 사용 가능 여부, 마지막 재생성 시각을 표시한다." },
      { num: "02", element: "초대 링크", description: "현재 학생회의 공용 초대 링크를 표시하고 복사·개별 재생성을 제공한다." },
      { num: "03", element: "짧은 초대 코드", description: "링크와 동일한 초대 권한을 짧은 코드 형식으로 제공하고 복사·개별 재생성을 제공한다. (예: AB12CD34)" },
      { num: "04", element: "개별 재생성", description: "링크 또는 코드만 새로 만든다. 확인 modal에서 해당 정보만 즉시 무효화된다고 안내한다.", constraint: "다른 초대 정보와 기존 초대로 참여한 구성원에게 영향을 주지 않는다" },
      { num: "05", element: "초대 정보 모두 재생성", description: "새 링크와 코드를 함께 만들고 기존 링크·코드를 즉시 무효화한다. 확인 modal에 기존 참여 구성원에게 영향이 없음을 안내한다." },
      { num: "06", element: "뒤로가기", description: "조직 관리 보기(ORG-03A)로 복귀한다." },
    ],
    exceptions: ["초대받아 가입한 구성원은 미배정으로 자동 추가", "링크·코드는 별도 초대 권한이 아닌 동일한 권한의 두 가지 형식", "회장단·부서장만 진입할 수 있는 초대 패널이다. 검토용으로 회장단 사용자를 주입하며, 부서장은 자기 부서만 초대할 수 있다"],
    nextScreens: ["ORG-03A 보기 모드"],
  },
  "ORG-07A": {
    id: "ORG-07A", name: "학생 명단 관리", stateChip: "회장단 관리",
    purpose: "업로드한 학생 기본 명단과 학기별 학생회비 납부 상태를 함께 조회하고 행사 신청자 대조의 기준 데이터로 사용한다.",
    users: "전 구성원 (열람) · 회장단 (관리)",
    entryPath: "사이드바 조직 관리 → 학생 명단",
    functions: [
      { num: "01", element: "관리 범위·갱신 안내", description: "대표 범위와 학생 기본 명단·학생회비 납부 명단의 마지막 갱신 시각·작성자를 각각 표시한다. 이 화면에서 범위 변경 불가.", constraint: "범위 변경은 조직 설정에서만 가능. 두 데이터의 갱신 이력은 서로 덮어쓰지 않는다" },
      { num: "02", element: "학생 명단 업로드·갱신", description: "ORG-07B에서 기존 파일을 바로 업로드하고 검증 결과를 확인한 뒤 학생 기본 명단에 반영한다.", constraint: "회장단만 노출한다. 학생회비 상태는 변경하지 않는다" },
      { num: "03", element: "학생회비 납부 명단 업로드", description: "ORG-07C에서 기준 학기의 전체 납부자 명단을 업로드하고 학생 명단과 대조한 뒤 납부 상태를 반영한다.", constraint: "재정부·회장단만 노출한다. 학생 기본정보를 생성·수정하지 않는다" },
      { num: "04", element: "명단 내보내기", description: "내보낼 인원 수·포함 정보·개인정보 취급 주의를 확인 dialog로 안내한 뒤, 현재 검색·학년·학생회비 필터 결과를 UTF-8 CSV 파일로 내보낸다.", constraint: "회장단만 노출한다. 이름·학번·단과대학·학부·학과·학년·학생회비 열을 포함하며, 필터 결과가 없으면 비활성화한다" },
      { num: "05", element: "검색·필터", description: "이름·학번 검색, 단과대학, 학부·학과, 학년, 학생회비 납부 여부 필터를 제공한다." },
      { num: "06", element: "학생 명단 표", description: "이름, 학번, 단과대학, 학부·학과, 학년, 학생회비 상태를 열로 표시한다.", constraint: "단과대학과 학부·학과는 관리 범위와 무관하게 항상 표시한다. 범위가 학부 단위여서 값이 같더라도 생략하지 않는다" },
      { num: "07", element: "학생회비 상태 chip", description: "납부 / 미납 / 미확인 세 가지 기본 상태를 사용한다. 학번·이름 불일치 등 정상 판단이 불가능할 때만 확인 필요를 사용한다." },
      { num: "08", element: "행사 설문 연결", description: "참여 설문의 학번을 학생 기본 명단과 학기별 학생회비 상태에 대조해 참가비를 자동 결정한다. 미확인·확인 필요 상태는 미납으로 추정하지 않는다." },
    ],
    exceptions: ["학번 일치·이름 불일치 → 확인 필요", "대표 범위 밖 학생은 업로드 파일 검증 오류로 처리하며 명단에 존재하지 않는다", "학생회비 명단이 아직 없거나 기준 학기가 다르면 미확인으로 표시", "갱신 이력이 없으면 시각을 지어내지 않고 갱신 전 상태로 표시한다", "검색·필터 결과가 없으면 빈 명단을 내보내지 않는다", "검토 화면은 두 업로드 진입점과 내보내기를 확인할 수 있도록 회장단 사용자를 주입한다"],
    nextScreens: ["ORG-07B 학생 명단 업로드·갱신 모달", "ORG-07C 학생회비 납부 명단 업로드 모달"],
  },
  "ORG-07B": {
    id: "ORG-07B", name: "학생 명단 업로드·갱신 모달", stateChip: "모달 열림",
    purpose: "기존 학생 명단 파일을 업로드해 이름·학번·소속·학년으로 구성된 학생 기본 명단을 갱신한다.",
    users: "회장단",
    entryPath: "ORG-07A → 학생 명단 업로드·갱신",
    functions: [
      { num: "01", element: "파일 업로드", description: "드래그 앤 드롭 또는 파일 선택으로 기존 .xlsx·.csv 파일을 업로드한다. 필수 열은 이름·학번·단과대학·학부·학과·학년이다.", constraint: "별도 양식을 다운로드하거나 학생회비 상태를 함께 입력하지 않는다" },
      { num: "02", element: "검증 결과", description: "필수 열 누락·이름·학번 누락·학번 형식 오류·중복 학번·대표 범위 밖 학생을 확인하고 반영 가능한 수를 보여준다.", constraint: "치명적 오류가 있으면 전체 반영을 막고 파일 다시 선택 경로를 제공한다" },
      { num: "03", element: "명단 반영", description: "검증을 통과하면 학번 기준으로 학생을 등록·갱신하고 현재 명단에서 제외되는 수를 요약한다.", constraint: "학생회비 상태, 행사 참가자, 과거 행사 기록은 변경하거나 삭제하지 않는다" },
    ],
    exceptions: ["지원하지 않는 파일·필수 열 누락·중복 학번·대표 범위 밖 학생은 반영하지 않는다", "학생회비 상태 열이 포함되어 있어도 학생 기본 명단 업로드에서는 무시한다", "회장단만 진입할 수 있는 업로드 모달이다. 검토용으로 회장단 사용자를 주입한다"],
    nextScreens: ["ORG-07A 학생 명단 관리"],
  },
  "ORG-07C": {
    id: "ORG-07C", name: "학생회비 납부 명단 업로드 모달", stateChip: "모달 열림",
    purpose: "기준 학기의 전체 학생회비 납부자 명단을 학생 기본 명단과 대조해 학기별 납부 상태를 갱신한다.",
    users: "재정부 · 회장단",
    entryPath: "ORG-07A → 학생회비 납부 명단 업로드",
    functions: [
      { num: "01", element: "기준 학기", description: "납부 상태를 적용할 연도·학기를 선택한다.", constraint: "학기별 기록을 보존하며 다른 학기의 상태를 덮어쓰지 않는다" },
      { num: "02", element: "파일 업로드", description: "해당 학기의 전체 납부자 명단 .xlsx·.csv 파일을 업로드한다. 학번은 필수이며 이름은 일치 여부 확인에 사용한다." },
      { num: "03", element: "검증 결과", description: "학생 기본 명단과 일치·미일치·중복 건수를 표시한다. 기준 명단에 없는 학번은 학생을 새로 만들지 않고 확인 항목으로 분류한다." },
      { num: "04", element: "납부 상태 반영", description: "일치한 학생은 납부, 같은 학기의 기준 명단에 있으나 파일에 없는 학생은 미납으로 반영한다.", constraint: "학생 기본정보와 과거 학기 납부 상태는 변경하지 않는다" },
    ],
    exceptions: ["학생 기본 명단이 없으면 먼저 학생 명단 업로드를 안내한다", "학번 일치·이름 불일치는 확인 필요로 분류한다", "미일치·중복 항목이 있으면 수정 방법과 파일 다시 선택 경로를 제공한다", "재정부·회장단만 진입할 수 있다. 검토용으로 재정부 사용자를 주입한다"],
    nextScreens: ["ORG-07A 학생 명단 관리"],
  },
  "EVT-00A": {
    id: "EVT-00A", name: "행사 목록 — 일반 구성원", stateChip: "기본",
    purpose: "현재 기획 중이거나 운영 및 후속 정리가 진행 중인 행사를 한곳에서 확인한다. 완료된 행사는 기록 > 완료된 행사에서 확인한다.",
    users: "전 구성원 (열람)",
    entryPath: "사이드바 운영 → 행사",
    preconditions: "로그인 및 학생회 참여 완료",
    functions: [
      { num: "01", element: "새 행사 만들기", description: "EVT-00B 새 행사 만들기 모달을 열고 행사 공간을 생성한다. 생성 직후 상태는 기획 중. 권한 매트릭스에 따라 회장단·부서장 화면(EVT-00A2)에서만 노출된다." },
      { num: "02", element: "완료된 행사 보기 링크", description: "기록 > 완료된 행사(REC-01)로 이동한다.", constraint: "완료 필터를 이 화면에 두지 않음" },
      { num: "03", element: "행사 검색", description: "행사명 또는 가칭으로 목록을 검색한다." },
      { num: "04", element: "상태 필터", description: "전체 / 기획 중 / 진행 중 / 후속 정리 중 필터를 제공한다.", constraint: "완료 필터 없음. 상태는 관리자가 수동으로 변경하며 자동 계산하지 않음" },
      { num: "05", element: "행사 카드", description: "행사명, 상태 배지, 일시, 장소, 담당 부서/담당자, 마지막 수정 시각, 후속 정리 중이면 남은 항목 요약을 표시한다. 미정 정보는 미정으로 표시한다. 전체 진행률 퍼센트는 표시하지 않는다." },
      { num: "06", element: "행사 진입", description: "행사 카드를 클릭하면 해당 행사의 EVT-02 행사 개요로 이동한다." },
      { num: "07", element: "행사 더보기", description: "카드 우측 상단 … 버튼으로 행사 정보 수정, 보관, 삭제 action을 제공한다. 삭제는 확인 dialog를 거친다.", constraint: "회장단·부서장 화면(EVT-00A2)에서만 노출한다. 일반 구성원(EVT-00A)에는 더보기 버튼을 표시하지 않는다." },
      { num: "08", element: "빈 상태", description: "행사가 없으면 빈 상태를 안내한다. 회장단·부서장에게는 행사명만으로 공간을 생성할 수 있음을 안내하고 첫 행사 만들기 버튼을 제공한다.", constraint: "첫 행사 만들기 버튼은 회장단·부서장(EVT-00A2)에게만 노출하고, 일반 구성원에게는 안내 문구만 표시한다." },
    ],
    exceptions: ["등록된 행사 없음 — 빈 상태", "검색 결과 없음 — 검색 빈 상태와 필터 초기화", "행사 삭제 확인 dialog", "일시·장소 미정 — 미정 텍스트 표시"],
    nextScreens: ["EVT-00B 새 행사 만들기 모달", "EVT-02 행사 개요 대시보드", "REC-01 완료된 행사 목록"],
  },
  "EVT-00B": {
    id: "EVT-00B", name: "새 행사 만들기 모달", stateChip: "모달 열림",
    purpose: "행사명만 입력해 행사 공간을 즉시 생성한다. 생성 직후 상태는 기획 중이며 나머지 정보는 이후 채운다.",
    users: "회장단 · 부서장",
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
    users: "행사 운영 조직 관리자 · 회장단",
    entryPath: "행사 > 인원 관리 > 운영 조직 빈 상태(EVT-03C) → 운영 조직 구성하기 (2026-07-19 흐름 확정 — 행사 생성 직후 필수 단계가 아님)",
    functions: [
      { num: "01", element: "시작 방식", description: "기본 조직 불러오기, 참여 부서만 선택, 빈 조직 중 하나를 선택한다." },
      { num: "02", element: "행사 책임자", description: "행사 전체 운영 책임자를 지정한다." },
      { num: "03", element: "참여 부서·팀", description: "행사에 참여할 부서나 임시 팀과 팀장·구성원을 배정한다." },
      { num: "04", element: "기본 조직 공유 안내", description: "행사 조직 변경은 기본 학생회 조직에 영향을 주지 않는다.", constraint: "행사 조직과 기본 조직은 별도 데이터" },
      { num: "05", element: "저장·이전", description: "저장하면 EVT-03A 운영 조직 보기로, 이전을 누르면 EVT-03C 빈 상태로 돌아간다." },
    ],
    exceptions: ["참여 부서가 하나도 없으면 빈 상태를 유지하고 임의 조직을 만들지 않는다", "같은 부서·구성원을 중복 추가하지 않는다", "검토용으로 행사 운영 조직에 속한 사용자를 주입한다"],
    nextScreens: ["EVT-03A 운영 조직 보기", "EVT-03C 운영 조직 빈 상태"],
  },
  "EVT-03C": {
    id: "EVT-03C", name: "운영 조직 — 빈 상태", stateChip: "빈 상태",
    purpose: "운영 조직이 아직 없는 행사에서 조직 구성의 시작점을 제공한다.",
    users: "행사 참가자 전원 (열람). 구성 진입은 행사 운영 조직 관리자 · 회장단",
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
    users: "행사 참가자 전원 (열람). 설문 생성 진입은 행사 운영 조직 관리자",
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
    id: "EVT-02", name: "행사 개요 — 기획 중", stateChip: "기획 중",
    purpose: "행사 데이터를 해석하고 현재 상황과 다음 행동을 보여주는 운영 판단 화면이다. 행사 상태와 권한에 따라 관리 행동을 분리한다.",
    users: "행사 참가자 전원 (열람). 관리 행동은 행사 운영 조직 관리자 · 회장단",
    entryPath: "사이드바 → 운영 → 행사 → 행사 선택 / EVT-00B 행사 만들기 완료",
    functions: [
      { num: "01", element: "행사 공통 헤더", description: "상태, 행사 업무의 지연·미배정·검토 필요 수로 계산한 건강도와 근거, 담당 부서·책임자, 행사일, 다음 미완료 업무를 행사 전 탭에서 공통 표시한다.", constraint: "건강도는 지연·담당자 없음 등 구체적 근거를 함께 표시" },
      { num: "02", element: "상태별 주요 액션 버튼", description: "기획 중: 행사 시작 / 진행 중: 행사 종료 / 후속 정리 중: 행사 완료 처리 / 완료: 버튼 없음", constraint: "행사 시작·종료는 행사 운영 조직 관리자·회장단에게 노출. 후속 정리 중의 행사 완료 처리 버튼은 회장단에게만 노출한다" },
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
    users: "행사 운영 조직 관리자 · 회장단",
    entryPath: "EVT-02 개요 대시보드 (진행 중) → 행사 종료 버튼",
    functions: [
      { num: "01", element: "안내 문구", description: "행사 운영은 종료되지만 미완료 업무와 문서를 계속 정리할 수 있음을 안내한다. 상태가 후속 정리 중으로 변경됨을 명시한다." },
      { num: "02", element: "취소 버튼", description: "모달을 닫고 EVT-02로 복귀한다." },
      { num: "03", element: "행사 종료 버튼", description: "행사 상태를 후속 정리 중으로 변경하고 EVT-02D로 이동한다.", constraint: "canEndEvent(회장단 또는 행사 운영 조직 관리자) 권한자에게만 노출한다. 권한이 없으면 버튼 대신 종료 권한 안내와 `행사 개요로` 복귀만 제공하고, 종료 함수에서도 권한을 재확인해 우회 호출로 상태를 바꾸지 않는다" },
    ],
    exceptions: ["행사 종료 권한이 없거나 이미 종료된 행사에는 확인 동작을 실행하지 않는다. 권한 판정은 canEndEvent(기본 역할 회장단 또는 맥락 역할 행사 운영 조직 관리자)로 하며 완료 처리(회장단 전용)와 다른 기준이다", "미완료 업무가 있어도 종료를 막지 않고 후속 정리 중으로 전환한다", "역할을 강제 주입하지 않고 현재 사용자를 그대로 사용한다. EVT-02D·EVT-02E로 이동해도 같은 사용자 신원과 행사 맥락 역할을 유지한다"],
    nextScreens: ["취소 → EVT-02 행사 개요 (진행 중)", "행사 종료 → EVT-02D 후속 정리 중 대시보드"],
  },
  "EVT-02D": {
    id: "EVT-02D", name: "행사 개요 — 후속 정리 중", stateChip: "후속 정리 중",
    purpose: "행사 운영이 종료된 후 후속 정리가 필요한 항목을 구체적으로 보여주고 완료 처리를 유도한다.",
    users: "열람·후속 정리는 행사 운영 조직 관리자 · 회장단. 최종 완료 처리는 회장단만.",
    entryPath: "EVT-02C 행사 종료 확인 → 행사 종료 / EVT-00A 행사 목록에서 후속 정리 중 행사 선택",
    functions: [
      { num: "01", element: "상태 배지", description: "후속 정리 중 배지를 행사명 근처에 표시한다. 주황색 계열." },
      { num: "02", element: "후속 정리 안내 영역", description: "행사는 종료되었으며 후속 정리가 진행 중임을 안내한다. 남은 업무와 기록 확인 후 완료 처리 가능." },
      { num: "03", element: "후속 정리 현황 카드", description: "미완료 업무 수, 정리되지 않은 문서 수, 미작성 회의·결정 기록 수, 확인 필요 참가자 수를 카드로 표시한다. 각 항목 클릭 시 해당 워크스페이스 메뉴로 이동." },
      { num: "04", element: "행사 완료 처리 버튼", description: "행사 공통 헤더의 상태별 주요 행동으로 제공하며 EVT-02E 완료 처리 확인 모달을 연다.", constraint: "완료 처리 버튼은 공통 헤더 한 곳에만 두어 화면에 중복 노출하지 않는다. 회장단에게만 노출하고, 회장단이 아니면 본문에 `행사 완료 처리는 회장단만 할 수 있습니다.` 안내만 표시한다. 후속 정리 항목 열람·처리는 그대로 유지한다" },
      { num: "05", element: "기본 정보 카드", description: "행사 기본 정보를 계속 표시한다." },
      { num: "06", element: "최근 변경 사항", description: "후속 정리 진행 중 변경 활동을 표시한다." },
    ],
    exceptions: ["임의 진행률 퍼센트 표시 금지. 구체적 남은 항목 수를 표시", "후속 정리 항목이 0이어도 완료 버튼은 회장단에게 항상 표시", "완료 처리 권한은 기본 역할 회장단만 가진다. 행사 책임자·행사 운영 조직 관리자여도 회장단이 아니면 완료할 수 없다", "역할을 강제 주입하지 않고 현재 사용자를 그대로 사용한다. 회장단 화면은 ORG-04B에서 기본 역할을 회장단으로 바꾼 뒤 확인한다"],
    nextScreens: ["EVT-02E 행사 완료 처리 확인 모달"],
  },
  "EVT-02E": {
    id: "EVT-02E", name: "행사 완료 처리 확인 모달", stateChip: "모달 열림",
    purpose: "후속 정리가 완료되었는지 확인하고 행사를 완료 상태로 변경하여 기록으로 이동시킨다. 남은 항목이 있어도 완료 처리를 강제 차단하지 않는다.",
    users: "회장단",
    entryPath: "EVT-02D 후속 정리 중 대시보드 → 행사 완료 처리 버튼",
    functions: [
      { num: "01", element: "잔여 항목 확인", description: "남은 업무·문서·회의록 등 미완료 항목을 목록으로 표시한다. 항목이 없으면 깔끔한 완료 확인 문구를 표시한다." },
      { num: "02", element: "완료 처리 버튼", description: "항목이 없으면: 완료 처리 / 항목이 있으면: 그래도 완료 처리. 실행하면 상태를 완료로 변경하고, 완료 행사 기록을 미발행 상태로 생성한 뒤 REC-01로 이동한다.", constraint: "회장단에게만 노출한다. 회장단이 아니면 완료 처리 버튼을 노출하지 않고, 우회 호출로도 상태를 완료로 바꾸거나 기록을 생성하지 않는다" },
      { num: "03", element: "계속 정리하기 버튼", description: "모달을 닫고 EVT-02D로 복귀한다. 항목이 있을 때만 표시." },
      { num: "04", element: "취소 버튼", description: "모달을 닫고 EVT-02D로 복귀한다." },
    ],
    exceptions: ["남은 항목 있어도 완료 처리 차단 안 함. 경고 표시 후 선택권 제공", "완료 처리 시 완료 행사 기록(archives)을 미발행 상태로 추가하고 REC-01·아카이브 작성으로 연결한다", "같은 행사명 기록이 이미 있으면 중복 생성하지 않는다(행사 식별자가 없어 행사명 기준으로 판정)", "업무 수만 eventTasks에서 실제 계산하고, 연결된 참석·예산 공유 상태가 없으므로 임의 수치 대신 `집계 전`으로 저장한다", "예외 완료해도 eventTasks의 미완료 업무를 완료·삭제하지 않고 그대로 보존한다", "역할을 강제 주입하지 않고 현재 사용자를 그대로 사용한다. 회장단 화면은 ORG-04B에서 기본 역할을 회장단으로 바꾼 뒤 확인한다"],
    nextScreens: ["계속 정리하기 / 취소 → EVT-02D 후속 정리 중 대시보드", "완료 처리 → REC-01 완료된 행사 목록"],
  },
  "REC-01": {
    id: "REC-01", name: "완료된 행사 목록", stateChip: "기본",
    purpose: "완료 처리된 행사를 열람하고 기록을 확인한다. 완료된 행사는 운영 > 행사에서 제외되고 이 화면에서 관리된다.",
    users: "전 구성원",
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
      { num: "09", element: "인수인계 체크리스트", description: "우측 고정 패널에 부서별 확인 항목을 표시한다. 본문에는 재사용 자산, 협력처·담당자, 주의사항, 다음 담당자를 표시한다.", constraint: "AI 초안을 REC-02A에서 검토·발행한 결과이며 이 화면에서는 열람만 한다" },
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
      { num: "01", element: "자동 채움 영역", description: "개요·성과·타임라인·근거 자료는 현재 선택된 행사 기록에서 자동으로 채우며 편집하지 않는다.", constraint: "다른 행사의 값을 섞지 않는다. 참석·예산 등 연결 데이터가 없으면 임의 수치 대신 `집계 전`·`연결 데이터 없음`으로 표시한다" },
      { num: "02", element: "현장 운영 작성", description: "실제 진행 순서, 인력 배치, 돌발 상황과 대응을 입력한다." },
      { num: "03", element: "회고 작성", description: "잘된 점, 미흡했던 점과 원인, 다음 행사 개선안을 각각 입력한다.", constraint: "개선안은 다음 담당 부서를 함께 지정한다" },
      { num: "04", element: "인수인계 작성", description: "AI가 행사 기록을 바탕으로 재사용 자산, 협력처·담당자, 부서별 체크리스트, 주의사항, 다음 담당자 초안을 생성하고, 작성자가 검토·수정해 확정한다.", constraint: "기록에 없는 내용을 임의로 만들지 않으며 사람 검토·확인 없이는 발행하지 않는다" },
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
    id: "EVT-02B", name: "행사 정보 편집 패널", stateChip: "패널 열림",
    purpose: "행사의 공통 사실 정보를 입력·수정한다. 저장된 정보는 일정·참여 설문·공지 등에 단일 원본으로 자동 반영된다. 설문 전용 설정(신청 기간, 승인제 등)은 이 화면에서 관리하지 않는다.",
    users: "행사 운영 조직 관리자 · 회장단",
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
    exceptions: ["모든 항목은 비워둔 채 저장 가능. 조회 화면에서 미정으로 표시", "신청 기간·승인제·선착순·대기자 운영은 이 화면에서 관리하지 않음 → 참여 설문 설정에서 관리", "설문 문항·응답 구조 변경이 필요한 경우에는 새 설문으로 다시 만들기 흐름 제공", "검토용으로 행사 운영 조직에 속한 사용자를 주입한다"],
    nextScreens: ["EVT-02 행사 개요 대시보드", "EVT-05 참여 설문 (변경 내용 자동 반영)"],
  },
  "EVT-03A": {
    id: "EVT-03A", name: "운영 조직 — 보기", stateChip: "기본",
    purpose: "행사 운영 조직의 현재 구성을 확인한다.",
    users: "행사 참가자 전원 (열람)",
    entryPath: "행사 워크스페이스 → 인원 관리 → 운영 조직 탭",
    functions: [
      { num: "01", element: "내부 탭", description: "운영 조직과 행사 참가자를 구분하는 탭." },
      { num: "02", element: "행사 책임자 카드", description: "조직도 최상단에 책임자를 카드 형태로 표시한다." },
      { num: "03", element: "팀·부서 카드", description: "팀장과 일반 구성원을 구분해 표시한다." },
      { num: "04", element: "구성원 팝업", description: "이름, 학과, 학년, 기본 조직 소속, 행사 역할을 팝오버로 표시한다." },
      { num: "05", element: "수정 버튼", description: "같은 화면을 수정 모드(EVT-03B)로 전환한다.", constraint: "행사 운영 조직 관리자·회장단에게만 노출한다. 그 외 참가자에게는 표시하지 않는다" },
    ],
    exceptions: ["운영 조직이 비어 있으면 EVT-03C 빈 상태를 표시한다", "열람 권한만 있는 사용자는 구성원·역할을 변경할 수 없다", "권한 판정은 isEventManager 헬퍼를 사용하며 EVT-02 행사 개요와 같은 방식이다"],
    nextScreens: ["EVT-03B 수정 모드"],
  },
  "EVT-03B": {
    id: "EVT-03B", name: "운영 조직 — 수정", stateChip: "수정 모드",
    purpose: "행사 운영 조직만 수정한다. 기본 학생회 조직에 영향 없음.",
    users: "행사 운영 조직 관리자 · 회장단",
    entryPath: "EVT-03A → 수정 버튼",
    functions: [
      { num: "01", element: "추가 가능한 구성원", description: "행사 조직에 없는 학생회 구성원을 표시. 같은 구성원 카드 형식 사용." },
      { num: "02", element: "구성원 이동", description: "팀 사이 또는 추가 가능한 영역으로 드래그한다." },
      { num: "03", element: "구성원 제거", description: "행사 조직에서만 제거. 기본 조직 영향 없음. 제거 시 추가 가능한 영역으로 복귀." },
      { num: "04", element: "팀·부서 추가", description: "＋ 팀/부서 추가로 행사 전용 팀을 만든다." },
      { num: "05", element: "행사 책임자 변경 경고", description: "현재 책임자를 바로 제거 불가. 새 책임자를 먼저 지정해야 한다.", constraint: "경고 메시지 표시" },
      { num: "06", element: "완료 버튼", description: "변경사항을 저장하고 보기 모드로 복귀한다." },
    ],
    exceptions: ["필수 책임자를 제거하거나 같은 역할에 구성원을 중복 배정할 수 없다", "취소 시 편집 내용을 저장하지 않는다", "검토용으로 행사 운영 조직에 속한 사용자를 주입한다"],
    nextScreens: ["EVT-03A 보기 모드"],
  },
  "EVT-04": {
    id: "EVT-04", name: "행사 참가자 명단", stateChip: "기본",
    purpose: "행사 신청자들의 신청·입금·참석 상태를 표에서 관리한다.",
    users: "행사 운영 조직",
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
    , "검토용으로 행사 운영 조직에 속한 사용자를 주입한다"],
    nextScreens: ["EVT-04B QR 모달", "EVT-05 참여 설문"],
  },
  "EVT-04B": {
    id: "EVT-04B", name: "QR 참석 확인 모달", stateChip: "모달 열림",
    purpose: "행사 현장에서 사용할 공용 참석 확인 QR을 관리한다.",
    users: "행사 운영 조직",
    entryPath: "EVT-04 → 참석 확인 QR 생성",
    functions: [
      { num: "01", element: "QR 코드", description: "참가자가 휴대폰 기본 카메라로 촬영한다. 로그인·앱 설치 불필요." },
      { num: "02", element: "활성 시간", description: "체크인 가능한 시작·종료 시각을 설정한다." },
      { num: "03", element: "활성 상태 chip", description: "현재 QR이 활성인지 비활성인지 표시한다." },
      { num: "04", element: "QR 다운로드", description: "행사장에 표시할 QR 이미지를 내려받는다." },
      { num: "05", element: "비활성화·재생성", description: "위험 작업이므로 확인 dialog를 거친다.", constraint: "재생성 시 기존 QR 즉시 무효화" },
    ],
    exceptions: ["명단 불일치·중복 참석·시간 외·비활성 QR 결과를 성공 처리하지 않는다", "모달을 닫아도 기존 참석 기록을 변경하지 않는다", "검토용으로 행사 운영 조직에 속한 사용자를 주입한다"],
    nextScreens: ["EVT-04 행사 참가자 (닫기)"],
  },
  "EVT-05": {
    id: "EVT-05", name: "참여 설문 생성·관리", stateChip: "기본",
    purpose: "설문 문항을 작성하고 설문 전용 모집 설정을 구성한다. 설문 링크 활성화 조건이 충족되면 공개 링크와 QR을 활성화한다. 행사 공통 정보는 EVT-02B 기본정보에서 단일 원본으로 관리하며 이 화면에서 중복 입력하지 않는다.",
    users: "행사 운영 조직 관리자",
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
    , "검토용으로 행사 운영 조직에 속한 사용자를 주입한다"],
    nextScreens: ["EVT-04 행사 참가자 명단 (링크 활성화 시)", "EXT-02A 외부 참여 설문 (링크 활성화 후)", "EVT-05B 기존 설문 교체 모달", "EVT-02B 행사 기본정보 수정 (기본정보에서 수정 버튼)"],
  },
  "EVT-05B": {
    id: "EVT-05B", name: "기존 설문 교체 모달", stateChip: "모달 열림",
    purpose: "응답이 존재하는 기존 설문을 종료하고 새로운 설문으로 교체한다.",
    users: "행사 운영 조직 관리자",
    entryPath: "EVT-05 → 새 설문으로 교체",
    functions: [
      { num: "01", element: "영향 안내", description: "현재 설문 응답자 수, 기존 설문 종료 안내, 기존 응답 보관 안내, 기존 응답자 재응답 필요 안내를 표시한다." },
      { num: "02", element: "기존 링크 안내", description: "새 설문 활성화 시 기존 링크에서 새 설문으로 이동 버튼이 표시된다는 안내." },
      { num: "03", element: "질문 복사 옵션", description: "기존 질문을 복사한 새 설문 초안으로 시작할 수 있다.", constraint: "질문만 복사. 응답 데이터는 절대 복사 안 함" },
      { num: "04", element: "교체 확인 버튼", description: "기존 설문을 교체됨 상태로 변경하고 새 설문 초안을 생성한다." },
    ],
    exceptions: ["기존 설문과 응답을 실제로 삭제하지 않음", "기존 응답자는 재응답 필요 상태로 표시됨", "새 응답은 학번으로 기존 응답자와 연결", "검토용으로 행사 운영 조직에 속한 사용자를 주입한다"],
    nextScreens: ["EVT-05 새 설문 초안"],
  },
  "FIN-00": {
    id: "FIN-00", name: "전체 재정 현황", stateChip: "기본",
    purpose: "학생회 전체 예산과 지출 현황을 확인한다.",
    users: "전 구성원 (열람). 예산 편성은 재정부 · 회장단",
    entryPath: "사이드바 → 재정",
    functions: [
      { num: "01", element: "회계 기준 정보", description: "회계 기간(2026년 1학기)과 기준일(2026.07.18)을 표시한다." },
      { num: "02", element: "총예산 편성", description: "총예산 카드를 누르면 편성 모달이 열린다. 총예산은 하나의 금액이 아니라 재원의 합이며, 학생회비·지원비처럼 재원 이름과 금액을 행 단위로 입력한다. 재원은 추가·삭제할 수 있고 하단에 합계를 실시간으로 보여준다. 저장하면 재정 요약과 집행률에 즉시 반영된다.", constraint: "재정부와 회장단만 편성할 수 있다. 그 외 사용자에게는 `편성` 표시와 카드 눌림을 노출하지 않는다. 재원이 하나도 없거나 이름이 빈 재원이 있으면 저장하지 않고, 합계가 0원 이하이면 저장하지 않는다" },
      { num: "03", element: "재정 요약 카드", description: "총예산, 실제 지출, 지출 예정, 사용 가능 금액을 요약 표시한다. 총예산은 재원 구성을 `학생회비 외 1건`으로, 실제 지출과 지출 예정은 건수를 함께 보여준다.", constraint: "총예산은 편성 권한이 있을 때만 눌린다. 사용 가능은 세 값에서 계산한 결과이므로 열 내역이 없어 누르지 않는다" },
      { num: "03B", element: "지출 내역 열람", description: "`실제 지출`과 `지출 예정` 카드를 누르면 해당 지출의 전체 내역을 표로 연다. 날짜·지출 내용·행사 또는 사용처·부서·금액을 표시하고, 실제 지출에는 증빙 상태를 함께 보여준다. 하단에 건수와 합계를 표시하며 `사용 내역에서 보기`로 FIN-LEDGER-01로 이동한다.", constraint: "전 구성원이 열람할 수 있다. 이 화면에서 지출을 수정하거나 증빙을 처리하지 않는다" },
      { num: "03C", element: "행사 재정 연결", description: "내역의 각 행을 누르면 그 지출이 연결된 행사의 재정 화면으로 이동한다.", constraint: "행사에 속하지 않는 상시 지출은 연결할 행사가 없으므로 `상시 지출`로 표시하고 이동시키지 않는다" },
      { num: "03D", element: "사용 내역 이동", description: "`최근 지출 내역` 머리글의 `사용 내역 전체 보기`로 FIN-LEDGER-01로 이동한다. 지출 내역 모달 하단에서도 같은 화면으로 이동한다.", constraint: "재정의 현황 두 화면을 오가는 경로이므로 전 구성원에게 노출한다" },
      { num: "04", element: "예산 집행률", description: "저장한 총예산을 기준으로 실제 지출과 지출 예정 포함 집행률을 진행 막대로 시각화한다." },
      { num: "05", element: "행사별·부서별 탭", description: "재정 현황을 행사별 또는 부서별로 구분하여 조회한다." },
      { num: "06", element: "재정 데이터 목록", description: "구분, 배정 예산, 실제 지출, 지출 예정, 사용 가능, 집행률을 표로 표시한다." },
    ],
    exceptions: ["재정 데이터가 없으면 금액과 집행률을 0으로 표시하고 임의 예산을 생성하지 않는다", "기준일이 오래된 경우 최신 데이터로 오해하지 않도록 기준일을 유지한다", "열람은 모든 구성원이 하고 예산 편성은 재정부만 한다. 권한이 없으면 편성 진입점을 노출하지 않는다"],
    nextScreens: ["FIN-LEDGER-01 사용 내역", "EVT-FIN-01 행사 재정"],
  },
  "FIN-00B": {
    id: "FIN-00B", name: "전체 재정 현황 — 재정부", stateChip: "권한 보유",
    purpose: "FIN-00과 같은 화면을 재정부 사용자 관점에서 확인해, 예산 편성 진입점이 보이는 상태를 검토한다.",
    users: "재정부 · 회장단",
    entryPath: "사이드바 재정 (재정부)",
    functions: [
      { num: "01", element: "총예산 편성 진입", description: "총예산 카드에 `편성` 표시가 나타나고 카드를 눌러 재원별 편성 모달을 연다. 그 외 구성과 데이터는 FIN-00과 동일하다.", constraint: "이 화면은 권한 축만 다른 역할 변형이며 별도 기능을 추가하지 않는다" },
    ],
    exceptions: ["FIN-00과 동일한 화면이며 검토용으로 재정부 사용자를 주입한다", "재정 요약·집행률·목록의 데이터와 동작은 FIN-00과 같다"],
    nextScreens: ["FIN-00 전체 재정 현황"],
  },
  "FIN-REQ-01B": {
    id: "FIN-REQ-01B", name: "구매 요청 작성·수정 — 홍보부 부서장", stateChip: "권한 보유",
    purpose: "홍보부 부서장 김민석이 행사에 필요한 물품의 구매를 요청한다.",
    users: "부서장 (김민석)",
    entryPath: "EVT-FIN-01 → 새 구매 요청 (홍보부 부서장)",
    functions: [
      { num: "01", element: "요청 정보", description: "제목, 구매 목적, 필요일, 우선순위를 입력하고 요청 부서는 홍보부로 고정한다." },
      { num: "02", element: "품목 추가", description: "여러 품목을 한 요청에 담을 수 있으며 새 품목은 목록 맨 위에 추가된다." },
      { num: "03", element: "구매 유형 선택", description: "일반 구매, 제작·인쇄, 대여, 용역에 따라 입력 필드를 전환한다. 대여는 대여처·수령·반납 일시·보증금, 용역은 제공자·수행 장소·수행 일시 필드를 보여준다." },
      { num: "04", element: "가격 근거", description: "일반 구매는 상품 링크·판매처·가격 화면 중 1건, 제작·인쇄·대여·용역은 업체 견적서를 필수로 등록한다." },
      { num: "05", element: "제출 버튼", description: "유효성 검사를 통과하면 김민석·홍보부를 요청자 정보로 기록한 검토 대기 요청을 생성한다." },
    ],
    exceptions: ["오늘 이전 필요일은 선택하거나 제출할 수 없다", "필수 요청 정보나 유효한 품목이 없으면 제출하지 않고 항목별 오류를 표시한다"],
    nextScreens: ["MY-REQ-01 내 구매 요청", "EVT-FIN-01 행사 재정"],
  },
  "FIN-REV-01": {
    id: "FIN-REV-01", name: "구매 요청 검토", stateChip: "기본",
    purpose: "처음 제출된 구매 요청을 품목별로 검토하고 승인 여부를 결정한다.",
    users: "재정부",
    entryPath: "EVT-FIN-01 → 요청 선택",
    functions: [
      { num: "01", element: "품목 검토 표", description: "품목별 요청액·가격 근거·상태를 확인하고 결정한다. 승인액을 직접 입력하지 않는다." },
      { num: "02", element: "상태 변경", description: "승인, 보완 요청, 반려 중 선택 가능하다." },
      { num: "03", element: "보완 요청 모달", description: "보완 사유와 재제출 기한을 입력한다." },
      { num: "04", element: "처리 기록", description: "상태 변화 이력을 시간순으로 표시한다." },
      { num: "05", element: "확정 후 진행", description: "보완·검토 대기 품목 없이 전량 확정되면 승인 품목은 별도 선진행 동의 대기 없이 바로 주문 대기(구매 준비)로 넘어간다. 보완 품목이 함께 남아 있을 때만 승인 품목을 선진행 동의 대기에 두고 구매 진행 동의로 진행한다.", constraint: "선진행 동의 대기는 부분 승인(보완 품목 공존) 상황에서만 발생한다" },
    ],
    exceptions: ["재정부 외 사용자는 검토 결정을 변경할 수 없다", "반려 사유가 없거나 미검토 품목이 있으면 최종 처리할 수 없다", "전량 승인 시 선진행 동의 대기를 거치지 않고 구매 준비로 진행한다"],
    nextScreens: ["FIN-PROC-01 구매·발주 처리", "FIN-SUP-01B 보완 요청 확인·재제출", "EVT-FIN-01 행사 재정"],
  },
  "FIN-REV-01B": {
    id: "FIN-REV-01B", name: "구매 요청 재검토 — 보완 재제출", stateChip: "재검토 대기",
    purpose: "요청자가 보완해 재제출한 내용의 변경점과 첨부자료를 확인하고 승인, 추가 보완 요청, 반려 중 하나로 처리한다.",
    users: "재정부",
    entryPath: "EVT-FIN-01B → 처리단계 → 재검토 대기 → 요청 선택",
    functions: [
      { num: "01", element: "보완 전·후 비교", description: "품목별 보완 사유와 수정 전·후 값을 나란히 표시하고 변경된 값을 강조한다." },
      { num: "02", element: "첨부파일 비교", description: "보완 요청 당시 첨부와 재제출된 첨부를 구분해 표시한다." },
      { num: "03", element: "품목 재검토", description: "각 품목을 승인, 추가 보완 요청, 반려 중 하나로 결정한다. 승인액은 별도로 입력하지 않는다." },
      { num: "04", element: "추가 보완 요청", description: "재검토 결과가 보완 요청이면 품목별 사유를 새로 기록하고 요청자에게 돌려보낸다." },
      { num: "05", element: "처리 기록", description: "최초 제출, 보완 요청, 재제출, 재검토 결과와 처리자를 시간순으로 남긴다." },
    ],
    exceptions: ["재정부 외 사용자는 재검토 결정을 변경할 수 없다", "미검토 품목이나 반려 사유 누락이 있으면 최종 처리할 수 없다", "재제출 전 내용과 첨부자료를 덮어쓰지 않고 제출본 이력으로 보존한다"],
    nextScreens: ["FIN-PROC-01 구매·발주 처리", "FIN-SUP-01B 보완 요청 확인·재제출", "EVT-FIN-01B 행사 재정"],
  },
  "EXT-02A": {
    id: "EXT-02A", name: "외부 참여 설문", stateChip: "기본",
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
    id: "EXT-01A", name: "QR 참석 확인", stateChip: "기본",
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

function Chip({ label, variant = "default" }: { label: string; variant?: "default" | "blue" | "green" | "red" | "yellow" | "orange" | "gray" }) {
  const styles: Record<string, string> = {
    default: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
    green: "bg-green-50 text-green-700 border border-green-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    yellow: "bg-yellow-50 text-yellow-700 border border-yellow-200",
    orange: "bg-orange-50 text-orange-700 border border-orange-200",
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
    { icon: MessageSquare, label: "메시지", screen: "MSG-01" },
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

// ─── 권한 판정 ────────────────────────────────────────────────────────────────
// 권한 판정은 docs/VADA_PERMISSION_MATRIX.md를 단일 기준으로 한다.
// 화면에서 조건을 직접 쓰지 말고 이 헬퍼를 재사용한다.

// 행사 관리 권한(기본정보 수정·행사 시작·행사 종료·운영 조직 구성): 회장단 또는 해당 행사의 운영 조직 관리자.
// 기본 역할 문자열에 행사 역할을 섞지 않고, 기본 역할(role)과 맥락 역할(eventRole)을 각각 본다.
const isEventManager = (user: { role: string; eventRole?: EventContextRole }) =>
  user.role === "회장단" || user.eventRole === "행사 운영 조직 관리자";

// 행사 종료(진행 중 → 후속 정리 중): 회장단 또는 해당 행사의 운영 조직 관리자.
// 기본 역할이 부원·부서장이라도 그 행사의 운영 조직 관리자면 종료할 수 있고, 관리자가 아니면 종료할 수 없다.
const canEndEvent = (user: { role: string; eventRole?: EventContextRole }) =>
  user.role === "회장단" || user.eventRole === "행사 운영 조직 관리자";

// 행사 최종 완료 처리(후속 정리 중 → 완료): 기본 역할이 회장단인 사용자만.
// 행사 맥락 역할(eventRole)은 판단 근거로 쓰지 않는다. 행사 종료와 서로 다른 기준이다.
const canCompleteEvent = (user: { role: string }) => user.role === "회장단";

// 예산 편성·구매 승인·구매 발주·증빙 처리: 재정부만
const canManageFinance = (user: { dept: string; role: string }) => user.dept === "재정부";

// 구매 요청 작성·보완 재제출: 부서장과 재정부. 일반 부원은 현황과 본인 요청을 조회만 한다.
const canSubmitPurchaseRequest = (user: { dept: string; role: string }) =>
  user.dept === "재정부" || user.role === "부서장";

// 조직 구조 수정: 회장단
const canEditOrganization = (user: { role: string }) => user.role === "회장단";

// 구성원 초대: 회장단 · 부서장(자기 부서만)
const canInviteOrganizationMember = (user: { role: string }) =>
  user.role === "회장단" || user.role === "부서장";

// 학생 기본 명단 업로드·갱신·내보내기: 회장단 (열람은 전 구성원)
const canManageStudentRoster = (user: { role: string }) => user.role === "회장단";

// 학생회비 납부 명단 업로드: 재정부 · 회장단
const canManageStudentFeeRoster = (user: { dept: string; role: string }) =>
  user.dept === "재정부" || user.role === "회장단";

// ─── FIN-00 전체 재정 현황 ─────────────────────────────────────────────────────

// 총예산은 하나의 숫자가 아니라 재원(학생회비·지원비 등)의 합이다.
type BudgetSource = { id: number; name: string; amount: string };

const DEFAULT_BUDGET_SOURCES: BudgetSource[] = [
  { id: 1, name: "학생회비", amount: "20000000" },
  { id: 2, name: "단과대학 지원비", amount: "10000000" },
];

// 재정 요약 카드의 수치는 모두 이 목록에서 계산한다. 카드와 내역이 어긋나지 않게 하기 위한 단일 원본이다.
// event가 null이면 행사에 속하지 않는 상시 지출이며, 연결할 행사 재정이 없다.
type ExpenseRecord = {
  id: string;
  date: string;
  title: string;
  event: string | null;
  dept: string;
  amount: number;
  status: "완료" | "예정";
  proof?: "증빙 완료" | "보완 필요" | "미등록";
};

const EXPENSE_RECORDS: ExpenseRecord[] = [
  { id: "E-01", date: "2026-07-17", title: "현수막 제작", event: "체육대회", dept: "홍보부", amount: 180000, status: "완료", proof: "증빙 완료" },
  { id: "E-02", date: "2026-07-16", title: "생수 구매", event: "체육대회", dept: "운영부", amount: 120000, status: "완료", proof: "보완 필요" },
  { id: "E-03", date: "2026-07-10", title: "체육대회 운영 물품", event: "체육대회", dept: "학술체육부", amount: 1800000, status: "완료", proof: "증빙 완료" },
  { id: "E-04", date: "2026-07-15", title: "명찰 인쇄", event: "신입생 환영 행사", dept: "홍보부", amount: 75000, status: "완료", proof: "미등록" },
  { id: "E-05", date: "2026-03-20", title: "환영 행사 다과", event: "신입생 환영 행사", dept: "기획부", amount: 1725000, status: "완료", proof: "증빙 완료" },
  { id: "E-06", date: "2026-04-01", title: "학생회실 비품 구입", event: null, dept: "운영부", amount: 1200000, status: "완료", proof: "증빙 완료" },
  { id: "E-07", date: "2026-05-10", title: "정기 간담회 운영비", event: null, dept: "기획부", amount: 800000, status: "완료", proof: "증빙 완료" },
  { id: "E-08", date: "2026-06-30", title: "상반기 홍보물 제작", event: null, dept: "홍보부", amount: 2500000, status: "완료", proof: "증빙 완료" },
  { id: "E-09", date: "2026-07-05", title: "학생 복지 물품", event: null, dept: "운영부", amount: 4000000, status: "완료", proof: "미등록" },
  { id: "E-10", date: "2026-08-05", title: "경기 장비 대여", event: "체육대회", dept: "학술체육부", amount: 600000, status: "예정" },
  { id: "E-11", date: "2026-08-20", title: "신입생 기념품 제작", event: "신입생 환영 행사", dept: "홍보부", amount: 200000, status: "예정" },
  { id: "E-12", date: "2026-08-10", title: "하반기 홍보물 제작", event: null, dept: "홍보부", amount: 2300000, status: "예정" },
];

const PROOF_STYLE: Record<string, string> = {
  "증빙 완료": "text-green-600 bg-green-50",
  "보완 필요": "text-yellow-700 bg-yellow-50",
  "미등록": "text-red-600 bg-red-50",
};

function FIN00() {
  const { currentUser, navigateTo } = React.useContext(AppContext);
  // HANDOFF: 예산 수정은 재정부와 회장단만 가능하다. 열람은 모든 구성원이 할 수 있다.
  const canEditBudget = canManageFinance(currentUser);
  const [budgetSources, setBudgetSources] = useState<BudgetSource[]>(DEFAULT_BUDGET_SOURCES);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState<"actual" | "planned" | null>(null);
  const [draftSources, setDraftSources] = useState<BudgetSource[]>(DEFAULT_BUDGET_SOURCES);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const sumSources = (sources: BudgetSource[]) => sources.reduce((total, source) => total + (Number(source.amount) || 0), 0);
  const totalBudget = sumSources(budgetSources);
  const draftTotal = sumSources(draftSources);

  const actualRecords = EXPENSE_RECORDS.filter(record => record.status === "완료");
  const plannedRecords = EXPENSE_RECORDS.filter(record => record.status === "예정");
  const sumRecords = (records: ExpenseRecord[]) => records.reduce((total, record) => total + record.amount, 0);
  const actualExpense = sumRecords(actualRecords);
  const plannedExpense = sumRecords(plannedRecords);
  const availableBudget = totalBudget - actualExpense - plannedExpense;
  const actualRate = totalBudget > 0 ? Math.min((actualExpense / totalBudget) * 100, 100) : 0;
  const plannedRate = totalBudget > 0 ? Math.min((plannedExpense / totalBudget) * 100, Math.max(100 - actualRate, 0)) : 0;

  const openBudgetModal = () => {
    setDraftSources(budgetSources.length > 0 ? budgetSources : [{ id: 1, name: "", amount: "" }]);
    setBudgetError(null);
    setBudgetModalOpen(true);
  };

  const saveBudgetSources = () => {
    const cleaned = draftSources.filter(source => source.name.trim() !== "" || (Number(source.amount) || 0) > 0);
    if (cleaned.length === 0) {
      setBudgetError("재원을 한 개 이상 입력해 주세요.");
      return;
    }
    if (cleaned.some(source => source.name.trim() === "")) {
      setBudgetError("재원 이름을 모두 입력해 주세요.");
      return;
    }
    if (sumSources(cleaned) <= 0) {
      setBudgetError("총예산이 0원보다 커야 합니다.");
      return;
    }
    setBudgetSources(cleaned);
    setBudgetError(null);
    setBudgetModalOpen(false);
  };

  const budgetDesc = budgetSources.length === 0
    ? "재원을 입력해 주세요"
    : budgetSources.length === 1
      ? budgetSources[0].name
      : `${budgetSources[0].name} 외 ${budgetSources.length - 1}건`;

  const summary = [
    { title: "총예산", value: `${totalBudget.toLocaleString()}원`, desc: budgetDesc, icon: BarChart2, color: "text-blue-600", bg: "bg-blue-50", action: canEditBudget ? "budget" as const : null, actionLabel: "편성" },
    { title: "실제 지출", value: `${actualExpense.toLocaleString()}원`, desc: `결제가 완료된 ${actualRecords.length}건`, icon: Check, color: "text-green-600", bg: "bg-green-50", action: "actual" as const, actionLabel: "내역" },
    { title: "지출 예정", value: `${plannedExpense.toLocaleString()}원`, desc: `결제 예정 ${plannedRecords.length}건`, icon: Clock, color: "text-orange-600", bg: "bg-orange-50", action: "planned" as const, actionLabel: "내역" },
    { title: "사용 가능", value: `${availableBudget.toLocaleString()}원`, desc: "새로 사용할 수 있는 금액", icon: Info, color: availableBudget < 0 ? "text-red-600" : "text-indigo-600", bg: availableBudget < 0 ? "bg-red-50" : "bg-indigo-50", action: null, actionLabel: "" },
  ];

  // 행사별 집계도 같은 원본에서 계산한다. 배정 예산만 편성값이다.
  const eventBudgets = [
    { name: "체육대회", budget: 5000000 },
    { name: "신입생 환영 행사", budget: 3000000 },
    { name: "가을 축제", budget: 8000000 },
  ];
  const eventData = eventBudgets.map(row => {
    const actual = sumRecords(actualRecords.filter(record => record.event === row.name));
    const pending = sumRecords(plannedRecords.filter(record => record.event === row.name));
    return {
      ...row,
      actual,
      pending,
      available: row.budget - actual - pending,
      rate: row.budget > 0 ? Math.round(((actual + pending) / row.budget) * 100) : 0,
    };
  });

  const formatShortDate = (date: string) => date.slice(5).replace("-", ".");
  const recentExpenses = [...actualRecords]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map(record => ({
      date: formatShortDate(record.date),
      title: record.title,
      target: record.event ?? "상시 지출",
      amount: `${record.amount.toLocaleString()}원`,
      status: record.proof ?? "미등록",
      statusColor: PROOF_STYLE[record.proof ?? "미등록"],
    }));

  const proofStatus = (["증빙 완료", "보완 필요", "미등록"] as const).map(label => ({
    label,
    count: `${actualRecords.filter(record => (record.proof ?? "미등록") === label).length}건`,
    color: label === "증빙 완료" ? "text-green-600" : label === "보완 필요" ? "text-yellow-700" : "text-red-600",
  }));

  const detailRecords = detailModal === "actual" ? actualRecords : detailModal === "planned" ? plannedRecords : [];
  const openEventFinance = (record: ExpenseRecord) => {
    if (!record.event) return;
    setDetailModal(null);
    navigateTo("EVT-FIN-01");
  };

  return (
    <DesktopShell
      activeSidebar="재정"
      breadcrumb={["재정", "전체 재정 현황"]}
      title="전체 재정 현황"
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
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3">
          <span className="text-[11px] text-blue-800">이 화면은 <b>전체 현황 열람</b>용입니다. 구매 요청 검토·발주·증빙 등 <b>처리는 각 행사의 재정 탭</b>(운영 → 행사 → 재정)에서 시작합니다.</span>
        </div>
        {/* 설명 영역 */}
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-gray-900">전체 재정 현황</h2>
          <p className="text-sm text-gray-500">학생회 전체 예산과 지출 현황을 확인합니다.</p>
        </div>

        {/* 요약 카드 — 총예산 카드는 눌러서 재원별로 편성한다 */}
        <div className="grid grid-cols-4 gap-4">
          {summary.map((s) => {
            const inner = (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
                  </div>
                  {s.action && <span className="text-[10px] text-gray-400 group-hover:text-blue-600">{s.actionLabel}</span>}
                </div>
                <p className="text-[10px] text-gray-400 font-medium mb-1">{s.title}</p>
                <p className={`text-xl font-bold ${s.color} mb-1.5`}>{s.value}</p>
                <p className="text-[10px] text-gray-400 truncate">{s.desc}</p>
              </>
            );
            return s.action ? (
              <button
                key={s.title}
                type="button"
                onClick={() => s.action === "budget" ? openBudgetModal() : setDetailModal(s.action)}
                title={s.action === "budget" ? "총예산 편성하기" : `${s.title} 내역 보기`}
                className="group bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-left hover:border-blue-300 hover:shadow-md transition-all"
              >
                {inner}
              </button>
            ) : (
              <div key={s.title} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                {inner}
              </div>
            );
          })}
        </div>

        {/* 예산 집행률 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">전체 예산 집행률 {actualRate.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">지출 예정 포함 {(actualRate + plannedRate).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-blue-600 rounded-l-full" style={{ width: `${actualRate}%` }} />
            <div className="absolute top-0 h-full bg-blue-300" style={{ left: `${actualRate}%`, width: `${plannedRate}%` }} />
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
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">최근 지출 내역</p>
              <button
                type="button"
                onClick={() => navigateTo("FIN-LEDGER-01")}
                className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-0.5"
              >
                사용 내역 전체 보기 <ExternalLink className="w-2.5 h-2.5" />
              </button>
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

      {detailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[720px] max-h-[86vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-bold text-gray-900">{detailModal === "actual" ? "실제 지출 내역" : "지출 예정 내역"}</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {detailModal === "actual" ? "결제가 완료된 지출입니다." : "승인 후 결제가 예정된 지출입니다."} 행사 지출은 눌러서 해당 행사 재정으로 이동합니다.
                </p>
              </div>
              <button type="button" onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500">날짜</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500">지출 내용</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500">행사 또는 사용처</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500">부서</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 text-right">금액</th>
                    {detailModal === "actual" && <th className="px-5 py-2.5 text-[11px] font-semibold text-gray-500 text-center">증빙</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailRecords.map(record => (
                    <tr
                      key={record.id}
                      onClick={() => openEventFinance(record)}
                      className={record.event ? "cursor-pointer hover:bg-blue-50/50" : ""}
                      title={record.event ? `${record.event} 재정으로 이동` : "행사에 속하지 않는 상시 지출입니다"}
                    >
                      <td className="px-5 py-3 text-xs text-gray-500 font-mono">{formatShortDate(record.date)}</td>
                      <td className="px-5 py-3 text-xs font-medium text-gray-800">{record.title}</td>
                      <td className="px-5 py-3 text-xs">
                        {record.event
                          ? <span className="text-blue-600 inline-flex items-center gap-1">{record.event}<ExternalLink className="w-2.5 h-2.5" /></span>
                          : <span className="text-gray-400">상시 지출</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{record.dept}</td>
                      <td className="px-5 py-3 text-xs font-semibold text-gray-900 text-right font-mono">{record.amount.toLocaleString()}원</td>
                      {detailModal === "actual" && (
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${PROOF_STYLE[record.proof ?? "미등록"]}`}>{record.proof ?? "미등록"}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                  {detailRecords.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-gray-400">해당하는 지출이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
              <p className="text-xs text-gray-600">
                {detailRecords.length}건
                <span className="font-semibold text-gray-900"> · 합계 {sumRecords(detailRecords).toLocaleString()}원</span>
              </p>
              <Btn variant="secondary" size="sm" onClick={() => { setDetailModal(null); navigateTo("FIN-LEDGER-01"); }}>사용 내역에서 보기</Btn>
            </div>
          </div>
        </div>
      )}

      {budgetModalOpen && canEditBudget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[520px] max-h-[86vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-bold text-gray-900">총예산 편성</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">2026년 1학기 · 재원별로 나누어 입력하면 합계가 총예산이 됩니다.</p>
              </div>
              <button type="button" onClick={() => setBudgetModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <p className="text-[10px] text-gray-400 flex-1">재원</p>
                <p className="text-[10px] text-gray-400 w-[168px]">금액</p>
                <span className="w-6" />
              </div>
              {draftSources.map((source, index) => (
                <div key={source.id} className="flex items-center gap-2">
                  <input
                    value={source.name}
                    onChange={event => { setDraftSources(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item)); setBudgetError(null); }}
                    placeholder="예: 학생회비, 총학생회 지원비"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400"
                  />
                  <div className="relative w-[168px]">
                    <input
                      value={source.amount ? Number(source.amount).toLocaleString() : ""}
                      onChange={event => { const digits = event.target.value.replace(/[^0-9]/g, ""); setDraftSources(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, amount: digits } : item)); setBudgetError(null); }}
                      inputMode="numeric"
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-lg pl-3 pr-7 py-2 text-sm text-right font-mono text-gray-800"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-gray-400">원</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftSources(previous => previous.filter((_, itemIndex) => itemIndex !== index))}
                    className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                    title="재원 삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setDraftSources(previous => [...previous, { id: Math.max(0, ...previous.map(item => item.id)) + 1, name: "", amount: "" }])}
                className="mt-1 border border-dashed border-gray-300 rounded-lg py-2 text-xs text-gray-500 hover:border-blue-300 hover:text-blue-600 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> 재원 추가
              </button>

              {budgetError && <p className="text-[11px] text-red-600 mt-1">{budgetError}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[10px] text-gray-400">총예산</p>
                <p className="text-base font-bold text-gray-900">{draftTotal.toLocaleString()}원</p>
              </div>
              <div className="flex items-center gap-2">
                <Btn variant="text" size="sm" onClick={() => setBudgetModalOpen(false)}>취소</Btn>
                <Btn variant="primary" size="sm" onClick={saveBudgetSources}>저장</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────

// ─── 끼룩이 (마스코트) ─────────────────────────────────────────────────────────
// 끼룩이는 정보를 만들지 않는다. 홈이 이미 계산한 값을 문장으로 엮어 전달만 한다.
// 톤 3단계: 지연·미지정은 사무적, 일반 알림은 담백, 평온·빈 상태만 친근하게.

type KkirukTone = "alert" | "neutral" | "calm";
type KkirukAction = { kind: "delayed" | "unassigned" | "messages" | "calendar"; label: string };

// 끼룩이 브랜드 팔레트 (캐릭터 시트 기준)
const KKIRUK_NAVY = "#0A1F44";
const KKIRUK_BLUE = "#1758FF";
const KKIRUK_CYAN = "#00D6E7";
const KKIRUK_MIST = "#E6F6FF";

// 캐릭터 시트 02 EXPRESSIONS & POSES에서 추출한 표정 3종.
// hello: 인사·도움 제안 / check: 경청·처리 중 / think: 질문 이해·고민 중(요약 생성 등)
type KkirukExpression = "hello" | "check" | "think";

const KKIRUK_IMAGES: Record<KkirukExpression, string> = {
  hello: "/kkiruk-hello.png",
  check: "/kkiruk-check.png",
  think: "/kkiruk-think.png",
};

const KKIRUK_ALT: Record<KkirukExpression, string> = {
  hello: "인사하는 끼룩이",
  check: "확인 중인 끼룩이",
  think: "생각 중인 끼룩이",
};

function KkirukMark({ expression = "hello", className = "" }: { expression?: KkirukExpression; className?: string }) {
  return <img src={KKIRUK_IMAGES[expression]} alt={KKIRUK_ALT[expression]} className={`${className} object-contain`} />;
}

function buildKkirukBriefing(input: {
  userName: string;
  delayedCount: number;
  unassignedCount: number;
  unreadMessageCount: number;
  unreadRoomCount: number;
  nextScheduleName: string | null;
  daysUntilNext: number | null;
  thisWeekCount: number;
  hasData: boolean;
  canManage: boolean;
}): { tone: KkirukTone; greeting: string; lines: string[]; action: KkirukAction | null } {
  const { userName, delayedCount, unassignedCount, unreadMessageCount, unreadRoomCount, nextScheduleName, daysUntilNext, thisWeekCount, hasData, canManage } = input;

  if (!hasData) {
    return {
      tone: "calm",
      greeting: `${userName}님, 안녕하세요`,
      lines: ["아직 등록된 행사가 없어요.", "첫 행사를 만들면 업무·예산·회의가 한 번에 연결돼요."],
      action: null,
    };
  }

  const dayLabel = daysUntilNext === 0 ? "오늘" : daysUntilNext === 1 ? "내일" : daysUntilNext === 2 ? "모레" : `${daysUntilNext}일 뒤`;

  // 우선순위대로 모으고 최대 2건만 말한다. 다 나열하면 브리핑이 아니라 목록이 된다.
  const candidates: { tone: KkirukTone; text: string; action: KkirukAction | null }[] = [];
  if (delayedCount > 0) {
    candidates.push({ tone: "alert", text: `지연된 업무가 ${delayedCount}건 있습니다.`, action: { kind: "delayed", label: "지연 업무 보기" } });
  }
  if (unassignedCount > 0) {
    candidates.push({
      tone: "alert",
      text: `담당자가 없는 업무가 ${unassignedCount}건 있습니다.`,
      action: { kind: "unassigned", label: canManage ? "담당자 배정하기" : "미지정 업무 보기" },
    });
  }
  if (unreadMessageCount > 0) {
    candidates.push({
      tone: "neutral",
      text: unreadRoomCount > 1
        ? `읽지 않은 메시지가 ${unreadRoomCount}개 방에 ${unreadMessageCount}건 있어요.`
        : `읽지 않은 메시지가 ${unreadMessageCount}건 있어요.`,
      action: { kind: "messages", label: "메시지 보기" },
    });
  }
  if (nextScheduleName && daysUntilNext !== null && daysUntilNext <= 3) {
    candidates.push({ tone: "neutral", text: `${dayLabel}, ${nextScheduleName} 일정이 있어요.`, action: { kind: "calendar", label: "캘린더 보기" } });
  }
  if (thisWeekCount > 0) {
    candidates.push({ tone: "neutral", text: `이번 주 일정은 모두 ${thisWeekCount}건이에요.`, action: { kind: "calendar", label: "캘린더 보기" } });
  }

  if (candidates.length === 0) {
    return {
      tone: "calm",
      greeting: `${userName}님, 안녕하세요`,
      lines: ["지금 급하게 처리할 일은 없어요.", "끼룩이가 계속 지켜보고 있을게요."],
      action: null,
    };
  }

  const picked = candidates.slice(0, 2);
  const tone: KkirukTone = picked.some(c => c.tone === "alert") ? "alert" : "neutral";
  return {
    tone,
    greeting: tone === "alert" ? `${userName}님, 확인이 필요해요` : `${userName}님, 안녕하세요`,
    lines: picked.map(c => c.text),
    action: picked[0].action,
  };
}

function KkirukBriefing(props: {
  tone: KkirukTone;
  greeting: string;
  lines: string[];
  action: KkirukAction | null;
  onAction: (action: KkirukAction) => void;
}) {
  const { tone, greeting, lines, action, onAction } = props;
  // 경고 톤에서는 느낌표를 빼서 마스코트 말투가 알림을 가볍게 만들지 않도록 한다.
  const speaker = tone === "alert" ? "끼룩이가 알려드려요" : "끼룩이가 알려드려요!";
  // 경고만 의미색(빨강)을 쓰고, 나머지는 브랜드 색을 쓴다. 캐릭터 자체는 톤과 무관하게 같은 모습이다.
  const isAlert = tone === "alert";

  return (
    <div
      className={`border rounded-2xl px-7 py-6 flex items-center gap-5 ${isAlert ? "bg-red-50/50 border-red-100" : "border-transparent"}`}
      style={isAlert ? undefined : { backgroundColor: KKIRUK_MIST }}
    >
      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
        <KkirukMark expression={isAlert ? "check" : "hello"} className="w-full h-full" />
      </div>
      <div className="relative flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl px-6 py-4">
        {/* 말풍선 꼬리 */}
        <span className="absolute -left-[7px] top-8 w-3 h-3 bg-white border-l border-b border-gray-200 rotate-45" aria-hidden="true" />
        <p className="text-[10px] font-bold" style={{ color: isAlert ? "#EF4444" : KKIRUK_BLUE }}>{speaker}</p>
        <p className="text-base font-bold mt-1" style={{ color: KKIRUK_NAVY }}>{greeting}</p>
        <div className="mt-1.5 flex flex-col gap-1">
          {lines.map((line, i) => (
            <p key={i} className="text-sm text-gray-600 leading-6">{line}</p>
          ))}
        </div>
      </div>
      {action && (
        <Btn variant="secondary" onClick={() => onAction(action)}>{action.label}</Btn>
      )}
    </div>
  );
}

type HomeAlertPickerKind = "unassigned" | "evidence" | "participants";
type HomeAlertPickerItem = { id: string; title: string; detail: string; badge: string; badgeClass: string };

function HomeAlertPicker({
  title, items, onSelect, onClose, anchorEl, panelRef,
}: {
  title: string;
  items: HomeAlertPickerItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  panelRef: React.RefObject<HTMLDivElement>;
}) {
  const WIDTH = 320;
  const GAP = 12;
  const MARGIN = 8;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  React.useLayoutEffect(() => {
    if (!anchorEl) return;
    const compute = () => {
      const rect = anchorEl.getBoundingClientRect();
      const height = panelRef.current?.offsetHeight ?? 0;
      // 기본은 알림 행 왼쪽. 왼쪽 공간이 부족하면 오른쪽으로 전환한다.
      let left = rect.left - GAP - WIDTH;
      if (left < MARGIN) left = rect.right + GAP;
      // 오른쪽 전환 후에도 화면을 벗어나면 뷰포트 안으로 당긴다.
      if (left + WIDTH > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - WIDTH;
      if (left < MARGIN) left = MARGIN;
      let top = rect.top;
      if (height && top + height > window.innerHeight - MARGIN) top = window.innerHeight - MARGIN - height;
      if (top < MARGIN) top = MARGIN;
      setPos({ top, left });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [anchorEl, items, panelRef]);

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, width: WIDTH, visibility: pos ? "visible" : "hidden" }}
      className="z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2"
    >
      <div className="px-2.5 py-2 flex items-center justify-between">
        <p className="text-[11px] font-bold text-gray-800">{title}</p>
        <button type="button" onClick={onClose} className="text-[10px] text-gray-400 hover:text-gray-600">닫기</button>
      </div>
      <div className="flex flex-col gap-1">
        {items.map(item => (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-blue-50">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-gray-800 truncate">{item.title}</span>
              <span className={`text-[10px] font-bold shrink-0 ${item.badgeClass}`}>{item.badge}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 truncate">{item.detail}</p>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

// ─── HOME-01 홈 ───────────────────────────────────────────────────────────────

function HOME01({ briefing = false }: { briefing?: boolean }) {
  const { navigateTo, setEventWorkspaceFilter, setCalendarFocus, eventRecords, setSelectedEventId, recurringTasks, createdMeetings, currentUser, eventLifecycle, messageRooms, demoDataMode } = React.useContext(AppContext);
  const [activeAlertPicker, setActiveAlertPicker] = useState<HomeAlertPickerKind | null>(null);
  const [alertAnchorEl, setAlertAnchorEl] = useState<HTMLElement | null>(null);
  const alertPanelRef = React.useRef<HTMLDivElement>(null);
  const alertPickerRef = React.useRef<HTMLDivElement>(null);
  const isFirstUse = demoDataMode === "first-use";
  const homeEventRecords = isFirstUse ? [] : eventRecords;
  const homeEventTasks = homeEventRecords.flatMap(event => event.tasks);
  const homeRecurringTasks = isFirstUse ? [] : recurringTasks;
  const eventDelayedCount = homeEventTasks.filter(task => task.delayed).length;
  const eventUnassignedCount = homeEventTasks.filter(task => task.assignee === "미지정").length;
  const unassignedEventGroups = homeEventRecords
    .map(event => {
      const tasks = event.tasks.filter(task => task.assignee === "미지정");
      const nextTask = tasks
        .filter(task => /^\d{4}-\d{2}-\d{2}$/.test(task.due))
        .sort((a, b) => a.due.localeCompare(b.due))[0];
      return { id: event.id, name: event.info.name, count: tasks.length, nextTask };
    })
    .filter(event => event.count > 0);
  const evidenceAlertItems = EXPENSE_RECORDS
    .filter(record => record.proof === "보완 필요" || record.proof === "미등록")
    .map(record => ({
      id: record.id,
      title: record.title,
      detail: `${record.event ?? "상시 지출"} · ${record.proof}`,
      badge: "증빙 누락",
      badgeClass: "text-yellow-700",
    }));
  const participantReviewItems = homeEventRecords
    .map(event => event.id === SPORTS_EVENT_ID ? {
      id: event.id,
      title: event.info.name,
      detail: "학번·이름 또는 납부 확인이 필요합니다",
      badge: "확인 대상 6명",
      badgeClass: "text-blue-600",
    } : null)
    .filter((event): event is HomeAlertPickerItem => event !== null);
  const openUnassignedEventTasks = (eventId: string) => {
    setSelectedEventId(eventId);
    setEventWorkspaceFilter("unassignedTasks");
    setActiveAlertPicker(null);
    navigateTo("EVT-TASK-01");
  };
  const handleAlertPickerSelect = (id: string) => {
    if (activeAlertPicker === "unassigned") { openUnassignedEventTasks(id); return; }
    if (activeAlertPicker === "evidence") { setActiveAlertPicker(null); navigateTo("FIN-EVID-01"); return; }
    if (activeAlertPicker === "participants") {
      setSelectedEventId(id);
      setEventWorkspaceFilter("participantReview");
      setActiveAlertPicker(null);
      navigateTo("EVT-04");
    }
  };
  const alertPicker = activeAlertPicker === "unassigned"
    ? { title: "행사를 선택하세요", items: unassignedEventGroups.map(event => ({ id: event.id, title: event.name, detail: event.nextTask ? `${event.nextTask.name} · ${event.nextTask.due.slice(5).replace("-", ".")} 마감` : "마감일이 정해진 업무가 없습니다", badge: `미지정 ${event.count}건`, badgeClass: "text-orange-600" })) }
    : activeAlertPicker === "evidence"
      ? { title: "누락된 증빙을 선택하세요", items: evidenceAlertItems }
      : activeAlertPicker === "participants"
        ? { title: "확인할 행사 명단을 선택하세요", items: participantReviewItems }
        : null;
  useEffect(() => {
    if (!activeAlertPicker) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      // 포털로 렌더된 팝오버는 알림 패널 바깥이므로 별도로 확인한다.
      if (alertPanelRef.current?.contains(target) || alertPickerRef.current?.contains(target)) return;
      setActiveAlertPicker(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [activeAlertPicker]);
  const needsAttentionCount = eventDelayedCount + eventUnassignedCount;
  const myActiveTaskCount = [...homeEventTasks, ...homeRecurringTasks].filter(task => task.assignee === currentUser.name && task.status !== "완료").length;
  const today = new Date("2026-07-19T00:00:00");
  const fixedSchedule = isFirstUse ? [] : [
    { dateValue: new Date("2026-07-20T00:00:00"), name: "체육대회 참가 신청 마감", dept: "기획부", type: "마감", focus: { month: 6, day: 20, label: "체육대회 참가 신청 마감" } },
    { dateValue: new Date("2026-07-22T00:00:00"), name: "정기 운영회의", dept: "전체", type: "회의", focus: { month: 6, day: 22, label: "정기 운영회의" } },
    { dateValue: new Date("2026-08-20T00:00:00"), name: "소프트웨어융합대학 체육대회", dept: "학술체육부", type: "행사", focus: { month: 7, day: 20, label: "소프트웨어융합대학 체육대회" } },
  ];
  const taskSchedule = [...homeEventTasks, ...homeRecurringTasks]
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
    { label: "진행 중 행사", value: isFirstUse ? "0개" : "1개", icon: Star, color: "text-blue-600", bg: "bg-blue-50", screen: "EVT-00A" },
    { label: "예정 행사", value: isFirstUse ? "0개" : "2개", icon: Calendar, color: "text-indigo-600", bg: "bg-indigo-50", screen: "EVT-00A" },
    { label: "이번 주 주요 일정", value: `${thisWeekScheduleCount}개`, icon: Clock, color: "text-orange-600", bg: "bg-orange-50", screen: "OPS-CAL-01" },
    { label: "확인 필요", value: `${needsAttentionCount}건`, icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", screen: "EVT-TASK-01" },
  ];

  const events = isFirstUse ? [] : [
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

  const alerts = isFirstUse ? [] : [
    { kind: "default" as const, icon: AlertCircle, color: "text-red-500 bg-red-50", label: "체육대회 지연 업무", value: `${eventDelayedCount}건`, screen: "EVT-TASK-01" },
    { kind: "unassigned" as const, icon: User, color: "text-orange-500 bg-orange-50", label: "담당자 미지정 업무", value: `${eventUnassignedCount}건` },
    { kind: "evidence" as const, icon: FileText, color: "text-yellow-600 bg-yellow-50", label: "증빙 서류 누락", value: `${evidenceAlertItems.length}건` },
    { kind: "participants" as const, icon: Users, color: "text-blue-500 bg-blue-50", label: "참가자 명단 확인 필요", value: `${participantReviewItems.length}건` },
  ];

  const activity = isFirstUse ? [] : [
    { when: "오늘 10:30", desc: "체육대회 신규 신청자 5명 추가", tag: "참가자" },
    { when: "어제 16:20", desc: "체육대회 QR 참석 확인 설정 완료", tag: "참가 확인" },
    { when: "07.16", desc: "정기 운영회의 결정사항 등록", tag: "회의" },
    { when: "07.14", desc: "체육대회 장소 확정", tag: "행사 정보" },
  ];

  const typeColor = (t: string) =>
    t === "마감" ? "bg-red-50 text-red-600" : t === "회의" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600";

  // 브리핑 화면은 홈을 가볍게 유지한다. 일정은 3건까지만 보이고 최근 활동은 접는다.
  const visibleSchedule = briefing ? schedule.slice(0, 3) : schedule;
  // 끼룩이가 이미 말한 지연·미지정은 카드에서 중복 표시하지 않는다.
  const visibleSummaryCards = briefing ? summaryCards.filter(c => c.label !== "확인 필요") : summaryCards;
  const visibleAlerts = briefing
    ? alerts.filter(a => a.label !== "체육대회 지연 업무" && a.label !== "담당자 미지정 업무")
    : alerts;

  // 끼룩이 브리핑: 위에서 이미 계산한 값만 사용한다. 새 수치를 만들지 않는다.
  const nextSchedule = schedule[0] ?? null;
  const unreadMessageCount = messageRooms.reduce((total, room) => total + room.unreadCount, 0);
  const unreadRoomCount = messageRooms.filter(room => room.unreadCount > 0).length;
  const kkiruk = buildKkirukBriefing({
    userName: currentUser.name,
    delayedCount: eventDelayedCount,
    unassignedCount: eventUnassignedCount,
    unreadMessageCount,
    unreadRoomCount,
    nextScheduleName: nextSchedule ? nextSchedule.name : null,
    daysUntilNext: nextSchedule ? Math.round((nextSchedule.dateValue.getTime() - today.getTime()) / 86400000) : null,
    thisWeekCount: thisWeekScheduleCount,
    hasData: homeEventTasks.length > 0 || homeRecurringTasks.length > 0,
    canManage: currentUser.role !== "부원",
  });
  const runKkirukAction = (action: KkirukAction) => {
    if (action.kind === "delayed") { setEventWorkspaceFilter(null); navigateTo("EVT-TASK-01"); return; }
    if (action.kind === "unassigned") { setActiveAlertPicker("unassigned"); return; }
    if (action.kind === "messages") { navigateTo("MSG-01"); return; }
    setCalendarFocus(nextSchedule ? nextSchedule.focus : null);
    navigateTo("OPS-CAL-01");
  };

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

        {/* 0. 끼룩이 브리핑 (HOME-01K 전용) */}
        {briefing && (
          <KkirukBriefing tone={kkiruk.tone} greeting={kkiruk.greeting} lines={kkiruk.lines} action={kkiruk.action} onAction={runKkirukAction} />
        )}

        {/* 1. 운영 요약 */}
        <div className={`grid gap-4 ${briefing ? "grid-cols-3" : "grid-cols-4"}`}>
          {visibleSummaryCards.map(c => (
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
                {visibleSchedule.map((s, i) => (
                  <button key={i} type="button" onClick={() => { setCalendarFocus(s.focus); navigateTo("OPS-CAL-01"); }} className={`w-full text-left px-5 flex items-center gap-4 hover:bg-gray-50 ${briefing ? "py-2" : "py-3"}`}>
                    <span className="text-xs font-mono font-semibold text-gray-500 w-10 shrink-0">{s.date}</span>
                    <span className="text-xs font-medium text-gray-800 flex-1">{s.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {!briefing && <span className="text-[10px] text-gray-400">{s.dept}</span>}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColor(s.type)}`}>{s.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 6. 최근 활동 (브리핑 화면에서는 숨김) */}
            {!briefing && <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
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
            </div>}
          </div>

          {/* 오른쪽 1/3 */}
          <div className="flex flex-col gap-6">

            {/* 4. 조직 주요 알림 */}
            <div ref={alertPanelRef} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700">조직 주요 알림</p>
              </div>
              <div className="px-5 py-3 flex flex-col gap-2.5">
                {visibleAlerts.map((a, i) => (
                  <div key={a.label} className="relative">
                    <button type="button" onClick={(e) => a.kind === "default" ? navigateTo(a.screen) : (setAlertAnchorEl(e.currentTarget), setActiveAlertPicker(a.kind))} className="w-full text-left flex items-center justify-between py-1.5 rounded hover:bg-gray-50">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${a.color.split(" ")[1]}`}>
                        <a.icon className={`w-3.5 h-3.5 ${a.color.split(" ")[0]}`} />
                      </div>
                      <span className="text-xs text-gray-700">{a.label}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-900">{a.value}</span>
                  </button>
                    {a.kind !== "default" && activeAlertPicker === a.kind && alertPicker && (
                      <HomeAlertPicker title={alertPicker.title} items={alertPicker.items} onSelect={handleAlertPickerSelect} onClose={() => setActiveAlertPicker(null)} anchorEl={alertAnchorEl} panelRef={alertPickerRef} />
                    )}
                  </div>
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

// ─── HOME-01K 홈 — 끼룩이 브리핑 (HOME-01 검토안) ──────────────────────────────
// HOME-01 본문을 그대로 쓰고 상단 브리핑만 추가한다. HOME-01은 변경하지 않는다.

function HOME01K() {
  return <HOME01 briefing />;
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

const PROFILE_SCHOOLS = ["한양대학교 ERICA", "서울과학기술대학교", "연세대학교", "고려대학교", "성균관대학교"];
const PROFILE_COLLEGES: Record<string, string[]> = {
  "한양대학교 ERICA": ["소프트웨어융합대학", "경상대학", "디자인대학"],
  "서울과학기술대학교": ["공과대학", "인문사회대학"],
  "연세대학교": ["공과대학", "상경대학"],
};
const PROFILE_MAJORS: Record<string, string[]> = {
  "소프트웨어융합대학": ["컴퓨터학부", "ICT융합학부", "인공지능학과"],
  "경상대학": ["경영학부", "경제학부"],
  "디자인대학": ["주얼리·패션디자인학과", "커뮤니케이션디자인학과"],
  "공과대학": ["컴퓨터공학과", "기계공학과", "건축학부"],
  "인문사회대학": ["행정학과", "문예창작학과"],
  "상경대학": ["경제학부", "경영학부"],
};
const PROFILE_GRADES = ["1학년", "2학년", "3학년", "4학년", "5학년 이상", "대학원"];

function ProfileSearchSelect({
  label, value, options, placeholder, disabled = false, onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const filteredOptions = options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()));
  const hasNoResults = Boolean(query.trim()) && filteredOptions.length === 0;

  React.useEffect(() => setQuery(value), [value]);
  React.useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (fieldRef.current && !fieldRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);
  const selectValue = (nextValue: string) => { onChange(nextValue); setQuery(nextValue); setIsOpen(false); };

  return (
    <div className="flex flex-col gap-1.5">
      <label className={`text-xs font-medium ${disabled ? "text-gray-400" : "text-gray-700"}`}>{label}<span className="text-red-500">*</span></label>
      <div ref={fieldRef} className="relative">
        <Search className={`absolute left-3 top-2.5 w-4 h-4 ${disabled ? "text-gray-300" : "text-gray-400"} pointer-events-none`} />
        <input value={query} disabled={disabled} onChange={event => { setQuery(event.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} placeholder={placeholder} className={`w-full border rounded-lg py-2 pl-9 pr-8 text-sm outline-none transition-colors ${disabled ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed" : "bg-white border-gray-300 text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`} />
        <ChevronDown className={`absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none ${disabled ? "text-gray-300" : "text-gray-400"}`} />
        {!disabled && isOpen && (
          <div className="absolute z-20 top-[calc(100%+4px)] left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {filteredOptions.length > 0 ? <div className="max-h-40 overflow-y-auto py-1">{filteredOptions.map(option => <button key={option} type="button" onMouseDown={event => event.preventDefault()} onClick={() => selectValue(option)} className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700">{option}</button>)}</div> : hasNoResults ? <div className="p-3"><p className="text-xs text-gray-500">검색 결과가 없습니다.</p><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => selectValue(query.trim())} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">“{query.trim()}” 직접 입력으로 사용</button></div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ONB01() {
  const { navigateTo } = React.useContext(AppContext);
  const [school, setSchool] = useState("");
  const [college, setCollege] = useState("");
  const [major, setMajor] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [grade, setGrade] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const submitProfile = () => {
    if (!school || !college || !major || !name.trim() || !studentId.trim() || !grade) {
      setFormError("필수 학적 정보와 이름·학번을 모두 입력해 주세요.");
      return;
    }
    setFormError(null);
    navigateTo("ONB-02");
  };
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
            <div className="w-5 h-1.5 rounded-full bg-gray-200" />
            <span className="text-xs text-gray-400 ml-1">기본 설정 1 / 2</span>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">내 프로필에 표시될 학적 정보를 입력해 주세요</h2>
        <p className="text-sm text-gray-500 mb-6">학생회 활동에 사용할 내 프로필 정보입니다.</p>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-gray-500">기본 프로필</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">이름<span className="text-red-500">*</span></label><input value={name} onChange={event => setName(event.target.value)} placeholder="김바다" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" /></div>
              <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">학번<span className="text-red-500">*</span></label><input value={studentId} onChange={event => setStudentId(event.target.value)} inputMode="numeric" placeholder="예: 2022123456" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" /></div>
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-gray-500">학적 정보</p>
            <ProfileSearchSelect label="학교" value={school} options={PROFILE_SCHOOLS} placeholder="학교명을 검색하세요" onChange={nextSchool => { setSchool(nextSchool); setCollege(""); setMajor(""); }} />
            <ProfileSearchSelect label="단과대학" value={college} options={school ? (PROFILE_COLLEGES[school] ?? []) : []} placeholder={school ? "단과대학을 검색하세요" : "학교를 먼저 선택하세요"} disabled={!school} onChange={nextCollege => { setCollege(nextCollege); setMajor(""); }} />
            <ProfileSearchSelect label="학부·학과" value={major} options={college ? (PROFILE_MAJORS[college] ?? []) : []} placeholder={college ? "학부·학과를 검색하세요" : "단과대학을 먼저 선택하세요"} disabled={!college} onChange={setMajor} />
            <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">현재 학년<span className="text-red-500">*</span></label><select value={grade} onChange={event => setGrade(event.target.value)} className={`border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none ${grade ? "text-gray-800" : "text-gray-400"}`}><option value="" disabled className="text-gray-400">학년을 선택하세요</option>{PROFILE_GRADES.map(option => <option key={option} className="text-gray-800">{option}</option>)}</select></div>
          </section>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
        </div>

        <div className="mt-8">
          <Btn variant="primary" size="md" className="w-full justify-center" onClick={submitProfile}>
            다음: 시작 방식 선택 <ArrowRight className="w-4 h-4" />
          </Btn>
          <p className="mt-2 text-center text-[11px] text-gray-400">다음 단계에서 학생회 시작 방식을 선택합니다.</p>
        </div>
      </div>
    </div>
  );
}

function ONB02() {
  const { navigateTo } = React.useContext(AppContext);
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
            <span className="text-xs text-gray-400 ml-1">시작 방식 선택 2 / 2</span>
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
              screen: "ORG-01",
            },
            {
              title: "초대받은 학생회 참여하기",
              desc: "관리자에게 전달받은 초대 코드 또는 초대 링크로 참여합니다.",
              icon: ExternalLink,
              badge: "초대 코드 입력",
              screen: "INV-00",
            },
          ].map(({ title, desc, icon: Icon, badge, screen }) => (
            <button type="button" key={title} onClick={() => navigateTo(screen)} className="w-full border border-gray-200 rounded-lg p-5 flex items-center gap-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group text-left">
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
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">초대 링크로 직접 접속한 경우 이 화면을 건너뜁니다.</p>

        <div className="mt-4">
          <Btn variant="text" size="sm" onClick={() => navigateTo("ONB-01")}>
            <ArrowLeft className="w-3.5 h-3.5" /> 이전으로
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ONB03() {
  const { navigateTo } = React.useContext(AppContext);
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
            <span className="text-xs text-gray-400 ml-1">시작 방식 선택 2 / 2</span>
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
              { label: "네트워크 오류", example: null },
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
          <Btn variant="primary" size="md" className="w-full justify-center" onClick={() => {
            if (!code || code.length < 6) { setError("올바른 초대 코드를 입력해 주세요."); return; }
            if (code === "XXXXXXXX" || code === "OLD12345") { setError("사용할 수 없는 초대 코드입니다."); return; }
            navigateTo("INV-01");
          }}>
            학생회 확인
          </Btn>
        </div>
        <div className="mt-3">
          <Btn variant="text" size="sm" onClick={() => navigateTo("ONB-02")}>
            <ArrowLeft className="w-3.5 h-3.5" /> 이전으로
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Org Creation ─────────────────────────────────────────────────────────────

function ORG01() {
  const { navigateTo } = React.useContext(AppContext);
  const [organizationType, setOrganizationType] = useState<"총학생회" | "단과대 학생회" | "학부·학과 학생회" | "기타">("단과대 학생회");
  const [school, setSchool] = useState("");
  const [college, setCollege] = useState("");
  const [major, setMajor] = useState("");
  const [customScope, setCustomScope] = useState("");
  const needsCollege = organizationType === "단과대 학생회" || organizationType === "학부·학과 학생회";
  const needsMajor = organizationType === "학부·학과 학생회";
  const scopeHint = organizationType === "총학생회" ? "대표 학교를 선택해 주세요." : organizationType === "단과대 학생회" ? "대표 학교와 단과대학을 선택해 주세요." : needsMajor ? "대표 학교, 단과대학, 학부·학과를 선택해 주세요." : "대표 범위를 직접 입력해 주세요.";
  const selectOrganizationType = (nextType: typeof organizationType) => {
    setOrganizationType(nextType);
    setSchool("");
    setCollege("");
    setMajor("");
    setCustomScope("");
  };
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[520px] shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div><p className="text-xs text-gray-400 mb-1">새 학생회 만들기</p><h2 className="text-lg font-semibold text-gray-900">학생회 기본 정보</h2></div>
          <div className="flex items-center gap-1.5 pt-1"><div className="w-5 h-1.5 rounded-full bg-blue-600" /><div className="w-5 h-1.5 rounded-full bg-gray-200" /><span className="text-xs text-gray-400 ml-1">기본 정보 1 / 2</span></div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">학생회 유형<span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {["총학생회", "단과대 학생회", "학부·학과 학생회", "기타"].map((t) => (
                <button type="button" key={t} onClick={() => selectOrganizationType(t as typeof organizationType)} className={`px-3 py-2 rounded border text-xs font-medium ${t === organizationType ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
            <div><p className="text-xs font-medium text-gray-600">대표 범위</p><p className="mt-1 text-[11px] text-gray-400">{scopeHint}</p></div>
            {organizationType === "기타" ? (
              <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">대표 범위<span className="text-red-500">*</span></label><input value={customScope} onChange={event => setCustomScope(event.target.value)} placeholder="예: 대학원 총학생회, 연합 동아리" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" /></div>
            ) : <>
              <ProfileSearchSelect label="학교" value={school} options={PROFILE_SCHOOLS} placeholder="대표 학교를 검색하세요" onChange={nextSchool => { setSchool(nextSchool); setCollege(""); setMajor(""); }} />
              {needsCollege && <ProfileSearchSelect label="단과대학" value={college} options={school ? (PROFILE_COLLEGES[school] ?? []) : []} placeholder={school ? "대표 단과대학을 검색하세요" : "학교를 먼저 선택하세요"} disabled={!school} onChange={nextCollege => { setCollege(nextCollege); setMajor(""); }} />}
              {needsMajor && <ProfileSearchSelect label="학부·학과" value={major} options={college ? (PROFILE_MAJORS[college] ?? []) : []} placeholder={college ? "대표 학부·학과를 검색하세요" : "단과대학을 먼저 선택하세요"} disabled={!college} onChange={setMajor} />}
            </>}
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
          <Btn variant="secondary" size="md" onClick={() => navigateTo("ONB-02")}><ArrowLeft className="w-4 h-4" /> 이전</Btn>
          <div className="text-right"><Btn variant="primary" size="md" onClick={() => navigateTo("ORG-02")}>다음: 조직 구조 설정 <ArrowRight className="w-4 h-4" /></Btn><p className="mt-2 text-[11px] text-gray-400">다음 단계에서 기본 조직 또는 빈 조직을 선택하고 부서를 구성합니다.</p></div>
        </div>
      </div>
    </div>
  );
}

function ORG02() {
  const { navigateTo } = React.useContext(AppContext);
  // 템플릿 선택지는 제거했다. 기본 조직과 빈 조직 두 가지만 제공한다.
  const [structureMode, setStructureMode] = useState<"기본 조직" | "빈 조직">("기본 조직");
  const isEmptyStructure = structureMode === "빈 조직";
  const depts = isEmptyStructure ? [] : ["기획부", "홍보부", "디자인부"];
  const structureOptions = [
    { key: "기본 조직" as const, desc: "일반적인 학생회 조직을 생성합니다" },
    { key: "빈 조직" as const, desc: "회장단만 생성하고 필요한 부서를 직접 추가합니다" },
  ];
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[860px] shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div><p className="text-xs text-gray-400 mb-1">새 학생회 만들기</p><h2 className="text-lg font-semibold text-gray-900">조직 구조 설정</h2><p className="text-sm text-gray-500 mt-1">부서 구조를 설정하세요. 구성원 배정은 학생회를 만든 뒤 진행합니다.</p></div>
          <div className="flex items-center gap-1.5 pt-1"><div className="w-5 h-1.5 rounded-full bg-blue-600" /><div className="w-5 h-1.5 rounded-full bg-blue-600" /><span className="text-xs text-gray-400 ml-1">조직 구조 설정 2 / 2</span></div>
        </div>

        {/* 시작 방식 — 설명이 함께 보이도록 카드 선택으로 제공한다 */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {structureOptions.map((opt) => {
            const selected = structureMode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStructureMode(opt.key)}
                className={`text-left border rounded-xl px-4 py-3.5 transition-all ${
                  selected ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-100" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-blue-600" : "border-gray-300"}`}>
                    {selected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </span>
                  <span className={`text-sm font-semibold ${selected ? "text-blue-800" : "text-gray-800"}`}>{opt.key}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 ml-6 leading-5">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Org chart */}
        <div className="flex flex-col items-center gap-0 mb-8">
          <HQCard empty />
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

        <p className="text-xs text-gray-400 text-center mb-8">
          {isEmptyStructure
            ? "부서 추가를 눌러 필요한 부서를 만드세요. 구성원은 학생회를 만든 뒤 초대해 배정합니다."
            : "각 부서 카드 우측의 … 버튼으로 부서명 수정 및 삭제를 할 수 있습니다. 구성원은 학생회를 만든 뒤 초대해 배정합니다."}
        </p>

        <div className="flex items-center justify-between">
          <Btn variant="secondary" size="md" onClick={() => navigateTo("ORG-01")}><ArrowLeft className="w-4 h-4" /> 이전</Btn>
          <Btn variant="primary" size="md" onClick={() => navigateTo("HOME-01")}>조직 만들기</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Screen ────────────────────────────────────────────────────────────

function INV01() {
  const { navigateTo } = React.useContext(AppContext);
  const [school, setSchool] = useState("");
  const [college, setCollege] = useState("");
  const [major, setMajor] = useState("");
  const [grade, setGrade] = useState("");
  const [studentId, setStudentId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [hasDeclinedInvitation, setHasDeclinedInvitation] = useState(false);
  const joinOrganization = () => {
    if (!school || !college || !major || !grade || !studentId.trim()) {
      setFormError("학생회 참여 전에 본인 소속과 학번을 모두 입력해 주세요.");
      return;
    }
    setFormError(null);
    navigateTo("HOME-01");
  };
  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-8">
      <div className="bg-white border border-gray-200 rounded-xl p-8 w-[520px] shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">V</span>
          </div>
          <span className="font-semibold text-gray-900">Vada</span>
        </div>

        {hasDeclinedInvitation ? (
          <div className="py-12 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-500" /></div>
            <h2 className="mt-4 text-base font-semibold text-gray-900">학생회에 참여하지 않았습니다</h2>
            <p className="mt-2 text-xs leading-5 text-gray-500">다른 학생회의 초대 링크로 다시 접속하거나, 처음부터 새 학생회를 만들 수 있습니다.</p>
            <Btn variant="secondary" size="md" className="mt-6" onClick={() => navigateTo("ONB-01")}>처음으로 돌아가기</Btn>
          </div>
        ) : <>
        <div className="border border-gray-200 rounded-xl p-6 mb-6">
          <p className="text-xs text-gray-400 mb-1">초대받은 학생회</p>
          <h2 className="text-base font-semibold text-gray-900 mb-4">제12대 소프트웨어융합대학 학생회</h2>
          <div className="flex flex-col gap-2.5">
            {[
              ["유형", "단과대 학생회"],
              ["대표 범위", "한양대학교 ERICA · 소프트웨어융합대학"],
              ["운영 연도", "2026년"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-20 shrink-0">{k}</span>
                <span className="text-xs text-gray-700">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <section className="border border-gray-200 rounded-lg p-4 mb-5 flex flex-col gap-3">
          <div><p className="text-xs font-semibold text-gray-700">본인 소속 입력</p><p className="text-[11px] text-gray-400 mt-1">초대 링크로 처음 참여하는 경우에만 입력합니다.</p></div>
          <ProfileSearchSelect label="학교" value={school} options={PROFILE_SCHOOLS} placeholder="학교명을 검색하세요" onChange={nextSchool => { setSchool(nextSchool); setCollege(""); setMajor(""); }} />
          <ProfileSearchSelect label="단과대학" value={college} options={school ? (PROFILE_COLLEGES[school] ?? []) : []} placeholder={school ? "단과대학을 검색하세요" : "학교를 먼저 선택하세요"} disabled={!school} onChange={nextCollege => { setCollege(nextCollege); setMajor(""); }} />
          <ProfileSearchSelect label="학부·학과" value={major} options={college ? (PROFILE_MAJORS[college] ?? []) : []} placeholder={college ? "학부·학과를 검색하세요" : "단과대학을 먼저 선택하세요"} disabled={!college} onChange={setMajor} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">현재 학년<span className="text-red-500">*</span></label><select value={grade} onChange={event => setGrade(event.target.value)} className={`border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none ${grade ? "text-gray-800" : "text-gray-400"}`}><option value="" disabled className="text-gray-400">학년을 선택하세요</option>{PROFILE_GRADES.map(option => <option key={option} className="text-gray-800">{option}</option>)}</select></div>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">학번<span className="text-red-500">*</span></label><input value={studentId} onChange={event => setStudentId(event.target.value)} inputMode="numeric" placeholder="예: 2022123456" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" /></div>
          </div>
        </section>

        {formError && <p className="text-xs text-red-600 mb-4">{formError}</p>}
        <p className="text-xs text-gray-400 mb-4">참여하면 미배정 구성원으로 등록됩니다. 부서 배정은 학생회 관리자가 진행합니다.</p>

        <div className="flex flex-col gap-2">
          <Btn variant="primary" size="md" className="w-full justify-center" onClick={joinOrganization}>소속 입력 후 학생회 참여하기</Btn>
          <Btn variant="text" size="sm" className="w-full justify-center text-gray-500" onClick={() => setHasDeclinedInvitation(true)}>참여하지 않기</Btn>
        </div>
        </>}
      </div>
    </div>
  );
}

// ─── Org Management ───────────────────────────────────────────────────────────

const members = [
  { name: "김바다", dept: "컴퓨터학부", grade: "3학년" },
  { name: "박해수", dept: "컴퓨터학부", grade: "2학년" },
  { name: "이윤슬", dept: "ICT융합학부", grade: "4학년" },
  { name: "정하늘", dept: "컴퓨터학부", grade: "3학년" },
];

// 기본 학생회 조직 표본. EVT-01의 "기본 조직 불러오기/참여 부서만 선택"에서 시작 구성으로 저장한다.
// 특정 행사 전용이 아니라 공용 시작 템플릿이므로 여기서 파생해 저장하는 것은 데이터 복사가 아니다.
const BASE_ORG_TEAMS: EventOrgTeam[] = [
  { name: "운영팀", leader: "이윤슬", members: [members[0], members[1]] },
  { name: "홍보팀", leader: undefined, members: [members[2]] },
  { name: "현장팀", leader: "정하늘", members: [members[3]] },
];

// 팀·구성원까지 깊은 복사한다. 편집 초안이 BASE_ORG_TEAMS나 저장된 organization을 직접 변형하지 않게 한다.
const cloneOrgTeams = (teams: EventOrgTeam[]): EventOrgTeam[] =>
  teams.map(team => ({ name: team.name, leader: team.leader, members: team.members.map(member => ({ ...member })) }));

type UnassignedOrganizationMember = {
  name: string;
  dept: string;
  grade: string;
};

const DEFAULT_UNASSIGNED_ORGANIZATION_MEMBERS: UnassignedOrganizationMember[] = [
  { name: "정하늘", dept: "컴퓨터학부", grade: "3학년" },
  { name: "박해수", dept: "컴퓨터학부", grade: "2학년" },
];

// ─── HQCard — 회장단 부서 카드 ───────────────────────────────────────────────

type HQMember = {
  name: string;
  dept: string;
  grade: string;
  role: string;
};

const HQ_MEMBERS: HQMember[] = [
  { name: "김바다", dept: "컴퓨터학부", grade: "3학년", role: "회장" },
  { name: "이윤슬", dept: "ICT융합학부", grade: "4학년", role: "부회장" },
];

function HQCard({
  editMode = false,
  empty = false,
  members: assignedMembers,
  onRemoveMember,
}: {
  editMode?: boolean;
  empty?: boolean;
  members?: HQMember[];
  onRemoveMember?: (member: HQMember) => void;
}) {
  const [popover, setPopover] = useState<string | null>(null);
  const members = empty ? [] : (assignedMembers ?? HQ_MEMBERS);
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
        {/* 조직 구조 설정 단계에서는 아직 초대된 구성원이 없다. 구조만 만들고 배정은 이후 단계에서 한다. */}
        {empty && (
          <p className="text-[10px] text-gray-400 italic">구성원은 다음 단계에서 배정합니다</p>
        )}
        <div className="flex gap-2 flex-wrap">
          {members.map((m) => (
            <div key={m.name} className="relative">
              {editMode && (
                <button type="button" onClick={() => onRemoveMember?.(m)} aria-label={`${m.name} 회장단에서 제거`} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center z-10 hover:bg-red-500">
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

        {/* 구성원 추가 버튼 — 초대된 구성원이 있는 조직 관리 화면에서만 제공한다 */}
        {!empty && (
          <button className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1">
            <Plus className="w-3 h-3" /> 구성원 추가
          </button>
        )}
      </div>
    </div>
  );
}

function EventLeaderCard({ editMode = false, leader = "김바다", dept = "컴퓨터학부", grade = "3학년" }: { editMode?: boolean; leader?: string; dept?: string; grade?: string }) {
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
            <p className="text-xs font-semibold text-gray-800">{leader}</p>
            <p className="text-[10px] text-gray-500 leading-tight">{dept}</p>
            <p className="text-[10px] text-gray-400">{grade}</p>
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

function UnassignedMemberPanel({
  members,
  query,
  onQueryChange,
  onClose,
  onDelete,
  canDelete,
  editable = false,
}: {
  members: UnassignedOrganizationMember[];
  query: string;
  onQueryChange: (query: string) => void;
  onClose?: () => void;
  onDelete: (member: UnassignedOrganizationMember) => void;
  canDelete: boolean;
  editable?: boolean;
}) {
  const filteredMembers = members.filter(member => member.name.includes(query.trim()));
  return (
    <aside className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">미배정 구성원</p>
          <p className="text-xs text-gray-400 mt-0.5">{members.length}명{editable ? " · 드래그해서 부서로 이동" : ""}</p>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="미배정 구성원 패널 닫기" className="p-1 text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>}
      </div>
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5 bg-gray-50 focus-within:ring-1 focus-within:ring-blue-400">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="이름 검색" className="text-xs bg-transparent outline-none placeholder-gray-400 flex-1" />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {filteredMembers.length > 0 ? (
          <div className="flex flex-wrap gap-2 content-start">
            {filteredMembers.map(member => (
              <div key={member.name} className="relative">
                <MemberCard name={member.name} dept={member.dept} grade={member.grade} draggable={editable} />
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(member)}
                    className="mt-1 w-full inline-flex items-center justify-center gap-1 rounded border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <X className="w-3 h-3" /> 구성원 삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full min-h-36 flex flex-col items-center justify-center text-center px-4">
            <Users className="w-5 h-5 text-gray-300 mb-2" />
            <p className="text-xs font-medium text-gray-600">{query.trim() ? "검색 결과가 없습니다" : "미배정 구성원이 없습니다"}</p>
            <p className="text-[10px] text-gray-400 mt-1">{query.trim() ? "다른 이름으로 검색해 보세요." : "모든 구성원이 부서에 배정되었습니다."}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function UnassignedMemberDeleteDialog({
  member,
  onCancel,
  onConfirm,
}: {
  member: UnassignedOrganizationMember;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 bg-black/20 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border border-gray-200 shadow-xl rounded-xl p-6">
        <h3 className="text-sm font-bold text-gray-900">구성원을 삭제할까요?</h3>
        <p className="mt-2 text-xs leading-5 text-gray-600"><span className="font-semibold text-gray-800">{member.name}</span>님을 학생회 구성원에서 삭제합니다. 삭제한 구성원은 조직도와 구성원 목록에서 사라집니다.</p>
        <p className="mt-3 text-[11px] leading-5 text-red-600">이 작업은 현재 와이어프레임에서 되돌릴 수 없습니다.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={onCancel}>취소</Btn>
          <Btn variant="destructive" size="sm" onClick={onConfirm}>삭제</Btn>
        </div>
      </div>
    </div>
  );
}

function HQMemberRemoveDialog({
  member,
  remainingCount,
  onCancel,
  onConfirm,
}: {
  member: HQMember;
  remainingCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isLastMember = remainingCount <= 1;
  return (
    <div className="absolute inset-0 z-20 bg-black/20 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border border-gray-200 shadow-xl rounded-xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0"><AlertCircle className="w-4 h-4 text-orange-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{isLastMember ? "마지막 회장단은 제거할 수 없어요" : "회장단에서 제외할까요?"}</h3>
            <p className="mt-2 text-xs leading-5 text-gray-600">
              {isLastMember
                ? <>학생회 운영 책임을 유지하려면 회장단이 최소 1명 필요합니다. 먼저 다른 구성원을 회장단으로 지정한 뒤 <span className="font-semibold text-gray-800">{member.name}</span>님을 제외해 주세요.</>
                : <><span className="font-semibold text-gray-800">{member.name}</span>님은 회장단에서 제외되어 미배정 구성원으로 이동합니다. 학생회 구성원 기록은 삭제되지 않으며, 이후 다른 부서에 배정할 수 있습니다.</>}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={onCancel}>{isLastMember ? "확인" : "취소"}</Btn>
          {!isLastMember && <Btn variant="destructive" size="sm" onClick={onConfirm}>회장단에서 제외</Btn>}
        </div>
      </div>
    </div>
  );
}

function ORG03A() {
  const { currentUser, navigateTo, organizationMemberRoles } = React.useContext(AppContext);
  // 권한 매트릭스 ①: 조직 구조 수정은 회장단, 구성원 초대는 회장단·부서장(자기 부서만).
  // 열람은 전 구성원이므로 조직도 자체는 누구에게나 보인다.
  const canEditStructure = canEditOrganization(currentUser);
  const canInviteMember = canInviteOrganizationMember(currentUser);
  const visibleMembers = members.filter(member => organizationMemberRoles.some(organizationMember => organizationMember.name === member.name));
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "부서 및 구성원"]}
      title="제12대 소프트웨어융합대학 학생회"
      actions={<>
        {canInviteMember && <Btn variant="secondary" size="sm" onClick={() => navigateTo("ORG-03C")}><Users className="w-3.5 h-3.5" /> 구성원 초대</Btn>}
        {canEditStructure && <Btn variant="secondary" size="sm" onClick={() => navigateTo("ORG-03B")}>수정</Btn>}
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
                    leader={di === 0 ? "박해수" : undefined}
                    members={visibleMembers.slice(di + 1, di + 3)}
                  />
                </div>
              ))}
            </OrgBranch>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function ORG03B() {
  const { organizationMemberRoles, setOrganizationMemberRoles, navigateTo } = React.useContext(AppContext);
  const [unassignedQuery, setUnassignedQuery] = useState("");
  const [unassignedMembers, setUnassignedMembers] = useState(DEFAULT_UNASSIGNED_ORGANIZATION_MEMBERS);
  const [memberToDelete, setMemberToDelete] = useState<UnassignedOrganizationMember | null>(null);
  const [hqMembers, setHqMembers] = useState(HQ_MEMBERS);
  const [hqMemberToRemove, setHqMemberToRemove] = useState<HQMember | null>(null);
  const visibleMembers = members.filter(member => organizationMemberRoles.some(organizationMember => organizationMember.name === member.name));
  const deleteUnassignedMember = () => {
    if (!memberToDelete) return;
    setUnassignedMembers(current => current.filter(member => member.name !== memberToDelete.name));
    setOrganizationMemberRoles(current => current.filter(member => member.name !== memberToDelete.name));
    setMemberToDelete(null);
  };
  const removeHQMember = () => {
    if (!hqMemberToRemove || hqMembers.length <= 1) return;
    setHqMembers(current => current.filter(member => member.name !== hqMemberToRemove.name));
    setUnassignedMembers(current => current.some(member => member.name === hqMemberToRemove.name)
      ? current
      : [...current, { name: hqMemberToRemove.name, dept: hqMemberToRemove.dept, grade: hqMemberToRemove.grade }]);
    setOrganizationMemberRoles(current => current.map(member => member.name === hqMemberToRemove.name ? { ...member, role: "부원" } : member));
    setHqMemberToRemove(null);
  };
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "부서 및 구성원"]}
      title="제12대 소프트웨어융합대학 학생회"
      actions={<><Btn variant="secondary" size="sm" onClick={() => navigateTo("ORG-03C")}><Users className="w-3.5 h-3.5" /> 구성원 초대</Btn><Btn variant="primary" size="sm">완료</Btn></>}
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex flex-col items-center gap-0">
            <HQCard editMode members={hqMembers} onRemoveMember={setHqMemberToRemove} />
            <OrgStem />

            <OrgBranch>
              {["기획부", "홍보부", "디자인부"].map((dept, di) => (
                di === 1 ? (
                  <div key={dept} className="relative">
                    <DeptCard name={dept} leader={undefined} members={visibleMembers.slice(1, 3)} editMode />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 shadow-xl opacity-90 rotate-3 pointer-events-none">
                      <MemberCard name="박해수" dept="컴퓨터학부" grade="2학년" draggable />
                    </div>
                  </div>
                ) : (
                  <DeptCard key={dept} name={dept} leader={di === 0 ? "이윤슬" : undefined} members={visibleMembers.slice(di, di + 2)} editMode />
                )
              ))}
              <DeptCard name="" members={[]} addDept />
            </OrgBranch>
          </div>
        </div>

        <UnassignedMemberPanel members={unassignedMembers} query={unassignedQuery} onQueryChange={setUnassignedQuery} onDelete={setMemberToDelete} canDelete editable />
      </div>
      {memberToDelete && <UnassignedMemberDeleteDialog member={memberToDelete} onCancel={() => setMemberToDelete(null)} onConfirm={deleteUnassignedMember} />}
      {hqMemberToRemove && <HQMemberRemoveDialog member={hqMemberToRemove} remainingCount={hqMembers.length} onCancel={() => setHqMemberToRemove(null)} onConfirm={removeHQMember} />}
    </DesktopShell>
  );
}

function ORG03C() {
  const { navigateTo } = React.useContext(AppContext);
  const [regenerationTarget, setRegenerationTarget] = useState<"all" | "link" | "code" | null>(null);
  const [linkSuffix, setLinkSuffix] = useState("abc123xyz");
  const [inviteCode, setInviteCode] = useState("AB12CD34");
  const [lastRegeneratedAt, setLastRegeneratedAt] = useState("2026.07.22 18:30");
  const inviteLink = `https://vada.app/join/swcollege12/${linkSuffix}`;
  const formatRegeneratedAt = () => {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };
  const regenerateInvitation = () => {
    if (!regenerationTarget) return;
    const nonce = Date.now().toString(36);
    if (regenerationTarget === "all" || regenerationTarget === "link") setLinkSuffix(nonce.slice(-9));
    if (regenerationTarget === "all" || regenerationTarget === "code") setInviteCode(nonce.slice(-8).toUpperCase().padStart(8, "0"));
    setLastRegeneratedAt(formatRegeneratedAt());
    setRegenerationTarget(null);
  };
  const dialogCopy = regenerationTarget === "link"
    ? { title: "초대 링크를 재생성할까요?", summary: "새로운 초대 링크가 만들어집니다. 기존 링크는 즉시 사용할 수 없게 됩니다.", detail: "초대 코드는 그대로 사용할 수 있으며, 기존 초대로 참여한 구성원에게는 영향을 주지 않습니다." }
    : regenerationTarget === "code"
      ? { title: "초대 코드를 재생성할까요?", summary: "새로운 초대 코드가 만들어집니다. 기존 코드는 즉시 사용할 수 없게 됩니다.", detail: "초대 링크는 그대로 사용할 수 있으며, 기존 초대로 참여한 구성원에게는 영향을 주지 않습니다." }
      : { title: "초대 정보를 재생성할까요?", summary: "새로운 초대 링크와 코드가 만들어집니다. 기존 링크와 코드는 즉시 사용할 수 없게 됩니다.", detail: "이미 기존 초대로 참여한 구성원에게는 영향을 주지 않습니다." };
  return (
    <DesktopShell
      activeSidebar="조직 관리"
      breadcrumb={["조직 관리", "부서 및 구성원"]}
      title="제12대 소프트웨어융합대학 학생회"
      actions={<><Btn variant="secondary" size="sm" onClick={() => navigateTo("ORG-03A")}><ArrowLeft className="w-3.5 h-3.5" /> 조직 관리로</Btn></>}
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
            <button type="button" onClick={() => navigateTo("ORG-03A")} aria-label="조직 관리로 돌아가기" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></button>
            <p className="text-sm font-semibold text-gray-800">구성원 초대</p>
          </div>
          <div className="flex-1 p-5 flex flex-col gap-5 overflow-auto">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">제12대 소프트웨어융합대학 학생회</p>
              <p className="text-xs text-gray-500">초대 링크 또는 초대 코드를 공유하면 구성원이 학생회에 참여할 수 있습니다.</p>
            </div>

            <section className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-green-900">초대 정보</p>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">활성</span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-green-800">현재 사용할 수 있는 초대 정보입니다.</p>
              <p className="mt-1.5 text-[10px] text-green-700">마지막 재생성: {lastRegeneratedAt}</p>
            </section>

            {/* Link section */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">공용 초대 링크</p>
              <div className="border border-gray-200 rounded p-2.5 bg-gray-50 mb-2">
                <p className="text-xs text-gray-500 break-all font-mono">{inviteLink}</p>
              </div>
              <div className="flex gap-2"><Btn variant="secondary" size="sm"><Copy className="w-3.5 h-3.5" /> 링크 복사</Btn><Btn variant="secondary" size="sm" onClick={() => setRegenerationTarget("link")}><RefreshCw className="w-3.5 h-3.5" /> 링크 재생성</Btn></div>
            </div>

            {/* Code section */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">짧은 초대 코드</p>
              <div className="border border-gray-200 rounded p-2.5 bg-gray-50 mb-2 flex items-center justify-between">
                <span className="text-xl font-mono font-bold text-gray-800 tracking-widest">{inviteCode}</span>
              </div>
              <div className="flex gap-2"><Btn variant="secondary" size="sm"><Copy className="w-3.5 h-3.5" /> 코드 복사</Btn><Btn variant="secondary" size="sm" onClick={() => setRegenerationTarget("code")}><RefreshCw className="w-3.5 h-3.5" /> 코드 재생성</Btn></div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500 mb-2">링크와 코드는 <strong>동일한 초대 권한</strong>입니다. 어느 방식으로든 참여한 구성원은 미배정으로 등록됩니다.</p>
              <Btn variant="text" size="sm" className="text-red-500" onClick={() => setRegenerationTarget("all")}>
                <RefreshCw className="w-3 h-3" /> 초대 정보 모두 재생성
              </Btn>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirm dialog */}
      {regenerationTarget && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-20">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-6 w-[360px]">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{dialogCopy.title}</h3>
            <p className="text-xs leading-5 text-gray-600">{dialogCopy.summary}</p>
            <p className="mt-3 text-xs leading-5 text-gray-500">{dialogCopy.detail}</p>
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setRegenerationTarget(null)}>취소</Btn>
              <Btn variant="destructive" size="sm" onClick={regenerateInvitation}>재생성</Btn>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
}

// ─── Student Roster ───────────────────────────────────────────────────────────

// 관리 범위가 컴퓨터학부이므로 명단에는 컴퓨터학부 학생만 들어간다.
// 범위 밖 학생은 ORG-07B 검증에서 반영 제외되므로 이 목록에 존재할 수 없다.
// 단과대학은 관리 범위와 무관하게 모든 행에 표기한다.
type StudentFeeStatus = "납부" | "미납" | "미확인" | "확인 필요";
type StudentRosterRow = {
  name: string;
  id: string;
  college: string;
  dept: string;
  grade: string;
  status: StudentFeeStatus;
  statusV: "green" | "red" | "gray" | "yellow";
};

const INITIAL_STUDENT_ROWS: StudentRosterRow[] = [
  { name: "김바다", id: "2022123456", college: "소프트웨어융합대학", dept: "컴퓨터학부", grade: "3학년", status: "납부", statusV: "green" as const },
  { name: "박해수", id: "2023234567", college: "소프트웨어융합대학", dept: "컴퓨터학부", grade: "2학년", status: "납부", statusV: "green" as const },
  { name: "이윤슬", id: "2020345678", college: "소프트웨어융합대학", dept: "컴퓨터학부", grade: "4학년", status: "미납", statusV: "red" as const },
  { name: "정하늘", id: "2022456789", college: "소프트웨어융합대학", dept: "컴퓨터학부", grade: "3학년", status: "미납", statusV: "red" as const },
  { name: "최바람", id: "2021567890", college: "소프트웨어융합대학", dept: "컴퓨터학부", grade: "3학년", status: "확인 필요", statusV: "yellow" as const },
  { name: "강별", id: "2024678901", college: "소프트웨어융합대학", dept: "컴퓨터학부", grade: "1학년", status: "납부", statusV: "green" as const },
  { name: "오하늘", id: "2023789012", college: "소프트웨어융합대학", dept: "컴퓨터학부", grade: "2학년", status: "납부", statusV: "green" as const },
  { name: "윤서진", id: "2022890123", college: "소프트웨어융합대학", dept: "컴퓨터학부", grade: "3학년", status: "미납", statusV: "red" as const },
];

// 학생 기본 명단과 학생회비 납부 명단은 서로 다른 주기로 갱신되므로 이력을 분리한다.
type RosterUpdate = { at: string; kind: "학생 명단 업로드" | "개별 수정"; by: string };
type FeeRosterUpdate = { at: string; term: string; by: string };
const INITIAL_ROSTER_UPDATE: RosterUpdate = { at: "2026-07-20 14:32", kind: "학생 명단 업로드", by: "이지원" };
const INITIAL_FEE_ROSTER_UPDATE: FeeRosterUpdate = { at: "2026-07-18 10:15", term: "2026년 1학기", by: "김민준" };

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
      title="조직 관리 홈"
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
  { area: "행사 완료 처리", values: ["가능", "—", "—"], confirmed: true },
  { area: "행사 운영 조직 구성·수정", values: ["가능", "행사 조직 관리자만", "행사 조직 관리자만"], confirmed: true },
  { area: "조직 구조 수정", values: ["가능", "—", "—"], confirmed: true },
  { area: "구성원 초대", values: ["가능", "자기 부서만", "—"], confirmed: true },
  { area: "학생 명단 열람", values: ["가능", "가능", "가능"], confirmed: true },
  { area: "학생 명단 업로드·갱신", values: ["가능", "—", "—"], confirmed: true },
  { area: "학생회비 납부 명단 업로드", values: ["가능", "재정부만", "재정부만"], confirmed: true },
  { area: "학생 명단 내보내기", values: ["가능", "—", "—"], confirmed: true },
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
              <p className="text-[11px] text-gray-600 leading-5"><span className="font-semibold text-gray-800">행사 운영 조직 역할</span> — 행사별로 구성되며 기본 학생회 조직과 별개의 데이터입니다. 행사 조직을 수정해도 기본 조직은 변경되지 않습니다. 표의 <span className="font-semibold text-gray-800">행사 조직만</span>은 그 행사의 운영 조직에 속한 경우, <span className="font-semibold text-gray-800">행사 조직 관리자만</span>은 그 조직의 관리자인 경우를 뜻합니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <p className="text-[11px] text-gray-600 leading-5">행사 조직 관리자는 행사 운영 조직과 담당 업무를 관리할 수 있지만, 행사를 최종 완료 처리할 수는 없습니다. <span className="font-semibold text-gray-800">행사 완료 처리는 회장단만 가능합니다.</span></p>
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

function ORG07A({
  onOpenRoster,
  onOpenFeeRoster,
  rows = INITIAL_STUDENT_ROWS,
  lastRosterUpdate = INITIAL_ROSTER_UPDATE,
  lastFeeRosterUpdate = INITIAL_FEE_ROSTER_UPDATE,
}: {
  onOpenRoster?: () => void;
  onOpenFeeRoster?: () => void;
  rows?: StudentRosterRow[];
  lastRosterUpdate?: RosterUpdate;
  lastFeeRosterUpdate?: FeeRosterUpdate;
}) {
  const { currentUser } = React.useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("모든 학년");
  const [feeFilter, setFeeFilter] = useState<"학생회비 전체" | StudentFeeStatus>("학생회비 전체");
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  // 학생 기본 명단과 학생회비 명단은 데이터 책임과 권한을 분리한다.
  const canUploadRoster = canManageStudentRoster(currentUser);
  const canUploadFeeRoster = canManageStudentFeeRoster(currentUser);
  const canExportRoster = canManageStudentRoster(currentUser);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR");
  const filteredRows = rows.filter(row => {
    const matchesSearch = normalizedQuery.length === 0
      || row.name.toLocaleLowerCase("ko-KR").includes(normalizedQuery)
      || row.id.includes(normalizedQuery);
    const matchesGrade = gradeFilter === "모든 학년" || row.grade === gradeFilter;
    const matchesFee = feeFilter === "학생회비 전체" || row.status === feeFilter;
    return matchesSearch && matchesGrade && matchesFee;
  });
  const downloadRoster = () => {
    if (filteredRows.length === 0) return;
    const escapeCsvCell = (value: string) => {
      const singleLineValue = value.replace(/\r?\n/g, " ");
      const formulaSafeValue = /^[=+\-@]/.test(singleLineValue) ? `'${singleLineValue}` : singleLineValue;
      return `"${formulaSafeValue.replace(/"/g, '""')}"`;
    };
    const headers = ["이름", "학번", "단과대학", "학부·학과", "학년", "학생회비"];
    const csvRows = filteredRows.map(row => [row.name, row.id, row.college, row.dept, row.grade, row.status]);
    const csv = `\uFEFF${[headers, ...csvRows].map(row => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date();
    const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
    link.href = url;
    link.download = `컴퓨터학부_학생명단_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setShowExportConfirm(false);
  };
  return (
    <>
      <DesktopShell
        activeSidebar="조직 관리"
        breadcrumb={["조직 관리", "학생 명단"]}
        title="학생 명단 관리"
        actions={<>
          {canUploadRoster && <Btn variant="secondary" size="sm" onClick={onOpenRoster}><Upload className="w-3.5 h-3.5" /> 학생 명단 업로드·갱신</Btn>}
          {canUploadFeeRoster && <Btn variant="secondary" size="sm" onClick={onOpenFeeRoster}><Upload className="w-3.5 h-3.5" /> 학생회비 납부 명단 업로드</Btn>}
          {canExportRoster && <Btn variant="secondary" size="sm" disabled={filteredRows.length === 0} onClick={() => setShowExportConfirm(true)}><Download className="w-3.5 h-3.5" /> 명단 내보내기</Btn>}
        </>}
      >
        <div className="p-6 flex flex-col gap-4">
        {/* Scope banner — 관리 범위와 기준 시점을 한 묶음으로 읽게 한다 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-700 mb-0.5">관리 범위</p>
            <p className="text-xs text-blue-600">한양대학교 ERICA › 소프트웨어융합대학 › 컴퓨터학부</p>
            <p className="text-xs text-blue-500 mt-0.5">컴퓨터학부 학생만 이 명단에 등록할 수 있습니다. 범위 변경은 조직 설정에서 가능합니다.</p>
          </div>
          <div className="shrink-0 border-l border-blue-200 pl-5 grid grid-cols-2 gap-5">
            <div className="text-right">
              <p className="text-xs font-semibold text-blue-700 mb-0.5">학생 명단 갱신</p>
              <p className="text-xs text-blue-600 font-mono">{lastRosterUpdate.at}</p>
              <p className="text-xs text-blue-500 mt-0.5">{lastRosterUpdate.kind} · {lastRosterUpdate.by}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-blue-700 mb-0.5">학생회비 명단 갱신</p>
              <p className="text-xs text-blue-600 font-mono">{lastFeeRosterUpdate.at}</p>
              <p className="text-xs text-blue-500 mt-0.5">{lastFeeRosterUpdate.term} · {lastFeeRosterUpdate.by}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded px-3 py-1.5 bg-white w-60">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="이름, 학번 검색"
              aria-label="학생 이름 또는 학번 검색"
              className="text-xs outline-none placeholder-gray-400 flex-1"
            />
          </div>
          <div className="relative">
            <select
              value={gradeFilter}
              onChange={event => setGradeFilter(event.target.value)}
              aria-label="학년 필터"
              className="border border-gray-200 rounded px-3 py-1.5 text-xs bg-white appearance-none pr-7"
            >
              <option>모든 학년</option>
              <option>1학년</option><option>2학년</option><option>3학년</option><option>4학년</option>
            </select>
            <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={feeFilter}
              onChange={event => setFeeFilter(event.target.value as "학생회비 전체" | StudentFeeStatus)}
              aria-label="학생회비 납부 상태 필터"
              className="border border-gray-200 rounded px-3 py-1.5 text-xs bg-white appearance-none pr-7"
            >
              <option value="학생회비 전체">학생회비 전체</option>
              <option value="납부">납부 확인</option><option value="미납">미납</option><option value="미확인">미확인</option><option value="확인 필요">확인 필요</option>
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
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">단과대학</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">학부·학과</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">학년</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">학생회비</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(r => (
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50 ${r.status === "확인 필요" ? "bg-yellow-50" : ""}`}>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-900">
                    <div className="flex items-center gap-1.5">
                      {r.name}
                      {r.status === "확인 필요" && <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{r.id}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{r.college}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{r.dept}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{r.grade}</td>
                  <td className="px-4 py-2.5"><Chip label={r.status} variant={r.statusV} /></td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-gray-500">검색·필터 조건에 맞는 학생이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{filteredRows.length === rows.length ? `총 ${rows.length}명` : `검색 결과 ${filteredRows.length}명 · 전체 ${rows.length}명`}</span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 border border-gray-200 rounded text-gray-400">이전</button>
            <button className="px-2 py-1 border border-blue-500 rounded bg-blue-50 text-blue-700">1</button>
            <button className="px-2 py-1 border border-gray-200 rounded text-gray-600">다음</button>
          </div>
        </div>
        </div>
      </DesktopShell>

      {showExportConfirm && (
        <div className="absolute inset-0 z-30 bg-black/30 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby="roster-export-title">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 id="roster-export-title" className="text-sm font-semibold text-gray-900">학생 명단을 내보낼까요?</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">현재 화면에 표시된 <span className="font-semibold text-gray-700">{filteredRows.length}명</span>의 명단을 CSV 파일로 저장합니다.</p>
              </div>
              <button type="button" onClick={() => setShowExportConfirm(false)} aria-label="내보내기 안내 닫기" className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[11px] font-semibold text-gray-700">파일에 포함되는 정보</p>
                <p className="mt-1 text-xs leading-5 text-gray-600">이름 · 학번 · 단과대학 · 학부·학과 · 학년 · 학생회비</p>
                <p className="mt-2 text-[11px] text-gray-500">현재 적용된 검색·학년·학생회비 필터 결과만 포함됩니다.</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs leading-5 text-amber-800">학번과 학생회비 납부 여부가 포함된 개인정보 파일입니다. 필요한 구성원에게만 공유하고, 사용이 끝나면 안전하게 삭제해 주세요.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setShowExportConfirm(false)}>취소</Btn>
              <Btn variant="primary" size="sm" onClick={downloadRoster}><Download className="w-3.5 h-3.5" /> CSV 다운로드</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ORG07B({ onClose, onApply }: { onClose?: () => void; onApply?: () => void }) {
  const [step, setStep] = useState(0);
  const [fileReady, setFileReady] = useState(false);
  const steps = ["파일 업로드", "검증 결과"];
  return (
    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[600px] max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">학생 명단 업로드·갱신</h3>
            <p className="text-xs text-gray-400 mt-0.5">한양대학교 ERICA · 소프트웨어융합대학 · 컴퓨터학부</p>
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
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">보유한 학생 명단 파일을 바로 업로드하세요.</p>
                <p className="text-xs text-gray-500 mt-1 leading-5">필수 열: 이름 · 학번 · 단과대학 · 학부·학과 · 학년</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-9 flex flex-col items-center gap-3 text-center">
                <Upload className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-600 font-medium">파일을 드래그하거나 클릭하여 업로드</p>
                <p className="text-xs text-gray-400">.xlsx · .csv 형식 지원</p>
                <Btn variant="secondary" size="sm" onClick={() => setFileReady(true)}>파일 선택</Btn>
              </div>
              {fileReady && (
                <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-green-800">2026-1학기_컴퓨터학부_재학생.xlsx</p>
                    <p className="text-[11px] text-green-600 mt-0.5">파일 선택 완료 · 검증할 수 있습니다.</p>
                  </div>
                  <button type="button" onClick={() => setFileReady(false)} className="text-[11px] text-green-700 hover:underline">삭제</button>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded p-3">
                <p className="text-xs text-blue-700">학생회비 열이 포함되어 있어도 이 업로드에서는 반영하지 않습니다. 학생회비 상태는 별도 납부 명단에서 갱신합니다.</p>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-700 font-medium">검증 완료. 치명적 오류 없이 8명을 반영할 수 있습니다.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: "신규 등록", value: "0명" }, { label: "정보 갱신", value: "8명" }, { label: "현재 명단 제외", value: "0명" }].map(item => (
                  <div key={item.label} className="border border-gray-200 rounded-lg p-4">
                    <p className="text-[11px] text-gray-500">{item.label}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {["필수 열과 데이터 형식", "학번 중복", "대표 범위 밖 학생"].map(label => (
                  <div key={label} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-gray-600">{label}</span>
                    <Chip label="문제 없음" variant="green" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 leading-5">학번 기준으로 현재 학생 명단을 갱신합니다. 명단에서 제외되는 학생도 과거 행사·참가 기록은 유지되며 학생회비 상태는 바뀌지 않습니다.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
          <Btn variant="secondary" size="sm" onClick={onClose}>취소</Btn>
          <div className="flex gap-2">
            {step === 1 && <Btn variant="secondary" size="sm" onClick={() => { setStep(0); setFileReady(false); }}>파일 다시 선택</Btn>}
            {step === 0
              ? <Btn variant="primary" size="sm" disabled={!fileReady} onClick={() => setStep(1)}>검증하기</Btn>
              : <Btn variant="primary" size="sm" onClick={() => { onApply?.(); onClose?.(); }}>명단 반영</Btn>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function ORG07C({ onClose, onApply }: { onClose?: () => void; onApply?: (term: string) => void }) {
  const [step, setStep] = useState(0);
  const [term, setTerm] = useState("2026년 1학기");
  const [fileReady, setFileReady] = useState(false);
  const steps = ["파일 업로드", "검증 결과"];
  return (
    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[600px] max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">학생회비 납부 명단 업로드</h3>
            <p className="text-xs text-gray-400 mt-0.5">학생 기본 명단과 대조해 학기별 납부 상태를 갱신합니다.</p>
          </div>
          <button onClick={onClose} aria-label="학생회비 납부 명단 업로드 닫기" className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-0">
            {steps.map((label, index) => (
              <div key={label} className="flex items-center gap-0">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${index === step ? "bg-blue-600 text-white" : index < step ? "text-green-600" : "text-gray-400"}`}>
                  {index < step ? <Check className="w-3 h-3" /> : <span>{index + 1}</span>}
                  {label}
                </div>
                {index < steps.length - 1 && <div className="w-6 h-px bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">기준 학기</label>
                <select value={term} onChange={event => setTerm(event.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white">
                  <option>2026년 1학기</option>
                  <option>2026년 2학기</option>
                  <option>2025년 2학기</option>
                </select>
                <p className="text-[11px] text-gray-400">선택한 학기의 전체 납부자 명단을 업로드하세요. 다른 학기 기록은 유지됩니다.</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-9 flex flex-col items-center gap-3 text-center">
                <Upload className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-600 font-medium">학생회비 납부자 명단 업로드</p>
                <p className="text-xs text-gray-400">필수 열: 학번 · 이름 권장 · .xlsx · .csv</p>
                <Btn variant="secondary" size="sm" onClick={() => setFileReady(true)}>파일 선택</Btn>
              </div>
              {fileReady && (
                <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-green-800">2026-1학기_학생회비_납부자.xlsx</p>
                    <p className="text-[11px] text-green-600 mt-0.5">파일 선택 완료 · 학생 명단과 대조할 수 있습니다.</p>
                  </div>
                  <button type="button" onClick={() => setFileReady(false)} className="text-[11px] text-green-700 hover:underline">삭제</button>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded p-3">
                <p className="text-xs text-blue-700 leading-5">파일에 포함된 학생은 납부, 같은 학기의 학생 명단에 있지만 포함되지 않은 학생은 미납으로 반영합니다. 기준 명단에 없는 학번으로 학생을 새로 만들지 않습니다.</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-700 font-medium">{term} 납부자 명단을 학생 기본 명단과 대조했습니다.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: "명단 일치", value: "5명" }, { label: "기준 명단 없음", value: "0명" }, { label: "중복 학번", value: "0명" }].map(item => (
                  <div key={item.label} className="border border-gray-200 rounded-lg p-4">
                    <p className="text-[11px] text-gray-500">{item.label}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="border border-gray-200 rounded-lg px-4 py-4">
                <p className="text-xs font-semibold text-gray-800">반영 후 상태</p>
                <div className="flex gap-5 mt-3 text-xs text-gray-600">
                  <span>납부 <strong className="text-green-700">5명</strong></span>
                  <span>미납 <strong className="text-red-700">3명</strong></span>
                  <span>확인 필요 <strong className="text-gray-700">0명</strong></span>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-5">학생 기본정보와 과거 학기 납부 상태는 변경하지 않습니다. 이 결과는 행사 설문의 학생회비 조건부 참가비 판정에 사용됩니다.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
          <Btn variant="secondary" size="sm" onClick={onClose}>취소</Btn>
          <div className="flex gap-2">
            {step === 1 && <Btn variant="secondary" size="sm" onClick={() => { setStep(0); setFileReady(false); }}>파일 다시 선택</Btn>}
            {step === 0
              ? <Btn variant="primary" size="sm" disabled={!fileReady} onClick={() => setStep(1)}>검증하기</Btn>
              : <Btn variant="primary" size="sm" onClick={() => { onApply?.(term); onClose?.(); }}>납부 상태 반영</Btn>
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

// 대표 행사명. 홈 등 대표 행사만 표시하는 곳에서 참조한다.
const MAIN_EVENT_NAME = "2026 소프트웨어융합대학 체육대회";

// 행사 레코드에서 목록 카드 표시값을 파생한다. 세부 데이터가 없으면 미정으로 표시하고
// 다른 행사의 수치를 복사하지 않는다. name·상태는 레코드가 단일 기준이므로 워크스페이스와 일치한다.
const eventListRow = (record: EventRecord) => {
  const startAt = record.info.startAt;
  const date = startAt
    ? `${startAt.slice(0, 10).replaceAll("-", ". ")}${startAt.slice(11, 16) ? ` ${startAt.slice(11, 16)}` : ""}`
    : "일시 미정";
  return {
    id: record.id,
    name: record.info.name,
    date,
    place: record.info.placeConfirmed && record.info.placeName ? record.info.placeName : "장소 미정",
    manager: record.info.dept || "담당 미정",
    updatedAt: record.listMeta.updatedAt,
    lifecycle: record.lifecycle,
    highlights: record.listMeta.highlights,
    followUpItems: record.listMeta.followUpItems,
  };
};

function EventListScreen({ manager = false }: { manager?: boolean }) {
  const { navigateTo, eventRecords, setEventRecords, setSelectedEventId } = React.useContext(AppContext);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"전체" | EventLifecycle>("전체");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const openEvent = (id: string) => {
    // 카드를 열기 전에 반드시 해당 행사를 선택해 워크스페이스가 같은 행사로 전환되게 한다.
    setSelectedEventId(id);
    navigateTo("EVT-02");
  };

  const handleCreateEvent = (name: string) => {
    // 고유 id를 만들고 기획 중 상태의 빈 레코드를 생성한다. 다른 행사 정보를 복사하지 않는다.
    const id = `EVT-${Date.now()}`;
    const record: EventRecord = {
      id,
      info: makeEmptyEventInfo(name),
      lifecycle: "기획 중",
      tasks: [],
      surveySettings: EMPTY_SURVEY_SETTINGS,
      createdAt: "방금 전",
      listMeta: { updatedAt: "방금 전", highlights: ["기본 정보 입력 필요"] },
    };
    setEventRecords(list => [record, ...list]);
    setSelectedEventId(id);
    setModalOpen(false);
    navigateTo("EVT-02");
  };

  // 완료/취소됨은 이 목록에서 제외 (완료된 행사는 REC-01)
  const activeData = eventRecords
    .filter(record => record.lifecycle !== "완료" && record.lifecycle !== "취소됨")
    .map(eventListRow);
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
            <button onClick={() => navigateTo("REC-01")} className="text-xs text-blue-600 hover:underline mr-2">완료된 행사 보기 →</button>
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
                <p className="text-sm font-semibold text-gray-700 mb-1">아직 등록된 행사가 없습니다</p>
                <p className="text-xs text-gray-400">{manager ? "행사명만 입력하면 행사 공간을 만들고 회의와 업무부터 시작할 수 있습니다." : "행사가 등록되면 이곳에서 확인할 수 있습니다. 행사 생성은 회장단·부서장이 담당합니다."}</p>
              </div>
              {manager && (
                <Btn variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> 첫 행사 만들기
                </Btn>
              )}
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
                    key={evt.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer relative group"
                    onClick={() => openEvent(evt.id)}
                  >
                    {/* 더보기 버튼 — 행사 정보 수정·보관·삭제는 운영진(회장단·부서장)에게만 노출 */}
                    {manager && (
                      <>
                        <button
                          className="absolute top-4 right-4 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === evt.id ? null : evt.id); }}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuOpen === evt.id && (
                          <div className="absolute top-10 right-4 z-20 bg-white border border-gray-200 shadow-lg rounded-lg py-1 w-36" onClick={e => e.stopPropagation()}>
                            <button className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">행사 정보 수정</button>
                            <button className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">행사 보관</button>
                            <button className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50">행사 삭제</button>
                          </div>
                        )}
                      </>
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
  const { navigateTo, eventInfo, setEventOrganization } = React.useContext(AppContext);
  const [mode, setMode] = useState<"import" | "select" | "empty">("import");
  const [leaderName, setLeaderName] = useState("김바다");
  // "참여 부서만 선택"용 선택 상태. BASE_ORG_TEAMS를 깊은 복사해 팀/구성원 포함 여부를 관리한다(원본 불변).
  const [teamPicks, setTeamPicks] = useState(() =>
    BASE_ORG_TEAMS.map(team => ({
      name: team.name,
      leader: team.leader,
      included: true,
      memberPicks: team.members.map(member => ({ member: { ...member }, included: true })),
    }))
  );
  const leaderInfo = members.find(member => member.name === leaderName) ?? { dept: "", grade: "" };

  const toggleTeam = (teamIndex: number) =>
    setTeamPicks(picks => picks.map((pick, index) => index === teamIndex ? { ...pick, included: !pick.included } : pick));
  const toggleMember = (teamIndex: number, memberIndex: number) =>
    setTeamPicks(picks => picks.map((pick, index) => index !== teamIndex ? pick : {
      ...pick,
      memberPicks: pick.memberPicks.map((memberPick, mIndex) => mIndex === memberIndex ? { ...memberPick, included: !memberPick.included } : memberPick),
    }));

  // 선택 모드 저장 대상: 포함한 팀만, 각 팀에서 포함한 구성원만. 부서장은 선택 구성원에 남아 있을 때만 유지.
  const buildSelectedTeams = (): EventOrgTeam[] =>
    teamPicks.filter(pick => pick.included).map(pick => {
      const chosen = pick.memberPicks.filter(memberPick => memberPick.included).map(memberPick => ({ ...memberPick.member }));
      const keepLeader = pick.leader && chosen.some(member => member.name === pick.leader);
      return { name: pick.name, leader: keepLeader ? pick.leader : undefined, members: chosen };
    });

  const selectedTeamCount = teamPicks.filter(pick => pick.included).length;
  const canSave = mode !== "select" || selectedTeamCount > 0;

  const handleSave = () => {
    if (!canSave) return;
    const teams = mode === "import" ? cloneOrgTeams(BASE_ORG_TEAMS)
      : mode === "empty" ? []
      : buildSelectedTeams();
    // 선택된 행사에 실제로 운영 조직을 저장한 뒤에만 조회 화면으로 이동한다.
    setEventOrganization({
      leader: leaderName,
      leaderDept: leaderInfo.dept,
      leaderGrade: leaderInfo.grade,
      mode,
      teams,
    });
    navigateTo("EVT-03A");
  };

  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-10 w-[860px] shadow-sm">
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-1">{eventInfo.name}</p>
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
              <select value={leaderName} onChange={e => setLeaderName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8">
                {members.map(member => <option key={member.name} value={member.name}>{member.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-3">참여 팀 구성</p>

            {/* 기본 조직 불러오기 — 전체 팀을 그대로 표시·저장 */}
            {mode === "import" && (
              <div className="flex gap-4 flex-wrap">
                {BASE_ORG_TEAMS.map(team => (
                  <DeptCard key={team.name} name={team.name} leader={team.leader} members={team.members} />
                ))}
              </div>
            )}

            {/* 참여 부서만 선택 — 팀/구성원 체크박스 */}
            {mode === "select" && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-gray-500">참여할 팀과 구성원을 선택하세요. 선택하지 않은 팀·구성원은 저장되지 않습니다.</p>
                <div className="grid grid-cols-3 gap-4">
                  {teamPicks.map((pick, teamIndex) => {
                    const leaderInMembers = pick.leader ? pick.memberPicks.some(memberPick => memberPick.member.name === pick.leader) : true;
                    return (
                      <div key={pick.name} className={`border rounded-lg p-3 ${pick.included ? "border-blue-300 bg-blue-50/40" : "border-gray-200 bg-gray-50"}`}>
                        <label className="flex items-center gap-2 mb-2 cursor-pointer">
                          <input type="checkbox" checked={pick.included} onChange={() => toggleTeam(teamIndex)} className="rounded" />
                          <span className="text-sm font-semibold text-gray-800">{pick.name}</span>
                        </label>
                        {pick.leader && (
                          <p className="text-[10px] text-gray-400 mb-2">기존 부서장 {pick.leader}{!leaderInMembers ? " · 구성원 목록 밖(저장 시 부서장 해제)" : ""}</p>
                        )}
                        <div className="flex flex-col gap-1.5 pl-1">
                          {pick.memberPicks.map((memberPick, memberIndex) => (
                            <label key={memberPick.member.name} className={`flex items-center gap-2 text-xs cursor-pointer ${!pick.included ? "opacity-40" : ""}`}>
                              <input type="checkbox" disabled={!pick.included} checked={memberPick.included} onChange={() => toggleMember(teamIndex, memberIndex)} className="rounded" />
                              <span className="text-gray-700">{memberPick.member.name} · {memberPick.member.dept}</span>
                            </label>
                          ))}
                          {pick.memberPicks.length === 0 && <p className="text-[10px] text-gray-400">구성원 없음</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedTeamCount === 0 && <p className="text-xs text-red-500">참여할 팀을 최소 하나 선택하세요. 팀이 없는 조직은 “빈 조직”을 사용하세요.</p>}
              </div>
            )}

            {/* 빈 조직 */}
            {mode === "empty" && (
              <p className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center">빈 조직으로 시작합니다. 저장 후 운영 조직 수정에서 팀과 구성원을 추가하세요.</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded p-3">
            <p className="text-xs text-blue-600">행사 조직을 변경해도 기본 학생회 조직에는 영향을 주지 않습니다.</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8">
          <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-03C")}><ArrowLeft className="w-4 h-4" /> 이전</Btn>
          <Btn variant="primary" size="md" onClick={handleSave} disabled={!canSave}>저장</Btn>
        </div>
      </div>
    </div>
  );
}

const EVENT_TABS = ["개요", "업무", "문서", "관련 회의", "일정", "인원 관리", "재정"];
const EVENT_TAB_SCREENS: Record<string, string> = {
  "개요": "EVT-02",
  "업무": "EVT-TASK-01",
  "재정": "EVT-FIN-01",
  "관련 회의": "EVT-MEET-01",
  "일정": "EVT-SCHED-01",
  "인원 관리": "EVT-03A",
  "문서": "EVT-DOC-01",
};

function EventWorkspaceHeader() {
  const { eventInfo, eventLifecycle, currentUser, eventTasks, navigateTo, setEventLifecycle } = React.useContext(AppContext);
  const canManage = isEventManager(currentUser);
  // 행사 완료 처리는 행사 관리 권한과 별개로 기본 역할이 회장단인 경우에만 허용한다.
  const canComplete = canCompleteEvent(currentUser);
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
    ? (canComplete ? { label: "행사 완료 처리", onClick: () => navigateTo("EVT-02E") } : null)
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
  // 참여 설문이 없는 행사(예: 새로 만든 행사·기획 단계)에서는 모집·참가자 관련 예시 수치를 표시하지 않는다.
  // 다른 행사(체육대회)의 신청·납부·명단 수치가 새지 않도록 데이터 유무로 분기한다.
  const hasSurvey = surveySettings.status !== "미생성";

  return (
    <div className="p-6 flex flex-col gap-5">
      {hasSurvey ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3.5 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div><p className="text-sm text-blue-800">모집 마감까지 3일 남았습니다. 정원 {eventInfo.capacityCount || "?"}명 중 {surveySettings.responseCount}명이 신청했고, <strong>명단 확인이 필요한 신청자가 6명</strong> 있습니다.</p><p className="text-[11px] text-blue-600 mt-1">현재 상태: {style.label} · 다음 운영 단계는 모집 마감 확인입니다.</p></div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-5 py-3.5 flex items-start gap-3">
          <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <div><p className="text-sm text-gray-600">아직 참여 설문이 없습니다. 기본정보와 참여 설문을 설정하면 모집 현황과 확인 항목이 여기에 표시됩니다.</p><p className="text-[11px] text-gray-400 mt-1">현재 상태: {style.label}</p></div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "담당자 없는 업무", value: `${unassignedTasks.length}건`, desc: unassignedTasks.length > 0 ? unassignedTasks.map(task => task.name).join(" · ") : "모든 업무가 배정됨", screen: "EVT-TASK-01", filter: "unassignedTasks" as const, tone: "red" },
          { label: "확인 필요 참가자", value: hasSurvey ? "6명" : "0명", desc: hasSurvey ? "학번·이름 또는 납부 확인" : "설문 미생성", screen: "EVT-04", filter: "participantReview" as const, tone: "yellow" },
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
              { label: "신청자", value: `${surveySettings.responseCount}명`, sub: hasSurvey ? `정원 ${eventInfo.capacityCount || "?"}명` : "설문 미생성", color: "blue" },
              { label: "납부 확인", value: hasSurvey ? "129명" : "0명", sub: hasSurvey ? "미납 13명" : "집계 전", color: "green" },
              { label: "확인 필요", value: hasSurvey ? "6명" : "0명", sub: hasSurvey ? "명단 불일치" : "없음", color: "yellow" },
              { label: "담당자 없는 업무", value: `${unassignedTasks.length}개`, sub: unassignedTasks.length > 0 ? "처리 필요" : "없음", color: "red" },
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
            {hasSurvey ? (
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
            ) : (
              <p className="text-xs text-gray-400 py-4 text-center">참여 설문을 만들면 확인해야 할 항목이 여기에 표시됩니다.</p>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">최근 변경 사항</p>
            {hasSurvey ? (
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
            ) : (
              <p className="text-xs text-gray-400 py-4 text-center">기록된 변경 사항이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EVT02() {
  const { navigateTo, currentUser, eventLifecycle, eventInfo } = React.useContext(AppContext);
  const isFinanceMember = canManageFinance(currentUser);
  const canManage = isEventManager(currentUser);

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name]}
      title={eventInfo.name}
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
                    <p className="text-xs text-orange-700">이 행사의 재정 탭에서 구매 요청과 예산을 관리할 수 있습니다.</p>
                  </div>
                </div>
                <Btn variant="primary" className="bg-orange-600 hover:bg-orange-700 border-orange-600" onClick={() => navigateTo("EVT-FIN-01")}>재정으로 이동</Btn>
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
  const { navigateTo, setEventLifecycle, currentUser, eventInfo } = React.useContext(AppContext);
  // 행사 종료 권한: 회장단 또는 해당 행사의 운영 조직 관리자. 완료 처리(회장단 전용)와는 별개 기준이다.
  const canEnd = canEndEvent(currentUser);
  const endEvent = () => {
    // 우회 방지: 권한이 없으면 상태 변경도, EVT-02D 이동도 하지 않는다.
    if (!canEnd) return;
    setEventLifecycle("후속 정리 중");
    navigateTo("EVT-02D");
  };
  return (
    <div className="relative h-full">
      <DesktopShell
        activeSidebar="운영"
        breadcrumb={["운영", "행사", eventInfo.name]}
        title={eventInfo.name}
        actions={isEventManager(currentUser) ? <Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-02B")}><Settings className="w-3.5 h-3.5" /> 행사 설정</Btn> : undefined}
        tabs={EVENT_TABS}
        activeTab="개요"
      >
        <div className="opacity-30 pointer-events-none">
          <EVT02Content lifecycle="진행 중" />
        </div>
      </DesktopShell>
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[440px] p-8">
          {canEnd ? (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-2">행사를 종료할까요?</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                행사 운영은 종료되지만 미완료 업무와 문서를 계속 정리할 수 있습니다.{" "}
                행사 상태는 <span className="font-semibold text-orange-600">'후속 정리 중'</span>으로 변경됩니다.
              </p>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-02")}>취소</Btn>
                <Btn variant="primary" size="md" onClick={endEvent}>행사 종료</Btn>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-2">이 행사를 종료할 권한이 없습니다</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                행사 종료는 행사 운영 조직 관리자 또는 회장단만 할 수 있습니다.
              </p>
              <div className="flex justify-end gap-2">
                <Btn variant="primary" size="md" onClick={() => navigateTo("EVT-02")}>행사 개요로</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EVT-02D 행사 개요 대시보드 — 후속 정리 중 ───────────────────────────────

function EVT02D() {
  const { navigateTo, currentUser, eventInfo, eventTasks } = React.useContext(AppContext);
  // 후속 정리 열람·처리는 기존 권한 범위를 유지하고, 최종 완료 처리만 회장단으로 제한한다.
  const canComplete = canCompleteEvent(currentUser);
  // 후속 정리 수치는 선택 행사 데이터에서 계산한다. 다른 행사의 날짜·장소·참석자·잔여 항목을 복사하지 않는다.
  const openTasks = eventTasks.filter(task => task.status !== "완료");
  const eventDateTime = eventInfo.startAt
    ? `${eventInfo.startAt.slice(0, 10).replaceAll("-", ". ")}${eventInfo.startAt.slice(11, 16) ? ` ${eventInfo.startAt.slice(11, 16)}` : ""}`
    : "미정";
  const eventPlace = eventInfo.placeConfirmed && eventInfo.placeName ? eventInfo.placeName : "미정";
  // 문서·회의·참가자 정리 상태는 아직 행사별로 연결된 데이터가 없어 집계 전(0건)으로 둔다.
  const unresolvedDocCount = 0;
  const missingMeetingRecordCount = 0;
  const participantReviewCount = 0;
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name]}
      title={eventInfo.name}
      actions={isEventManager(currentUser) ? <Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-02B")}><Settings className="w-3.5 h-3.5" /> 행사 설정</Btn> : undefined}
      tabs={EVENT_TABS}
      activeTab="개요"
    >
      <div className="p-6 flex flex-col gap-5">
        {/* 상태 배지 + 완료 처리 버튼 */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${LIFECYCLE_STYLE["후속 정리 중"].badge}`}>
            후속 정리 중
          </span>
          {/* 완료 처리 버튼은 공통 헤더에만 두어 한 화면에 중복 노출되지 않게 한다.
              회장단이 아닌 사용자에게는 여기 안내만 남긴다. */}
          {!canComplete && <span className="text-xs text-gray-400">행사 완료 처리는 회장단만 할 수 있습니다.</span>}
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
                  { label: "미완료 업무", value: `${openTasks.length}건`, color: "text-red-600 bg-red-50 border-red-200", action: "업무 보기" },
                  { label: "정리되지 않은 문서", value: `${unresolvedDocCount}건`, color: "text-orange-600 bg-orange-50 border-orange-200", action: "문서 보기" },
                  { label: "미작성 회의·결정 기록", value: `${missingMeetingRecordCount}건`, color: "text-yellow-700 bg-yellow-50 border-yellow-200", action: "관련 회의 보기" },
                  { label: "확인 필요 참가자", value: `${participantReviewCount}명`, color: "text-green-700 bg-green-50 border-green-200", action: null },
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
                  ["행사명", eventInfo.name],
                  ["일시", eventDateTime],
                  ["장소", eventPlace],
                  ["참석자", "집계 전"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-[10px] text-gray-400 w-16 shrink-0 pt-px">{k}</span>
                    <span className="text-xs text-gray-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: 남은 항목 상세 */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">남은 항목 상세</p>
              {openTasks.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">미완료 업무가 없습니다.</p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-50">
                  {openTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 py-2.5">
                      <AlertCircle className={`w-3.5 h-3.5 ${task.delayed ? "text-red-400" : "text-gray-300"} shrink-0 mt-0.5`} />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-800">{task.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{task.dept} · {task.assignee === "미지정" ? "담당자 배정 필요" : task.assignee} · {task.due.slice(5).replace("-", ". ")}까지{task.delayed ? " · 지연" : ""}</p>
                      </div>
                      <button onClick={() => navigateTo("EVT-TASK-01")} className="text-[11px] text-blue-500 hover:text-blue-700 shrink-0">업무 보기 →</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">최근 변경 사항</p>
              <p className="text-xs text-gray-400 py-4 text-center">기록된 변경 사항이 없습니다.</p>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─── EVT-02E 행사 완료 처리 확인 모달 ────────────────────────────────────────

function EVT02E({ hasRemaining = true }: { hasRemaining?: boolean }) {
  const { navigateTo, setEventLifecycle, currentUser, eventInfo, eventTasks, setArchives, selectedEventId } = React.useContext(AppContext);
  // 회장단이 아니면 우회 호출로도 상태를 완료로 바꾸지 않는다. 미정리 항목도 임의로 바꾸지 않는다.
  const canComplete = canCompleteEvent(currentUser);
  // 잔여 항목은 선택 행사 데이터에서 계산한다. 문서·회의 정리 상태는 연결 데이터가 없어 0건으로 둔다.
  const remainingItems = [
    { icon: AlertCircle, color: "text-red-500", count: eventTasks.filter(task => task.status !== "완료").length, label: "미완료 업무" },
    { icon: FileText, color: "text-orange-500", count: 0, label: "정리되지 않은 문서" },
    { icon: Clock, color: "text-yellow-600", count: 0, label: "미작성 회의록" },
  ].filter(item => item.count > 0);
  const completeEvent = () => {
    if (!canComplete) return;
    // 완료 처리 시 완료 행사 기록을 생성한다. eventTasks는 건드리지 않으므로 미완료 업무는 그대로 보존된다.
    const doneCount = eventTasks.filter(task => task.status === "완료").length;
    const openCount = eventTasks.filter(task => task.status !== "완료").length;
    setArchives(prev => {
      // 중복 방지: 같은 행사 id의 기록이 이미 있으면 그대로 둔다(작성 중 아카이브 초기화 방지).
      // 행사명은 수정될 수 있으므로 변하지 않는 eventId(selectedEventId)로만 판정한다.
      if (prev.some(record => record.eventId === selectedEventId)) return prev;
      const now = new Date();
      const pad = (value: number) => String(value).padStart(2, "0");
      const completedAt = `${now.getFullYear()}. ${pad(now.getMonth() + 1)}. ${pad(now.getDate())}`;
      const eventDate = eventInfo.startAt ? eventInfo.startAt.slice(0, 10).replaceAll("-", ". ") : "미정";
      const record: ArchiveRecord = {
        id: `archive-${selectedEventId}`,
        eventId: selectedEventId,
        name: eventInfo.name,
        date: eventDate,
        manager: eventInfo.dept || "미정",
        owner: eventInfo.manager || "미정",
        completedAt,
        summary: `완료 업무 ${doneCount}건 · 미완료 ${openCount}건`,
        archiveStatus: "미발행",
        version: "",
        author: currentUser.name,
        performance: {
          // 참석·예산은 이 행사와 연결된 공유 상태가 없어 임의 수치를 저장하지 않는다.
          // 업무 수만 eventTasks에서 실제로 계산한다.
          attend: "참석 현황 집계 전",
          budget: "예산 집행 현황 집계 전",
          tasks: `완료 업무 ${doneCount}건 · 미완료 ${openCount}건`,
        },
        sourceScreen: "EVT-02E",
        draft: { operation: "", good: "", bad: "", improve: "", improveOwner: "", handover: "", nextOwner: "", reviewer: "", reviewNote: "", reviewState: "대기" },
        versions: [],
        snapshots: [],
      };
      return [record, ...prev];
    });
    setEventLifecycle("완료");
    navigateTo("REC-01");
  };
  const blockedNotice = <span className="self-center text-xs text-gray-400">행사 완료 처리는 회장단만 할 수 있습니다.</span>;
  return (
    <div className="relative h-full">
      <DesktopShell
        activeSidebar="운영"
        breadcrumb={["운영", "행사", eventInfo.name]}
        title={eventInfo.name}
        actions={isEventManager(currentUser) ? <Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-02B")}><Settings className="w-3.5 h-3.5" /> 행사 설정</Btn> : undefined}
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
                  {remainingItems.length === 0 ? (
                    <span className="text-xs text-gray-500">집계된 미정리 항목이 없습니다.</span>
                  ) : remainingItems.map(({ icon: Icon, color, count, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                      <span className="text-xs text-gray-700">{label} {count}건</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                완료 처리 후에도 행사 기록은 열람할 수 있습니다. 남은 항목을 확인한 뒤 완료하는 것을 권장합니다.
              </p>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-02D")}>계속 정리하기</Btn>
                {canComplete
                  ? <Btn variant="destructive" size="md" onClick={completeEvent}>그래도 완료 처리</Btn>
                  : blockedNotice}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-2">행사를 완료 처리할까요?</h3>
              <p className="text-sm text-gray-500 mb-6">완료된 행사는 <span className="font-medium text-gray-700">'기록 &gt; 완료된 행사'</span>로 이동합니다.</p>
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-02D")}>취소</Btn>
                {canComplete
                  ? <Btn variant="primary" size="md" onClick={completeEvent}>완료 처리</Btn>
                  : blockedNotice}
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
  const { navigateTo, createdMeetings, setSelectedCreatedMeetingId, currentUser, selectedEventId, setMeetingJoinAsNonParticipant } = React.useContext(AppContext);
  // 체육대회 샘플 회의는 SPORTS_EVENT_ID에만 연결한다. 다른 행사는 연결 회의가 없으면 빈 상태를 보여준다.
  const baseMeetings = selectedEventId === SPORTS_EVENT_ID ? [
    { title: "체육대회 운영 점검 회의", date: "2026. 07. 18 (토) 10:00", place: "제1회의실", status: "진행 중", attendees: "참가 8명", screen: "OPS-MEET-05A", variant: "blue" as const },
    { title: "안전 관리 최종 회의", date: "2026. 07. 25 (토) 15:00", place: "학생회실", status: "예정", attendees: "참가 예정 4명", screen: "OPS-MEET-03A", variant: "yellow" as const },
    { title: "참가자 모집 결과 검토", date: "2026. 07. 12 (일) 18:00", place: "온라인 (Discord)", status: "완료", attendees: "참석 6명", screen: "OPS-MEET-07", variant: "green" as const },
  ] : [];
  const createdEventMeetings = createdMeetings
    .filter((meeting) => meeting.eventId === selectedEventId)
    .map((meeting) => ({
      id: meeting.id,
      title: meeting.name,
      date: meeting.time,
      place: meeting.place,
      status: meeting.status,
      attendees: `초대 ${meeting.participants}명`,
      screen: getCreatedMeetingScreen(meeting, currentUser),
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
          {meetings.length === 0 && (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl px-6 py-12 text-center text-xs text-gray-400">아직 이 행사와 연결된 회의가 없습니다.</div>
          )}
          {meetings.map(meeting => (
            <button key={"id" in meeting ? meeting.id : meeting.title} onClick={() => { setMeetingJoinAsNonParticipant(false); if ("id" in meeting) { setSelectedCreatedMeetingId(meeting.id); navigateTo(getCreatedMeetingScreen(meeting, currentUser)); return; } navigateTo(meeting.screen); }} className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
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
  const { eventInfo, eventTasks, surveySettings, createdMeetings, setSelectedEventTaskId, setSelectedCreatedMeetingId, setCalendarFocus, navigateTo, currentUser, selectedEventId } = React.useContext(AppContext);
  const [filter, setFilter] = useState<"전체" | "이번 주" | "마감" | "회의" | "행사 당일">("전체");
  const eventPeriod = eventInfo.startAt
    ? `${eventInfo.startAt.slice(0, 10).replaceAll("-", ".")} ${eventInfo.startAt.slice(11, 16)}${eventInfo.noEndTime || !eventInfo.endAt ? "부터" : ` ~ ${eventInfo.endAt.slice(11, 16)}`}`
    : "일시 미정";
  // 일정은 선택 행사 데이터에서만 파생한다. 체육대회 샘플 고정 일정(설문 마감·안전 회의)은 SPORTS_EVENT_ID에만 붙인다.
  const isSports = selectedEventId === SPORTS_EVENT_ID;
  const sportsFixed = isSports ? [
    { dateValue: new Date("2026-07-20T00:00:00"), date: "07. 20", title: "참여 설문 마감", desc: "신청 현황 및 대기자 확인", kind: "마감", owner: "홍보팀", source: "참여 설문", screen: "EVT-05", tags: ["이번 주", "마감"] },
    { dateValue: new Date("2026-07-25T00:00:00"), date: "07. 25", title: "안전 관리 최종 회의", desc: "관련 회의에서 세부 안건 확인", kind: "회의", owner: "박해랑", source: "관련 회의", screen: "EVT-MEET-01", tags: ["이번 주", "회의"] },
  ] : [];
  // 설문 마감일이 입력된 행사는 설문 마감 일정을 파생한다(체육대회는 위 샘플로 대체).
  const surveyDeadlineSchedule = (!isSports && surveySettings.endAt) ? [
    { dateValue: new Date(surveySettings.endAt), date: surveySettings.endAt.slice(5, 10).replace("-", ". "), title: "참여 설문 마감", desc: "신청 현황 및 대기자 확인", kind: "마감", owner: eventInfo.dept || "미정", source: "참여 설문", screen: "EVT-05", tags: ["마감"] },
  ] : [];
  // 행사 당일 일정은 기본정보에 시작 일시가 있을 때만 표시한다.
  const eventDaySchedule = eventInfo.startAt ? [
    { dateValue: new Date(eventInfo.startAt), date: eventInfo.startAt.slice(5, 10).replace("-", ". "), title: eventInfo.name, desc: `${eventPeriod} · ${eventInfo.placeName || "장소 미정"}`, kind: "행사", owner: eventInfo.manager || "미정", source: "행사 기본정보", screen: "EVT-02B", tags: ["행사 당일"] },
  ] : [];
  const fixedSchedules = [...sportsFixed, ...surveyDeadlineSchedule, ...eventDaySchedule];
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
  const createdMeetingSchedules = createdMeetings.filter((meeting) => meeting.eventId === selectedEventId && meeting.status !== "취소").map((meeting) => {
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
  const coreSchedules = [...fixedSchedules, ...taskSchedules, ...createdMeetingSchedules].sort((a, b) => a.dateValue.getTime() - b.dateValue.getTime());
  // 선택 행사에 연결된 일정이 하나도 없으면 후속 정리 안내를 붙이지 않고 빈 상태를 보여준다.
  const schedules = coreSchedules.length > 0 ? [
    ...coreSchedules,
    { date: "행사 후", title: "결과 보고·정산 자료 정리", desc: "후속 정리 단계에서 진행", kind: "후속", owner: "미정", source: "행사 업무", screen: "EVT-TASK-01", tags: [] },
  ] : [];
  const visibleSchedules = filter === "전체" ? schedules : schedules.filter(schedule => schedule.tags.includes(filter));
  const openSchedule = (schedule: typeof schedules[number]) => {
    if ("taskId" in schedule && schedule.taskId) {
      setSelectedEventTaskId(schedule.taskId);
      navigateTo("EVT-TASK-02");
      return;
    }
    if ("createdMeetingId" in schedule && schedule.createdMeetingId) {
      setSelectedCreatedMeetingId(schedule.createdMeetingId);
      const meeting = createdMeetings.find(item => item.id === schedule.createdMeetingId);
      navigateTo(meeting ? getCreatedMeetingScreen(meeting, currentUser) : "OPS-MEET-01A");
      return;
    }
    if ("screen" in schedule && schedule.screen) navigateTo(schedule.screen);
  };
  // 전체 캘린더로 이동할 때 이 행사의 대표 시점(행사 당일 우선, 없으면 가장 이른 일정)을
  // calendarFocus로 넘겨 달력에서 선택 행사의 일정을 바로 식별하게 한다.
  const focusAnchor = eventDaySchedule[0] ?? coreSchedules[0] ?? null;
  const openFullCalendar = () => {
    setCalendarFocus(focusAnchor && !Number.isNaN(focusAnchor.dateValue.getTime())
      ? { month: focusAnchor.dateValue.getMonth(), day: focusAnchor.dateValue.getDate(), label: focusAnchor.title }
      : null);
    navigateTo("OPS-CAL-01");
  };
  return (
    <EventWorkspaceShell activeTab="일정">
      <div className="p-6 flex flex-col gap-5 max-w-5xl">
        <div className="flex items-center justify-between">
          <div><h2 className="text-sm font-semibold text-gray-900">행사 일정</h2><p className="text-xs text-gray-500 mt-1">업무·회의·행사 기본정보에서 연결된 주요 일정입니다.</p></div>
          <Btn variant="secondary" size="sm" onClick={openFullCalendar}>전체 캘린더 보기</Btn>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["전체", "이번 주", "마감", "회의", "행사 당일"] as const).map(item => (
            <button key={item} onClick={() => setFilter(item)} className={`px-3 py-1.5 rounded-full text-xs border ${filter === item ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>{item}</button>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {visibleSchedules.length === 0 && (
            <div className="px-5 py-12 text-center text-xs text-gray-400">{filter === "전체" ? "아직 이 행사에 연결된 일정이 없습니다. 기본정보·업무·회의를 추가하면 일정이 여기에 모입니다." : "조건에 맞는 일정이 없습니다."}</div>
          )}
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
  const { selectedEventId } = React.useContext(AppContext);
  const [statusFilter, setStatusFilter] = useState<"전체" | "작성 중" | "검토 중" | "확정" | "작성 전">("전체");
  // 체육대회 샘플 문서는 SPORTS_EVENT_ID에만 연결한다. 다른 행사는 연결 문서가 없으면 빈 상태를 보여준다.
  const docs = selectedEventId === SPORTS_EVENT_ID ? [
    { title: "행사 운영 계획서", category: "기획", status: "확정", updated: "07. 12 · 이수현", desc: "운영 목표, 역할 분담, 당일 진행 순서" },
    { title: "안전 관리 체크리스트", category: "운영", status: "검토 중", updated: "07. 18 · 박해랑", desc: "현장 안전 점검 및 비상 대응 항목" },
    { title: "참가자 명단 최종본", category: "참가자", status: "작성 중", updated: "07. 19 · 김바다", desc: "신청·납부·참석 확인 기준의 최종 명단" },
    { title: "행사 결과 보고서", category: "후속 정리", status: "작성 전", updated: "행사 종료 후", desc: "운영 결과와 정산 자료를 정리하는 문서" },
  ] : [];
  const statuses = ["전체", "작성 중", "검토 중", "확정", "작성 전"] as const;
  const countByStatus = (status: typeof statuses[number]) => status === "전체" ? docs.length : docs.filter(doc => doc.status === status).length;
  const visibleDocs = statusFilter === "전체" ? docs : docs.filter(doc => doc.status === statusFilter);
  const categoryColor: Record<string, string> = {
    "기획": "bg-blue-500",
    "운영": "bg-amber-500",
    "참가자": "bg-violet-500",
    "후속 정리": "bg-gray-400",
  };
  return (
    <EventWorkspaceShell activeTab="문서">
      <div className="p-6 flex flex-col gap-5 max-w-5xl">
        <div><h2 className="text-sm font-semibold text-gray-900">행사 문서</h2><p className="text-xs text-gray-500 mt-1">행사 전체 맥락에서 참고하는 문서와 결과물입니다.</p></div>
        {docs.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl px-6 py-12 text-center text-xs text-gray-400">아직 이 행사에 연결된 문서가 없습니다. 업무에서 결과물을 등록하면 여기에 모입니다.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "전체 문서", value: `${docs.length}개`, detail: "행사 공용 문서" },
                { label: "작성 중", value: `${countByStatus("작성 중")}개`, detail: "계속 확인이 필요해요" },
                { label: "검토 중", value: `${countByStatus("검토 중")}개`, detail: "의견 확인이 필요해요" },
              ].map(summary => (
                <div key={summary.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-gray-400">{summary.label}</p>
                  <div className="flex items-baseline gap-2 mt-1"><p className="text-base font-bold text-gray-900">{summary.value}</p><p className="text-[10px] text-gray-400">{summary.detail}</p></div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap" aria-label="문서 상태 필터">
              {statuses.map(status => (
                <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${statusFilter === status ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                  {status} <span className={`ml-1 ${statusFilter === status ? "text-gray-300" : "text-gray-400"}`}>{countByStatus(status)}</span>
                </button>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_84px_118px] gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400">
                <span>문서</span><span>상태</span><span>최근 갱신</span>
              </div>
              <div className="divide-y divide-gray-100">
                {visibleDocs.map(doc => (
                  <div key={doc.title} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_84px_118px] gap-3 sm:gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex items-start gap-3">
                      <span className={`w-1 self-stretch min-h-9 rounded-full ${categoryColor[doc.category]}`} aria-hidden="true" />
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] text-blue-600 font-medium">{doc.category}</span><p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p></div><p className="text-xs text-gray-500 mt-1 truncate">{doc.desc}</p></div>
                    </div>
                    <div><Chip label={doc.status} variant={doc.status === "확정" ? "green" : doc.status === "검토 중" ? "yellow" : doc.status === "작성 중" ? "blue" : "gray"} /></div>
                    <p className="text-[11px] text-gray-400 sm:text-right">{doc.updated}</p>
                  </div>
                ))}
                {visibleDocs.length === 0 && <p className="px-5 py-12 text-center text-xs text-gray-400">{statusFilter} 문서가 없습니다.</p>}
              </div>
            </div>
          </>
        )}
        <p className="text-[11px] text-gray-400">문서의 작성·검토 권한은 연결된 업무와 행사 운영 역할에 따라 관리합니다.</p>
      </div>
    </EventWorkspaceShell>
  );
}

// ─── OPS-MEET-01A/B 운영 — 전체 회의 ───────────────────────────────────────────

type MeetingListView = "participant" | "facilitator" | "creatorEligible" | "nonParticipant";

function MeetingListScreen({ view = "participant" }: { view?: MeetingListView }) {
  const { navigateTo, createdMeetings, setSelectedCreatedMeetingId, demoDataMode, currentUser, setMeetingJoinAsNonParticipant } = React.useContext(AppContext);
  const facilitatorView = view === "facilitator";
  const canCreateMeeting = view === "creatorEligible";
  const nonParticipantView = view === "nonParticipant";
  // 미참가자 화면은 박민수(기획부 부원) 관점이다. 비공개 노출 판정도 이 관점을 따른다.
  const perspectiveName = nonParticipantView ? "박민수" : currentUser.name;
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [sortOrder, setSortOrder] = useState("가까운 순");
  const [joinConfirmScreen, setJoinConfirmScreen] = useState<string | null>(null);
  const populatedMeetingGroups = [
    {
      name: "정기·상시 회의",
      count: 2,
      nearest: "07.22 (수) 18:00",
      meetings: [
        { name: "학생회 정기 운영회의", status: "예정", time: "2026.07.22 18:00", place: "학생회실 (A204)", owner: "이수현", participants: 12, agendas: 4, docStatus: "작성 전", relation: "참가자" },
        { name: "회장단 비공개 안건 조율", status: "예정", time: "2026.07.24 17:00", place: "회장실", owner: "김바다", participants: 4, agendas: 3, docStatus: "작성 전", relation: "참가자", visibility: "private", participantNames: ["김바다", "박해랑", "이수현", "김민준"] },
        { name: "7월 예산 검토회의", status: "완료", time: "2026.07.10 14:00", place: "온라인 (Zoom)", owner: "김민준", participants: 5, agendas: 2, docStatus: "정리 완료", relation: "참석" },
      ]
    },
    {
      name: "2026 소프트웨어융합대학 체육대회",
      count: 2,
      nearest: "07.18 (토) 10:00",
      meetings: [
        { name: "체육대회 운영 점검 회의", status: "진행 중", time: "2026.07.18 10:00", place: "제1회의실", owner: "박해랑", participants: 8, agendas: 6, docStatus: "작성 중", relation: facilitatorView ? "진행 권한" : "참석" },
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
  const rawMeetingGroups = demoDataMode === "first-use" ? [] : populatedMeetingGroups;
  // 미참가자(박민수) 화면에서는 샘플 회의의 관계를 미참가·불참으로 바꾼다. 상태에 맞춰 완료·정리 중은 불참, 나머지는 미참가.
  const baseMeetingGroups = nonParticipantView
    ? rawMeetingGroups.map((group) => ({ ...group, meetings: group.meetings.map((meeting) => ({ ...meeting, relation: meeting.status === "완료" || meeting.status === "정리 중" ? "불참" : "미참가" })) }))
    : rawMeetingGroups;
  const meetingGroups = baseMeetingGroups.map((group) => {
    const additions = createdMeetings.filter((meeting) => meeting.group === group.name);
    return additions.length === 0 ? group : { ...group, count: group.count + additions.length, meetings: [...group.meetings, ...additions] };
  });

  // 비공개 회의는 선정된 참가자와 생성자에게만 목록에 노출한다.
  const isMeetingVisibleToUser = (meeting: { visibility?: string; participantNames?: string[]; owner?: string }) => {
    if (meeting.visibility !== "private") return true;
    return (meeting.participantNames ?? []).includes(perspectiveName) || meeting.owner === perspectiveName;
  };
  const visibleMeetingGroups = meetingGroups.map((group) => {
    const meetings = group.meetings.filter((meeting) => isMeetingVisibleToUser(meeting) && (statusFilter === "전체" || meeting.status === statusFilter) && meeting.name.includes(keyword.trim())).sort((a, b) => sortOrder === "가까운 순" ? a.time.localeCompare(b.time) : b.time.localeCompare(a.time));
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
      : view === "nonParticipant"
        ? {
            title: "미참가자 화면 · 박민수 (기획부 부원)",
            description: "참가자로 초대되지 않은 회의도 목록에서 볼 수 있습니다. 진행 중 회의는 참가 확인을 거쳐 열람 참여할 수 있습니다.",
            count: demoDataMode === "first-use" ? "0건" : "미참가",
            box: "bg-amber-50 border-amber-100",
            iconBox: "bg-amber-100",
            iconColor: "text-amber-600",
            icon: Info,
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
                          {(m as { visibility?: string }).visibility === "private" && <Chip label="비공개" variant="gray" />}
                          {(m as { mode?: string }).mode === "혼합" && <Chip label="혼합" variant="green" />}
                          {(m as { mode?: string }).mode === "온라인" && <Chip label="온라인" variant="blue" />}
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
                                // 진행 중 회의에 미참가자가 참가하려는 경우 확인을 받는다.
                                if (m.status === "진행 중" && m.relation === "미참가") {
                                  setJoinConfirmScreen(action.screen);
                                  return;
                                }
                                // 미참가자(박민수) 화면에서 연 회의는 완료 회의록·요약 확인까지 미참가자로 이어진다.
                                setMeetingJoinAsNonParticipant(nonParticipantView);
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

      {joinConfirmScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setJoinConfirmScreen(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-[420px] p-6" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-sm font-bold text-gray-900">회의 참가 확인</h2>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">회의 참가자가 아닙니다. 그래도 참여하시겠습니까?</p>
            <div className="mt-5 flex justify-end gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setJoinConfirmScreen(null)}>취소</Btn>
              <Btn variant="primary" size="sm" onClick={() => { const target = joinConfirmScreen; setJoinConfirmScreen(null); setMeetingJoinAsNonParticipant(true); navigateTo(target); }}>그래도 참여</Btn>
            </div>
          </div>
        </div>
      )}
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

function OPSMEET01D() {
  return <MeetingListScreen view="nonParticipant" />;
}

// ─── OPS-MEET-02 회의 생성·수정 ────────────────────────────────────────────────

function OPSMEET02() {
  const { navigateTo, setCreatedMeetings, meetingDraft, setMeetingDraft, setDemoDataMode, eventRecords } = React.useContext(AppContext);
  // 연결 행사 후보는 활성 행사 레코드에서 가져온다. 회의는 행사명이 아니라 eventId로 연결한다.
  const activeEventOptions = eventRecords.filter(record => record.lifecycle !== "완료" && record.lifecycle !== "취소됨");
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
  const [isPrivate, setIsPrivate] = useState(meetingDraft?.isPrivate ?? false);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>(meetingDraft?.mode ?? "오프라인");
  const [onlineLink, setOnlineLink] = useState(meetingDraft?.onlineLink ?? "");
  const onlineEnabled = meetingMode === "온라인" || meetingMode === "혼합";
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
  // 진행 방식별 필수값: 오프라인·혼합은 장소, 온라인은 온라인 링크가 필요하다.
  const isMeetingFormValid = Boolean(
    meetingForm.name.trim() && meetingForm.date && meetingForm.time &&
    (meetingMode === "온라인" || meetingForm.place.trim()) &&
    (meetingMode !== "온라인" || onlineLink.trim())
  );
  const createMeeting = () => {
    const name = meetingForm.name.trim();
    const place = meetingForm.place.trim() || (meetingMode === "온라인" ? "온라인" : "");
    if (!isMeetingFormValid) return;
    const linkedEventId = meetingType === "event"
      ? activeEventOptions.find(record => record.info.name === meetingForm.event)?.id
      : undefined;
    setCreatedMeetings((previous) => [
      {
        id: `MEET-${Date.now()}`,
        eventId: linkedEventId,
        group: meetingType === "regular" ? "정기·상시 회의" : meetingForm.event,
        name,
        status: "예정",
        time: `${meetingForm.date.replaceAll("-", ".")} ${meetingForm.time}`,
        place,
        owner: meetingCreator.name,
        participants: participants.length,
        agendas: agendas.length,
        docStatus: "작성 전",
        visibility: isPrivate ? "private" : "public",
        mode: meetingMode,
        onlineLink: onlineEnabled ? onlineLink.trim() || undefined : undefined,
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
    setMeetingDraft({ meetingType, form: meetingForm, purpose, isPrivate, mode: meetingMode, onlineLink, savedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) });
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
                  selectOptions={activeEventOptions.map(record => record.info.name)}
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
              <Input label="진행 방식" select required value={meetingMode} selectOptions={["오프라인", "온라인", "혼합"]} onChange={(event) => setMeetingMode(event.target.value as MeetingMode)} />
            </div>
            {meetingMode === "혼합" && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-blue-700 leading-relaxed">혼합 회의는 현장 장소에서 진행하면서 온라인 링크로도 접속할 수 있습니다. 장소와 온라인 링크를 모두 입력하세요.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-6">
              <Input label={meetingMode === "온라인" ? "장소 (온라인)" : "장소"} required={meetingMode !== "온라인"} value={meetingForm.place} onChange={(event) => setMeetingForm((form) => ({ ...form, place: event.target.value }))} hint={meetingMode === "온라인" ? "온라인 회의는 장소 대신 온라인 링크를 사용합니다." : undefined} />
              <Input label="온라인 링크" required={meetingMode === "온라인"} placeholder="온라인 접속 링크를 입력" disabled={!onlineEnabled} value={onlineLink} onChange={(event) => setOnlineLink(event.target.value)} hint={onlineEnabled ? (meetingMode === "혼합" ? "현장 참석자와 함께 온라인 참가자에게 공유할 링크입니다." : "온라인 참가자에게 공유할 링크입니다.") : "오프라인 회의에서는 입력하지 않습니다."} />
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between">
              {sectionTitle(4, "참가자와 진행 권한", "참가자를 초대하고 회의를 시작·종료할 진행 권한자를 지정합니다.")}
              <span className="text-xs font-medium text-gray-500">선택됨 {participants.length}명</span>
            </div>

            <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${isPrivate ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
              <div>
                <p className="text-xs font-semibold text-gray-800">비공개 회의</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{isPrivate ? "선정한 참가자와 생성자에게만 회의 목록에 표시됩니다." : "모든 구성원의 전체 회의 목록에 표시됩니다."}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                onClick={() => setIsPrivate((previous) => !previous)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isPrivate ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-5" : "translate-x-0"}`} />
              </button>
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
              <Btn variant="primary" size="md" onClick={createMeeting} disabled={!isMeetingFormValid}><Check className="w-4 h-4" /> 회의 만들기</Btn>
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
        {permissionAccess === "manage" && (
          <Btn variant="secondary" size="sm" onClick={() => navigateTo("OPS-MEET-04B")}>
            <Settings className="w-3.5 h-3.5" /> 진행 권한 관리
          </Btn>
        )}
        {permissionAccess === "view" && (
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 whitespace-nowrap"><Eye className="w-3 h-3" /> 읽기 전용</span>
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
      {permissionAccess === "view" && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-500 leading-relaxed">진행 권한 현황은 읽기 전용입니다. 권한 부여·해제는 회의 생성자만 할 수 있습니다.</p>
        </div>
      )}
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
  const isCreatedMeetingOwner = createdMeeting?.owner === currentUser.name;
  const canFacilitateCreatedMeeting = Boolean(isCreatedMeetingOwner || createdMeeting?.facilitatorNames.includes(currentUser.name));
  const createdMeetingOwnerDept = createdMeeting?.owner === currentUser.name ? currentUser.dept : "운영부";
  const meetingName = createdMeeting?.name ?? "체육대회 안전 관리 최종 회의";
  const meetingGroup = createdMeeting?.group ?? "2026 소프트웨어융합대학 체육대회";
  const isRegularMeeting = createdMeeting?.group === "정기·상시 회의";
  const owner = role === "owner";
  const facilitator = role === "facilitator";
  const createdMeetingActor = currentUser;
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
            ? <>{isCreatedMeetingOwner && <Btn variant="secondary" size="sm" onClick={() => setManageOpen(!manageOpen)}><Settings className="w-3.5 h-3.5" /> 회의 관리</Btn>}{canFacilitateCreatedMeeting && <Btn variant="primary" size="sm" onClick={() => setStartConfirmOpen(true)}><ArrowRight className="w-3.5 h-3.5" /> 회의 시작</Btn>}</>
            : createdMeeting.status === "진행 중"
              ? <>{createdMeeting.participantNames.includes(currentUser.name) && !createdMeeting.attendance[currentUser.name]?.joinedAt && <Btn variant="secondary" size="sm" onClick={joinCreatedMeeting}><Check className="w-3.5 h-3.5" /> 회의 참가</Btn>}{canFacilitateCreatedMeeting && <Btn variant="destructive" size="sm" onClick={() => setEndConfirmOpen(true)}><X className="w-3.5 h-3.5" /> 회의 종료</Btn>}</>
              : createdMeeting.status === "취소"
                ? <Btn variant="secondary" size="sm" onClick={() => navigateTo("OPS-MEET-01C")}><ArrowLeft className="w-3.5 h-3.5" /> 회의 목록으로</Btn>
              : canFacilitateCreatedMeeting && <Btn variant="primary" size="sm" onClick={() => setCleanupOpen(true)}><FileText className="w-3.5 h-3.5" /> 회의록 정리</Btn>
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

          {createdMeeting && isCreatedMeetingOwner && manageOpen && createdMeeting.status === "예정" && (
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

          {createdMeeting?.status === "정리 중" && canFacilitateCreatedMeeting && (
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

// ─── OPS-MEET-04B 회의 진행 권한 관리(회의 생성자) ───────────────────────────
// 진행 권한자용 읽기 전용 현황(구 04A)은 OPS-MEET-03C의 참가자 카드에 인라인으로 통합되었다.

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

function OPSMEET04B() { return <MeetingPermissionScreen />; }

// ─── OPS-MEET-05A/B 진행 중 회의 ──────────────────────────────────────────────

function MeetingLiveScreen({ facilitator = false }: { facilitator?: boolean }) {
  const [selectedAgenda, setSelectedAgenda] = useState(1);
  const { navigateTo, meetingJoinAsNonParticipant } = React.useContext(AppContext);
  // 진행 권한자가 아니고 미참가자 자격으로 열람 참여한 경우를 구분한다.
  const isNonParticipant = !facilitator && meetingJoinAsNonParticipant;
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
        ) : isNonParticipant ? (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5" /> 미참가자 · 열람 참여 중
          </div>
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
            {isNonParticipant && <Chip label="미참가자" variant="orange" />}
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
            {isNonParticipant && <span className="text-[10px] font-semibold text-amber-600">· 미참가 열람 1명</span>}
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
                    <span className="text-[10px] text-gray-400">{person.joined ? `${person.joined} 참가` : "미참석"}</span>
                  </div>
                ))}
                {isNonParticipant && (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[11px] text-gray-700 flex-1">박민수</span>
                    <Chip label="미참가자" variant="orange" />
                  </div>
                )}
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
  const { recurringTasks, currentUser, setSelectedRecurringTaskId, navigateTo, meetingJoinAsNonParticipant } = React.useContext(AppContext);
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
  // 미참가자(박민수)가 열람 참여로 이 화면에 온 경우 불참자 프레이밍 대신 미참가자로 표시한다.
  const nonParticipant = meetingJoinAsNonParticipant;
  const viewerName = nonParticipant ? "박민수" : currentUser.name;
  const absentTitle = summaryConfirmedAt
    ? "회의 요약 확인을 완료했습니다"
    : nonParticipant ? "미참가자로 회의를 열람했습니다" : "회의 요약 확인이 필요합니다";
  const absentDesc = summaryConfirmedAt
    ? (nonParticipant
        ? `${viewerName} 님이 ${summaryConfirmedAt}에 회의 요약을 확인했습니다. 미참가자 열람 기록만 남으며 참석 기록으로 처리되지 않습니다.`
        : `${viewerName}이 ${summaryConfirmedAt}에 회의 요약을 확인했습니다. 확인 기록은 남지만 참석 기록은 불참으로 유지됩니다.`)
    : (nonParticipant
        ? "이 회의의 참가자가 아닙니다. 핵심 결정과 공개된 후속 업무를 열람할 수 있으며, 확인해도 참석 기록으로 처리되지 않습니다."
        : "회의에 참가하지 않았습니다. 핵심 결정과 나에게 배정된 후속 업무를 확인해 주세요. 확인해도 참석 기록으로 변경되지는 않습니다.");

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
                  <p className={`text-xs font-bold ${summaryConfirmedAt ? "text-green-900" : "text-orange-900"}`}>{absentTitle}</p>
                  <Chip label={nonParticipant ? "미참가자" : "불참"} variant={nonParticipant ? "orange" : "gray"} />
                  {summaryConfirmedAt && <Chip label="확인 완료" variant="green" />}
                </div>
                <p className={`text-[11px] mt-1 ${summaryConfirmedAt ? "text-green-800" : "text-orange-800"}`}>{absentDesc}</p>
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
                {nonParticipant && <div><p className="text-[10px] text-amber-600">미참가 열람</p><p className="text-sm font-bold text-amber-700 mt-1">1명</p></div>}
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
                  {meetingJoinAsNonParticipant && (
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <span className="text-[11px] text-gray-700 flex-1">박민수</span>
                      <Chip label="미참가자 · 열람" variant="orange" />
                    </div>
                  )}
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

// 증빙 아카이브 시드: 이미 정리 완료된 증빙 묶음 1건(체육대회). FIN-EVID-01에서 완료하면 여기에 레코드가 쌓인다.
const DEFAULT_EVIDENCE_BUNDLES: EvidenceBundle[] = [
  {
    id: "EVB-001",
    eventId: SPORTS_EVENT_ID,
    vendor: "오피스디포",
    method: "법인카드",
    receiptNo: "R-20260320-114",
    actualAmount: 68000,
    completedAt: "2026-03-20 15:30",
    completedBy: "김민준",
    executions: [
      { execId: "1-EX1", requestId: "REQ-001", itemName: "박스테이프", amount: 9000 },
      { execId: "4-EX1", requestId: "REQ-001", itemName: "유성 마커", amount: 14000 },
    ],
  },
];

const DEFAULT_ARCHIVES: ArchiveRecord[] = [
  {
    id: "archive-spring-booth",
    eventId: "EVT-SPRING",
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
    eventId: "archive-closing-2025",
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
    eventId: "archive-welcome-2025",
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
  const [handoverAi, setHandoverAi] = useState<"none" | "generating" | "drafted">("none");
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

  // 01 자동 채움 — 선택된 행사 기록에서만 가져오며 편집하지 않는다. 다른 행사 값을 섞지 않는다.
  // archiveDocumentFor와 같은 기록 원본(archive)에서 값을 만들며, 연결 데이터가 없으면 안내값을 쓴다.
  const perf = archive.performance;
  const autoSections = [
    { id: "overview", title: "개요", value: `${archive.name} · ${archive.date} · 담당 ${archive.manager} · 책임자 ${archive.owner} · ${perf.attend}` },
    { id: "performance", title: "성과", value: `${perf.attend} · ${perf.budget} · ${perf.tasks}` },
    { id: "timeline", title: "타임라인", value: `행사 ${archive.date} → 완료 처리 ${archive.completedAt} · ${archive.summary}` },
    { id: "source", title: "근거 자료", value: `${perf.tasks} · 회의·문서·구매 연결 데이터 없음` },
  ];

  // 04 인수인계 AI 초안 — 이 행사 기록만 재구성해 뼈대를 채운다. 기록에 없는 자산·연락처·담당자는 만들지 않고 확인 필요로 남긴다.
  const generateHandoverDraft = () => {
    setHandoverAi("generating");
    window.setTimeout(() => {
      setHandover([
        `[재사용 자산] ${perf.tasks} 관련 산출물 — 원본 문서에서 확인해 목록화하세요`,
        `[협력처·담당자] 연결 데이터 없음 — 실제 협력처와 연락처를 직접 입력하세요`,
        `[부서별 확인 항목] ${archive.manager} 인수인계 항목을 검토해 채우세요`,
        `[주의사항] 발행 전 원본 기록과 대조가 필요합니다`,
      ].join("\n"));
      setHandoverAi("drafted");
    }, 900);
  };

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
                {handoverAi === "generating" ? (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 flex items-center justify-center gap-2.5">
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                    <p className="text-xs font-medium text-blue-700">행사 기록을 바탕으로 인수인계 초안을 작성하는 중…</p>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-[10px] text-gray-500 leading-5 flex-1">
                      AI 초안은 이 행사의 업무·회의·문서·정산 기록만 재구성하며, 기록에 없는 자산·연락처·담당자를 새로 만들지 않습니다. 생성 후 반드시 검토·수정해 확정하세요.
                    </p>
                    <Btn variant="secondary" size="sm" onClick={generateHandoverDraft}><Sparkles className="w-3.5 h-3.5" /> {handover.trim() ? "AI 초안 다시 생성" : "AI 초안 생성"}</Btn>
                  </div>
                )}
                {handoverAi === "drafted" && (
                  <span className="flex items-center gap-1.5 text-[10px] text-yellow-700"><AlertCircle className="w-3 h-3" /> AI 초안입니다. 기록에 없는 내용이 없는지 검토하고 수정한 뒤 확정하세요.</span>
                )}
                <textarea
                  value={handover}
                  onChange={e => { setHandover(e.target.value); if (handoverAi === "drafted") setHandoverAi("none"); }}
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
  const { navigateTo, eventInfo } = React.useContext(AppContext);
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "인원 관리"]}
      title={eventInfo.name}
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          {/* Inner tabs */}
          <div className="flex gap-0 border-b border-gray-200 mb-6">
            {["운영 조직", "행사 참가자"].map(t => (
              <button key={t} type="button" onClick={() => t === "행사 참가자" && navigateTo("EVT-04")} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "운영 조직" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{t}</button>
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
  const { navigateTo, eventInfo } = React.useContext(AppContext);
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "인원 관리"]}
      title={eventInfo.name}
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          {/* Inner tabs */}
          <div className="flex gap-0 border-b border-gray-200 mb-6">
            {["운영 조직", "행사 참가자"].map(t => (
              <button key={t} type="button" onClick={() => t === "운영 조직" && navigateTo("EVT-03A")} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "행사 참가자" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{t}</button>
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
  const { navigateTo, currentUser, eventInfo, eventOrganization } = React.useContext(AppContext);
  // 운영 조직 수정: 행사 운영 조직 관리자 · 회장단
  const canManage = isEventManager(currentUser);
  // 선택된 행사에 저장된 운영 조직이 있는지로 판정한다(행사 id로 조회되는 값). 정적 배열을 직접 렌더링하지 않는다.
  const organization = eventOrganization;
  const hasOrganization = !!organization;
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "인원 관리"]}
      title={eventInfo.name}
      actions={canManage && hasOrganization ? <><Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-03B")}>수정</Btn></> : undefined}
      tabs={EVENT_TABS}
      activeTab="인원 관리"
    >
      <div className="flex h-full">
        <div className="flex-1 p-6 overflow-auto">
          {/* Inner tabs */}
          <div className="flex gap-0 border-b border-gray-200 mb-6">
            {["운영 조직", "행사 참가자"].map(t => (
              <button key={t} type="button" onClick={() => t === "행사 참가자" && navigateTo("EVT-04")} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "운영 조직" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{t}</button>
            ))}
          </div>

          {organization ? (
            <div className="flex flex-col items-center gap-0">
              <EventLeaderCard leader={organization.leader} dept={organization.leaderDept} grade={organization.leaderGrade} />
              {organization.teams.length > 0 && <OrgStem />}
              {organization.teams.length > 0 ? (
                <OrgBranch>
                  {organization.teams.map(team => (
                    <DeptCard key={team.name} name={team.name} leader={team.leader} members={team.members} />
                  ))}
                </OrgBranch>
              ) : (
                <p className="text-xs text-gray-400 mt-6">아직 등록된 팀이 없습니다. 운영 조직 수정에서 팀을 추가하세요.</p>
              )}
            </div>
          ) : (
            <div className="max-w-md mx-auto mt-16 text-center flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center"><Users className="w-6 h-6 text-blue-500" /></div>
              <div>
                <p className="text-sm font-bold text-gray-900">아직 운영 조직이 구성되지 않았습니다</p>
                <p className="text-xs text-gray-500 mt-2 leading-5">기본 학생회 조직을 불러오거나 참여 부서만 선택해 시작할 수 있습니다.<br />행사 운영 조직은 기본 조직과 별개의 데이터입니다.</p>
              </div>
              {canManage && <Btn variant="primary" size="md" onClick={() => navigateTo("EVT-01")}><Plus className="w-4 h-4" /> 운영 조직 구성하기</Btn>}
            </div>
          )}
        </div>
      </div>
    </DesktopShell>
  );
}

// EVT-03B 전용 편집 카드. 모든 버튼이 실제 draftTeams를 바꾼다(부서명 수정·삭제·부서장·구성원 추가/제거).
// 부서장 규칙: 로스터(members) 중 누구든 지정 가능하며 팀 구성원 여부와 독립적이다. 구성원 제거는 부서장 지정을 바꾸지 않는다.
function EditableDeptCard({
  team, allTeamNames, roster, onRename, onDelete, onSetLeader, onAddMember, onRemoveMember,
}: {
  team: EventOrgTeam;
  allTeamNames: string[];
  roster: EventOrgMember[];
  onRename: (next: string) => void;
  onDelete: () => void;
  onSetLeader: (name: string | undefined) => void;
  onAddMember: (name: string) => void;
  onRemoveMember: (name: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(team.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trimmed = draftName.trim();
  const duplicate = allTeamNames.some(name => name !== team.name && name === trimmed);
  const renameInvalid = !trimmed || duplicate;
  const commitRename = () => { if (renameInvalid) return; onRename(trimmed); setEditing(false); };
  const cancelRename = () => { setDraftName(team.name); setEditing(false); };
  const candidates = roster.filter(member => !team.members.some(teamMember => teamMember.name === member.name));

  return (
    <div className="border border-gray-200 rounded-lg bg-white w-56 shrink-0">
      <div className="border-b border-gray-100 px-3 py-2 flex items-center justify-between gap-2 relative">
        {editing ? (
          <input autoFocus value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") cancelRename(); }}
            onBlur={commitRename}
            className={`text-sm font-semibold text-gray-800 border-b bg-transparent outline-none w-28 ${renameInvalid ? "border-red-400" : "border-blue-400"}`}
          />
        ) : (
          <span className="text-sm font-semibold text-gray-800 truncate">{team.name}</span>
        )}
        <button className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100 shrink-0" onClick={() => { setMenuOpen(v => !v); setConfirmDelete(false); }} title="부서 메뉴">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-2 top-8 z-20 bg-white border border-gray-200 shadow-md rounded-lg py-1 w-36">
            {confirmDelete ? (
              <div className="px-3 py-2 flex flex-col gap-2">
                <p className="text-[11px] text-gray-600">이 부서를 삭제할까요?</p>
                <div className="flex gap-1.5">
                  <button className="flex-1 text-[11px] text-white bg-red-500 rounded px-2 py-1" onClick={() => { onDelete(); setMenuOpen(false); }}>삭제</button>
                  <button className="flex-1 text-[11px] text-gray-600 border border-gray-200 rounded px-2 py-1" onClick={() => setConfirmDelete(false)}>취소</button>
                </div>
              </div>
            ) : (
              <>
                <button className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50" onClick={() => { setDraftName(team.name); setEditing(true); setMenuOpen(false); }}>부서명 수정</button>
                <button className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>부서 삭제</button>
              </>
            )}
          </div>
        )}
      </div>
      {editing && renameInvalid && <p className="px-3 pt-1 text-[10px] text-red-500">{!trimmed ? "부서명을 입력하세요." : "이미 있는 부서명입니다."}</p>}
      <div className="p-3 flex flex-col gap-3">
        <div>
          <p className="text-[10px] text-gray-400 mb-1">부서장</p>
          <div className="relative">
            <select value={team.leader ?? ""} onChange={e => onSetLeader(e.target.value || undefined)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white appearance-none pr-6">
              <option value="">책임자 없음</option>
              {roster.map(member => <option key={member.name} value={member.name}>{member.name}</option>)}
            </select>
            <ChevronDown className="absolute right-1.5 top-1.5 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-1">부원 {team.members.length}명</p>
          <div className="flex flex-col gap-1.5">
            {team.members.map(member => (
              <div key={member.name} className="flex items-center justify-between gap-2 border border-gray-200 rounded px-2 py-1">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{member.name}{team.leader === member.name && <span className="ml-1 text-[9px] text-yellow-700">· 부서장</span>}</p>
                  <p className="text-[10px] text-gray-400 truncate">{member.dept} · {member.grade}</p>
                </div>
                <button className="text-gray-400 hover:text-red-500 shrink-0" title="구성원 제거" onClick={() => onRemoveMember(member.name)}><Minus className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {team.members.length === 0 && <p className="text-[10px] text-gray-400">구성원 없음</p>}
          </div>
        </div>
        <div className="relative">
          <select value="" disabled={candidates.length === 0} onChange={e => { if (e.target.value) onAddMember(e.target.value); }} className="w-full border border-dashed border-gray-300 rounded px-2 py-1 text-xs bg-white appearance-none pr-6 text-gray-600 disabled:text-gray-300">
            <option value="">{candidates.length === 0 ? "추가 가능한 구성원 없음" : "＋ 구성원 추가"}</option>
            {candidates.map(member => <option key={member.name} value={member.name}>{member.name} · {member.dept}</option>)}
          </select>
          <ChevronDown className="absolute right-1.5 top-1.5 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

function EVT03B() {
  const { navigateTo, eventInfo, eventOrganization, setEventOrganization } = React.useContext(AppContext);
  // 선택된 행사의 저장 조직을 깊은 복사해 편집 초안으로 쓴다. 저장 조직이 없으면 기본 조직 표본에서 시작한다.
  const base: EventOrganization = eventOrganization ?? { leader: "김바다", leaderDept: "컴퓨터학부", leaderGrade: "3학년", mode: "import", teams: BASE_ORG_TEAMS };
  const [leaderName, setLeaderName] = useState(base.leader);
  const [draftTeams, setDraftTeams] = useState<EventOrgTeam[]>(() => cloneOrgTeams(base.teams));
  const [newTeamName, setNewTeamName] = useState("");
  const [addError, setAddError] = useState("");
  const leaderInfo = members.find(member => member.name === leaderName) ?? { dept: base.leaderDept, grade: base.leaderGrade };

  const updateTeam = (index: number, updater: (team: EventOrgTeam) => EventOrgTeam) =>
    setDraftTeams(teams => teams.map((team, teamIndex) => teamIndex === index ? updater(team) : team));

  const addTeam = () => {
    const name = newTeamName.trim();
    if (!name) { setAddError("부서명을 입력하세요."); return; }
    if (draftTeams.some(team => team.name === name)) { setAddError("이미 있는 부서명입니다."); return; }
    setDraftTeams(teams => [...teams, { name, leader: undefined, members: [] }]);
    setNewTeamName("");
    setAddError("");
  };
  const renameTeam = (index: number, next: string) =>
    updateTeam(index, team => ({ ...team, name: next }));
  const deleteTeam = (index: number) =>
    setDraftTeams(teams => teams.filter((_, teamIndex) => teamIndex !== index));
  const setTeamLeader = (index: number, name: string | undefined) =>
    updateTeam(index, team => ({ ...team, leader: name }));
  const addMember = (index: number, name: string) =>
    updateTeam(index, team => {
      if (team.members.some(member => member.name === name)) return team; // 같은 팀 중복 방지
      const info = members.find(member => member.name === name);
      return info ? { ...team, members: [...team.members, { ...info }] } : team;
    });
  const removeMember = (index: number, name: string) =>
    updateTeam(index, team => ({ ...team, members: team.members.filter(member => member.name !== name) }));
    // 부서장 규칙(로스터 자유 지정, 구성원과 독립)에 따라 구성원 제거 시 부서장 지정은 그대로 둔다.

  const handleComplete = () => {
    // 편집 초안 전체(책임자·팀·팀 이름·팀 책임자·팀 구성원)를 선택 행사에만 저장한다.
    setEventOrganization({
      leader: leaderName,
      leaderDept: leaderInfo.dept,
      leaderGrade: leaderInfo.grade,
      mode: base.mode,
      teams: draftTeams,
    });
    navigateTo("EVT-03A");
  };
  // 취소: 초안을 버리고 저장하지 않은 채 보기 화면으로 이동한다.
  const handleCancel = () => navigateTo("EVT-03A");

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "인원 관리"]}
      title={eventInfo.name}
      actions={<><Btn variant="secondary" size="sm" onClick={handleCancel}>취소</Btn><Btn variant="primary" size="sm" onClick={handleComplete}>완료</Btn></>}
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

          {/* 행사 책임자 변경 */}
          <div className="flex flex-col gap-1 mb-5 max-w-xs">
            <label className="text-xs font-medium text-gray-700">행사 책임자<span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={leaderName} onChange={e => setLeaderName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white appearance-none pr-8">
                {members.map(member => <option key={member.name} value={member.name}>{member.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* 부서 추가 */}
          <div className="flex flex-col gap-1 mb-5 max-w-md">
            <label className="text-xs font-medium text-gray-700">부서 추가</label>
            <div className="flex items-center gap-2">
              <input value={newTeamName} onChange={e => { setNewTeamName(e.target.value); setAddError(""); }} onKeyDown={e => { if (e.key === "Enter") addTeam(); }} placeholder="새 부서명 입력" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <Btn variant="secondary" size="sm" onClick={addTeam}><Plus className="w-3.5 h-3.5" /> 부서 추가</Btn>
            </div>
            {addError && <p className="text-[10px] text-red-500">{addError}</p>}
          </div>

          <div className="flex flex-col items-center gap-0">
            <EventLeaderCard editMode leader={leaderName} dept={leaderInfo.dept} grade={leaderInfo.grade} />
            {draftTeams.length > 0 && <OrgStem />}
            {draftTeams.length > 0 ? (
              <OrgBranch>
                {draftTeams.map((team, index) => (
                  <EditableDeptCard
                    key={index}
                    team={team}
                    allTeamNames={draftTeams.map(t => t.name)}
                    roster={members}
                    onRename={next => renameTeam(index, next)}
                    onDelete={() => deleteTeam(index)}
                    onSetLeader={name => setTeamLeader(index, name)}
                    onAddMember={name => addMember(index, name)}
                    onRemoveMember={name => removeMember(index, name)}
                  />
                ))}
              </OrgBranch>
            ) : (
              <p className="text-xs text-gray-400 mt-6">등록된 팀이 없습니다. 위 “부서 추가”로 팀을 만들어 주세요.</p>
            )}
          </div>
        </div>

        {/* 기본 조직 구성원 참고 패널 (열람 전용) */}
        <aside className="w-64 border-l border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">기본 조직 구성원</p>
            <p className="text-xs text-gray-400">각 부서 카드의 “＋ 구성원 추가”로 배정</p>
          </div>
          <div className="flex-1 overflow-auto p-3 flex flex-wrap gap-2 content-start">
            {members.map(member => (
              <MemberCard key={member.name} name={member.name} dept={member.dept} grade={member.grade} />
            ))}
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
  const { currentUser, eventWorkspaceFilter, setEventWorkspaceFilter, eventInfo, selectedEventId, navigateTo } = React.useContext(AppContext);
  const canManage = isEventManager(currentUser);
  // 체육대회 샘플 참가자 명단은 SPORTS_EVENT_ID에만 표시한다. 다른 행사는 신청자 없음 빈 상태를 보여준다.
  const hasParticipants = selectedEventId === SPORTS_EVENT_ID;
  const visibleRows = !hasParticipants ? [] : eventWorkspaceFilter === "participantReview" ? participantRows.filter(row => row.warn) : participantRows;
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "인원 관리"]}
      title={eventInfo.name}
      actions={canManage && hasParticipants ? <>
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
            <button key={t} type="button" onClick={() => t === "운영 조직" && navigateTo("EVT-03A")} className={`px-4 py-2 text-sm border-b-2 -mb-px ${t === "행사 참가자" ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{t}</button>
          ))}
        </div>

        {!hasParticipants && (
          <div className="max-w-md mx-auto mt-16 text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center"><Clipboard className="w-6 h-6 text-blue-500" /></div>
            <div>
              <p className="text-sm font-bold text-gray-900">아직 참가 신청자가 없습니다</p>
              <p className="text-xs text-gray-500 mt-2 leading-5">참여 설문을 만들어 모집을 시작하세요.<br />외부 학생은 가입 없이 모바일 웹으로 신청합니다.</p>
            </div>
            {canManage && <Btn variant="primary" size="md" onClick={() => navigateTo("EVT-05")}><Plus className="w-4 h-4" /> 참여 설문 만들기</Btn>}
          </div>
        )}

        {hasParticipants && eventWorkspaceFilter === "participantReview" && (
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

        {hasParticipants && <>
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
          <span>총 {participantRows.length}명</span>
          <div className="flex gap-1">
            <button className="px-2 py-1 border border-gray-200 rounded text-gray-400">이전</button>
            <button className="px-2 py-1 border border-blue-500 rounded bg-blue-50 text-blue-700">1</button>
            <button className="px-2 py-1 border border-gray-200 rounded text-gray-600">다음</button>
          </div>
        </div>
        </>}
      </div>
    </DesktopShell>
  );
}

function EVT04B({ onClose }: { onClose?: () => void }) {
  const { eventInfo } = React.useContext(AppContext);
  // QR 활성 시간 기본값은 선택 행사의 시작·종료 일시에서 파생한다.
  const qrStart = eventInfo.startAt || "";
  const qrEnd = eventInfo.noEndTime ? "" : (eventInfo.endAt || "");
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
              <input type="datetime-local" className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-xs" defaultValue={qrStart} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 shrink-0">종료</span>
              <input type="datetime-local" className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-xs" defaultValue={qrEnd} />
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
      tabs={EVENT_TABS}
      activeTab="인원 관리"
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
  const { eventInfo, surveySettings } = React.useContext(AppContext);
  const responseCount = surveySettings.responseCount;
  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "참여 설문"]}
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
                ["현재 설문 응답자", `${responseCount}명`],
                ["영향받는 응답자", `${responseCount}명 (재응답 필요)`],
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
            <p className="text-[10px] text-gray-400">증빙 처리와 정산은 재정부가 각 행사 재정의 ‘증빙 필요’ 단계에서 진행합니다.</p>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

function EVTFIN01() {
  const { navigateTo, purchaseRequests, setPurchaseRequests, currentUser, eventInfo, selectedEventId, setSelectedPurchaseRequestId, evidenceBundles } = React.useContext(AppContext);
  const canReviewPurchase = canManageFinance(currentUser);
  const [quickCard, setQuickCard] = useState<string | null>(null); // 처리 단계 보드에서 빠른 처리 팝오버가 열린 카드(rowKey)
  const [itemsMineOnly, setItemsMineOnly] = useState(false); // 품목 현황: 내가 요청한 구매만 보기
  const [expandedStack, setExpandedStack] = useState<string | null>(null); // 같은 요청 카드 스택 중 펼쳐진 것(호버로 펼치고 바깥 클릭 시 접힘)
  React.useEffect(() => {
    if (!expandedStack) return;
    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest("[data-stack]");
      if (!el || el.getAttribute("data-stack") !== expandedStack) setExpandedStack(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedStack]);
  const canCreateRequest = canSubmitPurchaseRequest(currentUser);
  const [view, setView] = useState<"items" | "step" | "list" | "bundles" | "evidence">(() => canReviewPurchase ? "step" : "items");
  React.useEffect(() => setView(canReviewPurchase ? "step" : "items"), [canReviewPurchase]);
  const [financeAreaTab, setFinanceAreaTab] = useState(0); // 재정부 처리 단계의 업무 영역 하위 메뉴
  const [budgetLines, setBudgetLines] = useState(() => DEFAULT_BUDGET_LINES.map(line => ({ ...line })));
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustFrom, setAdjustFrom] = useState("홍보비");
  const [adjustTo, setAdjustTo] = useState("행사 운영비");
  const [adjustAmount, setAdjustAmount] = useState("100000");
  const [adjustReason, setAdjustReason] = useState("구매 요청 반영");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustments, setAdjustments] = useState<{ text: string; date: string }[]>([]);
  const requestStatusVariant = (status: string) => {
    if (status === "보완 요청") return "orange" as const;
    if (status === "재검토 대기") return "yellow" as const;
    if (["승인", "부분 승인", "승인 완료", "정산 완료"].includes(status)) return "green" as const;
    if (status === "반려" || status === "요청 취소") return "red" as const;
    return "blue" as const;
  };
  // 재정 데이터는 선택 행사 id로 필터링한다. 행사명 문자열로 연결하지 않는다.
  const eventPurchaseRequests = purchaseRequests.filter(request => request.eventId === selectedEventId);
  // 체육대회 샘플 예산은 SPORTS_EVENT_ID에만 표시하고, 연결 데이터가 없는 행사는 임의 금액 대신 안내를 보여준다.
  const hasBudget = selectedEventId === SPORTS_EVENT_ID;
  // 실행분이 모두 증빙 완료된 품목은 예약(집행 예정)에서 실제 지출로 전환한다.
  const itemFullySettled = (item: PurchaseItem) => {
    const execs = getExecutions(item);
    return execs.length > 0 && execs.every(ex => ex.evidenceStatus === "증빙 완료");
  };
  const reservedByLine = (lineName: string) => eventPurchaseRequests
    .filter(request => ["승인", "부분 승인", "구매 필요", "증빙 필요"].includes(request.status))
    .flatMap(request => request.items.filter(item => item.budgetLine === lineName && item.status === "승인" && !itemFullySettled(item)))
    .reduce((total, item) => total + item.estimatedTotalPrice, 0);
  const spentByLine = (lineName: string) => eventPurchaseRequests
    .flatMap(request => request.items.filter(item => item.budgetLine === lineName && item.status === "승인" && itemFullySettled(item)))
    .reduce((total, item) => total + item.estimatedTotalPrice, 0);
  const actualByLine = (lineName: string) => {
    const line = budgetLines.find(item => item.name === lineName);
    return (line ? line.actual : 0) + spentByLine(lineName);
  };
  const availableByLine = (lineName: string) => {
    const line = budgetLines.find(item => item.name === lineName);
    return line ? line.allocated - actualByLine(lineName) - reservedByLine(lineName) : 0;
  };
  const totalAllocated = budgetLines.reduce((total, line) => total + line.allocated, 0);
  const totalActual = budgetLines.reduce((total, line) => total + actualByLine(line.name), 0);
  const totalReserved = budgetLines.reduce((total, line) => total + reservedByLine(line.name), 0);
  const summary = hasBudget ? [
    { label: "배정 예산", value: totalAllocated.toLocaleString(), sub: "원" },
    { label: "승인·집행 예정액", value: totalReserved.toLocaleString(), sub: "원" },
    { label: "실제 지출액", value: totalActual.toLocaleString(), sub: "원" },
    { label: "사용 가능액", value: (totalAllocated - totalActual - totalReserved).toLocaleString(), sub: "원", color: "blue" },
  ] : [
    { label: "배정 예산", value: "연결 데이터 없음", sub: "" },
    { label: "승인·집행 예정액", value: "집계 전", sub: "" },
    { label: "실제 지출액", value: "집계 전", sub: "" },
    { label: "사용 가능액", value: "집계 전", sub: "", color: "blue" },
  ];

  // 재정부 처리 단계 — 업무 영역. 정산 완료·반려는 활성 처리에서 제외한다.
  // 배송·수령·이행은 구매 유형에 따라 물품 배송·수령 / 대여 이행 / 용역 이행 세 영역으로 나눈다(track으로 구매 유형 구분). 용역은 반납이 없다.
  const financeAreas: { area: string; stages: FinancePurchaseProgress[]; track?: "goods" | "rental" | "service" }[] = [
    { area: "요청 검토", stages: ["검토 대기", "보완 응답 대기", "재검토 대기"] },
    { area: "구매 준비", stages: ["선진행 동의 대기", "주문 대기", "재주문 보류", "구매 불가 처리 필요"] },
    { area: "물품 배송·수령", stages: ["배송 대기", "배송 중", "수령 확인 필요", "주문 취소 요청 확인"], track: "goods" },
    { area: "대여 이행", stages: ["이행 대기", "이행 중", "반납 확인 필요", "주문 취소 요청 확인"], track: "rental" },
    { area: "용역 이행", stages: ["이행 대기", "이행 중", "주문 취소 요청 확인"], track: "service" },
    { area: "환불", stages: ["환불 대기", "환불 확인", "재주문 판단"] },
    { area: "증빙", stages: ["증빙 필요", "증빙 정리 중"] },
  ];
  // 구매 유형 트랙 판정 — 물품(일반 구매·제작·인쇄) / 대여 / 용역. 영역 분리와, 주문 취소 요청 확인이 어느 영역에 속할지 결정에 쓴다.
  const rowTrack = (row: { item?: PurchaseItem }): "goods" | "rental" | "service" => {
    const pt = row.item?.purchaseType;
    if (pt === "대여") return "rental";
    if (pt === "용역") return "service";
    return "goods";
  };
  const areaMatches = (area: { stages: FinancePurchaseProgress[]; track?: "goods" | "rental" | "service" }, row: { financeProgress: FinancePurchaseProgress; item?: PurchaseItem }) =>
    area.stages.includes(row.financeProgress) && (!area.track || rowTrack(row) === area.track);
  // 실행분 기반 카드 행: 승인 전 품목은 품목 카드 1개, 승인 후에는 실행분마다 카드 1개(재주문 시 다수)
  const itemRows = eventPurchaseRequests.flatMap(request => request.items.flatMap(item => {
    const lastChanged = request.history[request.history.length - 1]?.date ?? "—";
    const execs = getExecutions(item);
    if (item.status !== "승인" || execs.length === 0) {
      return [{
        request, item,
        execution: undefined as PurchaseExecution | undefined,
        generalProgress: getGeneralPurchaseProgress(request, item, currentUser.name),
        financeProgress: getFinancePurchaseProgress(request, item),
        lastChanged,
        rowKey: `${request.id}-${item.id}`,
      }];
    }
    return execs.map(ex => ({
      request, item,
      execution: ex as PurchaseExecution | undefined,
      generalProgress: getGeneralProgressForExecution(ex),
      financeProgress: getFinanceStageForExecution(ex, execs),
      lastChanged,
      rowKey: `${request.id}-${item.id}-${ex.id}`,
    }));
  }));
  // 처리 단계 하위 메뉴: 현재 영역이 비면 항목이 있는 첫 영역으로 이동(방금 처리한 건이 안 보이는 문제 완화)
  React.useEffect(() => {
    setFinanceAreaTab(prev => {
      const cur = financeAreas[prev];
      if (cur && itemRows.some(row => areaMatches(cur, row))) return prev;
      const firstNonEmpty = financeAreas.findIndex(a => itemRows.some(row => areaMatches(a, row)));
      return firstNonEmpty >= 0 ? firstNonEmpty : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemRows.length]);
  const itemProgressColumns: { label: string; description: string; statuses: GeneralPurchaseProgress[] }[] = [
    { label: "확인 필요", description: "보완·반려·취소·구매 불가", statuses: ["보완 필요", "보완 중", "반려", "주문 취소", "요청 취소", "구매 불가"] },
    { label: "검토 중", description: "재정부 검토", statuses: ["검토 중"] },
    { label: "구매 준비", description: "승인 후 주문 준비", statuses: ["구매 준비"] },
    { label: "주문 완료", description: "주문·발주 완료", statuses: ["주문 완료"] },
    { label: "진행 중", description: "물품 배송·수령 또는 대여·용역 이행 진행", statuses: ["배송 중", "이행 중"] },
    { label: "수령·이행 완료", description: "실제 완료 확인", statuses: ["수령 완료", "이행 완료"] },
    { label: "정산 중", description: "증빙·실제 금액 확인", statuses: ["정산 중"] },
    { label: "처리 완료", description: "실제 지출 반영", statuses: ["처리 완료"] },
  ];
  // 기록(아카이브) 파생 데이터 ─────────────────────────────
  // 승인 묶음: 선진행 동의된 승인 품목을 요청 단위로 묶어 읽기용으로 보여준다(데이터는 저장하지 않고 파생).
  const approvalBundles = eventPurchaseRequests
    .map(req => ({ req, bundleItems: req.items.filter(it => it.status === "승인" && it.agreedForPurchase !== false) }))
    .filter(b => b.bundleItems.length > 0);
  // 증빙 묶음: 완료되어 저장된 레코드를 행사 기준으로 열람한다.
  const eventEvidenceBundles = evidenceBundles.filter(b => b.eventId === selectedEventId);
  const progressVariant = (status: GeneralPurchaseProgress | FinancePurchaseProgress) => {
    if (["처리 완료", "정산 완료", "수령 완료", "이행 완료"].includes(status)) return "green" as const;
    if (["보완 필요", "보완 중", "보완 응답 대기", "재검토 대기", "주문 취소 요청 확인"].includes(status)) return "orange" as const;
    if (["반려", "구매 불가", "구매 불가 처리 필요", "주문 취소", "요청 취소"].includes(status)) return "red" as const;
    if (["구매 준비", "주문 완료", "정산 중", "주문 대기", "배송 대기", "배송 중", "이행 대기", "이행 중", "반납 확인 필요", "수령 확인 필요", "증빙 필요", "증빙 정리 중"].includes(status)) return "blue" as const;
    return "gray" as const;
  };
  const openPurchaseRequest = (request: PurchaseRequest) => {
    setSelectedPurchaseRequestId(request.id);
    if (!canReviewPurchase) {
      navigateTo(request.status === "보완 요청" && request.requester === currentUser.name && canCreateRequest ? "FIN-SUP-01B" : "FIN-REQ-02");
      return;
    }
    navigateTo(
      request.status === "증빙 필요" ? "FIN-EVID-01"
        : ["승인", "부분 승인", "구매 필요"].includes(request.status) ? "FIN-PROC-01"
          // 보완 요청(보완 응답 대기)·재검토 대기는 보완 재검토 화면으로 연결한다(재정부가 보낸 보완 요청과 재제출 내용을 확인).
          : (request.status === "재검토 대기" || request.status === "보완 요청") ? "FIN-REV-01B"
            : "FIN-REV-01"
    );
  };
  // 같은 구매 요청(REQ) 단위로 카드를 묶는다. 반환: 요청별 카드 배열 목록(원래 순서 유지).
  const groupRowsByRequest = (rows: any[]): any[][] => {
    const order: string[] = [];
    const map: Record<string, any[]> = {};
    rows.forEach(row => {
      const id = row.request.id;
      if (!map[id]) { map[id] = []; order.push(id); }
      map[id].push(row);
    });
    return order.map(id => map[id]);
  };
  // 같은 요청 카드가 2개 이상이면 반쯤 겹친 스택으로, 호버하면 촤라락 펼쳐 개별 카드로 보여준다(바깥 클릭 시 접힘).
  const renderStack = (rows: any[], keyBase: string, renderCard: (row: any, opts?: any) => React.ReactNode): React.ReactNode => {
    if (rows.length <= 1) return <React.Fragment key={rows[0].rowKey}>{renderCard(rows[0], {})}</React.Fragment>;
    const stackId = `${keyBase}:${rows[0].request.id}`;
    const req = rows[0].request as PurchaseRequest;
    if (expandedStack === stackId) {
      // 같은 요청·같은 상태면 상태 칩과 상세보기를 헤더에 한 번만 두고, 개별 카드에선 뺀다.
      const allSame = rows.every(r => r.generalProgress === rows[0].generalProgress);
      return (
        <div key={stackId} data-stack={stackId} onMouseLeave={() => setExpandedStack(null)} className="flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-1.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-bold text-indigo-700 shrink-0">📦 {req.id}</span>
              <span className="text-[9px] text-indigo-500 shrink-0">{rows.length}건</span>
              {allSame && <Chip label={rows[0].generalProgress} variant={progressVariant(rows[0].generalProgress)} />}
            </div>
            <button type="button" onClick={() => openPurchaseRequest(req)} className="shrink-0 text-[10px] font-semibold text-blue-600 border border-blue-100 rounded px-2 py-0.5 hover:bg-blue-50">상세보기 ›</button>
          </div>
          {rows.map((row, i) => <div key={row.rowKey} className={`fan-in ${quickCard === row.rowKey ? "relative z-40" : ""}`} style={{ animationDelay: `${i * 45}ms` }}>{renderCard(row, { inStack: true, hideStatus: allSame })}</div>)}
        </div>
      );
    }
    // 접힘: 하단 카드는 실제 카드를 살짝 아래로 밀어 중첩·은닉하고(상세보기 숨김), 맨 위 카드만 온전히 보인다.
    const buried = rows.slice(1, 3);
    return (
      <div key={stackId} data-stack={stackId} onMouseEnter={() => setExpandedStack(stackId)} className="relative isolate cursor-pointer" style={{ paddingBottom: `${buried.length * 6}px` }}>
        {buried.map((row, i) => (
          <div key={row.rowKey} aria-hidden className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden rounded-lg" style={{ transform: `translateY(${(i + 1) * 6}px) scale(${1 - (i + 1) * 0.02})`, zIndex: buried.length - i, opacity: 0.92 }}>
            {renderCard(row, { buried: true })}
          </div>
        ))}
        <div className="relative z-10">{renderCard(rows[0], {})}</div>
        <span className="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-bold text-white bg-indigo-500 rounded-full px-1.5 py-0.5 shadow">📦 {rows.length}</span>
      </div>
    );
  };
  const submitAdjustment = () => {
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0 || adjustFrom === adjustTo || amount > availableByLine(adjustFrom) || !adjustNote.trim()) return;
    setBudgetLines(lines => lines.map(line => line.name === adjustFrom ? { ...line, allocated: line.allocated - amount } : line.name === adjustTo ? { ...line, allocated: line.allocated + amount } : line));
    setAdjustments(history => [{ date: "2026-07-29 16:00 · 김민준(재정부)", text: `${adjustFrom} ${amount.toLocaleString()}원 → ${adjustTo} · ${adjustReason}: ${adjustNote}` }, ...history]);
    setAdjustOpen(false);
    setAdjustNote("");
  };

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "재정"]}
      title="행사 재정 — 개요"
      tabs={EVENT_TABS}
      activeTab="재정"
      actions={
        <>
          <Btn variant="secondary" size="sm" onClick={() => navigateTo("MY-REQ-01")}><User className="w-3.5 h-3.5" /> 내 구매 요청</Btn>
          {canReviewPurchase && <Btn variant="secondary" size="sm" onClick={() => navigateTo("FIN-EVID-01")}><Clipboard className="w-3.5 h-3.5" /> 증빙 정리</Btn>}
          {canCreateRequest && <Btn variant="primary" size="sm" onClick={() => navigateTo("FIN-REQ-01B")}><Plus className="w-3.5 h-3.5" /> 새 구매 요청</Btn>}
        </>
      }
    >
      <div className="p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
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
          {canReviewPurchase && hasBudget && <Btn variant="secondary" size="sm" onClick={() => setAdjustOpen(true)}>예산 조정</Btn>}
        </div>

        {hasBudget && <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><p className="text-xs font-bold text-gray-700">예산 항목별 현황</p><p className="text-[10px] text-gray-400">배정 예산 − 실제 지출 − 승인 예약</p></div><div className="grid grid-cols-3 divide-x divide-gray-100">{budgetLines.map(line => <div key={line.name} className="p-4"><p className="text-[11px] font-semibold text-gray-700">{line.name}</p><p className="text-[10px] text-gray-400 mt-1">배정 {line.allocated.toLocaleString()}원 · 실지출 {actualByLine(line.name).toLocaleString()}원 · 예약 {reservedByLine(line.name).toLocaleString()}원</p><p className="text-sm font-bold text-blue-700 mt-2">사용 가능 {availableByLine(line.name).toLocaleString()}원</p></div>)}</div>{adjustments.length > 0 && <div className="border-t border-gray-100 p-4"><p className="text-[10px] font-bold text-gray-400 mb-2">최근 예산 조정 이력</p>{adjustments.map(item => <p key={item.text} className="text-[11px] text-gray-600">{item.date} · {item.text}</p>)}</div>}</div>}

        {(() => {
          const tabCls = (active: boolean) => `flex items-center gap-1.5 px-2.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`;
          const countBadge = (n: number, active: boolean) => <span className={`text-[10px] font-bold rounded-full px-1.5 ${active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>{n}</span>;
          // 일반 사용자: 품목 현황만. 요청 열람은 '내 구매 요청'(MY-REQ-01)에서 한다.
          // 기록 그룹(구매 요청·승인 묶음·증빙 묶음)과 처리 단계는 재정부 전용.
          if (!canReviewPurchase) {
            return (
              <div className="flex items-end border-b border-gray-200 shrink-0">
                <button onClick={() => setView("items")} className={tabCls(view === "items")}>품목 현황</button>
              </div>
            );
          }
          return (
            <div className="flex items-end justify-between border-b border-gray-200 shrink-0">
              <div className="flex items-end gap-5">
                {/* 작업 보드 그룹 — 진행 중 업무를 처리하는 칸반 */}
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider px-2.5 pb-0.5">작업 보드</span>
                  <div className="flex gap-1">
                    <button onClick={() => setView("items")} className={tabCls(view === "items")}>품목 현황</button>
                    <button onClick={() => setView("step")} className={tabCls(view === "step")}>처리 단계</button>
                  </div>
                </div>
                <div className="w-px self-stretch bg-gray-200 mb-2" />
                {/* 기록 그룹 — 요청·묶음 단위 아카이브 (재정부 전용) */}
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider px-2.5 pb-0.5">기록</span>
                  <div className="flex gap-1">
                    <button onClick={() => setView("list")} className={tabCls(view === "list")}>구매 요청 {countBadge(eventPurchaseRequests.length, view === "list")}</button>
                    <button onClick={() => setView("bundles")} className={tabCls(view === "bundles")}>승인 묶음 {countBadge(approvalBundles.length, view === "bundles")}</button>
                    <button onClick={() => setView("evidence")} className={tabCls(view === "evidence")}>증빙 묶음 {countBadge(eventEvidenceBundles.length, view === "evidence")}</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {view === "items" && (() => {
          const itemsRows = itemsMineOnly ? itemRows.filter(row => row.request.requester === currentUser.name) : itemRows;
          return (
          <div className="flex flex-col gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-bold text-blue-900">{canReviewPurchase ? "구성원에게 보이는 품목별 진행 상태" : "승인 이후의 구매 진행을 품목별로 확인합니다"}</p>
                  <p className="text-[11px] text-blue-700 mt-1 leading-5">{canReviewPurchase ? "재정부 내부 업무는 ‘처리 단계’에서, 실제 품목의 주문·배송·수령·정산 상태는 이곳에서 확인합니다." : "재정부의 내부 검토 업무가 아니라 내가 알아야 할 진행 결과를 간단한 상태로 표시합니다."}</p>
                </div>
                <span className="text-[10px] font-semibold text-blue-700 bg-white border border-blue-100 rounded-full px-2.5 py-1 shrink-0">품목 {itemsRows.length}건</span>
              </div>
              <p className="text-[10px] text-blue-600 mt-2">각 품목은 현재 진행 단계의 열에 표시되며, 카드를 누르면 연결된 구매 요청으로 이동합니다.</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="bg-gray-100 rounded-lg p-0.5 flex">
                {[["all", "전체 요청"], ["mine", "내 요청"]].map(([mode, label]) => (
                  <button key={mode} type="button" onClick={() => setItemsMineOnly(mode === "mine")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${(mode === "mine") === itemsMineOnly ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{label}</button>
                ))}
              </div>
              {itemsMineOnly && <span className="text-[10px] text-gray-400">{currentUser.name} 님이 요청한 품목만 표시</span>}
            </div>

            <div className="flex gap-4 items-start overflow-x-auto pb-4 custom-scrollbar">
              {itemProgressColumns.map(column => {
                const columnItems = itemsRows.filter(row => column.statuses.includes(row.generalProgress));
                return (
                  <div key={column.label} className="flex flex-col gap-3 min-w-[260px]">
                    <div className="px-1 flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-xs font-semibold ${column.label === "확인 필요" ? "text-red-700" : "text-gray-700"}`}>{column.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{column.description}</p>
                      </div>
                      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${column.label === "확인 필요" && columnItems.length > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>{columnItems.length}</span>
                    </div>
                    <div className={`flex flex-col gap-3 min-h-[410px] rounded-xl p-2 border border-dashed ${column.label === "확인 필요" ? "bg-red-50/40 border-red-200" : "bg-gray-100/50 border-gray-200"}`}>
                      {groupRowsByRequest(columnItems).map(group => renderStack(group, `items:${column.label}`, ({ request, item, execution, generalProgress, financeProgress, lastChanged, rowKey }: any, opts: any = {}) => (
                        <button type="button" key={rowKey} onClick={() => openPurchaseRequest(request)} className="w-full bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:border-blue-400 hover:shadow transition-all text-left">
                          {!opts.inStack && <div className="flex items-center justify-between gap-2 mb-2.5">
                            <Chip label={request.dept} variant="gray" />
                            <span className="text-[10px] text-gray-400">{item.expectedDate ?? request.neededDate}</span>
                          </div>}
                          <p className="text-xs font-bold text-gray-800 leading-tight">{item.name}{execution && execSeq(item, execution) && <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold align-middle">{execSeq(item, execution)}</span>}{execution?.reorderOfExecutionId && <span className="ml-1.5 text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1 py-0.5 align-middle">재주문</span>}</p>
                          {!opts.inStack && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1"><span className="text-indigo-500 font-semibold">📦 {request.id}</span> · {request.title}</p>}
                          <div className="grid grid-cols-2 gap-2 mt-3 py-2.5 border-y border-gray-50">
                            <div><p className="text-[9px] text-gray-400">수량</p><p className="text-[11px] font-semibold text-gray-700 mt-0.5">{execution ? execQuantityOf(item, execution) : item.quantity}{item.unit}{execution?.quantity != null && execution.quantity !== item.quantity && <span className="ml-1 text-[9px] text-blue-500">/{item.quantity}{item.unit}</span>}</p></div>
                            <div><p className="text-[9px] text-gray-400">예상 금액</p><p className="text-[11px] font-semibold text-gray-700 mt-0.5">{(execution ? execAmountOf(item, execution) : item.estimatedTotalPrice).toLocaleString()}원</p></div>
                          </div>
                          {!opts.hideStatus && <div className="mt-3 flex items-center justify-between gap-2">
                            <Chip label={generalProgress} variant={progressVariant(generalProgress)} />
                            <span className="text-[9px] text-gray-400">{lastChanged.slice(0, 10)}</span>
                          </div>}
                          {!opts.inStack && canReviewPurchase && <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between gap-2"><span className="text-[9px] text-gray-400">재정부 상태</span><Chip label={financeProgress} variant={progressVariant(financeProgress)} /></div>}
                          {!opts.inStack && canReviewPurchase && item.financeOwner && <p className="text-[9px] text-gray-400 mt-1 text-right">담당 {item.financeOwner}</p>}
                        </button>
                      )))}
                      {columnItems.length === 0 && <p className="text-[10px] text-gray-400 text-center py-12">품목 없음</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}

        {view === "step" && canReviewPurchase && (() => {
          const activeArea = financeAreas[financeAreaTab] ?? financeAreas[0];
          const areaRows = itemRows.filter(row => areaMatches(activeArea, row));
          // 처리 단계 칸반 열 1개 렌더
          // 빠른 처리 팝오버의 액션 버튼
          const qbtn = (label: string, run: () => void, tone: "green" | "red" | "gray" = "green") => (
            <button type="button" key={label} onClick={() => { setQuickCard(null); run(); }} className={`text-[11px] text-left px-2 py-1.5 rounded font-semibold border ${tone === "red" ? "border-red-200 text-red-600 hover:bg-red-50" : tone === "gray" ? "border-gray-200 text-gray-600 hover:bg-gray-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}>{label}</button>
          );
          const quickActions = (request: PurchaseRequest, item: PurchaseItem, execution: PurchaseExecution | undefined, fp: FinancePurchaseProgress): React.ReactNode[] => {
            // 선진행 동의 대기는 아직 실행분이 없으므로(동의 전) 실행분 가드보다 먼저 처리한다.
            if (fp === "선진행 동의 대기") return [qbtn("구매 진행 동의", () => execAgree(setPurchaseRequests, request.id, item.id))];
            if (!execution) return [];
            const isRental = item.purchaseType === "대여";
            const fulfillStages: FinancePurchaseProgress[] = ["배송 대기", "배송 중", "수령 확인 필요", "이행 대기", "이행 중", "반납 확인 필요"];
            if (fp === "주문 대기") return [qbtn("주문 완료", () => execOrder(setPurchaseRequests, request.id, item, execution.id)), qbtn("구매 불가", () => execMarkOutOfStock(setPurchaseRequests, request.id, item, execution.id), "gray")];
            if (fulfillStages.includes(fp)) return [qbtn(nextFulfillLabel(execution, isRental), () => execAdvanceFulfillment(setPurchaseRequests, request.id, item, execution.id))];
            if (fp === "주문 취소 요청 확인") return [qbtn("취소 요청 확정", () => execConfirmCancel(setPurchaseRequests, request.id, item, execution.id), "red")];
            if (fp === "환불 대기") return (["전액 환불", "일부 환불", "환불 없음"] as RefundResult[]).map(res => qbtn(`환불 확인 · ${res}`, () => execConfirmRefund(setPurchaseRequests, request.id, item, execution.id, res), "gray"));
            if (fp === "증빙 필요" || fp === "증빙 정리 중") return [qbtn("증빙 처리하기", () => { setSelectedPurchaseRequestId(request.id); navigateTo("FIN-EVID-01"); })];
            if (fp === "재주문 판단") return [qbtn("재주문", () => execReorder(setPurchaseRequests, request.id, item, execution.id)), qbtn("재주문 안 함", () => execDeclineReorder(setPurchaseRequests, request.id, item, execution.id), "gray")];
            return [];
          };
          const renderStepCard = ({ request, item, execution, generalProgress, financeProgress, rowKey }: any, opts: any = {}) => {
            const { buried = false, inStack = false, hideStatus = false } = opts;
            const open = quickCard === rowKey && !buried;
            const actions = quickActions(request, item, execution, financeProgress);
            // 스택 안(inStack)에서는 상세보기·담당을 헤더로 올리고, 같은 상태면(hideStatus) 상태 칩도 숨긴다.
            const showStatus = !hideStatus;
            const showDetail = !buried && !inStack;
            const showOwner = !inStack && Boolean(item.financeOwner);
            const showBottom = showStatus || showDetail || showOwner;
            return (
              <div key={rowKey} className={`relative ${open ? "z-30" : ""}`}>
                {/* 카드 본문 클릭 → 상태 변경 팝오버. 상세보기는 카드 안 별도 버튼. 열린 카드는 z-30으로 올려 다음 카드 뒤에 가려지지 않게 한다. */}
                <div onClick={() => setQuickCard(open ? null : rowKey)} className={`cursor-pointer bg-white border rounded-lg p-3 shadow-sm transition-all ${open ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200 hover:border-blue-400"}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Chip label={request.dept} variant="gray" />
                    <span className="text-[10px] text-gray-400">{request.neededDate}</span>
                  </div>
                  <p className="text-xs font-bold text-gray-800 leading-tight">{item.name}{execution && execSeq(item, execution) && <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold align-middle">{execSeq(item, execution)}</span>}{execution?.quantity != null && execution.quantity !== item.quantity && <span className="ml-1 text-[10px] font-semibold text-blue-600">{execution.quantity}{item.unit}</span>}{execution?.reorderOfExecutionId && <span className="ml-1.5 text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1 py-0.5 align-middle">재주문</span>}</p>
                  {!inStack && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1"><span className="text-indigo-500 font-semibold">📦 {request.id}</span> · {request.title}</p>}
                  {showBottom && (
                    <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between gap-2">
                      {showStatus ? <Chip label={generalProgress} variant={progressVariant(generalProgress)} /> : <span />}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {showOwner && <span className="text-[9px] text-gray-400">담당 {item.financeOwner}</span>}
                        {showDetail && <button type="button" onClick={e => { e.stopPropagation(); setQuickCard(null); openPurchaseRequest(request); }} className="text-[10px] font-semibold text-blue-600 border border-blue-100 rounded px-2 py-0.5 hover:bg-blue-50">상세보기 ›</button>}
                      </div>
                    </div>
                  )}
                </div>
                {open && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setQuickCard(null)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl p-2 flex flex-col gap-1.5">
                      <p className="text-[9px] font-bold text-gray-400 px-1 uppercase tracking-wider">상태 변경 · {financeProgress}</p>
                      {actions.length > 0 ? actions : <p className="px-1 py-0.5 text-[10px] text-gray-400">이 단계에서 바꿀 수 있는 상태가 없습니다. 상세보기에서 처리하세요.</p>}
                    </div>
                  </>
                )}
              </div>
            );
          };
          const renderColumn = (stage: FinancePurchaseProgress, minH: string, tone: "flow" | "exception" = "flow") => {
            const stageRows = areaRows.filter(row => row.financeProgress === stage);
            const isExc = tone === "exception";
            return (
              <div key={stage} className="flex flex-col gap-2 min-w-[240px]">
                <p className={`text-[11px] font-semibold px-1 flex items-center gap-1.5 ${isExc ? "text-amber-700" : "text-gray-600"}`}>{isExc && <span className="text-[8px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-1 py-0.5">예외</span>}{stage} <span className={isExc ? "text-amber-400" : "text-gray-400"}>{stageRows.length}</span></p>
                <div className={`flex flex-col gap-2 ${minH} rounded-xl p-2 border border-dashed ${isExc ? "bg-amber-50/40 border-amber-200" : "bg-gray-100/50 border-gray-200"}`}>
                  {groupRowsByRequest(stageRows).map(group => renderStack(group, `step:${stage}`, renderStepCard))}
                  {stageRows.length === 0 && <p className="text-[10px] text-gray-300 text-center py-6">없음</p>}
                </div>
              </div>
            );
          };
          return (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <div><p className="text-xs font-bold text-gray-700">재정부 처리 업무 · 7개 업무 영역</p><p className="text-[10px] text-gray-500 mt-0.5">업무 영역을 선택하면 그 영역의 처리 단계 칸반만 표시됩니다. 배송·수령·이행은 구매 유형에 따라 물품·대여·용역으로 나뉩니다. 정산 완료·반려는 활성 처리에서 제외됩니다.</p></div>
              <span className="text-[10px] text-gray-500">처리자가 버튼을 누르면 담당자·처리 시각이 기록됩니다.</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {financeAreas.map((area, i) => {
                const count = itemRows.filter(row => areaMatches(area, row)).length;
                return (
                  <button type="button" key={area.area} onClick={() => setFinanceAreaTab(i)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${i === financeAreaTab ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                    {area.area}
                    <span className={`text-[10px] font-bold rounded-full px-1.5 ${i === financeAreaTab ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            {areaRows.length === 0 ? (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-12 text-center text-[11px] text-gray-300">이 영역에 처리할 실행분이 없습니다.</div>
            ) : (() => {
              // 정상 진행 흐름 열과 예외·후속 열을 구분해 표시한다.
              const EXCEPTION_STAGES = ["보완 응답 대기", "재검토 대기", "재주문 보류", "구매 불가 처리 필요", "주문 취소 요청 확인", "재주문 판단"];
              const flowStages = activeArea.stages.filter(s => !EXCEPTION_STAGES.includes(s));
              const excStages = activeArea.stages.filter(s => EXCEPTION_STAGES.includes(s));
              return (
                <div className="flex gap-2 items-start overflow-x-auto pb-4 custom-scrollbar">
                  {flowStages.map((stage, i) => (
                    <React.Fragment key={stage}>
                      {i > 0 && <div className="flex items-center justify-center text-gray-300 text-lg font-bold w-5 shrink-0 pt-9">→</div>}
                      {renderColumn(stage, "min-h-[400px]", "flow")}
                    </React.Fragment>
                  ))}
                  {excStages.length > 0 && (
                    <>
                      <div className="flex flex-col items-center shrink-0 self-stretch px-1.5">
                        <span className="text-[9px] font-bold text-amber-600 whitespace-nowrap mt-9">예외·후속</span>
                        <div className="w-px flex-1 bg-amber-200 border-l border-dashed border-amber-300 mt-1" />
                      </div>
                      {excStages.map(stage => renderColumn(stage, "min-h-[400px]", "exception"))}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          );
        })()}

        {view === "list" && canReviewPurchase && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">▪ 요청 단위</span>
              <p className="text-[11px] text-gray-500">한 부서가 한 번에 올린 <b>구매 요청</b>을 시간순으로 봅니다. 취소된 품목도 요청 기록에 남습니다. 행을 누르면 품목별 상세로 이동합니다.</p>
            </div>
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
                  {eventPurchaseRequests.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">아직 이 행사에 연결된 구매 요청이 없습니다.</td></tr>
                  )}
                  {eventPurchaseRequests.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openPurchaseRequest(req)}>
                      <td className="px-4 py-3 text-gray-500 font-mono">2026-03-01</td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                         <div className="flex items-center gap-2">
                          {req.title}
                          {req.priority === "긴급" && <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 px-1 rounded">긴급</span>}
                         </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{req.dept}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 text-right">{req.totalEstimatedAmount.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-center"><Chip label={req.status} variant={requestStatusVariant(req.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "bundles" && canReviewPurchase && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">📦 묶음 단위</span>
              <p className="text-[11px] text-gray-500"><b>승인 묶음</b> = 한 요청에서 선진행 동의된 승인 품목의 묶음. 각 묶음(📦) 안에 개별 품목(▪)이 담겨 있습니다. 요청 취소·미동의 품목은 묶음에서 빠집니다.</p>
            </div>
            {approvalBundles.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-xs shadow-sm">아직 생성된 승인 묶음이 없습니다. 요청 검토·선진행 동의가 끝나면 이곳에 묶음이 쌓입니다.</div>
            )}
            {approvalBundles.map(({ req, bundleItems }) => {
              const total = bundleItems.reduce((s, it) => s + it.estimatedTotalPrice, 0);
              return (
                <div key={req.id} className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 bg-emerald-50/40 border-b border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">📦 승인 묶음</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{req.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5"><span className="font-mono">{req.id}</span> · {req.dept} · 개별 품목 {bundleItems.length}건 · 승인액 {total.toLocaleString()}원</p>
                      </div>
                    </div>
                    <button onClick={() => openPurchaseRequest(req)} className="shrink-0 text-[11px] border border-gray-200 text-gray-600 px-3 py-1.5 rounded font-semibold hover:bg-gray-50">요청 열기</button>
                  </div>
                  <div className="px-2 py-1">
                    <table className="w-full text-xs text-left [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                      <thead><tr className="text-gray-400 font-medium">
                        <th className="px-4 py-2">개별 품목</th>
                        <th className="px-4 py-2">수량</th>
                        <th className="px-4 py-2 text-right">승인액</th>
                        <th className="px-4 py-2">진행 상태</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {bundleItems.map(it => {
                          const prog = getGeneralPurchaseProgress(req, it, currentUser.name);
                          return (
                            <tr key={it.id}>
                              <td className="px-4 py-2.5 font-semibold text-gray-800"><span className="text-slate-300 mr-1">▪</span>{it.name}</td>
                              <td className="px-4 py-2.5 text-gray-500">{it.quantity}{it.unit}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-gray-600">{it.estimatedTotalPrice.toLocaleString()}원</td>
                              <td className="px-4 py-2.5"><Chip label={prog} variant={progressVariant(prog)} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "evidence" && canReviewPurchase && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">📦 묶음 단위</span>
              <p className="text-[11px] text-gray-500"><b>증빙 묶음</b> = 구매처·결제·영수증 기준으로 실행분을 다시 묶은 정리 단위. 서로 다른 요청·승인 묶음의 개별 실행분(▪)도 같은 거래면 한 묶음에 담깁니다.</p>
            </div>
            {eventEvidenceBundles.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-xs shadow-sm">아직 완료된 증빙 묶음이 없습니다. ‘결제·증빙 정리’에서 증빙 묶음을 완료하면 이곳에 쌓입니다.</div>
            )}
            {eventEvidenceBundles.map(b => (
              <div key={b.id} className="bg-white border border-gray-200 border-l-4 border-l-indigo-500 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-indigo-50/40 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full shrink-0">📦 증빙 묶음</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{b.vendor} · {b.method}{b.receiptNo ? ` · 영수증 ${b.receiptNo}` : ""}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5"><span className="font-mono">{b.id}</span> · 개별 실행분 {b.executions.length}건 · 정리 {b.completedAt} · {b.completedBy}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-400 font-semibold">실제 지출</p>
                    <p className="text-base font-bold text-gray-900">{b.actualAmount.toLocaleString()}원</p>
                  </div>
                </div>
                <div className="px-2 py-1">
                  <table className="w-full text-xs text-left [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                    <thead><tr className="text-gray-400 font-medium">
                      <th className="px-4 py-2">개별 실행분</th>
                      <th className="px-4 py-2">품목</th>
                      <th className="px-4 py-2">출처 요청</th>
                      <th className="px-4 py-2 text-right">승인액</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {b.executions.map(ex => (
                        <tr key={ex.execId}>
                          <td className="px-4 py-2.5"><span className="text-slate-300 mr-1">▪</span><span className="font-mono text-[10px] text-gray-500">{ex.execId}</span></td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{ex.itemName}</td>
                          <td className="px-4 py-2.5 font-mono text-[10px] text-gray-500">{ex.requestId}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-600">{ex.amount.toLocaleString()}원</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {adjustOpen && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6"><div className="w-[560px] bg-white rounded-2xl shadow-xl overflow-hidden"><div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"><div><h3 className="text-sm font-bold text-gray-900">행사 예산 조정</h3><p className="text-[11px] text-gray-500 mt-1">사용 가능 예산만 다른 항목으로 이동할 수 있습니다.</p></div><button onClick={() => setAdjustOpen(false)} className="text-gray-400"><X className="w-4 h-4" /></button></div><div className="p-6 grid grid-cols-2 gap-4"><Input label="출발 항목" select selectOptions={budgetLines.map(line => line.name)} value={adjustFrom} onChange={event => setAdjustFrom(event.target.value)} /><Input label="도착 항목" select selectOptions={budgetLines.map(line => line.name)} value={adjustTo} onChange={event => setAdjustTo(event.target.value)} /><Input label="조정 금액" type="number" value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)} hint={`출발 항목 사용 가능액 ${availableByLine(adjustFrom).toLocaleString()}원`} /><Input label="조정 사유" select selectOptions={["구매 요청 반영", "운영 계획 변경", "행사 규모 변경", "집행 차이", "기타"]} value={adjustReason} onChange={event => setAdjustReason(event.target.value)} /><div className="col-span-2"><Input label="구체적 설명" value={adjustNote} onChange={event => setAdjustNote(event.target.value)} required placeholder="조정 사유와 연결된 구매 요청을 기록하세요." /></div></div><div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2"><Btn variant="secondary" onClick={() => setAdjustOpen(false)}>취소</Btn><Btn variant="primary" disabled={!adjustNote.trim() || !Number(adjustAmount) || Number(adjustAmount) > availableByLine(adjustFrom) || adjustFrom === adjustTo} onClick={submitAdjustment}>조정 기록 남기기</Btn></div></div></div>}
      </div>
    </DesktopShell>
  );
}

function FINREQ01() {
  const { navigateTo, purchaseRequests, setPurchaseRequests, currentUser, purchaseRequestDraft, setPurchaseRequestDraft, setDemoDataMode, eventInfo, selectedEventId } = React.useContext(AppContext);
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

  const addItem = () => setItems([{ id: Date.now(), name: "", category: "운영 물품", budgetLine: "행사 운영비", purchaseType: "일반 구매", quantity: 1, unit: "개", estimatedUnitPrice: 0, estimatedTotalPrice: 0, details: {}, quoteStatus: "미요청" }, ...items]);
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
    // 유형과 상세 정보를 한 번에 갱신한다. updateItem을 두 번 부르면 두 번째 호출이 이전 items를 덮어쓴다.
    setItems(items.map(item => item.id === id ? { ...item, purchaseType: type, details: {} } : item));
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
      if (!item.priceEvidence?.trim()) newErrors[`item_${item.id}_evidence`] = item.purchaseType === "일반 구매" ? "상품 링크·판매처·가격 화면 중 하나를 입력해 주세요." : "업체 견적서를 등록해 주세요.";
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
        eventId: selectedEventId,
        title: title.trim(),
        event: eventInfo.name,
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

  if (!canSubmitPurchaseRequest(currentUser)) {
    return <DesktopShell activeSidebar="운영" title="구매 요청 작성" breadcrumb={["운영", "행사", eventInfo.name, "재정"]}><div className="h-full flex items-center justify-center p-8"><div className="max-w-md bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm"><p className="text-sm font-bold text-gray-800">구매 요청 작성 권한이 없습니다</p><p className="text-xs text-gray-500 mt-2 leading-5">구매 요청 작성과 보완 재제출은 부서장 또는 재정부만 할 수 있습니다.</p><Btn variant="secondary" className="mt-5" onClick={() => navigateTo("EVT-FIN-01")}>행사 재정으로 돌아가기</Btn></div></div></DesktopShell>;
  }

  return (
    <DesktopShell activeSidebar="운영" title="구매 요청 작성·수정" breadcrumb={["운영", "행사", eventInfo.name, "재정", "구매 요청 작성"]}>
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
                <Input label="요청 부서" value={currentUser.dept} disabled hint="작성자의 소속 부서로 고정됩니다." />
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
                        <Input label="구매 유형" select selectOptions={["일반 구매", "제작·인쇄", "대여", "용역"]} value={item.purchaseType} onChange={e => handleTypeChange(item.id, e.target.value)} required />
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

                      <div id={`item_${item.id}_evidence`} className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                        <Input
                          label={item.purchaseType === "일반 구매" ? "가격 근거" : "업체 견적서"}
                          value={item.priceEvidence ?? ""}
                          onChange={e => updateItem(item.id, "priceEvidence", e.target.value)}
                          placeholder={item.purchaseType === "일반 구매" ? "상품 링크, 판매처 정보 또는 가격 화면" : "견적서 파일명 또는 등록 정보"}
                          required
                          error={errors[`item_${item.id}_evidence`]}
                          hint={item.purchaseType === "일반 구매" ? "금액과 무관하게 가격 근거 1건이 필요합니다." : "제작·인쇄·대여·용역은 업체 견적서가 필요합니다."}
                        />
                        {errors[`item_${item.id}_evidence`] && <p className="text-[10px] text-red-500 mt-1">{errors[`item_${item.id}_evidence`]}</p>}
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
                            <div className="grid grid-cols-4 gap-4">
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-gray-700">디자인 파일</label>
                                <Btn variant="secondary" className="bg-white"><Upload className="w-3 h-3" /> 파일 업로드</Btn>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-gray-700">인쇄 파일</label>
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

                        {item.purchaseType === "대여" && (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                             <Input label="대여처" placeholder="예: 바다렌탈" />
                             <Input label="수령 장소" placeholder="예: 학교 정문 앞" />
                             <div className="grid grid-cols-2 gap-3">
                               <div className="flex flex-col gap-1">
                                 <label className="text-[11px] font-medium text-gray-700">대여 시작(수령) 일시</label>
                                 <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white" />
                               </div>
                               <div className="flex flex-col gap-1">
                                 <label className="text-[11px] font-medium text-gray-700">반납 예정 일시</label>
                                 <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white" />
                               </div>
                             </div>
                             <Input label="담당자 연락처" placeholder="예: 010-1234-5678" />
                             <Input label="보증금(있으면)" placeholder="예: 50,000원 · 반납 시 환입" />
                             <div className="col-span-2">
                               <Input label="대여 조건·요청사항" placeholder="파손·분실 배상 조건, 회수 방법 등 기재" />
                             </div>
                          </div>
                        )}

                        {item.purchaseType === "용역" && (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                             <Input label="용역 제공자" placeholder="예: 무대설치 전문업체" />
                             <Input label="수행 장소" placeholder="예: 학교 대운동장" />
                             <div className="grid grid-cols-2 gap-3">
                               <div className="flex flex-col gap-1">
                                 <label className="text-[11px] font-medium text-gray-700">수행 시작 일시</label>
                                 <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white" />
                               </div>
                               <div className="flex flex-col gap-1">
                                 <label className="text-[11px] font-medium text-gray-700">수행 종료 일시</label>
                                 <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white" />
                               </div>
                             </div>
                             <Input label="담당자 연락처" placeholder="예: 010-1234-5678" />
                             <div className="col-span-2">
                               <Input label="용역 포함 항목 및 요청사항" placeholder="설치·철거 포함 여부, 산출물 등 기재" />
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
                              <div className="grid grid-cols-3 gap-3 flex-[2]">
                                <Input label="견적 업체" placeholder="업체명" />
                                <Input label="견적 금액" type="number" placeholder="0" />
                                <div className="flex flex-col gap-1">
                                  <label className="text-[11px] font-medium text-gray-700">견적서 파일</label>
                                  <Btn variant="secondary" className="bg-white"><Upload className="w-3 h-3" /> 파일 업로드</Btn>
                                </div>
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
  const { navigateTo, purchaseRequests, setPurchaseRequests, eventInfo, selectedPurchaseRequestId } = React.useContext(AppContext);
  const sourceReq = purchaseRequests.find(r => r.id === selectedPurchaseRequestId) || purchaseRequests[0];
  const latestSupplementSubmission = sourceReq.supplementSubmissions?.[sourceReq.supplementSubmissions.length - 1];
  const isRecheck = sourceReq.status === "재검토 대기" || Boolean(latestSupplementSubmission);
  const reviewTabLabel = isRecheck ? "품목 재검토" : "품목 검토";
  const tabs = isRecheck
    ? ["보완 내용 비교", "품목 재검토", "요청 정보", "첨부파일", "처리 기록"]
    : ["요청 정보", "품목 검토", "첨부파일", "처리 기록"];

  const [currentTab, setCurrentTab] = useState(isRecheck ? "보완 내용 비교" : "품목 검토");
  const [showModal, setShowModal] = useState(false);

  type ItemReview = {
    status: "검토 대기" | "승인" | "보완 요청" | "반려";
    rejectionReason: string;
  };

  const [reviews, setReviews] = useState<Record<number, ItemReview>>(() => {
    const map: Record<number, ItemReview> = {};
    sourceReq.items.forEach(item => {
      map[item.id] = {
        status: item.status as ItemReview["status"],
        rejectionReason: item.rejectionReason ?? "",
      };
    });
    return map;
  });

  const [supplementReasons, setSupplementReasons] = useState<Record<number, string>>({});

  const setItemStatus = (id: number, status: ItemReview["status"]) =>
    setReviews(prev => ({ ...prev, [id]: { ...prev[id], status } }));

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
  const rejectedItems = sourceReq.items.filter(item => reviews[item.id]?.status === "반려");
  const totalAmount = sourceReq.items.reduce((sum, item) => sum + item.estimatedTotalPrice, 0);
  // 실제 배정 예산에서 이 행사의 다른 승인 요청 예약액과 기존 실지출을 뺀 사용 가능액으로 판정한다.
  const otherReserved = purchaseRequests
    .filter(r => r.eventId === sourceReq.eventId && r.id !== sourceReq.id && ["승인", "부분 승인", "구매 필요", "증빙 필요"].includes(r.status))
    .flatMap(r => r.items.filter(i => i.status === "승인"))
    .reduce((sum, i) => sum + i.estimatedTotalPrice, 0);
  const availableBudget = DEFAULT_BUDGET_LINES.reduce((sum, l) => sum + l.allocated - l.actual, 0) - otherReserved;
  const budgetExceeded = totalAmount > availableBudget;
  const allRejectionReasonsProvided = rejectedItems.every(item => reviews[item.id]?.rejectionReason.trim());

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
    const action =
      isRecheck && status === "승인" ? "재검토 승인 처리"
        : isRecheck && status === "보완 요청" ? "재검토 후 추가 보완 요청"
          : isRecheck && status === "반려" ? "재검토 후 반려 처리"
            : status === "보완 요청" ? "보완 요청 발송"
              : `${status} 처리`;
    setPurchaseRequests(prev => prev.map(r => {
      if (r.id !== sourceReq.id) return r;
      const reviewed = r.items.map(item => ({
        ...item,
        status: reviews[item.id]?.status ?? item.status,
        rejectionReason: reviews[item.id]?.status === "반려" ? reviews[item.id]?.rejectionReason.trim() : undefined,
        supplementReason: reviews[item.id]?.status === "보완 요청" ? supplementReasons[item.id]?.trim() : undefined,
      }));
      // 선진행 동의 대기는 승인 품목과 함께 아직 보완·검토 대기 품목이 남아 있을 때만 필요하다(기준 문서 7.1).
      // 전량 확정(보완·검토 대기 없음)이면 승인 품목은 바로 구매 진행(주문 대기)으로 넘긴다.
      const hasPending = reviewed.some(it => it.status === "보완 요청" || it.status === "검토 대기");
      const items = reviewed.map(item => ({
        ...item,
        agreedForPurchase: item.status !== "승인" ? item.agreedForPurchase
          : item.agreedForPurchase === true ? true
          : hasPending ? false
          : true,
      }));
      // 전량 확정(보완·검토 대기 없이 승인)이면 요청도 '구매 필요'(승인·진행 중)로 넘겨 시드 관례와 맞춘다.
      const finalReqStatus = (!hasPending && status === "승인" && items.some(it => it.status === "승인")) ? "구매 필요" : status;
      return { ...r, status: finalReqStatus, items, history: [...r.history, { date: "2026-07-29 15:20", action, user: "김민준" }] };
    }));
    navigateTo("EVT-FIN-01B");
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
    s === "보완 요청" ? "yellow" : s === "승인 완료" ? "green" : s === "반려" ? "red" : s === "부분 승인" || s === "재검토 대기" ? "blue" : "gray";

  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" },
      activeSidebar: "운영"
    }}>
      <DesktopShell title={isRecheck ? "구매 요청 재검토" : "구매 요청 검토"} breadcrumb={["운영", "행사", eventInfo.name, "재정", isRecheck ? "구매 요청 재검토" : "구매 요청 검토"]}>
        <div className="flex h-full bg-gray-50 overflow-hidden">
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-20">
              {/* Request Summary Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-mono tracking-wider">{sourceReq.id}</span>
                      <Chip label={isRecheck && overallStatus === "최종 처리 불가" ? "재검토 대기" : overallStatus} variant={chipVariant(isRecheck && overallStatus === "최종 처리 불가" ? "재검토 대기" : overallStatus)} />
                      {sourceReq.priority === "긴급" && <Chip label="긴급" variant="red" />}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{isRecheck ? "보완 재제출 내용 재검토" : "구매 요청 검토"}</h2>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right border-r border-gray-100 pr-8">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">전체 요청액</p>
                      <p className="text-xl font-bold text-gray-900">{totalAmount.toLocaleString()}원</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">예산 사용 가능액</p>
                      <p className="text-xl font-bold text-blue-600">{availableBudget.toLocaleString()}원</p>
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

              {isRecheck && latestSupplementSubmission && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-start gap-3">
                  <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-blue-900">보완 내용이 재제출되어 재검토가 필요합니다</p>
                    <p className="text-[11px] text-blue-700 mt-1">
                      {latestSupplementSubmission.requestedBy} 보완 요청 · {latestSupplementSubmission.requestedAt}
                      <span className="mx-2">→</span>
                      {latestSupplementSubmission.submittedBy} 재제출 · {latestSupplementSubmission.submittedAt}
                    </p>
                  </div>
                  <Chip label={`${latestSupplementSubmission.items.length}개 품목`} variant="blue" />
                </div>
              )}

              {budgetExceeded && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4"><p className="text-xs text-red-700">승인하려는 요청액이 해당 행사 예산의 사용 가능액을 초과합니다. 예산 조정 후 다시 처리해 주세요.</p><Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-FIN-01B")}>예산 조정으로 이동</Btn></div>}

              {/* Main Content Area */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                <div className="px-6 border-b border-gray-100 flex items-center gap-8 shrink-0">
                  {tabs.map((t) => (
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
                  {currentTab === "보완 내용 비교" && latestSupplementSubmission && (
                    <div className="p-6 flex flex-col gap-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">보완 전·후 변경 내용</h3>
                          <p className="text-[11px] text-gray-500 mt-1">보완 요청 당시 내용과 재제출된 내용을 비교한 뒤 품목 재검토에서 처리 결과를 선택합니다.</p>
                        </div>
                        <Btn variant="secondary" size="sm" onClick={() => setCurrentTab(reviewTabLabel)}>품목 재검토</Btn>
                      </div>
                      {latestSupplementSubmission.items.map(submissionItem => (
                        <div key={submissionItem.itemId} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold text-gray-900">{submissionItem.itemName}</p>
                              <p className="text-[10px] text-gray-500 mt-1">보완 사유 · {submissionItem.reason}</p>
                            </div>
                            <Chip label={`${submissionItem.fields.filter(field => field.before !== field.after).length}개 변경`} variant="blue" />
                          </div>
                          <div className="grid grid-cols-[140px_1fr_32px_1fr] bg-gray-50/50 border-b border-gray-100 text-[10px] font-bold text-gray-400">
                            <div className="px-4 py-2">항목</div>
                            <div className="px-4 py-2">보완 전</div>
                            <div />
                            <div className="px-4 py-2">보완 후</div>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {submissionItem.fields.map(field => {
                              const changed = field.before !== field.after;
                              return (
                                <div key={field.label} className="grid grid-cols-[140px_1fr_32px_1fr] items-center text-xs">
                                  <div className="px-4 py-3 font-semibold text-gray-600">{field.label}</div>
                                  <div className="px-4 py-3 text-gray-500">{field.before}</div>
                                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 mx-auto" />
                                  <div className={`px-4 py-3 font-semibold ${changed ? "bg-blue-50 text-blue-800" : "text-gray-600"}`}>{field.after}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentTab === reviewTabLabel && (
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                          <th className="px-6 py-3">품목 정보</th>
                          <th className="px-6 py-3">수량</th>
                          <th className="px-6 py-3 text-right">요청액</th>
                          <th className="px-6 py-3 text-right">검토 결과</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sourceReq.items.map(item => {
                          const review = reviews[item.id] ?? { status: "검토 대기" as const, rejectionReason: "" };
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
                                  {review.status === "보완 요청" && (
                                    <p className="max-w-[190px] text-[10px] text-yellow-700 text-right">최종 발송 전 품목별 보완 사유를 입력합니다.</p>
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
                    <div className="p-6 flex flex-col gap-5">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">구매 요청 상세</h3>
                        <p className="text-[11px] text-gray-500 mt-1">요청자가 제출한 기본 정보와 품목별 구매 조건입니다.</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          ["요청 제목", sourceReq.title],
                          ["요청 부서", sourceReq.dept],
                          ["요청자", sourceReq.requester],
                          ["필요한 날짜", sourceReq.neededDate],
                          ["우선순위", sourceReq.priority],
                          ["총 요청액", `${totalAmount.toLocaleString()}원`],
                        ].map(([label, value]) => (
                          <div key={label} className="border border-gray-100 bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-400">{label}</p>
                            <p className="text-xs font-semibold text-gray-800 mt-1">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="border border-gray-100 rounded-lg p-4">
                        <p className="text-[10px] text-gray-400">구매 목적</p>
                        <p className="text-xs text-gray-700 mt-1 leading-5">{sourceReq.purpose}</p>
                      </div>
                      <div className="flex flex-col gap-3">
                        {sourceReq.items.map(item => (
                          <div key={item.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-5">
                            <div>
                              <p className="text-xs font-bold text-gray-900">{item.name}</p>
                              <p className="text-[10px] text-gray-500 mt-1">{item.category} · {item.purchaseType} · {item.budgetLine}</p>
                              {Object.keys(item.details ?? {}).length > 0 && (
                                <p className="text-[10px] text-gray-500 mt-2">
                                  {Object.entries(item.details).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-gray-900">{item.estimatedTotalPrice.toLocaleString()}원</p>
                              <p className="text-[10px] text-gray-400 mt-1">{item.quantity}{item.unit} × {item.estimatedUnitPrice.toLocaleString()}원</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentTab === "첨부파일" && (
                    <div className="p-6 flex flex-col gap-5">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">가격 근거·첨부파일</h3>
                        <p className="text-[11px] text-gray-500 mt-1">{isRecheck ? "보완 전 파일과 재제출 파일을 함께 확인합니다." : "품목별 가격 근거를 확인합니다."}</p>
                      </div>
                      {(latestSupplementSubmission?.items ?? sourceReq.items.map(item => ({
                        itemId: item.id,
                        itemName: item.name,
                        beforeAttachments: [] as string[],
                        afterAttachments: item.priceEvidence ? [item.priceEvidence] : [],
                      }))).map(item => (
                        <div key={item.itemId} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <p className="text-xs font-bold text-gray-800">{item.itemName}</p>
                          </div>
                          <div className={`grid ${isRecheck ? "grid-cols-2" : "grid-cols-1"} divide-x divide-gray-100`}>
                            {isRecheck && (
                              <div className="p-4">
                                <p className="text-[10px] font-bold text-gray-400 mb-2">보완 전 첨부</p>
                                {item.beforeAttachments.length > 0 ? item.beforeAttachments.map(file => (
                                  <div key={file} className="flex items-center gap-2 text-xs text-gray-600"><FileText className="w-4 h-4 text-gray-400" />{file}</div>
                                )) : <p className="text-xs text-gray-400">첨부 없음</p>}
                              </div>
                            )}
                            <div className={`p-4 ${isRecheck ? "bg-blue-50/40" : ""}`}>
                              <p className={`text-[10px] font-bold mb-2 ${isRecheck ? "text-blue-600" : "text-gray-400"}`}>{isRecheck ? "보완 후 첨부" : "제출된 가격 근거"}</p>
                              {item.afterAttachments.length > 0 ? item.afterAttachments.map(file => (
                                <div key={file} className="flex items-center gap-2 text-xs font-medium text-gray-700"><FileText className="w-4 h-4 text-blue-500" />{file}</div>
                              )) : <p className="text-xs text-gray-400">첨부 없음</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
                <Btn variant="secondary" size="md" onClick={() => navigateTo("EVT-FIN-01B")}><ArrowLeft className="w-4 h-4" /> 행사 재정으로</Btn>
                <div className="flex items-center gap-4">
                  {unreviewedCount > 0 && (
                    <span className="text-xs text-orange-600 font-medium">미검토 품목이 {unreviewedCount}개 있습니다.</span>
                  )}
                  <Btn
                    variant="primary"
                    size="md"
                    disabled={unreviewedCount > 0 || !allRejectionReasonsProvided || budgetExceeded}
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
                <h3 className="text-sm font-bold text-yellow-800">{isRecheck ? "추가 보완 요청 발송" : "보완 요청 발송"}</h3>
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
                  {isRecheck ? "추가 보완 요청 발송" : "보완 요청 발송"}
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
  const { navigateTo, currentUser, eventTasks, recurringTasks, setSelectedEventTaskId, setSelectedRecurringTaskId, eventInfo } = React.useContext(AppContext);
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
    event: source === "event" ? eventInfo.name : "상시 업무",
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
  const { navigateTo, purchaseRequests, currentUser, eventInfo, selectedEventId, setSelectedPurchaseRequestId } = React.useContext(AppContext);
  // 내 구매 요청도 선택 행사 기준으로만 보여준다.
  const myRequests = purchaseRequests.filter(request => request.requester === currentUser.name && request.eventId === selectedEventId);
  const statCards = [
    { label: "검토 대기", count: myRequests.filter(r => r.status === "검토 대기").length, color: "text-blue-600 bg-blue-50" },
    { label: "보완 필요", count: myRequests.filter(r => r.status === "보완 요청").length, color: "text-yellow-700 bg-yellow-50" },
    { label: "승인 완료", count: myRequests.filter(r => r.status === "승인" || r.status === "부분 승인").length, color: "text-green-700 bg-green-50" },
    { label: "구매 진행", count: myRequests.filter(r => r.status === "구매 필요" || r.status === "증빙 필요").length, color: "text-purple-700 bg-purple-50" },
    { label: "처리 완료", count: myRequests.filter(r => r.status === "정산 완료").length, color: "text-gray-600 bg-gray-100" },
  ];
  const displayStatus = (status: PurchaseRequest["status"]) => status === "보완 요청" ? "보완 필요" : status === "승인" ? "승인 완료" : status === "구매 필요" ? "구매 진행" : status;
  const statusVariant = (status: PurchaseRequest["status"]) => status === "보완 요청" ? "yellow" as const : status === "승인" || status === "정산 완료" ? "green" as const : status === "반려" || status === "요청 취소" ? "red" as const : status === "구매 필요" || status === "증빙 필요" ? "blue" as const : "blue" as const;
  const btnLabel = (status: PurchaseRequest["status"]) => status === "보완 요청" ? "보완하기" : "상태 확인";
  const btnStyle = (status: PurchaseRequest["status"]) => status === "보완 요청"
    ? "bg-yellow-500 text-white px-3 py-1.5 rounded text-[10px] font-bold"
    : "border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-[10px] font-medium";
  const canCreateRequest = canSubmitPurchaseRequest(currentUser);

  return (
    <DesktopShell
      activeSidebar="운영"
      breadcrumb={["운영", "행사", eventInfo.name, "재정", "내 구매 요청"]}
      title={eventInfo.name}
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
          {canCreateRequest && <button onClick={() => navigateTo("FIN-REQ-01B")} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Plus className="w-4 h-4" /> 새 구매 요청
          </button>}
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
                    <button type="button" onClick={() => { setSelectedPurchaseRequestId(r.id); navigateTo(r.status === "보완 요청" && canCreateRequest ? "FIN-SUP-01B" : "FIN-REQ-02"); }} className={btnStyle(r.status)}>{r.status === "보완 요청" && !canCreateRequest ? "상태 확인" : btnLabel(r.status)}</button>
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
  const { eventInfo, purchaseRequests, setPurchaseRequests, selectedPurchaseRequestId, navigateTo, currentUser } = React.useContext(AppContext);
  const request = purchaseRequests.find(item => item.id === selectedPurchaseRequestId) || purchaseRequests[0];
  // 주문 취소 요청: 원래 요청자 본인이면서 재정부·부서장일 때만 (권한 매트릭스 canRequestOrderCancellation)
  const isRequester = request.requester === currentUser.name && canSubmitPurchaseRequest(currentUser);
  const cancelableExecs = request.items.flatMap(it => getExecutions(it).filter(ex => ex.orderStatus === "주문 완료" && ex.receiptStatus !== "수령 완료" && ex.serviceStatus !== "이행 완료" && !ex.cancelRequested).map(ex => ({ it, ex })));
  const cancelRows = request.items.flatMap(it => getExecutions(it).filter(ex => ex.orderStatus === "주문 완료" || ex.orderStatus === "주문 취소" || ex.cancelRequested).map(ex => ({ it, ex })));
  const [cancelTarget, setCancelTarget] = useState<{ itemId: number; execId: string; name: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const submitCancelRequest = () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.id !== cancelTarget.itemId ? it : {
        ...it,
        executions: getExecutions({ ...it, status: "승인" }).map(ex => ex.id === cancelTarget.execId ? { ...ex, cancelRequested: true, cancelReason: cancelReason.trim() } : ex),
      }),
      history: [...r.history, { date: "2026-08-01 11:10", action: `주문 취소 요청 · ${cancelReason.trim()}`, user: currentUser.name }],
    }));
    setCancelTarget(null);
    setCancelReason("");
  };
  // 품목 단위 요청 취소: 요청자가 주문 완료 전(검토 대기·보완 요청·미주문 승인) 개별 품목을 사유와 함께 취소.
  // 취소한 품목은 요청 아카이브(전체 요청)엔 취소 기록으로 남고, 승인 묶음 생성 시 status가 "승인"이 아니므로 자동 제외된다. (기준 문서 7.2)
  const canCancelItem = (item: PurchaseItem) => isRequester && ["검토 대기", "보완 요청", "승인"].includes(item.status) && getExecutions(item).every(ex => ex.orderStatus === "주문 대기");
  const [itemCancelTarget, setItemCancelTarget] = useState<{ itemId: number; name: string } | null>(null);
  const [itemCancelReason, setItemCancelReason] = useState("");
  const submitItemCancel = () => {
    if (!itemCancelTarget || !itemCancelReason.trim()) return;
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.id !== itemCancelTarget.itemId ? it : { ...it, status: "요청 취소", requestCancelReason: itemCancelReason.trim() }),
      history: [...r.history, { date: "2026-08-01 11:40", action: `요청 취소 · ${itemCancelTarget.name} · ${itemCancelReason.trim()}`, user: currentUser.name }],
    }));
    setItemCancelTarget(null);
    setItemCancelReason("");
  };
  const steps = ["요청 제출", "재정부 검토", "구매·발주", "결제·증빙", "처리 완료"];
  const currentStep = request.status === "정산 완료" ? 4 : request.status === "증빙 필요" ? 3 : request.status === "승인" || request.status === "부분 승인" ? 2 : 1;
  const history = request.history;
  const canResubmit = request.status === "보완 요청" && request.requester === currentUser.name && canSubmitPurchaseRequest(currentUser);

  return (
    <DesktopShell activeSidebar="운영" title="구매 요청 상세·진행 상태" breadcrumb={["운영", "행사", eventInfo.name, "재정", "내 구매 요청", request.id]}>
      <div className="p-8 flex flex-col gap-6 max-w-6xl mx-auto pb-20">
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
                <span className="text-[10px] text-gray-400 font-mono">{request.id}</span>
                <Chip label={request.status} variant={request.status === "반려" || request.status === "요청 취소" ? "red" : request.status === "보완 요청" ? "yellow" : request.status === "재검토 대기" ? "blue" : "green"} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{request.title}</h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-semibold mb-0.5">전체 요청액</p>
              <p className="text-xl font-bold text-gray-900">{request.totalEstimatedAmount.toLocaleString()}원</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-x-8 gap-y-4 border-t border-gray-100 pt-5 text-xs">
            {[["행사명", request.event], ["요청 부서", request.dept], ["요청자", request.requester], ["필요한 날짜", request.neededDate]].map(([k, v]) => (
              <div key={k}><p className="text-[10px] text-gray-400 font-semibold mb-0.5">{k}</p><p className="text-gray-700">{v}</p></div>
            ))}
          </div>
        </div>

        {/* 품목별 처리 결과 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">품목별 처리 결과</h3>
            {canResubmit && <button onClick={() => navigateTo("FIN-SUP-01B")} className="text-[11px] bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded font-semibold">보완 내용 확인</button>}
          </div>
          <table className="w-full text-xs text-left [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead><tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
              <th className="px-6 py-3">품목</th>
              <th className="px-6 py-3">수량</th>
              <th className="px-6 py-3 text-right">요청액</th>
              <th className="px-6 py-3">처리 결과</th>
              <th className="px-6 py-3 whitespace-normal">재정부 전달사항</th>
              {isRequester && <th className="px-6 py-3 text-right">요청 취소</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {request.items.map(item => {
                const label = item.status === "보완 요청" ? "보완 필요" : item.status;
                const variant = item.status === "승인" ? "green" as const : item.status === "반려" || item.status === "요청 취소" ? "red" as const : item.status === "보완 요청" ? "yellow" as const : "blue" as const;
                const message = item.requestCancelReason ?? item.supplementReason ?? item.rejectionReason ?? "—";
                return (
                  <tr key={item.id} className={`hover:bg-gray-50/30 ${item.status === "요청 취소" ? "opacity-60" : ""}`}>
                    <td className="px-6 py-3 font-semibold text-gray-800">{item.name}</td>
                    <td className="px-6 py-3 text-gray-500">{item.quantity}{item.unit}</td>
                    <td className="px-6 py-3 text-right font-mono text-gray-600">{item.estimatedTotalPrice.toLocaleString()}원</td>
                    <td className="px-6 py-3"><Chip label={label} variant={variant} /></td>
                    <td className="px-6 py-3 text-gray-500 whitespace-normal">{message}</td>
                    {isRequester && (
                      <td className="px-6 py-3 text-right">
                        {canCancelItem(item)
                          ? <button onClick={() => setItemCancelTarget({ itemId: item.id, name: item.name })} className="text-[11px] border border-red-200 text-red-600 px-3 py-1.5 rounded font-semibold hover:bg-red-50">요청 취소</button>
                          : item.status === "요청 취소"
                            ? <span className="text-[10px] text-red-500 font-semibold">취소됨</span>
                            : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isRequester && (
            <p className="px-6 py-3 text-[11px] text-gray-400 border-t border-gray-50">주문 완료 전 품목만 요청 취소할 수 있습니다. 취소한 품목은 요청 기록에 남고 승인 묶음에서는 자동 제외됩니다.</p>
          )}
        </div>

        {/* 주문 취소 요청 (요청자) */}
        {isRequester && cancelRows.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">주문 취소 요청</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">주문 완료된 개별 실행분의 취소를 사유와 함께 요청하면 재정부가 확인해 주문 취소·환불을 처리합니다.</p>
            </div>
            <div className="divide-y divide-gray-50">
              {cancelRows.map(({ it, ex }) => (
                <div key={ex.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-gray-400">{ex.id}</span>
                    <span className="text-xs font-semibold text-gray-800">{it.name}</span>
                    {ex.orderStatus === "주문 취소" && <span className="text-[10px] text-red-600 font-semibold bg-red-50 border border-red-100 rounded px-1.5 py-0.5">취소됨</span>}
                    {ex.cancelRequested && <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">취소 요청됨 · 재정부 확인 대기</span>}
                    {ex.cancelReason && <span className="text-[10px] text-gray-400">사유: {ex.cancelReason}</span>}
                  </div>
                  {ex.orderStatus === "주문 완료" && ex.receiptStatus !== "수령 완료" && ex.serviceStatus !== "이행 완료" && !ex.cancelRequested && (
                    <button onClick={() => setCancelTarget({ itemId: it.id, execId: ex.id, name: it.name })} className="text-[11px] border border-red-200 text-red-600 px-3 py-1.5 rounded font-semibold hover:bg-red-50 whitespace-nowrap">주문 취소 요청</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6">
          <div className="w-[460px] bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">주문 취소 요청 · {cancelTarget.name}</h3>
              <button onClick={() => { setCancelTarget(null); setCancelReason(""); }} className="text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <p className="text-[11px] text-gray-500">취소 사유를 입력하면 재정부가 확인해 주문 취소·환불을 처리합니다.</p>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="예: 행사 계획 변경으로 해당 물품이 더 이상 필요하지 않음" className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 resize-none" />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setCancelTarget(null); setCancelReason(""); }} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium">취소</button>
              <button disabled={!cancelReason.trim()} onClick={submitCancelRequest} className="bg-red-600 disabled:bg-gray-300 text-white px-5 py-2 rounded-lg text-sm font-bold">취소 요청 보내기</button>
            </div>
          </div>
        </div>
      )}
      {itemCancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6">
          <div className="w-[460px] bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">요청 취소 · {itemCancelTarget.name}</h3>
              <button onClick={() => { setItemCancelTarget(null); setItemCancelReason(""); }} className="text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <p className="text-[11px] text-gray-500">주문 완료 전 품목입니다. 취소하면 이 품목은 요청 기록에 취소로 남고 승인 묶음에서는 자동 제외됩니다. 승인·예산 예약이 있으면 함께 해제됩니다.</p>
              <textarea value={itemCancelReason} onChange={e => setItemCancelReason(e.target.value)} rows={3} placeholder="예: 요청을 잘못 보냄 · 수량 착오로 다시 요청 예정" className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 resize-none" />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setItemCancelTarget(null); setItemCancelReason(""); }} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium">돌아가기</button>
              <button disabled={!itemCancelReason.trim()} onClick={submitItemCancel} className="bg-red-600 disabled:bg-gray-300 text-white px-5 py-2 rounded-lg text-sm font-bold">요청 취소</button>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
}

function FINSUP01() {
  const { purchaseSupplementDraft, setPurchaseSupplementDraft, eventInfo, purchaseRequests, setPurchaseRequests, selectedPurchaseRequestId, currentUser, navigateTo } = React.useContext(AppContext);
  const request = purchaseRequests.find(item => item.id === selectedPurchaseRequestId) || purchaseRequests.find(item => item.status === "보완 요청") || purchaseRequests[0];
  const supplementItems = request.items.filter(item => item.status === "보완 요청");
  const primarySupplementItem = supplementItems[0] ?? request.items[0];
  const supplementHistory = [...request.history].reverse().find(item => item.action.includes("보완 요청"));
  const canResubmit = request.requester === currentUser.name && canSubmitPurchaseRequest(currentUser);
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
  const resubmit = () => {
    if (!canResubmit || !Object.values(supplement).every(value => value.trim())) return;
    setPurchaseRequests(previous => previous.map(item => {
      if (item.id !== request.id) return item;
      const supplementRequestHistory = [...item.history].reverse().find(historyItem => historyItem.action.includes("보완 요청"));
      const submission: PurchaseSupplementSubmission = {
        id: `${item.id}-SUP-${(item.supplementSubmissions?.length ?? 0) + 1}`,
        requestedAt: supplementRequestHistory?.date ?? "—",
        requestedBy: supplementRequestHistory?.user ?? "재정부",
        submittedAt: "2026-07-29 15:00",
        submittedBy: currentUser.name,
        items: item.items
          .filter(purchaseItem => purchaseItem.status === "보완 요청")
          .map(purchaseItem => {
            const beforeSize = purchaseItem.details?.size ?? purchaseItem.details?.규격 ?? "미입력";
            const beforeColor = purchaseItem.details?.color ?? purchaseItem.details?.색상 ?? "미입력";
            const beforePrintPosition = purchaseItem.details?.printPosition ?? purchaseItem.details?.["인쇄 위치"] ?? "미입력";
            const beforeQuantityOption = purchaseItem.details?.quantityOption ?? `${purchaseItem.quantity}${purchaseItem.unit}`;
            const attachment = purchaseItem.priceEvidence ? [purchaseItem.priceEvidence] : [];
            return {
              itemId: purchaseItem.id,
              itemName: purchaseItem.name,
              reason: purchaseItem.supplementReason ?? "보완 요청 내용을 확인해 주세요.",
              fields: [
                { label: "사이즈·규격", before: String(beforeSize), after: supplement.size.trim() },
                { label: "색상", before: String(beforeColor), after: supplement.color.trim() },
                { label: "인쇄 위치", before: String(beforePrintPosition), after: supplement.printPosition.trim() },
                { label: "옵션별 수량", before: String(beforeQuantityOption), after: supplement.quantityOption.trim() },
              ],
              beforeAttachments: attachment,
              afterAttachments: attachment,
            };
          }),
      };
      return {
        ...item,
        status: "재검토 대기",
        items: item.items.map(purchaseItem => purchaseItem.status === "보완 요청" ? {
          ...purchaseItem,
          status: "검토 대기",
          details: { ...purchaseItem.details, ...supplement },
        } : purchaseItem),
        supplementSubmissions: [...(item.supplementSubmissions ?? []), submission],
        history: [...item.history, { date: submission.submittedAt, action: "보완 내용 재제출", user: currentUser.name }],
      };
    }));
    setPurchaseSupplementDraft(null);
    navigateTo("FIN-REQ-02");
  };
  if (!canResubmit) {
    return <DesktopShell activeSidebar="운영" title="보완 요청 확인" breadcrumb={["운영", "행사", eventInfo.name, "재정"]}><div className="h-full flex items-center justify-center p-8"><div className="max-w-md bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm"><p className="text-sm font-bold text-gray-800">보완 재제출 권한이 없습니다</p><p className="text-xs text-gray-500 mt-2 leading-5">요청자 본인이면서 부서장 또는 재정부인 경우에만 보완 내용을 수정·재제출할 수 있습니다.</p><Btn variant="secondary" className="mt-5" onClick={() => navigateTo("FIN-REQ-02")}>요청 상태 확인</Btn></div></div></DesktopShell>;
  }
  return (
    <DesktopShell activeSidebar="운영" title="보완 요청 확인·재제출" breadcrumb={["운영", "행사", eventInfo.name, "재정", "내 구매 요청", request.id, "보완 재제출"]}>
      <div className="p-8 flex flex-col gap-6 max-w-4xl mx-auto pb-20">
        {/* 보완 요청 배너 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-yellow-800 mb-0.5">보완 요청</p>
            <p className="text-xs text-yellow-700">재정부에서 아래 품목에 대한 보완을 요청했습니다. 내용을 확인하고 수정 후 재제출하세요.</p>
            <div className="flex gap-6 mt-3 text-[11px] text-yellow-700">
              <span><span className="font-semibold">요청 담당자</span> {supplementHistory?.user ?? "재정부"}</span>
              <span><span className="font-semibold">보완 요청일</span> {supplementHistory?.date.slice(0, 10) ?? "—"}</span>
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
            <h3 className="text-sm font-bold text-gray-800">보완 품목 — {supplementItems.map(item => item.name).join(", ") || "보완 대상 없음"}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{request.id} · 보완 대상 품목만 수정할 수 있습니다.</p>
          </div>

          <div className="p-6 flex flex-col gap-6">
            {/* 보완 사유 */}
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
              <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-1.5">보완 사유</p>
              <p className="text-xs text-yellow-800 leading-relaxed">{supplementItems.map(item => item.supplementReason).filter(Boolean).join(" ") || "재정부가 요청한 보완 내용을 확인하고 수정해 주세요."}</p>
            </div>

            {/* 기존 입력 내용 */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">기존 입력 내용</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                {[
                  ["품목명", primarySupplementItem?.name ?? "—"],
                  ["수량", primarySupplementItem ? `${primarySupplementItem.quantity}${primarySupplementItem.unit}` : "—"],
                  ["단가(추정)", primarySupplementItem ? `${primarySupplementItem.estimatedUnitPrice.toLocaleString()}원` : "—"],
                  ["합계(추정)", primarySupplementItem ? `${primarySupplementItem.estimatedTotalPrice.toLocaleString()}원` : "—"],
                  ["예산 항목", primarySupplementItem?.budgetLine ?? "—"],
                ].map(([k, v]) => (
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
          <button disabled={!canResubmit || !Object.values(supplement).every(value => value.trim())} onClick={resubmit} className="bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg text-sm font-bold">수정 내용 재제출</button>
        </div>
      </div>
    </DesktopShell>
  );
}

function FINPROC01() {
  const { eventInfo, purchaseRequests, setPurchaseRequests, selectedPurchaseRequestId, navigateTo } = React.useContext(AppContext);
  const request = purchaseRequests.find(item => item.id === selectedPurchaseRequestId) || purchaseRequests[0];
  const pendingAgreement = request.items.filter(it => it.status === "승인" && it.agreedForPurchase === false);
  // 부분 주문 모달: 주문 대기 실행분을 지정 수량만 주문 완료로 넘기고 남은 수량은 분할한다.
  const [orderTarget, setOrderTarget] = useState<{ itemId: number; execId: string; name: string; maxQty: number; unit: string } | null>(null);
  const [orderQtyInput, setOrderQtyInput] = useState("");
  const submitOrder = () => {
    if (!orderTarget) return;
    const it = request.items.find(i => i.id === orderTarget.itemId);
    if (!it) return;
    execOrderQty(setPurchaseRequests, request.id, it, orderTarget.execId, Number(orderQtyInput) || orderTarget.maxQty);
    setOrderTarget(null);
    setOrderQtyInput("");
  };
  const agreeAll = () => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.status === "승인" && it.agreedForPurchase === false ? { ...it, agreedForPurchase: true } : it),
      history: [...r.history, { date: "2026-08-01 09:50", action: "구매 진행 동의 처리 · 구매 승인 묶음 생성", user: "김민준" }],
    }));
  };
  const orderExecution = (itemId: number, execId: string) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => {
        if (it.id !== itemId) return it;
        const isService = it.purchaseType === "대여" || it.purchaseType === "용역";
        return { ...it, executions: getExecutions({ ...it, status: "승인" }).map(ex => ex.id === execId ? { ...ex, orderStatus: "주문 완료" as ExecutionOrderStatus, receiptStatus: (isService ? "해당 없음" : "배송 대기") as ExecutionReceiptStatus, serviceStatus: (isService ? "이행 대기" : "해당 없음") as ExecutionServiceStatus } : ex) };
      }),
      history: [...r.history, { date: "2026-08-01 10:00", action: "주문 완료", user: "김민준" }],
    }));
  };
  // 배송/이행 단계별 전이: 물품 배송 대기→배송 중→수령 확인 필요→수령 완료, 용역 이행 대기→이행 중→이행 완료
  // 대여·용역 다음 단계 라벨. 대여는 이행 중 → 반납 확인 필요 → 이행 완료, 용역은 반납 없이 이행 중 → 이행 완료.
  const fulfillNextLabel = (ex: PurchaseExecution, isRental: boolean) => {
    if (ex.serviceStatus !== "해당 없음") return ex.serviceStatus === "이행 대기" ? "이행 시작" : ex.serviceStatus === "이행 중" ? (isRental ? "반납 확인 요청" : "이행 완료 확인") : "반납 확인·이행 완료";
    return ex.receiptStatus === "배송 대기" ? "배송 시작" : ex.receiptStatus === "배송 중" ? "물품 도착" : "수령 확인";
  };
  const advanceFulfillment = (itemId: number, execId: string) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => {
        if (it.id !== itemId) return it;
        const isRental = it.purchaseType === "대여"; // 용역은 반납 단계를 건너뛴다
        return {
          ...it,
          executions: getExecutions({ ...it, status: "승인" }).map(ex => {
            if (ex.id !== execId) return ex;
            if (ex.serviceStatus !== "해당 없음") {
              // 이행 대기→이행 중, 이행 중→(대여: 반납 확인 필요 / 용역: 이행 완료), 반납 확인 필요→이행 완료
              const next = (ex.serviceStatus === "이행 대기" ? "이행 중" : ex.serviceStatus === "이행 중" ? (isRental ? "반납 확인 필요" : "이행 완료") : "이행 완료") as ExecutionServiceStatus;
              return { ...ex, serviceStatus: next, evidenceStatus: next === "이행 완료" ? "증빙 필요" as ExecutionEvidenceStatus : ex.evidenceStatus };
            }
            const next = (ex.receiptStatus === "배송 대기" ? "배송 중" : ex.receiptStatus === "배송 중" ? "수령 확인 필요" : "수령 완료") as ExecutionReceiptStatus;
            return { ...ex, receiptStatus: next, receiptIssue: next === "수령 완료" ? false : ex.receiptIssue, evidenceStatus: next === "수령 완료" ? "증빙 필요" as ExecutionEvidenceStatus : ex.evidenceStatus };
          }),
        };
      }),
      history: [...r.history, { date: "2026-08-01 10:10", action: "배송·수령·이행 단계 진행", user: "김민준" }],
    }));
  };
  const markOutOfStock = (itemId: number, execId: string) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.id !== itemId ? it : {
        ...it,
        executions: getExecutions({ ...it, status: "승인" }).map(ex => ex.id === execId ? { ...ex, orderStatus: "구매 불가" as ExecutionOrderStatus } : ex),
      }),
      history: [...r.history, { date: "2026-08-01 10:05", action: "구매 불가(품절) 처리", user: "김민준" }],
    }));
  };
  // 구매 실행분별 렌더 — 이 요청의 품목을 실행분 단위로 표시한다(승인된 품목은 발주 대상).
  const procRows = request.items.flatMap(it => getExecutions({ ...it, status: "승인" }).map(ex => ({ it, ex })));
  const cancelExecution = (itemId: number, execId: string) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.id !== itemId ? it : {
        ...it,
        executions: getExecutions({ ...it, status: "승인" }).map(ex => ex.id === execId
          ? { ...ex, orderStatus: "주문 취소" as ExecutionOrderStatus, paid: true, refundResult: "미확정" as RefundResult, cancelRequested: false }
          : ex),
      }),
      history: [...r.history, { date: "2026-08-01 11:20", action: "주문 취소 처리", user: "김민준" }],
    }));
  };
  // 환불 확인 — 전액/일부/환불 없음 결과 선택. 전액이 아니면 취소 비용(취소 순지출) 증빙이 필요하고, 반환은 항상 증빙 정정본이 필요하다.
  const confirmRefund = (itemId: number, execId: string, result: RefundResult) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.id !== itemId ? it : {
        ...it,
        executions: getExecutions({ ...it, status: "승인" }).map(ex => ex.id === execId ? { ...ex, refundResult: result, evidenceStatus: (result !== "전액 환불" || ex.returned) ? "증빙 필요" as ExecutionEvidenceStatus : ex.evidenceStatus } : ex),
      }),
      history: [...r.history, { date: "2026-08-01 10:15", action: `환불 확인 · ${result}`, user: "김민준" }],
    }));
  };
  const reorder = (itemId: number, execId: string) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => {
        if (it.id !== itemId) return it;
        const execs = getExecutions({ ...it, status: "승인" });
        const newEx: PurchaseExecution = { id: `${it.id}-RE${execs.length + 1}`, itemId: it.id, orderStatus: "주문 대기", receiptStatus: "해당 없음", serviceStatus: "해당 없음", evidenceStatus: "해당 없음", reorderOfExecutionId: execId };
        return { ...it, executions: [...execs, newEx] };
      }),
      history: [...r.history, { date: "2026-07-31 15:15", action: "재주문 실행분 생성", user: "김민준" }],
    }));
  };
  // 품절 반려 — 성공 구매 실행분이 없을 때 품목을 반려하고 예산 예약을 해제한다(8.4)
  const rejectItemOutOfStock = (itemId: number) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.id !== itemId ? it : { ...it, status: "반려", rejectionReason: "품절로 구매할 수 없음" }),
      history: [...r.history, { date: "2026-08-01 10:20", action: "품절 반려 · 예약 해제", user: "김민준" }],
    }));
  };
  // 수령 문제(파손·오배송) — 정상 인수 전까지 수령 확인 필요 유지 + 수령 문제 있음 표시(8.2)
  const flagReceiptIssue = (itemId: number, execId: string) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.id !== itemId ? it : {
        ...it,
        executions: getExecutions({ ...it, status: "승인" }).map(ex => ex.id === execId ? { ...ex, receiptStatus: "수령 확인 필요" as ExecutionReceiptStatus, receiptIssue: true } : ex),
      }),
      history: [...r.history, { date: "2026-08-01 10:25", action: "수령 문제 있음 표시", user: "김민준" }],
    }));
  };
  // 물품 반환 — 수령 완료 후 반환 기록, 환불 추적 시작(8.11)
  const returnItem = (itemId: number, execId: string) => {
    setPurchaseRequests(previous => previous.map(r => r.id !== request.id ? r : {
      ...r,
      items: r.items.map(it => it.id !== itemId ? it : {
        ...it,
        executions: getExecutions({ ...it, status: "승인" }).map(ex => ex.id === execId ? { ...ex, returned: true, refundResult: "미확정" as RefundResult } : ex),
      }),
      history: [...r.history, { date: "2026-08-01 10:30", action: "물품 반환 기록 · 환불 추적", user: "김민준" }],
    }));
  };
  const orderStyle = (s: ExecutionOrderStatus) => s === "주문 완료" ? "text-green-700 bg-green-50" : s === "구매 불가" ? "text-red-700 bg-red-50" : s === "주문 취소" ? "text-red-600 bg-red-50" : "text-gray-500 bg-gray-100";
  const fulfillOf = (ex: PurchaseExecution) => ex.serviceStatus !== "해당 없음" ? ex.serviceStatus : ex.receiptStatus;

  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" },
      activeSidebar: "운영"
    }}>
      <DesktopShell title="구매·발주 처리" breadcrumb={["운영", "행사", eventInfo.name, "재정", "구매·발주 처리"]}>
        <div className="p-8 flex flex-col gap-6 max-w-6xl mx-auto pb-20">
          {/* 요약 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-gray-400">{request.id}</span>
                  <Chip label="구매 진행 중" variant="blue" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{request.title}</h2>
                <p className="text-xs text-gray-500 mt-1">{request.dept} · {request.requester} · 필요한 날짜 {request.neededDate}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-semibold mb-0.5">승인된 전체 금액</p>
                <p className="text-xl font-bold text-gray-900">{request.totalEstimatedAmount.toLocaleString()}원</p>
              </div>
            </div>
          </div>

          {pendingAgreement.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-amber-900">구매 진행 동의 대기 · {pendingAgreement.length}건</p>
                <p className="text-[11px] text-amber-700 mt-1">승인된 품목의 선진행 동의가 필요합니다. 동의하면 구매 승인 묶음이 생성되고 실행분이 주문 대기로 전환됩니다.</p>
              </div>
              <button onClick={agreeAll} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap">구매 진행 동의 처리</button>
            </div>
          )}

          {/* 📦 구매 승인 묶음(컨테이너) → 개별 구매 실행분 */}
          <div className="bg-white border border-gray-200 border-l-4 border-l-indigo-500 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50/40 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full shrink-0 mt-0.5">📦 묶음</span>
                <div>
                  <p className="text-xs font-bold text-gray-800">구매 승인 묶음 · {request.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">이 묶음에 속한 <b>개별 구매 실행분</b>을 각각 주문·수령/이행·증빙 단위로 처리합니다.</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 whitespace-nowrap">실행분 {procRows.length}개</span>
            </div>
            <table className="w-full text-xs text-left [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4">
              <thead><tr className="border-b border-gray-100 text-gray-400 font-medium">
                <th className="px-6 py-2.5">실행분(개별)</th>
                <th className="px-6 py-2.5">품목</th>
                <th className="px-6 py-2.5">수량</th>
                <th className="px-6 py-2.5 text-right">승인액</th>
                <th className="px-6 py-2.5">주문 상태</th>
                <th className="px-6 py-2.5">수령·이행</th>
                <th className="px-6 py-2.5">증빙</th>
                <th className="px-6 py-2.5 text-right">처리</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {procRows.length === 0 && <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">발주할 승인 품목이 없습니다.</td></tr>}
                {procRows.map(({ it, ex }) => {
                  const canCancel = ex.orderStatus === "주문 완료" && ex.receiptStatus !== "수령 완료" && ex.serviceStatus !== "이행 완료";
                  return (
                    <tr key={ex.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-6 py-3"><div className="flex items-center gap-1.5"><span className="text-[10px] font-mono text-gray-400">{ex.id}</span><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ex.reorderOfExecutionId ? "bg-blue-100 text-blue-700" : ex.orderStatus === "주문 취소" ? "bg-red-100 text-red-700" : ex.returned ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>{ex.reorderOfExecutionId ? "재주문·개별" : ex.orderStatus === "주문 취소" ? "취소·개별" : ex.returned ? "반환·개별" : "개별"}</span></div></td>
                      <td className="px-6 py-3 font-semibold text-gray-800">{it.name}{execSeq(it, ex) && <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold align-middle">{execSeq(it, ex)}</span>}</td>
                      <td className="px-6 py-3 text-gray-500">{execQuantityOf(it, ex)}{it.unit}{ex.quantity != null && ex.quantity !== it.quantity && <span className="ml-1 text-[9px] text-blue-500">/{it.quantity}{it.unit}</span>}</td>
                      <td className="px-6 py-3 text-right font-mono text-gray-600">{execAmountOf(it, ex).toLocaleString()}원</td>
                      <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${orderStyle(ex.orderStatus)}`}>{ex.orderStatus}</span></td>
                      <td className="px-6 py-3 text-gray-600 text-[11px]">{fulfillOf(ex)}</td>
                      <td className="px-6 py-3 text-gray-500 text-[11px]">{ex.evidenceStatus}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {ex.orderStatus === "주문 대기" && <button onClick={() => { setOrderTarget({ itemId: it.id, execId: ex.id, name: it.name, maxQty: execQuantityOf(it, ex), unit: it.unit }); setOrderQtyInput(String(execQuantityOf(it, ex))); }} className="text-[10px] border border-blue-200 text-blue-600 px-2 py-1 rounded font-semibold hover:bg-blue-50">주문</button>}
                          {ex.orderStatus === "주문 대기" && <button onClick={() => markOutOfStock(it.id, ex.id)} className="text-[10px] border border-gray-200 text-gray-500 px-2 py-1 rounded font-semibold hover:bg-gray-50">구매 불가</button>}
                          {ex.orderStatus === "구매 불가" && !getExecutions(it).some(e => e.orderStatus === "주문 완료" || e.receiptStatus === "수령 완료" || e.serviceStatus === "이행 완료") && <button onClick={() => rejectItemOutOfStock(it.id)} className="text-[10px] border border-red-200 text-red-600 px-2 py-1 rounded font-semibold hover:bg-red-50">품목 반려</button>}
                          {ex.receiptStatus === "수령 확인 필요" && !ex.receiptIssue && <button onClick={() => flagReceiptIssue(it.id, ex.id)} className="text-[10px] border border-amber-200 text-amber-600 px-2 py-1 rounded font-semibold hover:bg-amber-50">수령 문제</button>}
                          {ex.orderStatus === "주문 완료" && ex.evidenceStatus === "해당 없음" && ex.receiptStatus !== "수령 완료" && ex.serviceStatus !== "이행 완료" && <button onClick={() => advanceFulfillment(it.id, ex.id)} className="text-[10px] border border-green-200 text-green-700 px-2 py-1 rounded font-semibold hover:bg-green-50">{fulfillNextLabel(ex, it.purchaseType === "대여")}</button>}
                          {ex.receiptStatus === "수령 완료" && !ex.returned && <button onClick={() => returnItem(it.id, ex.id)} className="text-[10px] border border-purple-200 text-purple-600 px-2 py-1 rounded font-semibold hover:bg-purple-50">물품 반환</button>}
                          {ex.cancelRequested && ex.orderStatus !== "주문 취소" && <button onClick={() => cancelExecution(it.id, ex.id)} title={ex.cancelReason ? `요청 사유: ${ex.cancelReason}` : undefined} className="text-[10px] border border-red-300 bg-red-50 text-red-700 px-2 py-1 rounded font-semibold hover:bg-red-100">취소 요청 확정</button>}
                          {canCancel && !ex.cancelRequested && <button onClick={() => cancelExecution(it.id, ex.id)} className="text-[10px] border border-red-200 text-red-600 px-2 py-1 rounded font-semibold hover:bg-red-50">외부 취소 기록</button>}
                          {(ex.orderStatus === "주문 취소" || ex.returned) && (ex.refundResult ?? "미확정") === "미확정" && <>
                            <button onClick={() => confirmRefund(it.id, ex.id, "전액 환불")} className="text-[10px] border border-orange-200 text-orange-600 px-2 py-1 rounded font-semibold hover:bg-orange-50">전액 환불</button>
                            <button onClick={() => confirmRefund(it.id, ex.id, "일부 환불")} className="text-[10px] border border-orange-200 text-orange-600 px-2 py-1 rounded font-semibold hover:bg-orange-50">일부 환불</button>
                            <button onClick={() => confirmRefund(it.id, ex.id, "환불 없음")} className="text-[10px] border border-orange-200 text-orange-600 px-2 py-1 rounded font-semibold hover:bg-orange-50">환불 없음</button>
                          </>}
                          {ex.orderStatus === "주문 취소" && (ex.refundResult ?? "미확정") !== "미확정" && !getExecutions(it).some(e => e.reorderOfExecutionId === ex.id) && !ex.reorderDeclined && <>
                            <button onClick={() => reorder(it.id, ex.id)} className="text-[10px] border border-blue-200 text-blue-600 px-2 py-1 rounded font-semibold hover:bg-blue-50">재주문</button>
                            <button onClick={() => execDeclineReorder(setPurchaseRequests, request.id, it, ex.id)} className="text-[10px] border border-gray-200 text-gray-500 px-2 py-1 rounded font-semibold hover:bg-gray-50">재주문 안 함</button>
                          </>}
                          {ex.orderStatus === "주문 취소" && getExecutions(it).some(e => e.reorderOfExecutionId === ex.id) && <span className="text-[10px] text-blue-500 font-semibold">재주문됨</span>}
                          {ex.orderStatus === "주문 취소" && ex.reorderDeclined && <span className="text-[10px] text-gray-500 font-semibold">재주문 안 함</span>}
                          {ex.receiptIssue && <span className="text-[10px] text-amber-600 font-semibold">수령 문제</span>}
                          {ex.returned && <span className="text-[10px] text-purple-600 font-semibold">반환</span>}
                          {ex.evidenceStatus === "증빙 필요" && <span className="text-[10px] text-green-600 font-semibold">증빙 필요</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center gap-3">
            <p className="text-[11px] text-gray-400">각 실행분에서 주문 완료 → 수령·이행 완료 후, 증빙 정리로 이동해 증빙 묶음을 완료합니다.</p>
            <div className="flex gap-3">
              <button onClick={() => navigateTo("EVT-FIN-01B")} className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-lg text-sm font-medium">행사 재정으로</button>
              <button onClick={() => navigateTo("FIN-EVID-01")} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold">증빙 정리로 이동</button>
            </div>
          </div>
        </div>

        {orderTarget && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6">
            <div className="w-[420px] bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">주문 처리 · {orderTarget.name}</h3>
                <button onClick={() => { setOrderTarget(null); setOrderQtyInput(""); }} className="text-gray-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 flex flex-col gap-3">
                <p className="text-[11px] text-gray-500">주문할 수량을 입력하세요. 전체보다 적게 주문하면 남은 수량은 <b>새 주문 대기 실행분</b>으로 자동 분할됩니다.</p>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={orderTarget.maxQty} value={orderQtyInput} onChange={e => setOrderQtyInput(e.target.value)} className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800" />
                  <span className="text-sm text-gray-500">/ {orderTarget.maxQty}{orderTarget.unit}</span>
                </div>
                {Number(orderQtyInput) > 0 && Number(orderQtyInput) < orderTarget.maxQty && (
                  <p className="text-[11px] text-blue-600">주문 완료 {Number(orderQtyInput)}{orderTarget.unit} · 남은 {orderTarget.maxQty - Number(orderQtyInput)}{orderTarget.unit}은 주문 대기로 분할됩니다.</p>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => { setOrderTarget(null); setOrderQtyInput(""); }} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium">취소</button>
                <button disabled={!(Number(orderQtyInput) >= 1)} onClick={submitOrder} className="bg-blue-600 disabled:bg-gray-300 text-white px-5 py-2 rounded-lg text-sm font-bold">주문 완료</button>
              </div>
            </div>
          </div>
        )}
      </DesktopShell>
    </AppContext.Provider>
  );
}

function FINEVID01() {
  const { eventInfo, purchaseRequests, setPurchaseRequests, selectedPurchaseRequestId, navigateTo, setEvidenceBundles, evidenceDrafts, setEvidenceDrafts } = React.useContext(AppContext);
  const request = purchaseRequests.find(item => item.id === selectedPurchaseRequestId) || purchaseRequests[0];
  // 임시 저장된 초안(행사당 하나). 있으면 폼과 선택을 복원한다.
  const draft = evidenceDrafts.find(d => d.eventId === request.eventId);
  // 증빙 묶음 재구성: 증빙이 필요하거나 정리 중(초안)인 실행분을 모아, 구매처·영수증 기준으로 하나의 증빙 묶음으로 묶는다.
  const candidates = purchaseRequests
    .filter(r => r.eventId === request.eventId)
    .flatMap(r => r.items.flatMap(it => getExecutions(it).map(ex => ({ r, it, ex }))))
    .filter(({ ex }) => ex.evidenceStatus === "증빙 필요" || ex.evidenceStatus === "증빙 정리 중");
  const [selected, setSelected] = useState<string[]>(draft?.execIds ?? []);
  const [vendor, setVendor] = useState(draft?.vendor ?? "");
  const [method, setMethod] = useState(draft?.method ?? "법인카드");
  const [receiptNo, setReceiptNo] = useState(draft?.receiptNo ?? "");
  const [actualAmount, setActualAmount] = useState(draft?.actualAmount ?? "");
  const evidenceRequirements = ["영수증", "거래명세서", "결제 증빙(카드전표·이체내역)", "구매 사유"];
  const [evidenceChecked, setEvidenceChecked] = useState<Record<string, boolean>>(draft?.checks ?? {});
  const [draftSaved, setDraftSaved] = useState(false);
  const toggle = (id: string) => setSelected(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  const selectedRows = candidates.filter(({ ex }) => selected.includes(ex.id));
  const bundleReady = selected.length > 0 && vendor.trim() !== "" && Number(actualAmount) > 0 && evidenceRequirements.every(l => evidenceChecked[l]);
  // 임시 저장: 선택 실행분을 증빙 정리 중으로 표시(처리 단계 > 증빙 정리 중 칸반에 뜬다) + 폼 초안 보관.
  const saveDraft = () => {
    if (selected.length === 0) return;
    setPurchaseRequests(previous => previous.map(r => {
      if (r.eventId !== request.eventId) return r;
      let touched = false;
      const items = r.items.map(it => {
        const execs = getExecutions(it);
        if (!execs.some(ex => selected.includes(ex.id))) return it;
        touched = true;
        return { ...it, executions: execs.map(ex => selected.includes(ex.id) && ex.evidenceStatus !== "증빙 완료" ? { ...ex, evidenceStatus: "증빙 정리 중" as ExecutionEvidenceStatus } : ex) };
      });
      if (!touched) return r;
      return { ...r, items, history: [...r.history, { date: "2026-08-01 11:00", action: `증빙 묶음 임시 저장 · ${selected.length}건 정리 중`, user: "김민준" }] };
    }));
    setEvidenceDrafts(prev => [
      ...prev.filter(d => d.eventId !== request.eventId),
      { id: `EVD-${request.eventId}`, eventId: request.eventId, execIds: [...selected], vendor, method, receiptNo, actualAmount, checks: { ...evidenceChecked }, savedAt: "2026-08-01 11:00" },
    ]);
    setDraftSaved(true);
  };
  const completeBundle = () => {
    if (!bundleReady) return;
    setEvidenceDrafts(prev => prev.filter(d => d.eventId !== request.eventId)); // 완료되면 초안 제거
    // 증빙 아카이브에 레코드 저장: 담긴 개별 실행분과 구매처·결제·영수증·실제 지출을 보관해 완료 후 다시 열람할 수 있게 한다.
    setEvidenceBundles(prev => [
      {
        id: `EVB-${String(prev.length + 1).padStart(3, "0")}`,
        eventId: request.eventId,
        vendor: vendor.trim(),
        method,
        receiptNo: receiptNo.trim() || undefined,
        actualAmount: Number(actualAmount),
        completedAt: "2026-08-01 11:00",
        completedBy: "김민준",
        executions: selectedRows.map(({ r, it, ex }) => ({ execId: ex.id, requestId: r.id, itemName: it.name, amount: execAmountOf(it, ex) })),
      },
      ...prev,
    ]);
    setPurchaseRequests(previous => previous.map(r => {
      if (r.eventId !== request.eventId) return r;
      let touched = false;
      const items = r.items.map(it => {
        const execs = getExecutions(it);
        if (!execs.some(ex => selected.includes(ex.id))) return it;
        touched = true;
        return { ...it, executions: execs.map(ex => selected.includes(ex.id) ? { ...ex, evidenceStatus: "증빙 완료" as ExecutionEvidenceStatus } : ex) };
      });
      if (!touched) return r;
      // 요청의 승인 품목이 모두 증빙 완료면 요청 단위로도 정산 완료 처리(실행분 집계 종결)
      const approved = items.filter(it => it.status === "승인");
      const allSettled = approved.length > 0 && approved.every(it => {
        const ex = getExecutions(it);
        return ex.length > 0 && ex.every(e => e.evidenceStatus === "증빙 완료");
      });
      return { ...r, status: allSettled ? "정산 완료" : r.status, items, history: [...r.history, { date: "2026-08-01 11:00", action: `증빙 묶음 완료 · ${vendor} · 실제 지출 ${Number(actualAmount).toLocaleString()}원`, user: "김민준" }] };
    }));
    navigateTo("EVT-FIN-01B");
  };

  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" },
      activeSidebar: "운영"
    }}>
      <DesktopShell title="결제·증빙 정리" breadcrumb={["운영", "행사", eventInfo.name, "재정", "결제·증빙 정리"]}>
        <div className="p-8 flex flex-col gap-6 max-w-6xl mx-auto pb-20">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
            <p className="text-xs font-bold text-blue-900">증빙 묶음은 구매처·결제·영수증 기준으로 실행분을 다시 묶는 단위입니다</p>
            <p className="text-[11px] text-blue-700 mt-1">서로 다른 구매 요청·승인 묶음의 실행분도 실제 거래가 같으면 하나의 증빙 묶음으로 함께 정리할 수 있습니다.</p>
          </div>

          {/* 증빙 필요 실행분 선택 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">▪ 개별</span>
                <p className="text-xs font-bold text-gray-700">증빙 필요·정리 중 개별 실행분 · {candidates.length}건</p>
              </div>
              <span className="text-[10px] text-gray-400">선택한 개별 실행분을 아래에서 하나의 증빙 묶음으로 묶습니다 · 임시 저장하면 ‘정리 중’으로 남습니다</span>
            </div>
            <table className="w-full text-xs text-left [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4">
              <thead><tr className="border-b border-gray-100 text-gray-400 font-medium">
                <th className="px-6 py-2.5 w-10"></th>
                <th className="px-6 py-2.5">실행분</th>
                <th className="px-6 py-2.5">품목</th>
                <th className="px-6 py-2.5">요청(출처 묶음)</th>
                <th className="px-6 py-2.5">수령·이행</th>
                <th className="px-6 py-2.5 text-right">승인액</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {candidates.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">증빙이 필요한 실행분이 없습니다.</td></tr>}
                {candidates.map(({ r, it, ex }) => (
                  <tr key={ex.id} className={`cursor-pointer ${selected.includes(ex.id) ? "bg-blue-50/50" : "hover:bg-gray-50/30"}`} onClick={() => toggle(ex.id)}>
                    <td className="px-6 py-3"><input type="checkbox" checked={selected.includes(ex.id)} onChange={() => toggle(ex.id)} onClick={e => e.stopPropagation()} /></td>
                    <td className="px-6 py-3"><span className="text-[10px] font-mono text-gray-400">{ex.id}</span></td>
                    <td className="px-6 py-3 font-semibold text-gray-800">{it.name}{execSeq(it, ex) && <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold align-middle">{execSeq(it, ex)}</span>}{ex.reorderOfExecutionId && <span className="ml-1.5 text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1 py-0.5">재주문</span>}{ex.evidenceStatus === "증빙 정리 중" && <span className="ml-1.5 text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1 py-0.5">정리 중</span>}</td>
                    <td className="px-6 py-3 text-gray-500 font-mono text-[10px]">{r.id}</td>
                    <td className="px-6 py-3 text-gray-600 text-[11px]">{ex.serviceStatus !== "해당 없음" ? ex.serviceStatus : ex.receiptStatus}</td>
                    <td className="px-6 py-3 text-right font-mono text-gray-600">{execAmountOf(it, ex).toLocaleString()}원{ex.quantity != null && ex.quantity !== it.quantity && <span className="ml-1 text-[9px] text-blue-500">({ex.quantity}{it.unit})</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 📦 증빙 묶음(컨테이너) */}
          <div className="bg-white border border-gray-200 border-l-4 border-l-indigo-500 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">📦 묶음</span>
                <h3 className="text-sm font-bold text-gray-800">증빙 묶음 구성</h3>
              </div>
              <span className="text-[11px] text-gray-500">담긴 개별 실행분 {selected.length}건</span>
            </div>
            <div className="border border-dashed border-indigo-200 bg-indigo-50/30 rounded-lg p-3 flex flex-wrap gap-1.5 min-h-[46px] items-center">
              {selectedRows.length === 0 && <span className="text-[11px] text-gray-400">위에서 개별 실행분을 선택하면 이 묶음에 담깁니다.</span>}
              {selectedRows.map(({ it, ex }) => <span key={ex.id} className="bg-white border border-indigo-200 text-gray-700 px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1"><span className="text-slate-400 font-mono">{ex.id}</span> {it.name}</span>)}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="구매처" value={vendor} onChange={event => setVendor(event.target.value)} required />
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-600">결제 수단</label>
                <select className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-white" value={method} onChange={event => setMethod(event.target.value)}>
                  <option>법인카드</option><option>계좌이체</option><option>현금</option>
                </select>
              </div>
              <Input label="영수증 번호" value={receiptNo} onChange={event => setReceiptNo(event.target.value)} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">필수 증빙</p>
              <div className="grid grid-cols-2 gap-2">
                {evidenceRequirements.map(label => <label key={label} className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-xs cursor-pointer ${evidenceChecked[label] ? "border-green-300 bg-green-50 text-green-800" : "border-gray-200 text-gray-600"}`}><input type="checkbox" checked={Boolean(evidenceChecked[label])} onChange={event => setEvidenceChecked(current => ({ ...current, [label]: event.target.checked }))} />{label}</label>)}
              </div>
            </div>
            <div className="w-56"><Input label="실제 지출 금액" type="number" value={actualAmount} onChange={event => setActualAmount(event.target.value)} required /></div>
          </div>

          <div className="flex justify-end items-center gap-3">
            {draftSaved && <span className="text-xs text-green-700 mr-1">임시 저장됨 · 처리 단계 &gt; 증빙 정리 중에 표시됩니다</span>}
            <button disabled={selected.length === 0} onClick={saveDraft} className="border border-gray-200 disabled:border-gray-100 disabled:text-gray-300 text-gray-600 px-5 py-2.5 rounded-lg text-sm font-medium">임시 저장</button>
            <button disabled={!bundleReady} onClick={completeBundle} className="bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg text-sm font-bold">증빙 묶음 완료·실제 지출 반영</button>
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
  // 행사에 연결된 일정만 소유 행사 식별자를 가진다. 상시 업무·조직 일정에는 부여하지 않는다.
  eventId?: string;
};

const CAL_EVENTS: CalendarEvent[] = [
  { year: 2026, month: 6, day: 20, type: "마감", label: "체육대회 참가 신청 마감", eventId: SPORTS_EVENT_ID },
  { year: 2026, month: 6, day: 22, type: "회의", label: "정기 운영회의" },
  { year: 2026, month: 6, day: 23, type: "마감", label: "비상 연락망 최종본 배포" },
  { year: 2026, month: 6, day: 28, type: "회의", label: "신입생 환영 기획회의 2차", eventId: "EVT-WELCOME" },
  { year: 2026, month: 6, day: 31, type: "행사", label: "행사장 사전 답사", eventId: SPORTS_EVENT_ID },
];

const CAL_TYPE_STYLE: Record<CalendarEvent["type"], string> = {
  행사: "bg-green-50 text-green-800 border-green-200 border-l-[3px] border-l-green-500",
  회의: "bg-violet-50 text-violet-800 border-violet-200 border-l-[3px] border-l-violet-500",
  마감: "bg-orange-50 text-orange-800 border-orange-200 border-l-[3px] border-l-orange-500",
};

const CAL_TYPE_DOT: Record<CalendarEvent["type"], string> = {
  행사: "bg-green-500",
  회의: "bg-violet-500",
  마감: "bg-orange-500",
};

const CAL_FILTER_STYLE: Record<"전체" | CalendarEvent["type"], { active: string; idle: string }> = {
  전체: { active: "bg-gray-700 text-white border-gray-700", idle: "bg-white text-gray-600 border-gray-300 hover:bg-gray-50" },
  행사: { active: "bg-green-600 text-white border-green-600", idle: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
  회의: { active: "bg-violet-600 text-white border-violet-600", idle: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
  마감: { active: "bg-orange-600 text-white border-orange-600", idle: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" },
};

function OPSCAL01() {
  const { navigateTo, calendarFocus, eventInfo, eventTasks, recurringTasks, createdMeetings, selectedEventId, setSelectedEventId, setSelectedEventTaskId, setSelectedRecurringTaskId, setSelectedCreatedMeetingId, currentUser } = React.useContext(AppContext);
  const [typeFilter, setTypeFilter] = useState("전체");
  const [month, setMonth] = useState(() => new Date(2026, calendarFocus?.month ?? 6, 1));
  const taskDeadlineEvents: CalendarEvent[] = [
    // 행사 업무 마감은 현재 선택 행사에 귀속되므로 소유 행사 식별자를 함께 담는다.
    ...eventTasks.filter(task => task.due !== "상시" && task.status !== "완료").map(task => {
      const due = new Date(`${task.due}T00:00:00`);
      return { year: due.getFullYear(), month: due.getMonth(), day: due.getDate(), type: "마감" as const, label: task.name, source: "eventTask" as const, sourceTaskId: task.id, eventId: selectedEventId };
    }),
    // 상시 업무 마감은 행사에 속하지 않으므로 eventId를 부여하지 않는다.
    ...recurringTasks.filter(task => task.due !== "상시" && task.status !== "완료").map(task => {
      const due = new Date(`${task.due}T00:00:00`);
      return { year: due.getFullYear(), month: due.getMonth(), day: due.getDate(), type: "마감" as const, label: task.name, source: "recurringTask" as const, sourceTaskId: task.id };
    }),
  ];
  const createdMeetingEvents: CalendarEvent[] = createdMeetings.filter((meeting) => meeting.status !== "취소").map((meeting) => {
    const [year, meetingMonth, day] = meeting.time.split(" ")[0].split(".").map(Number);
    // 행사에 연결해 만든 회의만 소유 행사 식별자를 가진다(조직 회의는 undefined).
    return { year, month: meetingMonth - 1, day, type: "회의" as const, label: meeting.name, source: "createdMeeting" as const, sourceMeetingId: meeting.id, eventId: meeting.eventId };
  });
  // 선택 행사의 행사 당일 항목. 기본정보(EVT-02B)의 시작 일시를 단일 원본으로 읽어 표시한다.
  const eventDayEvents: CalendarEvent[] = eventInfo.startAt ? (() => {
    const start = new Date(eventInfo.startAt);
    return [{ year: start.getFullYear(), month: start.getMonth(), day: start.getDate(), type: "행사" as const, label: eventInfo.name, eventId: selectedEventId }];
  })() : [];
  const monthlyEvents = [...CAL_EVENTS, ...taskDeadlineEvents, ...createdMeetingEvents, ...eventDayEvents].filter(event => event.year === month.getFullYear() && event.month === month.getMonth());
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
      const meeting = createdMeetings.find(item => item.id === event.sourceMeetingId);
      navigateTo(meeting ? getCreatedMeetingScreen(meeting, currentUser) : "OPS-MEET-01A");
      return;
    }
    navigateTo(event.type === "회의" ? "OPS-MEET-01A" : event.type === "행사" ? "EVT-00A" : "EVT-TASK-01");
  };
  // 행사에 연결된 일정의 보조 행동: 소유 행사를 선택하고 해당 행사의 일정 탭으로 이동한다.
  const openEventSchedule = (eventId: string) => {
    setSelectedEventId(eventId);
    navigateTo("EVT-SCHED-01");
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
          <div className="ml-auto flex items-center gap-1.5" aria-label="일정 유형 필터">
            {(["전체", "행사", "회의", "마감"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${typeFilter === t ? CAL_FILTER_STYLE[t].active : CAL_FILTER_STYLE[t].idle}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 px-1 text-[10px] text-gray-500" aria-label="일정 유형 색상 범례">
          <span className="font-semibold text-gray-600">유형별 표시</span>
          {(["행사", "회의", "마감"] as const).map(type => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${CAL_TYPE_DOT[type]}`} aria-hidden="true" />
              {type}
            </span>
          ))}
          <span className="text-gray-400">마감은 완료되지 않은 업무 기준</span>
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
                          <div key={`${e.sourceTaskId ?? e.sourceMeetingId ?? e.label}-${e.day}`} className={`flex items-stretch border rounded overflow-hidden ${CAL_TYPE_STYLE[e.type]}`}>
                            <button type="button" onClick={() => openEvent(e)} className="flex-1 min-w-0 text-left text-[9px] font-semibold px-1 py-0.5 leading-tight truncate hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300">{e.label}</button>
                            {e.eventId && (
                              <button type="button" onClick={() => openEventSchedule(e.eventId!)} aria-label={`${e.label} 행사 일정 보기`} title="행사 일정 보기" className="shrink-0 px-0.5 flex items-center border-l border-black/10 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300"><ExternalLink className="w-2.5 h-2.5" aria-hidden="true" /></button>
                            )}
                          </div>
                        ))}
                        {day === focusedDay && !isReferenceMonth && calendarFocus && !visibleEvents.some(e => e.day === day) && <p className="text-[9px] font-medium border rounded px-1 py-0.5 leading-tight truncate bg-indigo-50 text-indigo-700 border-indigo-100">{calendarFocus.label}</p>}
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
                <div key={`${e.sourceTaskId ?? e.sourceMeetingId ?? e.label}-${e.day}`} className="border border-gray-100 rounded-lg hover:border-blue-300">
                  <button type="button" onClick={() => openEvent(e)} className="w-full text-left p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-medium border rounded px-1.5 py-0.5 ${CAL_TYPE_STYLE[e.type]}`}>{e.type}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{String(e.month + 1).padStart(2, "0")}.{String(e.day).padStart(2, "0")}</span>
                    </div>
                    <p className="text-xs font-semibold text-gray-800 leading-snug">{e.label}</p>
                  </button>
                  {e.eventId && (
                    <div className="px-3 pb-2.5 -mt-1">
                      <button type="button" onClick={() => openEventSchedule(e.eventId!)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
                        <ExternalLink className="w-3 h-3" aria-hidden="true" /> 행사 일정 보기
                      </button>
                    </div>
                  )}
                </div>
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
  const { eventWorkspaceFilter, setEventWorkspaceFilter, currentUser, eventTasks, setEventTasks, setSelectedEventTaskId, navigateTo, eventInfo } = React.useContext(AppContext);
  const taskBannerDate = eventInfo.startAt ? eventInfo.startAt.slice(0, 10) : "일시 미정";
  const taskBannerPlace = eventInfo.placeConfirmed && eventInfo.placeName ? eventInfo.placeName : "장소 미정";
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
  const unassignedTasks = tasks.filter(t => t.assignee === "미지정");
  // 업무가 없는 행사에서 0으로 나누지 않도록 진행률을 방어적으로 계산한다.
  const completionRate = tasks.length === 0 ? 0 : (completedTasks.length / tasks.length) * 100;
  // D-DAY는 선택 행사 시작 일시에서 계산한다. 일시 미정이면 표시하지 않는다.
  const dDayLabel = eventInfo.startAt
    ? `D-${Math.max(0, Math.ceil((new Date(eventInfo.startAt).getTime() - new Date("2026-07-19T00:00:00").getTime()) / 86400000))}`
    : "미정";
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
      breadcrumb={["운영", "행사", eventInfo.name, "업무"]}
      title={eventInfo.name}
      tabs={EVENT_TABS}
      activeTab="업무"
      actions={<Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> 업무 추가</Btn>}
    >
      <div className="p-6 flex flex-col gap-5">
        {/* 행사 정보 배너 */}
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-bold text-gray-900">{eventInfo.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">행사일 {taskBannerDate} · {taskBannerPlace}</p>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-[10px] text-gray-400">D-DAY</p>
              <p className="text-xl font-bold text-blue-600">{dDayLabel}</p>
            </div>
            <div className="border-l border-gray-100 pl-6">
              <p className="text-[10px] text-gray-400 mb-1">전체 진행 현황</p>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${completionRate}%` }} />
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
            <span className="text-xs font-medium text-red-700">담당자 없음 {unassignedTasks.length}건</span>
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
            <span className="text-xs text-red-800 font-medium">담당자 없는 업무 {unassignedTasks.length}건만 보고 있습니다.</span>
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
  const { eventTasks, setEventTasks, selectedEventTaskId, navigateTo, currentUser, eventInfo } = React.useContext(AppContext);
  const [activeTab, setActiveTab] = useState("관련 문서·결과물");
  const [assigneeToAssign, setAssigneeToAssign] = useState("박해랑");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const task = eventTasks.find(item => item.id === selectedEventTaskId) ?? eventTasks.find(item => item.id === "T-03") ?? eventTasks[0];
  // 업무가 없는 행사(예: 새로 만든 행사)에서 직접 진입하면 표시할 업무가 없다.
  if (!task) {
    return (
      <DesktopShell
        activeSidebar="운영"
        breadcrumb={["운영", "행사", eventInfo.name, "업무", "업무 상세"]}
        title={eventInfo.name}
        tabs={EVENT_TABS}
        activeTab="업무"
        actions={<Btn variant="secondary" size="sm" onClick={() => navigateTo("EVT-TASK-01")}><ArrowLeft className="w-3.5 h-3.5" /> 업무 보드로</Btn>}
      >
        <div className="p-10 text-center text-sm text-gray-400">아직 등록된 업무가 없습니다.</div>
      </DesktopShell>
    );
  }
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
      breadcrumb={["운영", "행사", eventInfo.name, "업무", "업무 상세"]}
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

function ORG07WithModal({ which }: { which: "B" | "C" | null }) {
  const [modal, setModal] = useState<"B" | "C" | null>(which);
  const [rows, setRows] = useState<StudentRosterRow[]>(INITIAL_STUDENT_ROWS);
  const [lastRosterUpdate, setLastRosterUpdate] = useState<RosterUpdate>(INITIAL_ROSTER_UPDATE);
  const [lastFeeRosterUpdate, setLastFeeRosterUpdate] = useState<FeeRosterUpdate>(INITIAL_FEE_ROSTER_UPDATE);
  const { currentUser } = React.useContext(AppContext);
  const currentTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };
  const applyRoster = () => {
    setLastRosterUpdate({
      at: currentTimestamp(),
      kind: "학생 명단 업로드",
      by: currentUser.name,
    });
  };
  const applyFeeRoster = (term: string) => {
    const paidStudentIds = new Set(["2022123456", "2023234567", "2020345678", "2024678901", "2023789012"]);
    setRows(current => current.map(row => paidStudentIds.has(row.id)
      ? { ...row, status: "납부", statusV: "green" }
      : { ...row, status: "미납", statusV: "red" }
    ));
    setLastFeeRosterUpdate({ at: currentTimestamp(), term, by: currentUser.name });
  };
  return (
    <div className="relative h-full">
      <ORG07A
        onOpenRoster={() => setModal("B")}
        onOpenFeeRoster={() => setModal("C")}
        rows={rows}
        lastRosterUpdate={lastRosterUpdate}
        lastFeeRosterUpdate={lastFeeRosterUpdate}
      />
      {modal === "B" && <ORG07B onClose={() => setModal(null)} onApply={applyRoster} />}
      {modal === "C" && <ORG07C onClose={() => setModal(null)} onApply={applyFeeRoster} />}
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

// 회장단 전용 화면들은 검토 시 회장단 사용자를 주입한다.
// 그렇지 않으면 부원이 회장단 전용 행동을 하고 있는 화면이 되어 권한 규칙과 어긋난다.
function AsPresident({ children }: { children: React.ReactNode }) {
  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김바다", dept: "학술체육부", role: "회장단" }
    }}>
      {children}
    </AppContext.Provider>
  );
}

function AsFinanceManager({ children }: { children: React.ReactNode }) {
  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" }
    }}>
      {children}
    </AppContext.Provider>
  );
}

// 구매 요청 작성·본인 보완 재제출 권한을 검토하기 위한 홍보부 부서장 사용자.
function AsPromotionDepartmentHead({ children }: { children: React.ReactNode }) {
  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민석", dept: "홍보부", role: "부서장" },
      selectedPurchaseRequestId: "REQ-002"
    }}>
      {children}
    </AppContext.Provider>
  );
}

// 보완 재제출 후 재정부가 확인할 화면을 위한 샘플 상태.
function AsFinanceRecheck({ children }: { children: React.ReactNode }) {
  const context = React.useContext(AppContext);
  const [recheckRequests, setRecheckRequests] = useState<PurchaseRequest[]>(() => context.purchaseRequests.map(request => {
    if (request.id !== "REQ-002") return request;
    const submission: PurchaseSupplementSubmission = {
      id: "REQ-002-SUP-1",
      requestedAt: "2026-03-03 09:00",
      requestedBy: "김바다",
      submittedAt: "2026-07-29 15:00",
      submittedBy: "김민석",
      items: [{
        itemId: 5,
        itemName: "메인 현수막",
        reason: "규격과 인쇄 사양을 보완하고 업체 견적서를 다시 확인해 주세요.",
        fields: [
          { label: "사이즈·규격", before: "500*90", after: "500×90cm" },
          { label: "색상", before: "미입력", after: "학생회 메인 블루" },
          { label: "인쇄 위치", before: "미입력", after: "전면 단면 인쇄" },
          { label: "옵션별 수량", before: "1개", after: "기본형 1개" },
        ],
        beforeAttachments: ["현수막 견적서.pdf"],
        afterAttachments: ["현수막 수정 견적서.pdf"],
      }],
    };
    return {
      ...request,
      status: "재검토 대기",
      items: request.items.map(item => item.id === 5 ? {
        ...item,
        status: "검토 대기",
        priceEvidence: "현수막 수정 견적서.pdf",
        details: {
          ...item.details,
          size: "500×90cm",
          color: "학생회 메인 블루",
          printPosition: "전면 단면 인쇄",
          quantityOption: "기본형 1개",
        },
      } : item),
      supplementSubmissions: [submission],
      history: request.history.some(historyItem => historyItem.action === "보완 내용 재제출")
        ? request.history
        : [...request.history, { date: submission.submittedAt, action: "보완 내용 재제출", user: submission.submittedBy }],
    };
  }));
  const setSynchronizedRecheckRequests: React.Dispatch<React.SetStateAction<PurchaseRequest[]>> = action => {
    const nextRequests = typeof action === "function" ? action(recheckRequests) : action;
    setRecheckRequests(nextRequests);
    context.setPurchaseRequests(nextRequests);
  };
  return (
    <AppContext.Provider value={{
      ...context,
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" },
      selectedPurchaseRequestId: "REQ-002",
      purchaseRequests: recheckRequests,
      setPurchaseRequests: setSynchronizedRecheckRequests,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// 행사 운영 조직 관리자 전용 화면. 이 권한은 기본 직급이 아니라 행사별 맥락 역할이므로
// 검토 시 운영 조직에 속한 사용자를 주입한다. 기본 역할은 부서장이지만 eventRole로 관리자 권한을 준다.
function AsEventManager({ children }: { children: React.ReactNode }) {
  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "이수현", dept: "기획부", role: "부서장", eventRole: "행사 운영 조직 관리자" }
    }}>
      {children}
    </AppContext.Provider>
  );
}

function ORG03CWithDialog() {
  return <AsPresident><ORG03C /></AsPresident>;
}

// ─── FIN-00B 전체 재정 현황 — 재정부 ─────────────────────────────────────────
// 같은 화면을 재정부 사용자로 보여 준다. 예산 편성 권한이 보이는 상태를 검토하기 위한 역할 변형이다.

function FIN00B() {
  return (
    <AppContext.Provider value={{
      ...React.useContext(AppContext),
      currentUser: { name: "김민준", dept: "재정부", role: "부서장" }
    }}>
      <FIN00 />
    </AppContext.Provider>
  );
}

// ─── MSG 메시지 ───────────────────────────────────────────────────────────────
// 조직도를 그대로 쓴다. 부서 단위 선택과 개별 구성원 선택을 한 화면에서 함께 한다.

const MESSAGE_SCOPE_GENERAL = "일반";

// 첨부만 보낸 메시지도 목록에서 내용을 알 수 있게 한다.
function messagePreviewText(message: ChatMessage) {
  if (message.text) return message.text;
  const attachmentCount = message.attachments?.length ?? 0;
  return attachmentCount > 0 ? `파일 ${attachmentCount}개` : "";
}

// 방 이름을 비운 채 만들면 선택한 대상에서 이름을 짓는다.
// 대표 한 명(또는 한 부서)을 앞에 두고 나머지 인원 수를 붙인다. 없는 정보를 지어내지 않는다.
function buildAutoRoomName(input: { depts: string[]; members: string[]; totalCount: number; deptSize: (dept: string) => number }) {
  const { depts, members, totalCount, deptSize } = input;
  const head = depts[0] ?? members[0];
  if (!head) return "";
  const headCount = depts[0] ? deptSize(depts[0]) : 1;
  const rest = totalCount - headCount;
  return rest > 0 ? `${head} 외 ${rest}명` : head;
}

function MessageRoomCreateModal(props: { onClose: () => void; onCreate: (room: Omit<MessageRoom, "id" | "createdBy" | "createdAt">) => void }) {
  const { onClose, onCreate } = props;
  const { organizationMemberRoles } = React.useContext(AppContext);

  const departments = [...new Set(organizationMemberRoles.map(member => member.dept))];
  const scopes = [MESSAGE_SCOPE_GENERAL, MAIN_EVENT_NAME, "2026 신입생 환영 행사"];

  const [scope, setScope] = useState(MESSAGE_SCOPE_GENERAL);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [expandedDepts, setExpandedDepts] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");

  const trimmedQuery = query.trim();
  const membersOfDept = (dept: string) =>
    organizationMemberRoles.filter(member => member.dept === dept && (!trimmedQuery || member.name.includes(trimmedQuery)));
  // 검색 중에는 결과가 있는 부서만 남기고 자동으로 펼친다.
  const visibleDepts = trimmedQuery ? departments.filter(dept => membersOfDept(dept).length > 0) : departments;
  const isExpanded = (dept: string) => Boolean(trimmedQuery) || expandedDepts.includes(dept);

  const participants = new Set<string>();
  organizationMemberRoles.forEach(member => { if (selectedDepts.includes(member.dept)) participants.add(member.name); });
  selectedMembers.forEach(memberName => participants.add(memberName));

  const toggleDept = (dept: string) => {
    const willSelect = !selectedDepts.includes(dept);
    setSelectedDepts(previous => willSelect ? [...previous, dept] : previous.filter(item => item !== dept));
    // 부서 전체를 선택하면 같은 부서의 개별 선택은 정리한다.
    if (willSelect) {
      const deptMemberNames = organizationMemberRoles.filter(member => member.dept === dept).map(member => member.name);
      setSelectedMembers(previous => previous.filter(memberName => !deptMemberNames.includes(memberName)));
    }
  };

  const toggleMember = (memberName: string) => {
    setSelectedMembers(previous => previous.includes(memberName) ? previous.filter(item => item !== memberName) : [...previous, memberName]);
  };

  const toggleExpand = (dept: string) => {
    setExpandedDepts(previous => previous.includes(dept) ? previous.filter(item => item !== dept) : [...previous, dept]);
  };

  const autoRoomName = buildAutoRoomName({
    depts: selectedDepts,
    members: selectedMembers,
    totalCount: participants.size,
    deptSize: dept => organizationMemberRoles.filter(member => member.dept === dept).length,
  });
  const finalName = name.trim() || autoRoomName;
  const canCreate = participants.size > 0;

  return (
    <div className="bg-white rounded-2xl shadow-xl w-[620px] max-h-[86vh] flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-900">새 메시지 방 만들기</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">부서를 통째로 고르거나, 부서를 펼쳐 필요한 사람만 고를 수 있습니다.</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">
        {/* 분류 */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">분류</p>
          <div className="flex flex-wrap gap-2">
            {scopes.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  scope === item ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {scope === MESSAGE_SCOPE_GENERAL ? "행사와 무관한 학생회 내부 소통입니다." : "이 행사와 관련된 소통으로 분류됩니다."}
          </p>
        </div>

        {/* 방 이름 — 선택한 대상을 자동으로 넣지 않는다. 대상은 아래 `구성원`에서 확인한다. */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-700">방 이름</p>
            <span className="text-[10px] text-gray-400">선택</span>
          </div>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="예: 체육대회 운영 논의"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400"
          />
          {!name.trim() && (
            <p className="text-[10px] text-gray-400 mt-1.5">
              {autoRoomName
                ? <>비워두면 <span className="font-semibold text-gray-600">{autoRoomName}</span>(으)로 자동 생성됩니다.</>
                : "비워두면 선택한 구성원으로 자동 생성됩니다."}
            </p>
          )}
        </div>

        {/* 구성원 — 부서 단위와 개인을 형태로 구분해 보여주고, 여기서 바로 뺄 수 있다. */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">구성원</p>
            {participants.size > 0 && <span className="text-[10px] text-gray-400">총 {participants.size}명</span>}
          </div>
          {participants.size === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg px-4 py-5 text-center">
              <p className="text-xs text-gray-400">아래에서 부서 또는 구성원을 선택해 주세요.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg px-3 py-3 flex flex-wrap gap-2">
              {selectedDepts.map(dept => (
                <span key={dept} className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg pl-2 pr-1.5 py-1 text-[11px] font-semibold">
                  <Users className="w-3 h-3" />
                  {dept} 전체
                  <button type="button" onClick={() => toggleDept(dept)} className="hover:bg-white/25 rounded p-0.5" title={`${dept} 빼기`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedMembers.map(memberName => (
                <span key={memberName} className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg pl-1 pr-1.5 py-1 text-[11px] font-medium">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[9px] font-bold flex items-center justify-center">{memberName.slice(0, 1)}</span>
                  {memberName}
                  <button type="button" onClick={() => toggleMember(memberName)} className="hover:bg-gray-100 rounded p-0.5 text-gray-400" title={`${memberName} 빼기`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 대상 선택 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">대상 선택</p>
            <div className="relative w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="이름 검색"
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder-gray-400"
              />
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
            {visibleDepts.map(dept => {
              const deptMembers = membersOfDept(dept);
              const deptSelected = selectedDepts.includes(dept);
              const totalCount = organizationMemberRoles.filter(member => member.dept === dept).length;
              const pickedCount = organizationMemberRoles.filter(member => member.dept === dept && selectedMembers.includes(member.name)).length;
              return (
                <div key={dept}>
                  {/* 부서 행: 아이콘 + 굵은 이름 + `전체 선택` 토글 버튼 (개인 체크박스와 형태를 다르게 둔다) */}
                  <div className={`flex items-center gap-3 px-4 py-3 ${deptSelected ? "bg-blue-50/70" : "hover:bg-gray-50"}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${deptSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-bold truncate ${deptSelected ? "text-blue-800" : "text-gray-900"}`}>{dept}</p>
                      <p className="text-[10px] text-gray-400">
                        구성원 {totalCount}명
                        {!deptSelected && pickedCount > 0 && <span className="text-blue-600 font-medium"> · {pickedCount}명 개별 선택</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDept(dept)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors shrink-0 ${
                        deptSelected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      {deptSelected ? <span className="flex items-center gap-1"><Check className="w-3 h-3" /> 부서 전체</span> : "부서 전체"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(dept)}
                      title={isExpanded(dept) ? "구성원 접기" : "구성원 보기"}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                        isExpanded(dept) ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 개인 행: 들여쓰기 + 세로 연결선 + 아바타 + 오른쪽 체크박스 */}
                  {isExpanded(dept) && (
                    <div className="bg-gray-50/70 pl-8 pr-4 py-1.5">
                      <div className="border-l-2 border-gray-200 pl-4 flex flex-col">
                        {deptMembers.map(member => (
                          <label
                            key={member.name}
                            className={`flex items-center gap-2.5 py-1.5 ${deptSelected ? "" : "cursor-pointer"}`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              deptSelected || selectedMembers.includes(member.name) ? "bg-blue-100 text-blue-700" : "bg-white border border-gray-200 text-gray-500"
                            }`}>
                              {member.name.slice(0, 1)}
                            </span>
                            <span className="text-xs text-gray-800 flex-1 truncate">{member.name}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{member.role}</span>
                            {deptSelected ? (
                              <span className="text-[10px] text-blue-600 font-medium shrink-0 w-11 text-right">포함됨</span>
                            ) : (
                              <span className="w-11 flex justify-end shrink-0">
                                <input
                                  type="checkbox"
                                  checked={selectedMembers.includes(member.name)}
                                  onChange={() => toggleMember(member.name)}
                                  className="w-3.5 h-3.5 accent-blue-600"
                                />
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {visibleDepts.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-gray-400">검색 결과가 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
        <div className="min-w-0">
          {participants.size > 0 ? (
            <p className="text-xs text-gray-600">
              부서 {selectedDepts.length}개 · 개인 {selectedMembers.length}명
              <span className="font-semibold text-gray-900"> · 총 {participants.size}명</span>
            </p>
          ) : (
            <p className="text-xs text-gray-400">부서 또는 구성원을 한 명 이상 선택해 주세요.</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Btn variant="text" size="sm" onClick={onClose}>취소</Btn>
          <Btn
            variant="primary"
            size="sm"
            disabled={!canCreate}
            onClick={() => canCreate && onCreate({ name: finalName, scope, depts: selectedDepts, members: selectedMembers })}
          >
            방 만들기
          </Btn>
        </div>
      </div>
    </div>
  );
}

function MessageRoomsScreen({ initialModalOpen = false }: { initialModalOpen?: boolean }) {
  const { messageRooms, setMessageRooms, organizationMemberRoles, currentUser, navigateTo, setSelectedMessageRoomId } = React.useContext(AppContext);
  const [modalOpen, setModalOpen] = useState(initialModalOpen);

  const participantCount = (room: MessageRoom) => {
    const names = new Set<string>();
    organizationMemberRoles.forEach(member => { if (room.depts.includes(member.dept)) names.add(member.name); });
    room.members.forEach(memberName => names.add(memberName));
    return names.size;
  };

  const scopes = [MESSAGE_SCOPE_GENERAL, ...new Set(messageRooms.map(room => room.scope).filter(scope => scope !== MESSAGE_SCOPE_GENERAL))];

  const createRoom = (draft: Omit<MessageRoom, "id" | "createdBy" | "createdAt" | "messages" | "unreadCount">) => {
    // 와이어프레임 데모: 방을 만들면 안내 문구와 상대방의 첫 메시지를 넣어 대화·안 읽음 흐름을 확인할 수 있게 한다.
    const roomMemberNames = new Set<string>();
    organizationMemberRoles.forEach(member => { if (draft.depts.includes(member.dept)) roomMemberNames.add(member.name); });
    draft.members.forEach(memberName => roomMemberNames.add(memberName));
    const counterpart = [...roomMemberNames].find(memberName => memberName !== currentUser.name);

    const messages: ChatMessage[] = [
      { id: "m-0", sender: "system", text: `${currentUser.name}님이 이 방을 만들었습니다.`, at: formatClockTime(new Date()) },
    ];
    if (counterpart) {
      messages.push({ id: "m-1", sender: counterpart, text: "네, 확인했어요. 여기서 이야기 나눠요.", at: formatClockTime(new Date()) });
    }

    setMessageRooms(previous => [
      ...previous,
      {
        ...draft,
        id: `MSG-R-${previous.length + 1}`,
        createdBy: currentUser.name,
        createdAt: formatDateInput(new Date()),
        messages,
        unreadCount: counterpart ? 1 : 0,
      },
    ]);
    setModalOpen(false);
  };

  return (
    <div className="relative h-full">
      <DesktopShell
        activeSidebar="메시지"
        title="메시지"
        actions={
          messageRooms.length > 0
            ? <Btn variant="primary" size="sm" onClick={() => setModalOpen(true)}><Plus className="w-3.5 h-3.5" /> 새 메시지 방</Btn>
            : undefined
        }
      >
        <div className="p-6 max-w-4xl mx-auto">
          {messageRooms.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-6 py-16 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-5">
                <MessageSquare className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-sm font-bold text-gray-900">아직 만들어진 메시지 방이 없습니다</p>
              <p className="text-xs text-gray-500 mt-2 leading-6 max-w-sm">
                학생회 조직도를 그대로 사용해 방을 만들 수 있습니다.
                <br />부서를 통째로 고르거나, 부서를 펼쳐 필요한 사람만 고르세요.
              </p>
              <div className="mt-6">
                <Btn variant="primary" onClick={() => setModalOpen(true)}><Plus className="w-3.5 h-3.5" /> 새 메시지 방 만들기</Btn>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {scopes.map(scope => {
                const rooms = messageRooms.filter(room => room.scope === scope);
                if (rooms.length === 0) return null;
                return (
                  <div key={scope} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">{scope}</p>
                      <span className="text-[10px] text-gray-400">{rooms.length}개 방</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {rooms.map(room => {
                        const lastMessage = room.messages[room.messages.length - 1];
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => { setSelectedMessageRoomId(room.id); navigateTo("MSG-03"); }}
                            className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-gray-900 truncate">{room.name}</p>
                                {room.unreadCount > 0 && (
                                  <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 shrink-0">{room.unreadCount}</span>
                                )}
                              </div>
                              {lastMessage && (
                                <p className="text-[11px] text-gray-500 truncate mt-1">
                                  {lastMessage.sender === "system" ? lastMessage.text : `${lastMessage.sender}: ${messagePreviewText(lastMessage)}`}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {room.depts.map(dept => <Chip key={dept} label={`${dept} 전체`} variant="blue" />)}
                                {room.members.map(memberName => <Chip key={memberName} label={memberName} variant="gray" />)}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-2">
                                참여 {participantCount(room)}명 · {room.createdBy} 만듦 · {room.createdAt}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DesktopShell>

      {modalOpen && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
          <MessageRoomCreateModal onClose={() => setModalOpen(false)} onCreate={createRoom} />
        </div>
      )}
    </div>
  );
}

function MSG01() { return <MessageRoomsScreen />; }
function MSG02() { return <MessageRoomsScreen initialModalOpen />; }

// ─── MSG-03 대화 화면 ─────────────────────────────────────────────────────────

function MSG03() {
  const { messageRooms, setMessageRooms, organizationMemberRoles, currentUser, navigateTo, selectedMessageRoomId, setSelectedMessageRoomId } = React.useContext(AppContext);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [inviteTargets, setInviteTargets] = useState<string[]>([]);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const activeRoomId = selectedMessageRoomId ?? messageRooms[0]?.id ?? null;
  const activeRoom = messageRooms.find(room => room.id === activeRoomId) ?? null;

  // 방을 열면 안 읽음 표시를 지운다.
  useEffect(() => {
    if (!activeRoomId) return;
    setMessageRooms(previous => previous.map(room => room.id === activeRoomId && room.unreadCount > 0 ? { ...room, unreadCount: 0 } : room));
  }, [activeRoomId, setMessageRooms]);

  const participantNames = (room: MessageRoom) => {
    const names = new Set<string>();
    organizationMemberRoles.forEach(member => { if (room.depts.includes(member.dept)) names.add(member.name); });
    room.members.forEach(memberName => names.add(memberName));
    return [...names];
  };

  const pickFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const picked = Array.from(fileList).map(file => ({
      name: file.name,
      size: formatFileSize(file.size),
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setPendingFiles(previous => [...previous, ...picked]);
  };

  const send = () => {
    const text = draft.trim();
    if ((!text && pendingFiles.length === 0) || !activeRoom) return;
    setMessageRooms(previous => previous.map(room => room.id === activeRoom.id ? {
      ...room,
      messages: [...room.messages, {
        id: `m-${room.messages.length}`,
        sender: currentUser.name,
        text,
        at: formatClockTime(new Date()),
        attachments: pendingFiles.length > 0 ? pendingFiles : undefined,
      }],
    } : room));
    setDraft("");
    setPendingFiles([]);
  };

  const appendSystemMessage = (room: MessageRoom, text: string): MessageRoom => ({
    ...room,
    messages: [...room.messages, { id: `m-${room.messages.length}`, sender: "system", text, at: formatClockTime(new Date()) }],
  });

  const inviteMembers = () => {
    if (!activeRoom || inviteTargets.length === 0) return;
    setMessageRooms(previous => previous.map(room => room.id === activeRoom.id
      ? appendSystemMessage({ ...room, members: [...room.members, ...inviteTargets] }, `${inviteTargets.join(", ")}님이 초대되었습니다.`)
      : room));
    setInviteTargets([]);
    setInvitePanelOpen(false);
  };

  // 나가기: 부서 단위로 들어와 있던 경우에도 나갈 수 있도록 부서를 개별 인원으로 펼친 뒤 본인만 제외한다.
  const leaveRoom = () => {
    if (!activeRoom) return;
    const remaining = participantNames(activeRoom).filter(memberName => memberName !== currentUser.name);
    if (remaining.length === 0) {
      setMessageRooms(previous => previous.filter(room => room.id !== activeRoom.id));
    } else {
      setMessageRooms(previous => previous.map(room => room.id === activeRoom.id
        ? appendSystemMessage({ ...room, depts: [], members: remaining }, `${currentUser.name}님이 방을 나갔습니다.`)
        : room));
    }
    setSelectedMessageRoomId(null);
    setLeaveConfirmOpen(false);
    navigateTo("MSG-01");
  };

  if (messageRooms.length === 0) {
    return (
      <DesktopShell activeSidebar="메시지" breadcrumb={["메시지"]} title="대화">
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-5">
              <MessageSquare className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-900">아직 대화할 방이 없습니다</p>
            <p className="text-xs text-gray-500 mt-2">메시지에서 먼저 방을 만들어 주세요.</p>
            <div className="mt-6"><Btn variant="primary" onClick={() => navigateTo("MSG-01")}>메시지로 이동</Btn></div>
          </div>
        </div>
      </DesktopShell>
    );
  }

  return (
    <DesktopShell activeSidebar="메시지" breadcrumb={["메시지"]} title="대화">
      <div className="h-full flex min-h-0">
        {/* 방 목록 */}
        <div className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0 min-h-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <p className="text-xs font-semibold text-gray-700">메시지 방</p>
            <button type="button" onClick={() => navigateTo("MSG-01")} className="text-[10px] text-gray-400 hover:text-blue-600">전체 보기</button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {messageRooms.map(room => {
              const lastMessage = room.messages[room.messages.length - 1];
              const active = room.id === activeRoomId;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setSelectedMessageRoomId(room.id)}
                  className={`w-full text-left px-4 py-3 ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold truncate flex-1 ${active ? "text-blue-800" : "text-gray-900"}`}>{room.name}</p>
                    {room.unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 shrink-0">{room.unreadCount}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{room.scope}</p>
                  {lastMessage && (
                    <p className="text-[10px] text-gray-500 truncate mt-1">
                      {lastMessage.sender === "system" ? lastMessage.text : `${lastMessage.sender}: ${messagePreviewText(lastMessage)}`}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 대화 */}
        {activeRoom && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-gray-50">
            <div className="px-5 py-3 border-b border-gray-200 bg-white shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 truncate">{activeRoom.name}</p>
                    <Chip label={activeRoom.scope} variant={activeRoom.scope === MESSAGE_SCOPE_GENERAL ? "gray" : "blue"} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 truncate">
                    참여 {participantNames(activeRoom).length}명 · {participantNames(activeRoom).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Btn variant="secondary" size="sm" onClick={() => setInvitePanelOpen(true)}><Plus className="w-3 h-3" /> 인원 추가</Btn>
                  <Btn variant="text" size="sm" onClick={() => setLeaveConfirmOpen(true)}>방 나가기</Btn>
                </div>
              </div>

              {/* 인원 추가: 아직 참여하지 않은 구성원만 보여준다 */}
              {invitePanelOpen && (() => {
                const candidates = organizationMemberRoles.filter(member => !participantNames(activeRoom).includes(member.name));
                return (
                  <div className="mt-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-gray-700">인원 추가</p>
                      <button type="button" onClick={() => { setInvitePanelOpen(false); setInviteTargets([]); }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    {candidates.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">추가할 수 있는 구성원이 없습니다. 이미 모두 참여 중입니다.</p>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                          {candidates.map(member => (
                            <label key={member.name} className="flex items-center gap-2.5 py-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={inviteTargets.includes(member.name)}
                                onChange={() => setInviteTargets(previous => previous.includes(member.name) ? previous.filter(item => item !== member.name) : [...previous, member.name])}
                                className="w-3.5 h-3.5 accent-blue-600"
                              />
                              <span className="w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center">{member.name.slice(0, 1)}</span>
                              <span className="text-xs text-gray-800 flex-1">{member.name}</span>
                              <span className="text-[10px] text-gray-400">{member.dept} · {member.role}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-3">
                          <Btn variant="text" size="sm" onClick={() => { setInvitePanelOpen(false); setInviteTargets([]); }}>취소</Btn>
                          <Btn variant="primary" size="sm" disabled={inviteTargets.length === 0} onClick={inviteMembers}>
                            {inviteTargets.length > 0 ? `${inviteTargets.length}명 추가` : "추가"}
                          </Btn>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
              {activeRoom.messages.map(message => {
                if (message.sender === "system") {
                  return (
                    <p key={message.id} className="text-[10px] text-gray-400 text-center py-1">{message.text}</p>
                  );
                }
                const mine = message.sender === currentUser.name;
                return (
                  <div key={message.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine && (
                      <span className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {message.sender.slice(0, 1)}
                      </span>
                    )}
                    <div className={`max-w-[60%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      {!mine && <p className="text-[10px] text-gray-500">{message.sender}</p>}
                      {message.text && (
                        <div className={`rounded-2xl px-3.5 py-2 text-xs leading-5 ${mine ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                          {message.text}
                        </div>
                      )}
                      {message.attachments?.map(file => file.previewUrl ? (
                        <div key={file.name} className="bg-white border border-gray-200 rounded-xl overflow-hidden max-w-[240px]">
                          <img src={file.previewUrl} alt={file.name} className="w-full max-h-48 object-cover" />
                          <div className="px-3 py-2">
                            <p className="text-[11px] font-medium text-gray-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-400">{file.size}</p>
                          </div>
                        </div>
                      ) : (
                        <div key={file.name} className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2.5 max-w-[240px]">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-gray-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-400">{file.size}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{message.at}</span>
                  </div>
                );
              })}
              {activeRoom.messages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-10">아직 주고받은 메시지가 없습니다.</p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-white shrink-0 flex flex-col gap-2">
              {/* 보내기 전 첨부 목록 */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingFiles.map((file, index) => (
                    <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg pl-1.5 pr-1.5 py-1.5">
                      {file.previewUrl
                        ? <img src={file.previewUrl} alt={file.name} className="w-6 h-6 rounded object-cover shrink-0" />
                        : <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                      <span className="text-[11px] text-gray-700 max-w-[160px] truncate">{file.name}</span>
                      <span className="text-[10px] text-gray-400">{file.size}</span>
                      <button
                        type="button"
                        onClick={() => setPendingFiles(previous => previous.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-gray-400 hover:text-gray-600 rounded p-0.5"
                        title="첨부 빼기"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={event => { pickFiles(event.target.files); event.target.value = ""; }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="파일 첨부"
                  className="w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => { if (event.key === "Enter") send(); }}
                  placeholder="메시지를 입력하세요"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400"
                />
                <Btn variant="primary" disabled={!draft.trim() && pendingFiles.length === 0} onClick={send}>보내기</Btn>
              </div>
              <p className="text-[10px] text-gray-400">첨부는 대화 공유용입니다. 정산 증빙은 재정 화면에 등록해 주세요.</p>
            </div>
          </div>
        )}
      </div>

      {leaveConfirmOpen && activeRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[380px] p-6">
            <p className="text-sm font-bold text-gray-900">방을 나가시겠습니까?</p>
            <p className="text-xs text-gray-500 mt-2 leading-6">
              {participantNames(activeRoom).filter(name => name !== currentUser.name).length === 0
                ? <>남은 참여자가 없어 <span className="font-semibold text-gray-700">{activeRoom.name}</span> 방이 삭제됩니다. 주고받은 메시지도 함께 사라집니다.</>
                : <><span className="font-semibold text-gray-700">{activeRoom.name}</span> 방에서 나가면 이후 대화를 볼 수 없습니다. 남은 참여자에게는 나갔다는 안내가 표시됩니다.</>}
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <Btn variant="text" size="sm" onClick={() => setLeaveConfirmOpen(false)}>취소</Btn>
              <Btn variant="destructive" size="sm" onClick={leaveRoom}>나가기</Btn>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );
}

// ─── Screen Registry ──────────────────────────────────────────────────────────

export const SCREEN_COMPONENTS: Record<string, React.ComponentType> = {
  "HOME-01": HOME01,
  "HOME-01K": HOME01K,
  "FIN-00B": FIN00B,
  "MSG-01": MSG01,
  "MSG-02": MSG02,
  "MSG-03": MSG03,
  "OPS-00": OPS00,
  "ORG-00": ORG00,
  "ONB-01": ONB01,
  "ONB-02": ONB02,
  "INV-00": ONB03,
  "ORG-01": ORG01,
  "ORG-02": ORG02,
  "INV-01": INV01,
  "ORG-03A": ORG03A,
  "ORG-03B": () => <AsPresident><ORG03B /></AsPresident>,
  "ORG-03C": ORG03CWithDialog,
  "ORG-07A": () => <AsPresident><ORG07WithModal which={null} /></AsPresident>,
  "ORG-07B": () => <AsPresident><ORG07WithModal which="B" /></AsPresident>,
  "ORG-07C": () => <AsFinanceManager><ORG07WithModal which="C" /></AsFinanceManager>,
  "ORG-04": ORG04,
  "ORG-04B": () => <AsPresident><ORG04B /></AsPresident>,
  "EVT-00A": EVT00A,
  "EVT-00A2": EVT00A2,
  "EVT-00B": EVT00B,
  "EVT-01": () => <AsEventManager><EVT01 /></AsEventManager>,
  "EVT-02": EVT02,
  "EVT-02B": () => <AsEventManager><EVT02B /></AsEventManager>,
  "EVT-02C": EVT02C,
  "EVT-02D": EVT02D,
  "EVT-02E": EVT02E,
  "EVT-03C": EVT03C,
  "EVT-04C": EVT04C,
  "EVT-03A": EVT03A,
  "EVT-03B": () => <AsEventManager><EVT03B /></AsEventManager>,
  "EVT-04": () => <AsEventManager><EVT04WithQR /></AsEventManager>,
  "EVT-04B": () => {
    const [open, setOpen] = useState(true);
    return (
      <AsEventManager>
        <div className="relative h-full">
          <EVT04 onOpenQR={() => setOpen(true)} />
          {open && <EVT04B onClose={() => setOpen(false)} />}
        </div>
      </AsEventManager>
    );
  },
  "EVT-05": () => <AsEventManager><EVT05 /></AsEventManager>,
  "EVT-05B": () => <AsEventManager><EVT05B /></AsEventManager>,
  "EVT-MEET-01": EVTMEET01,
  "EVT-SCHED-01": EVTSCHED01,
  "EVT-DOC-01": EVTDOC01,
  "REC-01": REC01,
  "REC-02": REC02,
  "REC-02A": REC02A,
  "FIN-00": FIN00,
  "MY-01": MY01,
  "MY-REQ-01": MYREQ01,
  "EVT-FIN-01": EVTFIN01,
  "EVT-FIN-01B": () => <AsFinanceManager><EVTFIN01 /></AsFinanceManager>,
  "FIN-REQ-01B": () => <AsPromotionDepartmentHead><FINREQ01 /></AsPromotionDepartmentHead>,
  "FIN-REQ-02": FINREQ02,
  "FIN-SUP-01B": () => <AsPromotionDepartmentHead><FINSUP01 /></AsPromotionDepartmentHead>,
  "FIN-REV-01": FINREV01,
  "FIN-REV-01B": () => <AsFinanceRecheck><FINREV01 /></AsFinanceRecheck>,
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
  "OPS-MEET-01D": OPSMEET01D,
  "OPS-MEET-02": OPSMEET02,
  "OPS-MEET-03A": OPSMEET03A,
  "OPS-MEET-03B": OPSMEET03B,
  "OPS-MEET-03C": OPSMEET03C,
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
  // 검토용: 현재 사용자의 행사 맥락 역할. 화면을 덮어쓰지 않고 앱 수준에서 한 번만 바꾼다.
  const [reviewEventRole, setReviewEventRole] = useState<EventContextRole | "none">("none");
  const [specMode, setSpecMode] = useState(false);
  // 행사별로 분리된 단일 기준. eventInfo·eventLifecycle·eventTasks·surveySettings는
  // 여기서 파생하며, 별도 중복 상태로 두지 않아 서로 어긋나지 않게 한다.
  const [eventRecords, setEventRecords] = useState<EventRecord[]>(DEFAULT_EVENT_RECORDS);
  const [selectedEventId, setSelectedEventId] = useState<string>(SPORTS_EVENT_ID);
  const selectedEvent = eventRecords.find(record => record.id === selectedEventId) ?? eventRecords[0];
  const eventInfo = selectedEvent.info;
  const eventLifecycle = selectedEvent.lifecycle;
  const surveySettings = selectedEvent.surveySettings;
  const eventOrganization = selectedEvent.organization;
  const eventTasks = selectedEvent.tasks;
  // 선택된 행사 레코드의 한 조각만 갱신하는 래퍼. 기존 setter API(SetStateAction)를 그대로 유지한다.
  const patchSelectedEvent = <K extends keyof EventRecord>(key: K) =>
    (value: EventRecord[K] | ((prev: EventRecord[K]) => EventRecord[K])) =>
      setEventRecords(records => records.map(record => record.id === selectedEventId
        ? { ...record, [key]: typeof value === "function" ? (value as (prev: EventRecord[K]) => EventRecord[K])(record[key]) : value }
        : record));
  const setEventInfo = patchSelectedEvent("info") as React.Dispatch<React.SetStateAction<EventInfo>>;
  const setEventLifecycle = patchSelectedEvent("lifecycle") as React.Dispatch<React.SetStateAction<EventLifecycle>>;
  const setSurveySettings = patchSelectedEvent("surveySettings") as React.Dispatch<React.SetStateAction<SurveySettings>>;
  const setEventOrganization = patchSelectedEvent("organization") as React.Dispatch<React.SetStateAction<EventOrganization | undefined>>;
  const setEventTasks = patchSelectedEvent("tasks") as React.Dispatch<React.SetStateAction<EventTask[]>>;
  const [eventWorkspaceFilter, setEventWorkspaceFilter] = useState<EventWorkspaceFilter>(null);
  const [calendarFocus, setCalendarFocus] = useState<CalendarFocus>(null);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>(DEFAULT_RECURRING_TASKS);
  const [createdMeetings, setCreatedMeetings] = useState<CreatedMeeting[]>([]);
  const [selectedCreatedMeetingId, setSelectedCreatedMeetingId] = useState<string | null>(null);
  const [meetingJoinAsNonParticipant, setMeetingJoinAsNonParticipant] = useState(false);
  const [selectedRecurringTaskId, setSelectedRecurringTaskId] = useState<string | null>(null);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [archives, setArchives] = useState<ArchiveRecord[]>(DEFAULT_ARCHIVES);
  const [evidenceBundles, setEvidenceBundles] = useState<EvidenceBundle[]>(DEFAULT_EVIDENCE_BUNDLES);
  const [evidenceDrafts, setEvidenceDrafts] = useState<EvidenceDraft[]>([]);
  const [selectedEventTaskId, setSelectedEventTaskId] = useState<string | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>(DEFAULT_PURCHASE_REQUESTS);
  const [selectedPurchaseRequestId, setSelectedPurchaseRequestId] = useState<string | null>("REQ-001");
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft | null>(() => loadDraft<MeetingDraft>(DRAFT_STORAGE_KEYS.meeting));
  const [purchaseRequestDraft, setPurchaseRequestDraft] = useState<PurchaseRequestDraft | null>(() => loadDraft<PurchaseRequestDraft>(DRAFT_STORAGE_KEYS.purchaseRequest));
  const [purchaseSupplementDraft, setPurchaseSupplementDraft] = useState<PurchaseSupplementDraft | null>(() => loadDraft<PurchaseSupplementDraft>(DRAFT_STORAGE_KEYS.purchaseSupplement));
  const [organizationMemberRoles, setOrganizationMemberRoles] = useState<OrganizationMemberRole[]>(DEFAULT_ORGANIZATION_MEMBER_ROLES);
  const [demoDataMode, setDemoDataMode] = useState<DemoDataMode>("default");
  const [messageRooms, setMessageRooms] = useState<MessageRoom[]>([]);
  const [selectedMessageRoomId, setSelectedMessageRoomId] = useState<string | null>(null);

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
      eventOrganization, setEventOrganization,
      eventTasks, setEventTasks,
      recurringTasks, setRecurringTasks,
      createdMeetings, setCreatedMeetings,
      eventRecords, setEventRecords,
      selectedEventId, setSelectedEventId,
      selectedCreatedMeetingId, setSelectedCreatedMeetingId,
      meetingJoinAsNonParticipant, setMeetingJoinAsNonParticipant,
      selectedRecurringTaskId, setSelectedRecurringTaskId,
      selectedArchiveId, setSelectedArchiveId,
      archives, setArchives,
      evidenceBundles, setEvidenceBundles,
      evidenceDrafts, setEvidenceDrafts,
      selectedEventTaskId, setSelectedEventTaskId,
      purchaseRequests, setPurchaseRequests,
      selectedPurchaseRequestId, setSelectedPurchaseRequestId,
      meetingDraft, setMeetingDraft,
      purchaseRequestDraft, setPurchaseRequestDraft,
      purchaseSupplementDraft, setPurchaseSupplementDraft,
      organizationMemberRoles, setOrganizationMemberRoles,
      messageRooms, setMessageRooms,
      selectedMessageRoomId, setSelectedMessageRoomId,
      demoDataMode, setDemoDataMode,
      navigateTo: setActiveScreen,
      currentUser: { name: "박해랑", dept: "운영부", role: organizationMemberRoles.find(member => member.name === "박해랑")?.role ?? "부원", eventRole: reviewEventRole === "none" ? undefined : reviewEventRole },
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
            {/* 검토용: 현재 사용자(박해랑)의 행사 맥락 역할만 바꾼다. 이름·부서·기본 역할은 그대로다. */}
            <select
              aria-label="검토용 행사 맥락 역할"
              value={reviewEventRole}
              onChange={event => setReviewEventRole(event.target.value as EventContextRole | "none")}
              className="text-xs px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-500 focus:outline-none"
            >
              <option value="none">행사 역할: 없음</option>
              <option value="행사 운영 조직 관리자">행사 역할: 운영 조직 관리자</option>
              <option value="행사 운영 조직 구성원">행사 역할: 운영 조직 구성원</option>
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
