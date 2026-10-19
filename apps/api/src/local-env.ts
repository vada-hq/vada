import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

// 로컬 .env는 저장소 맨 위에 하나 있다. 읽는 파일마다 상대 경로를 따로 쓰면 파일을 옮길 때 서로 다른 파일을 가리키게 되므로, 위치를 정하는 곳은 여기 하나다.
// 맨 위는 .node-version이 있는 폴더다(Node 버전을 정하는 파일, AGENTS.md 실행 환경).
const ROOT_MARKER = '.node-version'

// start 폴더에서 위로 올라가며 저장소 맨 위를 찾아 그곳의 .env 경로를 돌려준다. 파일이 있는지는 보지 않는다.
export function repoEnvPath(start = dirname(fileURLToPath(import.meta.url))): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, ROOT_MARKER))) return join(dir, '.env')
    if (dirname(dir) === dir) throw new Error('저장소 맨 위를 찾지 못했다.')
  }
}

// .env를 환경 변수 모양으로 읽는다. 파일이 없으면 ENOENT를 그대로 던져 부르는 쪽이 정한다.
export function readLocalEnv(path = repoEnvPath()): NodeJS.ProcessEnv {
  return parseEnv(readFileSync(path, 'utf8'))
}
