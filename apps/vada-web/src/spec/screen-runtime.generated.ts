// 자동 생성: npm run generate:screen-runtime. 직접 수정하지 않는다.
import type { QueryParams, ScreenSpec } from './types'

export interface RuntimeSourceReference {
  dataSourceKey: string
  params?: QueryParams
}

export interface RuntimeScreenSpec {
  screenId: string
  drawable: boolean
  stateScopeKey?: string
  viewer?: ScreenSpec['viewer']
  workspace?: { key: string }
  meta?: { eyebrow?: string | null; title: string }
  sourceReferences: readonly RuntimeSourceReference[]
}

export const SCREEN_RUNTIME = [
  {
    "screenId": "EVT-00A",
    "drawable": true,
    "meta": {
      "eyebrow": "운영 · 행사",
      "title": "행사"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.list",
        "params": {
          "query": {
            "fieldKey": "eventQuery"
          },
          "status": {
            "fieldKey": "eventStatus"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-00A2",
    "drawable": true,
    "meta": {
      "eyebrow": "운영 · 행사",
      "title": "행사"
    },
    "sourceReferences": []
  },
  {
    "screenId": "EVT-00B",
    "drawable": true,
    "stateScopeKey": "eventCreateDraft",
    "meta": {
      "eyebrow": null,
      "title": "새 행사 만들기"
    },
    "sourceReferences": []
  },
  {
    "screenId": "EVT-01",
    "drawable": true,
    "stateScopeKey": "eventStaffSetupDraft",
    "meta": {
      "title": "행사 운영 조직 설정"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.summary",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.staffSetupPreview",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "setupMode": {
            "fieldKey": "setupMode"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-02",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사",
      "title": "행사 개요"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.overviewBriefing",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.overviewHighlights",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.basics",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.recruitSettings",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.participantStats",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.checklist",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.recentChanges",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-02B",
    "drawable": true,
    "stateScopeKey": "eventBasicsDraft",
    "meta": {
      "eyebrow": null,
      "title": "행사 기본정보 수정"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.basicsDraft",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-02C",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "행사 종료 확인"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.endPermission",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-02D",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사",
      "title": "행사 개요"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.wrapUpBanner",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.wrapUpCounts",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.basics",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.wrapUpRemaining",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.recentChanges",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-02E",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "아직 정리되지 않은 항목이 있습니다"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.completeConfirm",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-03A",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사 · 인원 관리",
      "title": "운영 조직"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.staffLeaders",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.staffDepartments",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-03B",
    "drawable": true,
    "stateScopeKey": "eventStaffEditDraft",
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사 · 인원 관리",
      "title": "운영 조직 — 수정"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.staffLeaders",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.staffDepartments",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.staffUnassignedMembers",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-03C",
    "drawable": false,
    "meta": {
      "eyebrow": "운영 · 행사 · 인원 관리",
      "title": "운영 조직"
    },
    "sourceReferences": []
  },
  {
    "screenId": "EVT-04",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사 · 인원 관리",
      "title": "행사 참가자"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.participants",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "query": {
            "fieldKey": "participantQuery"
          },
          "affiliation": {
            "fieldKey": "participantAffiliation"
          },
          "applyStatus": {
            "fieldKey": "participantApplyStatus"
          },
          "payStatus": {
            "fieldKey": "participantPayStatus"
          },
          "attendStatus": {
            "fieldKey": "participantAttendStatus"
          }
        }
      },
      {
        "dataSourceKey": "event.participantPaging",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "query": {
            "fieldKey": "participantQuery"
          },
          "affiliation": {
            "fieldKey": "participantAffiliation"
          },
          "applyStatus": {
            "fieldKey": "participantApplyStatus"
          },
          "payStatus": {
            "fieldKey": "participantPayStatus"
          },
          "attendStatus": {
            "fieldKey": "participantAttendStatus"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-04B",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "참석 확인 QR"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.attendanceQr",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-04C",
    "drawable": false,
    "meta": {
      "eyebrow": "운영 · 행사 · 인원 관리",
      "title": "행사 참가자"
    },
    "sourceReferences": []
  },
  {
    "screenId": "EVT-05",
    "drawable": true,
    "stateScopeKey": "eventSurveyDraft",
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": null,
      "title": "참여 설문 생성·관리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.summary",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.surveySettingsDraft",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.survey",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.surveyActivation",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.basics",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.surveyActivationConditions",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.surveyQuestions",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-05B",
    "drawable": true,
    "stateScopeKey": "eventSurveyReplaceDraft",
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": null,
      "title": "참여 설문 생성·관리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.summary",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.survey",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.surveyReplaceImpact",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-DOC-01",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사 · 문서",
      "title": "행사 문서"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.documentStats",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.documentStatusCounts",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.documents",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "status": {
            "fieldKey": "documentStatus"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-FIN-01",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사 · 재정",
      "title": "행사 재정 — 개요"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.financeSummary",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.financeAlerts",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.financeBoard",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "stage": {
            "value": "review"
          }
        }
      },
      {
        "dataSourceKey": "event.financeBoard",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "stage": {
            "value": "purchase"
          }
        }
      },
      {
        "dataSourceKey": "event.financeBoard",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "stage": {
            "value": "proof"
          }
        }
      },
      {
        "dataSourceKey": "event.financeBoard",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "stage": {
            "value": "settled"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-MEET-01",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사 · 회의",
      "title": "행사 관련 회의"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.meetingCounts",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.meetings",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-SCHED-01",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사 · 일정",
      "title": "행사 일정"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.schedule",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "filter": {
            "fieldKey": "scheduleFilter"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-TASK-01",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": "운영 · 행사 · 업무",
      "title": "행사 업무 — 칸반 보드"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.summary",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.taskAlerts",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.taskBoard",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "scope": {
            "fieldKey": "taskScope"
          },
          "status": {
            "value": "planned"
          }
        }
      },
      {
        "dataSourceKey": "event.taskBoard",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "scope": {
            "fieldKey": "taskScope"
          },
          "status": {
            "value": "inProgress"
          }
        }
      },
      {
        "dataSourceKey": "event.taskBoard",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "scope": {
            "fieldKey": "taskScope"
          },
          "status": {
            "value": "review"
          }
        }
      },
      {
        "dataSourceKey": "event.taskBoard",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "scope": {
            "fieldKey": "taskScope"
          },
          "status": {
            "value": "done"
          }
        }
      }
    ]
  },
  {
    "screenId": "EVT-TASK-02",
    "drawable": true,
    "meta": {
      "eyebrow": "운영 · 행사 · 업무",
      "title": "업무 상세 — 관련 문서·결과물"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "task.detail",
        "params": {
          "taskId": {
            "screenParam": "taskId"
          }
        }
      },
      {
        "dataSourceKey": "task.referenceDocuments",
        "params": {
          "taskId": {
            "screenParam": "taskId"
          }
        }
      },
      {
        "dataSourceKey": "task.workDocuments",
        "params": {
          "taskId": {
            "screenParam": "taskId"
          }
        }
      },
      {
        "dataSourceKey": "task.reviewStatus",
        "params": {
          "taskId": {
            "screenParam": "taskId"
          }
        }
      }
    ]
  },
  {
    "screenId": "EXT-01A",
    "drawable": true,
    "stateScopeKey": "attendanceCheckInDraft",
    "viewer": "external",
    "meta": {
      "title": "참석 확인"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "attendance.checkInForm",
        "params": {
          "checkInToken": {
            "screenParam": "checkInToken"
          }
        }
      }
    ]
  },
  {
    "screenId": "EXT-01B",
    "drawable": true,
    "viewer": "external",
    "meta": {
      "title": "참석 확인 결과"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "attendance.checkInResult",
        "params": {
          "receiptToken": {
            "screenParam": "receiptToken"
          }
        }
      }
    ]
  },
  {
    "screenId": "EXT-02A",
    "drawable": true,
    "stateScopeKey": "surveyApplyDraft",
    "viewer": "external",
    "meta": {
      "eyebrow": null,
      "title": "참여 신청"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "survey.applyForm",
        "params": {
          "surveyToken": {
            "screenParam": "surveyToken"
          }
        }
      }
    ]
  },
  {
    "screenId": "EXT-02B",
    "drawable": true,
    "viewer": "external",
    "meta": {
      "eyebrow": null,
      "title": "참여 신청 완료"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "survey.applyResult",
        "params": {
          "receiptToken": {
            "screenParam": "receiptToken"
          }
        }
      }
    ]
  },
  {
    "screenId": "EXT-02C",
    "drawable": true,
    "viewer": "external",
    "meta": {
      "eyebrow": null,
      "title": "설문 예외·종료 상태"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "survey.linkState",
        "params": {
          "surveyToken": {
            "screenParam": "surveyToken"
          }
        }
      }
    ]
  },
  {
    "screenId": "FIN-00",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "전체 재정 현황"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.orgOverview"
      },
      {
        "dataSourceKey": "finance.orgBreakdown",
        "params": {
          "scope": {
            "fieldKey": "breakdownScope"
          }
        }
      },
      {
        "dataSourceKey": "finance.recentExpenses"
      },
      {
        "dataSourceKey": "finance.proofSummary"
      }
    ]
  },
  {
    "screenId": "FIN-00B",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "전체 재정 현황"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.orgOverview"
      }
    ]
  },
  {
    "screenId": "FIN-EVID-01",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "결제·증빙 정리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.paymentEvidenceSummary",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      },
      {
        "dataSourceKey": "finance.paymentEvidences",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      }
    ]
  },
  {
    "screenId": "FIN-LEDGER-01",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "사용 내역"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.ledgerSummary",
        "params": {
          "month": {
            "fieldKey": "ledgerMonth"
          }
        }
      },
      {
        "dataSourceKey": "finance.ledger",
        "params": {
          "month": {
            "fieldKey": "ledgerMonth"
          },
          "eventId": {
            "fieldKey": "ledgerEvent"
          },
          "departmentId": {
            "fieldKey": "ledgerDepartment"
          },
          "budgetItemId": {
            "fieldKey": "ledgerBudgetItem"
          },
          "query": {
            "fieldKey": "ledgerQuery"
          },
          "stage": {
            "screenParam": "stage"
          }
        }
      },
      {
        "dataSourceKey": "finance.ledgerScope",
        "params": {
          "month": {
            "fieldKey": "ledgerMonth"
          },
          "eventId": {
            "fieldKey": "ledgerEvent"
          },
          "departmentId": {
            "fieldKey": "ledgerDepartment"
          },
          "budgetItemId": {
            "fieldKey": "ledgerBudgetItem"
          },
          "query": {
            "fieldKey": "ledgerQuery"
          },
          "stage": {
            "screenParam": "stage"
          }
        }
      }
    ]
  },
  {
    "screenId": "FIN-PLAN-01",
    "drawable": true,
    "stateScopeKey": "budgetPlanDraft",
    "meta": {
      "eyebrow": null,
      "title": "예산 편성"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.budgetPlanDraft",
        "params": {}
      }
    ]
  },
  {
    "screenId": "FIN-PROC-01",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "구매·발주 처리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.purchaseOrderSummary",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      },
      {
        "dataSourceKey": "finance.purchaseOrders",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      }
    ]
  },
  {
    "screenId": "FIN-REQ-01",
    "drawable": true,
    "stateScopeKey": "purchaseRequestDraft",
    "meta": {
      "eyebrow": null,
      "title": "구매 요청 작성·수정"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.purchaseRequestDraft",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          },
          "requestId": {
            "screenParam": "requestId"
          }
        }
      }
    ]
  },
  {
    "screenId": "FIN-REQ-02",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "구매 요청 상세·진행 상태"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.purchaseRequestDetail",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      },
      {
        "dataSourceKey": "finance.purchaseRequestItems",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      },
      {
        "dataSourceKey": "finance.purchaseRequestHistory",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      }
    ]
  },
  {
    "screenId": "FIN-REV-01",
    "drawable": true,
    "stateScopeKey": "purchaseRequestReview",
    "meta": {
      "eyebrow": null,
      "title": "구매 요청 검토"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.reviewSummary",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      },
      {
        "dataSourceKey": "finance.reviewItems",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      }
    ]
  },
  {
    "screenId": "FIN-SUP-01",
    "drawable": true,
    "stateScopeKey": "purchaseRequestSupplement",
    "meta": {
      "eyebrow": null,
      "title": "보완 요청 확인·재제출"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "finance.purchaseRequestDetail",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      },
      {
        "dataSourceKey": "finance.supplementRequest",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      },
      {
        "dataSourceKey": "finance.supplementItems",
        "params": {
          "requestId": {
            "screenParam": "requestId"
          }
        }
      },
      {
        "dataSourceKey": "finance.supplementInputFields",
        "params": {
          "itemId": {
            "itemField": "id"
          }
        }
      },
      {
        "dataSourceKey": "finance.supplementAttachments",
        "params": {
          "itemId": {
            "itemField": "id"
          }
        }
      }
    ]
  },
  {
    "screenId": "HOME-01K",
    "drawable": true,
    "meta": {
      "title": "홈"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "home.briefing"
      },
      {
        "dataSourceKey": "home.briefingNotices"
      },
      {
        "dataSourceKey": "home.eventCounts"
      },
      {
        "dataSourceKey": "home.events"
      },
      {
        "dataSourceKey": "home.schedules"
      },
      {
        "dataSourceKey": "home.orgAlerts"
      },
      {
        "dataSourceKey": "home.financeSummary"
      },
      {
        "dataSourceKey": "my.taskAlerts"
      }
    ]
  },
  {
    "screenId": "INV-00",
    "drawable": true,
    "stateScopeKey": "onboardingDraft",
    "viewer": "joining",
    "meta": {
      "title": "초대 코드를 입력해 주세요"
    },
    "sourceReferences": []
  },
  {
    "screenId": "INV-01",
    "drawable": true,
    "stateScopeKey": "onboardingDraft",
    "viewer": "joining",
    "meta": {
      "title": "초대받은 학생회 확인"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.invitedOrganization",
        "params": {
          "inviteCode": {
            "screenParam": "inviteCode"
          }
        }
      }
    ]
  },
  {
    "screenId": "MSG-01",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "메시지"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "message.rooms"
      }
    ]
  },
  {
    "screenId": "MSG-02",
    "drawable": true,
    "stateScopeKey": "messageRoomDraft",
    "meta": {
      "eyebrow": null,
      "title": "새 메시지 방 만들기"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.departments",
        "params": {
          "query": {
            "fieldKey": "memberQuery"
          }
        }
      }
    ]
  },
  {
    "screenId": "MSG-03",
    "drawable": true,
    "meta": {
      "eyebrow": "메시지",
      "title": "대화"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "message.conversation",
        "params": {
          "roomId": {
            "screenParam": "roomId"
          }
        }
      }
    ]
  },
  {
    "screenId": "MY-01",
    "drawable": true,
    "meta": {
      "eyebrow": "내 업무",
      "title": "내 업무"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "my.taskAlerts"
      },
      {
        "dataSourceKey": "my.taskTabCounts"
      },
      {
        "dataSourceKey": "my.tasks",
        "params": {
          "tab": {
            "fieldKey": "taskTab"
          },
          "query": {
            "fieldKey": "taskQuery"
          }
        }
      }
    ]
  },
  {
    "screenId": "MY-INFO-01",
    "drawable": true,
    "stateScopeKey": "myProfileDraft",
    "meta": {
      "eyebrow": "내 정보",
      "title": "내 정보"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "my.belonging"
      },
      {
        "dataSourceKey": "my.profile"
      }
    ]
  },
  {
    "screenId": "MY-REQ-01",
    "drawable": true,
    "workspace": {
      "key": "event"
    },
    "meta": {
      "eyebrow": null,
      "title": "내 구매 요청 — 행사 재정"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "event.summary",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.myPurchaseRequestSummary",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "event.myPurchaseRequests",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "ONB-01",
    "drawable": true,
    "stateScopeKey": "onboardingDraft",
    "viewer": "joining",
    "meta": {
      "title": "내 프로필에 표시될 학적 정보를 입력해 주세요"
    },
    "sourceReferences": []
  },
  {
    "screenId": "ONB-02",
    "drawable": true,
    "viewer": "joining",
    "meta": {
      "title": "어떻게 시작하시겠어요?"
    },
    "sourceReferences": []
  },
  {
    "screenId": "OPS-00",
    "drawable": true,
    "meta": {
      "eyebrow": "운영",
      "title": "운영"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "ops.intro"
      },
      {
        "dataSourceKey": "ops.spaceStats"
      }
    ]
  },
  {
    "screenId": "OPS-CAL-01",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "캘린더"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "ops.calendarMonth"
      },
      {
        "dataSourceKey": "ops.calendarDays",
        "params": {
          "type": {
            "fieldKey": "calendarType"
          }
        }
      },
      {
        "dataSourceKey": "ops.calendarWeekRange"
      },
      {
        "dataSourceKey": "ops.calendarWeek",
        "params": {
          "type": {
            "fieldKey": "calendarType"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-01A",
    "drawable": true,
    "meta": {
      "eyebrow": "운영",
      "title": "회의"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.attention"
      },
      {
        "dataSourceKey": "meeting.groups",
        "params": {
          "query": {
            "fieldKey": "meetingQuery"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-01B",
    "drawable": false,
    "meta": {
      "eyebrow": "운영",
      "title": "회의"
    },
    "sourceReferences": []
  },
  {
    "screenId": "OPS-MEET-01C",
    "drawable": true,
    "meta": {
      "eyebrow": "운영",
      "title": "회의"
    },
    "sourceReferences": []
  },
  {
    "screenId": "OPS-MEET-01D",
    "drawable": false,
    "meta": {
      "eyebrow": "운영",
      "title": "회의"
    },
    "sourceReferences": []
  },
  {
    "screenId": "OPS-MEET-02",
    "drawable": true,
    "stateScopeKey": "meetingDraft",
    "meta": {
      "eyebrow": null,
      "title": "새 회의 만들기"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.draft",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.memberCandidates",
        "params": {
          "query": {
            "fieldKey": "memberQuery"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-03A",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "예정 회의 상세"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.agendas",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.documents",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.participants",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-03B",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "예정 회의 관리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-03C",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "예정 회의 상세"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-04B",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "회의 진행 권한 관리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.permissionNotice",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.hostOwner",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.participants",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          },
          "query": {
            "fieldKey": "memberQuery"
          },
          "excludeHostOwner": {
            "value": "true"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-05A",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "진행 중 회의"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.agendas",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.documents",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.followUps",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.participants",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-05B",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "진행 중 회의 — 진행 권한자"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-06A",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "정리 중 회의"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.minutes",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.agendas",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.minutesStatus",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-06B",
    "drawable": true,
    "stateScopeKey": "meetingMinutesDraft",
    "meta": {
      "eyebrow": null,
      "title": "회의록 정리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.minutesProgress",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.minutes",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.agendas",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.followUps",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-07",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "완료된 회의록"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.minutes",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.agendas",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.followUps",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.participants",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.documents",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-08",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "회의 요약 확인"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      },
      {
        "dataSourceKey": "meeting.myFollowUps",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-09",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "취소된 회의 상세"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.detail",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-D01",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "회의를 시작할까요?"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.startConfirm",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-D02",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "회의를 종료할까요?"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.endConfirm",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-D03",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "진행 권한 부여 확인"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "meeting.hostGrantConfirm",
        "params": {
          "meetingId": {
            "screenParam": "meetingId"
          },
          "memberId": {
            "screenParam": "memberId"
          }
        }
      }
    ]
  },
  {
    "screenId": "OPS-MEET-D04",
    "drawable": true,
    "stateScopeKey": "meetingCancelDraft",
    "meta": {
      "eyebrow": null,
      "title": "회의를 취소할까요?"
    },
    "sourceReferences": []
  },
  {
    "screenId": "ORG-00",
    "drawable": true,
    "meta": {
      "eyebrow": "조직 관리",
      "title": "조직 관리 홈"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.areaSummaries"
      }
    ]
  },
  {
    "screenId": "ORG-01",
    "drawable": true,
    "stateScopeKey": "orgCreationDraft",
    "viewer": "joining",
    "meta": {
      "eyebrow": "새 학생회 만들기",
      "title": "학생회 기본 정보"
    },
    "sourceReferences": []
  },
  {
    "screenId": "ORG-02",
    "drawable": true,
    "stateScopeKey": "orgCreationDraft",
    "viewer": "joining",
    "meta": {
      "eyebrow": "새 학생회 만들기",
      "title": "조직 구조 설정"
    },
    "sourceReferences": []
  },
  {
    "screenId": "ORG-03A",
    "drawable": true,
    "meta": {
      "eyebrow": "조직 관리",
      "title": "조직 관리 — 보기"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.chartTitle"
      },
      {
        "dataSourceKey": "org.executives"
      },
      {
        "dataSourceKey": "org.departments"
      }
    ]
  },
  {
    "screenId": "ORG-03B",
    "drawable": true,
    "stateScopeKey": "orgEditDraft",
    "meta": {
      "eyebrow": "조직 관리",
      "title": "조직 관리 — 수정"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.chartTitle"
      },
      {
        "dataSourceKey": "org.executives"
      },
      {
        "dataSourceKey": "org.departments"
      },
      {
        "dataSourceKey": "org.unassignedHint"
      },
      {
        "dataSourceKey": "org.unassignedMembers",
        "params": {
          "query": {
            "fieldKey": "memberQuery"
          }
        }
      }
    ]
  },
  {
    "screenId": "ORG-03C",
    "drawable": true,
    "meta": {
      "eyebrow": "조직 관리",
      "title": "구성원 초대 패널"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.chartTitle"
      },
      {
        "dataSourceKey": "org.executives"
      },
      {
        "dataSourceKey": "org.departments"
      },
      {
        "dataSourceKey": "org.invite"
      }
    ]
  },
  {
    "screenId": "ORG-03D",
    "drawable": true,
    "stateScopeKey": "orgEditDraft",
    "meta": {
      "eyebrow": null,
      "title": "구성원 내보내기 확인"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.memberToRemove",
        "params": {
          "memberId": {
            "screenParam": "memberId"
          }
        }
      }
    ]
  },
  {
    "screenId": "ORG-04",
    "drawable": true,
    "meta": {
      "eyebrow": "조직 관리",
      "title": "역할 및 권한"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.roleCounts"
      },
      {
        "dataSourceKey": "org.permissionMatrix"
      }
    ]
  },
  {
    "screenId": "ORG-04B",
    "drawable": true,
    "stateScopeKey": "roleChangeDraft",
    "meta": {
      "eyebrow": "조직 관리",
      "title": "역할 및 권한 관리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.roleAssignments"
      },
      {
        "dataSourceKey": "org.roleAssignmentCount"
      },
      {
        "dataSourceKey": "org.selectedRoleAssignment",
        "params": {
          "memberId": {
            "fieldKey": "selectedMemberId"
          }
        }
      }
    ]
  },
  {
    "screenId": "ORG-07A",
    "drawable": true,
    "meta": {
      "eyebrow": "조직 관리",
      "title": "학생 명단 관리"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.rosterScope"
      },
      {
        "dataSourceKey": "org.students",
        "params": {
          "query": {
            "fieldKey": "studentQuery"
          },
          "grade": {
            "fieldKey": "studentGrade"
          },
          "duesStatus": {
            "fieldKey": "studentDues"
          }
        }
      },
      {
        "dataSourceKey": "org.studentPaging",
        "params": {
          "query": {
            "fieldKey": "studentQuery"
          },
          "grade": {
            "fieldKey": "studentGrade"
          },
          "duesStatus": {
            "fieldKey": "studentDues"
          }
        }
      }
    ]
  },
  {
    "screenId": "ORG-07B",
    "drawable": true,
    "meta": {
      "eyebrow": "조직 관리",
      "title": "학생 명단 업로드·갱신"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "org.rosterScope"
      }
    ]
  },
  {
    "screenId": "ORG-07C",
    "drawable": true,
    "meta": {
      "eyebrow": "조직 관리",
      "title": "학생회비 납부 명단 업로드"
    },
    "sourceReferences": []
  },
  {
    "screenId": "REC-01",
    "drawable": true,
    "meta": {
      "eyebrow": null,
      "title": "완료된 행사"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "record.completedEventAlert"
      },
      {
        "dataSourceKey": "record.completedEvents",
        "params": {
          "query": {
            "fieldKey": "eventQuery"
          }
        }
      }
    ]
  },
  {
    "screenId": "REC-02",
    "drawable": true,
    "stateScopeKey": "archiveChecklistDraft",
    "meta": {
      "eyebrow": null,
      "title": "행사 아카이브"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "record.archive",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveSections",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveDetail",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveTimeline",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveEvidence",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveRetro",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveHandover",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveChecklist",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "REC-02A",
    "drawable": true,
    "stateScopeKey": "archiveDraft",
    "meta": {
      "eyebrow": null,
      "title": "아카이브 작성·검토"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "record.archive",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveDraft",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveGate",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveSections",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveAutoFilled",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveGateConditions",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      },
      {
        "dataSourceKey": "record.archiveReview",
        "params": {
          "eventId": {
            "screenParam": "eventId"
          }
        }
      }
    ]
  },
  {
    "screenId": "SIGN-IN",
    "drawable": true,
    "viewer": "external",
    "meta": {
      "title": "어떤 계정으로 시작할까요?"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "auth.ways"
      }
    ]
  },
  {
    "screenId": "TASK-01",
    "drawable": true,
    "meta": {
      "eyebrow": "운영 · 상시 업무",
      "title": "상시 업무"
    },
    "sourceReferences": [
      {
        "dataSourceKey": "task.alerts"
      },
      {
        "dataSourceKey": "task.board",
        "params": {
          "scope": {
            "fieldKey": "taskScope"
          },
          "status": {
            "value": "planned"
          }
        }
      },
      {
        "dataSourceKey": "task.board",
        "params": {
          "scope": {
            "fieldKey": "taskScope"
          },
          "status": {
            "value": "inProgress"
          }
        }
      },
      {
        "dataSourceKey": "task.board",
        "params": {
          "scope": {
            "fieldKey": "taskScope"
          },
          "status": {
            "value": "review"
          }
        }
      },
      {
        "dataSourceKey": "task.board",
        "params": {
          "scope": {
            "fieldKey": "taskScope"
          },
          "status": {
            "value": "done"
          }
        }
      }
    ]
  }
] as const satisfies readonly RuntimeScreenSpec[]

const BY_ID = new Map<string, RuntimeScreenSpec>(
  SCREEN_RUNTIME.map((screen) => [screen.screenId, screen]),
)

export function findScreenRuntime(screenId: string): RuntimeScreenSpec | undefined {
  return BY_ID.get(screenId)
}

export function stateScopeKeyOf(screenId: string): string | undefined {
  return findScreenRuntime(screenId)?.stateScopeKey
}

export const DRAWABLE_SCREEN_RUNTIME = SCREEN_RUNTIME.filter((screen) => screen.drawable)

export interface RuntimeDraftFields {
  booleans: readonly string[]
  lists: readonly { fieldKey: string; itemValueKey?: string }[]
}

export const DRAFT_FIELDS_BY_SCOPE: Readonly<Record<string, RuntimeDraftFields>> = {
  "archiveChecklistDraft": {
    "booleans": [
      "done"
    ],
    "lists": []
  },
  "archiveDraft": {
    "booleans": [],
    "lists": []
  },
  "attendanceCheckInDraft": {
    "booleans": [],
    "lists": []
  },
  "budgetPlanDraft": {
    "booleans": [],
    "lists": [
      {
        "fieldKey": "eventItems"
      },
      {
        "fieldKey": "items"
      },
      {
        "fieldKey": "sources"
      }
    ]
  },
  "eventBasicsDraft": {
    "booleans": [
      "endUnset",
      "placeUnset"
    ],
    "lists": []
  },
  "eventCreateDraft": {
    "booleans": [],
    "lists": []
  },
  "eventStaffEditDraft": {
    "booleans": [],
    "lists": []
  },
  "eventStaffSetupDraft": {
    "booleans": [],
    "lists": []
  },
  "eventSurveyDraft": {
    "booleans": [
      "duesCheck",
      "waitlist"
    ],
    "lists": []
  },
  "eventSurveyReplaceDraft": {
    "booleans": [],
    "lists": []
  },
  "meetingCancelDraft": {
    "booleans": [],
    "lists": []
  },
  "meetingDraft": {
    "booleans": [
      "isPrivate"
    ],
    "lists": [
      {
        "fieldKey": "agendaItems"
      },
      {
        "fieldKey": "participants",
        "itemValueKey": "memberId"
      }
    ]
  },
  "meetingMinutesDraft": {
    "booleans": [
      "noDecision",
      "noFollowUp"
    ],
    "lists": []
  },
  "messageRoomDraft": {
    "booleans": [],
    "lists": []
  },
  "myProfileDraft": {
    "booleans": [],
    "lists": []
  },
  "onboardingDraft": {
    "booleans": [],
    "lists": []
  },
  "orgCreationDraft": {
    "booleans": [],
    "lists": [
      {
        "fieldKey": "departments",
        "itemValueKey": "name"
      }
    ]
  },
  "orgEditDraft": {
    "booleans": [],
    "lists": []
  },
  "purchaseRequestDraft": {
    "booleans": [],
    "lists": [
      {
        "fieldKey": "items"
      }
    ]
  },
  "purchaseRequestReview": {
    "booleans": [],
    "lists": []
  },
  "purchaseRequestSupplement": {
    "booleans": [],
    "lists": []
  },
  "roleChangeDraft": {
    "booleans": [],
    "lists": []
  },
  "surveyApplyDraft": {
    "booleans": [
      "privacyConsent"
    ],
    "lists": []
  }
}
