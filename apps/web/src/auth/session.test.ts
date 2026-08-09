import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "../mocks/server";
import { challengeFor } from "./pkce";
import type { RuntimeConfig } from "./runtime-config";
import {
  AuthError,
  accessTokenForRequests,
  beginLogin,
  completeLogin,
  rememberAccessToken,
} from "./session";

const config: RuntimeConfig = {
  loginDomain: "https://vada-1.auth.ap-northeast-2.amazoncognito.com",
  clientId: "client-abc",
};

const TOKEN_URL = `${config.loginDomain}/oauth2/token`;

/** jsdom의 location은 실제로 이동하려 든다. 어디로 가려 했는지만 본다. */
function captureNavigation() {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: "https://vada.example", pathname: "/", search: "", assign },
    writable: true,
  });
  return assign;
}

beforeEach(() => {
  window.sessionStorage.clear();
  rememberAccessToken(null);
});

afterEach(() => {
  window.sessionStorage.clear();
  rememberAccessToken(null);
});

describe("로그인 시작", () => {
  it("verifier의 해시만 보내고 원본은 이 브라우저에 남긴다", async () => {
    const assign = captureNavigation();

    void beginLogin(config, "/events/e-1/finance");
    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalled();
    });

    const sent = new URL(String(assign.mock.calls[0]?.[0]));
    const verifier = window.sessionStorage.getItem("vada.auth.verifier");

    expect(verifier).not.toBeNull();
    expect(sent.origin).toBe(config.loginDomain);
    expect(sent.pathname).toBe("/oauth2/authorize");
    expect(sent.searchParams.get("response_type")).toBe("code");
    expect(sent.searchParams.get("client_id")).toBe(config.clientId);
    expect(sent.searchParams.get("redirect_uri")).toBe(
      "https://vada.example/auth/callback",
    );

    // `plain`이면 해시를 안 해서 막는 것이 없다.
    expect(sent.searchParams.get("code_challenge_method")).toBe("S256");
    expect(sent.searchParams.get("code_challenge")).toBe(
      await challengeFor(verifier!),
    );
    // 원본은 주소에 실리지 않는다. 실리면 PKCE가 아무것도 막지 못한다.
    expect(sent.search).not.toContain(verifier!);
  });

  it("돌아올 자리를 기억한다", async () => {
    const assign = captureNavigation();

    void beginLogin(config, "/organization/roles");
    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalled();
    });

    expect(window.sessionStorage.getItem("vada.auth.return")).toBe(
      "/organization/roles",
    );
  });
});

describe("로그인 완료", () => {
  beforeEach(() => {
    captureNavigation();
    window.sessionStorage.setItem("vada.auth.verifier", "verifier-value");
    window.sessionStorage.setItem("vada.auth.state", "state-value");
    window.sessionStorage.setItem("vada.auth.return", "/events/e-1/finance");
  });

  it("코드를 토큰으로 바꾸고 원래 가려던 자리를 돌려준다", async () => {
    let sentBody = "";
    server.use(
      http.post(TOKEN_URL, async ({ request }) => {
        sentBody = await request.text();
        return HttpResponse.json({
          access_token: "token-xyz",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }),
    );

    await expect(
      completeLogin(config, "?code=code-1&state=state-value"),
    ).resolves.toBe("/events/e-1/finance");

    expect(accessTokenForRequests()).toBe("token-xyz");

    const sent = new URLSearchParams(sentBody);
    expect(sent.get("grant_type")).toBe("authorization_code");
    expect(sent.get("code")).toBe("code-1");
    expect(sent.get("code_verifier")).toBe("verifier-value");
  });

  it("다 쓴 값을 남기지 않는다", async () => {
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({
          access_token: "token-xyz",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      ),
    );

    await completeLogin(config, "?code=code-1&state=state-value");

    expect(window.sessionStorage.getItem("vada.auth.verifier")).toBeNull();
    expect(window.sessionStorage.getItem("vada.auth.state")).toBeNull();
  });

  // 맞추지 않으면 남이 만든 코드를 이 세션에 심을 수 있다.
  it("이 브라우저가 시작하지 않은 응답은 거절한다", async () => {
    await expect(
      completeLogin(config, "?code=code-1&state=someone-elses"),
    ).rejects.toBeInstanceOf(AuthError);

    expect(accessTokenForRequests()).toBeNull();
  });

  it("거절당한 로그인을 성공으로 만들지 않는다", async () => {
    await expect(
      completeLogin(config, "?error=access_denied&state=state-value"),
    ).rejects.toBeInstanceOf(AuthError);

    expect(accessTokenForRequests()).toBeNull();
  });

  it("교환이 거절되면 토큰을 만들어 내지 않는다", async () => {
    server.use(
      http.post(TOKEN_URL, () => new HttpResponse(null, { status: 400 })),
    );

    await expect(
      completeLogin(config, "?code=code-1&state=state-value"),
    ).rejects.toBeInstanceOf(AuthError);

    expect(accessTokenForRequests()).toBeNull();
  });
});
