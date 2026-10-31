import { useState } from 'react'
import { useUnsavedInput, useWindowLeave } from '@/lib/leave-guard'
import { afterAllWindowEntries } from '@/lib/use-window-history'
import { saveToken } from './saved-links'
import { EMPTY_VALUES, hasInput, useApply, type ApplyValues } from './useApply'

type Options = {
  code: string
  // 지금 칸이 보이는가. 칸이 사라지면 잃을 입력이 보이지 않으니 묻지 않는다.
  writing: boolean
  reload: () => void
  onLost: () => void
  onApplied: (token: string) => void
}

// 쓰는 중인 신청과 그것을 떠날 때의 확인.
// 쓴 값은 이 화면의 메모리에만 있어(기기에 두지 않는다) 떠나면 사라진다. 그래서 입력이 있으면 떠나기 전에 묻는다.
// 새로 고침은 브라우저가 묻고, 뒤로는 첫 입력부터 쓰는 기록 한 칸이 받아 이 화면이 묻는다.
export function useApplyDraft({ code, writing, reload, onLost, onApplied }: Options) {
  const [values, setValues] = useState<ApplyValues>(EMPTY_VALUES)
  // 기록 칸은 값을 모두 지워도 둔다. 칸을 거두는 이동이 스크롤을 옮기기 때문이다. 입력이 없으면 묻지 않고 떠날 뿐이다.
  const [started, setStarted] = useState(false)
  const apply = useApply({
    code,
    reload,
    onLost,
    onApplied: token => {
      saveToken(code, token)
      setStarted(false)
      // 칸을 남기고 주소를 바꾸면 내 신청의 뒤로가 신청 칸으로 돌아온다(PublicApp).
      // 기록 이동의 popstate 안에서 주소를 바꾸면 브라우저가 그 이동을 취소해 화면에 남는다.
      afterAllWindowEntries(() => setTimeout(() => onApplied(token), 0))
    },
  })
  const leave = useWindowLeave(() => {
    setStarted(false)
    // 첫 칸이면 뒤로가 아무 일도 하지 않아 화면에 남는다. 버리기로 한 값은 그때도 남기지 않는다. 보내는 중인 값은 실패하면 다시 쓴다.
    if (!apply.busy) setValues(EMPTY_VALUES)
    afterAllWindowEntries(() => window.history.back())
  })
  // 보내는 동안은 묻지 않고, 신청이 되면 busy가 이동까지 이어진다. 실패하면 다시 지킨다.
  useUnsavedInput(writing && hasInput(values) && !apply.busy, leave.holder)
  return {
    apply,
    values,
    write: (next: ApplyValues) => {
      apply.clearProblem()
      setValues(next)
      setStarted(true)
    },
    holdsBack: started && writing,
    back: leave.close,
  }
}

export type ApplyDraft = ReturnType<typeof useApplyDraft>
