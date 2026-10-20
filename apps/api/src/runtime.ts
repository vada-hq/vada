import { AUTH_SECRET_MIN_LENGTH } from './auth/auth.js'
import { readLocalEnv } from './local-env.js'

const PORT_MAX = 65535

function readLocalEnvironment(): NodeJS.ProcessEnv {
  try {
    return readLocalEnv()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error('로컬 환경설정을 읽을 수 없습니다.')
  }
}

export function readRuntime(
  environment: NodeJS.ProcessEnv,
  forceProduction = false,
  readLocal = readLocalEnvironment,
) {
  const production = forceProduction || environment.NODE_ENV === 'production'
  const env: NodeJS.ProcessEnv = production ? {} : { ...readLocal() }
  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined) env[key] = value
  }
  const required = [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ]
  if (
    required.some(key => !env[key]?.trim()) ||
    env.BETTER_AUTH_SECRET!.length < AUTH_SECRET_MIN_LENGTH
  ) {
    throw new Error('필수 서버 환경설정을 확인하세요.')
  }
  let baseURL: URL
  try {
    baseURL = new URL(env.BETTER_AUTH_URL!)
  } catch {
    throw new Error('인증 URL 설정을 확인하세요.')
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(baseURL.hostname)
  if (
    !['http:', 'https:'].includes(baseURL.protocol) ||
    baseURL.username ||
    baseURL.password ||
    baseURL.search ||
    baseURL.hash ||
    baseURL.pathname !== '/' ||
    (production && baseURL.protocol !== 'https:' && !loopback)
  ) {
    throw new Error('인증 URL은 서비스 원점이어야 하며 운영 환경은 HTTPS가 필요합니다.')
  }
  const rawPort = env.PORT ?? '8891'
  const port = Number(rawPort)
  if (!/^\d+$/.test(rawPort) || port < 1 || port > PORT_MAX)
    throw new Error('PORT 설정을 확인하세요.')
  const hostname = env.HOST?.trim() || (production ? '0.0.0.0' : '127.0.0.1')
  return { env, production, hostname, port }
}
