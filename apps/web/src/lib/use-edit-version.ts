import { useState } from 'react'
import { useActive } from './use-active'

// 고치는 화면의 판. 연 때의 판을 쥐고 저장한다: 15초 읽기로 화면의 값이 새로워져도 판을 따라가면 남이 먼저 고친 것을 놓친다.
// 저장이 막히면(VERSION_CONFLICT) refresh로 새 값을 읽어 판을 옮긴다. 쓰던 입력은 그대로이고, 새 값을 본 뒤 다시 저장하면 그 판으로 간다.
// 읽지 못하면 판을 그대로 둔다. 다시 저장하면 또 막혀 다시 읽는다.
export function useEditVersion<T extends { versionNo: number }>(
  versionNo: number | undefined,
  read: () => Promise<T | null>,
) {
  const [version, setVersion] = useState(versionNo)
  const [fresh, setFresh] = useState<T | null>(null)
  const active = useActive()
  async function refresh() {
    const next = await read()
    if (!next || !active()) return
    setVersion(next.versionNo)
    setFresh(next)
  }
  return { version, fresh, refresh }
}
