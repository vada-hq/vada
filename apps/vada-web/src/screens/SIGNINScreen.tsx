import { PageCard } from '../components/PageCard'
import { drawsElement } from '../spec/drawn-when'
import { nodeIdOf, signIn } from '../spec/screens'
import type { ButtonSpec, SubmitAction } from '../spec/types'
import { useSubmitAction } from '../spec/useSubmitAction'

/**
 * 들어오는 자리(SIGN-IN).
 *
 * **이 화면은 한동안 명세 밖에 있었다.** 와이어프레임이 이미 들어온 사람만 그려서 로그인
 * 그림이 없었고, 그래서 손으로 짠 화면이었다 — 어디로 돌아올지도 손으로 적었고 그것이
 * 틀려서 구글을 다녀온 사람이 제자리로 왔다. 그림을 그려 명세로 옮겼다(2026-09-02).
 *
 * 이제 나머지 여든과 같다. 무엇을 그릴지·어느 길이 열렸는지·누르면 무엇을 보낼지를
 * 전부 명세가 말한다.
 */
export function SIGNINScreen() {
  const submitAction = useSubmitAction()

  // **어느 길이 열렸는지는 배포가 정한다.** 카카오 열쇠를 안 넣은 배포에서 카카오
  // 단추를 그리면 눌러도 안 되고, 사람은 자기 잘못인 줄 안다.
  const ways = signIn.elements.filter(
    (element) => element.spec.type === 'button' && drawsElement(element, {}),
  )

  return (
    <PageCard screen={signIn}>
      <div className="flex flex-col gap-3 pt-6">
        {ways.map((element) => {
          const button = element.spec as ButtonSpec
          const action = button.action as SubmitAction
          return (
            <button
              key={button.label}
              type="button"
              data-node-id={nodeIdOf(signIn, button)}
              disabled={submitAction.phase === 'submitting'}
              onClick={() => {
                // **보내는 것이 없다.** 어느 길인지는 자리가 정하고(계약의 path),
                // 돌아올 자리는 서버가 붙인다 — 화면이 만들면 자기 자신을 넘긴다.
                void submitAction.run(action, { payload: {}, onNavigate: () => {} })
              }}
              className="flex w-full items-center gap-4 rounded-md border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none disabled:opacity-60"
            >
              <span className="min-w-0 grow text-sm font-semibold text-gray-900">
                {submitAction.labelOf(action, button.label)}
              </span>
            </button>
          )
        })}
      </div>

      {/* 글은 갈고리가 고른다 — '고장'과 '아직 안 지음'을 갈라 준다. */}
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-3 text-center text-xs text-red-600">
          {submitAction.errorMessage}
        </p>
      )}

      {signIn.meta?.footerNote && (
        <p className="pt-4 text-center text-xs text-gray-400">{signIn.meta.footerNote}</p>
      )}
    </PageCard>
  )
}
