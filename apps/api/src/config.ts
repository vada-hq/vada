// 서버가 서려면 무엇이 있어야 하는가.
//
// **없으면 서지 않는다.** 없는 채로 도는 것이 가장 나쁘다 — 비밀이 빈 문자열인 서버는
// 겉으로 멀쩡히 돌고, 세션 쿠키가 아무나 만들 수 있는 값이 된다.
//
// 여기서 읽는 것은 전부 밖에서 온다. **저장소에 값을 두지 않는다** — 비밀이 저장소에
// 들어가면 되돌릴 수 없다.

export interface Config {
  port: number
  databaseUrl: string
  authSecret: string
  /** 이 서버가 어디에 있는가. 소셜 로그인이 돌아올 자리를 만든다. */
  baseUrl: string
  /** 화면이 어디에 있는가. 로그인 뒤 돌아갈 곳이다. */
  appUrl: string
  /** 초대 링크의 앞부분. */
  inviteLinkBase: string
  google?: { clientId: string; clientSecret: string }
  kakao?: { clientId: string; clientSecret: string }
  /**
   * Worker가 '내가 넘겼다'고 증명하는 비밀(선택).
   *
   * **없으면 보낸 쪽이 적은 주소를 그대로 믿는다.** 그러면 api가 도는 곳을 곧장
   * 두드리며 매번 다른 주소를 적는 것으로 속도 세기를 통째로 지나갈 수 있다 —
   * 밖에서 열리는 자리의 유일한 벽이 그 세기다.
   *
   * **여기서 막지는 않는다.** 서지 않게 하면 값을 넣기 전까지 배포가 죽고, 한 칸에
   * 몰아 버리면 행사장에서 줄 서서 찍는 사람들이 다 막힌다. 대신 설 때 소리 내어
   * 말한다. 까닭은 `public/client-address.ts`에 있다.
   */
  edgeSecret?: string
}

export class MissingConfig extends Error {}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]
  if (value === undefined || value.trim() === '') {
    throw new MissingConfig(
      `${key}가 없습니다. 서버는 이것 없이 서지 않습니다 — 없는 채로 도는 것이 가장 나쁩니다.`,
    )
  }
  return value
}

/** 둘 다 있어야 그 길이 열린다. 하나만 있으면 반쯤 켜진 것이라 막는다. */
function pair(
  env: NodeJS.ProcessEnv,
  idKey: string,
  secretKey: string,
): { clientId: string; clientSecret: string } | undefined {
  const id = env[idKey]
  const secret = env[secretKey]
  if ((id === undefined) !== (secret === undefined)) {
    throw new MissingConfig(`${idKey}와 ${secretKey}는 함께 있어야 합니다.`)
  }
  return id === undefined || secret === undefined ? undefined : { clientId: id, clientSecret: secret }
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config: Config = {
    port: Number(env.PORT ?? 8787),
    databaseUrl: required(env, 'DATABASE_URL'),
    // **32자 이상을 요구한다.** 짧은 비밀은 있는 것과 없는 것 사이라 더 나쁘다 —
    // 있다고 믿게 하면서 지키지 못한다.
    authSecret: (() => {
      const secret = required(env, 'AUTH_SECRET')
      if (secret.length < 32) {
        throw new MissingConfig('AUTH_SECRET이 너무 짧습니다(32자 이상).')
      }
      return secret
    })(),
    baseUrl: required(env, 'BASE_URL'),
    appUrl: required(env, 'APP_URL'),
    inviteLinkBase: required(env, 'INVITE_LINK_BASE'),
  }
  // **짧은 비밀은 있는 것과 없는 것 사이라 더 나쁘다** — AUTH_SECRET과 같은 규칙이다.
  const edge = env.EDGE_SECRET
  if (edge !== undefined && edge.trim() !== '') {
    if (edge.length < 32) throw new MissingConfig('EDGE_SECRET이 너무 짧습니다(32자 이상).')
    config.edgeSecret = edge
  }
  const google = pair(env, 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
  const kakao = pair(env, 'KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET')
  if (google !== undefined) config.google = google
  if (kakao !== undefined) config.kakao = kakao

  // **들어올 길이 하나도 없으면 서지 않는다.** 로그인할 수 없는 서버는 아무도 쓸 수
  // 없고, 그 사실이 켤 때가 아니라 사람이 눌렀을 때 드러나면 늦다.
  if (google === undefined && kakao === undefined) {
    throw new MissingConfig(
      '들어올 길이 하나도 없습니다. 구글이나 카카오 자격증명 가운데 하나는 있어야 합니다.',
    )
  }
  return config
}
