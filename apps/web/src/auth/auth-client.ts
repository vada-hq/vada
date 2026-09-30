import { createAuthClient } from 'better-auth/react'

// 같은 출처의 /api/auth를 사용한다. 인증 비밀값은 브라우저에 전달하지 않는다.
export const authClient = createAuthClient()
