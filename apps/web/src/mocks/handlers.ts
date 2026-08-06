import { http, HttpResponse, type RequestHandler } from "msw";

import {
  budgetSummaryExample,
  eventListExample,
} from "./event-finance-fixtures";
import {
  detailViewExample,
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

export const handlers: RequestHandler[] = [
  http.get("*/events/:eventId/budget-summary", () =>
    HttpResponse.json(budgetSummaryExample),
  ),

  http.get("*/events/:eventId/purchase-request-editor", () =>
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

  http.put("*/events/:eventId/purchase-request-draft", async ({ request }) => {
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

  http.delete("*/events/:eventId/purchase-request-draft", () => {
    draftVersion = 0;
    draftContent = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("*/events/:eventId/purchase-requests", async ({ request }) => {
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

  http.get("*/events/:eventId/purchase-requests/mine", () =>
    HttpResponse.json(ownListExample),
  ),

  http.get("*/events/:eventId/purchase-requests", () =>
    HttpResponse.json(eventListExample),
  ),

  http.get("*/events/:eventId/purchase-requests/:requestId", ({ params }) => {
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
