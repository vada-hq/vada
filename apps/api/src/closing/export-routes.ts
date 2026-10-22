import { Hono, type Context } from 'hono'
import {
  ClosingExportQuerySchema,
  koreanDateOf,
  type Closing,
  type ClosingExportInfo,
  type ClosingExportQuery,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, councilIdOf, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { attachmentHeaders, safeFileName } from '../http/download.js'
import { ApiError } from '../http/errors.js'
import { parseQuery } from '../http/query.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import type { FileStorage } from '../storage/storage.js'
import { requireStorage } from '../storage/uploads.js'
import { BUNDLE_LIMIT, bundleStream } from './bundle.js'
import {
  accountRowsForExport,
  expenseRowsForExport,
  incomeRowsForExport,
  photoRowsForExport,
} from './export-rows.js'
import { closingPeriodOf } from './period.js'
import { closingOf } from './queries.js'
import { workbookOf, type ExportKind } from './workbook.js'

const root = '/organizations/:councilId/fiscal-periods/:periodId/closing'
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ZIP_TYPE = 'application/zip'
const LABEL: Record<ExportKind, string> = { public: '공개용', audit: '감사용' }

// 읽기는 한 시점의 모습이다. 엑셀의 수입·지출 줄이 결산서 숫자와 어긋나 보이지 않게 한다.
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 상한은 exportInfo의 값 그대로다(판단은 export-info.ts 한 곳). 엑셀은 줄 수만, 묶음은 사진 수와 크기도 본다.
function assertWithinLimits(info: ClosingExportInfo, withPhotos: boolean) {
  if (withPhotos ? info.bundleTooLarge : info.workbookTooLarge)
    throw new ApiError('EXPORT_TOO_LARGE')
}

type ExportRequest = { userId: string; councilId: string; periodId: string; now: Date }

type Exported = Awaited<ReturnType<typeof loadExport>>

// 거래 안에서 모두 읽는다. 사진은 저장소에서 읽을 키만 들고 나가고, 바이트는 거래 밖에서 한 장씩 읽는다.
// 공개용은 공개 전 재정부, 공개 뒤 모든 운영진이고 감사용은 재정부만이다(actions가 그 판단이다). 상한은 권한 뒤에 본다.
async function loadExport(db: Db, request: ExportRequest, kind: ExportKind, withPhotos: boolean) {
  return db.transaction(async tx => {
    const actor: Actor = await authorize(tx, { ...request, action: 'council.view' })
    const closing: Closing = await closingOf(tx, actor, request.periodId, request.now)
    const allowed = kind === 'public' ? 'closing.export_public' : 'closing.export_audit'
    if (!closing.actions.includes(allowed)) throw new ApiError('FORBIDDEN')
    assertWithinLimits(closing.exportInfo, withPhotos)
    const period = await closingPeriodOf(tx, actor, request.periodId)
    const expenses = await expenseRowsForExport(tx, actor, period)
    return {
      closing,
      expenses,
      incomes: await incomeRowsForExport(tx, actor, period),
      accounts: kind === 'audit' ? await accountRowsForExport(tx, actor) : [],
      photos: withPhotos ? await photoRowsForExport(tx, expenses) : [],
    }
  }, snapshot)
}

const workbookInputOf = (kind: ExportKind, loaded: Exported) => ({
  kind,
  closing: loaded.closing,
  incomes: loaded.incomes,
  expenses: loaded.expenses,
  accounts: loaded.accounts,
})

const fileNameOf = (loaded: Exported, kind: ExportKind, now: Date, extension: string) =>
  safeFileName(
    `${loaded.closing.period.name} 결산(${LABEL[kind]}) ${koreanDateOf(now)}.${extension}`,
  )

// 묶음을 흘려보낼 스트림. 학생회마다 한 번에 하나, 계정마다 한도가 있다(429). 상태는 서버 메모리라 인스턴스가 하나일 때만 맞다(기능 003 '서버 메모리').
async function startBundle(
  kit: { running: Set<string>; limiter: RateLimiter; storage: FileStorage },
  request: ExportRequest,
  loaded: Exported,
  signal: AbortSignal,
) {
  if (kit.running.has(request.councilId) || !kit.limiter.take(request.userId, request.now))
    throw new ApiError('TOO_MANY_REQUESTS')
  // 자리는 기다리는 동안 다른 요청이 가로채지 못하게 바로 잡는다.
  kit.running.add(request.councilId)
  // 여러 번 불려도 한 번만 푼다: 그 사이 같은 학생회의 새 묶음이 잡은 자리를 풀지 않게.
  let released = false
  const release = () => {
    if (released) return
    released = true
    kit.running.delete(request.councilId)
  }
  // 엑셀을 만드는 사이나 보내는 중에 연결이 끊기면 스트림이 취소되지 않을 수 있어, 끊김 자체에서도 푼다(이미 끊겼어도).
  if (signal.aborted) release()
  else signal.addEventListener('abort', release, { once: true })
  const workbook = await workbookOf(workbookInputOf('audit', loaded)).catch((error: unknown) => {
    release()
    throw error
  })
  return bundleStream({
    workbook,
    workbookName: fileNameOf(loaded, 'audit', request.now, 'xlsx'),
    photos: loaded.photos,
    storage: kit.storage,
    onDone: release,
  })
}

// 결산서 엑셀(공개용·감사용)과 증빙 묶음(감사용 엑셀과 영수증 사진, 재정부만).
export function createClosingExportRoutes(
  db: Db,
  getSession: SessionReader,
  options: {
    clock?: () => Date
    // 없으면 묶음만 막힌다(STORAGE_NOT_CONFIGURED). 엑셀은 저장소 없이 된다.
    storage?: FileStorage | undefined
    // 계정마다 10분에 5번
    bundleLimiter?: RateLimiter
  } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const limiter = options.bundleLimiter ?? createRateLimiter(BUNDLE_LIMIT)
  const running = new Set<string>()
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const requestOf = (c: Context<SessionEnv>): ExportRequest => ({
    userId: c.get('userId'),
    councilId: councilIdOf(c.req.param('councilId')),
    periodId: recordIdOf(c.req.param('periodId')),
    now: clock(),
  })
  routes.get(`${root}/export`, auth, async c => {
    const request = requestOf(c)
    const { type }: ClosingExportQuery = parseQuery(ClosingExportQuerySchema, c.req.queries())
    const loaded = await loadExport(db, request, type, false)
    const body = await workbookOf(workbookInputOf(type, loaded))
    const name = fileNameOf(loaded, type, request.now, 'xlsx')
    return c.body(new Uint8Array(body), { headers: attachmentHeaders(name, XLSX_TYPE) })
  })
  routes.get(`${root}/audit.zip`, auth, async c => {
    const request = requestOf(c)
    const loaded = await loadExport(db, request, 'audit', true)
    const storage = requireStorage(options.storage)
    const stream = await startBundle(
      { running, limiter, storage },
      request,
      loaded,
      c.req.raw.signal,
    )
    const name = fileNameOf(loaded, 'audit', request.now, 'zip')
    return c.body(stream, { headers: attachmentHeaders(name, ZIP_TYPE) })
  })
  return routes
}
