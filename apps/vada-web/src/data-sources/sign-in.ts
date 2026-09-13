import type { ApiResponse } from '../../../../specs/figma/vada-wireframe/api-types'

// 같은 해석 함수를 쓰므로 두 제공자의 응답 계약을 모두 만족해야 한다.
export function parseSignInResponse(
  value: unknown,
): (ApiResponse<'auth.signInGoogle'> & ApiResponse<'auth.signInKakao'>) | null {
  if (value === null || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string') {
    return null
  }
  return { url: value.url }
}
