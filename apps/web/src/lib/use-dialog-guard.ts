import { useEffect } from 'react'
import { useLatest } from './use-latest'

// 대화상자가 열려 있는 동안 다시 읽은 값이 그 대화상자를 더는 열어 둘 수 없게 했으면(권한을 잃음, 고치던 대상이 사라짐)
// 닫고 이유를 보인다. reason은 닫아야 하는 이유이고 null이면 그대로 둔다. 읽기 전의 값처럼 아직 모르는 때도 null이다.
export function useDialogGuard(
  open: boolean,
  reason: string | null,
  lost: (message: string) => void,
) {
  const latest = useLatest(lost)
  useEffect(() => {
    if (open && reason !== null) latest.current(reason)
  }, [open, reason, latest])
}
