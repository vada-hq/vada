import type { ReactNode } from 'react'

// 학생회 밖에서 보는 화면이 담기는 그릇(EXT-*).
//
// **폭이 390인 화면이 다섯 있다.** QR로 온 참석자와 링크로 온 설문 응답자가 보는
// 것이고, 그림이 휴대폰 목업 안에 그렸다. 그 앞의 모든 화면은 1288 폭이다.
//
// PageCard를 넓혀 쓸 수 없었다. 다섯 가지가 어긋난다 —
// · 세로 가운데 정렬(이 다섯은 위에서 아래로 흐르고 짧으면 아래가 빈다)
// · 카드 껍데기(테두리·그림자·안쪽 여백 40)가 없다. 흰 바탕이 뷰포트 전체다
// · 머리를 반드시 그린다(EXT-01B·02B·02C는 머리가 아예 없다)
// · 흐름 진행 표시를 그린다(다섯 중 어느 프레임도 그리지 않는다)
// · 페이지 바탕이 gray-50이다(그림은 gray-100)
//
// **기기 목업은 옮기지 않는다.** 상태바('9:41'·배터리)와 둥근 테두리는 화면이
// 아니라 그림이 화면을 보여 주려고 두른 것이다 — OPS-MEET-06B의 '실패 상태
// 미리보기'와 같은 판정이다.
//
// **폭을 고정하지 않는다.** 진짜 휴대폰(390~430)에서는 w-full이 이겨 기기 그대로이고,
// 넓은 창에서는 max-w-md(448)가 그림과 같은 좁은 흰 기둥을 만든다. 448인 까닭은
// 390 × 16/14다 — 와이어프레임의 루트 글꼴이 14px이고 앱은 16px이라, 안쪽 rem이
// 1.143배로 커지므로 그릇도 같은 비율이어야 내용과 그릇의 비가 그림과 같다
// (specs/figma/vada-wireframe/interpretation.md).

interface MobileScreenProps {
  /** 머리. 화면이 그린다 — 없는 화면이 셋이라 그릇이 정하지 않는다. */
  header?: ReactNode
  children: ReactNode
}

export function MobileScreen({ header, children }: MobileScreenProps) {
  return (
    <div className="flex min-h-screen justify-center bg-gray-100">
      <main className="flex min-h-screen w-full max-w-md flex-col bg-white">
        {header}
        {/* 좌우 여백 17.5 → px-5. 390 − 35 = 355로 그림과 정확히 떨어진다. */}
        <div className="flex flex-col px-5">{children}</div>
      </main>
    </div>
  )
}
