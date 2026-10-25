import type { RecordKind } from '@vada/contracts'
import { useHere } from './app-location'

// 주소가 이 학생회의 이 종류 기록이면 그 번호다. 기록 주소로 열린 페이지가 새로 그려질 때 그 기록의 상세를 한 번 여는 데 쓴다.
export function useAddressRecord(kind: RecordKind, councilId: string) {
  const { location } = useHere()
  return location?.type === 'record' &&
    location.record === kind &&
    location.councilId === councilId.toLowerCase()
    ? location.recordId
    : undefined
}
