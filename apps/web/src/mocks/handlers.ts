import { http, HttpResponse, type RequestHandler } from "msw";

import {
  eventBudgetSummaryExample,
  eventItemBoardFinanceExample,
  eventItemBoardMemberExample,
} from "./event-finance-fixtures";
import {
  detailViewExample,
  reviewViewExample,
  editorStateExample,
  ownListExample,
} from "./purchase-request-fixtures";

/**
 * 개발 서버에서만 쓰는 계약 예제 응답이다.
 * 실제 API 연결은 별도 전달 작업이며 여기에서 계약 밖 필드를 만들지 않는다.
 */
/** 개발 서버가 한 세션 동안 기억하는 초안이다. 새로고침하면 사라진다. */
let draftVersion = 0;
let draftContent: unknown = null;

/**
 * 행사 재정은 보는 사람의 역할에 따라 응답이 달라진다. 개발 서버에는 로그인이
 * 없으므로 `?as=member`로 일반 구성원 응답을 본다. 기본은 재정부다.
 * 이것은 개발용 전환일 뿐이고 서버는 언제나 신뢰 맥락으로 판정한다.
 */
function viewerIsFinance() {
  // 브라우저 주소를 읽는다. API 요청 주소가 아니다 — 화면이 서버에 보내는
  // 요청에는 이 파라미터가 없고, 제품 코드에 개발용 값을 흘리지 않는다.
  return new URLSearchParams(window.location.search).get("as") !== "member";
}

/** 재제출 화면이 볼 보완 요청. 보완 품목 하나와 승인·반려 품목이 함께 있다. */
const revisionViewExample = {
    // 목록·상세에 있는 요청과 같은 것이어야 한다. 재제출 뒤 상세로 돌아가는
  // 흐름이 목업에서도 이어져야 사람이 끝까지 눌러 볼 수 있다.
  requestId: "request-001",
  requestTitle: "체육대회 운영 물품",
  revisionItems: [
    {
      itemId: "item-101",
      itemName: "음향 장비 대여",
      revisionReason: "견적 근거가 없습니다. 업체와 금액을 남겨 주세요.",
      revisionDueDate: "2999-09-01",
      content: {
        name: "음향 장비 대여",
        quantity: 1,
        estimatedUnitPrice: 360_000,
        purchaseType: "rental",
        details: { provider: "예시사운드", location: "", startDate: "", endDate: "" },
      },
    },
  ],
  otherItems: [
    {
      itemId: "item-102",
      itemName: "행사 현수막 (5m)",
      reviewStatus: "approved",
      estimatedTotalPrice: 180_000,
    },
    {
      itemId: "item-103",
      itemName: "기념품 텀블러 100개",
      reviewStatus: "rejected",
      estimatedTotalPrice: 850_000,
    },
  ],
};

/** 회장단 하나와 부원 둘. 미배정 구성원도 하나 둔다. */
let memberRoles = [
  {
    membershipId: "membership-president",
    displayName: "박해랑",
    departments: ["기획부"],
    role: "president",
  },
  {
    membershipId: "membership-a",
    displayName: "김도윤",
    departments: ["운영부", "홍보부"],
    role: "member",
  },
  {
    membershipId: "membership-b",
    displayName: "이서준",
    departments: [],
    role: "member",
  },
];

export const handlers: RequestHandler[] = [
  http.get("*/api/v1/organization/member-roles", () =>
    HttpResponse.json({ members: memberRoles }),
  ),

  http.put(
    "*/api/v1/organization/memberships/:membershipId/role",
    async ({ params, request }) => {
      const body = (await request.json()) as {
        role: string;
        expectedCurrentRole: string;
      };
      const target = memberRoles.find((m) => m.membershipId === params.membershipId);
      if (!target) return new HttpResponse(null, { status: 404 });

      // 낙관적 잠금과 마지막 회장단 보호를 목업에서도 재현한다.
      if (target.role !== body.expectedCurrentRole) {
        return HttpResponse.json(
          { type: "urn:vada:error", title: "그 사이 바뀌었습니다.", status: 409 },
          { status: 409, headers: { "content-type": "application/problem+json" } },
        );
      }
      const presidents = memberRoles.filter((m) => m.role === "president").length;
      if (target.role === "president" && body.role !== "president" && presidents <= 1) {
        return HttpResponse.json(
          { type: "urn:vada:error", title: "마지막 회장단입니다.", status: 409 },
          { status: 409, headers: { "content-type": "application/problem+json" } },
        );
      }

      memberRoles = memberRoles.map((m) =>
        m.membershipId === params.membershipId ? { ...m, role: body.role } : m,
      );
      return HttpResponse.json({ members: memberRoles });
    },
  ),

  http.get("*/api/v1/events/:eventId/purchase-requests/:requestId/revision", () =>
    HttpResponse.json(revisionViewExample),
  ),

  http.post("*/api/v1/events/:eventId/purchase-requests/:requestId/revisions", () =>
    // 재제출 뒤에는 보완할 것이 남지 않는다. 그 품목은 검토 대기로 돌아간다.
    HttpResponse.json({ ...revisionViewExample, revisionItems: [] }),
  ),

  http.get("*/api/v1/events/:eventId/budget-summary", () =>
    HttpResponse.json(eventBudgetSummaryExample),
  ),

  http.get("*/api/v1/events/:eventId/purchase-request-items", () =>
    HttpResponse.json(
      viewerIsFinance() ? eventItemBoardFinanceExample : eventItemBoardMemberExample,
    ),
  ),

  http.get("*/api/v1/events/:eventId/purchase-request-editor", () =>
    HttpResponse.json({
      ...editorStateExample,
      draft: draftContent
        ? {
            draftId: "draft-001",
            version: draftVersion,
            savedAt: new Date().toISOString(),
            content: draftContent,
          }
        : null,
    }),
  ),

  http.put("*/api/v1/events/:eventId/purchase-request-draft", async ({ request }) => {
    const body = (await request.json()) as {
      expectedVersion: number | null;
      content: unknown;
    };

    // 계약대로 낙관적 잠금을 재현한다.
    if ((body.expectedVersion ?? 0) !== draftVersion) {
      return HttpResponse.json(
        {
          type: "urn:vada:error:purchase_request_state_conflict",
          title: "다른 곳에서 초안이 변경됐습니다.",
          status: 409,
          code: "purchase_request_state_conflict",
        },
        { status: 409, headers: { "content-type": "application/problem+json" } },
      );
    }

    draftVersion += 1;
    draftContent = body.content;

    return HttpResponse.json({
      draftId: "draft-001",
      version: draftVersion,
      savedAt: new Date().toISOString(),
      content: body.content,
    });
  }),

  http.delete("*/api/v1/events/:eventId/purchase-request-draft", () => {
    draftVersion = 0;
    draftContent = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("*/api/v1/events/:eventId/purchase-requests", async ({ request }) => {
    const body = (await request.json()) as {
      content?: { items?: Array<{ quantity?: number; estimatedUnitPrice?: number }> };
    };
    const total = (body.content?.items ?? []).reduce(
      (sum, item) => sum + (item.quantity ?? 0) * (item.estimatedUnitPrice ?? 0),
      0,
    );

    draftVersion = 0;
    draftContent = null;

    return HttpResponse.json(
      {
        requestId: `request-${String(ownListExample.items.length + 1).padStart(3, "0")}`,
        status: "review_pending",
        // 예산 초과 경로를 확인할 수 있도록 임계값을 둔다.
        overBudget: total > 1000000,
      },
      { status: 201 },
    );
  }),

  http.get("*/api/v1/events/:eventId/purchase-requests/mine", () =>
    HttpResponse.json(ownListExample),
  ),

  // 검토 조회는 상세보다 먼저 둔다. :requestId 패턴이 "review"까지 삼킨다.
  http.get(
    "*/api/v1/events/:eventId/purchase-requests/:requestId/review",
    () => HttpResponse.json(reviewViewExample),
  ),

  http.get("*/api/v1/events/:eventId/purchase-requests/:requestId", ({ params }) => {
    const { requestId } = params;

    const item = ownListExample.items.find(
      (candidate) => candidate.requestId === requestId,
    );
    if (!item) {
      return HttpResponse.json(
        {
          type: "urn:vada:error:http_resource_not_found",
          title: "찾을 수 없습니다.",
          status: 404,
          code: "http_resource_not_found",
        },
        { status: 404, headers: { "content-type": "application/problem+json" } },
      );
    }

    return HttpResponse.json({
      ...detailViewExample,
      record: {
        ...detailViewExample.record,
        requestId: item.requestId,
        status: item.status,
        estimatedTotal: item.estimatedTotal,
        overBudget: item.overBudget,
        createdAt: item.createdAt,
        content: { ...detailViewExample.record.content, title: item.title },
      },
    });
  }),
];
