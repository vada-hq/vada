import { useState } from 'react'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from './params'
import { NotServedYet, getMutation, runMutation } from './mutations'
import type { SubmitAction } from './types'

/**
 * 명세가 submit이라고 말한 버튼이 **실제로 보내게** 한다.
 *
 * 이 갈고리가 있는 이유는 없던 시절에 드러났다. 2026-08-27 감사에서 재정 화면
 * 셋(FIN-SUP-01·FIN-REV-01·FIN-EVID-01)이 `messages.submitting`을 화면에
 * **써 놓기만 하고** 곧장 이동하는 것이 발견됐다 - 저장·재제출·검토 완료가
 * 실제로 일어나지 않았는데 성공 화면으로 갔다. 게이트 넷이 다 놓쳤다.
 *
 * 원인은 하나다: **같은 열 몇 줄을 화면마다 손으로 옮겨 적었다.** 두 곳은
 * 옳게, 세 곳은 틀리게 적었다. 그래서 옮겨 적을 수 없게 만든다.
 *
 * 화면마다 갈리는 것 - 무엇을 보내는가(payload), 어디로 가는가의 인자 - 만
 * 받는다. 언제 보내고 무엇을 그리고 실패하면 어떻게 되는지는 여기가 정한다.
 */
export type SubmitPhase = 'idle' | 'submitting' | 'error'

/**
 * 아직 서버에 붙지 않은 자리에서 그리는 글.
 *
 * **카탈로그가 들 수 없는 글이다.** 명세는 이 자리가 무엇을 하는지 말하지 이 저장소가
 * 어디까지 지었는지는 모른다 — 그것은 만드는 쪽의 사정이고, 다 지으면 사라진다.
 * `ScreenRouter`가 아직 등록되지 않은 화면에 쓰는 글과 같은 자리다.
 */
const NOT_SERVED_NOTE = '이 자리는 아직 서버에 붙지 않았습니다. 눌러도 아무것도 저장되지 않습니다.'

export interface SubmitRunOptions {
  /** 보낼 값. 무엇을 보낼지는 화면이 안다(계약은 mutations.json이 갖는다). */
  payload: unknown
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  /**
   * 넘길 인자를 **명세에서** 읽을 때 그 값들이 어디 있는지.
   *
   * 예전에는 화면이 `navigateParams`로 직접 적었다 — 그러면 명세만 읽고 화면을
   * 만드는 사람은 그 인자를 넘겨야 한다는 사실을 알 수 없다. 다섯 자리가 그렇게
   * 명세에 없는 배선을 갖고 있었다.
   */
  paramSources?: {
    screenParams?: Record<string, string>
    fields?: Record<string, string | null>
    row?: DataRow
  }
  /**
   * 명세에서 읽어 낼 수 없는 인자만 여기 적는다.
   *
   * 자리가 실어 가는 인자는 `action.params`가 이미 말하므로 여기가 비는 것이
   * 정상이다 — 화면이 적으면 명세만 읽고 만드는 사람은 그 인자를 알 수 없다.
   */
  params?: Record<string, string>
  /** onSuccess.scopeEvent가 있는 명세에는 반드시 있어야 한다. */
  onScopeEvent?: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export interface SubmitActionState {
  phase: SubmitPhase
  /** 보내고 나면 어디로 가는지가 아직 정해지지 않았음을 알리는 글. */
  pendingNote: string | null
  /** 실패한 까닭이 '고장'이 아니라 '아직 안 지음'인가. */
  notServed: boolean
  /** 지금 보내는 중인 계약. 무엇을 그릴지 고를 때 쓴다. */
  runningKey: string | null
  /** 보내는 중이면 카탈로그가 준 글. 아니면 null. */
  submittingMessage: string | null
  /** 실패했을 때 카탈로그가 준 글. 실패한 적 없으면 null. */
  errorMessage: string | null
  /** 보내는 중이면 카탈로그의 submitting 문구, 아니면 원래 이름. */
  labelOf: (action: SubmitAction, label: string) => string
  run: (action: SubmitAction, options: SubmitRunOptions) => Promise<void>
}

export function useSubmitAction(): SubmitActionState {
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [runningKey, setRunningKey] = useState<string | null>(null)
  // 보내고 나면 어디로 가는지가 아직 정해지지 않았을 때 명세가 적어 둔 글.
  const [pendingNote, setPendingNote] = useState<string | null>(null)
  // 실패한 까닭이 '고장'인지 '아직 안 지음'인지. 둘을 같은 글로 말하면 사람이
  // 고쳐질 것을 기다리며 새로고침한다.
  const [notServed, setNotServed] = useState(false)

  async function run(action: SubmitAction, options: SubmitRunOptions) {
    const mutation = getMutation(action.mutationKey)

    // 스코프를 비우라고 말하는 명세에는 어느 스코프인지가 있어야 한다.
    // 없으면 조용히 건너뛰지 않고 드러낸다.
    if (action.onSuccess.scopeEvent !== undefined) {
      if (options.onScopeEvent === undefined) {
        throw new Error(
          `'${action.mutationKey}'는 onSuccess.scopeEvent를 말하는데 화면이 onScopeEvent를 주지 않았습니다.`,
        )
      }
      if (!mutation.payloadScope) {
        throw new Error(
          `'${action.mutationKey}'는 scopeEvent를 말하는데 카탈로그에 payloadScope가 없습니다.`,
        )
      }
    }

    setPhase('submitting')
    setRunningKey(action.mutationKey)
    // 보내고 나서야 아는 값이 있다(만든 것의 id). 명세가 그것을 가리킬 수 있다.
    let result: DataRow = {}
    try {
      // **자리가 실어 가는 인자는 명세에서 읽는다.** 화면마다 손으로 넘기게 하면
      // 스물한 자리 중 몇은 잊고, 잊은 자리는 서버가 누구의 것인지 모른 채 돈다 —
      // 이 갈고리가 생긴 까닭이 바로 그 옮겨 적기였다.
      const carried = {
        ...resolveParams(action.params, options.paramSources ?? {}),
        ...(options.params ?? {}),
      }
      result = await runMutation(action.mutationKey, options.payload, carried)
    } catch (thrown) {
      // 실패는 머무는 것이다. 어디로도 가지 않고 runningKey를 남겨 어느 계약이
      // 실패했는지 화면이 말할 수 있게 한다.
      //
      // **아직 안 붙은 자리는 따로 말한다.** 카탈로그의 error 문구는 '고쳐질 고장'을
      // 뜻하는데, 이것은 아직 만들지 않은 것이다 — 사람이 새로고침하며 기다리게 하지 않는다.
      setNotServed(thrown instanceof NotServedYet)
      setPhase('error')
      return
    }

    setPhase('idle')
    setRunningKey(null)
    if (action.onSuccess.scopeEvent !== undefined) {
      options.onScopeEvent!(mutation.payloadScope, action.onSuccess.scopeEvent)
    }
    if (action.onSuccess.navigate !== undefined) {
      options.onNavigate(
        action.onSuccess.navigate,
        resolveParams(action.onSuccess.params, { ...(options.paramSources ?? {}), result }),
      )
      return
    }
    // 갈 곳이 아직 정해지지 않았다고 명세가 적어 두었으면 그 글을 내놓는다.
    // 적어만 두고 아무도 안 보여주면 명세에만 있는 사실이 된다 — 보내고 나서
    // 아무 일도 안 일어나는 것처럼 보이는 자리가 바로 여기다.
    if (action.onSuccess.note !== undefined) {
      setPendingNote(action.onSuccess.note)
    }
  }

  return {
    phase,
    runningKey,
    pendingNote,
    notServed,
    submittingMessage:
      phase === 'submitting' && runningKey !== null
        ? getMutation(runningKey).messages.submitting
        : null,
    errorMessage:
      phase !== 'error' || runningKey === null
        ? null
        : notServed
          ? NOT_SERVED_NOTE
          : getMutation(runningKey).messages.error,
    labelOf: (action, label) =>
      runningKey === action.mutationKey && phase === 'submitting'
        ? getMutation(action.mutationKey).messages.submitting
        : label,
    run,
  }
}
