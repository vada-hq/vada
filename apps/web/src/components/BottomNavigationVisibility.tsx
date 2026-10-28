import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'

const Visibility = createContext<{
  hidden: boolean
  setCount: Dispatch<SetStateAction<number>>
} | null>(null)

// 방·겹친 창이 각자 자기 신호를 거둔다. 안쪽 창 하나를 닫아도 바깥 창이 열려 있으면 계속 숨긴다.
export function BottomNavigationVisibility({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const value = useMemo(() => ({ hidden: count > 0, setCount }), [count])
  return <Visibility value={value}>{children}</Visibility>
}

export const useBottomNavigationHidden = () => useContext(Visibility)?.hidden ?? false

export function useHideBottomNavigation(hidden = true) {
  const setCount = useContext(Visibility)?.setCount
  useEffect(() => {
    if (!hidden || !setCount) return
    setCount(count => count + 1)
    return () => setCount(count => count - 1)
  }, [hidden, setCount])
}
