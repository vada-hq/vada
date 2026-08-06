import { http, HttpResponse, type RequestHandler } from "msw";

import {
  detailViewExample,
  editorStateExample,
  ownListExample,
} from "./purchase-request-fixtures";

/**
 * 개발 서버에서만 쓰는 계약 예제 응답이다.
 * 실제 API 연결은 별도 전달 작업이며 여기에서 계약 밖 필드를 만들지 않는다.
 */
export const handlers: RequestHandler[] = [
  http.get("*/events/:eventId/purchase-request-editor", () =>
    HttpResponse.json(editorStateExample),
  ),

  http.get("*/events/:eventId/purchase-requests/mine", () =>
    HttpResponse.json(ownListExample),
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
