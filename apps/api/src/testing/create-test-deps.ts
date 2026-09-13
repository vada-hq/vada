import type { Deps } from '../deps.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

type ScenarioDeps = Pick<Deps, 'db' | 'who' | 'invite' | 'newId'>
export type TestDepsOptions = ScenarioDeps & Partial<Omit<Deps, keyof ScenarioDeps>>

/**
 * API 테스트의 공통 대역. DB·사용자·시간·ID는 각 시나리오가 명시한다.
 * 기본 상태 저장소는 호출마다 새로 만들며, 전달한 대역은 그대로 사용한다.
 * 실제 권한 조회와 업무별 데이터 준비는 각 영역의 테스트가 맡는다.
 */
export function createTestDeps(options: TestDepsOptions): Deps {
  return {
    audit: { async write() {} },
    // 조건부 권한은 조회 대역을 명시한 테스트에서만 열린다.
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
      isMeetingParticipant: async () => false,
    },
    // 외부 로그인은 호출하지 않고, 기존 테스트가 사용하던 URL과 빈 헤더를 준다.
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}`, headers: new Headers() }),
      end: async () => new Headers(),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    ...options,
  }
}
