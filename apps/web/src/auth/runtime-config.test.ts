import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "../mocks/server";
import { RuntimeConfigError, loadRuntimeConfig } from "./runtime-config";

// 상대 경로로 부르므로 호스트는 시험 환경이 정한다. 저장소의 다른 핸들러와
// 같은 방식으로 호스트를 묶지 않는다.
const CONFIG_URL = "*/config.json";

describe("배포 설정", () => {
  it("배포가 올린 값을 읽는다", async () => {
    server.use(
      http.get(CONFIG_URL, () =>
        HttpResponse.json({
          loginDomain: "https://vada-1.auth.ap-northeast-2.amazoncognito.com",
          clientId: "abc123",
        }),
      ),
    );

    await expect(loadRuntimeConfig()).resolves.toEqual({
      loginDomain: "https://vada-1.auth.ap-northeast-2.amazoncognito.com",
      clientId: "abc123",
    });
  });

  // 조용히 넘어가면 로그인 없이 화면이 뜨고 모든 요청이 401을 받는다.
  // 사용자에게는 "앱이 고장났다"로만 보인다.
  it("배포가 설정을 안 올렸으면 던진다", async () => {
    server.use(
      http.get(CONFIG_URL, () => new HttpResponse(null, { status: 404 })),
    );

    await expect(loadRuntimeConfig()).rejects.toBeInstanceOf(RuntimeConfigError);
  });

  it("모양이 다르면 던진다", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json({ clientId: "abc123" })),
    );

    await expect(loadRuntimeConfig()).rejects.toBeInstanceOf(RuntimeConfigError);
  });
});
