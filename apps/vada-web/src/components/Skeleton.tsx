// **기다리는 동안 그리는 것.**
//
// 와이어프레임에 로딩 화면이 없다 — 여든여섯 장 중 한 장도 그리지 않았다. 명세는
// 출처마다 '…불러오는 중입니다'라는 **글**만 갖고, 그 글을 어떻게 보일지는 정하지
// 않는다(이 저장소의 규칙: 명세가 표현을 정하지 않는다). 그래서 여기가 그 표현을
// 정하는 자리다.
//
// **글 대신 자리를 그린다**(사람이 정했다, 2026-09-06). 배포된 홈이 그 까닭을
// 보여 줬다: 홈은 일곱 자리를 읽으므로 문구가 일곱 줄로 쌓였고, 셸도 없어 흰 바탕에
// 글만 떠 있었다. 채워질 모양대로 회색 블록이 뜨면 오는 동안 화면이 흔들리지 않고
// 몇 자리를 기다리는지가 줄 수가 아니라 **자리의 모양**으로 보인다.
//
// **글을 버리지는 않는다.** 명세가 적어 둔 문구는 `aria-label`로 남는다 — 눈으로
// 읽는 사람에게는 모양이, 읽어 주는 기계에게는 그 글이 간다.

/**
 * 회색 줄 몇 개. **알리는 자리가 아니다** — 기다린다는 말은 감싼 쪽이 한 번만 한다.
 * 겹쳐 두면 읽어 주는 기계가 같은 말을 여러 번 하고, 검사도 어느 것을 볼지 못 고른다.
 */
function Bars({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-white p-4">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded bg-gray-200"
          // 줄마다 길이를 달리해 글 뭉치처럼 보이게 한다. 마지막 줄이 짧다.
          style={{ width: index === rows - 1 ? '55%' : index === 0 ? '35%' : '100%' }}
        />
      ))}
    </div>
  )
}

/** 한 자리가 채워질 동안. 블록 몇 줄이 뜬다. */
export function Skeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label}>
      <Bars rows={rows} />
    </div>
  )
}

/**
 * 화면 하나가 통째로 채워질 동안.
 *
 * **셸의 값을 읽지 않는다.** 기다리는 자리에서 셸을 그렸더니 셸도 서버를 읽어 다시
 * 멈췄고, 본문이 와도 다시 그려지지 않아 화면이 영영 '불러오는 중'에 머물렀다
 * (2026-09-05, 카나리가 잡았다). 그래서 셸의 **모양만** 회색으로 그린다 — 읽는 것이
 * 없으므로 멈출 일이 없고, 사람은 왼쪽 메뉴가 있을 자리를 본다.
 */
export function ScreenSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 shrink-0 flex-col gap-2 border-r border-gray-200 bg-white p-4">
        <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="h-3 w-28 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-2 gap-4">
          <Bars rows={4} />
          <Bars rows={4} />
        </div>
        <Bars rows={5} />
      </div>
    </div>
  )
}
