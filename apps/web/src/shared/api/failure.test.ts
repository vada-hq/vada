import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { rememberAccessToken } from "../../auth/session";
import { server } from "../../mocks/server";
import { requestEmpty, requestJson } from "./failure";

const PATH = "/events/e-1/purchase-requests/mine";
const URL = `*/api/v1${PATH}`;

afterEach(() => {
  rememberAccessToken(null);
});

describe("서버 요청", () => {
  // 화면마다 붙이면 언젠가 한 화면이 잊는다. 그 화면만 401을 받고, 그것은
  // 데이터가 없는 것과 구별되지 않는다.
  it("로그인한 사람의 토큰을 싣는다", async () => {
    rememberAccessToken("token-xyz");
    let seen: string | null = null;
    server.use(
      http.get(URL, ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );

    await requestJson(PATH);

    expect(seen).toBe("Bearer token-xyz");
  });

  it("값을 돌려주지 않는 요청도 똑같이 싣는다", async () => {
    rememberAccessToken("token-xyz");
    let seen: string | null = null;
    server.use(
      http.delete(URL, ({ request }) => {
        seen = request.headers.get("authorization");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await requestEmpty(PATH, { method: "DELETE" });

    expect(seen).toBe("Bearer token-xyz");
  });

  // 로컬 개발에는 Cognito가 없다. 빈 헤더를 보내면 서버가 그것을 신원 주장으로
  // 읽고 거절한다.
  it("토큰이 없으면 헤더를 붙이지 않는다", async () => {
    let seen: string | null = "아직 안 봄";
    server.use(
      http.get(URL, ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );

    await requestJson(PATH);

    expect(seen).toBeNull();
  });
});
