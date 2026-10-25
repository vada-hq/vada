import { appPath, type AppQuery, type RecordKind } from '@vada/contracts'
import { navigate, useHere } from './app-location'
import { patchQuery } from './use-menu-query'

const NONE: AppQuery = {}

// 주소가 이 학생회의 이 종류 기록이면 그 번호다. 기록 주소로 열린 페이지가 새로 그려질 때 그 기록의 상세를 한 번 여는 데 쓴다.
export function useAddressRecord(kind: RecordKind, councilId: string) {
  const { location } = useHere()
  return location?.type === 'record' &&
    location.record === kind &&
    location.councilId === councilId.toLowerCase()
    ? location.recordId
    : undefined
}

// 열린 기록 주소의 쿼리(행사의 업무 탭의 보기와 거르기)를 읽고 바꾼다. useMenuQuery의 기록 쪽이다.
// 바꿔도 기록을 쌓지 않는다(replace). 주소가 그 기록이 아니거나 recordId가 없으면 읽지도 쓰지도 않는다.
// 모르는 값의 주소를 고쳐 쓰는 일은 그 기록 화면(useEventAddress)이 한다.
export function useRecordQuery(kind: RecordKind, councilId: string, recordId: string | undefined) {
  const here = useHere()
  const { location } = here
  const open =
    recordId !== undefined &&
    location?.type === 'record' &&
    location.record === kind &&
    location.councilId === councilId.toLowerCase() &&
    location.recordId === recordId.toLowerCase()
      ? location
      : null
  return {
    query: open?.query ?? NONE,
    set: (patch: Record<string, string | null>) => {
      if (!open) return
      const path = appPath({ ...open, query: patchQuery(open.query, patch) })
      if (path !== here.path) navigate(path, { replace: true })
    },
  }
}
