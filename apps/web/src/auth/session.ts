import { z } from "zod";

import { challengeFor, randomToken } from "./pkce";
import type { RuntimeConfig } from "./runtime-config";
import { loadRuntimeConfig } from "./runtime-config";

/**
 * 로그인한 사람의 세션.
 *
 * **토큰은 메모리에만 둔다.** 저장소 규칙이 인증 정보를 브라우저 영속 저장소에
 * 두지 못하게 한다 — localStorage에 든 토큰은 같은 출처의 어떤 스크립트든
 * 읽어 갈 수 있고, 탭을 닫아도 남는다. 새로고침하면 토큰이 사라지지만 Cognito
 * 세션 쿠키가 남아 있어 다시 묻지 않고 돌아온다.
 *
 * 갱신 토큰은 받아도 **버린다.** 그것을 들고 있으면 어딘가에 두어야 하고,
 * 둘 만한 안전한 자리가 브라우저에는 없다. 대신 만료되면 다시 다녀온다.
 */

export const CALLBACK_PATH = "/auth/callback";

// 이 셋은 로그인 화면으로 나갔다가 돌아오는 사이에 살아 있어야 한다. 그 사이에
// 페이지가 통째로 새로 뜨므로 메모리로는 안 된다.
//
// 토큰과 다르다. verifier는 자격 증명이 아니라 **일회용 대조값**이고, 짝이 되는
// 코드가 같이 있어야만 의미가 있다. 쓰는 즉시 지운다.
const VERIFIER_KEY = "vada.auth.verifier";
const STATE_KEY = "vada.auth.state";
const RETURN_KEY = "vada.auth.return";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.number(),
});

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

let accessToken: string | null = null;

/** 요청에 실을 토큰. 없으면 `null` — 로컬 개발에는 Cognito가 없다. */
export function accessTokenForRequests(): string | null {
  return accessToken;
}

export function rememberAccessToken(token: string | null): void {
  accessToken = token;
}

function callbackUrl(): string {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

/**
 * 로그인 화면으로 보낸다. **돌아오지 않는다** — 브라우저가 떠나므로 이 뒤의
 * 코드는 실행되지 않는다. 부르는 쪽이 그 사이에 화면을 그리지 않도록
 * 끝나지 않는 약속을 돌려준다.
 */
export async function beginLogin(
  config: RuntimeConfig,
  returnTo: string,
): Promise<never> {
  const verifier = randomToken();
  const state = randomToken(16);

  window.sessionStorage.setItem(VERIFIER_KEY, verifier);
  window.sessionStorage.setItem(STATE_KEY, state);
  window.sessionStorage.setItem(RETURN_KEY, returnTo);

  const authorize = new URL("/oauth2/authorize", config.loginDomain);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", callbackUrl());
  authorize.searchParams.set("scope", "openid email");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("code_challenge", await challengeFor(verifier));

  window.location.assign(authorize.toString());
  return new Promise<never>(() => {});
}

/**
 * 로그인 화면에서 돌아온 자리에서 코드를 토큰으로 바꾼다.
 * 성공하면 원래 가려던 주소를 돌려준다.
 */
export async function completeLogin(
  config: RuntimeConfig,
  search: string,
): Promise<string> {
  const params = new URLSearchParams(search);

  const verifier = window.sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = window.sessionStorage.getItem(STATE_KEY);
  const returnTo = window.sessionStorage.getItem(RETURN_KEY) ?? "/";

  // 한 번만 쓴다. 남겨 두면 다음 로그인이 옛 값과 맞춰 보게 된다.
  window.sessionStorage.removeItem(VERIFIER_KEY);
  window.sessionStorage.removeItem(STATE_KEY);
  window.sessionStorage.removeItem(RETURN_KEY);

  const failure = params.get("error");
  if (failure) {
    throw new AuthError(`로그인이 거절되었습니다 (${failure}).`);
  }

  const code = params.get("code");
  if (!code || !verifier) {
    throw new AuthError("로그인 응답이 불완전합니다. 다시 시도해 주세요.");
  }

  // 이 브라우저가 시작한 로그인인지 본다. 맞추지 않으면 남이 만든 코드를
  // 이 세션에 심을 수 있다.
  if (params.get("state") !== expectedState) {
    throw new AuthError("이 브라우저가 시작한 로그인이 아닙니다.");
  }

  const response = await fetch(new URL("/oauth2/token", config.loginDomain), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: callbackUrl(),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new AuthError("토큰 교환이 거절되었습니다.");
  }

  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AuthError("토큰 응답의 모양이 예상과 다릅니다.");
  }

  // 갱신 토큰이 같이 오지만 읽지 않는다. 위의 이유다.
  rememberAccessToken(parsed.data.access_token);
  return returnTo;
}

/**
 * 화면을 그리기 전에 세션을 세운다. 셋 중 하나로 끝난다 —
 * 돌아온 코드를 토큰으로 바꾸거나, 로그인 화면으로 떠나거나, 던진다.
 */
export async function establishSession(): Promise<void> {
  const config = await loadRuntimeConfig();

  if (window.location.pathname === CALLBACK_PATH) {
    const returnTo = await completeLogin(config, window.location.search);
    // 주소창에서 코드를 지운다. 남겨 두면 새로고침할 때 다 쓴 코드로 다시
    // 교환을 시도하고, 그것은 반드시 실패한다.
    window.history.replaceState(null, "", returnTo);
    return;
  }

  await beginLogin(
    config,
    `${window.location.pathname}${window.location.search}`,
  );
}
