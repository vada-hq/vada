import type { Context, Hono } from 'hono'
import {
  AttachEvidenceSchema,
  CreatePhotoUploadSchema,
  type ExpenseResponse,
  type PhotoUploadResponse,
} from '@vada/contracts'
import { authorize, inCouncilChange, recordIdOf } from '../access/authorize.js'
import type { requireSession, SessionEnv } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import type { RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import type { FileStorage } from '../storage/storage.js'
import {
  isStorageKeyConflict,
  issueUpload,
  requireStorage,
  verifyUploads,
} from '../storage/uploads.js'
import { attachEvidence } from './evidence.js'
import { evidenceFileToView, expenseRowOf } from './queries.js'

const root = '/organizations/:councilId/expenses/:expenseId'
const CREATED = 201
const FOUND = 302
// 키의 맨 앞. 대화 사진(chat/)과 섞이지 않는다.
const EVIDENCE_AREA = 'evidence'

const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

type Kit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  db: Db
  clock: () => Date
  storage: FileStorage | undefined
  uploadLimiter: RateLimiter
}

// 같은 사진 키가 동시에 두 번 붙으면 저장소 위치 UNIQUE가 막는다. 이미 보낸 사진으로 답한다.
async function sentOnce<T>(run: () => Promise<T>) {
  try {
    return await run()
  } catch (error) {
    if (isStorageKeyConflict(error)) throw new ApiError('PHOTO_ALREADY_SENT')
    throw error
  }
}

type Action = 'council.view' | 'finance.manage'
const requestOf = (c: Context<SessionEnv>, action: Action, clock: () => Date) => ({
  userId: c.get('userId'),
  councilId: c.req.param('councilId') ?? '',
  action,
  now: clock(),
})

// 사진 보기는 모든 운영진이다(PRIN-5). 지출에 붙은 증빙의 파일만 열린다.
function addViewRoute({ routes, auth, db, clock, storage }: Kit) {
  routes.get(`${root}/files/:fileId`, auth, async c => {
    const asked = requestOf(c, 'council.view', clock)
    const expenseId = recordIdOf(c.req.param('expenseId'))
    const fileId = recordIdOf(c.req.param('fileId'))
    const found = await db.transaction(
      async tx => evidenceFileToView(tx, await authorize(tx, asked), expenseId, fileId),
      snapshot,
    )
    const url = await requireStorage(storage).downloadUrl(found.key, found.name, found.mediaType)
    // 주소는 5분짜리 비밀이다. 다른 곳에 남지 않게 한다.
    c.header('Cache-Control', 'private, no-store')
    return c.redirect(url, FOUND)
  })
}

// 올리기 주소와 붙이기는 재정부만이다(DEC-28).
export function addEvidenceRoutes(kit: Kit) {
  const { routes, auth, db, clock, storage, uploadLimiter } = kit
  // 403이 404와 503보다 먼저다. 재정부이고 이 학생회의 지출일 때만 지나간다.
  const financeOf = (c: Context<SessionEnv>) => {
    const asked = requestOf(c, 'finance.manage', clock)
    const expenseId = recordIdOf(c.req.param('expenseId'))
    return db.transaction(async tx => {
      const actor = await authorize(tx, asked)
      await expenseRowOf(tx, actor, expenseId)
      return actor
    }, snapshot)
  }
  routes.post(`${root}/uploads`, json(CreatePhotoUploadSchema), auth, async c => {
    if (!uploadLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    const actor = await financeOf(c)
    const issued = await issueUpload(requireStorage(storage), EVIDENCE_AREA, actor)
    return c.json(issued satisfies PhotoUploadResponse)
  })
  routes.post(`${root}/evidence`, json(AttachEvidenceSchema), auth, async c => {
    const { key, type } = c.req.valid('json')
    const expenseId = recordIdOf(c.req.param('expenseId'))
    const actor = await financeOf(c)
    // 저장소는 거래 밖에서 확인한다(저장소를 기다리는 동안 잠금을 쥐지 않는다). 확인이 끝나기 전에는 아무것도 만들지 않는다.
    const owner = { area: EVIDENCE_AREA, actor }
    const [photo] = await verifyUploads(db, requireStorage(storage), owner, [key])
    if (!photo) throw new ApiError('UPLOAD_MISMATCH')
    const asked = requestOf(c, 'council.view', clock)
    const detail = await sentOnce(() =>
      inCouncilChange(db, asked, (tx, changer) =>
        attachEvidence(tx, changer, expenseId, { photo, type }),
      ),
    )
    return c.json({ expense: detail } satisfies ExpenseResponse, CREATED)
  })
  addViewRoute(kit)
}
