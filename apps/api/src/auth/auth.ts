import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { accounts, sessions, users, verifications } from '../db/schema.js'

export const AUTH_SECRET_MIN_LENGTH = 32

export type AuthConfig = {
  secret: string
  baseURL: string
  googleClientId: string
  googleClientSecret: string
}

// Google 프로필 사진과 토큰은 쓰지 않으므로 저장하지 않는다(처리방침 1조 ②, DEC-53). better-auth는 처음 로그인,
// 다시 로그인, 계정 잇기, 토큰 갱신, 내 정보 바꾸기에서 이 값을 쓰는데, 모두 아래 표 쓰기를 지나므로 여기서 한 번에 비운다.
// mapProfileToUser는 로그인 경로 하나만 막아 쓰지 않는다.
const NO_PROFILE_IMAGE = { image: null }
const NO_PROVIDER_TOKENS = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
}
const withoutGoogleValues = <T extends object>(blank: T) => ({
  before: <D extends object>(data: D) => Promise.resolve({ data: { ...data, ...blank } }),
})
const googleValueHooks = {
  user: {
    create: withoutGoogleValues(NO_PROFILE_IMAGE),
    update: withoutGoogleValues(NO_PROFILE_IMAGE),
  },
  account: {
    create: withoutGoogleValues(NO_PROVIDER_TOKENS),
    update: withoutGoogleValues(NO_PROVIDER_TOKENS),
  },
}

export function createAuth(db: Parameters<typeof drizzleAdapter>[0], config: AuthConfig) {
  if (config.secret.length < AUTH_SECRET_MIN_LENGTH)
    throw new Error('BETTER_AUTH_SECRET must have at least 32 characters')
  if (!config.googleClientId || !config.googleClientSecret)
    throw new Error('Google OAuth configuration is required')
  const origin = new URL(config.baseURL).origin
  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: '/api/auth',
    trustedOrigins: [origin],
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: users, account: accounts, session: sessions, verification: verifications },
      transaction: true,
    }),
    databaseHooks: googleValueHooks,
    socialProviders: {
      google: { clientId: config.googleClientId, clientSecret: config.googleClientSecret },
    },
    emailAndPassword: { enabled: false },
    // 다시 로그인할 때 새 토큰으로 계정 행을 고치지 않는다. 비울 값뿐이라 쓸모없는 쓰기다.
    account: { accountLinking: { enabled: false }, updateAccountOnSignIn: false },
    // DB·외부 인증 오류 원문에 인증 정보가 포함될 수 있어 출력하지 않는다.
    logger: { disabled: true },
  })
}
