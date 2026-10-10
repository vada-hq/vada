import { useEffect, useState } from 'react'
import ApplyPage from './ApplyPage'
import MyRegistrationPage from './MyRegistrationPage'
import { tokenFromHash, type PublicRoute } from './public-route'

// 로그인 없이 쓰는 화면. 주소에 따라 공개 신청 화면이나 내 신청 화면을 그린다.
export default function PublicApp({ route }: { route: PublicRoute }) {
  return route.kind === 'apply' ? <ApplyPage code={route.code} /> : <Mine />
}

// 내 신청: 주소의 # 뒤가 바뀌면(다른 개인 링크를 열면) 새 토큰으로 처음부터 다시 그린다.
function Mine() {
  const [token, setToken] = useState(() => tokenFromHash(window.location.hash))
  useEffect(() => {
    const changed = () => setToken(tokenFromHash(window.location.hash))
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  return <MyRegistrationPage key={token ?? ''} token={token} />
}
