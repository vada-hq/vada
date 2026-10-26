import { createContext, useContext } from 'react'

export type DirectPerson = { id: string; name: string }

// 작업 공간이 주는 1:1 열기(022 조각 7). 이름 누르기와 입력칸 '/'가 같이 쓴다.
// people은 지금 운영진이다. 떠난 사람은 여기에 없어 누를 수 없다.
export type DirectOpener = {
  meId: string
  people: DirectPerson[]
  // draft: '/이름' 뒤에 친 글. 연 1:1의 입력칸으로 옮긴다.
  open: (person: DirectPerson, draft?: string) => void
}

// 1:1을 열 수 없는 곳(권한 없음, 작업 공간 밖의 부품 확인 화면·시험)에서는 null이라 이름은 글로만 보인다.
export const DirectOpenContext = createContext<DirectOpener | null>(null)

export const useDirectOpener = () => useContext(DirectOpenContext)

// 이름을 누를 때 할 일. 나, 지금 운영진이 아닌 사람(떠난 사람, 보낸 사람 없는 글), 열 수 없는 곳이면 없다.
export function useOpenDirectFor() {
  const opener = useDirectOpener()
  return (memberId: string | null | undefined) => {
    if (!opener || !memberId || memberId === opener.meId) return undefined
    const person = opener.people.find(item => item.id === memberId)
    return person && (() => opener.open(person))
  }
}
