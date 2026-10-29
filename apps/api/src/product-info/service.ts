import type { ProductInfoResponse } from '@vada/contracts'
import type { Db } from '../db/types.js'
import { coupangProductOf, coupangShortLinkOf, type CoupangProduct } from './coupang-url.js'
import { createDailyCap } from './daily-cap.js'
import {
  LOOKUP_BUDGET_MS,
  type LookupOutcome,
  type LookupResult,
  type ProductLookup,
} from './reef.js'
import type { ShortLinkCode, ShortLinkResolver } from './short-link.js'
import { readStoredProduct, saveStoredProduct, storableProduct } from './store.js'

// 상품 정보는 보낼 때(선조회) 또는 처음 읽을 때 한 번 불러 DB에 두고, 읽기는 그 값을 기간 없이 쓴다.
// 다시 부르는 것은 사람이 새로고침할 때뿐이다(기능 022 정한 것 17, 대표 결정 2026-10-29). 가격은 초안이고 금액은 승인 때 정한다(DEC-40).
// 서버 전체에서 하루에 ReefAPI를 실제로 부르는 횟수의 상한. Pro는 달 10,000 credits이고 한 번에 2 credits라 달 5,000번,
// 30일로 나누면 하루 약 166번이다. 남는 몫을 두고 150번이다. 넘으면 크레딧이 떨어졌을 때처럼 불러오지 못하고 사람이 품목을 적는다.
// 새로고침도 같은 상한을 쓴다.
const REEF_CALLS_PER_DAY = 150
// 크레딧, 키, 하루 상한, 저장 실패는 사람이 손볼 일이라 경고 단계로 남긴다.
type LoggedOutcome = LookupOutcome | 'stored' | 'daily_cap' | 'short_failed' | 'store_failed'
const WARN = new Set<LoggedOutcome>(['quota', 'auth', 'daily_cap', 'store_failed'])
// 단축 링크를 못 풀었을 때: 이동할 곳이 상품 주소가 아니면 받지 않는 주소와 같고, 시간 초과·연결 실패는 곧 풀릴 수 있다.
const SHORT_TRANSIENT = new Set<ShortLinkCode>(['timeout', 'network'])
const UNSUPPORTED: ProductInfoResponse = { product: null, reason: 'unsupported' }
const UNAVAILABLE: ProductInfoResponse = { product: null, reason: 'unavailable' }

type LogExtra = {
  diag?: LookupResult['diag'] | undefined
  short?: ShortLinkCode | undefined
  refresh?: boolean
}

// 성공률을 세는 한 줄(DEC-89). 주소·학생회·사람은 넣지 않는다(AGENTS.md '로그·비밀').
// 단축 링크로 온 것은 푼 결과 코드(short)만, 새로고침이면 refresh만 더한다. 단축 링크의 코드와 이동할 곳은 넣지 않는다.
function logOutcome(outcome: LoggedOutcome, { diag, short, refresh }: LogExtra = {}) {
  const line = JSON.stringify({
    event: 'product_info',
    outcome,
    ...(diag ? { code: diag.code, status: diag.status, attempts: diag.attempts } : {}),
    ...(short ? { short } : {}),
    ...(refresh ? { refresh } : {}),
  })
  if (WARN.has(outcome)) console.warn(line)
  else console.log(line)
}

function responseOf(result: LookupResult, fetchedAt: Date): ProductInfoResponse {
  if (result.outcome === 'ok')
    return {
      product: { ...storableProduct(result.product), fetchedAt: fetchedAt.toISOString() },
      reason: null,
    }
  return { product: null, reason: result.outcome === 'not_found' ? 'not_found' : 'unavailable' }
}

// 다른 요청이 먼저 시작한 같은 상품 조회에 합류할 때, 단축 링크를 푸느라 쓴 시간만큼 덜 기다린다.
// 그 조회는 자기 10초를 쓰므로 그대로 기다리면 이 요청은 10초를 넘는다. 남은 몫이 지나면 unavailable이다.
function withinBudget(pending: Promise<ProductInfoResponse>, spentMs: number) {
  if (!spentMs) return pending
  return new Promise<ProductInfoResponse>((resolve, reject) => {
    const timer = setTimeout(() => resolve(UNAVAILABLE), Math.max(LOOKUP_BUDGET_MS - spentMs, 0))
    void pending.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

type Target = { product: CoupangProduct; spentMs: number; short?: 'ok' }

// 단축 링크를 풀어 상품 주소와 쓴 시간을 얻는다. 못 풀면 바로 돌려줄 응답이다.
async function targetOfShort(
  url: string,
  resolve: ShortLinkResolver,
  clock: () => Date,
): Promise<Target | ProductInfoResponse> {
  const started = clock().getTime()
  const resolved = await resolve(url)
  if (resolved.code !== 'ok') {
    logOutcome('short_failed', { short: resolved.code })
    return SHORT_TRANSIENT.has(resolved.code) ? UNAVAILABLE : UNSUPPORTED
  }
  return { product: resolved.product, spentMs: clock().getTime() - started, short: 'ok' }
}

// 키가 없으면 불러오기가 꺼진다. 저장값도 주지 않는다(REEF_API_KEY를 빼서 끄는 것이 쿠팡 문제의 대응이다, 기능 022 '위험').
function keylessResponse(url: string, canResolveShort: boolean) {
  if (coupangProductOf(url)) return UNAVAILABLE
  return canResolveShort && coupangShortLinkOf(url) ? UNAVAILABLE : UNSUPPORTED
}

// 새로고침을 했는데 다시 불러오지 못했으면 알린다. 응답은 저장해 둔 그대로다.
const failedRefresh = (response: ProductInfoResponse | null): ProductInfoResponse => ({
  ...(response ?? UNAVAILABLE),
  refreshFailed: true,
})

// 저장이 안 돼도 불러온 값은 준다. 크레딧은 이미 썼다.
async function saveQuietly(db: Db, url: string, response: ProductInfoResponse, fetchedAt: Date) {
  try {
    if ((await saveStoredProduct(db, url, response, fetchedAt)) === 'too_large')
      logOutcome('store_failed')
  } catch {
    logOutcome('store_failed')
  }
}

// 같은 상품에 진행 중인 일 하나(저장값 읽기에서 부르기·저장까지). fetches는 그 일이 ReefAPI를 부르는지다.
// 저장값 확인부터 저장까지를 한 일로 묶어, 늦게 온 DB 읽기가 그 사이 저장된 값을 놓치고 다시 부르지 않게 한다.
type Job = { done: Promise<ProductInfoResponse>; fetches: boolean }
// 새로고침이 저장값만 읽는 일을 기다려 주는 횟수. 그 일은 DB 한 번이라 금방 끝난다.
const JOIN_TRIES = 3

// ReefAPI를 실제로 부르는 한 곳. 하루 상한을 센다.
function createCaller(db: Db, reef: ProductLookup, clock: () => Date) {
  const dailyCap = createDailyCap(REEF_CALLS_PER_DAY)
  return async (target: Target, refresh: boolean): Promise<ProductInfoResponse> => {
    if (!dailyCap.take(clock())) {
      logOutcome('daily_cap', { short: target.short, refresh })
      return UNAVAILABLE
    }
    const result = await reef(target.product, target.spentMs)
    logOutcome(result.outcome, { diag: result.diag, short: target.short, refresh })
    const fetchedAt = clock()
    const response = responseOf(result, fetchedAt)
    // 저장을 마친 뒤에 진행 중인 일에서 빠진다. 그 사이에 온 읽기는 합류하고, 뒤에 온 읽기는 저장값을 읽는다.
    await saveQuietly(db, target.product.url, response, fetchedAt)
    return response
  }
}

// 상품마다 진행 중인 일을 하나로 합친다. 같은 상품이 동시에 오면(대화방의 여럿이 같은 링크를 엶, 선조회와 패널) 한 번만 부르고 결과를 나눈다.
function createJobs(db: Db, reef: ProductLookup, clock: () => Date) {
  const jobs = new Map<string, Job>()
  const call = createCaller(db, reef, clock)
  function start(key: string, work: (job: Job) => Promise<ProductInfoResponse>) {
    const job: Job = { done: Promise.resolve(UNAVAILABLE), fetches: false }
    job.done = work(job).finally(() => {
      if (jobs.get(key) === job) jobs.delete(key)
    })
    jobs.set(key, job)
    return job.done
  }
  // 새로고침이 못 불러왔으면 저장값을 그대로 두고 그것을 준다.
  async function settled(key: string, fresh: ProductInfoResponse) {
    if (fresh.reason !== 'unavailable') return fresh
    return failedRefresh(await readStoredProduct(db, key))
  }
  async function read(target: Target) {
    const key = target.product.url
    const current = jobs.get(key)
    if (current) {
      const shared = await withinBudget(current.done, target.spentMs)
      // 실패한 새로고침에 합류했어도 저장값이 있으면 그것을 준다.
      return shared.reason === 'unavailable'
        ? ((await readStoredProduct(db, key)) ?? shared)
        : shared
    }
    return start(key, async job => {
      const stored = await readStoredProduct(db, key)
      if (stored) {
        logOutcome('stored', { short: target.short })
        return stored
      }
      job.fetches = true
      return call(target, false)
    })
  }
  // 새로고침은 저장값을 보지 않고 부른다. 부르는 중인 일이 있으면 그 결과가 새 값이라 합류한다.
  async function refresh(target: Target) {
    const key = target.product.url
    for (let tries = 0; tries < JOIN_TRIES; tries++) {
      const current = jobs.get(key)
      if (!current) break
      const shared = await withinBudget(current.done, target.spentMs)
      if (current.fetches) return settled(key, shared)
    }
    const fresh = await start(key, job => {
      job.fetches = true
      return call(target, true)
    })
    return settled(key, fresh)
  }
  return { read, refresh }
}

type Options = { refresh?: boolean | undefined }

// 쿠팡 상품 주소가 아니면 부르지 않는다. 단축 링크는 resolveShortLink가 있을 때만 상품 주소로 풀고,
// 풀린 상품 주소를 저장 열쇠로 쓴다(기능 022 정한 것 13).
export function createProductInfo({
  db,
  lookup,
  resolveShortLink,
  clock,
}: {
  db: Db
  lookup: ProductLookup | undefined
  resolveShortLink?: ShortLinkResolver | undefined
  clock: () => Date
}) {
  if (!lookup)
    return (url: string, { refresh }: Options = {}): Promise<ProductInfoResponse> => {
      const response = keylessResponse(url, resolveShortLink !== undefined)
      return Promise.resolve(
        refresh && response.reason === 'unavailable' ? failedRefresh(response) : response,
      )
    }
  const jobs = createJobs(db, lookup, clock)
  return async (url: string, { refresh }: Options = {}): Promise<ProductInfoResponse> => {
    const product = coupangProductOf(url)
    const target: Target | ProductInfoResponse = product
      ? { product, spentMs: 0 }
      : resolveShortLink && coupangShortLinkOf(url)
        ? await targetOfShort(url, resolveShortLink, clock)
        : UNSUPPORTED
    if (!('spentMs' in target))
      return refresh && target.reason === 'unavailable' ? failedRefresh(target) : target
    return refresh ? jobs.refresh(target) : jobs.read(target)
  }
}
