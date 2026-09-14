import { findDataSource } from './definitions'
import {
  NotBuiltYet,
  SourcesFailed,
  urlOf,
  type Server,
  type SourceCall,
  type SourceFailure,
} from './server-contract'
import { isServed } from './served'

/** 서버 연결과 사용자별 출처 캐시의 전체 수명주기를 소유한다. */
export class SourceStore {
  private server: Server | null = null
  private identity = ''
  private readonly cache = new Map<string, unknown>()
  private readonly coming = new Map<string, Promise<void>>()
  private readonly broken = new Map<string, SourceFailure>()

  private empty(): void {
    this.cache.clear()
    this.coming.clear()
    this.broken.clear()
  }

  configure(next: Server | null): () => void {
    const before = this.server
    this.server = next
    this.identity = ''
    this.empty()
    return () => {
      this.server = before
      this.empty()
    }
  }

  forget(): void {
    this.empty()
  }

  serving(): boolean {
    return this.server !== null
  }

  current(): Server | null {
    return this.server
  }

  serveAs(identity: string): void {
    if (identity === this.identity) return
    this.identity = identity
    this.empty()
  }

  private slotOf(call: SourceCall): string {
    const parts = Object.keys(call.params)
      .sort()
      .map((name) => `${name}=${call.params[name]}`)
    const named = parts.length === 0 ? call.key : `${call.key}?${parts.join('&')}`
    return `${this.identity}|${named}`
  }

  private bring(call: SourceCall): Promise<void> {
    const slot = this.slotOf(call)
    const already = this.coming.get(slot)
    if (already !== undefined) return already
    const at = this.server!
    const run = (async () => {
      try {
        const source = findDataSource(call.key)
        const response = await at.fetch(
          `${at.baseUrl ?? ''}${urlOf(source.request.path, call.params)}`,
        )
        if (!response.ok) {
          const said = (await response.json().catch(() => null)) as { message?: unknown } | null
          this.broken.set(slot, {
            key: call.key,
            status: response.status,
            ...(typeof said?.message === 'string' ? { message: said.message } : {}),
          })
          return
        }
        this.cache.set(slot, await response.json())
        this.broken.delete(slot)
      } catch {
        this.broken.set(slot, { key: call.key })
      } finally {
        this.coming.delete(slot)
      }
    })()
    this.coming.set(slot, run)
    return run
  }

  async load(calls: readonly SourceCall[]): Promise<void> {
    if (this.server === null) return
    const failed: SourceFailure[] = []
    await Promise.all(
      calls.map(async (call) => {
        if (!isServed(call.key)) return
        const slot = this.slotOf(call)
        if (this.cache.has(slot)) return
        await this.bring(call)
        const why = this.broken.get(slot)
        if (why !== undefined) failed.push(why)
      }),
    )
    if (failed.length > 0) throw new SourcesFailed(failed)
  }

  read(key: string, params: Record<string, string> = {}): unknown {
    if (this.server === null) return undefined
    if (!isServed(key)) throw new NotBuiltYet(key)
    const slot = this.slotOf({ key, params })
    if (this.cache.has(slot)) return this.cache.get(slot)
    const failed = this.broken.get(slot)
    if (failed !== undefined) throw new SourcesFailed([failed])
    throw this.bring({ key, params })
  }
}
