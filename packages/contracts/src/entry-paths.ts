import { APP_MENUS, RECORD_KINDS } from './paths.js'

// 서버 진입 목록(Hono 경로). 학생회와 기록 칸은 uuid만 받아, 모르는 꼴은 서버가 404로 돌린다.
// 끝 슬래시가 있는 꼴도 같은 화면이다. 옮겨 간 옛 꼴(council, 재정 아래 구매 요청 쓰기)도 남긴다. 지우면 북마크·새로고침이 404다.
const UUID_SEGMENT = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const withSlash = (paths: string[]) =>
  paths.flatMap(path => (path === '/' ? [path] : [path, `${path}/`]))
export const ENTRY_PATHS = [
  '/',
  '/index.html',
  ...withSlash([
    '/join/:code',
    '/apply/:code',
    '/r',
    '/auth-done',
    `/finance/:council{${UUID_SEGMENT}}/requests/new`,
    `/purchases/:council{${UUID_SEGMENT}}/new`,
    `/meetings/:council{${UUID_SEGMENT}}/new`,
    ...APP_MENUS.map(menu => `/${menu}/:council{${UUID_SEGMENT}}`),
    ...RECORD_KINDS.map(kind => `/${kind}/:council{${UUID_SEGMENT}}/:record{${UUID_SEGMENT}}`),
  ]),
]
