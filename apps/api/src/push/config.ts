// 휴대폰 알림(웹 푸시)의 서버 열쇠(VAPID). 셋이 모두 있어야 켠다.
// 일부만 있으면 설정 실수이므로 서버를 시작하지 않는다. 오류에 값을 넣지 않는다.
export interface PushConfig {
  publicKey: string
  privateKey: string
  subject: string
}

// URL용 base64(패딩 없음)만 받는다.
const bytesOf = (value: string) =>
  /^[A-Za-z0-9_-]+$/.test(value) ? Buffer.from(value, 'base64url') : null

export function pushConfigFrom(env: NodeJS.ProcessEnv): PushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? ''
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? ''
  const subject = env.VAPID_SUBJECT?.trim() ?? ''
  const given = [publicKey, privateKey, subject].filter(Boolean).length
  if (given === 0) return null
  if (given < 3) throw new Error('알림 열쇠 설정(VAPID) 세 값을 모두 넣거나 모두 빼세요.')
  // 공개 열쇠는 P-256 점(65바이트, 0x04로 시작), 비밀 열쇠는 32바이트다.
  const point = bytesOf(publicKey)
  if (!point || point.length !== 65 || point[0] !== 4 || bytesOf(privateKey)?.length !== 32) {
    throw new Error('알림 열쇠(VAPID) 형식을 확인하세요.')
  }
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject))
    throw new Error('VAPID_SUBJECT는 mailto: 또는 https: 주소여야 합니다.')
  return { publicKey, privateKey, subject }
}
