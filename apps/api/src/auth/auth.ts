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
    socialProviders: {
      google: { clientId: config.googleClientId, clientSecret: config.googleClientSecret },
    },
    emailAndPassword: { enabled: false },
    account: { accountLinking: { enabled: false } },
    // DB·외부 인증 오류 원문에 인증 정보가 포함될 수 있어 출력하지 않는다.
    logger: { disabled: true },
  })
}
