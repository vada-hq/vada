import { describe, expect, it } from "vitest";

import { challengeFor, randomToken } from "./pkce";

describe("PKCE", () => {
  // RFC 7636 부록 B의 값이다. 우리 구현끼리 맞춰 보면 둘 다 틀려도 통과하므로
  // 규격이 적어 둔 실제 값을 쓴다.
  it("규격의 예제 verifier에서 규격의 challenge가 나온다", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

    await expect(challengeFor(verifier)).resolves.toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("verifier는 매번 다르고 URL에 그대로 실을 수 있다", () => {
    const first = randomToken();
    const second = randomToken();

    expect(first).not.toBe(second);
    // `+/=`가 남아 있으면 주소에 실려 가면서 다른 값이 된다.
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    // RFC 7636은 43자 이상을 요구한다.
    expect(first.length).toBeGreaterThanOrEqual(43);
  });
});
