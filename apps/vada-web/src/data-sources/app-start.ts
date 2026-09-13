import type { ApiResponse, paths as ApiPaths } from '../../../../specs/figma/vada-wireframe/api-types'

export const APP_START_PATH: keyof ApiPaths = '/api/app/start'

// 생성 타입은 컴파일 때만 쓰인다. 네트워크 응답은 기존처럼 문자열인지 확인한다.
export function parseAppStartResponse(value: unknown): ApiResponse<'app.start'> | null {
  if (value === null || typeof value !== 'object' || !('screenId' in value) || typeof value.screenId !== 'string') {
    return null
  }
  return { screenId: value.screenId }
}
