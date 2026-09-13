import type { DataSource, DataRow, NOT_FOUND } from './definitions'
import type { Option } from '../option-sources/definitions'

// 서버가 없는 경우의 동작. 개발 구현도 이 계약을 따르며 빌드가 구현을 선택한다.
export interface OfflineClient {
  read(source: DataSource, params: Record<string, string>): DataRow | DataRow[] | typeof NOT_FOUND
  options(key: string, params: Record<string, string>, query?: string): Promise<Option[]>
  submit(key: string): Promise<DataRow>
}

function requireServer(): never {
  throw new Error('서버 연결이 설정되지 않았습니다.')
}

// 운영에서는 서버 초기화 누락을 빈 데이터나 제출 성공으로 처리하지 않는다.
export const offlineClient: OfflineClient = {
  read: requireServer,
  options: async () => requireServer(),
  submit: async () => requireServer(),
}
