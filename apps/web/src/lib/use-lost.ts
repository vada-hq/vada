import { useEffect, useRef } from 'react'
import { useLatest } from './use-latest'

// 화면 값을 가져온 읽기 하나. 읽을 때마다 새 객체라, 값이 바뀐 그 읽기가 어느 것인지 가린다.
// own은 내 요청이 성공해 부른 다시 읽기인지다.
export type Reading = { readonly own: boolean }

// 이번에 바뀐 값이 내 요청 성공으로 부른 다시 읽기에서 왔는가. 읽기가 그대로면(다시 읽기가 실패했거나 다른 값이 바뀌었으면)
// 내 변경에서 온 값이 아니다. 내가 바꿔 생긴 사라짐은 알리지 않고 바깥 변경은 알린다(docs/work-method.md '자주 잡힌 것' 1번).
export const changedByOwnRead = (before: Reading | undefined, now: Reading | undefined) =>
  now !== undefined && now !== before && now.own

// 있던 것(권한, 대상)이 없어진 순간 한 번 onLost를 부른다. 처음부터 없던 것에는 부르지 않는다.
// 없어진 자리에 아무 말이 없으면 사용자는 까닭을 모른다. reading을 주면 내 변경에서 온 값으로 없어진 때는 부르지 않는다.
export function useLost(has: boolean, onLost: () => void, reading?: Reading) {
  const before = useRef({ has, reading })
  const latest = useLatest(onLost)
  useEffect(() => {
    const previous = before.current
    before.current = { has, reading }
    if (previous.has && !has && !changedByOwnRead(previous.reading, reading)) latest.current()
  }, [has, reading, latest])
}
