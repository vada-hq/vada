import type { SessionReader } from '../auth/require-session.js'

// 흐름 전용 세션: 요청 머리 x-flow-user가 인물의 계정이다. 인증을 건너뛰고 나머지는 실제 경로를 지나게 하려는 시험·시연용이다.
// 운영 서버에 들어가면 머리 하나로 누구나 남이 되므로 이 파일은 flows/와 scripts/만 가져온다(.oxlintrc.json no-restricted-imports).
// 그래도 새지 않게 이중으로 막는다: appModulesOf는 세션을 꼭 받아 기본값이 없고, 이 세션은 admit으로 들인 계정만 받는다.
export const FLOW_USER_HEADER = 'x-flow-user'

export function createFlowSession() {
  const admitted = new Set<string>()
  const session: SessionReader = headers => {
    const userId = headers.get(FLOW_USER_HEADER)
    return Promise.resolve(userId && admitted.has(userId) ? { user: { id: userId } } : null)
  }
  return {
    session,
    admit: (userId: string) => {
      admitted.add(userId)
    },
  }
}
