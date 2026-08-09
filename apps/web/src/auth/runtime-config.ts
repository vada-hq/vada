import { z } from "zod";

/**
 * 로그인 상대가 누구인지는 **배포 사실이지 빌드 사실이 아니다.**
 *
 * 빌드에 구우면 빌드 결과가 환경에 묶인다. 그러면 언젠가 스테이징에서 구운
 * 것이 프로덕션에 올라가고, 그 사실은 사람이 로그인해 봐야 드러난다. 그래서
 * 빌드 결과는 어느 환경에서도 같고, 환경이 다른 것은 이 파일 하나다.
 *
 * 같은 출처에서 가져온다. 배포가 Terraform 출력으로 만들어 올린다.
 * 여기 든 값은 비밀이 아니다 — 앱 클라이언트 ID는 어차피 브라우저에 실린다.
 */
const runtimeConfigSchema = z.object({
  loginDomain: z.url(),
  clientId: z.string().min(1),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export const RUNTIME_CONFIG_PATH = "/config.json";

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigError";
  }
}

/**
 * 실패하면 던진다. 조용히 넘어가면 로그인 없이 화면이 뜨고, 모든 요청이
 * 401을 받는다 — 사용자에게는 "앱이 고장났다"로만 보인다.
 */
export async function loadRuntimeConfig(
  request: typeof fetch = fetch,
): Promise<RuntimeConfig> {
  let response: Response;
  try {
    response = await request(RUNTIME_CONFIG_PATH, {
      headers: { accept: "application/json" },
    });
  } catch {
    throw new RuntimeConfigError("배포 설정을 가져오지 못했습니다.");
  }

  if (!response.ok) {
    throw new RuntimeConfigError(
      `배포 설정이 없습니다 (${String(response.status)}). 배포가 ${RUNTIME_CONFIG_PATH}를 올리지 않았습니다.`,
    );
  }

  const parsed = runtimeConfigSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new RuntimeConfigError("배포 설정의 모양이 계약과 다릅니다.");
  }

  return parsed.data;
}
