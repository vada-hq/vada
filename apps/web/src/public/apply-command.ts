import { newCommandId } from '@/lib/command-id'
import { sha256Hex } from '@/lib/sha256'

// 신청 화면이 기기에 두는 (번호, 본문 해시, 시각) 표지로, 양식 코드마다 하나다. 응답을 못 받고 화면을 닫았어도
// 같은 값으로 다시 보내면 같은 번호가 가서 서버가 같은 신청의 개인 링크를 다시 준다(017 개인 링크 복구).
// 이름·학번·휴대폰은 두지 않는다. 공용 기기에서 남의 값이 채워지거나 읽히면 안 된다(OWASP HTML5 저장소).
const MARKER_PREFIX = 'vada.apply-command.'
const SALT_KEY = 'vada.device-salt'
const SALT_BYTES = 16
const HEX = 16
const BYTE_DIGITS = 2
// 서버 영수증 보관과 같은 24시간이다. 그 뒤 같은 번호는 서버에서도 새 명령이다.
const HOURS = 24
const MS_PER_HOUR = 3_600_000
export const COMMAND_TTL_MS = HOURS * MS_PER_HOUR
// 학번·휴대폰은 값 공간이 작아 소금만으로는 부족하다. 해시를 되풀이해 값 하나를 맞춰 보는 비용을 키운다.
const STRETCH_ROUNDS = 5000

type Marker = { id: string; hash: string; at: number }

function store(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// 기기마다 무작위 소금. 같은 값도 기기마다 해시가 달라 미리 만든 표로 되돌릴 수 없다.
// 소금이 같은 기기에 있으니 그 기기를 가진 사람이 후보 값을 하나씩 대 볼 수는 있다. 그래서 되풀이로 비용을 키운다.
function deviceSalt(local: Storage): string {
  const saved = local.getItem(SALT_KEY)
  if (saved) return saved
  const bytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const salt = Array.from(bytes, byte => byte.toString(HEX).padStart(BYTE_DIGITS, '0')).join('')
  local.setItem(SALT_KEY, salt)
  return salt
}

function stretchedHash(salt: string, body: object): string {
  let hash = sha256Hex(`${salt}:${JSON.stringify(body)}`)
  for (let round = 0; round < STRETCH_ROUNDS; round++) hash = sha256Hex(`${salt}:${hash}`)
  return hash
}

function readMarker(local: Storage, code: string): Marker | null {
  try {
    const parsed: unknown = JSON.parse(local.getItem(MARKER_PREFIX + code) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return null
    const { id, hash, at } = parsed as Record<string, unknown>
    if (typeof id !== 'string' || typeof hash !== 'string' || typeof at !== 'number') return null
    return { id, hash, at }
  } catch {
    return null
  }
}

// 보낼 본문(번호를 뺀 값)이 앞 시도와 같으면 같은 번호, 다르거나 24시간이 지났으면 새 번호를 두고 돌려준다.
// 시각은 처음 번호를 만든 때다. 다시 써도 늘리지 않아 서버 영수증이 지워질 때 함께 끝난다.
export function applyCommandId(code: string, body: object, now = Date.now()): string {
  const local = store()
  if (!local) return newCommandId()
  try {
    const hash = stretchedHash(deviceSalt(local), body)
    const marker = readMarker(local, code)
    if (marker && marker.hash === hash && now - marker.at < COMMAND_TTL_MS) return marker.id
    const fresh: Marker = { id: newCommandId(), hash, at: now }
    local.setItem(MARKER_PREFIX + code, JSON.stringify(fresh))
    return fresh.id
  } catch {
    // 가득 찼거나 막혔다. 기억하지 못할 뿐 신청에는 영향이 없다.
    return newCommandId()
  }
}

export function clearApplyCommand(code: string) {
  try {
    store()?.removeItem(MARKER_PREFIX + code)
  } catch {
    // 지우지 못해도 24시간 뒤 쓰지 않는다.
  }
}
