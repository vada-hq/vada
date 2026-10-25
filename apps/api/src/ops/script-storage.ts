import { readLocalEnv } from '../local-env.js'
import { createR2Storage, r2ConfigFrom, type FileStorage } from '../storage/storage.js'

// 운영 명령(demo, privacy erase-messages)의 사진 저장소(R2). 값은 셸이 .env보다 앞선다. .env가 없어도 셸에 있으면 된다.
// 값은 읽어 쓰기만 하고 찍지 않는다. 넷 중 하나라도 없으면 null이다.
export function scriptStorage(): FileStorage | null {
  let fileEnv: NodeJS.ProcessEnv = {}
  try {
    fileEnv = readLocalEnv()
  } catch {
    // .env가 없으면 셸의 값만 쓴다.
  }
  const config = r2ConfigFrom({ ...fileEnv, ...process.env })
  return config ? createR2Storage(config) : null
}
