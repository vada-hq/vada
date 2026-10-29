import type { C1rProps } from '../c1r-props'

// v3 자리. 이 폴더(v3/) 안만 고친다. 공용 파일(../c1r-data.ts, ../c1r-props.ts, ../C1rPreview.tsx)은 읽기만 한다.
// 기본 내보내기 하나가 컴포넌트 전체다. 바깥 여백·폭은 껍데기가 맞추므로 이 컴포넌트는 폭 전체를 쓴다.
export default function C1rV3(_: C1rProps) {
  return (
    <section className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-500">
      v3 자리
    </section>
  )
}
